Yes. Requiring system `ffmpeg` is a good call for an MVP.

Bundling sounds nice, but it adds packaging friction immediately. For a Linux-first tool you’re building for yourself, “install ffmpeg first” is totally reasonable. Later, if you want broader distribution, you can revisit sidecars or guided install checks.

Here’s the stack I’d sketch.

## High-level shape

**Tauri desktop shell**

- native file access
- commands to Rust backend
- app menus, open/save dialogs, config dirs

**React + TypeScript frontend**

- timeline UI
- preview monitor
- inspector
- asset bin
- transport controls

**Rust core inside Tauri**

- project persistence
- media probing
- timeline calculations helpers
- export orchestration
- ffmpeg invocation
- background jobs / progress reporting

**System ffmpeg / ffprobe**

- media metadata
- waveform thumbnails later
- final render/export

That gives you:

- fast UI iteration in web tech
- desktop behavior where it matters
- local rendering/export
- no server required

------

## Recommended frontend stack

I’d use:

- **React**
- **TypeScript**
- **Vite**
- **Zustand** for app state
- **TanStack Query** only if you need async command caching, otherwise skip
- **React Router** only if you want multiple major app screens
- **Tailwind** if you want fast UI polish
- **dnd-kit** or custom pointer logic for timeline dragging
- **wavesurfer.js** later if you want waveform rendering

For your app, I would keep dependencies tight. Timeline apps get messy fast. Too many generic UI libs start fighting you.

## Recommended Tauri/Rust side

Use Rust for the things that should be deterministic and local:

- loading/saving project JSON
- checking whether assets exist
- resolving relative paths
- calling `ffprobe`
- calling `ffmpeg`
- returning export progress
- maybe generating thumbnails later

Do **not** overbuild the Rust side at first. It does not need to be a giant engine yet.

Think of Rust initially as:

- file system bridge
- process runner
- validator
- metadata service

------

## App architecture

I’d split it into five main domains.

### 1. Project domain

Owns the saved project file.

```tsx
type Project = {
  version: number
  id: string
  name: string
  createdAt: string
  updatedAt: string
  sourceScript?: SourceScript
  assets: Asset[]
  sequences: Sequence[]
  activeSequenceId: string
  exportSettings: ExportSettings
}
```

This is the real source of truth once the timeline exists.

### 2. Import domain

Takes Fountain-derived data and generates timeline clips.

Input:

- parsed panels
- image refs
- audio refs
- durations
- script hierarchy

Output:

- assets
- initial sequence
- markers
- generated clips

This should be a one-time generator, not a permanent master.

### 3. Timeline domain

Owns tracks, clips, time math, selection, playback ranges, ripple behavior later.

### 4. Playback domain

Owns:

- play/pause
- current time
- active clips at current time
- preview image selection
- audio playback sync

### 5. Export domain

Compiles project timeline into render instructions and invokes ffmpeg.

------

## Suggested project structure

Something like this:

```
animatic-editor/
  src/
    app/
      store/
      routes/
      providers/
    features/
      project/
      importer/
      timeline/
      playback/
      export/
      assets/
      inspector/
    components/
      timeline/
      monitor/
      transport/
      layout/
      ui/
    lib/
      time.ts
      ids.ts
      geometry.ts
      validation.ts
    types/
      project.ts
      timeline.ts
      media.ts
  src-tauri/
    src/
      main.rs
      commands/
        project.rs
        media.rs
        export.rs
        system.rs
      services/
        ffmpeg.rs
        ffprobe.rs
        project_io.rs
        path_resolver.rs
      models/
        project.rs
        media.rs
        export.rs
```

That is enough structure without turning into enterprise soup.

------

## Core data model

This is the important part.

### Assets

