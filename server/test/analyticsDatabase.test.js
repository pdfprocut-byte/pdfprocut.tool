import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import { listVisits } from '../controllers/adminController.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import ManagedTool from '../models/ManagedTool.js';
import ProcessingJob from '../models/ProcessingJob.js';

// MONGODB_URI is used only as a connection endpoint; dbName is always an isolated, generated test database.
const testUri = process.env.ANALYTICS_TEST_MONGODB_URI || process.env.MONGODB_URI;

test('analytics API, PDF jobs, and daily/monthly reports reconcile in an isolated database', { skip: !testUri }, async (context) => {
  const databaseName = `pca_test_${Date.now().toString(36)}_${process.pid.toString(36)}`;
  await mongoose.connect(testUri, { dbName: databaseName, serverSelectionTimeoutMS: 15_000 });
  context.after(async () => {
    try {
      if (mongoose.connection.name !== databaseName) throw new Error('Refusing to drop a database other than the isolated analytics test database.');
      await mongoose.connection.db.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  });
  assert.equal(mongoose.connection.name, databaseName, 'the integration test must use its isolated database');
  await Promise.all([AnalyticsEvent.createIndexes(), ManagedTool.createIndexes(), ProcessingJob.createIndexes()]);
  await ManagedTool.create([
    { slug: 'text-to-pdf', name: 'Text to PDF', endpoint: 'text-to-pdf', category: 'PDF tools', enabled: true, sortOrder: 1 },
    { slug: 'merge', name: 'Merge PDF', endpoint: 'merge', category: 'PDF tools', enabled: true, sortOrder: 2 }
  ]);

  const identity = { 'X-Visitor-Id': 'analytics-test-visitor', 'X-Visit-Id': 'analytics-test-visit' };
  const successful = await request(app)
    .post('/api/pdf/text-to-pdf')
    .set(identity)
    .send({ html: '<p>Analytics integration test</p>' })
    .expect('Content-Type', /application\/pdf/)
    .expect(200);
  const successfulJobId = successful.headers['x-job-id'];
  assert.ok(successfulJobId);

  const failed = await request(app)
    .post('/api/pdf/merge')
    .set(identity)
    .attach('files', Buffer.from('not a PDF document'), { filename: 'broken.pdf', contentType: 'application/pdf' })
    .expect(500);

  const waitForWrites = async () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const [successfulJob, failedJob, toolEvent] = await Promise.all([
        ProcessingJob.findOne({ jobId: successfulJobId }).lean(),
        ProcessingJob.findOne({ toolName: 'merge', status: 'failed' }).lean(),
        AnalyticsEvent.findOne({ jobId: successfulJobId, type: 'tool_used' }).lean()
      ]);
      if (successfulJob && failedJob && toolEvent) return { successfulJob, failedJob, toolEvent };
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('PDF analytics writes did not finish before the test timeout.');
  };
  const { successfulJob, failedJob, toolEvent } = await waitForWrites();
  assert.equal(successfulJob.status, 'completed');
  assert.equal(failedJob.status, 'failed');
  assert.equal(failed.headers['x-job-id'], undefined, 'failed conversions do not expose a successful output job ID');
  assert.equal(toolEvent.jobId, successfulJobId);
  assert.equal(toolEvent.visitorId, identity['X-Visitor-Id']);
  assert.equal(toolEvent.visitId, identity['X-Visit-Id']);
  assert.equal(await AnalyticsEvent.countDocuments({ jobId: failedJob.jobId, type: 'tool_used' }), 0);

  const trackPage = (eventId, path) => request(app).post('/api/analytics/events').send({
    eventId,
    visitorId: identity['X-Visitor-Id'],
    visitId: identity['X-Visit-Id'],
    type: 'page_view',
    path,
    source: 'direct'
  });
  await trackPage('integration-home', '/').expect(201);
  await trackPage('integration-about', '/about').expect(201);
  await trackPage('integration-refresh', '/about').expect(201);
  await trackPage('integration-refresh', '/about').expect(200, { success: true, data: { tracked: false, duplicate: true } });
  await request(app).post('/api/analytics/events').send({ path: '/older-client' }).expect(201);
  const compatibleEvent = await AnalyticsEvent.findOne({ path: '/older-client', type: 'page_view' }).lean();
  assert.ok(compatibleEvent.visitorId);
  assert.ok(compatibleEvent.visitId);
  assert.ok(compatibleEvent.eventId);
  await request(app).post('/api/analytics/events').send({
    eventId: 'integration-session', visitorId: identity['X-Visitor-Id'], visitId: identity['X-Visit-Id'],
    type: 'session', path: '/about', durationSeconds: 15
  }).expect(201);

  assert.equal(await AnalyticsEvent.countDocuments({ type: 'page_view' }), 4, 'SPA navigation and refresh count once each; a repeated eventId is deduplicated');
  const report = await new Promise((resolve, reject) => {
    listVisits({ query: { month: new Date().toISOString().slice(0, 7), timeZone: 'UTC' }, get: () => '' }, { json: resolve }, reject);
  });
  const daily = report.data.daily;
  assert.equal(report.data.summary.pageViews, 4);
  assert.equal(report.data.summary.visitors, 2);
  assert.equal(report.data.summary.visitCount, 2);
  assert.equal(report.data.summary.pdfUses, 1);
  assert.equal(report.data.summary.activeSeconds, 15);
  assert.equal(report.data.summary.pageViews, daily.reduce((sum, day) => sum + day.pageViews, 0));
  assert.equal(report.data.summary.pdfUses, daily.reduce((sum, day) => sum + day.pdfUses, 0));
  assert.equal(report.data.summary.activeSeconds, daily.reduce((sum, day) => sum + day.activeSeconds, 0));
  assert.equal(report.data.summary.visits, report.data.summary.pageViews, 'legacy visits field stays compatible as a page-view alias');
});
