export type ClipType = 'image' | 'audio' | 'gap';

export type ScriptRef = {
  panelId?: string;
  act?: string;
  scene?: string;
  sequence?: string;
};

export type ClipTransform = {
  scale?: number;
  x?: number;
  y?: number;
  opacity?: number;
};

export type Clip = {
  id: string;
  assetId?: string;
  type: ClipType;
  start: number;              // seconds from sequence start
  duration: number;           // seconds
  inPoint: number;            // seconds into the asset to begin reading
  label?: string;
  volume?: number;            // 0.0–1.0, for audio clips
  linkedClipId?: string;      // pairs an image clip ↔ audio clip from import
  scriptRef?: ScriptRef;
  transform?: ClipTransform;
  fadeIn?: number;            // seconds
  fadeOut?: number;           // seconds
};

export type TrackKind = 'video' | 'audio';

export type Track = {
  id: string;
  name: string;
  kind: TrackKind;
  muted: boolean;
  locked: boolean;
  clips: Clip[];
};

export type Marker = {
  id: string;
  time: number;               // seconds from sequence start
  label: string;
};

export type Sequence = {
  id: string;
  name: string;
  duration: number;           // seconds
  tracks: Track[];
  markers: Marker[];
};
