Here’s the MVP plan I’d actually build.

The goal is not “small Premiere.” The goal is:

**import stills + audio, edit timing on a timeline, add a music bed, export MP4.**

That’s enough to prove the whole product.

---

# MVP definition

## User can:

* create/open/save an animatic project
* import a Fountain-derived JSON file
* see generated image and audio clips on a timeline
* add extra image clips manually
* add a music track across the whole piece
* drag clips left/right
* trim clip durations
* scrub and preview
* export MP4 with ffmpeg

## User cannot yet:

* do advanced transitions
* keyframe motion
* do nested sequences
* do full Premiere-style ripple/roll/slip tools
* edit raw Fountain inside the app

That boundary matters. Keep it tight.

---

# Concrete stack

## App shell

* **Tauri**

## Frontend

* **React**
* **TypeScript**
* **Vite**
* **Zustand**
* **Tailwind** if you want quick layout polish

## Backend side

* **Rust inside Tauri**
* call system **ffmpeg**
* call system **ffprobe**

---

# Folder structure

This is what I’d start with.

```txt
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
      ids.ts
      time.ts
      projectDefaults.ts
      timelineSelectors.ts
      timelineMath.ts

    store/
      useAppStore.ts
      slices/
        projectSlice.ts
        timelineSlice.ts
        selectionSlice.ts
        playbackSlice.ts
        exportSlice.ts

    features/
      project/
        projectActions.ts
      importer/
        importFountain.ts
      playback/
        usePlaybackEngine.ts
      export/
        exportActions.ts

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

  src-tauri/
    Cargo.toml
    tauri.conf.json
    src/
      main.rs
      commands/
        project.rs
        media.rs
        export.rs
        system.rs
      services/
        project_io.rs
        ffmpeg.rs
        ffprobe.rs
        capability.rs
      models/
        project.rs
        media.rs
        export.rs
```

That’s enough structure without disappearing into abstraction hell.

---

# Phase-by-phase MVP plan

## Phase 1: bootstrap the shell

### Outcome

The desktop app launches and shows a 4-panel editor shell.

### Build

* create Tauri app with React + TS
* make static layout:

  * left panel = assets/import
  * center top = monitor
  * right panel = inspector
  * bottom = timeline
* add top toolbar:

  * New
  * Open
  * Save
  * Import Fountain JSON
  * Add Image
  * Add Audio
  * Export

### Rust commands

Create these first:

* `check_ffmpeg`
* `check_ffprobe`
* `open_file_dialog`
* `save_file_dialog`

### Frontend files to create first

* `App.tsx`
* `components/layout/AppShell.tsx`
* `components/monitor/ProgramMonitor.tsx`
* `components/timeline/TimelineView.tsx`
* `components/inspector/InspectorPanel.tsx`
* `components/assets/AssetBin.tsx`
* `components/transport/TransportBar.tsx`

### Definition of done

* app launches
* layout is stable
* ffmpeg/ffprobe check can run
* missing ffmpeg shows a warning banner

---

## Phase 2: lock the project model

### Outcome

You can create a project in memory and save/load JSON.

### Types to create

## `src/types/project.ts`

```ts
export type Project = {
  version: number
  id: string
  name: string
  filePath?: string
  createdAt: string
  updatedAt: string
  sourceScript?: SourceScript
  assets: Asset[]
  sequences: Sequence[]
  activeSequenceId: string
  exportSettings: ExportSettings
}

export type SourceScript = {
  kind: 'fountain-import'
  path?: string
  importedAt?: string
}
```

## `src/types/media.ts`

```ts
export type Asset = {
  id: string
  type: 'image' | 'audio'
  path: string
  name: string
  duration?: number
  width?: number
  height?: number
  sampleRate?: number
  channels?: number
}
```

## `src/types/timeline.ts`

```ts
export type Sequence = {
  id: string
  name: string
  duration: number
  tracks: Track[]
  markers: Marker[]
}

export type Track = {
  id: string
  name: string
  kind: 'video' | 'audio'
  muted: boolean
  locked: boolean
  clips: Clip[]
}

export type Clip = {
  id: string
  assetId?: string
  type: 'image' | 'audio' | 'gap'
  start: number
  duration: number
  inPoint: number
  label?: string
  volume?: number
  linkedClipId?: string
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

export type Marker = {
  id: string
  time: number
  label: string
}
```

