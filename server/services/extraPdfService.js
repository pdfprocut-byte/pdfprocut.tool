import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFDocument, PDFName, PDFRef, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';
import { AnnotationMode, ImageKind, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { strToU8, zipSync } from 'fflate';
import { ApiError } from '../utils/ApiError.js';
import { readPdf } from './pdfReader.js';

const maxPages = 100;
const maxRenderPixels = 12_000_000;
const maxTotalRenderPixels = 80_000_000;

function reserveRenderPixels(total, width, height) {
  const pixels = Math.ceil(width) * Math.ceil(height);
  if (!Number.isFinite(pixels) || pixels < 1 || total + pixels > maxTotalRenderPixels) {
    throw new ApiError(413, 'This PDF is too large for image rendering in one run. Try fewer or smaller pages.');
  }
  return total + pixels;
}

async function openPdf(file) {
  try {
    const document = await readPdf(file.buffer);
    if (document.numPages > maxPages) {
      await document.destroy();
      throw new ApiError(413, `This tool supports up to ${maxPages} pages per PDF`);
    }
    return document;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'PasswordException' || error.message?.toLowerCase().includes('password')) {
      throw new ApiError(400, 'This PDF is password-protected. Unlock it first.');
    }
    throw new ApiError(422, 'Could not read this PDF. Upload a valid PDF and try again.');
  }
}

function parsePageList(value, pageCount) {
  if (!String(value || '').trim()) return Array.from({ length: pageCount }, (_, index) => index);
  const pages = new Set();
  for (const part of String(value).split(',')) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!match) throw new ApiError(400, 'Use page ranges such as 1-3,5');
    const first = Number(match[1]);
    const last = Number(match[2] || first);
    if (first < 1 || last < first || last > pageCount) throw new ApiError(400, 'Page range exceeds document page count');
    for (let page = first; page <= last; page += 1) pages.add(page - 1);
  }
  return [...pages];
}

export async function repairPdf(file) {
  try {
    const document = await PDFDocument.load(file.buffer, { updateMetadata: false, throwOnInvalidObject: false });
    if (!document.getPageCount()) throw new Error('empty PDF');
    return await document.save({ useObjectStreams: true, addDefaultPage: false });
  } catch {
    const source = await openPdf(file);
    const repaired = await PDFDocument.create();
    let renderedPixels = 0;
    try {
      for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
        const page = await source.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, Math.sqrt(maxRenderPixels / (base.width * base.height)));
        const viewport = page.getViewport({ scale });
        renderedPixels = reserveRenderPixels(renderedPixels, viewport.width, viewport.height);
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        try {
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          const image = await repaired.embedJpg(canvas.toBuffer('image/jpeg', 90));
          const output = repaired.addPage([base.width, base.height]);
          output.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
        } finally {
          page.cleanup();
          canvas.width = 0;
          canvas.height = 0;
        }
      }
      return await repaired.save({ useObjectStreams: true });
    } finally {
      await source.destroy().catch(() => {});
    }
  }
}

export async function cleanPdfMetadata(file) {
  let document;
  try {
    document = await PDFDocument.load(file.buffer, { updateMetadata: false, throwOnInvalidObject: false });
  } catch (error) {
    if (error.name === 'EncryptedPDFError' || error.message?.toLowerCase().includes('password')) {
      throw new ApiError(400, 'This PDF is password-protected. Unlock it first.');
    }
    throw new ApiError(422, 'Could not open this PDF for metadata removal');
  }

  const infoRef = document.context.trailerInfo.Info;
  if (infoRef instanceof PDFRef) document.context.delete(infoRef);
  document.context.trailerInfo.Info = undefined;

  const metadataName = PDFName.of('Metadata');
  const metadataRef = document.catalog.get(metadataName);
  document.catalog.delete(metadataName);
  if (metadataRef instanceof PDFRef) document.context.delete(metadataRef);
  document.catalog.delete(PDFName.of('Lang'));

  try {
    return await document.save({ addDefaultPage: false, rewrite: true });
  } catch {
    throw new ApiError(422, 'Could not save this PDF after removing its metadata');
  }
}

export async function cropPdf(file, options = {}) {
  let document;
  try { document = await PDFDocument.load(file.buffer); }
  catch { throw new ApiError(422, 'Could not open this PDF for cropping'); }
  const pages = parsePageList(options.pages, document.getPageCount());
  const left = Number(options.left ?? 0);
  const right = Number(options.right ?? 0);
  const top = Number(options.top ?? 0);
  const bottom = Number(options.bottom ?? 0);
  for (const value of [left, right, top, bottom]) {
    if (!Number.isFinite(value) || value < 0 || value > 500) throw new ApiError(400, 'Crop margins must be between 0 and 500 points');
  }
  for (const index of pages) {
    const page = document.getPage(index);
    const box = page.getCropBox();
    if (left + right >= box.width || top + bottom >= box.height) throw new ApiError(400, 'Crop margins are too large for one or more pages');
    page.setCropBox(box.x + left, box.y + bottom, box.width - left - right, box.height - top - bottom);
  }
  return document.save({ useObjectStreams: true });
}

