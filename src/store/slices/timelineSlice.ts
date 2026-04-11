import type { StateCreator } from 'zustand';
import type { Asset } from '../../types/media';
import type { Clip, Marker, Track } from '../../types/timeline';
import type { ProjectSlice } from './projectSlice';
import { DEFAULT_PX_PER_SECOND } from '../../lib/projectDefaults';

export type TimelineSlice = {
  // state
  pxPerSecond: number;
  // actions
  setZoom: (pxPerSecond: number) => void;
  addAsset: (asset: Asset) => void;
  updateAsset: (assetId: string, patch: Partial<Asset>) => void;
  addClip: (trackId: string, clip: Clip) => void;
  rippleInsertClip: (trackId: string, clip: Clip) => void;
  updateClip: (trackId: string, clipId: string, patch: Partial<Clip>) => void;
  removeClip: (trackId: string, clipId: string) => void;
  moveClip: (trackId: string, clipId: string, start: number) => void;
  addTrack: (track: Track) => void;
  addMarker: (marker: Marker) => void;
  setSequenceDuration: (duration: number) => void;
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

  rippleInsertClip: (trackId, clip) => {
    const { project } = get();
    if (!project) return;
    const sequences = project.sequences.map((seq) => {
      if (seq.id !== project.activeSequenceId) return seq;
      const tracks = seq.tracks.map((track) => {
        if (track.id !== trackId) return track;
        // Shift every clip that starts at or after the insert point.
        const shiftedClips = track.clips.map((c) =>
          c.start >= clip.start ? { ...c, start: c.start + clip.duration } : c,
        );
        return { ...track, clips: [...shiftedClips, clip] };
      });
      // Extend the sequence duration to cover any newly shifted clips.
      const endTimes = tracks
        .flatMap((t) => t.clips.map((c) => c.start + c.duration));
      const newDuration = endTimes.length > 0
        ? Math.max(seq.duration, ...endTimes)
        : seq.duration;
      return { ...seq, tracks, duration: newDuration };
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

  updateAsset: (assetId, patch) => {
    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          assets: state.project.assets.map((a) =>
            a.id === assetId ? { ...a, ...patch } : a,
          ),
          updatedAt: new Date().toISOString(),
        },
        dirty: true,
      };
    });
  },

  addMarker: (marker) => {
    const { project } = get();
    if (!project) return;
    const sequences = project.sequences.map((seq) => {
      if (seq.id !== project.activeSequenceId) return seq;
      return { ...seq, markers: [...seq.markers, marker] };
    });
    set({ project: { ...project, sequences, updatedAt: new Date().toISOString() }, dirty: true });
  },

  setSequenceDuration: (duration) => {
    const { project } = get();
    if (!project) return;
    const sequences = project.sequences.map((seq) => {
      if (seq.id !== project.activeSequenceId) return seq;
      return { ...seq, duration };
    });
    set({ project: { ...project, sequences, updatedAt: new Date().toISOString() }, dirty: true });
  },
});
