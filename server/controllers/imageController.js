import { v4 as uuid } from 'uuid';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { compressImage } from '../services/compressionService.js';

export const compress = asyncHandler(async (req, res) => {
  const uploaded = req.files?.[0];
  if (!uploaded) throw new ApiError(400, 'Upload a JPG or PNG image');
  const targetSizeMb = Number(req.body.targetSizeMb);
  if (!Number.isFinite(targetSizeMb) || targetSizeMb < 1 / 1024 || targetSizeMb > 1024) {
    throw new ApiError(400, 'Choose a target size between 1 KB and 1 GB');
  }
  const widthValue = req.body.width === undefined || req.body.width === '' ? undefined : Number(req.body.width);
  const heightValue = req.body.height === undefined || req.body.height === '' ? undefined : Number(req.body.height);
  if ((widthValue === undefined) !== (heightValue === undefined)) throw new ApiError(400, 'Enter both output width and height');
  if (widthValue !== undefined && (!Number.isSafeInteger(widthValue) || !Number.isSafeInteger(heightValue) || widthValue < 1 || heightValue < 1 || widthValue > 40000 || heightValue > 40000 || widthValue * heightValue > 40_000_000)) {
    throw new ApiError(400, 'Output dimensions must be positive and no more than 40 megapixels total');
  }
  const quality = String(req.body.quality || 'clear');
  const result = await compressImage(uploaded, targetSizeMb, quality, { width: widthValue, height: heightValue });
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
    'X-Target-Met': String(result.buffer.length <= targetBytes)
  });
  res.send(result.buffer);
});
