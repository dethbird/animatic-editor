import { useAppStore } from "../../store/useAppStore";
import { generateId } from "../../lib/ids";
import { DEFAULT_CLIP_DURATION_FALLBACK } from "../../lib/projectDefaults";
import AssetStatusBadge from "./AssetStatusBadge";
import type { Clip } from "../../types/timeline";

/**
 * AssetBin — lists all assets in the current project.
 *
 * Selecting an asset highlights it. When a track is also selected,
 * "Insert at Playhead" places the asset as a new clip at currentTime.
 */
export default function AssetBin() {
  const project = useAppStore((s) => s.project);
  const selectedAssetId = useAppStore((s) => s.selectedAssetId);
  const selectAsset = useAppStore((s) => s.selectAsset);
  const selectedTrackId = useAppStore((s) => s.selectedTrackId);
  const currentTime = useAppStore((s) => s.currentTime);
  const addClip = useAppStore((s) => s.addClip);

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

  function handleInsertAtPlayhead() {
    if (!canInsert || !selectedAsset || !selectedTrackId) return;

    const clipType: Clip["type"] = selectedAsset.type === "image" ? "image" : "audio";
    const duration = selectedAsset.duration ?? DEFAULT_CLIP_DURATION_FALLBACK;

    const clip: Clip = {
      id: generateId(),
      assetId: selectedAsset.id,
      type: clipType,
      start: currentTime,
      duration,
      inPoint: 0,
      label: selectedAsset.name,
      volume: clipType === "audio" ? 1.0 : undefined,
    };
    addClip(selectedTrackId, clip);
  }

  const images = project.assets.filter((a) => a.type === "image");
  const audio = project.assets.filter((a) => a.type === "audio");

  return (
    <div className="flex flex-col">
      {/* Insert toolbar */}
      <div className="px-3 py-2 border-b border-[#2a2a2a]">
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
