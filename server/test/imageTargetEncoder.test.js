import assert from 'node:assert/strict';
import test from 'node:test';
import { findImageEncoding, getImageTargetToleranceBytes } from '../../shared/imageTargetEncoder.mjs';

test('maximum mode uses binary search to retain the highest quality under the size cap', async () => {
  const result = await findImageEncoding({
    width: 400,
    height: 300,
    targetBytes: 82_000,
    mode: 'maximum',
    minQuality: 55,
    maxQuality: 100,
    encode: async ({ quality }) => ({ size: quality * 1000, quality })
  });

  assert.equal(result.quality, 82);
  assert.equal(result.bytes, 82_000);
  assert.equal(result.targetMet, true);
  assert.equal(result.width, 400);
  assert.equal(result.height, 300);
});

test('target mode reports success only inside its documented below-target tolerance', async () => {
  const targetBytes = 30 * 1024;
  const withinRange = await findImageEncoding({
    width: 100,
    height: 100,
    targetBytes,
    mode: 'target',
    minQuality: 55,
    maxQuality: 100,
    encode: async ({ quality }) => ({ size: quality * 303, quality })
  });
  assert.equal(withinRange.targetMet, true);
  assert.ok(withinRange.bytes >= targetBytes - getImageTargetToleranceBytes(targetBytes));
  assert.ok(withinRange.bytes <= targetBytes);
  assert.equal(withinRange.differenceBytes, withinRange.bytes - targetBytes);

  const naturallySmall = await findImageEncoding({
    width: 20,
    height: 20,
    targetBytes,
    mode: 'target',
    minQuality: 55,
    maxQuality: 100,
    encode: async () => ({ size: 12 * 1024 })
  });
  assert.equal(naturallySmall.targetMet, false);
  assert.match(naturallySmall.warning, /no filler data was added/i);
});

test('target mode prefers a 0.1 to 0.5 KB safety gap when a closer encoding is available', async () => {
  const targetBytes = 30 * 1024;
  const result = await findImageEncoding({
    width: 100,
    height: 100,
    targetBytes,
    mode: 'target',
    minQuality: 55,
    maxQuality: 100,
    encode: async ({ quality }) => ({
      size: quality === 100 ? targetBytes - 50 : quality === 99 ? targetBytes - 200 : targetBytes - 200 - (99 - quality) * 100,
      quality
    })
  });

  assert.equal(result.quality, 99);
  assert.equal(targetBytes - result.bytes, 200);
  assert.equal(result.targetMet, true);
});

test('maximum mode refuses to return an image above the strict maximum', async () => {
  const result = await findImageEncoding({
    width: 100,
    height: 100,
    targetBytes: 1_000,
    mode: 'maximum',
    minQuality: 55,
    maxQuality: 100,
    encode: async () => ({ size: 2_000 })
  });
  assert.equal(result, null);
});

test('target mode never returns an encoding above the requested maximum', async () => {
  const result = await findImageEncoding({
    width: 100,
    height: 100,
    targetBytes: 1_000,
    mode: 'target',
    minQuality: 55,
    maxQuality: 100,
    encode: async () => ({ size: 2_000 })
  });
  assert.equal(result, null);
});
