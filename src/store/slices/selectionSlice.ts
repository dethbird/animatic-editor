import type { StateCreator } from 'zustand';

export type SelectionSlice = {
  // state
  selectedClipId: string | null;
  selectedTrackId: string | null;
  selectedAssetId: string | null;
  // actions
  selectClip: (trackId: string, clipId: string) => void;
  selectAsset: (assetId: string) => void;
  clearSelection: () => void;
};

export const createSelectionSlice: StateCreator<SelectionSlice, [], [], SelectionSlice> = (set) => ({
  selectedClipId: null,
  selectedTrackId: null,
  selectedAssetId: null,

  selectClip: (trackId, clipId) =>
    set({ selectedTrackId: trackId, selectedClipId: clipId }),

  selectAsset: (assetId) =>
    set({ selectedAssetId: assetId, selectedClipId: null }),

  clearSelection: () =>
    set({ selectedClipId: null, selectedTrackId: null, selectedAssetId: null }),
});
