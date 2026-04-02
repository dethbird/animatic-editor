import TimelineView from "../timeline/TimelineView";

/**
 * BottomPanel — houses the full timeline (ruler + tracks).
 * Fixed height, horizontally scrollable inside TimelineView.
 */
export default function BottomPanel() {
  return (
    <div className="flex flex-col shrink-0 h-64 border-t border-[#333] bg-[#1e1e1e] overflow-hidden">
      <TimelineView />
    </div>
  );
}
