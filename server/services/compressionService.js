import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';
import { unzipSync, zipSync } from 'fflate';
import { extname } from 'node:path';
import { ApiError } from '../utils/ApiError.js';

const maxPages = 100;
const maxPixelsPerPdfPage = 4_000_000;
const maxOfficeExpandedBytes = 128 * 1024 * 1024;
const maxOfficeEntries = 5000;
const officePackages = {
  docx: { marker: 'word/document.xml', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  docm: { marker: 'word/document.xml', contentType: 'application/vnd.ms-word.document.macroEnabled.12' },
  dotx: { marker: 'word/document.xml', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' },
  dotm: { marker: 'word/document.xml', contentType: 'application/vnd.ms-word.template.macroEnabled.12' },
  xlsx: { marker: 'xl/workbook.xml', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  xlsm: { marker: 'xl/workbook.xml', contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12' },
  xltx: { marker: 'xl/workbook.xml', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template' },
  xltm: { marker: 'xl/workbook.xml', contentType: 'application/vnd.ms-excel.template.macroEnabled.12' },
  pptx: { marker: 'ppt/presentation.xml', contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  pptm: { marker: 'ppt/presentation.xml', contentType: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12' },
  ppsx: { marker: 'ppt/presentation.xml', contentType: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow' },
  ppsm: { marker: 'ppt/presentation.xml', contentType: 'application/vnd.ms-powerpoint.slideshow.macroEnabled.12' },
  potx: { marker: 'ppt/presentation.xml', contentType: 'application/vnd.openxmlformats-officedocument.presentationml.template' },
  potm: { marker: 'ppt/presentation.xml', contentType: 'application/vnd.ms-powerpoint.template.macroEnabled.12' }
};
const officeImageLevels = {
  clear: [
    { scale: 0.96, quality: 0.94 }, { scale: 0.92, quality: 0.91 },
    { scale: 0.88, quality: 0.88 }, { scale: 0.84, quality: 0.85 }
  ],
  balanced: [{ scale: 0.92, quality: 0.88 }, { scale: 0.84, quality: 0.82 }],
  smallest: [
    { scale: 0.9, quality: 0.82 }, { scale: 0.78, quality: 0.68 },
    { scale: 0.64, quality: 0.54 }, { scale: 0.5, quality: 0.4 }
  ]
};
const pdfImageLevels = {
  clear: [{ scale: 1.8, quality: 0.93 }, { scale: 1.5, quality: 0.9 }, { scale: 1.25, quality: 0.86 }, { scale: 1.05, quality: 0.82 }],
  balanced: [{ scale: 1.5, quality: 0.88 }, { scale: 1.25, quality: 0.82 }, { scale: 1.05, quality: 0.76 }, { scale: 0.9, quality: 0.7 }],
  smallest: [{ scale: 1.25, quality: 0.78 }, { scale: 1.05, quality: 0.7 }, { scale: 0.9, quality: 0.62 }, { scale: 0.75, quality: 0.54 }, { scale: 0.6, quality: 0.45 }]
};

function jpegEncoderQuality(quality) {
  return Math.max(1, Math.min(100, Math.round(quality * 100)));
}

function compressionLevels(levels, fallbackLevels) {
  const seen = new Set(levels.map(({ scale, quality }) => `${scale}:${quality}`));
  return [...levels, ...fallbackLevels.filter(({ scale, quality }) => !seen.has(`${scale}:${quality}`))];
}

function officeExtension(file) {
  const extension = extname(file.originalname || '').slice(1).toLowerCase();
  if (!officePackages[extension]) throw new ApiError(415, 'Choose a PDF or a modern Word, Excel, or PowerPoint file');
  return extension;
}

function validateZipDirectory(buffer) {
  const start = Math.max(0, buffer.length - 65_557);
  let endRecord = -1;
  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { endRecord = offset; break; }
  }
  if (endRecord < 0) throw new ApiError(415, 'This Office file is not a valid compressed document');

  const entries = buffer.readUInt16LE(endRecord + 10);
  const directorySize = buffer.readUInt32LE(endRecord + 12);
  const directoryOffset = buffer.readUInt32LE(endRecord + 16);
  if (entries === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff || entries > maxOfficeEntries) {
    throw new ApiError(413, 'This Office archive is too large to process safely');
  }
  if (directoryOffset + directorySize > endRecord) throw new ApiError(415, 'This Office file has an invalid archive directory');

  let cursor = directoryOffset;
  let expandedBytes = 0;
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new ApiError(415, 'This Office file has an invalid archive directory');
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    if ((flags & 1) || ![0, 8].includes(method)) throw new ApiError(415, 'Encrypted or unsupported Office archives cannot be compressed');
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) throw new ApiError(413, 'ZIP64 Office files are not supported yet');
    expandedBytes += uncompressedSize;
    if (expandedBytes > maxOfficeExpandedBytes) throw new ApiError(413, 'This Office file expands beyond the safe processing limit');
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor > directoryOffset + directorySize) throw new ApiError(415, 'This Office file has an invalid archive directory');
}

function readImageDimensions(data, extension) {
  const buffer = Buffer.from(data);
  if (extension === 'png' && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (!['jpg', 'jpeg'].includes(extension) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) return null;
    offset += length + 2;
  }
  return null;
}

async function compressOfficeArchive(file, extension, targetBytes, quality) {
  validateZipDirectory(file.buffer);
  let entries;
  try { entries = unzipSync(file.buffer); }
  catch { throw new ApiError(415, 'Could not read this Office document archive'); }
  const packageInfo = officePackages[extension];
  if (!entries['[Content_Types].xml'] || !entries[packageInfo.marker]) {
    throw new ApiError(415, 'The file extension does not match a supported Word, Excel, or PowerPoint document');
  }

  let best = file.buffer;
  if (best.length <= targetBytes) return { buffer: best, type: packageInfo.contentType };
  const normalArchive = zipSync(entries, { level: 9 });
  if (normalArchive.length < best.length) best = Buffer.from(normalArchive);
  if (best.length <= targetBytes) return { buffer: best, type: packageInfo.contentType };

  const imagePaths = Object.keys(entries).filter((name) => /^(word|xl|ppt)\/media\//i.test(name) && /\.(png|jpe?g)$/i.test(name));
  const levels = compressionLevels(officeImageLevels[quality], quality === 'smallest' ? [] : officeImageLevels.smallest);
  for (const level of levels) {
    const replacements = {};
    for (const name of imagePaths) {
      const source = entries[name];
      const extensionName = extname(name).slice(1).toLowerCase();
      const dimensions = readImageDimensions(source, extensionName);
      if (!dimensions?.width || !dimensions?.height || dimensions.width * dimensions.height > 20_000_000) continue;
      let image;
      try { image = await loadImage(Buffer.from(source)); }
      catch { continue; }
      const width = Math.max(1, Math.round(dimensions.width * level.scale));
      const height = Math.max(1, Math.round(dimensions.height * level.scale));
      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d');
      if (extensionName !== 'png') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); }
      context.drawImage(image, 0, 0, width, height);
      try {
        replacements[name] = new Uint8Array(extensionName === 'png'
          ? canvas.toBuffer('image/png')
          : canvas.toBuffer('image/jpeg', jpegEncoderQuality(level.quality)));
      } catch {
        replacements[name] = source;
      }
      canvas.width = 0;
      canvas.height = 0;
    }

    if (!Object.keys(replacements).length) break;
    let candidate;
    try { candidate = Buffer.from(zipSync({ ...entries, ...replacements }, { level: 9 })); }
    catch { throw new ApiError(422, 'Could not rebuild this Office document'); }
    if (candidate.length < best.length) best = candidate;
    if (best.length <= targetBytes) break;
  }
  return { buffer: best, type: packageInfo.contentType };
}

async function compressScannedImagePdf(file, targetBytes, quality, sourceDocument) {
  let pdfDocument;
  try {
    pdfDocument = await getDocument({ data: new Uint8Array(file.buffer), isEvalSupported: false }).promise;
    if (pdfDocument.numPages > maxPages) throw new ApiError(413, `PDF compression supports up to ${maxPages} pages per file`);
    const imageOps = [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintJpegXObject, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObjectRepeat].filter(Number.isInteger);
    const allowedOps = [
      OPS.save, OPS.restore, OPS.transform, OPS.setGState, OPS.dependency, OPS.beginMarkedContent,
      OPS.beginMarkedContentProps, OPS.endMarkedContent,
      ...imageOps
    ].filter(Number.isInteger);
    const allowedOpSet = new Set(allowedOps);
    const sourcePages = sourceDocument.getPages();
    const pageData = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const renderedPage = await pdfDocument.getPage(pageNumber);
      const textContent = await renderedPage.getTextContent();
      const annotations = await renderedPage.getAnnotations({ intent: 'display' });
      const operatorList = await renderedPage.getOperatorList();
      const hasText = textContent.items.some((item) => typeof item.str === 'string' && item.str.trim().length > 0);
      const hasImage = operatorList.fnArray.some((operation) => imageOps.includes(operation));
      const hasUnsupportedContent = operatorList.fnArray.some((operation) => !allowedOpSet.has(operation));
      const sourcePage = sourcePages[pageNumber - 1];
      const mediaBox = sourcePage.getMediaBox();
      const cropBox = sourcePage.getCropBox();
      const sameBounds = Math.abs(mediaBox.x - cropBox.x) < 0.01 && Math.abs(mediaBox.y - cropBox.y) < 0.01
        && Math.abs(mediaBox.width - cropBox.width) < 0.01 && Math.abs(mediaBox.height - cropBox.height) < 0.01;
      if (hasText || annotations.length || !hasImage || hasUnsupportedContent || renderedPage.rotate !== 0 || !sameBounds) {
        throw new ApiError(422, 'Image-based optimization is available only for scanned PDFs containing images alone, with no selectable text, annotations, rotated pages, or cropped page bounds. The original was left unchanged.');
      }
      pageData.push({ renderedPage, width: mediaBox.width, height: mediaBox.height });
    }

    const levels = compressionLevels(pdfImageLevels[quality], quality === 'smallest' ? [] : pdfImageLevels.smallest);
    let best = null; let bestScore = -1;
    for (const level of levels) {
      const compressed = await PDFDocument.create();
      for (const { renderedPage, width, height } of pageData) {
        const pixelLimitScale = Math.sqrt(maxPixelsPerPdfPage / (width * height));
        const scale = Math.min(level.scale, pixelLimitScale);
        const viewport = renderedPage.getViewport({ scale });
        const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
        try {
          await renderedPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          const jpeg = canvas.toBuffer('image/jpeg', jpegEncoderQuality(level.quality));
          const embeddedImage = await compressed.embedJpg(jpeg);
          const outputPage = compressed.addPage([width, height]);
          outputPage.drawImage(embeddedImage, { x: 0, y: 0, width, height });
        } finally {
          canvas.width = 0; canvas.height = 0;
        }
      }
      const candidate = Buffer.from(await compressed.save({ useObjectStreams: true }));
      const score = level.scale * level.quality;
      if (candidate.length <= targetBytes && score > bestScore) { best = candidate; bestScore = score; }
    }
    if (!best) throw new ApiError(422, 'This scanned PDF could not meet the maximum using the selected quality settings. Choose a larger maximum.');
    const outputDocument = await PDFDocument.load(best, { updateMetadata: false });
    const outputPages = outputDocument.getPages();
    if (outputPages.length !== pageData.length || pageData.some((page, index) => {
      const size = outputPages[index].getSize();
      return Math.abs(page.width - size.width) >= 0.01 || Math.abs(page.height - size.height) >= 0.01;
    })) throw new ApiError(422, 'PDF page dimensions changed during image optimization. The original was left unchanged.');
    return { buffer: best, type: 'application/pdf', rasterized: true };
  } finally {
    if (pdfDocument) await pdfDocument.destroy().catch(() => {});
  }
}

async function compressPdf(file, targetBytes, quality, allowImageOnlyOptimization) {
  if (file.buffer.length <= targetBytes) return { buffer: file.buffer, type: 'application/pdf', rasterized: false };
  if (/\/ByteRange\s*\[/i.test(file.buffer.toString('latin1'))) {
    throw new ApiError(422, 'This PDF has a digital signature. Changing its bytes would invalidate it, so it cannot be compressed safely.');
  }
  if (/\/XFA\b/i.test(file.buffer.toString('latin1'))) {
    throw new ApiError(422, 'This PDF contains an XFA form that cannot be safely rewritten by this compressor.');
  }
  try {
    const sourceDocument = await PDFDocument.load(file.buffer, { updateMetadata: false });
    if (sourceDocument.getPageCount() > maxPages) throw new ApiError(413, `PDF compression supports up to ${maxPages} pages per file`);
    const originalSizes = sourceDocument.getPages().map((page) => page.getSize());
    const normalized = Buffer.from(await sourceDocument.save({ useObjectStreams: true, updateFieldAppearances: false }));
    const verifiedDocument = await PDFDocument.load(normalized, { updateMetadata: false });
    const outputPages = verifiedDocument.getPages();
    const dimensionsMatch = originalSizes.length === outputPages.length && originalSizes.every((size, index) => {
      const outputSize = outputPages[index].getSize();
      return Math.abs(size.width - outputSize.width) < 0.01 && Math.abs(size.height - outputSize.height) < 0.01;
    });
    if (!dimensionsMatch) throw new ApiError(422, 'PDF page dimensions changed during safe optimization. The original file was left untouched.');
    if (normalized.length <= targetBytes) return { buffer: normalized, type: 'application/pdf', rasterized: false };
    if (allowImageOnlyOptimization) return await compressScannedImagePdf(file, targetBytes, quality, sourceDocument);
    throw new ApiError(422, `Safe PDF optimization produced a ${normalized.length.toLocaleString()} byte file, which is still above the selected maximum. This tool preserves text and page content instead of rasterizing the document; choose a larger maximum.`);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'PasswordException' || error.message?.toLowerCase().includes('password') || error.message?.toLowerCase().includes('encrypted')) {
      throw new ApiError(400, 'This PDF is password-protected. Unlock it before compressing.');
    }
    throw new ApiError(422, 'Could not open this PDF. Upload a valid, unprotected PDF and try again.');
  }
}

export async function compressFile(file, targetSizeMb, quality = 'clear', options = {}) {
  if (!['clear', 'balanced', 'smallest'].includes(quality)) throw new ApiError(400, 'Choose clear, balanced, or smallest compression quality');
  const targetBytes = Math.round(targetSizeMb * 1024 * 1024);
  const extension = extname(file.originalname || '').slice(1).toLowerCase();
  const result = extension === 'pdf'
    ? await compressPdf(file, targetBytes, quality, Boolean(options.imageOnlyOptimization))
    : await compressOfficeArchive(file, officeExtension(file), targetBytes, quality);
  if (result.buffer.length > targetBytes) {
    throw new ApiError(422, 'Could not reduce this file below the selected maximum without more quality loss. Choose a larger maximum or a stronger compression setting.');
  }
  return result;
}

export async function compressImage(file, targetSizeMb, quality = 'clear', requestedDimensions = {}) {
  if (!['clear', 'balanced', 'smallest'].includes(quality)) throw new ApiError(400, 'Choose clear, balanced, or smallest compression quality');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new ApiError(415, 'Image compression accepts JPG, PNG, and WebP files');
  const extension = extname(file.originalname || '').slice(1).toLowerCase();
  const expectedType = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension];
  if (!expectedType || file.mimetype !== expectedType) {
    throw new ApiError(415, 'The image extension does not match its file type');
  }
  let image = null;
  let dimensions = extension === 'webp' ? null : readImageDimensions(file.buffer, extension);
  if (extension === 'webp') {
    try { image = await loadImage(Buffer.from(file.buffer)); }
    catch { throw new ApiError(415, 'Could not decode this WebP image'); }
    dimensions = { width: image.width, height: image.height };
  }
  if (!dimensions?.width || !dimensions?.height) throw new ApiError(415, `Could not read this ${extension.toUpperCase()} image`);
  if (dimensions.width * dimensions.height > 40_000_000) throw new ApiError(413, 'Image compression supports images up to 40 megapixels');

  const width = requestedDimensions.width ?? dimensions.width;
  const height = requestedDimensions.height ?? dimensions.height;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 40000 || height > 40000 || width * height > 40_000_000) {
    throw new ApiError(400, 'Output dimensions must be positive and no more than 40 megapixels total');
  }
  const resized = width !== dimensions.width || height !== dimensions.height;
  const targetBytes = Math.round(targetSizeMb * 1024 * 1024);
  const sourceType = file.mimetype;
  const type = sourceType === 'image/webp' || (sourceType === 'image/png' && file.buffer.length > targetBytes) ? 'image/jpeg' : sourceType;
  if (!resized && sourceType !== 'image/webp' && file.buffer.length <= targetBytes) {
    return { buffer: file.buffer, type: sourceType, width: dimensions.width, height: dimensions.height };
  }

  if (!image) {
    try { image = await loadImage(Buffer.from(file.buffer)); }
    catch { throw new ApiError(415, `Could not decode this ${extension.toUpperCase()} image`); }
  }
  const qualityLevels = type === 'image/png'
    ? [100]
    : quality === 'clear'
      ? [100, 96, 92, 88, 84, 80]
      : quality === 'balanced'
        ? [96, 90, 84, 78, 72, 66, 60]
        : [92, 84, 76, 68, 60, 52, 44, 36];
  const scaleLevels = quality === 'clear'
    ? [1, 0.97, 0.94, 0.91, 0.88, 0.85, 0.8, 0.75, 0.7]
    : quality === 'balanced'
      ? [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.6]
      : [1, 0.9, 0.8, 0.7, 0.6, 0.5];

  let bestReduced = null;
  let bestReducedScore = -1;
  let bestReducedDimensions = null;
  let bestFit = null;
  let bestFitScore = -1;
  let bestFitDimensions = null;
  let bestRequestedSize = null;
  let bestRequestedScore = -1;
  for (const scale of scaleLevels) {
    if (scale <= bestFitScore) break;
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    const canvas = createCanvas(outputWidth, outputHeight);
    const context = canvas.getContext('2d');
    if (type === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, outputWidth, outputHeight); }
    context.drawImage(image, 0, 0, outputWidth, outputHeight);

    for (const encoderQuality of qualityLevels) {
      const score = scale * encoderQuality / 100;
      if (score <= bestFitScore) continue;
      let candidate;
      try {
        candidate = Buffer.from(type === 'image/png'
          ? canvas.toBuffer('image/png')
          : canvas.toBuffer(type, encoderQuality));
      } catch {
        canvas.width = 0;
        canvas.height = 0;
        throw new ApiError(422, 'Could not encode the compressed image');
      }
      if (scale === 1 && score > bestRequestedScore) {
        bestRequestedSize = candidate;
        bestRequestedScore = score;
      }
      if (candidate.length < file.buffer.length && score > bestReducedScore) {
        bestReduced = candidate;
        bestReducedScore = score;
        bestReducedDimensions = { width: outputWidth, height: outputHeight };
      }
      if (candidate.length <= targetBytes && score > bestFitScore) {
        bestFit = candidate;
        bestFitScore = score;
        bestFitDimensions = { width: outputWidth, height: outputHeight };
      }
    }
    canvas.width = 0;
    canvas.height = 0;
  }
  const buffer = bestFit || bestReduced || bestRequestedSize || file.buffer;
  const outputDimensions = bestFitDimensions || bestReducedDimensions || { width, height };
  if (buffer.length > targetBytes) {
    throw new ApiError(422, 'Could not fit this image under the selected maximum at the chosen dimensions and clarity. Choose a larger maximum or reduce the output dimensions.');
  }
  return { buffer, type, width: outputDimensions.width, height: outputDimensions.height };
}