export async function unlockPdf(file, password) {
  if (typeof password !== 'string' || password.length < 1 || password.length > 128) throw new ApiError(400, 'Enter the PDF password');
  try {
    const document = await PDFDocument.load(file.buffer, { password, updateMetadata: false });
    return await document.save({ useObjectStreams: true });
  } catch {
    throw new ApiError(400, 'Could not unlock this PDF. Check the password and try again.');
  }
}

export async function signPdf(file, signatureFile, options = {}) {
  if (!signatureFile && options.allowTextOnly !== true) throw new ApiError(400, 'Upload a PNG or JPG signature image');
  let document;
  try { document = await PDFDocument.load(file.buffer); }
  catch { throw new ApiError(422, 'Could not open this PDF for signing'); }
  let signature = null;
  if (signatureFile) {
    try {
      if (signatureFile.mimetype === 'image/png') signature = await document.embedPng(signatureFile.buffer);
      else if (signatureFile.mimetype === 'image/jpeg') signature = await document.embedJpg(signatureFile.buffer);
      else throw new ApiError(415, 'Signature images must be PNG or JPG');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(415, 'Could not read the signature image');
    }
  }
  const pageNumber = Number(options.page || 1);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > document.getPageCount()) throw new ApiError(400, 'Choose a valid PDF page for the signature');
  const widthPercent = Number(options.widthPercent ?? 22);
  if (!Number.isFinite(widthPercent) || widthPercent < 5 || widthPercent > 60) throw new ApiError(400, 'Signature width must be between 5% and 60% of the page');
  const opacity = Number(options.opacity ?? 100) / 100;
  const frameWidth = Number(options.frameWidth ?? 0);
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new ApiError(400, 'Image opacity must be between 0% and 100%');
  if (!Number.isFinite(frameWidth) || frameWidth < 0 || frameWidth > 20) throw new ApiError(400, 'Frame width must be between 0 and 20 points');
  const frameHex = String(options.frameColor || '#d9273d').replace(/^#/, '');
  if (!/^[\da-fA-F]{6}$/.test(frameHex)) throw new ApiError(400, 'Choose a valid frame color');
  const page = document.getPage(pageNumber - 1);
  const { width, height } = page.getSize();
  const pageRotation = ((page.getRotation().angle % 360) + 360) % 360;
  if (signature) {
    let imageWidth;
    let imageHeight;
    let x;
    let y;
    let drawRotation = 0;
    if (options.xPercent !== undefined || options.yPercent !== undefined) {
      const xPercent = Number(options.xPercent);
      const yPercent = Number(options.yPercent);
      const imageRotation = Number(options.rotation ?? 0);
      if (![xPercent, yPercent].every(Number.isFinite) || xPercent < 0 || xPercent > 100 || yPercent < 0 || yPercent > 100) {
        throw new ApiError(400, 'Choose a valid signature position on the page');
      }
      if (![0, 90, 180, 270].includes(pageRotation)) throw new ApiError(422, 'This PDF page has an unsupported rotation');
      if (!Number.isFinite(imageRotation) || imageRotation < 0 || imageRotation >= 360) throw new ApiError(400, 'Choose an image rotation between 0 and 359.9 degrees');
      const imageRadians = imageRotation * Math.PI / 180;
      const absCos = Math.abs(Math.cos(imageRadians));
      const absSin = Math.abs(Math.sin(imageRadians));
      const isSidewaysPage = pageRotation === 90 || pageRotation === 270;
      const displayWidth = isSidewaysPage ? height : width;
      const displayHeight = isSidewaysPage ? width : height;
      const marginX = Math.min(36, displayWidth / 20);
      const marginY = Math.min(36, displayHeight / 20);
      const maxWidth = Math.min(displayWidth * widthPercent / 100, displayWidth - 2 * marginX);
      const maxHeight = displayHeight - 2 * marginY;
      const naturalDisplayWidth = absCos * signature.width + absSin * signature.height;
      const naturalDisplayHeight = absSin * signature.width + absCos * signature.height;
      const scale = Math.min(maxWidth / naturalDisplayWidth, maxHeight / naturalDisplayHeight);
      const displayImageWidth = naturalDisplayWidth * scale;
      const displayImageHeight = naturalDisplayHeight * scale;
      imageWidth = signature.width * scale;
      imageHeight = signature.height * scale;
      const displayX = Math.min(displayWidth - displayImageWidth, Math.max(0, displayWidth * xPercent / 100));
      const displayY = Math.min(displayHeight - displayImageHeight, Math.max(0, displayHeight * yPercent / 100));
      const centerX = displayX + displayImageWidth / 2;
      const centerY = displayY + displayImageHeight / 2;
      let pdfCenterX;
      let pdfCenterY;
      if (pageRotation === 0) { pdfCenterX = centerX; pdfCenterY = height - centerY; }
      else if (pageRotation === 90) { pdfCenterX = centerY; pdfCenterY = centerX; }
      else if (pageRotation === 180) { pdfCenterX = width - centerX; pdfCenterY = centerY; }
      else { pdfCenterX = width - centerY; pdfCenterY = height - centerX; }
      x = pdfCenterX - imageWidth / 2;
      y = pdfCenterY - imageHeight / 2;
      drawRotation = pageRotation - imageRotation;
    } else {
      const marginX = Math.min(36, width / 20);
      const marginY = Math.min(36, height / 20);
      const maxWidth = Math.min(width * widthPercent / 100, width - 2 * marginX);
      const maxHeight = height - 2 * marginY;
      const scale = Math.min(maxWidth / signature.width, maxHeight / signature.height);
      imageWidth = signature.width * scale;
      imageHeight = signature.height * scale;
      const position = String(options.position || 'bottom-right');
      const positions = {
        'bottom-right': [width - imageWidth - marginX, marginY],
        'bottom-left': [marginX, marginY],
        'top-right': [width - imageWidth - marginX, height - imageHeight - marginY],
        'top-left': [marginX, height - imageHeight - marginY],
        center: [(width - imageWidth) / 2, (height - imageHeight) / 2]
      };
      if (!positions[position]) throw new ApiError(400, 'Choose a supported signature position');
      [x, y] = positions[position];
    }
    page.drawImage(signature, { x, y, width: imageWidth, height: imageHeight, opacity, rotate: degrees(drawRotation) });
    if (frameWidth > 0) {
      const frameColor = rgb(parseInt(frameHex.slice(0, 2), 16) / 255, parseInt(frameHex.slice(2, 4), 16) / 255, parseInt(frameHex.slice(4, 6), 16) / 255);
      page.drawRectangle({ x, y, width: imageWidth, height: imageHeight, rotate: degrees(drawRotation), color: rgb(1, 1, 1), opacity: 0, borderColor: frameColor, borderWidth: frameWidth, borderOpacity: 1 });
    }
  }

  let textItems;
  try {
    textItems = Array.isArray(options.textItems) ? options.textItems : options.textItems ? JSON.parse(options.textItems) : [];
  } catch {
    throw new ApiError(400, 'Text layers could not be read');
  }
  if (!Array.isArray(textItems) || textItems.length > 20) throw new ApiError(400, 'Add between 0 and 20 text layers');
  if (!textItems.length && options.overlayText) textItems = [{ text: options.overlayText, xPercent: options.textXPercent, yPercent: options.textYPercent, size: options.textSize, color: options.textColor, font: options.textFont }];
  if (!signature && !textItems.some((item) => typeof item?.text === 'string' && item.text.trim())) throw new ApiError(400, 'Add text or upload an image to edit the PDF');
  const textFontNames = [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique, StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic, StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique];
  const textFontAliases = { Helvetica: StandardFonts.Helvetica, HelveticaBold: StandardFonts.HelveticaBold, HelveticaOblique: StandardFonts.HelveticaOblique, HelveticaBoldOblique: StandardFonts.HelveticaBoldOblique, TimesRoman: StandardFonts.TimesRoman, TimesRomanBold: StandardFonts.TimesRomanBold, TimesRomanItalic: StandardFonts.TimesRomanItalic, TimesRomanBoldItalic: StandardFonts.TimesRomanBoldItalic, Courier: StandardFonts.Courier, CourierBold: StandardFonts.CourierBold, CourierOblique: StandardFonts.CourierOblique, CourierBoldOblique: StandardFonts.CourierBoldOblique };
  const embeddedTextFonts = new Map();
  const isSidewaysTextPage = pageRotation === 90 || pageRotation === 270;
  const textDisplayWidth = isSidewaysTextPage ? height : width;
  const textDisplayHeight = isSidewaysTextPage ? width : height;
  const textMarginX = Math.min(12, textDisplayWidth / 50);
  for (const item of textItems) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ApiError(400, 'A text layer is invalid');
    const overlayText = String(item.text || '').trim().slice(0, 250);
    if (!overlayText) continue;
    const textSize = Number(item.size ?? 20);
    const requestedFontName = String(item.font || StandardFonts.HelveticaBold);
    const textFontName = textFontAliases[requestedFontName] || requestedFontName;
    if (!Number.isFinite(textSize) || textSize < 6 || textSize > 72) throw new ApiError(400, 'Text size must be between 6 and 72 points');
    if (!textFontNames.includes(textFontName)) throw new ApiError(400, 'Choose a supported text font');
    const textHex = String(item.color || '#d9273d').replace(/^#/, '');
    if (!/^[\da-fA-F]{6}$/.test(textHex)) throw new ApiError(400, 'Choose a valid text color');
    const textXPercent = Number(item.xPercent ?? 12);
    const textYPercent = Number(item.yPercent ?? 16);
    if (![textXPercent, textYPercent].every(Number.isFinite) || textXPercent < 0 || textXPercent > 100 || textYPercent < 0 || textYPercent > 100) throw new ApiError(400, 'Choose a valid text position on the page');
    const displayX = Math.min(textDisplayWidth - textMarginX, Math.max(0, textDisplayWidth * textXPercent / 100));
    const textMaxWidth = Math.max(12, textDisplayWidth - displayX - textMarginX);
    let font = embeddedTextFonts.get(textFontName);
    if (!font) {
      font = await document.embedFont(textFontName);
      embeddedTextFonts.set(textFontName, font);
    }
    let lineCount;
    try {
      lineCount = overlayText.split(/\r?\n/).reduce((count, line) => count + Math.max(1, Math.ceil(font.widthOfTextAtSize(line, textSize) / textMaxWidth)), 0);
    } catch {
      throw new ApiError(400, 'The selected built-in font cannot display one or more of these characters');
    }
    const textHeight = Math.min(textDisplayHeight, lineCount * textSize * 1.2);
    const displayY = Math.min(textDisplayHeight - textHeight, Math.max(0, textDisplayHeight * textYPercent / 100));
    const baselineY = displayY + textSize;
    let pdfX;
    let pdfY;
    if (pageRotation === 0) { pdfX = displayX; pdfY = height - baselineY; }
    else if (pageRotation === 90) { pdfX = baselineY; pdfY = displayX; }
    else if (pageRotation === 180) { pdfX = width - displayX; pdfY = baselineY; }
    else { pdfX = width - baselineY; pdfY = height - displayX; }
    const textColor = rgb(parseInt(textHex.slice(0, 2), 16) / 255, parseInt(textHex.slice(2, 4), 16) / 255, parseInt(textHex.slice(4, 6), 16) / 255);
    try {
      page.drawText(overlayText, { x: pdfX, y: pdfY, size: textSize, font, color: textColor, rotate: degrees(pageRotation), maxWidth: textMaxWidth, lineHeight: textSize * 1.2 });
    } catch {
      throw new ApiError(400, 'The selected built-in font cannot display one or more of these characters');
    }
  }
  return document.save({ useObjectStreams: true });
}

