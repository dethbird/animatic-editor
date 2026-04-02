# Animatic Editor — Implementation Spec

## Overview

A desktop animatic editor built with **Tauri v2**, **React + TypeScript**, and **Rust**. The core workflow is: import a Fountain-derived JSON file → auto-generate a timeline of image + audio clips → edit timing → add a music bed → export MP4. Remote asset URLs are downloaded and cached locally before the timeline is generated.

---

## Stack

| Layer | Technology |
|---|---|
| App shell | Tauri v2 |
| Frontend | React 18, TypeScript, Vite |
| UI state | Zustand |
| Styling | Tailwind CSS |
| Timeline drag | Custom pointer logic (no lib for MVP) |
| Audio playback | Web Audio API |
| Rust HTTP | reqwest (async) |
| Media ops | System ffmpeg + ffprobe (not bundled) |

---

## Domain Model

### Asset

```ts
type Asset = {
  id: string
  type: 'image' | 'audio'
  name: string
  sourceUrl?: string        // original remote URL if imported from URL
  localPath?: string        // absolute path to cached local file
  contentHash?: string      // sha256 of local file, for cache validation
  fetchedAt?: string        // ISO timestamp of last successful download
  status: 'fetching' | 'ready' | 'error'
  error?: string
  duration?: number         // seconds (audio / video)
  width?: number            // pixels (image)
  height?: number           // pixels (image)
  sampleRate?: number       // hz (audio)
  channels?: number         // (audio)
}
```

### Project

```ts
type Project = {
  version: number
  id: string
  name: string
  filePath?: string           // absolute path to animatic.json on disk
  createdAt: string
  updatedAt: string
  sourceScript?: SourceScript
  assets: Asset[]
  sequences: Sequence[]
  activeSequenceId: string
  exportSettings: ExportSettings
}

type SourceScript = {
  kind: 'fountain-import'
  path?: string
  importedAt?: string
}
```

### Timeline

```ts
type Sequence = {
  id: string
  name: string
  duration: number
  tracks: Track[]
  markers: Marker[]
}

type Track = {
  id: string
  name: string
  kind: 'video' | 'audio'
  muted: boolean
  locked: boolean
  clips: Clip[]
}

type Clip = {
  id: string
  assetId?: string
  type: 'image' | 'audio' | 'gap'
  start: number               // seconds from sequence start
  duration: number            // seconds
  inPoint: number             // seconds into the asset to start reading
  label?: string
  volume?: number             // 0.0–1.0 (audio clips)
  linkedClipId?: string       // pairs image clip ↔ audio clip from import
  scriptRef?: {
    panelId?: string
    act?: string
    scene?: string
    sequence?: string
  }
  transform?: {
    scale?: number
    x?: number
    y?: number
    opacity?: number
  }
  fadeIn?: number
  fadeOut?: number
}

type Marker = {
  id: string
  time: number
  label: string
}
```

### Export Settings

```ts
type ExportSettings = {
  width: number
  height: number
  fps: number
  videoCodec: 'h264'
  audioCodec: 'aac'
}
```

---

## Project Layout on Disk

```
my-project/
  animatic.json       ← serialized Project
  media/
    <hash>.<ext>      ← cached remote assets (images, audio)
```

- **Per-project cache.** Media lives next to the project file, making the whole folder portable/zippable.
- **Filename**: `sha256(sourceUrl)` + preserved extension from URL path or Content-Type header.
- Local assets added manually via file picker are **not** copied — `localPath` points to the original location. The user is responsible for keeping those stable (relink feature is post-MVP).

---

## Folder Structure