## `src/types/export.ts`

```ts
export type ExportSettings = {
  width: number
  height: number
  fps: number
  videoCodec: 'h264'
  audioCodec: 'aac'
}
```

### Rust commands

* `new_project`
* `save_project`
* `open_project`

### Store slices

* `projectSlice`
* `timelineSlice`
* `selectionSlice`

### Definition of done

* user can create blank project
* save JSON to disk
* reopen JSON from disk
* active sequence loads properly

---

## Phase 3: basic timeline rendering

### Outcome

Timeline shows tracks and clips visually.

### Build

* fixed px-per-second scale at first
* render ruler
* render track rows
* render clips by:

  * `left = start * pxPerSecond`
  * `width = duration * pxPerSecond`

### Initial timeline

When new project is created, seed:

* V1 Main Images
* V2 Inserts
* A1 Dialogue
* A2 Music

### Components

* `TimelineView`
* `TimelineRuler`
* `TimelineTracks`
* `TimelineTrackRow`
* `TimelineClip`
* `Playhead`

### Utility functions

* `timeToPx`
* `pxToTime`
* `getSequenceById`
* `getTrackById`
* `getClipById`

### Definition of done

* blank project shows tracks
* fake clips can be rendered
* playhead visible
* timeline scroll area works

---

## Phase 4: selection + inspector

### Outcome

Clicking clips selects them and inspector edits their properties.

### Build

Selection state:

* selected clip id
* selected track id
* selected asset id optional

Inspector can edit:

* label
* start
* duration
* inPoint
* volume for audio
* scale/x/y for image
* fadeIn/fadeOut fields can exist but do nothing yet if needed

### Store slice

* `selectionSlice`

### Key actions

* `selectClip(clipId, trackId)`
* `updateClip(clipId, patch)`

### Definition of done

* clicking clip highlights it
* inspector populates
* changing duration updates timeline visually
* changing label reflects immediately

---

## Phase 5: drag and trim editing

### Outcome

You can move clips and trim durations with mouse drag.

### Build first

Only support:

* drag clip horizontally
* trim right edge
* trim left edge

Do not support overlap logic beyond basic constraints yet. Just prevent negative time/duration.

### Editing rules for MVP

* no automatic ripple
* no auto snapping initially, or only optional basic snap to playhead/clip edges
* allow overlap for now if needed, but ideally warn visually
* tracks are independent

### State during drag

Keep transient drag state local to timeline component, then commit on pointer up.

### Needed utilities

* `clampClipDuration`
* `clampClipStart`
* `snapTime` later

### Definition of done

* user drags clip left/right
* user trims duration
* timeline re-renders smoothly
* inspector reflects updated values

---

## Phase 6: asset import

### Outcome

User can add images and audio from disk.

### Rust commands

* `open_file_dialog` with file filters
* `probe_media(path)`

### `probe_media` returns:

For image:

* width
* height

For audio:

* duration
* sampleRate
* channels

### Frontend flow

* Add Image → choose file → probe → add asset
* Add Audio → choose file → probe → add asset

### Asset bin

Display:

* asset name
* type
* duration for audio
* maybe dimensions for images

### Extra MVP action

* drag asset from bin to track
  or simpler:
* “Insert on selected track at playhead”

I would do **Insert on selected track at playhead** first. Drag from bin can come later.

### Definition of done

* imported assets appear in bin
* can create clip from selected asset
* audio asset creates audio clip
* image asset creates image clip

---

## Phase 7: Fountain JSON import

### Outcome

You can import a parsed Fountain payload and generate a first cut.

### Input format

Don’t make the animatic app parse raw Fountain yet. Import a clean JSON.

Example:

```json
{
  "title": "Dog Story",
  "panels": [
    {
      "id": "p1",
      "title": "Panel 1",
      "image": "/path/to/image1.png",
      "audio": "/path/to/audio1.wav",
      "duration": 3.5,
      "act": "Act 1",
      "scene": "Scene 1",
      "sequence": "Sequence A",
      "text": "The dog stares at the robot."
    }
  ]
}
```

### Frontend importer

Create:

* `features/importer/importFountain.ts`

Responsibilities:

