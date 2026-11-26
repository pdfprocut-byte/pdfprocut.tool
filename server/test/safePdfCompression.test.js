import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { compressFile } from '../services/compressionService.js';

test('PDF compression keeps vector pages and their page dimensions', async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 650]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('Selectable application document text', { x: 30, y: 600, size: 12, font });
  const original = Buffer.from(await pdf.save({ useObjectStreams: false }));
  const padded = Buffer.concat([original, Buffer.alloc(50_000, 32)]);
  const result = await compressFile({ originalname: 'application.pdf', buffer: padded, size: padded.length }, 0.02, 'clear');

  assert.equal(result.rasterized, false);
  assert.ok(result.buffer.length <= Math.round(0.02 * 1024 * 1024));
  const output = await PDFDocument.load(result.buffer);
  assert.equal(output.getPageCount(), 1);
  assert.deepEqual(output.getPage(0).getSize(), { width: 420, height: 650 });
});

test('PDF compression refuses to modify digitally signed PDFs', async () => {
  const bytes = Buffer.concat([
    Buffer.from('%PDF-1.7\n/ByteRange [0 10 20 30]\n', 'latin1'),
    Buffer.alloc(2048, 32)
  ]);
  await assert.rejects(
    compressFile({ originalname: 'signed.pdf', buffer: bytes, size: bytes.length }, 1 / 1024, 'clear'),
    /digital signature/i
  );
});

test('image-only PDF optimization keeps scanned page dimensions and is explicitly opt-in', async () => {
  const canvas = createCanvas(512, 512);
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(512, 512);
  let seed = 13;
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    seed = (seed * 48271) % 2147483647;
    pixels.data[offset] = seed % 256;
    pixels.data[offset + 1] = (seed >>> 8) % 256;
    pixels.data[offset + 2] = (seed >>> 16) % 256;
    pixels.data[offset + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const scannedImage = canvas.toBuffer('image/png');
  canvas.width = 0; canvas.height = 0;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([360, 480]);
  const image = await pdf.embedPng(scannedImage);
  page.drawImage(image, { x: 0, y: 0, width: 360, height: 480 });
  const original = Buffer.from(await pdf.save({ useObjectStreams: false }));
  const padded = Buffer.concat([original, Buffer.alloc(80_000, 32)]);
  const result = await compressFile({ originalname: 'scan.pdf', buffer: padded, size: padded.length }, 0.1, 'smallest', { imageOnlyOptimization: true });

  assert.equal(result.rasterized, true);
  assert.ok(result.buffer.length <= Math.round(0.1 * 1024 * 1024));
  const output = await PDFDocument.load(result.buffer);
  assert.deepEqual(output.getPage(0).getSize(), { width: 360, height: 480 });
});
