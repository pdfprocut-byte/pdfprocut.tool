import { createCanvas } from '@napi-rs/canvas';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType
} from 'docx';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { readPdf } from './pdfReader.js';

const maxPages = 100;
const maxCharacters = 1_000_000;
const maxOutputBytes = 100 * 1024 * 1024;
const maxPixelsPerFallbackPage = 4_000_000;
const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const adobeApiBase = 'https://pdf-services.adobe.io';

function extractLinesFromOrder(items) {
  const lines = [];
  let currentLine = '';
  const flush = () => {
    const line = currentLine.replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
    currentLine = '';
  };

  for (const item of items) {
    if (typeof item.str === 'string' && item.str) {
      const text = item.str.replace(/\u0000/g, '');
      if (currentLine && text && !/\s$/.test(currentLine) && !/^\s/.test(text)) currentLine += ' ';
      currentLine += text;
    }
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

function extractLines(items) {
  const textItemCount = items.filter((item) => typeof item.str === 'string' && item.str.trim()).length;
  const positioned = items.flatMap((item, index) => {
    const text = typeof item.str === 'string' ? item.str.replace(/\u0000/g, '') : '';
    const transform = item.transform;
    if (!text.trim() || !Array.isArray(transform) || !Number.isFinite(transform[4]) || !Number.isFinite(transform[5])) return [];
    const fontSize = Math.max(1, Math.abs(Number(item.height) || Number(transform[3]) || 10));
    return [{
      text,
      x: transform[4],
      y: transform[5],
      width: Math.max(0, Number(item.width) || 0),
      fontSize,
      index,
      direction: item.dir || 'ltr'
    }];
  });

  if (positioned.length < 2 || positioned.length < textItemCount * 0.8) return extractLinesFromOrder(items);

  const byVerticalPosition = [...positioned].sort((left, right) => right.y - left.y || left.x - right.x || left.index - right.index);
  const rows = [];
  for (const item of byVerticalPosition) {
    const row = rows.find((candidate) => {
      const tolerance = Math.max(2, Math.min(candidate.fontSize, item.fontSize) * 0.3);
      return Math.abs(candidate.y - item.y) <= tolerance;
    });
    if (row) {
      row.items.push(item);
      row.y = row.items.reduce((total, entry) => total + entry.y, 0) / row.items.length;
      row.fontSize = Math.max(row.fontSize, item.fontSize);
    } else {
      rows.push({ y: item.y, fontSize: item.fontSize, items: [item] });
    }
  }

  const lines = [];
  for (const row of rows.sort((left, right) => right.y - left.y)) {
    const rtl = row.items.every((item) => item.direction === 'rtl');
    const ordered = [...row.items].sort((left, right) => {
      if (rtl) return left.index - right.index;
      return left.x - right.x || left.index - right.index;
    });
    let currentLine = '';
    let previous = null;
    const flush = () => {
      const line = currentLine.replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
      currentLine = '';
      previous = null;
    };

    for (const item of ordered) {
      if (previous) {
        const gap = rtl
          ? previous.x - (item.x + item.width)
          : item.x - (previous.x + previous.width);
        const fontSize = Math.min(previous.fontSize, item.fontSize);
        if (gap > Math.max(18, fontSize * 2.5)) flush();
        else if (gap > Math.max(1, fontSize * 0.18) && !/\s$/.test(currentLine) && !/^\s/.test(item.text)) currentLine += ' ';
      }
      currentLine += item.text;
      previous = item;
    }
    flush();
  }
  return lines.length ? lines : extractLinesFromOrder(items);
}

async function extractPdfPages(file) {
  let pdfDocument;
  try {
    pdfDocument = await readPdf(file.buffer);
    if (pdfDocument.numPages > maxPages) {
      throw new ApiError(413, `PDF to Word supports up to ${maxPages} pages per file`);
    }

    const pages = [];
    let characterCount = 0;
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = extractLines(content.items);
      characterCount += lines.reduce((total, line) => total + line.length, 0);
      page.cleanup();

      if (characterCount > maxCharacters) {
        throw new ApiError(413, 'This PDF contains too much text to convert in one run');
      }
      if (lines.length) pages.push(lines);
    }

    if (!pages.length) {
      throw new ApiError(422, 'No selectable text was found. Run OCR PDF on scanned pages first, then convert again.');
    }
    return pages;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'PasswordException' || error.message?.toLowerCase().includes('password')) {
      throw new ApiError(400, 'This PDF is password-protected. Unlock it before converting to Word.');
    }
    throw new ApiError(422, 'Could not read this PDF. Upload a valid, unprotected PDF and try again.');
  } finally {
    if (pdfDocument) await pdfDocument.destroy().catch(() => {});
  }
}

