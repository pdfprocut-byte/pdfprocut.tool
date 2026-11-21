import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const adobeApiBase = 'https://pdf-services.adobe.io';
const maxOutputBytes = 100 * 1024 * 1024;
const mediaTypes = {
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

function adobeApiHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'x-api-key': env.adobePdfServicesClientId };
}

async function adobeJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) throw new ApiError(429, 'Adobe conversion limit reached or service is busy. Check your Adobe PDF Services plan and try again later.');
    if (response.status === 401 || response.status === 403) throw new ApiError(502, 'Adobe rejected the configured credentials. Check the PDF Services client ID and secret.');
    if (response.status === 413) throw new ApiError(413, 'Adobe could not accept this Office file because it is too large.');
    throw new ApiError(502, fallbackMessage);
  }
  return payload;
}

function trustedAdobeOperationUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^pdf-services(?:-[a-z0-9-]+)?\.adobe\.io$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function trustedAdobeStorageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^dcplatformstorageservice-prod-[a-z0-9-]+\.s3(?:-accelerate)?\.amazonaws\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

async function readPdfFile(response) {
  if (!response.body) throw new ApiError(502, 'Adobe returned an empty PDF.');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxOutputBytes) {
      await reader.cancel().catch(() => {});
      throw new ApiError(413, 'The converted PDF exceeds the 100 MB download limit.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function officeToPdfWithAdobe(file, extension) {
  if (!env.adobePdfServicesClientId || !env.adobePdfServicesClientSecret) {
    throw new ApiError(503, 'Adobe PDF Services is not configured on this server.');
  }
  const mediaType = mediaTypes[extension];
  if (!mediaType) throw new ApiError(415, 'Choose a DOC, DOCX, XLS, XLSX, PPT, or PPTX file');

  const deadline = Date.now() + 85_000;
  const request = (url, options) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ApiError(504, 'Adobe Office to PDF conversion took too long. Try again later.');
    return fetch(url, { ...options, signal: AbortSignal.timeout(Math.min(20_000, remaining)) });
  };

  try {
    const credentials = new URLSearchParams({
      client_id: env.adobePdfServicesClientId,
      client_secret: env.adobePdfServicesClientSecret
    });
    const tokenResponse = await request(`${adobeApiBase}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: credentials
    });
    const { access_token: token } = await adobeJson(tokenResponse, 'Could not authenticate with Adobe PDF Services.');
    if (!token) throw new ApiError(502, 'Adobe did not return an access token.');

    const assetResponse = await request(`${adobeApiBase}/assets`, {
      method: 'POST', headers: { ...adobeApiHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType })
    });
    const { assetID, uploadUri } = await adobeJson(assetResponse, 'Could not prepare this Office file for Adobe conversion.');
    if (!assetID || !trustedAdobeStorageUrl(uploadUri)) throw new ApiError(502, 'Adobe returned an invalid upload location.');

    const uploadResponse = await request(uploadUri, {
      method: 'PUT', headers: { 'Content-Type': mediaType }, body: file.buffer
    });
    if (!uploadResponse.ok) throw new ApiError(502, 'Could not upload the Office file to Adobe for conversion.');

    const createResponse = await request(`${adobeApiBase}/operation/createpdf`, {
      method: 'POST', headers: { ...adobeApiHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetID })
    });
    if (createResponse.status !== 201 && createResponse.status !== 202) {
      await adobeJson(createResponse, 'Adobe could not start the PDF conversion.');
      throw new ApiError(502, 'Adobe could not start the PDF conversion.');
    }
    let operationUrl = createResponse.headers.get('location');
    if (!trustedAdobeOperationUrl(operationUrl)) throw new ApiError(502, 'Adobe returned an invalid conversion status URL.');

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(1500, Math.max(0, deadline - Date.now()))));
      const statusResponse = await request(operationUrl, { headers: adobeApiHeaders(token) });
      const status = await adobeJson(statusResponse, 'Could not read the Adobe conversion status.');
      if (status.status === 'failed') throw new ApiError(422, 'Adobe could not convert this Office file to PDF.');
      if (status.status === 'done') {
        const downloadUri = status.asset?.downloadUri || status.result?.asset?.downloadUri || status.downloadUri;
        if (!trustedAdobeStorageUrl(downloadUri)) throw new ApiError(502, 'Adobe returned an invalid PDF download location.');
        const downloadResponse = await request(downloadUri, {});
        if (!downloadResponse.ok) throw new ApiError(502, 'Could not download the converted PDF from Adobe.');
        if (!downloadResponse.headers.get('content-type')?.toLowerCase().includes('application/pdf')) {
          throw new ApiError(502, 'Adobe returned an invalid file instead of a PDF.');
        }
        if (Number(downloadResponse.headers.get('content-length')) > maxOutputBytes) {
          throw new ApiError(413, 'The converted PDF exceeds the 100 MB download limit.');
        }
        const bytes = await readPdfFile(downloadResponse);
        if (!bytes.length || bytes.length > maxOutputBytes || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
          throw new ApiError(502, 'Adobe returned an invalid or oversized PDF.');
        }
        return bytes;
      }
      operationUrl = statusResponse.headers.get('location') || operationUrl;
      if (!trustedAdobeOperationUrl(operationUrl)) throw new ApiError(502, 'Adobe returned an invalid conversion status URL.');
    }
    throw new ApiError(504, 'Adobe Office to PDF conversion took too long. Try again later.');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new ApiError(504, 'Adobe Office to PDF conversion took too long. Try again later.');
    }
    throw new ApiError(502, 'Adobe Office to PDF conversion failed. Please try again later.');
  }
}
