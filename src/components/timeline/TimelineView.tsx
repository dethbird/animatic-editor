import { useRef } from "react";
import { useAppStore } from "../../store/useAppStore";
import { getActiveSequence } from "../../lib/timelineSelectors";
import TimelineRuler from "./TimelineRuler";
import TimelineTracks from "./TimelineTracks";
import Playhead from "./Playhead";

/**
 * TimelineView — scrollable container for the ruler, tracks, and playhead.
 * The ruler is pinned at the top; the tracks scroll horizontally in sync.
 */
export default function TimelineView() {
  const project = useAppStore((s) => s.project);
  const pxPerSecond = useAppStore((s) => s.pxPerSecond);
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);
  const sequence = getActiveSequence(project);

  // Total scrollable width in pixels; minimum 60 seconds visible
  const totalDuration = Math.max(sequence?.duration ?? 0, 60);
  const totalWidth = totalDuration * pxPerSecond;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Label column is outside the scroll container so it never shifts.
  // Click position = (mouse - container left) + scrollLeft → always correct.
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) + container.scrollLeft;
    setCurrentTime(Math.max(0, x / pxPerSecond));
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-[#444] text-sm select-none">
        Create or open a project to begin.
      </div>
    );
  }

  // These constants mirror values in TimelineTrackRow / TimelineRuler.
  const LABEL_WIDTH = 80;
  const TRACK_HEIGHT = 40;
  const RULER_HEIGHT = 24;
  const KIND_BORDER: Record<string, string> = {
    video: "border-r-2 border-blue-800",
    audio: "border-r-2 border-green-800",
  };

  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Fixed label column — sits outside the scroll container so it never
          shifts when the user scrolls horizontally. */}
      <div className="flex flex-col bg-[#1e1e1e] shrink-0 z-20" style={{ width: LABEL_WIDTH }}>
        {/* Spacer matching ruler height */}
        <div
          className="bg-[#1a1a1a] border-b border-[#333] border-r border-[#2a2a2a] shrink-0"
          style={{ height: RULER_HEIGHT }}
        />
        {/* One label per track */}
        {sequence?.tracks.map((track) => (
          <div
            key={track.id}
            className={`flex items-center px-2 border-b border-[#2a2a2a] shrink-0 select-none ${
              KIND_BORDER[track.kind] ?? "border-r border-zinc-700"
            } ${track.muted ? "opacity-40" : ""}`}
            style={{ height: TRACK_HEIGHT, fontSize: 10 }}
          >
            <span className="truncate text-[#888]">{track.name}</span>
          </div>
        ))}
      </div>

      {/* Scrollable timeline area — ruler + clips start at x=0 = t=0 */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto relative">
        <div style={{ width: totalWidth, minWidth: "100%", position: "relative" }}>
          {/* Ruler — click to seek */}
          <div onClick={handleRulerClick} className="cursor-pointer sticky top-0 z-10 bg-[#1e1e1e]">
            <TimelineRuler totalDuration={totalDuration} pxPerSecond={pxPerSecond} />
          </div>

          {/* Tracks + playhead */}
          <div className="relative">
            <TimelineTracks sequence={sequence} pxPerSecond={pxPerSecond} />
            <Playhead pxPerSecond={pxPerSecond} />
          </div>
        </div>
      </div>
    </div>
  );
}
