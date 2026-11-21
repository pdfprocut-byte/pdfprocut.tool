import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { decodeTextFile, textDirection } from '../../shared/documentText.mjs';
import { ApiError } from '../utils/ApiError.js';
import { createTextPdfDocument } from './textPdfRenderer.js';
const load = (buffer, password) => PDFDocument.load(buffer, password ? { password } : {});
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
export const parsePages = (value, count) => {
  const set = new Set();
  for (const part of String(value || '').split(',')) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!match) throw new ApiError(400, 'Use page ranges such as 1-3,5');
    const first = Number(match[1]);
    const last = match[2] ? Number(match[2]) : first;
    if (first < 1 || last < first) throw new ApiError(400, 'Use page ranges such as 1-3,5');
    for (let page = first; page <= last; page++) {
      if (page > count) throw new ApiError(400, 'Page range exceeds document page count');
      set.add(page - 1);
    }
  }
  return [...set];
};
export async function merge(files, options = []) {
  if (!files.length) throw new ApiError(400, 'Upload at least one PDF');
  let perFile = options;
  let pageOrder;
  if (options && !Array.isArray(options) && typeof options === 'object') {
    perFile = options.files ?? [];
    pageOrder = options.pageOrder;
  }
  const parseJson = (value, message) => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); }
    catch { throw new ApiError(400, message); }
  };
  perFile = parseJson(perFile, 'Merge options are invalid');
  pageOrder = parseJson(pageOrder, 'Page order is invalid');
  if (perFile == null || perFile === '') perFile = [];
  if (!Array.isArray(perFile)) throw new ApiError(400, 'Merge options are invalid');
  if (pageOrder != null && !Array.isArray(pageOrder)) throw new ApiError(400, 'Page order is invalid');

  const documents = [];
  for (const [index, file] of files.entries()) {
    if (file.mimetype !== 'application/pdf') throw new ApiError(415, 'Merge accepts PDF files only');
    const source = await load(file.buffer);
    const settings = perFile[index] || {};
    const pageCount = source.getPageCount();
    const range = String(settings.pages || '').trim();
    const excludedPages = settings.deletedPages || [];
    if (!Array.isArray(excludedPages)) throw new ApiError(400, 'Removed pages must be a list');
    const excluded = excludedPages.length ? new Set(parsePages(excludedPages.join(','), pageCount)) : new Set();
    const included = new Set(range ? parsePages(range, pageCount) : source.getPageIndices());
    for (const page of excluded) included.delete(page);
    const rotation = Number(settings.rotation || 0);
    if (![0, 90, 180, 270].includes(rotation)) throw new ApiError(400, 'Rotation must be 0, 90, 180, or 270 degrees');
    documents.push({ source, included, rotation });
  }

  const orderedPages = pageOrder || documents.flatMap((document, fileIndex) => [...document.included].map(pageIndex => ({ fileIndex, pageNumber: pageIndex + 1 })));
  const out = await PDFDocument.create();
  for (const entry of orderedPages) {
    const fileIndex = Number(entry?.fileIndex);
    const pageNumber = Number(entry?.pageNumber);
    if (!Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex >= documents.length || !Number.isInteger(pageNumber)) throw new ApiError(400, 'Page order is invalid');
    const document = documents[fileIndex];
    const pageIndex = pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= document.source.getPageCount()) throw new ApiError(400, 'Page order contains an invalid page number');
    if (!document.included.has(pageIndex)) continue;
    const [page] = await out.copyPages(document.source, [pageIndex]);
    if (document.rotation) page.setRotation(degrees((page.getRotation().angle + document.rotation) % 360));
    out.addPage(page);
  }
  if (!out.getPageCount()) throw new ApiError(400, 'Select at least one page to merge');
  return out.save();
}
export async function split(file, pages) { const source = await load(file.buffer); const wanted = parsePages(pages, source.getPageCount()); const out = await PDFDocument.create(); const copied = await out.copyPages(source, wanted); copied.forEach(p => out.addPage(p)); return out.save(); }
export async function remove(file, pages) { const source = await load(file.buffer); const excluded = new Set(parsePages(pages, source.getPageCount())); const wanted = source.getPageIndices().filter(i => !excluded.has(i)); if (!wanted.length) throw new ApiError(400, 'At least one page must remain'); const out = await PDFDocument.create(); const copied = await out.copyPages(source, wanted); copied.forEach(p => out.addPage(p)); return out.save(); }
export async function rotate(file, pages, angle) { const doc = await load(file.buffer); const wanted = pages ? parsePages(pages, doc.getPageCount()) : doc.getPageIndices(); const n = Number(angle); if (![90,180,270].includes(n)) throw new ApiError(400, 'Rotation must be 90, 180, or 270 degrees'); wanted.forEach(i => doc.getPage(i).setRotation(degrees((doc.getPage(i).getRotation().angle + n) % 360))); return doc.save(); }
export async function watermark(file, text, options = {}, imageFile = null) {
  const label = String(text || '').trim().slice(0, 120);
  if (!label && !imageFile) throw new ApiError(400, 'Enter watermark text or upload an image');

  const opacity = Number(options.opacity ?? 0.25);
  const fontSize = Number(options.fontSize ?? 48);
  const imageSize = Number(options.imageSize ?? 30);
  const rotation = Number(options.rotation ?? -35);
  const layout = String(options.layout || 'center');
  const fontName = String(options.font || 'HelveticaBold');
  const fontNames = new Set([
    'Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique',
    'TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic',
    'Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'
  ]);
  if (!Number.isFinite(opacity) || opacity < 0.05 || opacity > 1) throw new ApiError(400, 'Opacity must be between 5% and 100%');
  if (!Number.isFinite(fontSize) || fontSize < 8 || fontSize > 144) throw new ApiError(400, 'Font size must be between 8 and 144 points');
  if (!Number.isFinite(imageSize) || imageSize < 10 || imageSize > 70) throw new ApiError(400, 'Image size must be between 10% and 70%');
  if (!Number.isFinite(rotation) || rotation < -180 || rotation > 180) throw new ApiError(400, 'Rotation must be between -180 and 180 degrees');
  if (!['center', 'tiled', 'bottom-right'].includes(layout)) throw new ApiError(400, 'Choose a supported watermark design');
  if (!fontNames.has(fontName)) throw new ApiError(400, 'Choose a supported font style');

  const hex = String(options.color || '#cc1f36').replace(/^#/, '');
  if (!/^[\da-fA-F]{6}$/.test(hex)) throw new ApiError(400, 'Choose a valid watermark color');
  const color = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  const doc = await load(file.buffer);
  const font = label ? await doc.embedFont(StandardFonts[fontName]) : null;
  let image = null;
  if (imageFile) {
    if (imageFile.mimetype === 'image/png') image = await doc.embedPng(imageFile.buffer);
    else if (imageFile.mimetype === 'image/jpeg') image = await doc.embedJpg(imageFile.buffer);
    else throw new ApiError(415, 'Watermark images must be PNG or JPG');
  }

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    if (label) {
      const textWidth = font.widthOfTextAtSize(label, fontSize);
      const drawText = (x, y) => page.drawText(label, { x, y, size: fontSize, font, color, opacity, rotate: degrees(rotation) });
      if (layout === 'bottom-right') {
        drawText(Math.max(12, width - textWidth - 24), 24);
      } else if (layout === 'tiled') {
        const stepX = Math.max(textWidth + fontSize * 2, 80);
        const stepY = Math.max(fontSize * 3, 48);
        const columns = Math.min(24, Math.ceil(width / stepX) + 1);
        const rows = Math.min(24, Math.ceil(height / stepY) + 1);
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < columns; column++) drawText(column * stepX + 12, row * stepY + 12);
        }
      } else {
        drawText((width - textWidth) / 2, (height - fontSize) / 2);
      }
    }

    if (image) {
      const scale = Math.min((width * imageSize / 100) / image.width, (height * imageSize / 100) / image.height);
      const imageWidth = image.width * scale;
      const imageHeight = image.height * scale;
      const drawImage = (x, y) => page.drawImage(image, { x, y, width: imageWidth, height: imageHeight, opacity, rotate: degrees(rotation) });
      if (layout === 'bottom-right') {
        drawImage(Math.max(12, width - imageWidth - 24), 24);
      } else if (layout === 'tiled') {
        const stepX = imageWidth * 1.8;
        const stepY = imageHeight * 1.8;
        const columns = Math.min(12, Math.ceil(width / stepX));
        const rows = Math.min(12, Math.ceil(height / stepY));
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < columns; column++) drawImage(column * stepX, row * stepY);
        }
      } else {
        drawImage((width - imageWidth) / 2, (height - imageHeight) / 2);
      }
    }
  }
  return doc.save();
}
export async function pageNumbers(file, options = {}) {
  if (typeof options !== 'object' || options === null) options = { start: options };
  const doc = await load(file.buffer);
  const start = Number(options.start ?? 1);
  const startPage = Number(options.startPage ?? 1);
  const fontSize = Number(options.fontSize ?? 11);
  const margin = Number(options.margin ?? 0);
  const opacity = Number(options.opacity ?? 1);
  const format = String(options.format || 'number');
  const position = String(options.position || 'bottom-center');
  const fontName = String(options.font || 'Helvetica');
  const positions = new Set(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']);
  const formats = new Set(['number', 'page-number', 'number-of-total', 'page-of-total']);
  const fontNames = new Set([
    'Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique',
    'TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic',
    'Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'
  ]);
  if (!Number.isInteger(start) || start < 1 || start > 1000000) throw new ApiError(400, 'Starting number must be between 1 and 1,000,000');
  if (!Number.isInteger(startPage) || startPage < 1 || startPage > doc.getPageCount()) throw new ApiError(400, 'Starting PDF page is outside the document');
  if (!Number.isFinite(fontSize) || fontSize < 6 || fontSize > 48) throw new ApiError(400, 'Font size must be between 6 and 48 points');
  if (!Number.isFinite(margin) || margin < 0 || margin > 120) throw new ApiError(400, 'Margin must be between 0 and 120 points');
  if (!Number.isFinite(opacity) || opacity < 0.05 || opacity > 1) throw new ApiError(400, 'Opacity must be between 5% and 100%');
  if (!formats.has(format)) throw new ApiError(400, 'Choose a supported page number format');
  if (!positions.has(position)) throw new ApiError(400, 'Choose a supported page number position');
  if (!fontNames.has(fontName)) throw new ApiError(400, 'Choose a supported font style');

  const hex = String(options.color || '#333333').replace(/^#/, '');
  if (!/^[\da-fA-F]{6}$/.test(hex)) throw new ApiError(400, 'Choose a valid page number color');
  const color = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  const font = await doc.embedFont(StandardFonts[fontName]);
  const totalNumberedPages = start + doc.getPageCount() - startPage;

  doc.getPages().forEach((page, index) => {
    const pageNumber = index + 1;
    if (pageNumber < startPage) return;
    const number = start + pageNumber - startPage;
    const label = format === 'page-number' ? `Page ${number}`
      : format === 'number-of-total' ? `${number} of ${totalNumberedPages}`
        : format === 'page-of-total' ? `Page ${number} of ${totalNumberedPages}`
          : String(number);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const horizontal = position.split('-')[1];
    const vertical = position.split('-')[0];
    const x = horizontal === 'left' ? margin : horizontal === 'right' ? width - margin - textWidth : (width - textWidth) / 2;
    const y = vertical === 'top' ? height - margin - fontSize : margin;
    page.drawText(label, { x, y, size: fontSize, font, color, opacity });
  });
  return doc.save();
}
export async function imageToPdf(files, options = {}) {
  if (!files?.length) throw new ApiError(400, 'Upload at least one JPG or PNG image');
  if (typeof options === 'string') {
    try { options = JSON.parse(options); }
    catch { throw new ApiError(400, 'Page settings are invalid'); }
  }
  const pageSize = String(options.pageSize || 'original');
  const orientation = String(options.orientation || 'auto');
  const fit = String(options.fit || 'contain');
  const margin = Number(options.margin ?? 24);
  if (!['a4', 'letter', 'legal', 'original'].includes(pageSize)) throw new ApiError(400, 'Choose a supported paper size');
  if (!['auto', 'portrait', 'landscape'].includes(orientation)) throw new ApiError(400, 'Choose a supported page orientation');
  if (!['contain', 'fill'].includes(fit)) throw new ApiError(400, 'Choose a supported image fit');
  if (!Number.isFinite(margin) || margin < 0 || margin > 72) throw new ApiError(400, 'Margin must be between 0 and 72 points');
  const hex = String(options.backgroundColor || '#ffffff').replace(/^#/, '');
  if (!/^[\da-fA-F]{6}$/.test(hex)) throw new ApiError(400, 'Choose a valid background color');
  const background = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  const paperSizes = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] };
  const doc = await PDFDocument.create();

  for (const file of files) {
    if (!['image/png', 'image/jpeg'].includes(file.mimetype)) throw new ApiError(415, 'Scan to PDF accepts PNG and JPG images only');
    const image = file.mimetype === 'image/png' ? await doc.embedPng(file.buffer) : await doc.embedJpg(file.buffer);
    let [width, height] = pageSize === 'original' ? [image.width, image.height] : paperSizes[pageSize];
    const isLandscape = orientation === 'landscape' || (orientation === 'auto' && image.width > image.height);
    if (pageSize !== 'original' && isLandscape !== (width > height)) [width, height] = [height, width];
    const page = doc.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: background });

    const effectiveMargin = fit === 'fill' ? 0 : margin;
    const availableWidth = width - effectiveMargin * 2;
    const availableHeight = height - effectiveMargin * 2;
    if (availableWidth <= 0 || availableHeight <= 0) throw new ApiError(400, 'Margin is too large for this page size');
    const scale = fit === 'fill'
      ? Math.max(availableWidth / image.width, availableHeight / image.height)
      : Math.min(availableWidth / image.width, availableHeight / image.height);
    const imageWidth = image.width * scale;
    const imageHeight = image.height * scale;
    page.drawImage(image, { x: (width - imageWidth) / 2, y: (height - imageHeight) / 2, width: imageWidth, height: imageHeight });
  }
  return doc.save();
}
export async function textToPdf(file, options = {}) {
  if (typeof options === 'string') {
    try { options = JSON.parse(options); }
    catch { throw new ApiError(400, 'Text layout settings are invalid'); }
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new ApiError(400, 'Text layout settings are invalid');

  const pageSize = String(options.pageSize || 'a4');
  const fontName = String(options.font || 'Helvetica');
  const fontSize = Number(options.fontSize ?? 12);
  const margin = Number(options.margin ?? 48);
  const lineSpacing = Number(options.lineSpacing ?? 1.35);
  const align = String(options.align || 'left');
  const orientation = String(options.orientation || 'auto');
  const pageNumbers = options.pageNumbers === true || options.pageNumbers === 'true';
  const pageSizes = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] };
  const fontNames = new Set([
    'Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique',
    'TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic',
    'Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'
  ]);
  if (!pageSizes[pageSize]) throw new ApiError(400, 'Choose A4, Letter, or Legal paper size');
  if (!fontNames.has(fontName)) throw new ApiError(400, 'Choose a supported font style');
  if (!['auto', 'portrait', 'landscape'].includes(orientation)) throw new ApiError(400, 'Choose portrait or landscape page orientation');
  if (!Number.isFinite(fontSize) || fontSize < 8 || fontSize > 36) throw new ApiError(400, 'Font size must be between 8 and 36 points');
  if (!Number.isFinite(margin) || margin < 12 || margin > 120) throw new ApiError(400, 'Margin must be between 12 and 120 points');
  if (!Number.isFinite(lineSpacing) || lineSpacing < 1 || lineSpacing > 2.5) throw new ApiError(400, 'Line spacing must be between 1 and 2.5');
  if (!['left', 'center', 'right'].includes(align)) throw new ApiError(400, 'Choose left, center, or right text alignment');

  const parseColor = (value, fallback, label) => {
    const hex = String(value || fallback).replace(/^#/, '');
    if (!/^[\da-fA-F]{6}$/.test(hex)) throw new ApiError(400, `Choose a valid ${label}`);
    return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  };
  const color = parseColor(options.color, '#202124', 'text color');
  const backgroundColor = parseColor(options.backgroundColor, '#ffffff', 'page background color');
  let [width, height] = pageSizes[pageSize];
  if ((orientation === 'landscape') !== (width > height)) [width, height] = [height, width];
  let rawText = file;
  if (typeof file !== 'string') {
    if (!file?.buffer) throw new ApiError(400, 'Enter text or upload a text file');
    try { rawText = decodeTextFile(file.buffer); }
    catch (error) { throw new ApiError(400, error.message); }
  }
  const text = rawText.replace(/\u0000/g, '').replace(/\t/g, '    ');
  if (!text.trim()) throw new ApiError(400, 'Enter some text to convert');
  const { document: doc } = await createTextPdfDocument([text]);
  const font = await doc.embedFont(StandardFonts[fontName]);
  const footerSize = 9;
  const bottomSpace = margin + (pageNumbers ? 20 : 0);
  const availableWidth = width - margin * 2;
  const lineHeight = fontSize * lineSpacing;
  if (availableWidth <= 0 || height - margin - bottomSpace < lineHeight) throw new ApiError(400, 'Margins leave too little space for text');

  const wrappedLines = [];
  for (const paragraph of text.split(/\r\n?|\n/)) {
    if (!paragraph) { wrappedLines.push(''); continue; }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= availableWidth) {
        line = candidate;
        continue;
      }
      if (line) wrappedLines.push(line);
      line = '';
      for (const { segment } of graphemeSegmenter.segment(word)) {
        const next = line + segment;
        if (line && font.widthOfTextAtSize(next, fontSize) > availableWidth) {
          wrappedLines.push(line);
          line = segment;
        } else line = next;
      }
    }
    if (line) wrappedLines.push(line);
  }

  let page;
  let y;
  const newPage = () => {
    page = doc.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: backgroundColor });
    y = height - margin - fontSize;
  };
  newPage();
  for (const line of wrappedLines.length ? wrappedLines : ['']) {
    if (y < bottomSpace) newPage();
    if (line) {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      const x = align === 'center' ? (width - lineWidth) / 2 : align === 'right' ? width - margin - lineWidth : margin;
      page.drawText(line, { x, y, size: fontSize, font, color });
    }
    y -= lineHeight;
  }
  if (pageNumbers) {
    const numberFont = await doc.embedFont(StandardFonts.Helvetica);
    doc.getPages().forEach((pdfPage, index) => {
      const label = `Page ${index + 1}`;
      const numberWidth = numberFont.widthOfTextAtSize(label, footerSize);
      pdfPage.drawText(label, { x: (width - numberWidth) / 2, y: Math.max(8, margin / 2), size: footerSize, font: numberFont, color });
    });
  }
  return doc.save();
}

