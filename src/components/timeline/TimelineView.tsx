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

  // Clicking the ruler seeks the playhead
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    setCurrentTime(x / pxPerSecond);
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-[#444] text-sm select-none">
        Create or open a project to begin.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Horizontally scrollable area */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto relative">
        {/* Inner canvas sized to total duration */}
        <div style={{ width: totalWidth, minWidth: "100%", position: "relative" }}>
          {/* Ruler row — click to seek */}
          <div onClick={handleRulerClick} className="cursor-pointer sticky top-0 z-10 bg-[#1e1e1e]">
            <TimelineRuler
              totalDuration={totalDuration}
              pxPerSecond={pxPerSecond}
            />
          </div>

          {/* Tracks */}
          <div className="relative">
            <TimelineTracks sequence={sequence} pxPerSecond={pxPerSecond} />
            <Playhead pxPerSecond={pxPerSecond} />
          </div>
        </div>
      </div>
    </div>
  );
}
