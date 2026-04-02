export type AssetStatus = 'fetching' | 'ready' | 'error';

export type AssetType = 'image' | 'audio';

export type Asset = {
  id: string;
  type: AssetType;
  name: string;
  sourceUrl?: string;       // original remote URL if imported from URL
  localPath?: string;       // absolute path to cached/local file
  contentHash?: string;     // sha256 of the local file
  fetchedAt?: string;       // ISO 8601 timestamp of last successful download
  status: AssetStatus;
  error?: string;
  // media metadata, populated after ffprobe
  duration?: number;        // seconds (audio / video)
  width?: number;           // pixels (image)
  height?: number;          // pixels (image)
  sampleRate?: number;      // hz (audio)
  channels?: number;        // channel count (audio)
};
