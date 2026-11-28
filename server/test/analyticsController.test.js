import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import User from '../models/User.js';

function mockConnectedAnalytics(context) {
  const original = AnalyticsEvent.db;
  AnalyticsEvent.db = { readyState: 1 };
  context.after(() => { AnalyticsEvent.db = original; });
}

test('tracking an authenticated event adds valid IDs without updating historical visitor events', async (context) => {
  mockConnectedAnalytics(context);
  const user = { _id: 'analytics-account', role: 'user', emailVerified: true, sessionVersion: 0 };
  context.mock.method(jwt, 'verify', () => ({ id: user._id, sessionVersion: 0 }));
  context.mock.method(User, 'findById', () => ({ select: async () => user }));
  const create = context.mock.method(AnalyticsEvent, 'create', async (event) => event);
  const updateMany = context.mock.method(AnalyticsEvent, 'updateMany', async () => ({ modifiedCount: 0 }));

  await request(app)
    .post('/api/analytics/events')
    .set('Authorization', 'Bearer analytics-test-token')
    .send({ type: 'session', durationSeconds: 12, path: '/about' })
    .expect(201);

  const event = create.mock.calls[0].arguments[0];
  assert.equal(event.userId, user._id);
  assert.ok(event.visitorId);
  assert.ok(event.visitId);
  assert.ok(event.eventId);
  assert.equal(updateMany.mock.callCount(), 0, 'recording a new event must leave historical analytics unchanged');
});

test('public analytics event write errors are logged and reported as server errors', async (context) => {
  mockConnectedAnalytics(context);
  context.mock.method(AnalyticsEvent, 'create', async () => { throw new Error('simulated analytics storage failure'); });
  const logged = [];
  context.mock.method(console, 'error', (...args) => logged.push(args));

  await request(app).post('/api/analytics/events').send({ path: '/about' }).expect(500);
  assert.ok(logged.some(([message]) => String(message).includes('Failed to persist event')));
});
