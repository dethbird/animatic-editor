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

  // Delete removes the selected clip. Only the `Delete` key is used — `Backspace`
  // is intentionally excluded because on Linux/Tauri the mouse back-button fires a
  // native Backspace keydown that would accidentally delete clips on click.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!selectedClipId || !selectedTrackId) return;
      e.preventDefault();
      removeClip(selectedTrackId, selectedClipId);
      clearSelection();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClipId, selectedTrackId, removeClip, clearSelection]);

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
