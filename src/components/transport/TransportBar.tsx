import { useAppStore } from "../../store/useAppStore";
import { formatTime } from "../../lib/time";
import { getActiveSequence } from "../../lib/timelineSelectors";

/**
 * TransportBar — play / pause / stop controls and timecode display.
 * The playback engine that actually advances currentTime lives in
 * features/playback/usePlaybackEngine (Phase 6). This bar drives the store actions.
 */
export default function TransportBar() {
  const isPlaying = useAppStore((s) => s.isPlaying);
  const currentTime = useAppStore((s) => s.currentTime);
  const project = useAppStore((s) => s.project);
  const play = useAppStore((s) => s.play);
  const pause = useAppStore((s) => s.pause);
  const stop = useAppStore((s) => s.stop);
  const pxPerSecond = useAppStore((s) => s.pxPerSecond);
  const setZoom = useAppStore((s) => s.setZoom);

  const sequence = getActiveSequence(project);
  const duration = sequence?.duration ?? 0;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-[#222] border-t border-b border-[#333] shrink-0 select-none">
      {/* Transport controls */}
      <div className="flex items-center gap-1">
        <TransportButton
          label="◼"
          title="Stop"
          onClick={stop}
          active={false}
        />
        <TransportButton
          label={isPlaying ? "⏸" : "▶"}
          title={isPlaying ? "Pause" : "Play"}
          onClick={isPlaying ? pause : play}
          active={isPlaying}
        />
      </div>

      {/* Timecode */}
      <div className="font-mono text-sm text-[#ccc] w-24 text-center tabular-nums">
        {formatTime(currentTime)}
      </div>

      {/* Duration */}
      <div className="text-[11px] text-[#555]">
        / {formatTime(duration)}
      </div>

      <div className="flex-1" />

      {/* Zoom */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#666]">Zoom</span>
        <input
          type="range"
          min={20}
          max={400}
          step={10}
          value={pxPerSecond}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-24 accent-blue-500"
        />
        <span className="text-[11px] text-[#666] w-12">{pxPerSecond}px/s</span>
      </div>
    </div>
  );
}

function TransportButton({
  label,
  title,
  onClick,
  active,
}: {
  label: string;
  title: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        "w-8 h-8 flex items-center justify-center rounded text-sm transition-colors",
        active
          ? "bg-blue-600 text-white"
          : "bg-[#333] hover:bg-[#444] text-[#ccc]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
