import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { officeToPdfWithAdobe } from './adobeOfficeToPdfService.js';

const maxOutputBytes = 100 * 1024 * 1024;
const extensions = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
const expectedMimeTypes = {
  doc: ['application/msword', 'application/octet-stream'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
  xls: ['application/vnd.ms-excel', 'application/octet-stream'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
  ppt: ['application/vnd.ms-powerpoint', 'application/octet-stream'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream']
};

export async function officeFileToPdf(file) {
  const extension = String(file.originalname || '').split('.').at(-1).toLowerCase();
  if (!extensions.has(extension)) throw new ApiError(415, 'Choose a DOC, DOCX, XLS, XLSX, PPT, or PPTX file');
  if (!expectedMimeTypes[extension].includes(file.mimetype)) throw new ApiError(415, 'The file extension and document type do not match');
  const hasAdobeCredentials = Boolean(env.adobePdfServicesClientId && env.adobePdfServicesClientSecret);
  const isSpreadsheet = extension === 'xls' || extension === 'xlsx';
  if (isSpreadsheet && !hasAdobeCredentials) {
    throw new ApiError(503, 'Excel to PDF requires Adobe PDF Services. Configure PDF_SERVICES_CLIENT_ID and PDF_SERVICES_CLIENT_SECRET.');
  }
  if (hasAdobeCredentials) {
    return officeToPdfWithAdobe(file, extension);
  }

  const body = new FormData();
  body.append('file', new Blob([file.buffer], { type: file.mimetype }), `upload.${extension}`);
  let response;
  try {
    response = await fetch(`${env.officeConverterUrl}/convert-to-pdf`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(95_000)
    });
  } catch {
    throw new ApiError(503, 'Office conversion is unavailable. Configure Adobe PDF Services or start the isolated worker with docker compose in converter-worker/.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(response.status === 429 ? 429 : 422, payload.error || 'The Office file could not be converted');
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/pdf')) {
    throw new ApiError(502, 'The Office converter returned an invalid file');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > maxOutputBytes) throw new ApiError(413, 'The converted PDF is empty or exceeds 100 MB');
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new ApiError(502, 'The Office converter returned an invalid PDF');
  return bytes;
}
