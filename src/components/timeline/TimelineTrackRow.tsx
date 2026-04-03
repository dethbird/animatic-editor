import type { Track } from "../../types/timeline";
import TimelineClip from "./TimelineClip";

interface TimelineTrackRowProps {
  track: Track;
  pxPerSecond: number;
}

const TRACK_HEIGHT = 40; // px

/**
 * TimelineTrackRow — a single horizontal lane containing clips.
 * Labels live in the fixed column in TimelineView; this row contains only clips.
 */
export default function TimelineTrackRow({ track, pxPerSecond }: TimelineTrackRowProps) {
  return (
    <div
      className={`relative border-b border-[#2a2a2a] ${track.muted ? "opacity-40" : ""}`}
      style={{ height: TRACK_HEIGHT }}
    >
      <div className="absolute inset-0">
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
