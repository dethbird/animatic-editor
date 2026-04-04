import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { generateId } from "../../lib/ids";
import { getTrackById, getTrackEndTime } from "../../lib/timelineSelectors";
import AssetStatusBadge from "./AssetStatusBadge";
import type { Clip } from "../../types/timeline";

const MIN_DURATION = 0.04; // ~1 frame at 24fps
const MAX_DURATION = 30;
const DEFAULT_INSERT_DURATION = 0.5;

/**
 * AssetBin — lists all assets in the current project.
 *
 * Selecting an asset highlights it. When a track is also selected,
 * insert buttons place the asset as a new clip on that track.
 */
export default function AssetBin() {
  const project = useAppStore((s) => s.project);
  const selectedAssetId = useAppStore((s) => s.selectedAssetId);
  const selectAsset = useAppStore((s) => s.selectAsset);
  const selectedTrackId = useAppStore((s) => s.selectedTrackId);
  const selectedClipId = useAppStore((s) => s.selectedClipId);
  const currentTime = useAppStore((s) => s.currentTime);
  const addClip = useAppStore((s) => s.addClip);
  const selectClip = useAppStore((s) => s.selectClip);

  const [insertDuration, setInsertDuration] = useState(DEFAULT_INSERT_DURATION);

  if (!project || project.assets.length === 0) {
    return (
      <div className="p-3 text-[#555] text-xs italic select-none">
        No assets. Import a Fountain JSON or add files manually.
      </div>
    );
  }

  const selectedAsset = project.assets.find((a) => a.id === selectedAssetId);
  const canInsert =
    selectedAsset?.status === "ready" &&
    selectedTrackId != null;

  // For "Insert After Selected" — need a selected clip on the selected track
  const selectedTrack = selectedTrackId ? getTrackById(project, selectedTrackId) : undefined;
  const selectedClip = selectedTrack && selectedClipId
    ? selectedTrack.clips.find((c) => c.id === selectedClipId)
    : undefined;
  const canInsertAfter = canInsert && selectedClip != null;

  function clampDuration(v: number): number {
    return Math.min(MAX_DURATION, Math.max(MIN_DURATION, v));
  }

  function insertClip(start: number) {
    if (!canInsert || !selectedAsset || !selectedTrackId) return;

    const clipType: Clip["type"] = selectedAsset.type === "image" ? "image" : "audio";
    const duration = clampDuration(insertDuration);

    const clip: Clip = {
      id: generateId(),
      assetId: selectedAsset.id,
      type: clipType,
      start,
      duration,
      inPoint: 0,
      label: selectedAsset.name,
      volume: clipType === "audio" ? 1.0 : undefined,
    };
    addClip(selectedTrackId, clip);
    // Auto-select the new clip to enable chaining "Insert After Selected"
    selectClip(selectedTrackId, clip.id);
  }

  function handleInsertAtPlayhead() {
    insertClip(currentTime);
  }

  function handleInsertAfterSelected() {
    if (!selectedClip) return;
    insertClip(selectedClip.start + selectedClip.duration);
  }

  function handleAppendToTrack() {
    if (!selectedTrack) return;
    insertClip(getTrackEndTime(selectedTrack));
  }

  const images = project.assets.filter((a) => a.type === "image");
  const audio = project.assets.filter((a) => a.type === "audio");

  return (
    <div className="flex flex-col">
      {/* Insert toolbar */}
      <div className="px-3 py-2 border-b border-[#2a2a2a] flex flex-col gap-1.5">
        {/* Duration input */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-[#888] shrink-0">Dur (s)</label>
          <input
            type="number"
            step={0.05}
            min={MIN_DURATION}
            max={MAX_DURATION}
            value={insertDuration}
            onChange={(e) => setInsertDuration(Number(e.target.value))}
            onBlur={() => setInsertDuration(clampDuration(insertDuration))}
            className="w-16 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none focus:border-blue-600"
          />
        </div>

        <button
          onClick={handleInsertAtPlayhead}
          disabled={!canInsert}
          title={
            !selectedAsset
              ? "Select an asset first"
              : !selectedTrackId
              ? "Select a track first"
              : selectedAsset.status !== "ready"
              ? "Asset is not ready"
              : "Insert selected asset at playhead on selected track"
          }
          className={[
            "w-full py-1 px-2 rounded text-[11px] font-medium transition-colors",
            canInsert
              ? "bg-blue-700 hover:bg-blue-600 text-white cursor-pointer"
              : "bg-[#2a2a2a] text-[#555] cursor-not-allowed",
          ].join(" ")}
        >
          Insert at Playhead
        </button>

        <button
          onClick={handleInsertAfterSelected}
          disabled={!canInsertAfter}
          title={
            !canInsert
              ? "Select an asset and a track first"
              : !selectedClip
              ? "Select a clip on the timeline first"
              : "Insert after the selected clip"
          }
          className={[
            "w-full py-1 px-2 rounded text-[11px] font-medium transition-colors",
            canInsertAfter
              ? "bg-blue-700 hover:bg-blue-600 text-white cursor-pointer"
              : "bg-[#2a2a2a] text-[#555] cursor-not-allowed",
          ].join(" ")}
        >
          Insert After Selected
        </button>

        <button
          onClick={handleAppendToTrack}
          disabled={!canInsert}
          title={
            !canInsert
              ? "Select an asset and a track first"
              : "Append to end of selected track"
          }
          className={[
            "w-full py-1 px-2 rounded text-[11px] font-medium transition-colors",
            canInsert
              ? "bg-blue-700 hover:bg-blue-600 text-white cursor-pointer"
              : "bg-[#2a2a2a] text-[#555] cursor-not-allowed",
          ].join(" ")}
        >
          Append to Track
        </button>
      </div>
      {images.length > 0 && (
        <AssetGroup label="Images">
          {images.map((asset) => (
            <AssetRow
              key={asset.id}
              name={asset.name}
              meta={asset.width ? `${asset.width}×${asset.height}` : undefined}
              status={asset.status}
              selected={asset.id === selectedAssetId}
              onClick={() => selectAsset(asset.id)}
            />
          ))}
        </AssetGroup>
      )}

      {audio.length > 0 && (
        <AssetGroup label="Audio">
          {audio.map((asset) => (
            <AssetRow
              key={asset.id}
              name={asset.name}
              meta={asset.duration ? `${asset.duration.toFixed(1)}s` : undefined}
              status={asset.status}
              selected={asset.id === selectedAssetId}
              onClick={() => selectAsset(asset.id)}
            />
          ))}
        </AssetGroup>
      )}
    </div>
  );
}

function AssetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-[#666] font-semibold bg-[#1a1a1a]">
        {label}
      </div>
      {children}
    </div>
  );
}

function AssetRow({
  name,
  meta,
  status,
  selected,
  onClick,
}: {
  name: string;
  meta?: string;
  status: "fetching" | "ready" | "error";
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
        selected ? "bg-blue-900/40" : "hover:bg-[#2a2a2a]",
      ].join(" ")}
    >
      <AssetStatusBadge status={status} />
      <span className="flex-1 truncate text-[12px] text-[#ccc]">{name}</span>
      {meta && (
        <span className="text-[10px] text-[#555] shrink-0">{meta}</span>
      )}
    </button>
  );
}
