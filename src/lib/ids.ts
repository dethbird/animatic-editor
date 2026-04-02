import { nanoid } from 'nanoid';

/** Generate a unique ID for any entity (asset, clip, track, sequence, marker). */
export function generateId(): string {
  return nanoid();
}
