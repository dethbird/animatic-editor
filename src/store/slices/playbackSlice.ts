import type { StateCreator } from 'zustand';

export type PlaybackSlice = {
  // state
  currentTime: number;  // seconds
  isPlaying: boolean;
  // actions
  setCurrentTime: (t: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
};

export const createPlaybackSlice: StateCreator<PlaybackSlice, [], [], PlaybackSlice> = (set) => ({
  currentTime: 0,
  isPlaying: false,

  setCurrentTime: (t) => set({ currentTime: Math.max(0, t) }),

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  stop: () => set({ isPlaying: false, currentTime: 0 }),
});
