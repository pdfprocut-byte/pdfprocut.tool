import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import { compressImage } from '../services/compressionService.js';

test('image compression accepts WebP input and returns a supported JPEG result', async () => {
  const canvas = createCanvas(64, 48);
  const context = canvas.getContext('2d');
  context.fillStyle = '#3155a4';
  context.fillRect(0, 0, 64, 48);
  const buffer = canvas.toBuffer('image/webp', 90);
  canvas.width = 0;
  canvas.height = 0;

  const result = await compressImage({
    originalname: 'source.webp',
    mimetype: 'image/webp',
    buffer,
    size: buffer.length
  }, 1, 'clear', { width: 64, height: 48 });

  assert.equal(result.type, 'image/jpeg');
  assert.equal(result.width, 64);
  assert.equal(result.height, 48);
  assert.ok(result.buffer.length > 0);
});
