import { useRef } from "react";
import { useAppStore } from "../../store/useAppStore";
import { timeToPx, pxToTime } from "../../lib/time";
import { clampClipStart, clampClipDuration } from "../../lib/timelineMath";
import type { Clip } from "../../types/timeline";
import { DEFAULT_FPS } from "../../lib/projectDefaults";

interface TimelineClipProps {
  clip: Clip;
  trackId: string;
  pxPerSecond: number;
  /** Reserved for future use (e.g. variable track heights). */
  trackHeight: number;
}

const CLIP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  image: { bg: "bg-blue-900/70", border: "border-blue-700", text: "text-blue-200" },
  audio: { bg: "bg-green-900/70", border: "border-green-700", text: "text-green-200" },
  gap:   { bg: "bg-zinc-800/40", border: "border-zinc-700",  text: "text-zinc-500" },
};

const TRIM_HANDLE_WIDTH = 6; // px

/**
 * TimelineClip — a draggable, trimmable clip block on the timeline.
 *
 * Supports:
 *  - drag body: move clip left/right
 *  - drag left edge: trim start (adjusts `start` and `inPoint`)
 *  - drag right edge: trim end (adjusts `duration`)
 *
 * All transient drag state is local; the store is updated on pointer up.
 */
export default function TimelineClip({
  clip,
  trackId,
  pxPerSecond,
  trackHeight: _trackHeight,
}: TimelineClipProps) {
  const selectClip = useAppStore((s) => s.selectClip);
  const moveClip = useAppStore((s) => s.moveClip);
  const updateClip = useAppStore((s) => s.updateClip);
  const selectedClipId = useAppStore((s) => s.selectedClipId);

  const isSelected = selectedClipId === clip.id;
  const colors = CLIP_COLORS[clip.type] ?? CLIP_COLORS.gap;

  const left = timeToPx(clip.start, pxPerSecond);
  const width = timeToPx(clip.duration, pxPerSecond);

  // Refs to track drag state without re-renders
  const dragState = useRef<{
    mode: "move" | "trim-left" | "trim-right";
    startX: number;
    origStart: number;
    origDuration: number;
    origInPoint: number;
  } | null>(null);

  const onPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    mode: "move" | "trim-left" | "trim-right",
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    selectClip(trackId, clip.id);
    dragState.current = {
      mode,
      startX: e.clientX,
      origStart: clip.start,
      origDuration: clip.duration,
      origInPoint: clip.inPoint,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state) return;

    const dx = e.clientX - state.startX;
    const dt = pxToTime(dx, pxPerSecond);

    if (state.mode === "move") {
      const newStart = clampClipStart(state.origStart + dt);
      // Apply visually via CSS; commit on pointer up
      (e.currentTarget as HTMLElement).style.left = `${timeToPx(newStart, pxPerSecond)}px`;

    } else if (state.mode === "trim-right") {
      const newDuration = clampClipDuration(state.origDuration + dt, DEFAULT_FPS);
      (e.currentTarget.parentElement as HTMLElement).style.width = `${timeToPx(newDuration, pxPerSecond)}px`;

    } else if (state.mode === "trim-left") {
      const maxTrim = state.origDuration - 1 / DEFAULT_FPS;
      const trimDt = Math.min(dt, maxTrim);
      const newStart = clampClipStart(state.origStart + trimDt);
      const newDuration = clampClipDuration(state.origDuration - trimDt, DEFAULT_FPS);
      const el = e.currentTarget.parentElement as HTMLElement;
      el.style.left = `${timeToPx(newStart, pxPerSecond)}px`;
      el.style.width = `${timeToPx(newDuration, pxPerSecond)}px`;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state) return;
    dragState.current = null;

    const dx = e.clientX - state.startX;
    const dt = pxToTime(dx, pxPerSecond);

    if (state.mode === "move") {
      moveClip(trackId, clip.id, clampClipStart(state.origStart + dt));
    } else if (state.mode === "trim-right") {
      updateClip(trackId, clip.id, {
        duration: clampClipDuration(state.origDuration + dt, DEFAULT_FPS),
      });
    } else if (state.mode === "trim-left") {
      const maxTrim = state.origDuration - 1 / DEFAULT_FPS;
      const trimDt = Math.min(dt, maxTrim);
      updateClip(trackId, clip.id, {
        start: clampClipStart(state.origStart + trimDt),
        duration: clampClipDuration(state.origDuration - trimDt, DEFAULT_FPS),
        inPoint: Math.max(0, state.origInPoint + trimDt),
      });
    }

    // Reset inline styles — store update will re-render from correct values
    const el = (e.currentTarget.tagName === "DIV"
      ? e.currentTarget
      : e.currentTarget.parentElement) as HTMLElement;
    el.style.left = "";
    el.style.width = "";
  };

  return (
    <div
      className={[
        "absolute top-1 bottom-1 rounded border select-none overflow-hidden",
        colors.bg,
        colors.border,
        isSelected ? "ring-1 ring-white/60" : "",
      ].join(" ")}
      style={{ left, width }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 cursor-w-resize z-10 hover:bg-white/10"
        style={{ width: TRIM_HANDLE_WIDTH }}
        onPointerDown={(e) => onPointerDown(e, "trim-left")}
      />

      {/* Body — drag to move */}
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing flex items-center px-2"
        style={{ left: TRIM_HANDLE_WIDTH, right: TRIM_HANDLE_WIDTH }}
        onPointerDown={(e) => onPointerDown(e, "move")}
      >
        <span className={`text-[10px] truncate ${colors.text}`}>
          {clip.label ?? clip.type}
        </span>
      </div>

      {/* Right trim handle */}
      <div
        className="absolute right-0 top-0 bottom-0 cursor-e-resize z-10 hover:bg-white/10"
        style={{ width: TRIM_HANDLE_WIDTH }}
        onPointerDown={(e) => onPointerDown(e, "trim-right")}
      />
    </div>
  );
}
