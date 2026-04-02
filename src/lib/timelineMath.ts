/**
 * Clamps a clip's start time to be >= 0 and optionally <= a max value.
 */
export function clampClipStart(start: number, max?: number): number {
  const clamped = Math.max(0, start);
  if (max !== undefined) return Math.min(clamped, max);
  return clamped;
}

/**
 * Clamps a clip's duration to a minimum of one frame at the given fps,
 * and optionally a maximum.
 */
export function clampClipDuration(
  duration: number,
  fps: number,
  max?: number,
): number {
  const minDuration = 1 / fps;
  const clamped = Math.max(minDuration, duration);
  if (max !== undefined) return Math.min(clamped, max);
  return clamped;
}

/**
 * Snaps a time value to the nearest multiple of snapInterval (in seconds).
 * Returns the original time if snapInterval is 0.
 */
export function snapTime(time: number, snapInterval: number): number {
  if (snapInterval <= 0) return time;
  return Math.round(time / snapInterval) * snapInterval;
}
