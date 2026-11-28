import { apiBaseUrl, getCsrfToken, getSession } from './authApi.js';

export async function getPhotoRoomBackgroundStatus() {
  const response = await fetch(`${apiBaseUrl}/image/background-status`, { credentials: 'include' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not check AI background service status.');
  return Boolean(payload.data?.available);
}

export async function processPhotoBackground(file, { backgroundColor = '', consent = false } = {}) {
  if (!consent) throw new Error('Confirm that this photo may be sent to PhotoRoom for background processing.');
  const session = await getSession();
  if (!session.user) throw new Error('Sign in before using AI background processing.');
  const csrfToken = await getCsrfToken();
  const body = new FormData();
  body.append('image_file', file);
  body.append('consent', 'yes');
  if (backgroundColor) body.append('backgroundColor', backgroundColor);

  const response = await fetch(`${apiBaseUrl}/image/background`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken },
    body
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Could not remove the image background.');
  }
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('The background service returned an invalid image.');
  return blob;
}
