import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { createPassportPrintSheet } from '../../client/src/lib/passportPrintSheet.js';

test('passport print-sheet PDF is valid A4 with 30 physically sized 35 by 45 mm copies', async () => {
  const canvas = createCanvas(413, 531);
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 413, 531);
  gradient.addColorStop(0, '#e4edf7');
  gradient.addColorStop(1, '#b6c7db');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 413, 531);
  const jpeg = new Blob([canvas.toBuffer('image/jpeg', 95)], { type: 'image/jpeg' });
  canvas.width = 0;
  canvas.height = 0;

  const sheet = await createPassportPrintSheet(jpeg, 413, 531, 30, 35, 45);
  const bytes = Buffer.from(await sheet.arrayBuffer());
  const pdf = await PDFDocument.load(bytes);

  assert.equal(sheet.type, 'application/pdf');
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 595.28) < 0.01);
  assert.ok(Math.abs(pdf.getPage(0).getHeight() - 841.89) < 0.01);
  assert.equal((bytes.toString('latin1').match(/\/Photo Do/g) || []).length, 30);
  assert.ok(bytes.includes(Buffer.from('JFIF')));
});

test('passport print sheet rejects a copy count that cannot fit the custom physical size', async () => {
  const canvas = createCanvas(32, 32);
  canvas.getContext('2d').fillRect(0, 0, 32, 32);
  const jpeg = new Blob([canvas.toBuffer('image/jpeg', 90)], { type: 'image/jpeg' });
  canvas.width = 0;
  canvas.height = 0;
  await assert.rejects(createPassportPrintSheet(jpeg, 32, 32, 30, 100, 100), /Only .* photos .* fit on one A4 sheet/);
});