* register assets
* create image clips on V1
* create audio clips on A1
* link paired image/audio clips via `linkedClipId`
* create markers for act/scene/sequence changes
* compute sequence duration from end of last clip

### Rules

* if image missing, skip image clip
* if audio missing, still create image clip
* if duration missing:

  * use audio duration if present
  * otherwise fallback to something like 3 seconds

### Definition of done

* import JSON works
* timeline populates automatically
* markers appear
* imported sequence plays as a rough cut

---

## Phase 8: playback

### Outcome

User can scrub and play the timeline.

### MVP playback design

This is enough:

#### Video preview

At current time:

* find active image clip on highest priority visible video track
* display that image in monitor
* if none, show black

#### Audio preview

Use Web Audio API if you can.
At minimum:

* on play, schedule overlapping audio clips
* on stop, stop all
* on seek, restart audio from current time

### Needed store state

* `currentTime`
* `isPlaying`
* `playbackRate` maybe fixed at 1
* `playRange` optional later

### Components

* `TransportBar`

  * play/pause
  * stop
  * current time display
  * maybe zoom buttons

### Feature hook

* `features/playback/usePlaybackEngine.ts`

### Definition of done

* click in ruler to move playhead
* play advances playhead
* monitor updates
* audio clips are audible
* stop resets or pauses cleanly

---

## Phase 9: music bed support

### Outcome

User can add a music track across the whole animatic.

### MVP behavior

* imported or added music asset gets placed on A2 Music
* user can stretch or trim it
* volume adjustable in inspector
* playback mixes dialogue + music
* export mixes both

This is one of the main product-defining features, so get it in early.

### Definition of done

* add music track
* hear it during playback
* trim/move it
* volume control works

---

## Phase 10: export MP4

### Outcome

The app exports a real MP4 using ffmpeg.

This is the moment the app becomes useful.

### Rust commands

* `start_export(project, outputPath)`
* `get_export_progress(jobId)` optional
* `cancel_export(jobId)` optional later

### Export strategy for MVP

Do not try to be clever. Do a staged pipeline.

#### Step 1

Create temp dir.

#### Step 2

For each visible image clip in timeline order on main output logic:

* create short video segment from still image
* duration = clip duration
* scale/pad to export resolution
* output segment file

#### Step 3

Concat those video segments.

#### Step 4

Build audio mix:

* for each audio clip:

  * offset by clip start
  * trim with inPoint/duration if needed
  * apply volume
* mix dialogue/music into one audio render

#### Step 5

Mux final video + mixed audio into MP4.

### Practical MVP simplification

For the first export pass, support:

* one visible image at a time
* no opacity blending between layered images
* no fades required yet
* audio clips can overlap and mix

That is enough.

### Definition of done

* user exports mp4
* output plays in VLC/mpv
* timing broadly matches preview
* missing ffmpeg gives a clear error

---

# Order of implementation by file

If I were literally coding this, I’d do it in this order.

## Step 1

* `src/types/project.ts`
* `src/types/timeline.ts`
* `src/types/media.ts`
* `src/types/export.ts`

## Step 2

* `src/lib/projectDefaults.ts`
* `src/lib/ids.ts`
* `src/lib/time.ts`

## Step 3

* `src/store/useAppStore.ts`
* `src/store/slices/projectSlice.ts`
* `src/store/slices/timelineSlice.ts`
* `src/store/slices/selectionSlice.ts`

## Step 4

* `src/components/layout/AppShell.tsx`
* `src/components/timeline/TimelineView.tsx`
* `src/components/timeline/TimelineTrackRow.tsx`
* `src/components/timeline/TimelineClip.tsx`

## Step 5

* `src/components/inspector/InspectorPanel.tsx`
* `src/components/transport/TransportBar.tsx`
* `src/components/monitor/ProgramMonitor.tsx`

## Step 6

Rust:

* `src-tauri/src/commands/system.rs`
* `src-tauri/src/commands/project.rs`
* `src-tauri/src/services/project_io.rs`

## Step 7

Rust:

* `src-tauri/src/commands/media.rs`
* `src-tauri/src/services/ffprobe.rs`
* `src-tauri/src/services/capability.rs`

## Step 8

* `src/features/importer/importFountain.ts`
* `src/components/assets/AssetBin.tsx`

## Step 9

