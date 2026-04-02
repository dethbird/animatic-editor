import { timeToPx } from "../../lib/time";

interface TimelineRulerProps {
  totalDuration: number;  // seconds
  pxPerSecond: number;
}

/**
 * TimelineRuler — draws second/minute tick marks across the timeline.
 * Rendered as an SVG so ticks stay crisp at any zoom level.
 */
export default function TimelineRuler({ totalDuration, pxPerSecond }: TimelineRulerProps) {
  const height = 24;
  const width = timeToPx(totalDuration, pxPerSecond);

  // Choose a tick interval that keeps ticks at least ~60px apart
  const minPx = 60;
  const intervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300];
  const tickInterval = intervals.find((i) => i * pxPerSecond >= minPx) ?? 300;

  const ticks: { x: number; label: string; major: boolean }[] = [];
  let t = 0;
  while (t <= totalDuration + tickInterval) {
    const x = timeToPx(t, pxPerSecond);
    const major = Number.isInteger(t) && (t % Math.max(1, tickInterval * 5) === 0 || tickInterval >= 1);
    ticks.push({ x, label: formatRulerTime(t), major });
    t = Math.round((t + tickInterval) * 1000) / 1000;
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ display: "block" }}
      className="text-[#666]"
    >
      {/* background */}
      <rect width={width} height={height} fill="#1a1a1a" />

      {ticks.map(({ x, label, major }) => (
        <g key={x}>
          <line
            x1={x}
            y1={major ? height / 2 : (height * 3) / 4}
            x2={x}
            y2={height}
            stroke="#444"
            strokeWidth={1}
          />
          {major && (
            <text
              x={x + 3}
              y={height / 2 - 2}
              fill="#666"
              fontSize={9}
              fontFamily="ui-monospace, monospace"
            >
              {label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function formatRulerTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(seconds < 1 ? 1 : 0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s === 0 ? `${m}m` : `${m}m${s}s`;
}
