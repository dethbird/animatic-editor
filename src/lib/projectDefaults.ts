import type { Project } from '../types/project';
import type { Sequence, Track } from '../types/timeline';
import type { ExportSettings } from '../types/export';
import { generateId } from './ids';

export const DEFAULT_FPS = 24;
export const DEFAULT_EXPORT_WIDTH = 1920;
export const DEFAULT_EXPORT_HEIGHT = 1080;
export const DEFAULT_PX_PER_SECOND = 100;
export const DEFAULT_CLIP_DURATION_FALLBACK = 3.0; // seconds, used when duration is unknown

function defaultExportSettings(): ExportSettings {
  return {
    width: DEFAULT_EXPORT_WIDTH,
    height: DEFAULT_EXPORT_HEIGHT,
    fps: DEFAULT_FPS,
    videoCodec: 'h264',
    audioCodec: 'aac',
  };
}

function defaultTracks(): Track[] {
  return [
    { id: 'v1', name: 'Main Images', kind: 'video', muted: false, locked: false, clips: [] },
    { id: 'v2', name: 'Inserts',     kind: 'video', muted: false, locked: false, clips: [] },
    { id: 'a1', name: 'Dialogue',    kind: 'audio', muted: false, locked: false, clips: [] },
    { id: 'a2', name: 'Music',       kind: 'audio', muted: false, locked: false, clips: [] },
  ];
}

function defaultSequence(): Sequence {
  return {
    id: generateId(),
    name: 'Main',
    duration: 0,
    tracks: defaultTracks(),
    markers: [],
  };
}

export function newProject(name: string): Project {
  const now = new Date().toISOString();
  const sequence = defaultSequence();
  return {
    version: 1,
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    assets: [],
    sequences: [sequence],
    activeSequenceId: sequence.id,
    exportSettings: defaultExportSettings(),
  };
}
