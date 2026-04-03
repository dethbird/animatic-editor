import { useAppStore } from "../../store/useAppStore";
import { timeToPx } from "../../lib/time";

interface PlayheadProps {
  pxPerSecond: number;
}

/**
 * Playhead — a vertical red line indicating the current time.
 * Positioned absolutely within the track area. The left offset includes
 * LABEL_WIDTH (80px) so the line aligns with the clip area, not the labels.
 */
export default function Playhead({ pxPerSecond }: PlayheadProps) {
  const currentTime = useAppStore((s) => s.currentTime);
  const x = timeToPx(currentTime, pxPerSecond);

  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none z-20"
      style={{ left: x }}
    >
      {/* Head triangle */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: "7px solid #ef4444",
        }}
      />
      {/* Vertical line */}
      <div className="absolute top-0 bottom-0 w-px bg-red-500 left-1/2 -translate-x-1/2" />
    </div>
  );
}
