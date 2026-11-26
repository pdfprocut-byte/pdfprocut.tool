export const MIN_IMAGE_QUALITY = 55;
export const MAX_IMAGE_QUALITY = 100;
export const MIN_DIMENSION_SCALE = 0.1;

export function getImageTargetToleranceBytes(targetBytes) {
  return Math.min(1024, Math.ceil(targetBytes * 0.05));
}

function candidateSize(candidate) {
  if (Number.isFinite(candidate?.size)) return candidate.size;
  if (Number.isFinite(candidate?.buffer?.length)) return candidate.buffer.length;
  throw new TypeError('The image encoder must return a candidate with a byte size.');
}

function chooseCandidate(candidates, mode, targetBytes) {
  const underLimit = candidates.filter((candidate) => candidate.bytes <= targetBytes);
  if (mode === 'maximum') {
    return underLimit.sort((a, b) => b.quality - a.quality || b.scale - a.scale || b.bytes - a.bytes)[0] || null;
  }
  const pool = underLimit.length ? underLimit : candidates;
  return pool.sort((a, b) => Math.abs(targetBytes - a.bytes) - Math.abs(targetBytes - b.bytes)
    || b.scale - a.scale || b.quality - a.quality)[0] || null;
}

/**
 * Searches real encoded candidates. Maximum mode returns the highest quality
 * candidate at or below the cap. Target mode prefers the closest candidate
 * that does not exceed the target; its accepted band is within 5% (capped at
 * 1 KB) below the requested size. It never fabricates bytes.
 */
export async function findImageEncoding({
  width,
  height,
  targetBytes,
  mode = 'maximum',
  minQuality = MIN_IMAGE_QUALITY,
  maxQuality = MAX_IMAGE_QUALITY,
  allowDimensionAdjustment = false,
  minDimensionScale = MIN_DIMENSION_SCALE,
  dimensionSearchSteps = 10,
  encode
}) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) throw new RangeError('Image dimensions must be positive integers.');
  if (!Number.isSafeInteger(targetBytes) || targetBytes < 1) throw new RangeError('The requested image size must be a positive number of bytes.');
  if (!['maximum', 'target'].includes(mode)) throw new RangeError('Choose maximum or target compression mode.');
  if (!Number.isInteger(minQuality) || !Number.isInteger(maxQuality) || minQuality < 1 || maxQuality > 100 || minQuality > maxQuality) throw new RangeError('Image quality must be between 1 and 100.');
  if (typeof encode !== 'function') throw new TypeError('An image candidate encoder is required.');

  const allCandidates = [];
  const scaleResults = new Map();
  const encodeAtScale = async (scale) => {
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    const key = `${outputWidth}x${outputHeight}`;
    if (scaleResults.has(key)) return scaleResults.get(key);

    let low = minQuality;
    let high = maxQuality;
    const candidates = [];
    const qualityCandidates = new Map();
    const encodeQuality = async (quality) => {
      if (qualityCandidates.has(quality)) return qualityCandidates.get(quality);
      const encoded = await encode({ width: outputWidth, height: outputHeight, quality });
      const candidate = { ...encoded, width: outputWidth, height: outputHeight, quality, scale, bytes: candidateSize(encoded) };
      candidates.push(candidate);
      allCandidates.push(candidate);
      qualityCandidates.set(quality, candidate);
      return candidate;
    };
    await encodeQuality(minQuality);
    if (maxQuality !== minQuality) await encodeQuality(maxQuality);
    while (low <= high) {
      const quality = Math.floor((low + high) / 2);
      const candidate = await encodeQuality(quality);
      if (candidate.bytes <= targetBytes) low = quality + 1;
      else high = quality - 1;
    }
    scaleResults.set(key, candidates);
    return candidates;
  };

  const initialCandidates = await encodeAtScale(1);
  const initialBest = chooseCandidate(initialCandidates, mode, targetBytes);
  const initialQualityMax = initialCandidates.find(({ quality }) => quality === maxQuality);
  const hasInitialUnderLimit = initialCandidates.some(({ bytes }) => bytes <= targetBytes);
  const initialNeedsDimensionSearch = mode === 'maximum'
    ? !initialCandidates.some(({ bytes }) => bytes <= targetBytes)
    : initialQualityMax?.bytes > targetBytes
      && (!hasInitialUnderLimit || !initialBest || initialBest.bytes < targetBytes - getImageTargetToleranceBytes(targetBytes));

  if (allowDimensionAdjustment && initialNeedsDimensionSearch) {
    let lowScale = minDimensionScale;
    let highScale = 1;
    const boundaryQuality = mode === 'maximum' ? minQuality : maxQuality;
    const minScaleCandidates = await encodeAtScale(minDimensionScale);
    const minScaleBoundary = minScaleCandidates.find(({ quality }) => quality === boundaryQuality);
    if (minScaleBoundary?.bytes <= targetBytes) {
      for (let step = 0; step < dimensionSearchSteps; step += 1) {
        const scale = (lowScale + highScale) / 2;
        const candidates = await encodeAtScale(scale);
        const boundary = candidates.find(({ quality }) => quality === boundaryQuality);
        if (boundary?.bytes <= targetBytes) lowScale = scale;
        else highScale = scale;
      }
    }
  }

  const candidate = chooseCandidate(allCandidates, mode, targetBytes);
  if (!candidate) return null;
  const toleranceBytes = getImageTargetToleranceBytes(targetBytes);
  const targetMet = mode === 'maximum'
    ? candidate.bytes <= targetBytes
    : candidate.bytes <= targetBytes && candidate.bytes >= targetBytes - toleranceBytes;
  let warning = '';
  if (mode === 'target' && !targetMet) {
    warning = candidate.bytes > targetBytes
      ? `The requested ${targetBytes.toLocaleString()} byte target could not be reached at acceptable quality. The closest encoded result is ${candidate.bytes.toLocaleString()} bytes, above the target. ${allowDimensionAdjustment ? 'Increase the target or change the output dimensions.' : 'Increase the target or enable automatic dimension adjustment.'}`
      : `This image naturally encodes to ${candidate.bytes.toLocaleString()} bytes at the selected dimensions. The requested target is ${targetBytes.toLocaleString()} bytes; no filler data was added.`;
  }
  return {
    ...candidate,
    targetBytes,
    targetMet,
    toleranceBytes,
    differenceBytes: candidate.bytes - targetBytes,
    dimensionAdjusted: candidate.width !== width || candidate.height !== height,
    warning
  };
}
