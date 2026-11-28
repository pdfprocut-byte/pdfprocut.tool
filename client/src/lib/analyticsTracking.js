export const VISITOR_ID_KEY = 'pdfprocut_visitor_id';
export const VISIT_ID_KEY = 'pdfprocut_visit_id';
export const VISIT_ACTIVITY_KEY = 'pdfprocut_visit_last_active';
export const TRAFFIC_SOURCE_KEY = 'pdfprocut_traffic_source';
export const VISIT_TIMEOUT_MS = 30 * 60 * 1000;
export const INACTIVITY_TIMEOUT_MS = 60 * 1000;
export const HEARTBEAT_INTERVAL_MS = 15 * 1000;
export const MAX_HEARTBEAT_GAP_MS = HEARTBEAT_INTERVAL_MS + 2 * 1000;

const validId = (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100;
const browserUuid = () => globalThis.crypto.randomUUID();
const read = (storage, key) => {
  try { return storage?.getItem(key) || ''; } catch { return ''; }
};
const write = (storage, key, value) => {
  try { storage?.setItem(key, value); } catch { /* Keep tracking best-effort when browser storage is unavailable. */ }
};

export function getTrackingIdentity({
  localStorage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
  now = Date.now(),
  uuid = browserUuid,
  touchActivity = false
} = {}) {
  let visitorId = read(localStorage, VISITOR_ID_KEY) || read(sessionStorage, VISITOR_ID_KEY);
  if (!validId(visitorId)) visitorId = uuid();
  write(localStorage, VISITOR_ID_KEY, visitorId);
  write(sessionStorage, VISITOR_ID_KEY, visitorId);

  const lastActivity = Number(read(localStorage, VISIT_ACTIVITY_KEY)) || 0;
  let visitId = read(localStorage, VISIT_ID_KEY) || read(sessionStorage, VISIT_ID_KEY);
  if (!validId(visitId) || !lastActivity || now - lastActivity >= VISIT_TIMEOUT_MS) visitId = uuid();
  write(localStorage, VISIT_ID_KEY, visitId);
  write(sessionStorage, VISIT_ID_KEY, visitId);
  if (touchActivity) write(localStorage, VISIT_ACTIVITY_KEY, String(now));
  return { visitorId, visitId };
}

export function analyticsRequestHeaders(options = {}) {
  const { visitorId, visitId } = getTrackingIdentity({ ...options, touchActivity: true });
  return { 'X-Visitor-Id': visitorId, 'X-Visit-Id': visitId };
}

export function getActiveDurationSeconds({ startedAt, now, lastActivityAt, visible, maxGapMs = MAX_HEARTBEAT_GAP_MS }) {
  const elapsed = now - startedAt;
  if (!visible || elapsed <= 0 || elapsed > maxGapMs) return 0;
  const activeUntil = Math.min(now, lastActivityAt + INACTIVITY_TIMEOUT_MS);
  return Math.max(0, Math.floor((activeUntil - startedAt) / 1000));
}

export class AnalyticsSessionTracker {
  constructor({
    localStorage = globalThis.localStorage,
    sessionStorage = globalThis.sessionStorage,
    now = Date.now,
    uuid = browserUuid
  } = {}) {
    this.localStorage = localStorage;
    this.sessionStorage = sessionStorage;
    this.now = now;
    this.uuid = uuid;
    this.lastHeartbeatAt = now();
    this.lastActivityAt = now();
    this.lastPagePath = '';
    this.visible = true;
  }

  markActivity(now = this.now()) {
    if (now - this.lastActivityAt >= INACTIVITY_TIMEOUT_MS) this.lastHeartbeatAt = now;
    this.lastActivityAt = now;
    return getTrackingIdentity({
      localStorage: this.localStorage,
      sessionStorage: this.sessionStorage,
      now,
      uuid: this.uuid,
      touchActivity: true
    });
  }

  pageView(path, source = 'direct', now = this.now()) {
    const identity = this.markActivity(now);
    if (this.lastPagePath === path) return null;
    this.lastPagePath = path;
    return {
      ...identity,
      eventId: this.uuid(),
      type: 'page_view',
      path,
      source
    };
  }

  heartbeat({ now = this.now(), visible = this.visible, path = '/' } = {}) {
    const startedAt = this.lastHeartbeatAt;
    this.lastHeartbeatAt = now;
    const durationSeconds = getActiveDurationSeconds({
      startedAt,
      now,
      lastActivityAt: this.lastActivityAt,
      visible
    });
    if (durationSeconds < 1) return null;
    const identity = getTrackingIdentity({
      localStorage: this.localStorage,
      sessionStorage: this.sessionStorage,
      now,
      uuid: this.uuid,
      touchActivity: false
    });
    return { ...identity, eventId: this.uuid(), type: 'session', path, durationSeconds };
  }

  visibilityChange(visible, now = this.now(), path = '/') {
    const event = !visible && this.visible
      ? this.heartbeat({ now, visible: true, path })
      : null;
    this.lastHeartbeatAt = now;
    this.visible = visible;
    return event;
  }

  pageHide({ now = this.now(), visible = this.visible, path = '/' } = {}) {
    const event = this.heartbeat({ now, visible, path });
    this.lastHeartbeatAt = now;
    return event;
  }
}
