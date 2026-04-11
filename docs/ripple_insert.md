

## Plan: Ripple Insert in Zustand Store

Single-track, opt-in ripple. New `rippleInsertClip` action shifts every clip on the same track whose `start >= newClip.start` forward by `newClip.duration`, then inserts the new clip atomically. Surfaced in AssetBin via a local `rippleMode` toggle; all three existing insert buttons branch on it.

---

**Steps**

**Phase 1 — Store only** (no UI changes; verifiable independently)

1. timelineSelectors.ts — add pure selector `getClipsStartingAtOrAfter(track: Track, time: number): Clip[]` — `track.clips.filter(c => c.start >= time)`. Stateless, easily testable.

2. timelineSlice.ts — add action `rippleInsertClip(trackId: string, clip: Clip): void` in a single `set()`:
   - Find active sequence + track (same pattern as existing `addClip`)
   - Map clips: if `c.start >= clip.start` → `{ ...c, start: c.start + clip.duration }`, else unchanged
   - Push the new clip into the shifted array
   - Auto-extend `sequence.duration` to `Math.max(seq.duration, max end time of all clips)`

3. `npx tsc --noEmit` — clean; no UI touched yet.

**Phase 2 — AssetBin UI** (*depends on Phase 1*)

4. AssetBin.tsx:
   - Add `const [rippleMode, setRippleMode] = useState(false)`
   - Pull `rippleInsertClip` from the store alongside `addClip`
   - In the existing `insertClip(start)` helper, branch: `rippleMode ? rippleInsertClip(trackId, clip) : addClip(trackId, clip)` — all three insert buttons automatically respect the toggle since they call `insertClip()`
   - Add a small "Ripple" toggle button on the same row as the duration input (active = accent ring, inactive = muted)

5. `npx tsc --noEmit` — clean.

---

**Relevant files**
- timelineSelectors.ts — add `getClipsStartingAtOrAfter` (reference existing `getTrackEndTime`)
- timelineSlice.ts — add `rippleInsertClip`; use `addClip` as template
- AssetBin.tsx — `rippleMode` toggle + branch in `insertClip()`

**Verification**
1. `npx tsc --noEmit` clean after each phase
2. Ripple OFF → insert at playhead → clips after it unmoved (existing behavior preserved)
3. Ripple ON → insert at playhead → all clips on same track with `start >= playhead` shift right by `insertDuration`
4. Ripple ON → insert after selected → selected's right neighbor and everything after it shifts
5. Ripple ON → append to track → no-op shift (nothing after end), clip added at tail

**Decisions**
- Single-track only: other tracks unaffected
- `addClip` untouched — ripple is purely additive to the store
- `getClipsStartingAtOrAfter` not strictly necessary (logic is simple enough to inline), but added for clarity and future reuse

**Out of scope**
- Multi-track (full-sequence) ripple
- Ripple delete / ripple trim
- Drag-to-ripple on the timeline canvas
- Undo/redo