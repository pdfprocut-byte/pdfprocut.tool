import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeGuestToolUse, getGuestToolUseCount, guestToolUseLimit } from '../src/lib/guestToolAccess.js';

test('guests can download two tool results before an account is required', () => {
  const previousWindow = globalThis.window;
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value)
    }
  };

  try {
    assert.equal(guestToolUseLimit, 2);
    assert.equal(getGuestToolUseCount(), 0);
    assert.equal(consumeGuestToolUse(), true);
    assert.equal(consumeGuestToolUse(), true);
    assert.equal(getGuestToolUseCount(), 2);
    assert.equal(consumeGuestToolUse(), false);
    assert.equal(values.get('pdfpro_guest_tool_uses.v1'), '2');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