async function validatePdfPageCount(file) {
  let pdfDocument;
  try {
    pdfDocument = await readPdf(file.buffer);
    if (pdfDocument.numPages > maxPages) throw new ApiError(413, `PDF to Word supports up to ${maxPages} pages per file`);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'PasswordException' || error.message?.toLowerCase().includes('password')) {
      throw new ApiError(400, 'This PDF is password-protected. Unlock it before converting to Word.');
    }
    throw new ApiError(422, 'Could not read this PDF. Upload a valid, unprotected PDF and try again.');
  } finally {
    if (pdfDocument) await pdfDocument.destroy().catch(() => {});
  }
}

function adobeApiHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'x-api-key': env.adobePdfServicesClientId };
}

async function adobeJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) throw new ApiError(429, 'Adobe conversion limit reached or service is busy. Check your Adobe PDF Services plan and try again later.');
    if (response.status === 401 || response.status === 403) throw new ApiError(502, 'Adobe rejected the configured credentials. Check the PDF Services client ID and secret.');
    if (response.status === 413) throw new ApiError(413, 'Adobe could not accept this PDF because it is too large.');
    throw new ApiError(502, fallbackMessage);
  }
  return payload;
}

function trustedAdobeOperationUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^pdf-services(?:-[a-z0-9-]+)?\.adobe\.io$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function trustedAdobeStorageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^dcplatformstorageservice-prod-[a-z0-9-]+\.s3(?:-accelerate)?\.amazonaws\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

