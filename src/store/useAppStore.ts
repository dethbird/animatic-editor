import { create } from 'zustand';
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice';
import { createTimelineSlice, type TimelineSlice } from './slices/timelineSlice';
import { createSelectionSlice, type SelectionSlice } from './slices/selectionSlice';
import { createPlaybackSlice, type PlaybackSlice } from './slices/playbackSlice';
import { createExportSlice, type ExportSlice } from './slices/exportSlice';

export type AppStore = ProjectSlice & TimelineSlice & SelectionSlice & PlaybackSlice & ExportSlice;

export const useAppStore = create<AppStore>()((...args) => ({
  ...createProjectSlice(...args),
  ...createTimelineSlice(...args),
  ...createSelectionSlice(...args),
  ...createPlaybackSlice(...args),
  ...createExportSlice(...args),
}));
