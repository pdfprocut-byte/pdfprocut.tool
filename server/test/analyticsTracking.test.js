import assert from 'node:assert/strict';
import test from 'node:test';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import {
  AnalyticsSessionTracker,
  INACTIVITY_TIMEOUT_MS,
  MAX_HEARTBEAT_GAP_MS,
  VISIT_ACTIVITY_KEY,
  VISIT_ID_KEY,
  VISIT_TIMEOUT_MS,
  VISITOR_ID_KEY,
  analyticsRequestHeaders,
  getActiveDurationSeconds,
  getTrackingIdentity
} from '../../client/src/lib/analyticsTracking.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values
  };
}

function sequenceUuid() {
  let next = 0;
  return () => `audit-id-${++next}`;
}

test('visitor ID persists while a visit ID rotates after 30 minutes of inactivity', () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const uuid = sequenceUuid();
  const first = getTrackingIdentity({ localStorage, sessionStorage, now: 10_000, uuid, touchActivity: true });
  const nextActivity = getTrackingIdentity({ localStorage, sessionStorage, now: 20_000, uuid, touchActivity: true });
  const nextVisit = getTrackingIdentity({ localStorage, sessionStorage, now: 20_000 + VISIT_TIMEOUT_MS, uuid, touchActivity: true });

  assert.equal(nextActivity.visitorId, first.visitorId);
  assert.equal(nextActivity.visitId, first.visitId);
  assert.equal(nextVisit.visitorId, first.visitorId);
  assert.notEqual(nextVisit.visitId, first.visitId);
  assert.equal(localStorage.getItem(VISITOR_ID_KEY), first.visitorId);
  assert.equal(sessionStorage.getItem(VISIT_ID_KEY), nextVisit.visitId);
  assert.equal(localStorage.getItem(VISIT_ACTIVITY_KEY), String(20_000 + VISIT_TIMEOUT_MS));
});

test('PDF request headers reuse the persisted visitor and current visit IDs', () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const first = analyticsRequestHeaders({ localStorage, sessionStorage, now: 100, uuid: sequenceUuid() });
  const second = analyticsRequestHeaders({ localStorage, sessionStorage, now: 200, uuid: sequenceUuid() });

  assert.equal(second['X-Visitor-Id'], first['X-Visitor-Id']);
  assert.equal(second['X-Visit-Id'], first['X-Visit-Id']);
});

test('SPA navigation records each path once, while a new page instance records a refresh', () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const options = { localStorage, sessionStorage, now: () => 1_000, uuid: sequenceUuid() };
  const appInstance = new AnalyticsSessionTracker(options);
  const home = appInstance.pageView('/', 'google', 1_000);
  const about = appInstance.pageView('/about', 'google', 2_000);
  const strictModeReplay = appInstance.pageView('/about', 'google', 2_000);
  const refreshedPage = new AnalyticsSessionTracker(options).pageView('/about', 'google', 3_000);

  assert.equal(home.type, 'page_view');
  assert.equal(about.path, '/about');
  assert.equal(strictModeReplay, null);
  assert.equal(refreshedPage.path, '/about');
  assert.equal(refreshedPage.visitorId, home.visitorId);
  assert.equal(refreshedPage.visitId, home.visitId);
  assert.notEqual(refreshedPage.eventId, about.eventId);
});

test('active time stops at inactivity and ignores hidden or overlong frozen heartbeats', () => {
  const start = 100_000;
  assert.equal(getActiveDurationSeconds({ startedAt: start, now: start + 15_000, lastActivityAt: start, visible: true }), 15);
  assert.equal(getActiveDurationSeconds({ startedAt: start + 60_000, now: start + 75_000, lastActivityAt: start, visible: true }), 0);
  assert.equal(getActiveDurationSeconds({ startedAt: start, now: start + 15_000, lastActivityAt: start, visible: false }), 0);
  assert.equal(getActiveDurationSeconds({ startedAt: start, now: start + MAX_HEARTBEAT_GAP_MS + 1, lastActivityAt: start, visible: true }), 0);
});

test('visibility changes reset the heartbeat baseline and session events have IDs', () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const tracker = new AnalyticsSessionTracker({ localStorage, sessionStorage, now: () => 50_000, uuid: sequenceUuid() });
  tracker.pageView('/', 'direct', 50_000);
  const hidden = tracker.visibilityChange(false, 60_000, '/');
  const restored = tracker.visibilityChange(true, 60_000 + INACTIVITY_TIMEOUT_MS * 4, '/');
  const inactiveHeartbeat = tracker.heartbeat({ now: 60_000 + INACTIVITY_TIMEOUT_MS * 4 + 15_000, visible: true, path: '/' });
  tracker.markActivity(60_000 + INACTIVITY_TIMEOUT_MS * 4 + 16_000);
  const activeHeartbeat = tracker.heartbeat({ now: 60_000 + INACTIVITY_TIMEOUT_MS * 4 + 31_000, visible: true, path: '/' });

  assert.equal(hidden.durationSeconds, 10);
  assert.equal(restored, null);
  assert.equal(inactiveHeartbeat, null);
  assert.equal(activeHeartbeat.durationSeconds, 15);
  assert.ok(activeHeartbeat.visitorId);
  assert.ok(activeHeartbeat.visitId);
  assert.ok(activeHeartbeat.eventId);
});

test('AnalyticsEvent indexes cover reporting and idempotency without legacy single-field declarations', () => {
  const indexes = AnalyticsEvent.schema.indexes();
  const named = new Map(indexes.map(([keys, options]) => [options.name, keys]));
  assert.deepEqual(named.get('analytics_type_createdAt'), { type: 1, createdAt: -1 });
  assert.deepEqual(named.get('analytics_visitor_createdAt'), { visitorId: 1, createdAt: -1 });
  assert.deepEqual(named.get('analytics_user_type_source_createdAt'), { userId: 1, type: 1, source: 1, createdAt: -1 });
  assert.deepEqual(named.get('analytics_type_source_createdAt'), { type: 1, source: 1, createdAt: -1 });
  assert.equal(named.get('analytics_eventId_unique').eventId, 1);
  assert.equal(named.get('analytics_jobId_unique').jobId, 1);
  for (const [keys, options] of indexes) {
    assert.equal(options.name === undefined && Object.keys(keys).length === 1 && ['visitorId', 'visitId', 'userId', 'type'].includes(Object.keys(keys)[0]), false);
  }
});
