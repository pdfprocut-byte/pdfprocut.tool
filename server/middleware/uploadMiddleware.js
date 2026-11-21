import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const allowed = new Set([
  'application/pdf', 'application/zip', 'application/octet-stream',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'application/vnd.ms-word.document.macroEnabled.12',
  'application/vnd.ms-word.template.macroEnabled.12',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel.template.macroEnabled.12',
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
  'application/vnd.ms-powerpoint.template.macroEnabled.12',
  'image/jpeg', 'image/png', 'text/plain', 'text/html'
]);

const storage = {
  _handleFile(req, file, callback) {
    const chunks = [];
    let size = 0;
    let completed = false;
    req.uploadedFileBytes ??= 0;

    const finish = (error, info) => {
      if (completed) return;
      completed = true;
      callback(error, info);
    };

    file.stream.on('data', (chunk) => {
      if (completed) return;
      size += chunk.length;
      req.uploadedFileBytes += chunk.length;
      if (req.uploadedFileBytes > env.maxTotalUploadSize) {
        chunks.length = 0;
        finish(new ApiError(413, `The combined upload limit is ${env.maxTotalUploadMb} MB.`));
        return;
      }
      chunks.push(chunk);
    });

    file.stream.on('error', (error) => {
      chunks.length = 0;
      finish(error);
    });

    file.stream.on('end', () => {
      if (completed) return;
      const buffer = Buffer.concat(chunks, size);
      chunks.length = 0;
      finish(null, { buffer, size });
    });
  },

  _removeFile(req, file, callback) {
    delete file.buffer;
    callback(null);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: env.maxFileSize,
    files: 20,
    fields: 30,
    fieldSize: 512 * 1024,
    fieldNameSize: 100,
    parts: 50,
    fieldArrayIndexLimit: 20
  },
  fileFilter: (req, file, callback) => allowed.has(file.mimetype)
    ? callback(null, true)
    : callback(new ApiError(415, `Unsupported file type: ${file.mimetype}`))
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many file operations. Please wait before trying again.' }
});

let activeUploads = 0;
export const uploadConcurrencyLimiter = (req, res, next) => {
  if (activeUploads >= env.maxConcurrentUploads) {
    res.set('Retry-After', '10');
    return res.status(503).json({ success: false, error: 'File processing is busy. Please try again shortly.' });
  }

  activeUploads += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeUploads = Math.max(0, activeUploads - 1);
  };
  res.once('finish', release);
  res.once('close', release);
  req.once('aborted', release);
  next();
};

export const resetUploadByteCount = (req, res, next) => {
  req.uploadedFileBytes = 0;
  next();
};
