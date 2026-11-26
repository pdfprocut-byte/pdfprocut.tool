import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import { compressImage } from '../services/compressionService.js';
import { getImageTargetToleranceBytes } from '../../shared/imageTargetEncoder.mjs';

function createNoisePng(width = 768, height = 512, seed = 29) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(width, height);
  let value = seed;
  for (let index = 0; index < pixels.data.length; index += 4) {
    value = (value * 48271) % 2147483647;
    pixels.data[index] = value & 255;
    pixels.data[index + 1] = (value >>> 8) & 255;
    pixels.data[index + 2] = (value >>> 16) & 255;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const buffer = canvas.toBuffer('image/png');
  canvas.width = 0;
  canvas.height = 0;
  return { originalname: 'noise.png', mimetype: 'image/png', buffer, size: buffer.length };
}

function createSmallPng(width = 16, height = 16) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#f5f5f5';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#18365b';
  context.fillRect(Math.floor(width / 3), Math.floor(height / 3), Math.ceil(width / 3), Math.ceil(height / 3));
  const buffer = canvas.toBuffer('image/png');
  canvas.width = 0;
  canvas.height = 0;
  return { originalname: 'small.png', mimetype: 'image/png', buffer, size: buffer.length };
}

for (const targetKb of [30, 50, 100]) {
  test(`Target KB mode reaches the accepted ${targetKb} KB range without padding`, async () => {
    const targetBytes = targetKb * 1024;
    const result = await compressImage(createNoisePng(), targetKb / 1024, 'clear', {
      mode: 'target',
      allowDimensionAdjustment: true,
      width: 768,
      height: 512
    });

    assert.equal(result.type, 'image/jpeg');
    assert.equal(result.targetMet, true);
    assert.ok(result.buffer.length <= targetBytes);
    assert.ok(result.buffer.length >= targetBytes - getImageTargetToleranceBytes(targetBytes));
    assert.ok(result.quality >= 55 && result.quality <= 100);
    assert.ok(Math.abs(result.width / result.height - 768 / 512) < 0.01);
    assert.equal(result.buffer.length, result.differenceBytes + targetBytes);
  });
}

test('Target KB mode reaches a size target by quality search alone without changing dimensions', async () => {
  const targetKb = 30;
  const result = await compressImage(createNoisePng(256, 192, 53), targetKb / 1024, 'clear', {
    mode: 'target', width: 256, height: 192
  });

  assert.equal(result.targetMet, true);
  assert.equal(result.width, 256);
  assert.equal(result.height, 192);
  assert.equal(result.dimensionAdjusted, false);
  assert.ok(result.buffer.length >= targetKb * 1024 - result.toleranceBytes);
  assert.ok(result.buffer.length <= targetKb * 1024);
});

test('Target KB mode warns when a small image naturally cannot reach the requested size', async () => {
  const targetKb = 30;
  const result = await compressImage(createSmallPng(), targetKb / 1024, 'clear', {
    mode: 'target', width: 16, height: 16
  });

  assert.equal(result.targetMet, false);
  assert.equal(result.dimensionAdjusted, false);
  assert.equal(result.width, 16);
  assert.equal(result.height, 16);
  assert.ok(result.buffer.length < targetKb * 1024 - result.toleranceBytes);
  assert.match(result.warning, /no filler data was added/i);
});

test('Target KB mode warns when acceptable JPEG quality cannot get below the requested size', async () => {
  const targetKb = 1;
  const result = await compressImage(createNoisePng(64, 64, 71), targetKb / 1024, 'clear', {
    mode: 'target', width: 64, height: 64
  });

  assert.equal(result.targetMet, false);
  assert.equal(result.dimensionAdjusted, false);
  assert.ok(result.buffer.length > targetKb * 1024);
  assert.match(result.warning, /above the target/i);
});

test('very small source images keep their dimensions and are not enlarged with filler data', async () => {
  const result = await compressImage(createSmallPng(8, 8), 1 / 1024, 'clear', {
    mode: 'target', width: 8, height: 8, allowDimensionAdjustment: true
  });

  assert.equal(result.width, 8);
  assert.equal(result.height, 8);
  assert.equal(result.dimensionAdjusted, false);
  assert.equal(result.targetMet, false);
  assert.ok(result.buffer.length < 1024 - result.toleranceBytes);
  assert.match(result.warning, /no filler data was added/i);
});

test('JPG and JPEG sources keep their original high-quality encoding when already under a target', async () => {
  for (const extension of ['jpg', 'jpeg']) {
    const canvas = createCanvas(48, 32);
    const context = canvas.getContext('2d');
    context.fillStyle = '#e8edf2';
    context.fillRect(0, 0, 48, 32);
    context.fillStyle = '#18365b';
    context.fillRect(12, 8, 24, 16);
    const buffer = canvas.toBuffer('image/jpeg', 95);
    canvas.width = 0;
    canvas.height = 0;
    const result = await compressImage({
      originalname: `source.${extension}`,
      mimetype: 'image/jpeg',
      buffer,
      size: buffer.length
    }, 30 / 1024, 'clear', { mode: 'target', width: 48, height: 32 });

    assert.equal(result.type, 'image/jpeg');
    assert.deepEqual(result.buffer, buffer);
    assert.equal(result.quality, null);
    assert.equal(result.width, 48);
    assert.equal(result.height, 32);
    assert.equal(result.targetMet, false);
  }
});

test('Maximum KB mode preserves selected dimensions and picks the highest quality under the cap', async () => {
  const targetKb = 50;
  const result = await compressImage(createNoisePng(256, 192, 41), targetKb / 1024, 'clear', {
    mode: 'maximum', width: 256, height: 192
  });

  assert.equal(result.targetMet, true);
  assert.ok(result.buffer.length <= targetKb * 1024);
  assert.equal(result.width, 256);
  assert.equal(result.height, 192);
  assert.equal(result.dimensionAdjusted, false);
  assert.ok(result.quality >= 55 && result.quality <= 100);
});
