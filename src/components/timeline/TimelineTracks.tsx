import type { Sequence } from "../../types/timeline";
import TimelineTrackRow from "./TimelineTrackRow";

interface TimelineTracksProps {
  sequence: Sequence | undefined;
  pxPerSecond: number;
}

/**
 * TimelineTracks — renders all track rows for the active sequence.
 */
export default function TimelineTracks({ sequence, pxPerSecond }: TimelineTracksProps) {
  if (!sequence || sequence.tracks.length === 0) {
    return (
      <div className="h-20 flex items-center justify-center text-[#444] text-xs select-none">
        No tracks.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {sequence.tracks.map((track) => (
        <TimelineTrackRow
          key={track.id}
          track={track}
          pxPerSecond={pxPerSecond}
        />
      ))}
    </div>
  );
}
