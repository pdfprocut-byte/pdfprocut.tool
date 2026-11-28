import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

const photoRoomEndpoint = 'https://sdk.photoroom.com/v1/segment';
const maxProviderResponseBytes = 50 * 1024 * 1024;

export async function removePhotoBackground(file, backgroundColor = '') {
  if (!env.photoRoomApiKey) throw new ApiError(503, 'AI background processing is not configured yet.');

  const form = new FormData();
  const filename = file.mimetype === 'image/jpeg' ? 'image.jpg' : file.mimetype === 'image/webp' ? 'image.webp' : 'image.png';
  form.set('image_file', new Blob([file.buffer], { type: file.mimetype }), filename);
  form.set('format', 'png');
  form.set('size', 'full');
  if (backgroundColor) form.set('bg_color', backgroundColor);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(photoRoomEndpoint, {
      method: 'POST',
      headers: { 'x-api-key': env.photoRoomApiKey },
      body: form,
      signal: controller.signal
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 413 || response.status === 415) {
        throw new ApiError(422, 'PhotoRoom could not process this image. Try a clear JPG, PNG, or WebP under 25 megapixels.');
      }
      if (response.status === 401 || response.status === 403) {
        throw new ApiError(503, 'The PhotoRoom API key is invalid or inactive.');
      }
      if (response.status === 402) throw new ApiError(503, 'The PhotoRoom API has no credits available.');
      if (response.status === 429) throw new ApiError(503, 'PhotoRoom is receiving too many requests. Please wait and try again.');
      throw new ApiError(502, 'PhotoRoom background processing is temporarily unavailable.');
    }

    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/png', 'image/webp', 'image/jpeg'].includes(type)) {
      throw new ApiError(502, 'PhotoRoom returned an unsupported image format.');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > maxProviderResponseBytes) {
      throw new ApiError(502, 'PhotoRoom returned an empty or oversized image.');
    }
    return { buffer, type };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'AbortError' || error.name === 'TimeoutError') throw new ApiError(504, 'Background removal took too long. Please try a smaller image.');
    throw new ApiError(502, 'Could not connect to PhotoRoom. Please try again.');
  } finally {
    clearTimeout(timeout);
  }
}
