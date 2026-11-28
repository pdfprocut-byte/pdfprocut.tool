import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import ProcessingJob from '../models/ProcessingJob.js';
import { recordPdfOperation } from '../middleware/operationAnalytics.js';

function operationResponse(statusCode, jobId = 'test-job-id') {
  const response = new EventEmitter();
  response.statusCode = statusCode;
  response.writableFinished = false;
  response.getHeader = (name) => ({
    'X-Job-Id': jobId,
    'Content-Disposition': statusCode === 200 ? 'attachment; filename="test.pdf"' : undefined,
    'Content-Length': statusCode === 200 ? '128' : undefined,
    'Content-Type': 'application/pdf'
  })[name];
  return response;
}

function operationRequest() {
  return {
    path: '/text-to-pdf',
    originalUrl: '/api/pdf/text-to-pdf',
    user: { _id: 'analytics-test-user' },
    files: [],
    get: (name) => ({ 'X-Visitor-Id': 'test-visitor', 'X-Visit-Id': 'test-visit', 'cf-ipcountry': 'US' })[name]
  };
}

const finishWrite = async (response) => {
  response.writableFinished = true;
  response.emit('finish');
  response.emit('close');
  await new Promise((resolve) => setImmediate(resolve));
};

test('successful PDF operations persist one job and one linked tool event', async (context) => {
  const jobs = context.mock.method(ProcessingJob, 'create', async (document) => document);
  const events = context.mock.method(AnalyticsEvent, 'create', async (document) => document);
  const response = operationResponse(200);
  recordPdfOperation(operationRequest(), response, () => {});
  await finishWrite(response);

  assert.equal(jobs.mock.callCount(), 1);
  assert.equal(events.mock.callCount(), 1);
  const job = jobs.mock.calls[0].arguments[0];
  const event = events.mock.calls[0].arguments[0];
  assert.equal(job.status, 'completed');
  assert.equal(event.type, 'tool_used');
  assert.equal(event.jobId, job.jobId);
  assert.equal(event.visitorId, 'test-visitor');
  assert.equal(event.visitId, 'test-visit');
});

test('failed PDF operations persist a failed job and do not create a successful use', async (context) => {
  const jobs = context.mock.method(ProcessingJob, 'create', async (document) => document);
  const events = context.mock.method(AnalyticsEvent, 'create', async (document) => document);
  for (const statusCode of [500, 302]) {
    const response = operationResponse(statusCode, `failed-job-${statusCode}`);
    recordPdfOperation(operationRequest(), response, () => {});
    await finishWrite(response);
  }

  assert.equal(jobs.mock.callCount(), 2);
  assert.deepEqual(jobs.mock.calls.map((call) => call.arguments[0].status), ['failed', 'failed']);
  assert.equal(events.mock.callCount(), 0);
});

test('analytics persistence failures are logged instead of silently discarded', async (context) => {
  context.mock.method(ProcessingJob, 'create', async () => { throw new Error('test database write failure'); });
  const errorLog = context.mock.method(console, 'error', () => {});
  const response = operationResponse(200);
  recordPdfOperation(operationRequest(), response, () => {});
  await finishWrite(response);

  assert.equal(errorLog.mock.callCount(), 1);
  assert.match(errorLog.mock.calls[0].arguments[0], /Failed to persist PDF operation records/);
});
