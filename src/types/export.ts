export type ExportSettings = {
  width: number;
  height: number;
  fps: number;
  videoCodec: 'h264';
  audioCodec: 'aac';
};

export type ExportStatus = 'idle' | 'running' | 'done' | 'error';

export type ExportProgress = {
  jobId: string;
  progress: number;           // 0–100
  stage?: string;             // e.g. "Rendering segment 3 of 12"
  error?: string;
};
