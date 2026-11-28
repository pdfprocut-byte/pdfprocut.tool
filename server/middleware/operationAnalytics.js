import AnalyticsEvent from '../models/AnalyticsEvent.js';
import ProcessingJob from '../models/ProcessingJob.js';
import { env } from '../config/env.js';
import { v4 as uuid } from 'uuid';

export const recordPdfOperation = (req, res, next) => {
  const startedAt = Date.now();
  const tool = req.path.replace(/^\//, '').split('/')[0];
  const path = req.originalUrl.slice(0, 240);
  const userId = req.user?._id;
  if (!tool || tool === 'pdf-to-document' && req.path.endsWith('/config')) return next();
  let recorded = false;
  const persistOperation = async (responseFinished) => {
    if (recorded) return;
    recorded = true;
    const completed = responseFinished && res.statusCode >= 200 && res.statusCode < 300;
    const finishedAt = new Date();
    const durationSeconds = Math.min(Math.round((Date.now() - startedAt) / 1000), 86400);
    const inputFiles = Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
    const disposition = res.getHeader('Content-Disposition');
    const outputName = typeof disposition === 'string' ? disposition.match(/filename="?([^";]+)"?/i)?.[1]?.trim().slice(0, 240) : '';
    const outputSizeHeader = res.getHeader('Content-Length');
    const outputSize = outputSizeHeader === undefined ? undefined : Number(outputSizeHeader);
    const jobId = String(res.getHeader('X-Job-Id') || uuid());
    const visitorId = String(req.get('X-Visitor-Id') || '').trim().slice(0, 100) || uuid();
    const visitId = String(req.get('X-Visit-Id') || '').trim().slice(0, 100) || uuid();
    try {
      await ProcessingJob.create({
        jobId,
        userId,
        toolName: tool,
        inputFileMetadata: inputFiles.map((item) => ({ name: item.originalname, size: item.size, mimeType: item.mimetype })),
        outputFileMetadata: completed && outputName ? [{ name: outputName, ...(Number.isFinite(outputSize) ? { size: outputSize } : {}), mimeType: String(res.getHeader('Content-Type') || '').split(';')[0] }] : [],
        status: completed ? 'completed' : 'failed',
        errorMessage: completed ? undefined : responseFinished ? `Processing failed (HTTP ${res.statusCode})` : 'Processing response closed before completion',
        durationSeconds,
        completedAt: completed ? finishedAt : undefined,
        expiresAt: new Date(finishedAt.getTime() + env.ttlMinutes * 60 * 1000)
      });
      if (!completed) return;
      await AnalyticsEvent.create({
        jobId,
        visitorId,
        visitId,
        userId,
        type: 'tool_used',
        tool,
        path,
        country: String(req.get('cf-ipcountry') || 'UN').slice(0, 2).toUpperCase(),
        source: 'pdf-api',
        durationSeconds
      });
    } catch (error) {
      console.error('[analytics] Failed to persist PDF operation records', {
        jobId,
        tool,
        statusCode: res.statusCode,
        errorName: error?.name || 'Error',
        errorCode: error?.code
      });
    }
  };
  res.once('finish', () => { void persistOperation(true); });
  res.once('close', () => { if (!res.writableFinished) void persistOperation(false); });
  next();
};
