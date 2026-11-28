import { apiBaseUrl } from './authApi.js';
import { analyticsRequestHeaders } from './analyticsTracking.js';

export async function readPdfText(file, name) {
  const body = new FormData();
  body.append('files', file, name);
  const response = await fetch(`${apiBaseUrl}/pdf/pdf-to-document/text`, {
    method: 'POST', body, credentials: 'include', headers: analyticsRequestHeaders()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not read this PDF');
  const text = payload.data?.text;
  if (typeof text !== 'string' || !text.trim()) throw new Error('No selectable text was found in this PDF');
  return { initialText: text, documentName: name.replace(/\.pdf$/i, '').trim() || 'PDF document' };
}
