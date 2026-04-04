import { useAppStore } from "../../store/useAppStore";
import { timeToPx } from "../../lib/time";
import type { Clip } from "../../types/timeline";

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

const TRIM_HANDLE_WIDTH = 6; // px, visual only for now

export default function TimelineClip({
  clip,
  trackId,
  pxPerSecond,
  trackHeight: _trackHeight,
}: TimelineClipProps) {
  const selectClip = useAppStore((s) => s.selectClip);
  const selectedClipId = useAppStore((s) => s.selectedClipId);

  const isSelected = selectedClipId === clip.id;
  const colors = CLIP_COLORS[clip.type] ?? CLIP_COLORS.gap;

  const left = timeToPx(clip.start, pxPerSecond);
  const width = timeToPx(clip.duration, pxPerSecond);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    selectClip(trackId, clip.id);
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
      onPointerDown={handlePointerDown}
    >
      {/* Left trim handle (visual only) */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10"
        style={{ width: TRIM_HANDLE_WIDTH }}
      />

      {/* Body */}
      <div
        className="absolute inset-0 flex items-center px-2"
        style={{ left: TRIM_HANDLE_WIDTH, right: TRIM_HANDLE_WIDTH }}
      >
        <span className={`text-[10px] truncate ${colors.text}`}>
          {clip.label ?? clip.type}
        </span>
      </div>

      {/* Right trim handle (visual only) */}
      <div
        className="absolute right-0 top-0 bottom-0 z-10"
        style={{ width: TRIM_HANDLE_WIDTH }}
      />
    </div>
  );
}
