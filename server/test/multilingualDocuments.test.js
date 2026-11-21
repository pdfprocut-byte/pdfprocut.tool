import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
import { decodeTextFile } from '../../shared/documentText.mjs';
import { richTextToDocument } from '../services/documentService.js';
import { parseOcrLanguages } from '../services/ocrLanguageService.js';
import { readPdf } from '../services/pdfReader.js';
import { ocrPdf } from '../services/pdfSecurityOcrService.js';
import { richTextToPdf } from '../services/pdfService.js';

const malayalam = 'മലയാളം';
const arabic = 'العربية';

test('preserves multilingual text from Unicode files through DOCX export', async () => {
  const source = `${malayalam}\n${arabic}\nहिन्दी\n日本語`;
  const utf16 = Buffer.from(source, 'utf16le');
  const utf16le = Buffer.concat([Buffer.from([0xff, 0xfe]), utf16]);
  const utf16be = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(utf16).swap16()]);
  for (const file of [Buffer.from(source), utf16le, utf16be]) {
    assert.equal(decodeTextFile(file), source);
  }

  const docx = await richTextToDocument(source.split('\n').map((line) => `<p>${line}</p>`).join(''));
  const { value } = await mammoth.extractRawText({ buffer: docx });
  assert.equal(value.trim().replace(/\n+/g, '\n'), source);
});

test('validates OCR model codes and defaults existing requests to English', () => {
  assert.deepEqual(parseOcrLanguages(), ['eng']);
  assert.deepEqual(parseOcrLanguages('mal+eng+mal'), ['mal', 'eng']);
  assert.throws(() => parseOcrLanguages('../eng'), { status: 400 });
  assert.throws(() => parseOcrLanguages('eng+mal+hin+tam'), { status: 400 });
});

test('keeps Malayalam and English searchable in a mixed-language scan', { skip: !GlobalFonts.has('Nirmala UI') }, async () => {
  const canvas = createCanvas(1200, 650);
  const drawing = canvas.getContext('2d');
  drawing.fillStyle = '#fff';
  drawing.fillRect(0, 0, canvas.width, canvas.height);
  drawing.fillStyle = '#000';
  drawing.font = '64px "Nirmala UI"';
  drawing.fillText(`${malayalam} ${malayalam}`, 60, 125);
  drawing.fillText('മലയാളം എന്റെ ഭാഷയാണ്', 60, 250);
  drawing.font = '56px Arial';
  drawing.fillText('Searchable document text', 60, 380);

  const source = await PDFDocument.load(await richTextToPdf(`<p>${malayalam}</p>`));
  const scan = source.addPage([600, 325]);
  const image = await source.embedPng(canvas.toBuffer('image/png'));
  scan.drawImage(image, { x: 0, y: 0, width: 600, height: 325 });

  const result = await readPdf(await ocrPdf({ buffer: await source.save() }, 'mal+eng'));
  try {
    assert.equal(result.numPages, 2);
    const native = await (await result.getPage(1)).getTextContent();
    assert.equal(native.items.map(({ str }) => str).join(''), malayalam);
    const scanned = await (await result.getPage(2)).getTextContent();
    const text = scanned.items.map(({ str }) => str).join(' ').replace(/\s+/g, ' ');
    assert.match(text, new RegExp(malayalam));
    assert.match(text, /Searchable document text/);
  } finally {
    await result.destroy();
  }
});