async function readAdobeWordFile(response) {
  if (!response.body) throw new ApiError(502, 'Adobe returned an empty Word file.');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxOutputBytes) {
      await reader.cancel().catch(() => {});
      throw new ApiError(413, 'The converted Word file exceeds the 100 MB download limit.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

async function convertWithAdobe(file) {
  if (!env.adobePdfServicesClientId || !env.adobePdfServicesClientSecret) {
    throw new ApiError(503, 'Adobe PDF Services is not configured on this server.');
  }
  await validatePdfPageCount(file);
  const deadline = Date.now() + 85_000;
  const request = (url, options) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ApiError(504, 'Adobe PDF to Word conversion took too long. Try again later.');
    return fetch(url, { ...options, signal: AbortSignal.timeout(Math.min(20_000, remaining)) });
  };

  try {
    const credentials = new URLSearchParams({
      client_id: env.adobePdfServicesClientId,
      client_secret: env.adobePdfServicesClientSecret
    });
    const tokenResponse = await request(`${adobeApiBase}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: credentials
    });
    const { access_token: token } = await adobeJson(tokenResponse, 'Could not authenticate with Adobe PDF Services.');
    if (!token) throw new ApiError(502, 'Adobe did not return an access token.');

    const assetResponse = await request(`${adobeApiBase}/assets`, {
      method: 'POST', headers: { ...adobeApiHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'application/pdf' })
    });
    const { assetID, uploadUri } = await adobeJson(assetResponse, 'Could not prepare this PDF for Adobe conversion.');
    if (!assetID || !trustedAdobeStorageUrl(uploadUri)) throw new ApiError(502, 'Adobe returned an invalid upload location.');

    const uploadResponse = await request(uploadUri, {
      method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file.buffer
    });
    if (!uploadResponse.ok) throw new ApiError(502, 'Could not upload the PDF to Adobe for conversion.');

    const exportResponse = await request(`${adobeApiBase}/operation/exportpdf`, {
      method: 'POST', headers: { ...adobeApiHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetID, targetFormat: 'docx', ocrLang: 'en-US' })
    });
    if (exportResponse.status !== 201 && exportResponse.status !== 202) {
      await adobeJson(exportResponse, 'Adobe could not start the Word conversion.');
      throw new ApiError(502, 'Adobe could not start the Word conversion.');
    }
    let operationUrl = exportResponse.headers.get('location');
    if (!trustedAdobeOperationUrl(operationUrl)) throw new ApiError(502, 'Adobe returned an invalid conversion status URL.');

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(1500, Math.max(0, deadline - Date.now()))));
      const statusResponse = await request(operationUrl, { headers: adobeApiHeaders(token) });
      const status = await adobeJson(statusResponse, 'Could not read the Adobe conversion status.');
      if (status.status === 'failed') throw new ApiError(422, 'Adobe could not convert this PDF to Word.');
      if (status.status === 'done') {
        const downloadUri = status.asset?.downloadUri || status.result?.asset?.downloadUri || status.downloadUri;
        if (!trustedAdobeStorageUrl(downloadUri)) throw new ApiError(502, 'Adobe returned an invalid Word download location.');
        const downloadResponse = await request(downloadUri, {});
        if (!downloadResponse.ok) throw new ApiError(502, 'Could not download the Word file from Adobe.');
        if (Number(downloadResponse.headers.get('content-length')) > maxOutputBytes) {
          throw new ApiError(413, 'The converted Word file exceeds the 100 MB download limit.');
        }
        const bytes = await readAdobeWordFile(downloadResponse);
        if (!bytes.length || bytes.length > maxOutputBytes || bytes.subarray(0, 4).toString('ascii') !== 'PK\u0003\u0004') {
          throw new ApiError(502, 'Adobe returned an invalid or oversized Word file.');
        }
        return { buffer: bytes, mode: 'adobe-cloud-layout' };
      }
      operationUrl = statusResponse.headers.get('location') || operationUrl;
      if (!trustedAdobeOperationUrl(operationUrl)) throw new ApiError(502, 'Adobe returned an invalid conversion status URL.');
    }
    throw new ApiError(504, 'Adobe PDF to Word conversion took too long. Try again later.');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new ApiError(504, 'Adobe PDF to Word conversion took too long. Try again later.');
    }
    throw new ApiError(502, 'Adobe PDF to Word conversion failed. Please try again later.');
  }
}

function getPdfTableBands(page, operatorList) {
  const rectangles = new Map();
  operatorList.fnArray.forEach((fn, index) => {
    if (fn !== OPS.constructPath) return;
    const path = operatorList.argsArray[index];
    if (path[0].length !== 1 || path[0][0] !== OPS.rectangle) return;
    const [x, y, width, height] = path[1];
    if (width < 20 || height < 20 || width > page.view[2] - page.view[0] - 5 || height > page.view[3] - page.view[1] - 5) return;
    const rectangle = { x, y, right: x + width, top: y + height, width, height };
    const key = [x, y, width, height].map((value) => Number(value.toFixed(1))).join(',');
    rectangles.set(key, rectangle);
  });

  const bands = [];
  for (const rectangle of rectangles.values()) {
    let band = bands.find((candidate) => Math.abs(candidate.y - rectangle.y) <= 0.8 && Math.abs(candidate.height - rectangle.height) <= 0.8);
    if (!band) {
      band = { y: rectangle.y, height: rectangle.height, cells: [] };
      bands.push(band);
    }
    if (!band.cells.some((cell) => Math.abs(cell.x - rectangle.x) <= 0.2 && Math.abs(cell.width - rectangle.width) <= 0.2)) {
      band.cells.push(rectangle);
    }
  }

  const validBands = bands
    .map((band) => ({ ...band, cells: band.cells.sort((left, right) => left.x - right.x) }))
    .filter((band) => {
      if (band.cells.length < 6 || band.cells.length > 12) return false;
      for (let index = 1; index < band.cells.length; index += 1) {
        if (Math.abs(band.cells[index - 1].right - band.cells[index].x) > 2.5) return false;
      }
      return true;
    });

  const body = validBands.filter((band) => band.height >= 140).sort((left, right) => right.height - left.height)[0];
  if (!body) return null;
  const header = validBands
    .filter((band) => band.height >= 25 && band.height <= 80 && band.height < body.height * 0.4)
    .sort((left, right) => Math.abs(left.y - (body.y + body.height)) - Math.abs(right.y - (body.y + body.height)))[0];
  if (!header || header.cells.length !== body.cells.length) return null;
  if (Math.abs(header.y - body.y - body.height) > 3) return null;
  for (let index = 0; index < body.cells.length; index += 1) {
    if (Math.abs(header.cells[index].x - body.cells[index].x) > 4 || Math.abs(header.cells[index].right - body.cells[index].right) > 4) return null;
  }
  return { header, body };
}

function getCellLines(items, cell, rowBand) {
  const positioned = items.flatMap((item, index) => {
    const text = typeof item.str === 'string' ? item.str.replace(/\u0000/g, '') : '';
    if (!text.trim() || !Array.isArray(item.transform)) return [];
    const x = Number(item.transform[4]);
    const y = Number(item.transform[5]);
    const width = Math.max(0, Number(item.width) || 0);
    const height = Math.max(1, Number(item.height) || 10);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    if (y < rowBand.y - 1 || y > rowBand.y + rowBand.height + 1) return [];
    if (x + width / 2 < cell.x - 1 || x + width / 2 > cell.right + 1) return [];
    return [{ text, x, y, width, height, index }];
  });

  const rows = [];
  for (const item of positioned) {
    let row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);
    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
    row.y = row.items.reduce((total, entry) => total + entry.y, 0) / row.items.length;
  }

  return rows.sort((left, right) => right.y - left.y).flatMap((row) => {
    const ordered = row.items.sort((left, right) => left.x - right.x || left.index - right.index);
    let text = '';
    let previous = null;
    for (const item of ordered) {
      if (previous) {
        const gap = item.x - (previous.x + previous.width);
        if (gap > 1.5 && !/\s$/.test(text) && !/^\s/.test(item.text)) text += ' ';
      }
      text += item.text;
      previous = item;
    }
    text = text.replace(/\s+/g, ' ').trim();
    return text ? [{ text, y: row.y, height: Math.max(...row.items.map((item) => item.height)) }] : [];
  });
}

function createTableCell(lines, { header = false, top = 0, fontSize = 18, border, cellWidth = 0 } = {}) {
  const lineHeight = fontSize * 1.15 / 2;
  const cellParagraphs = lines.length ? lines.map((line, index) => {
    const nextLine = lines[index + 1];
    const baselineGap = nextLine ? Math.max(0, line.y - nextLine.y) : lineHeight;
    const after = nextLine ? Math.max(0, Math.round((baselineGap - lineHeight) * 20)) : 0;
    const before = index === 0 && !header ? Math.max(0, Math.round((top - line.y - 11) * 20)) : 0;
    return new Paragraph({
      alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before, after, line: 276 },
      children: [new TextRun({ text: line.text, font: 'Arial', size: fontSize, bold: header })]
    });
  }) : [new Paragraph({ children: [] })];

  return new TableCell({
    children: cellParagraphs,
    verticalAlign: header ? VerticalAlignTable.CENTER : VerticalAlignTable.TOP,
    margins: { top: 35, bottom: 35, left: 45, right: 45 },
    borders: border,
    ...(cellWidth ? { width: { size: cellWidth, type: WidthType.DXA } } : {})
  });
}

async function createEditableTableFallback(file) {
  let pdfDocument;
  try {
    pdfDocument = await readPdf(file.buffer);
    if (pdfDocument.numPages > maxPages) return null;
    const layouts = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const [content, operatorList] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
      const bands = getPdfTableBands(page, operatorList);
      page.cleanup();
      if (!bands) return null;
      layouts.push({ width: viewport.width, height: viewport.height, content, ...bands });
    }

    const border = { style: BorderStyle.SINGLE, size: 4, color: '777777' };
    const sections = layouts.map((layout) => {
      const cellWidths = layout.body.cells.map((cell) => Math.max(1, Math.round(cell.width * 20)));
      const tableWidth = cellWidths.reduce((total, width) => total + width, 0);
      const headerRow = new TableRow({
        tableHeader: true,
        height: { value: Math.round(layout.header.height * 20), rule: HeightRule.ATLEAST },
        children: layout.body.cells.map((cell, cellIndex) => createTableCell(
          getCellLines(layout.content.items, cell, layout.header),
          { header: true, border, cellWidth: cellWidths[cellIndex] }
        ))
      });
      const bodyRow = new TableRow({
        height: { value: Math.round(layout.body.height * 20), rule: HeightRule.ATLEAST },
        children: layout.body.cells.map((cell, cellIndex) => createTableCell(
          getCellLines(layout.content.items, cell, layout.body),
          { top: layout.body.y + layout.body.height, border, cellWidth: cellWidths[cellIndex] }
        ))
      });
      const table = new Table({
        rows: [headerRow, bodyRow],
        width: { size: tableWidth, type: WidthType.DXA },
        columnWidths: cellWidths,
        layout: TableLayoutType.FIXED,
        alignment: AlignmentType.LEFT,
        margins: { top: 35, bottom: 35, left: 45, right: 45 },
        borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }
      });
      const left = layout.body.cells[0].x;
      const right = layout.body.cells.at(-1).right;
      const top = layout.header.y + layout.header.height;
      const bottom = layout.body.y;
      return {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: Math.round(layout.width * 20), height: Math.round(layout.height * 20) },
            margin: {
              top: Math.max(0, Math.round((layout.height - top) * 20)),
              right: Math.max(0, Math.round((layout.width - right) * 20)),
              bottom: Math.max(0, Math.round(bottom * 20)),
              left: Math.max(0, Math.round(left * 20)),
              header: 0,
              footer: 0
            }
          }
        },
        children: [table]
      };
    });

    const bytes = Buffer.from(await Packer.toBuffer(new Document({ sections })));
    if (!bytes.length || bytes.length > maxOutputBytes) throw new ApiError(413, 'The converted Word file is empty or exceeds 100 MB');
    return bytes;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return null;
  } finally {
    if (pdfDocument) await pdfDocument.destroy().catch(() => {});
  }
}

export async function extractPdfText(file) {
  const pages = await extractPdfPages(file);
  return pages.map((lines) => lines.join('\n')).join('\n\n');
}

async function createVisualFallback(file, editablePages) {
  let pdfDocument;
  try {
    pdfDocument = await readPdf(file.buffer);
    if (pdfDocument.numPages > maxPages) throw new ApiError(413, `PDF to Word supports up to ${maxPages} pages per file`);

    const imageSections = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const pixelScale = Math.min(2, Math.sqrt(maxPixelsPerFallbackPage / (baseViewport.width * baseViewport.height)));
      const viewport = page.getViewport({ scale: pixelScale });
      const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
      try {
        const canvasContext = canvas.getContext('2d');
        canvasContext.fillStyle = '#ffffff';
        canvasContext.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext, viewport, background: '#ffffff' }).promise;
        const image = new ImageRun({
          data: canvas.toBuffer('image/jpeg', 92),
          type: 'jpg',
          transformation: {
            width: Math.max(1, Math.round(baseViewport.width * 4 / 3)),
            height: Math.max(1, Math.round(baseViewport.height * 4 / 3))
          }
        });
        imageSections.push({
          properties: {
            type: SectionType.NEXT_PAGE,
            page: {
              size: { width: Math.round(baseViewport.width * 20), height: Math.round(baseViewport.height * 20) },
              margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0 }
            }
          },
          children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [image] })]
        });
      } finally {
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
    }

    const editableText = [new Paragraph({ children: [new TextRun({ text: 'Editable text copy', bold: true, font: 'Arial', size: 28 })] })];
    editablePages.forEach((lines, pageIndex) => {
      editableText.push(new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: `Page ${pageIndex + 1}`, bold: true, font: 'Arial', size: 24 })]
      }));
      for (const line of lines) {
        editableText.push(new Paragraph({
          spacing: { before: 0, after: 0, line: 276 },
          children: [new TextRun({ text: line, font: 'Arial', size: 22 })]
        }));
      }
    });
    const editableSection = {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 720, bottom: 720, left: 720, header: 360, footer: 360 }
        }
      },
      children: editableText
    };

    const bytes = Buffer.from(await Packer.toBuffer(new Document({ sections: [editableSection, ...imageSections] })));
    if (!bytes.length || bytes.length > maxOutputBytes) throw new ApiError(413, 'The converted Word file is empty or exceeds 100 MB');
    return bytes;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, 'Could not create a Word document from this PDF');
  } finally {
    if (pdfDocument) await pdfDocument.destroy().catch(() => {});
  }
}

async function createOfflineFallback(file, editablePages) {
  const tableDocument = await createEditableTableFallback(file);
  if (tableDocument) return { buffer: tableDocument, mode: 'editable-table-layout' };
  return { buffer: await createVisualFallback(file, editablePages), mode: 'page-images-and-text' };
}

export function getPdfToDocumentConfig() {
  return { adobeConfigured: Boolean(env.adobePdfServicesClientId && env.adobePdfServicesClientSecret) };
}

export async function pdfToDocument(file, { provider = 'local' } = {}) {
  if (provider === 'adobe') return convertWithAdobe(file);
  if (provider !== 'local') throw new ApiError(400, 'Choose a supported PDF to Word converter.');

  const editablePages = await extractPdfPages(file);
  const body = new FormData();
  body.append('file', new Blob([file.buffer], { type: 'application/pdf' }), 'upload.pdf');

  let response;
  try {
    response = await fetch(`${env.officeConverterUrl}/convert-pdf-to-docx`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(95_000)
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new ApiError(504, 'PDF to Word conversion took too long. Try a smaller PDF.');
    }
    return await createOfflineFallback(file, editablePages);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 429) throw new ApiError(429, payload.error || 'The converter is busy. Try again shortly.');
    if (response.status === 413) throw new ApiError(413, payload.error || 'This PDF is too large to convert');
    if (response.status === 504) throw new ApiError(504, payload.error || 'PDF to Word conversion took too long. Try a smaller PDF.');
    return await createOfflineFallback(file, editablePages);
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes(docxMimeType)) {
    return await createOfflineFallback(file, editablePages);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > maxOutputBytes || bytes.subarray(0, 4).toString('ascii') !== 'PK\u0003\u0004') {
    return await createOfflineFallback(file, editablePages);
  }
  return { buffer: bytes, mode: 'editable-layout' };
}
