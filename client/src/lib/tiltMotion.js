const tiltPreference = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

export function trackTilt(event) {
  if (event.pointerType !== 'mouse' || !window.matchMedia(tiltPreference).matches) return;

  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));

  element.style.setProperty('--tilt-x', (2 * x - 1).toFixed(3));
  element.style.setProperty('--tilt-y', (1 - 2 * y).toFixed(3));
}

export function resetTilt(event) {
  event.currentTarget.style.removeProperty('--tilt-x');
  event.currentTarget.style.removeProperty('--tilt-y');
}