const htmlColor = (value, fallback) => {
  const text = String(value || '').trim().toLowerCase();
  const named = { black: '#000000', white: '#ffffff', red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00', gray: '#808080', grey: '#808080', purple: '#800080' };
  const hex = (named[text] || text).replace(/^#/, '');
  if (/^[\da-f]{6}$/.test(hex)) return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  const channels = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(text);
  if (channels) return rgb(...channels.slice(1, 4).map((channel) => Math.max(0, Math.min(255, Number(channel))) / 255));
  return fallback;
};

const decodeHtml = (value) => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, number) => {
    const point = Number(number);
    return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\uFFFD';
  })
  .replace(/&#x([\da-f]+);/gi, (_, number) => {
    const point = parseInt(number, 16);
    return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\uFFFD';
  });

const cssProperties = (value) => Object.fromEntries([...String(value || '').matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)].map((match) => [match[1].toLowerCase(), match[2].trim()]));

const readPointSize = (value, fallback) => {
  const match = /([\d.]+)\s*(pt|px|em|rem)?/i.exec(String(value || ''));
  if (!match) return fallback;
  const size = Number(match[1]);
  const unit = (match[2] || 'pt').toLowerCase();
  return Math.max(6, Math.min(72, size * (unit === 'px' ? 0.75 : unit === 'em' || unit === 'rem' ? fallback : 1)));
};