```tsx
type Asset = {
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

Use file paths, not blobs, since this is desktop.

### Sequence

```tsx
type Sequence = {
  id: string
  name: string
  duration: number
  tracks: Track[]
  markers: Marker[]
}
```

### Track

```tsx
type Track = {
  id: string
  name: string
  kind: 'video' | 'audio'
  locked: boolean
  muted: boolean
  height?: number
  clips: Clip[]
}
```

### Clip

```tsx
type Clip = {
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
```

That gives you room to grow without overcomplicating v1.

### Export settings

```tsx
type ExportSettings = {
  width: number
  height: number
  fps: number
  videoCodec: 'h264'
  audioCodec: 'aac'
  outputPath?: string
}
```

Keep export presets minimal at first.

------

## Timeline UI layout

I’d use a 4-panel layout.

### Left: Asset / script bin

- imported assets
- button to add image
- button to add audio
- maybe script markers or scene list

### Center top: Program monitor

- current frame display
- maybe black background and letterboxing
- title safe later if wanted

### Right: Inspector

- selected clip properties
- duration
- start time
- in point
- volume
- scale/position
- fade

### Bottom: Timeline

- ruler
- playhead
- V1, V2
- A1 dialogue
- A2 effects
- A3 music

That’s the correct starting UI.

------

## Timeline behavior for MVP

Do not start with full NLE behavior. Start with the behaviors you actually need.

### Must have

- click to select clip
- drag clip left/right
- drag clip edge to trim duration
- zoom timeline
- scrub playhead
- insert image clip
- add audio clip
- music track spanning sequence
- delete clip
- duplicate clip

### Can wait

- ripple edits
- slip/slide tools
- crossfades
- nested sequences
- linked selection sophistication
- track targeting
- J/L cuts UI niceties

You do not need to become Premiere in version one.

------

## Playback engine

This is where a lot of people overcomplicate things.

For your first version:

### Video preview

At any current timeline time:

- find topmost visible image clip under playhead
- render that image in the monitor
- apply simple transform if present

Since this is an animatic, stills are easy.

### Audio playback

For MVP, use browser audio for preview:

- preload asset URLs through Tauri path access
- when playback starts, calculate which audio clips overlap current time
- start them with correct offsets
- stop when needed

It won’t be perfect-perfect at first, but good enough for animatic editorial work.

Later, if needed, move more preview mixing logic into Web Audio.

### Recommendation

Use **Web Audio API** for the serious preview path once you add more than one simultaneous audio layer. It gives you:

- gain control
- timing offsets
- better track mixing
- future fades

So:

- simple HTMLAudio if you need super fast proof of concept
- Web Audio once MVP feels real

------

## Fountain import path

You already have a parser world from your writer app. Reuse the logic conceptually, but don’t couple the apps too tightly.

I’d define a clean import payload like:

```tsx
type FountainImport = {
  title?: string
  panels: {
    id: string
    title: string
    image?: string
    audio?: string
    duration?: number
    act?: string
    scene?: string
    sequence?: string
    text?: string
  }[]
}
```

Then the animatic app turns that into:

- image assets
- audio assets
- V1 clips
- A1 dialogue clips
- markers

That keeps the animatic app independent of raw Fountain parser internals.

------

## Rust commands I’d create first

### Project commands

- `new_project`
- `open_project`
- `save_project`
- `save_project_as`

### Media commands

- `probe_media(path)`
- `check_ffmpeg()`
- `check_ffprobe()`
- `resolve_asset_paths(project_path, asset_paths)`

### Export commands

- `start_export(project, output_path)`
- `get_export_progress(job_id)`
- `cancel_export(job_id)`

### System commands

- `open_file_dialog`
- `open_save_dialog`

That’s enough for a real app.

------

## ffmpeg strategy

Do not try to generate one giant insane command on day one unless you love pain.

A cleaner plan:

### Export pipeline v1

1. Build a temporary working directory
2. Generate per-image video segments from still clips
3. Concatenate video segments
4. Build audio filter graph for all audio clips
5. Mux final video + mixed audio
6. Clean temp files

That’s easier to reason about and debug than one mega filter graph.

### Example mental model

For each image clip:

- loop image for `duration`
- scale/pad to output size
- encode segment

For audio:

- trim source if needed
- delay to clip start
- apply volume
- mix all audio tracks

Then:

- concat video segments
- combine with mixed audio
- output mp4

It may be a little less elegant than a single-pass pipeline, but it is much easier to ship.

Later you can optimize.

------

## ffprobe usage

Since you’re requiring installed ffmpeg anyway, require `ffprobe` too.

Use it for:

- image dimensions
- audio duration
- sample rate / channels
- validation before export

On app launch, do a capability check:

- can we find `ffmpeg`
- can we find `ffprobe`

If not, show a clear settings/error panel.

That should be one of the first things the app checks.

------

## State management

I would use **Zustand** with separate slices.

Example slices:

- `projectSlice`
- `timelineSlice`
- `selectionSlice`
- `playbackSlice`
- `exportSlice`

Why:

- simpler than Redux
- works well for interaction-heavy editor state
- easy to keep selectors narrow

Be disciplined about derived state. Don’t store everything twice.

Examples of derived state:

- active clips under playhead
- selected sequence
- visible timeline range
- current preview frame asset

Those should usually be selectors, not duplicated state.

------

## Undo/redo

You’ll want it sooner than you think.

For MVP, use snapshot-based undo for project/timeline mutations:

- keep a bounded history stack
- push on meaningful edit actions
- ignore transient hover/drag events until commit

Do not start with event sourcing. Totally unnecessary.

------

## Persistence format

Use JSON project files.

Example:

```json
{
  "version": 1,
  "id": "proj_123",
  "name": "Dog Story Animatic",
  "sourceScript": {
    "kind": "fountain-import",
    "path": "/home/rishi/scripts/dog-story.fountain"
  },
  "assets": [],
  "sequences": [],
  "activeSequenceId": "seq_1",
  "exportSettings": {
    "width": 1920,
    "height": 1080,
    "fps": 24,
    "videoCodec": "h264",
    "audioCodec": "aac"
  }
}
```

Store asset paths relative to the project file when possible. That makes moving folders saner.

------

## What I would avoid

A few traps:

### 1. Don’t make the script the live master forever

Import it, reference it, maybe regenerate from it. But the timeline project must stand on its own.

### 2. Don’t start with a giant component

Timeline editors become monsters fast. Separate ruler, track list, clip layer, playhead overlay, inspector.

### 3. Don’t overdo clip transforms initially

For v1, image fit modes and maybe simple scale/position are enough.

### 4. Don’t overpromise real-time perfect AV sync in the first preview build

Good enough preview is okay. Export accuracy matters more.

### 5. Don’t build your own codec/render engine

Let ffmpeg do the ugly work.

------

## MVP milestone plan

### Milestone 1: shell

- Tauri app boots
- open/save project
- check for ffmpeg/ffprobe
- basic layout

### Milestone 2: timeline foundation

- project data model
- tracks/clips rendering
- selection
- dragging
- trim handles
- zoom

### Milestone 3: playback

- playhead
- preview monitor
- still image display
- audio preview
- transport controls

### Milestone 4: import

- import Fountain-derived JSON
- auto-generate sequence
- create markers
- dialogue + image clips

### Milestone 5: editing

- add image clip manually
- add audio manually
- music bed track
- inspector edits
- delete/duplicate

### Milestone 6: export

- ffprobe validation
- ffmpeg render pipeline
- progress UI
- mp4 output

That’s a real product.

------

## My blunt recommendation on tech choices

If I were locking this in today, I’d do:

- **Tauri**
- **React**
- **TypeScript**
- **Vite**
- **Zustand**
- **Tailwind**
- **Rust commands for IO/export**
- **system ffmpeg/ffprobe**
- **JSON project files**

That is the cleanest balance of:

- speed
- maintainability
- desktop usefulness
- future export power

------

## Nice later additions

Once the core works, these would be genuinely valuable:

- waveform display for audio clips
- image pan/zoom keyframes
- fades and dissolves
- subtitles/captions from script
- multi-sequence projects
- marker navigation
- script panel relink/reimport
- export presets for reels/social
- proxy preview for giant assets

But none of that is needed before the basic editorial loop exists.

## The key design principle

This app should think in:

**assets → tracks → clips → time → export**

not

**panels → current panel → next panel**

That is the leap.

If you want, next I can turn this into a concrete folder-level MVP plan with actual file names, store slices, and the first Tauri commands to implement.