/** Convert a time in seconds to pixels given the current zoom level. */
export function timeToPx(seconds: number, pxPerSecond: number): number {
  return seconds * pxPerSecond;
}

/** Convert a pixel offset to seconds given the current zoom level. */
export function pxToTime(px: number, pxPerSecond: number): number {
  return px / pxPerSecond;
}

/**
 * Format a time in seconds as a timecode string: HH:MM:SS:FF
 * Uses 0-based frame count at the given fps.
 */
export function formatTimecode(seconds: number, fps: number): string {
  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(seconds);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

/**
 * Format a time in seconds as a human-readable string: M:SS.ms
 * Useful for display in the transport bar.
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${String(secs).padStart(2, '0')}.${ms}`;
}
