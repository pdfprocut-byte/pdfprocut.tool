import { randomBytes } from 'node:crypto';
import { PDFDocument } from '@cantoo/pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ApiError } from '../utils/ApiError.js';
import { createOcrWorker, parseOcrLanguages } from './ocrLanguageService.js';
import { readPdf } from './pdfReader.js';

const maxOcrPages = 30;
const imageOperators = new Set([
  OPS.paintImageXObject, OPS.paintImageXObjectRepeat, OPS.paintInlineImageXObject,
  OPS.paintInlineImageXObjectGroup, OPS.paintImageMaskXObject, OPS.paintImageMaskXObjectRepeat, OPS.paintImageMaskXObjectGroup
]);

export async function protectPdf(file, password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new ApiError(400, 'Use a PDF password between 8 and 128 characters');
  }

  try {
    const document = await PDFDocument.load(file.buffer);
    document.encrypt({
      userPassword: password,
      ownerPassword: randomBytes(32).toString('base64url')
    });
    return await document.save();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Could not open this PDF. Unlock password-protected input files first.');
  }
}

export async function ocrPdf(file, languages) {
  const codes = parseOcrLanguages(languages);
  let pdfjsDocument;
  let worker;
  try {
    const sourceDocument = await PDFDocument.load(file.buffer);
    pdfjsDocument = await readPdf(file.buffer);
    if (pdfjsDocument.numPages > maxOcrPages) {
      throw new ApiError(400, `OCR supports up to ${maxOcrPages} pages per PDF`);
    }

    const outputDocument = await PDFDocument.create();
    let hasText = false;
    for (let pageNumber = 1; pageNumber <= pdfjsDocument.numPages; pageNumber += 1) {
      const inputPage = await pdfjsDocument.getPage(pageNumber);
      const extracted = await inputPage.getTextContent();
      const nativeText = extracted.items.map((item) => item.str || '').join(' ').trim();
      const nativeLetters = nativeText.replace(/[^\p{L}\p{N}]/gu, '').length;
      const textOnlyPage = nativeLetters > 0 && nativeLetters < 8
        && !(await inputPage.getOperatorList()).fnArray.some((operator) => imageOperators.has(operator));

      if (nativeLetters >= 8 || textOnlyPage) {
        hasText = true;
        const [copy] = await outputDocument.copyPages(sourceDocument, [pageNumber - 1]);
        outputDocument.addPage(copy);
        inputPage.cleanup();
        continue;
      }

      const baseViewport = inputPage.getViewport({ scale: 1 });
      const maxPixels = 8_000_000;
      const scale = Math.min(1.8, Math.sqrt(maxPixels / (baseViewport.width * baseViewport.height)));
      const viewport = inputPage.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        await inputPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        worker ??= await createOcrWorker(codes);
        const { data } = await worker.recognize(canvas.toBuffer('image/png'), { pdfTextOnly: true }, { pdf: true, text: true });
        if (!data.text.trim()) {
          hasText ||= Boolean(nativeText);
          const [copy] = await outputDocument.copyPages(sourceDocument, [pageNumber - 1]);
          outputDocument.addPage(copy);
          continue;
        }

        hasText = true;
        const { width, height } = baseViewport;
        const outputPage = outputDocument.addPage([width, height]);
        const image = await outputDocument.embedJpg(canvas.toBuffer('image/jpeg', 88));
        outputPage.drawImage(image, { x: 0, y: 0, width, height });
        const [textLayer] = await outputDocument.embedPdf(data.pdf);
        outputPage.drawPage(textLayer, { x: 0, y: 0, width, height });
      } finally {
        inputPage.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
    }

    if (!hasText) throw new ApiError(422, 'No text was recognized. Check the selected languages and the quality of the scan.');
    return await outputDocument.save();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.message?.toLowerCase().includes('password') || error.name === 'PasswordException') {
      throw new ApiError(400, 'This PDF is password-protected. Unlock it before running OCR.');
    }
    throw new ApiError(422, 'Could not OCR this PDF. Try a smaller or unprotected PDF.');
  } finally {
    if (worker) await worker.terminate().catch(() => {});
    if (pdfjsDocument) await pdfjsDocument.destroy().catch(() => {});
  }
}