export async function pdfToImages(file, options = {}) {
  const format = String(options.format || 'jpg').toLowerCase();
  if (!['jpg', 'png'].includes(format)) throw new ApiError(400, 'Choose JPG or PNG output');
  const quality = Number(options.quality ?? 88);
  if (format === 'jpg' && (!Number.isInteger(quality) || quality < 50 || quality > 100)) throw new ApiError(400, 'Image quality must be between 50 and 100');
  const document = await openPdf(file);
  const images = {};
  let renderedPixels = 0;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, Math.sqrt(maxRenderPixels / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      renderedPixels = reserveRenderPixels(renderedPixels, viewport.width, viewport.height);
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const output = format === 'png' ? canvas.toBuffer('image/png') : canvas.toBuffer('image/jpeg', quality);
        images[`PDFPro-page-${String(pageNumber).padStart(3, '0')}.${format}`] = new Uint8Array(output);
      } finally {
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  } finally {
    await document.destroy().catch(() => {});
  }
  return zipSync(images, { level: 6 });
}

export async function flattenPdf(file) {
  const source = await openPdf(file);
  const output = await PDFDocument.create();
  let renderedPixels = 0;
  try {
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
      const page = await source.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, Math.sqrt(maxRenderPixels / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      renderedPixels = reserveRenderPixels(renderedPixels, viewport.width, viewport.height);
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport, intent: 'display', annotationMode: AnnotationMode.ENABLE }).promise;
        const image = await output.embedPng(canvas.toBuffer('image/png'));
        const outputPage = output.addPage([base.width, base.height]);
        outputPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
      } finally {
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  } finally {
    await source.destroy().catch(() => {});
  }
  return output.save({ useObjectStreams: true });
}