* `src/features/playback/usePlaybackEngine.ts`

## Step 10

Rust:

* `src-tauri/src/commands/export.rs`
* `src-tauri/src/services/ffmpeg.rs`

That sequence keeps each step testable.

---

# Store slices

Here’s how I’d split them.

## `projectSlice`

Owns:

* current project
* file path
* dirty state

Actions:

* `newProject()`
* `setProject(project)`
* `updateProjectMeta(patch)`
* `markDirty(boolean)`

## `timelineSlice`

Owns:

* active sequence id
* zoom level
* track and clip mutations

Actions:

* `addAsset(asset)`
* `addClip(trackId, clip)`
* `updateClip(trackId, clipId, patch)`
* `removeClip(trackId, clipId)`
* `moveClip(trackId, clipId, start)`
* `setZoom(pxPerSecond)`

## `selectionSlice`

Owns:

* selected clip id
* selected track id
* selected asset id

Actions:

* `selectClip(trackId, clipId)`
* `selectAsset(assetId)`
* `clearSelection()`

## `playbackSlice`

Owns:

* `currentTime`
* `isPlaying`

Actions:

* `setCurrentTime(t)`
* `play()`
* `pause()`
* `stop()`

## `exportSlice`

Owns:

* export status
* current job id
* progress
* error

Actions:

* `startExport()`
* `setExportProgress()`
* `finishExport()`
* `failExport()`

---

# Minimal UI layout

## Left panel

Top buttons:

* Import Fountain JSON
* Add Image
* Add Audio

Below:

* asset list

## Center top

* preview monitor
* maybe current frame/time overlay

## Right panel

* inspector for selected clip

## Bottom

* transport bar
* timeline ruler
* tracks

That’s all you need.

---

# Concrete MVP track setup

Use these exact four tracks at first:

* **V1 Main**
* **V2 Inserts**
* **A1 Dialogue**
* **A2 Music**

You can add SFX later. Don’t add extra tracks until the first four are working.

---

# Concrete import behavior

When importing Fountain JSON:

For each panel:

* if `image` exists, create asset if not already present
* if `audio` exists, create asset if not already present
* determine `panelDuration`:

  * explicit duration
  * else audio duration
  * else 3 seconds
* create image clip on V1 at `cursorTime`
* create audio clip on A1 at `cursorTime`
* link them
* if section changed, create marker
* `cursorTime += panelDuration`

This gives you the rough cut instantly.

---

# Export expectations for v1

Keep export rules brutally simple:

* output resolution fixed at 1920x1080 by default
* fps fixed at 24
* still images fill frame with contain or cover mode, pick one
* no animated transforms yet
* audio mixed with volume
* final codec:

  * H.264 video
  * AAC audio

That is enough to make a useful animatic file.

---

# What to postpone on purpose

Do not touch these in MVP:

* transitions UI
* waveform rendering
* fancy snapping
* multi-sequence editing
* pan/zoom keyframes
* auto relink of moved files
* raw Fountain text editing
* project collaboration
* subtitles

They’re all real features, but they will derail the MVP.

---

# Best first milestone to aim for

The first “holy shit, this is real” milestone is:

**Import Fountain JSON → generated clips appear → hit play → hear dialogue and music → export MP4**

That is the proof.

Not fancy UI. Not drag-drop perfection. That loop.

---

# My blunt recommendation for week 1

If you want the fastest possible path:

## Day 1–2

* Tauri shell
* app layout
* project model
* blank timeline

## Day 3–4

* clip rendering
* selection
* inspector editing
* add image/audio assets manually

## Day 5–6

* Fountain JSON import
* playback monitor
* crude audio preview

## Day 7+

* ffmpeg export

That is aggressive but realistic for an MVP skeleton.

---

# The first three tickets I’d write

## Ticket 1: Boot project shell

Build Tauri app with editor layout, Zustand store, blank project, and static tracks.

## Ticket 2: Render editable timeline

Render clips from project state, support selection, inspector editing, and drag/trim.

## Ticket 3: Import Fountain JSON

Convert panel JSON into assets, markers, and clips on V1/A1.

Those three get you out of planning mode and into product mode.

If you want, next I can turn this into a **real starter scaffold** with exact TypeScript interfaces, Zustand slice code, and the first Tauri command stubs.
