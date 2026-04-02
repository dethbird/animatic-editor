import { useAppStore } from "../../store/useAppStore";
import { useActiveVideoClip } from "../../lib/timelineSelectors";

/**
 * ProgramMonitor — displays the current frame of the active video clip.
 * At the current playhead time, finds the topmost visible image clip and
 * shows it. Falls back to a black screen if nothing is active.
 */
export default function ProgramMonitor() {
  const currentTime = useAppStore((s) => s.currentTime);
  const project = useAppStore((s) => s.project);
  const activeClip = useActiveVideoClip(project, currentTime);

  // Resolve asset local path for the active clip
  const assetPath =
    activeClip?.assetId !== undefined
      ? project?.assets.find((a) => a.id === activeClip.assetId)?.localPath
      : undefined;

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-black overflow-hidden">
      <div className="flex-1 flex items-center justify-center relative">
        {assetPath ? (
          <img
            // Tauri v2: use the asset protocol to load local files
            src={`asset://localhost/${encodeURIComponent(assetPath)}`}
            alt="Current frame"
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="text-[#444] text-sm select-none">No signal</div>
        )}
      </div>

      {/* Timecode overlay */}
      <div className="text-center text-[10px] font-mono text-[#555] py-1 bg-[#111] shrink-0">
        {formatTime(currentTime)}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${String(secs).padStart(2, "0")}.${ms}`;
}