const fontVariant = (family, bold, italic) => {
  const value = String(family || 'Helvetica');
  const base = value.toLowerCase().includes('times') ? 'TimesRoman' : value.toLowerCase().includes('courier') ? 'Courier' : 'Helvetica';
  const isBold = Boolean(bold) || /bold/i.test(value);
  const isItalic = Boolean(italic) || /italic|oblique/i.test(value);
  if (base === 'TimesRoman') return isBold ? (isItalic ? 'TimesRomanBoldItalic' : 'TimesRomanBold') : (isItalic ? 'TimesRomanItalic' : 'TimesRoman');
  if (base === 'Courier') return isBold ? (isItalic ? 'CourierBoldOblique' : 'CourierBold') : (isItalic ? 'CourierOblique' : 'Courier');
  return isBold ? (isItalic ? 'HelveticaBoldOblique' : 'HelveticaBold') : (isItalic ? 'HelveticaOblique' : 'Helvetica');
};

export function parseRichText(html, defaults, fallbackColor) {
  const blocks = [];
  const lists = [];
  const stack = [];
  let style = { font: defaults.font, size: defaults.fontSize, color: fallbackColor, highlight: null, bold: /bold/i.test(defaults.font), italic: /italic|oblique/i.test(defaults.font), underline: false, strike: false };
  let block = { runs: [], align: defaults.align, indent: 0, pageBreakBefore: false, horizontalRule: false };
  const pushRun = (text, current = style) => {
    if (!text) return;
    const runStyle = { ...current, fontName: fontVariant(current.font, current.bold, current.italic) };
    const last = block.runs.at(-1);
    if (last && JSON.stringify(last.style) === JSON.stringify(runStyle)) last.text += text;
    else block.runs.push({ text, style: runStyle });
  };
  const flush = (keepEmpty = false) => {
    if (block.runs.length || keepEmpty || block.pageBreakBefore || block.horizontalRule) blocks.push(block);
    block = { runs: [], align: defaults.align, indent: 0, pageBreakBefore: false, horizontalRule: false };
  };
  const openTag = (tag, attributes) => {
    const attrs = Object.fromEntries([...attributes.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '']));
    const css = cssProperties(attrs.style);
    const blockTag = /^(p|div|h[1-6]|li|blockquote|pre)$/.test(tag);
    if (blockTag) {
      if (block.runs.length) flush();
      stack.push({ tag, style: { ...style }, align: block.align, indent: block.indent });
      block.align = ['left', 'right', 'center', 'justify'].includes(css['text-align']) ? css['text-align'] : defaults.align;
      block.pageBreakBefore ||= attrs['data-page-break'] === 'true';
      style = { ...style };
      if (/^h[1-6]$/.test(tag)) {
        style.bold = true;
        style.size = Math.max(style.size, defaults.fontSize * ({ h1: 1.8, h2: 1.5, h3: 1.25, h4: 1.1, h5: 1, h6: 1 }[tag] || 1));
      }
      if (tag === 'blockquote') block.indent = 24;
      if (tag === 'pre') style.font = 'Courier';
      if (tag === 'li') {
        const list = lists.at(-1);
        const prefix = list?.type === 'ol' ? `${++list.count}. ` : '\u2022 ';
        pushRun(prefix);
        block.indent = 18;
      }
    } else if (!['ul', 'ol'].includes(tag)) {
      stack.push({ tag, style: { ...style }, align: block.align, indent: block.indent });
    }

    if (tag === 'ul' || tag === 'ol') lists.push({ type: tag, count: 0 });
    if (tag === 'b' || tag === 'strong') style.bold = true;
    if (tag === 'i' || tag === 'em') style.italic = true;
    if (tag === 'u') style.underline = true;
    if (tag === 's' || tag === 'strike' || tag === 'del') style.strike = true;
    if (tag === 'sup') style.superscript = true;
    if (tag === 'sub') style.subscript = true;
    if (tag === 'font') {
      if (attrs.face) style.font = attrs.face;
      if (attrs.color) style.color = htmlColor(attrs.color, style.color);
      if (attrs.size) style.size = Math.max(6, Math.min(72, [8, 10, 12, 14, 18, 24, 32][Number(attrs.size) - 1] || style.size));
    }
    if (css['font-family']) style.font = css['font-family'].replace(/['"]|,.*$/g, '').trim();
    if (css['font-size']) style.size = readPointSize(css['font-size'], style.size);
    if (css['font-weight']) style.bold = css['font-weight'] === 'bold' || Number(css['font-weight']) >= 600;
    if (css['font-style']) style.italic = css['font-style'].includes('italic') || css['font-style'].includes('oblique');
    if (css['text-decoration']) { style.underline ||= css['text-decoration'].includes('underline'); style.strike ||= css['text-decoration'].includes('line-through'); }
    if (css.color || attrs.color) style.color = htmlColor(css.color || attrs.color, style.color);
    if (css['background-color']) style.highlight = htmlColor(css['background-color'], style.highlight);
    if (tag === 'br' && (!block.pageBreakBefore || block.runs.length)) pushRun('\n');
    if (tag === 'hr') {
      if (block.runs.length) flush();
      block.horizontalRule = true;
      flush(true);
    }
  };
  const closeTag = (tag) => {
    if (tag === 'ul' || tag === 'ol') { lists.pop(); return; }
    let matchIndex = -1;
    for (let index = stack.length - 1; index >= 0; index--) if (stack[index].tag === tag) { matchIndex = index; break; }
    if (matchIndex < 0) return;
    const saved = stack[matchIndex];
    stack.splice(matchIndex);
    style = saved.style;
    if (/^(p|div|h[1-6]|li|blockquote|pre)$/.test(tag)) {
      flush(tag === 'p' || tag === 'li');
      block.align = saved.align;
      block.indent = saved.indent;
    }
  };

  const tokens = String(html || '').match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) || [];
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('<')) {
      const match = /^<\s*(\/)?\s*([a-z\d]+)([\s\S]*?)\s*\/?>$/i.exec(token);
      if (!match) continue;
      if (match[1]) closeTag(match[2].toLowerCase());
      else openTag(match[2].toLowerCase(), match[3]);
    } else {
      const text = decodeHtml(token).replace(/\u0000/g, '').replace(/\s+/g, ' ');
      pushRun(text);
    }
  }
  if (block.runs.length) flush();
  return blocks;
}

