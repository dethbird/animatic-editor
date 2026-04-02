import LeftPanel from "./LeftPanel";
import RightPanel from "./RightPanel";
import BottomPanel from "./BottomPanel";
import ProgramMonitor from "../monitor/ProgramMonitor";
import TransportBar from "../transport/TransportBar";
import Toolbar from "./Toolbar";
import { usePlaybackEngine } from "../../features/playback/usePlaybackEngine";

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