```
animatic-editor/
  package.json
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    App.tsx

    types/
      project.ts
      import.ts
      timeline.ts
      media.ts
      export.ts

    lib/
      ids.ts                  ← nanoid wrappers
      time.ts                 ← timeToPx, pxToTime, formatTimecode
      projectDefaults.ts      ← newProject(), defaultSequence()
      timelineSelectors.ts    ← getClipAtTime(), getActiveVideoClip()
      timelineMath.ts         ← clampClipStart, clampClipDuration, snapTime

    store/
      useAppStore.ts          ← createStore combining all slices
      slices/
        projectSlice.ts
        timelineSlice.ts
        selectionSlice.ts
        playbackSlice.ts
        exportSlice.ts

    features/
      project/
        projectActions.ts     ← newProject, openProject, saveProject (calls Tauri)
      importer/
        importFountain.ts     ← parse JSON → assets + clips + markers
        assetFetcher.ts       ← orchestrates Rust download commands, tracks status
      playback/
        usePlaybackEngine.ts  ← Web Audio scheduling + requestAnimationFrame loop
      export/
        exportActions.ts      ← calls Rust export command, polls progress

    components/
      layout/
        AppShell.tsx
        LeftPanel.tsx
        RightPanel.tsx
        BottomPanel.tsx
      monitor/
        ProgramMonitor.tsx
      timeline/
        TimelineView.tsx
        TimelineRuler.tsx
        TimelineTracks.tsx
        TimelineTrackRow.tsx
        TimelineClip.tsx
        Playhead.tsx
      inspector/
        InspectorPanel.tsx
      transport/
        TransportBar.tsx
      assets/
        AssetBin.tsx
        AssetStatusBadge.tsx   ← ready / fetching / error indicator

  src-tauri/
    Cargo.toml
    tauri.conf.json
    src/
      main.rs
      commands/
        project.rs             ← new_project, save_project, open_project
        media.rs               ← probe_media, download_asset, open_file_dialog
        export.rs              ← start_export, get_export_progress, cancel_export
        system.rs              ← check_ffmpeg, check_ffprobe
      services/
        project_io.rs          ← read/write animatic.json
        ffprobe.rs             ← run ffprobe, parse JSON output
        ffmpeg.rs              ← build filter graphs, run export pipeline
        downloader.rs          ← reqwest download, sha256 naming, dedup
        capability.rs          ← which(ffmpeg), which(ffprobe)
        path_resolver.rs       ← resolve relative paths, media/ dir management
      models/
        project.rs
        media.rs
        export.rs
```

---

## Rust Commands Reference

### `system.rs`

| Command | Input | Output |
|---|---|---|
| `check_ffmpeg` | — | `{ available: bool, version: String }` |
| `check_ffprobe` | — | `{ available: bool, version: String }` |

### `project.rs`

| Command | Input | Output |
|---|---|---|
| `new_project` | `name: String` | `Project` |
| `save_project` | `project: Project, path: String` | `()` |
| `open_project` | `path: String` | `Project` |
| `open_file_dialog` | `filters: Vec<FileFilter>` | `Option<String>` |
| `save_file_dialog` | `default_name: String` | `Option<String>` |

### `media.rs`

| Command | Input | Output |
|---|---|---|
| `probe_media` | `path: String` | `MediaInfo` |
| `download_asset` | `url: String, project_dir: String` | `DownloadResult` |

`DownloadResult`:
```rust
struct DownloadResult {
    local_path: String,
    content_hash: String,
    fetched_at: String,  // ISO 8601
}
```

`MediaInfo`:
```rust
struct MediaInfo {
    kind: String,       // "image" | "audio"
    duration: Option<f64>,
    width: Option<u32>,
    height: Option<u32>,
    sample_rate: Option<u32>,
    channels: Option<u32>,
}
```

### `export.rs`

| Command | Input | Output |
|---|---|---|
| `start_export` | `project: Project, output_path: String` | `String` (job id) |
| `get_export_progress` | `job_id: String` | `ExportProgress` |
| `cancel_export` | `job_id: String` | `()` |

---

## Zustand Store Slices

### `projectSlice`
State: `project: Project | null`, `filePath: string | null`, `dirty: boolean`  
Actions: `newProject()`, `setProject(p)`, `updateProjectMeta(patch)`, `markDirty(b)`

### `timelineSlice`
State: `activeSequenceId: string`, `pxPerSecond: number`  
Actions: `addAsset(asset)`, `addClip(trackId, clip)`, `updateClip(trackId, clipId, patch)`, `removeClip(trackId, clipId)`, `moveClip(trackId, clipId, start)`, `setZoom(pxPerSecond)`

### `selectionSlice`
State: `selectedClipId: string | null`, `selectedTrackId: string | null`, `selectedAssetId: string | null`  
Actions: `selectClip(trackId, clipId)`, `selectAsset(assetId)`, `clearSelection()`

### `playbackSlice`
State: `currentTime: number`, `isPlaying: boolean`  
Actions: `setCurrentTime(t)`, `play()`, `pause()`, `stop()`

### `exportSlice`
State: `status: 'idle' | 'running' | 'done' | 'error'`, `jobId: string | null`, `progress: number`, `error: string | null`  
Actions: `startExport()`, `setExportProgress(n)`, `finishExport()`, `failExport(err)`

---

## Fountain JSON Import Contract

The app accepts a pre-parsed JSON (does **not** parse raw `.fountain` files in MVP):

```json
{
  "title": "Dog Story",
  "panels": [
    {
      "id": "p1",
      "title": "Panel 1",
      "image": "https://cdn.example.com/image1.png",
      "audio": "https://cdn.example.com/audio1.wav",
      "duration": 3.5,
      "act": "Act 1",
      "scene": "Scene 1",
      "sequence": "Sequence A",
      "text": "The dog stares at the robot."
    }
  ]
}
```

**Import Flow** (`importFountain.ts` + `assetFetcher.ts` + Rust `download_asset`):

