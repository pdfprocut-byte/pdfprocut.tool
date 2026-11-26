const storageKey = 'pdfpro_guest_tool_uses.v1';
export const guestToolUseLimit = 2;
let memoryUseCount = 0;

export function getGuestToolUseCount() {
  try {
    const storedCount = Number(window.localStorage.getItem(storageKey));
    if (Number.isInteger(storedCount) && storedCount >= 0) memoryUseCount = Math.max(memoryUseCount, storedCount);
  } catch {
    // Keep the in-memory count when browser storage is unavailable.
  }
  return memoryUseCount;
}

export function consumeGuestToolUse() {
  const currentCount = getGuestToolUseCount();
  if (currentCount >= guestToolUseLimit) return false;
  memoryUseCount = currentCount + 1;
  try {
    window.localStorage.setItem(storageKey, String(memoryUseCount));
  } catch {
    // The in-memory count still applies for the current page session.
  }
  return true;
}
