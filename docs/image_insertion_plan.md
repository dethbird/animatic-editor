# Plan: Image Insertion Modes + URL Add Image

## TL;DR

Add three intent-based image insertion modes (Insert at Playhead, Insert After Selected, Append to Track) to the AssetBin panel, with a per-insert duration input for controlling how long each manually-inserted still holds (key for motion frames in an animatic). Also extend image adding to support URL sources via an inline toolbar input. Overlaps allowed (no ripple). Target track = currently selected track.

---

## Phase 1: Add Image via URL (Toolbar)

### Step 1 — Inline URL input in `src/components/layout/Toolbar.tsx`

- Add `showUrlInput` / `imageUrl` local state (same pattern as the existing `showNewInput` / `newProjectName` for new projects)
- New **"Add Image URL"** toolbar button toggles an inline bar with text input + Add/Cancel
- On submit:
  1. Call existing `download_asset` Tauri command → downloads to `media/` folder
  2. Call `probe_media` → get width/height
  3. Call `addAsset(...)` with `sourceUrl`, `localPath`, `status: "ready"`, dimensions
- On error: `notify(...)` with error message
- Existing "Add Image" button stays as-is for local filesystem files

---

## Phase 2: Three Insertion Modes (AssetBin)

### Step 2 — Add `getTrackEndTime` helper in `src/lib/timelineSelectors.ts`

- `getTrackEndTime(track: Track): number` → returns `Math.max(0, ...clips.map(c => c.start + c.duration))`, or 0 for empty tracks

### Step 3 — Add duration input to the insert toolbar in `src/components/assets/AssetBin.tsx`

- Add `insertDuration` local state, default **0.5s** (a reasonable single motion frame hold)
- Render a small numeric input labeled "Dur (s)" alongside the insert buttons
- Valid range: **0.04s** (1 frame at 24 fps) to **30s** — clamp on blur, not on every keystroke
- All three insert modes use `insertDuration` as the clip duration instead of `selectedAsset.duration ?? DEFAULT_CLIP_DURATION_FALLBACK`
- The asset's own `duration` (from fountain import) is intentionally ignored here — manual inserts are motion frames, not panel holds

### Step 4 — Wire up buttons in `src/components/assets/AssetBin.tsx`

- **Insert at Playhead** — update existing handler to use `insertDuration`
- **Insert After Selected** *(new)* — enabled when `selectedClipId` + `selectedTrackId` are set AND an asset is selected + ready. Computes `start = selectedClip.start + selectedClip.duration`
- **Append to Track** *(new)* — enabled when `selectedTrackId` is set AND asset is ready. Uses `getTrackEndTime(track)` as the start time

### Step 5 — Auto-select new clip after insertion

- After each insertion, call `selectClip(trackId, newClip.id)` — enables chaining "Insert After Selected" repeatedly without re-selecting

---

## Relevant Files

| File | Change |
|------|--------|
| `src/components/layout/Toolbar.tsx` | URL input bar + `handleAddImageUrl` handler |
| `src/lib/timelineSelectors.ts` | Add `getTrackEndTime` helper |
| `src/components/assets/AssetBin.tsx` | Duration input, 2 new buttons, updated insert handler, auto-select after insert |

---

## Verification

1. `npx tsc --noEmit` — clean compile
2. **Add Image URL**: enter a remote image URL → downloads to `media/` → appears in bin as "ready" with dimensions
3. **Duration input**: set to 0.5s, insert a clip → clip is exactly 0.5s on timeline; set to 0.04s (min) and 30s (max), verify clamping
4. **Insert at Playhead**: select asset + click track → clip appears at playhead position using `insertDuration`
5. **Insert After Selected**: select asset + select existing clip → new clip placed immediately after, no gap, duration = `insertDuration`
6. **Append to Track**: select asset + select track → clip placed at end of track, duration = `insertDuration`
7. **Chaining** (primary animatic workflow): set dur to 0.5s, select a panel still on V1, click "Insert After Selected" → motion frame appears; it's now auto-selected → click again to chain another → repeat quickly to build a multi-frame hold from one still

---

## Decisions

- **Overlap allowed** (no ripple insert) — MVP simplicity
- **Target track** = currently selected track (must click a track)
- **URL input** = inline toolbar bar (not a modal)
- Existing **"Add Image"** stays for filesystem; **"Add Image URL"** is a separate button
- **insertDuration default = 0.5s** — short enough to read as a motion beat, long enough to see on the timeline; user can adjust per session
- **insertDuration ignores asset.duration** — fountain panel durations are for panel holds; manual inserts are motion frames with independent timing
- **insertDuration is not persisted** — resets to 0.5s on reload; it's a session-level editing preference
- **Scope excludes:** ripple insert, drag-and-drop, auto-track-targeting, audio URL add