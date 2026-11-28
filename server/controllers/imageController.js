import { v4 as uuid } from 'uuid';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { compressImage } from '../services/compressionService.js';
import { env } from '../config/env.js';
import { removePhotoBackground } from '../services/photoBackgroundService.js';

export const backgroundStatus = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { available: Boolean(env.photoRoomApiKey) } });
});

export const removeBackground = asyncHandler(async (req, res) => {
  const uploaded = req.file;
  if (!uploaded) throw new ApiError(400, 'Choose a JPG, PNG, or WebP image first.');
  if (req.body.consent !== 'yes') throw new ApiError(400, 'Confirm that this image may be sent to PhotoRoom for background processing.');

  const isJpeg = uploaded.buffer[0] === 0xff && uploaded.buffer[1] === 0xd8 && uploaded.buffer[2] === 0xff;
  const isPng = uploaded.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = uploaded.buffer.toString('ascii', 0, 4) === 'RIFF' && uploaded.buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) throw new ApiError(415, 'The image contents do not match a supported JPG, PNG, or WebP file.');

  let backgroundColor = '';
  if (req.body.backgroundColor) {
    backgroundColor = String(req.body.backgroundColor).trim();
    if (!/^#?[\da-f]{6}$/i.test(backgroundColor)) throw new ApiError(400, 'Choose a valid six-digit background color.');
    backgroundColor = backgroundColor.replace(/^#/, '').toUpperCase();
  }

  const imageType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : 'image/webp';
  const result = await removePhotoBackground({ ...uploaded, mimetype: imageType }, backgroundColor);
  res.set({
    'Content-Type': result.type,
    'Content-Disposition': 'attachment; filename="background-removed.png"',
    'Cache-Control': 'no-store'
  }).send(result.buffer);
});

export const compress = asyncHandler(async (req, res) => {
  const uploaded = req.files?.[0];
  if (!uploaded) throw new ApiError(400, 'Upload a JPG or PNG image');
  const targetSizeMb = Number(req.body.targetSizeMb);
  if (!Number.isFinite(targetSizeMb) || targetSizeMb < 1 / 1024 || targetSizeMb > 25) {
    throw new ApiError(400, 'Choose a maximum file size between 1 KB and 25 MB');
  }
  const widthValue = req.body.width === undefined || req.body.width === '' ? undefined : Number(req.body.width);
  const heightValue = req.body.height === undefined || req.body.height === '' ? undefined : Number(req.body.height);
  const mode = String(req.body.mode || 'maximum');
  if (!['maximum', 'target'].includes(mode)) throw new ApiError(400, 'Choose Maximum KB or Target KB compression mode');
  const allowDimensionAdjustment = req.body.allowDimensionAdjustment === 'true';
  if ((widthValue === undefined) !== (heightValue === undefined)) throw new ApiError(400, 'Enter both output width and height');
  if (widthValue !== undefined && (!Number.isSafeInteger(widthValue) || !Number.isSafeInteger(heightValue) || widthValue < 1 || heightValue < 1 || widthValue > 40000 || heightValue > 40000 || widthValue * heightValue > 40_000_000)) {
    throw new ApiError(400, 'Output dimensions must be positive and no more than 40 megapixels total');
  }
  const quality = String(req.body.quality || 'clear');
  const result = await compressImage(uploaded, targetSizeMb, quality, {
    width: widthValue,
    height: heightValue,
    mode,
    allowDimensionAdjustment
  });
  const extension = result.type === 'image/png' ? 'png' : result.type === 'image/webp' ? 'webp' : 'jpg';
  const targetBytes = Math.round(targetSizeMb * 1024 * 1024);
  res.set({
    'Content-Type': result.type,
    'Content-Disposition': `attachment; filename="PDFPro.${extension}"`,
    'X-Job-Id': uuid(),
    'X-Original-Size': String(uploaded.size),
    'X-Output-Size': String(result.buffer.length),
    'X-Output-Width': String(result.width),
    'X-Output-Height': String(result.height),
    'X-Target-Size': String(targetBytes),
    'X-Target-Met': String(result.targetMet ?? result.buffer.length <= targetBytes),
    'X-Target-Difference': String(result.differenceBytes ?? result.buffer.length - targetBytes),
    'X-Target-Tolerance': String(result.toleranceBytes || 0),
    'X-Compression-Mode': mode,
    'X-Output-Quality': result.quality == null ? '' : String(result.quality),
    'X-Dimension-Adjusted': String(Boolean(result.dimensionAdjusted)),
    'X-Compression-Warning': result.warning || ''
  });
  res.send(result.buffer);
});
