import { useEffect } from "react";
import LeftPanel from "./LeftPanel";
import RightPanel from "./RightPanel";
import BottomPanel from "./BottomPanel";
import ProgramMonitor from "../monitor/ProgramMonitor";
import TransportBar from "../transport/TransportBar";
import Toolbar from "./Toolbar";
import { usePlaybackEngine } from "../../features/playback/usePlaybackEngine";
import { useAppStore } from "../../store/useAppStore";

/**
 * AppShell — the top-level 4-panel editor layout.
 *
 *  ┌─────────────────────────────────────────────────┐
 *  │  Toolbar                                        │
 *  ├────────────┬────────────────────┬───────────────┤
 *  │  Left      │  Program Monitor   │  Inspector    │
 *  │  Panel     │                    │  Panel        │
 *  ├────────────┴────────────────────┴───────────────┤
 *  │  Transport Bar                                  │
 *  ├─────────────────────────────────────────────────┤
 *  │  Timeline (ruler + tracks)                      │
 *  └─────────────────────────────────────────────────┘
 */
export default function AppShell() {
  usePlaybackEngine();

  const selectedClipId = useAppStore((s) => s.selectedClipId);
  const selectedTrackId = useAppStore((s) => s.selectedTrackId);
  const removeClip = useAppStore((s) => s.removeClip);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const play = useAppStore((s) => s.play);
  const pause = useAppStore((s) => s.pause);

  // Global keyboard shortcuts.
  // `Backspace` is intentionally excluded from Delete — on Linux/Tauri the mouse
  // back-button fires a native Backspace keydown that would accidentally delete clips.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === " ") {
        e.preventDefault();
        isPlaying ? pause() : play();
        return;
      }

      if (e.key === "Delete") {
        if (!selectedClipId || !selectedTrackId) return;
        e.preventDefault();
        removeClip(selectedTrackId, selectedClipId);
        clearSelection();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClipId, selectedTrackId, removeClip, clearSelection, isPlaying, play, pause]);

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] overflow-hidden">
      {/* Top toolbar */}
      <Toolbar />

      {/* Middle row: left panel + monitor + right panel */}
      <div className="flex flex-1 min-h-0">
        <LeftPanel />
        <ProgramMonitor />
        <RightPanel />
      </div>

      {/* Transport bar */}
      <TransportBar />

      {/* Bottom: timeline */}
      <BottomPanel />
    </div>
  );
}