export async function richTextToPdf(html, options = {}) {
  if (typeof options === 'string') {
    try { options = JSON.parse(options); }
    catch { throw new ApiError(400, 'Text layout settings are invalid'); }
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new ApiError(400, 'Text layout settings are invalid');
  const pageSizes = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] };
  const pageSize = String(options.pageSize || 'a4');
  const font = String(options.font || 'Helvetica');
  const fontSize = Number(options.fontSize ?? 12);
  const margin = Number(options.margin ?? 48);
  const lineSpacing = Number(options.lineSpacing ?? 1.35);
  const paragraphSpacing = Number(options.paragraphSpacing ?? 8);
  const orientation = String(options.orientation || 'portrait');
  const align = String(options.align || 'left');
  const pageNumbers = options.pageNumbers === true || options.pageNumbers === 'true';
  if (!pageSizes[pageSize]) throw new ApiError(400, 'Choose A4, Letter, or Legal paper size');
  if (!['portrait', 'landscape'].includes(orientation)) throw new ApiError(400, 'Choose portrait or landscape orientation');
  if (!['left', 'center', 'right', 'justify'].includes(align)) throw new ApiError(400, 'Choose a supported paragraph alignment');
  if (!Number.isFinite(fontSize) || fontSize < 8 || fontSize > 36) throw new ApiError(400, 'Font size must be between 8 and 36 points');
  if (!Number.isFinite(margin) || margin < 12 || margin > 120) throw new ApiError(400, 'Margin must be between 12 and 120 points');
  if (!Number.isFinite(lineSpacing) || lineSpacing < 1 || lineSpacing > 2.5) throw new ApiError(400, 'Line spacing must be between 1 and 2.5');
  if (!Number.isFinite(paragraphSpacing) || paragraphSpacing < 0 || paragraphSpacing > 36) throw new ApiError(400, 'Paragraph spacing must be between 0 and 36 points');
  const parseOptionColor = (value, fallback, name) => {
    const hex = String(value || fallback).replace(/^#/, '');
    if (!/^[\da-fA-F]{6}$/.test(hex)) throw new ApiError(400, `Choose a valid ${name}`);
    return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  };
  const color = parseOptionColor(options.color, '#202124', 'text color');
  const background = parseOptionColor(options.backgroundColor, '#ffffff', 'page background');
  const blocks = parseRichText(html, { font, fontSize, align }, color);
  if (!blocks.some((item) => item.runs.some((run) => run.text.trim()))) throw new ApiError(400, 'Enter some text to convert');
  let [width, height] = pageSizes[pageSize];
  if (orientation === 'landscape') [width, height] = [height, width];
  const { document: doc, unicode } = await createTextPdfDocument(blocks.flatMap((block) => block.runs.map((run) => run.text)));
  const fontNames = ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique', 'TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic', 'Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'];
  const embeddedFonts = {};
  for (const name of fontNames) embeddedFonts[name] = await doc.embedFont(StandardFonts[name]);
  const availableWidth = width - margin * 2;
  const footerSpace = pageNumbers ? 22 : 0;
  let page;
  let y;
  const addPage = () => {
    page = doc.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: background });
    y = height - margin - fontSize;
  };
  const drawLine = (parts, lineWidth, lineHeight, blockAlign, finalLine, indent = 0) => {
    if (y - lineHeight < margin + footerSpace) addPage();
    const contentWidth = Math.max(1, availableWidth - indent);
    const alignment = blockAlign === 'justify' && finalLine ? 'left' : blockAlign;
    const baseline = y - Math.max(0, lineHeight / lineSpacing - fontSize);
    let x = margin + indent;
    if (alignment === 'center') x += Math.max(0, (contentWidth - lineWidth) / 2);
    if (alignment === 'right') x += Math.max(0, contentWidth - lineWidth);
    const whitespaceCount = alignment === 'justify' ? parts.reduce((sum, part) => sum + (part.text.trim() ? 0 : part.text.length), 0) : 0;
    const extraSpace = whitespaceCount > 0 && !finalLine ? Math.max(0, (contentWidth - lineWidth) / whitespaceCount) : 0;
    const ordered = unicode && textDirection(parts.map((part) => part.text).join('')) === 'rtl' ? [...parts].reverse() : parts;
    const drawingParts = [];
    for (const part of ordered) {
      const previous = drawingParts.at(-1);
      if (unicode && !extraSpace && previous?.style === part.style) {
        previous.text = ordered === parts ? previous.text + part.text : part.text + previous.text;
        previous.width += part.width;
      } else drawingParts.push({ ...part });
    }
    for (const part of drawingParts) {
      const { text: value, style: runStyle, width: runWidth, runFont } = part;
      if (!value) continue;
      const scriptScale = runStyle.superscript || runStyle.subscript ? 0.7 : 1;
      const scriptOffset = runStyle.superscript ? runStyle.size * 0.38 : runStyle.subscript ? -runStyle.size * 0.18 : 0;
      const drawSize = runStyle.size * scriptScale;
      if (runStyle.highlight) page.drawRectangle({ x, y: baseline + scriptOffset - drawSize * 0.22, width: runWidth, height: drawSize * 1.18, color: runStyle.highlight });
      page.drawText(value, { x, y: baseline + scriptOffset, size: drawSize, font: runFont, color: runStyle.color });
      if (runStyle.underline || runStyle.strike) {
        const lineY = runStyle.underline ? baseline + scriptOffset - 1.5 : baseline + scriptOffset + drawSize * 0.33;
        page.drawLine({ start: { x, y: lineY }, end: { x: x + runWidth, y: lineY }, thickness: Math.max(0.5, drawSize / 18), color: runStyle.color });
      }
      x += runWidth;
      if (alignment === 'justify' && !finalLine && !value.trim()) x += extraSpace * value.length;
    }
    y -= lineHeight;
  };

  addPage();
  for (const block of blocks) {
    if (block.pageBreakBefore) {
      if (y < height - margin - fontSize) addPage();
      if (!block.runs.some((run) => run.text.trim())) continue;
    }
    if (block.horizontalRule) {
      if (y - fontSize * lineSpacing < margin + footerSpace) addPage();
      const ruleY = y - fontSize * 0.45;
      page.drawLine({ start: { x: margin, y: ruleY }, end: { x: width - margin, y: ruleY }, thickness: 0.75, color });
      y -= fontSize * lineSpacing + paragraphSpacing;
      continue;
    }
    const blockAlign = block.align || align;
    const indent = Math.min(block.indent || 0, availableWidth / 3);
    let parts = [];
    let currentWidth = 0;
    let lineHeight = fontSize * lineSpacing;
    const addPart = (value, style) => {
      if (!value) return;
      const runFont = embeddedFonts[style.fontName] || embeddedFonts.Helvetica;
      const scriptScale = style.superscript || style.subscript ? 0.7 : 1;
      const runWidth = runFont.widthOfTextAtSize(value, style.size * scriptScale);
      parts.push({ text: value, style, width: runWidth, runFont });
      currentWidth += runWidth;
      lineHeight = Math.max(lineHeight, style.size * lineSpacing);
    };
    const flushLine = (finalLine = false) => {
      if (parts.length) drawLine(parts, currentWidth, lineHeight, blockAlign, finalLine, indent);
      else drawLine([{ text: '', style: { size: fontSize }, width: 0 }], 0, lineHeight, blockAlign, finalLine, indent);
      parts = [];
      currentWidth = 0;
      lineHeight = fontSize * lineSpacing;
    };
    const tokens = block.runs.flatMap((run) => run.text.split(/(\n|[^\S\n]+|[^\s]+)/).filter(Boolean).map((text) => ({ text, style: run.style })));
    for (const token of tokens) {
      if (token.text === '\n') { flushLine(false); continue; }
      const runFont = embeddedFonts[token.style.fontName] || embeddedFonts.Helvetica;
      const scriptScale = token.style.superscript || token.style.subscript ? 0.7 : 1;
      const tokenWidth = runFont.widthOfTextAtSize(token.text, token.style.size * scriptScale);
      const isSpace = !token.text.trim();
      if (isSpace && !parts.length) continue;
      if (currentWidth + tokenWidth > availableWidth - indent && parts.length) {
        flushLine(false);
        if (isSpace) continue;
      }
      if (tokenWidth > availableWidth - indent) {
        let chunk = '';
        for (const { segment } of graphemeSegmenter.segment(token.text)) {
          const next = chunk + segment;
          if (chunk && runFont.widthOfTextAtSize(next, token.style.size * scriptScale) + currentWidth > availableWidth - indent) {
            addPart(chunk, token.style);
            flushLine(false);
            chunk = segment;
          } else chunk = next;
        }
        addPart(chunk, token.style);
      } else addPart(token.text, token.style);
    }
    flushLine(true);
    y -= paragraphSpacing;
  }

  if (pageNumbers) {
    const numberFont = embeddedFonts.Helvetica;
    doc.getPages().forEach((pdfPage, index) => {
      const label = `Page ${index + 1}`;
      const size = 9;
      const labelWidth = numberFont.widthOfTextAtSize(label, size);
      pdfPage.drawText(label, { x: (width - labelWidth) / 2, y: Math.max(8, margin / 2), size, font: numberFont, color });
    });
  }
  return doc.save();
}