1. Parse panel list
2. Collect unique image + audio URLs (deduplicate)
3. For each unique URL: call `download_asset` → get `localPath` + `contentHash`
4. Call `probe_media(localPath)` → get dimensions/duration
5. Build `Asset` records with `sourceUrl`, `localPath`, `status: 'ready'`
6. For each panel, create:
   - Image clip on track `V1` at computed start time
   - Audio clip on track `A1` linked to image clip via `linkedClipId`
   - Marker on act/scene/sequence boundary changes
7. Compute sequence duration from end of last clip
8. Rules:
   - If image download fails → skip image clip, log error on asset
   - If audio download fails → still create image clip with no linked audio
   - If `duration` missing → use audio duration if available, else 3.0s fallback
   - Same URL appearing in multiple panels → reuse the same `Asset` record

**UI feedback during import**: show a status panel — total / downloaded / failed — before timeline is generated.

---

## Default Track Layout (new project)

| ID | Name | Kind |
|---|---|---|
| `v1` | Main Images | video |
| `v2` | Inserts | video |
| `a1` | Dialogue | audio |
| `a2` | Music | audio |

---

## Timeline Rendering

- Fixed `pxPerSecond` zoom (start at 100 px/s, adjustable)
- `clip.left = clip.start * pxPerSecond`
- `clip.width = clip.duration * pxPerSecond`
- Utility: `timeToPx(t, pxPerSecond)` / `pxToTime(px, pxPerSecond)`
- Scroll area on the timeline container, ruler stays fixed

---

## Playback Design

- **Video**: at `currentTime`, find the topmost non-muted video track's active clip → display its asset image in `ProgramMonitor`. Show black if none.
- **Audio**: use Web Audio API. On play, schedule each audio clip's source node offset-aligned to clip start. On seek/stop, cancel and reschedule.
- `usePlaybackEngine` drives `currentTime` via `requestAnimationFrame` loop while playing.

---

## Export Pipeline (Rust / ffmpeg)

Staged approach — no clever filter graph merging for MVP:

1. Create temp dir
2. For each image clip in timeline order on V1 (and V2 if visible):
   - `ffmpeg -loop 1 -i <image> -t <duration> -vf scale=W:H,pad=... segment_N.mp4`
3. Concat all video segments with concat demuxer → `video_only.mp4`
4. Build audio mix:
   - For each audio clip: offset by `clip.start`, trim with `inPoint`/`duration`, apply `volume`
   - `ffmpeg -filter_complex amix` → `audio_mix.wav`
5. Mux: `ffmpeg -i video_only.mp4 -i audio_mix.wav -c copy output.mp4`

**MVP simplifications**: no opacity blending between layers, no fades required, one visible image at a time per time range.

---

## Implementation Order

### Phase 1 — Types & Lib
- `src/types/project.ts`, `timeline.ts`, `media.ts`, `export.ts`, `import.ts`
- `src/lib/ids.ts`, `time.ts`, `projectDefaults.ts`

### Phase 2 — Store
- `src/store/useAppStore.ts`
- `src/store/slices/projectSlice.ts`, `timelineSlice.ts`, `selectionSlice.ts`, `playbackSlice.ts`, `exportSlice.ts`

### Phase 3 — UI Shell
- `App.tsx`, `AppShell.tsx`, `LeftPanel`, `RightPanel`, `BottomPanel`
- `ProgramMonitor.tsx`, `TransportBar.tsx`, `InspectorPanel.tsx`
- `TimelineView.tsx`, `TimelineRuler.tsx`, `TimelineTracks.tsx`, `TimelineTrackRow.tsx`, `TimelineClip.tsx`, `Playhead.tsx`

### Phase 4 — Rust Core
- `commands/system.rs` + `services/capability.rs`
- `commands/project.rs` + `services/project_io.rs` + `services/path_resolver.rs`
- `commands/media.rs` + `services/ffprobe.rs` + `services/downloader.rs`

### Phase 5 — Import
- `features/importer/importFountain.ts`
- `features/importer/assetFetcher.ts`
- `components/assets/AssetBin.tsx` + `AssetStatusBadge.tsx`

### Phase 6 — Playback
- `features/playback/usePlaybackEngine.ts`

### Phase 7 — Drag & Edit
- Pointer drag logic in `TimelineClip.tsx` (move + trim right + trim left)
- `clampClipStart`, `clampClipDuration` in `timelineMath.ts`

### Phase 8 — Export
- `commands/export.rs` + `services/ffmpeg.rs`
- `features/export/exportActions.ts`

---

## Out of Scope for MVP

- Ripple/roll/slip editing
- Keyframe motion or opacity animation
- Transitions between clips
- Nested sequences
- Raw Fountain parsing
- Auth / signed URL support
- Global asset cache (shared across projects)
- Relink missing asset
- Waveform thumbnails
- Bundled ffmpeg