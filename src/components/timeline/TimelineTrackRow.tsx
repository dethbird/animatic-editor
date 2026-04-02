import type { Track } from "../../types/timeline";
import TimelineClip from "./TimelineClip";

interface TimelineTrackRowProps {
  track: Track;
  pxPerSecond: number;
}

const TRACK_HEIGHT = 40; // px

const KIND_COLORS: Record<string, string> = {
  video: "border-blue-800",
  audio: "border-green-800",
};

/**
 * TimelineTrackRow — a single horizontal lane containing clips.
 * The track label is rendered as an overlay on the left; clips are positioned
 * absolutely by their start time and duration.
 */
export default function TimelineTrackRow({ track, pxPerSecond }: TimelineTrackRowProps) {
  const borderColor = KIND_COLORS[track.kind] ?? "border-zinc-700";

  return (
    <div
      className={`relative border-b border-[#2a2a2a] ${track.muted ? "opacity-40" : ""}`}
      style={{ height: TRACK_HEIGHT }}
    >
      {/* Track label — pinned left, sits above clips */}
      <div
        className={`absolute left-0 top-0 bottom-0 flex items-center px-2 z-10 border-r-2 ${borderColor} bg-[#1e1e1e] select-none`}
        style={{ width: 80, fontSize: 10 }}
      >
        <span className="truncate text-[#888]">{track.name}</span>
      </div>

      {/* Clip area — offset by label width */}
      <div className="absolute inset-0" style={{ left: 80 }}>
        {track.clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            trackId={track.id}
            pxPerSecond={pxPerSecond}
            trackHeight={TRACK_HEIGHT}
          />
        ))}
      </div>
    </div>
  );
}