function imageDataToPng(imageData) {
  const width = Math.floor(Number(imageData?.width));
  const height = Math.floor(Number(imageData?.height));
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) return null;
  const canvas = createCanvas(width, height);
  try {
    const context = canvas.getContext('2d');
    if (imageData.bitmap) {
      context.drawImage(imageData.bitmap, 0, 0, width, height);
    } else {
      const sourceValue = imageData.data;
      if (!sourceValue) return null;
      const source = ArrayBuffer.isView(sourceValue)
        ? new Uint8Array(sourceValue.buffer, sourceValue.byteOffset, sourceValue.byteLength)
        : sourceValue instanceof ArrayBuffer ? new Uint8Array(sourceValue) : Uint8Array.from(sourceValue);
      const pixels = context.createImageData(width, height);
      const target = pixels.data;
      const kind = imageData.kind;
      if (kind === ImageKind.RGBA_32BPP || source.length === width * height * 4) {
        if (source.length < target.length) return null;
        target.set(source.subarray(0, target.length));
      } else if (kind === ImageKind.RGB_24BPP || source.length === width * height * 3) {
        if (source.length < width * height * 3) return null;
        for (let sourceIndex = 0, targetIndex = 0; targetIndex < target.length; sourceIndex += 3, targetIndex += 4) {
          target[targetIndex] = source[sourceIndex];
          target[targetIndex + 1] = source[sourceIndex + 1];
          target[targetIndex + 2] = source[sourceIndex + 2];
          target[targetIndex + 3] = 255;
        }
      } else if (kind === ImageKind.GRAYSCALE_1BPP) {
        const stride = Math.ceil(width / 8);
        if (source.length < stride * height) return null;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const white = Boolean(source[y * stride + (x >> 3)] & (128 >> (x & 7)));
            const value = white ? 255 : 0;
            const targetIndex = (y * width + x) * 4;
            target[targetIndex] = value;
            target[targetIndex + 1] = value;
            target[targetIndex + 2] = value;
            target[targetIndex + 3] = 255;
          }
        }
      } else {
        return null;
      }
      context.putImageData(pixels, 0, 0);
    }
    return new Uint8Array(canvas.toBuffer('image/png'));
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function getPageImageObject(page, id) {
  const objects = id.startsWith('g_') ? page.commonObjs : page.objs;
  if (objects.has(id)) return objects.get(id);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ApiError(422, 'Timed out while decoding an embedded image from this PDF')), 15_000);
    try {
      objects.get(id, (imageData) => {
        clearTimeout(timer);
        resolve(imageData);
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

async function imageDataToPreview(imageData) {
  const width = Math.floor(Number(imageData?.width));
  const height = Math.floor(Number(imageData?.height));
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) return null;
  const scale = Math.min(1, 240 / Math.max(width, height));
  const canvas = createCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  try {
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (imageData.bitmap) {
      context.drawImage(imageData.bitmap, 0, 0, canvas.width, canvas.height);
    } else {
      const png = imageDataToPng(imageData);
      if (!png) return null;
      const image = await loadImage(Buffer.from(png));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    return `data:image/jpeg;base64,${canvas.toBuffer('image/jpeg', 80).toString('base64')}`;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function readEmbeddedImages(file, { includePreview = false, selectedIds } = {}) {
  const source = await openPdf(file);
  const archive = {};
  const images = [];
  const selected = selectedIds ? new Set(selectedIds) : null;
  let totalPixels = 0;
  try {
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
      const page = await source.getPage(pageNumber);
      try {
        const operatorList = await page.getOperatorList();
        const seenObjectIds = new Set();
        let imageNumber = 0;
        for (let index = 0; index < operatorList.fnArray.length; index += 1) {
          const operator = operatorList.fnArray[index];
          const args = operatorList.argsArray[index] || [];
          let imageData = null;
          if (operator === OPS.paintImageXObject || operator === OPS.paintImageXObjectRepeat) {
            const id = args[0];
            if (typeof id !== 'string' || seenObjectIds.has(id)) continue;
            seenObjectIds.add(id);
            imageData = await getPageImageObject(page, id);
          } else if (operator === OPS.paintInlineImageXObject || operator === OPS.paintInlineImageXObjectGroup) {
            imageData = args[0];
          } else {
            continue;
          }

          if (!imageData?.width || !imageData?.height) continue;
          const pixels = Number(imageData.width) * Number(imageData.height);
          if (!Number.isSafeInteger(pixels) || pixels < 1 || pixels > maxRenderPixels || totalPixels + pixels > maxTotalRenderPixels) {
            throw new ApiError(413, 'The embedded images exceed this tool’s safe extraction size. Try a PDF with fewer or smaller images.');
          }
          totalPixels += pixels;
          const candidateId = `page-${pageNumber}-image-${imageNumber + 1}`;
          const shouldExport = !includePreview && (!selected || selected.has(candidateId));
          const preview = includePreview || !shouldExport ? await imageDataToPreview(imageData) : null;
          const png = shouldExport ? imageDataToPng(imageData) : null;
          if ((includePreview && !preview) || (!includePreview && !png && !preview)) continue;
          imageNumber += 1;
          const id = `page-${pageNumber}-image-${imageNumber}`;
          const name = `page-${String(pageNumber).padStart(3, '0')}-image-${String(imageNumber).padStart(3, '0')}.png`;
          if (!includePreview && png && (!selected || selected.has(id))) archive[name] = png;
          if (includePreview) {
            images.push({
              id,
              name,
              pageNumber,
              imageNumber,
              width: Number(imageData.width),
              height: Number(imageData.height),
              preview
            });
          }
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await source.destroy().catch(() => {});
  }
  if (includePreview) return images;
  if (!Object.keys(archive).length) throw new ApiError(422, 'No selected extractable raster images were found in this PDF');
  return zipSync(archive, { level: 6 });
}

export async function inspectImagesInPdf(file) {
  const images = await readEmbeddedImages(file, { includePreview: true });
  if (!images.length) throw new ApiError(422, 'No extractable raster images were found in this PDF');
  return images;
}

export async function extractImagesFromPdf(file, selectedIds) {
  return readEmbeddedImages(file, { selectedIds });
}

export async function pdfToPowerPoint(file) {
  const document = await openPdf(file);
  const pageCount = document.numPages;
  const images = {};
  const slideWidth = 12_192_000;
  const slideHeight = 6_858_000;
  let renderedPixels = 0;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, Math.sqrt(maxRenderPixels / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      renderedPixels = reserveRenderPixels(renderedPixels, viewport.width, viewport.height);
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        images[`ppt/media/page-${pageNumber}.jpg`] = new Uint8Array(canvas.toBuffer('image/jpeg', 94));
      } finally {
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
      const fit = Math.min(slideWidth / viewport.width, slideHeight / viewport.height);
      const width = Math.round(viewport.width * fit);
      const height = Math.round(viewport.height * fit);
      const x = Math.round((slideWidth - width) / 2);
      const y = Math.round((slideHeight - height) / 2);
      const picture = `<p:pic><p:nvPicPr><p:cNvPr id="2" name="PDF page ${pageNumber}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
      const groupTree = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
      images[`ppt/slides/slide${pageNumber}.xml`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="PDF page ${pageNumber}"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>${groupTree}${picture}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
      images[`ppt/slides/_rels/slide${pageNumber}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/page-${pageNumber}.jpg"/></Relationships>`);
    }
  } finally {
    await document.destroy().catch(() => {});
  }

  const slideIds = Array.from({ length: pageCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join('');
  const slideRelationships = Array.from({ length: pageCount }, (_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('');
  const slideOverrides = Array.from({ length: pageCount }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slideOverrides}</Types>`;
  const groupTree = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';
  images['[Content_Types].xml'] = strToU8(contentTypes);
  images['_rels/.rels'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
  images['ppt/presentation.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${slideWidth}" cy="${slideHeight}" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  images['ppt/_rels/presentation.xml.rels'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRelationships}</Relationships>`);
  images['ppt/slideMasters/slideMaster1.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="PDFPro"><${groupTree.slice(1)}<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`);
  images['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>');
  images['ppt/slideLayouts/slideLayout1.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank">${groupTree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  images['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>');
  images['ppt/theme/theme1.xml'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="PDFPro"><a:themeElements><a:clrScheme name="PDFPro"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="PDFPro"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="PDFPro"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>');
  images['docProps/core.xml'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>PDFPro PDF conversion</dc:title><dc:creator>PDFPro</dc:creator><cp:lastModifiedBy>PDFPro</cp:lastModifiedBy></cp:coreProperties>');
  images['docProps/app.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>PDFPro</Application><Slides>${pageCount}</Slides><PresentationFormat>On-screen Show (16:9)</PresentationFormat></Properties>`);
  return zipSync(images, { level: 0 });
}

export async function pdfToPdfA(file) {
  const source = await openPdf(file);
  const output = await PDFDocument.create();
  let renderedPixels = 0;
  try {
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
      const page = await source.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, Math.sqrt(maxRenderPixels / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      renderedPixels = reserveRenderPixels(renderedPixels, viewport.width, viewport.height);
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const image = await output.embedJpg(canvas.toBuffer('image/jpeg', 96));
        const outputPage = output.addPage([base.width, base.height]);
        outputPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
      } finally {
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  } finally {
    await source.destroy().catch(() => {});
  }
  output.setTitle('PDFPro PDF/A archive');
  output.setCreator('PDFPro');
  output.setProducer('PDFPro');
  output.setLanguage('en-US');
  output.setCreationDate(new Date());
  output.setModificationDate(new Date());
  try {
    output.convertToPDFA({ conformance: '1B' });
    return await output.save({ useObjectStreams: false });
  } catch {
    throw new ApiError(422, 'Could not create a PDF/A-1b archive from this file');
  }
}

async function extractPdfText(file) {
  const document = await openPdf(file);
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = [];
      let line = '';
      for (const item of content.items) {
        if (item.str) line += `${line && !/\s$/.test(line) && !/^\s/.test(item.str) ? ' ' : ''}${item.str}`;
        if (item.hasEOL && line.trim()) { lines.push(line.trim()); line = ''; }
      }
      if (line.trim()) lines.push(line.trim());
      pages.push(lines);
      page.cleanup();
    }
    return pages;
  } finally {
    await document.destroy().catch(() => {});
  }
}

export async function pdfToMarkdown(file) {
  const pages = await extractPdfText(file);
  const sections = pages.map((lines, index) => `## Page ${index + 1}\n\n${lines.join('\n\n')}`).join('\n\n---\n\n');
  if (!sections.replace(/[#\s|\-]/g, '')) throw new ApiError(422, 'No selectable text was found. Run OCR PDF first for a scanned document.');
  return `# PDFPro export\n\n${sections}\n`;
}

function escapeXml(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

export async function pdfToExcel(file) {
  const pages = await extractPdfText(file);
  const lines = pages.flatMap((pageLines, pageIndex) => pageLines.map((line) => [String(pageIndex + 1), line]));
  if (!lines.length) throw new ApiError(422, 'No selectable text was found. Run OCR PDF first for a scanned document.');
  const rows = lines.map(([pageNumber, text], index) => {
    const row = index + 1;
    return `<row r="${row}"><c r="A${row}" t="inlineStr"><is><t>${escapeXml(pageNumber)}</t></is></c><c r="B${row}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c></row>`;
  }).join('');
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="PDF text" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, strToU8(contents)])), { level: 6 });
}

export async function summarizePdf(file) {
  const pages = await extractPdfText(file);
  const text = pages.flat().join(' ').replace(/\s+/g, ' ').trim();
  if (text.length < 80) throw new ApiError(422, 'Not enough selectable text to summarize. Run OCR PDF first for a scanned document.');
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 25) || [];
  const words = text.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
  const frequencies = new Map();
  for (const word of words) frequencies.set(word, (frequencies.get(word) || 0) + 1);
  const ranked = sentences.map((sentence, index) => {
    const terms = sentence.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
    const score = terms.reduce((sum, word) => sum + Math.log1p(frequencies.get(word) || 0), 0) / Math.max(1, terms.length);
    return { sentence, index, score };
  });
  const count = Math.max(3, Math.min(10, Math.ceil(sentences.length * 0.18)));
  const selected = ranked.sort((a, b) => b.score - a.score).slice(0, count).sort((a, b) => a.index - b.index);
  return { summary: selected.map((item) => item.sentence).join(' '), sourceCharacters: text.length, sentenceCount: sentences.length };
}

export async function comparePdfs(files) {
  if (!Array.isArray(files) || files.length !== 2) throw new ApiError(400, 'Upload exactly two PDFs to compare');
  const [left, right] = await Promise.all(files.map((file) => extractPdfText(file)));
  const max = Math.max(left.length, right.length);
  const pages = [];
  for (let index = 0; index < max; index += 1) {
    const before = (left[index] || []).join(' ').replace(/\s+/g, ' ').trim();
    const after = (right[index] || []).join(' ').replace(/\s+/g, ' ').trim();
    if (before !== after) pages.push({ page: index + 1, status: !before ? 'added' : !after ? 'removed' : 'changed' });
  }
  return { firstPageCount: left.length, secondPageCount: right.length, changedPageCount: pages.length, pages };
}

export async function redactPdf(file, rawTerms) {
  const terms = String(rawTerms || '').split(/[\n,;]/).map((term) => term.trim()).filter(Boolean);
  if (!terms.length || terms.length > 30 || terms.some((term) => term.length > 80)) {
    throw new ApiError(400, 'Enter 1 to 30 words or phrases, each under 80 characters');
  }
  const document = await openPdf(file);
  const output = await PDFDocument.create();
  let renderedPixels = 0;
  let matchedItems = 0;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, Math.sqrt(8_000_000 / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      renderedPixels = reserveRenderPixels(renderedPixels, viewport.width, viewport.height);
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      try {
        await page.render({ canvasContext: context, viewport }).promise;
        const content = await page.getTextContent();
        const segments = [];
        let searchableText = '';
        for (const item of content.items) {
          if (!item.str) continue;
          if (searchableText) searchableText += segments.at(-1).item.hasEOL ? '\n' : ' ';
          const start = searchableText.length;
          searchableText += item.str;
          segments.push({ item, start, end: searchableText.length });
        }
        const matchedSegments = new Set();
        for (const term of terms) {
          const expression = term.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
          for (const match of searchableText.matchAll(new RegExp(expression, 'giu'))) {
            const matchEnd = match.index + match[0].length;
            segments.forEach((segment, index) => {
              if (segment.start < matchEnd && segment.end > match.index) matchedSegments.add(index);
            });
          }
        }
        context.fillStyle = '#000000';
        for (const index of matchedSegments) {
          const { item } = segments[index];
          const [a, b, c, d, x, y] = item.transform;
          const horizontalLength = Math.hypot(a, b) || 1;
          const verticalLength = Math.hypot(c, d) || 1;
          const horizontal = [a / horizontalLength, b / horizontalLength];
          const vertical = [c / verticalLength, d / verticalLength];
          const itemWidth = Math.max(0, item.width || 0);
          const itemHeight = Math.max(1, item.height || verticalLength);
          const corners = [
            [x, y],
            [x + horizontal[0] * itemWidth, y + horizontal[1] * itemWidth],
            [x + vertical[0] * itemHeight, y + vertical[1] * itemHeight],
            [x + horizontal[0] * itemWidth + vertical[0] * itemHeight, y + horizontal[1] * itemWidth + vertical[1] * itemHeight]
          ].map((point) => viewport.convertToViewportPoint(point[0], point[1]));
          const left = Math.max(0, Math.min(...corners.map((point) => point[0])) - 2);
          const top = Math.max(0, Math.min(...corners.map((point) => point[1])) - 2);
          const right = Math.min(canvas.width, Math.max(...corners.map((point) => point[0])) + 2);
          const bottom = Math.min(canvas.height, Math.max(...corners.map((point) => point[1])) + 2);
          if (right > left && bottom > top) {
            context.fillRect(left, top, right - left, bottom - top);
            matchedItems += 1;
          }
        }
        const image = await output.embedJpg(canvas.toBuffer('image/jpeg', 95));
        const outputPage = output.addPage([base.width, base.height]);
        outputPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
      } finally {
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    if (!matchedItems) throw new ApiError(422, 'None of those words were found as selectable text. Run OCR first if this is a scanned PDF.');
    return await output.save({ useObjectStreams: true });
  } finally {
    await document.destroy().catch(() => {});
  }
}

export async function getPdfFormFields(file) {
  let document;
  try { document = await PDFDocument.load(file.buffer); }
  catch { throw new ApiError(422, 'Could not open this PDF form'); }
  const fields = document.getForm().getFields().map((field) => {
    const type = field.constructor.name.replace(/^PDF/, '');
    const fillable = typeof field.setText === 'function'
      || (typeof field.check === 'function' && typeof field.uncheck === 'function')
      || typeof field.select === 'function';
    if (!fillable) return null;
    let options = [];
    try { if (typeof field.getOptions === 'function') options = field.getOptions(); } catch { /* some field types do not expose choices */ }
    let value = '';
    try {
      if (typeof field.getText === 'function') value = field.getText() || '';
      else if (typeof field.isChecked === 'function') value = String(field.isChecked());
      else if (typeof field.getSelected === 'function') value = field.getSelected() || '';
    } catch { /* not every field type has a readable value */ }
    return { name: field.getName(), type, options, value };
  });
  return fields.filter(Boolean);
}

export async function fillPdfForm(file, rawValues) {
  let values = rawValues;
  if (typeof values === 'string') {
    try { values = JSON.parse(values); }
    catch { throw new ApiError(400, 'Form values are invalid'); }
  }
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new ApiError(400, 'Form values are invalid');
  let document;
  try { document = await PDFDocument.load(file.buffer); }
  catch { throw new ApiError(422, 'Could not open this PDF form'); }
  const form = document.getForm();
  const fields = new Map(form.getFields().map((field) => [field.getName(), field]));
  for (const [name, rawValue] of Object.entries(values)) {
    const field = fields.get(name);
    if (!field) continue;
    const value = String(rawValue ?? '').slice(0, 5000);
    if (typeof field.setText === 'function') field.setText(value);
    else if (typeof field.check === 'function' && typeof field.uncheck === 'function') value === 'true' ? field.check() : field.uncheck();
    else if (typeof field.select === 'function' && value) field.select(value);
  }
  form.flatten();
  return document.save({ useObjectStreams: true });
}

export async function addPdfText(file, options = {}) {
  let document;
  try { document = await PDFDocument.load(file.buffer); }
  catch { throw new ApiError(422, 'Could not open this PDF for editing'); }
  const text = String(options.text || '').trim().slice(0, 500);
  if (!text) throw new ApiError(400, 'Enter text to add to the PDF');
  const pageNumber = Number(options.page || 1);
  const x = Number(options.x ?? 48);
  const y = Number(options.y ?? 48);
  const size = Number(options.size ?? 18);
  const fontName = String(options.font || 'Helvetica');
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > document.getPageCount()) throw new ApiError(400, 'Choose a valid page number');
  if (![StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.TimesRoman, StandardFonts.Courier].includes(fontName)) throw new ApiError(400, 'Choose a supported font');
  if (![x, y, size].every(Number.isFinite) || x < 0 || y < 0 || size < 6 || size > 72) throw new ApiError(400, 'Text position or size is invalid');
  const hex = String(options.color || '#202124').replace(/^#/, '');
  if (!/^[\da-fA-F]{6}$/.test(hex)) throw new ApiError(400, 'Choose a valid text color');
  const page = document.getPage(pageNumber - 1);
  if (x > page.getWidth() || y > page.getHeight()) throw new ApiError(400, 'Text position is outside the selected page');
  const color = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  const font = await document.embedFont(fontName);
  page.drawText(text, { x, y, size, font, color });
  return document.save({ useObjectStreams: true });
}
