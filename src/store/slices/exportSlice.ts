import type { StateCreator } from 'zustand';
import type { ExportStatus } from '../../types/export';

export type ExportSlice = {
  // state
  exportStatus: ExportStatus;
  exportJobId: string | null;
  exportProgress: number;   // 0–100
  exportError: string | null;
  // actions
  startExport: (jobId: string) => void;
  setExportProgress: (progress: number, stage?: string) => void;
  finishExport: () => void;
  failExport: (error: string) => void;
  resetExport: () => void;
};

export const createExportSlice: StateCreator<ExportSlice, [], [], ExportSlice> = (set) => ({
  exportStatus: 'idle',
  exportJobId: null,
  exportProgress: 0,
  exportError: null,

  startExport: (jobId) =>
    set({ exportStatus: 'running', exportJobId: jobId, exportProgress: 0, exportError: null }),

  setExportProgress: (progress) =>
    set({ exportProgress: Math.min(100, Math.max(0, progress)) }),

  finishExport: () =>
    set({ exportStatus: 'done', exportProgress: 100 }),

  failExport: (error) =>
    set({ exportStatus: 'error', exportError: error }),

  resetExport: () =>
    set({ exportStatus: 'idle', exportJobId: null, exportProgress: 0, exportError: null }),
});
