import type { StateCreator } from 'zustand';
import type { Asset } from '../../types/media';
import type { Clip, Track } from '../../types/timeline';
import type { ProjectSlice } from './projectSlice';
import { DEFAULT_PX_PER_SECOND } from '../../lib/projectDefaults';

export type TimelineSlice = {
  // state
  pxPerSecond: number;
  // actions
  setZoom: (pxPerSecond: number) => void;
  addAsset: (asset: Asset) => void;
  addClip: (trackId: string, clip: Clip) => void;
  updateClip: (trackId: string, clipId: string, patch: Partial<Clip>) => void;
  removeClip: (trackId: string, clipId: string) => void;
  moveClip: (trackId: string, clipId: string, start: number) => void;
  addTrack: (track: Track) => void;
};

// Timeline mutations all operate on the active sequence inside project.
// The slice reads project from the combined store via get().
export const createTimelineSlice: StateCreator<
  TimelineSlice & ProjectSlice,
  [],
  [],
  TimelineSlice
> = (set, get) => ({
  pxPerSecond: DEFAULT_PX_PER_SECOND,

  setZoom: (pxPerSecond) => set({ pxPerSecond }),

  addAsset: (asset) => {
    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          assets: [...state.project.assets, asset],
          updatedAt: new Date().toISOString(),
        },
        dirty: true,
      };
    });
  },

  addClip: (trackId, clip) => {
    const { project } = get();
    if (!project) return;
    const sequences = project.sequences.map((seq) => {
      if (seq.id !== project.activeSequenceId) return seq;
      return {
        ...seq,
        tracks: seq.tracks.map((track) => {
          if (track.id !== trackId) return track;
          return { ...track, clips: [...track.clips, clip] };
        }),
      };
    });
    set({ project: { ...project, sequences, updatedAt: new Date().toISOString() }, dirty: true });
  },

  updateClip: (trackId, clipId, patch) => {
    const { project } = get();
    if (!project) return;
    const sequences = project.sequences.map((seq) => {
      if (seq.id !== project.activeSequenceId) return seq;
      return {
        ...seq,
        tracks: seq.tracks.map((track) => {
          if (track.id !== trackId) return track;
          return {
            ...track,
            clips: track.clips.map((clip) =>
              clip.id === clipId ? { ...clip, ...patch } : clip,
            ),
          };
        }),
      };
    });
    set({ project: { ...project, sequences, updatedAt: new Date().toISOString() }, dirty: true });
  },

  removeClip: (trackId, clipId) => {
    const { project } = get();
    if (!project) return;
    const sequences = project.sequences.map((seq) => {
      if (seq.id !== project.activeSequenceId) return seq;
      return {
        ...seq,
        tracks: seq.tracks.map((track) => {
          if (track.id !== trackId) return track;
          return { ...track, clips: track.clips.filter((c) => c.id !== clipId) };
        }),
      };
    });
    set({ project: { ...project, sequences, updatedAt: new Date().toISOString() }, dirty: true });
  },

  moveClip: (trackId, clipId, start) => {
    get().updateClip(trackId, clipId, { start: Math.max(0, start) });
  },

  addTrack: (track) => {
    const { project } = get();
    if (!project) return;
    const sequences = project.sequences.map((seq) => {
      if (seq.id !== project.activeSequenceId) return seq;
      return { ...seq, tracks: [...seq.tracks, track] };
    });
    set({ project: { ...project, sequences, updatedAt: new Date().toISOString() }, dirty: true });
  },
});
