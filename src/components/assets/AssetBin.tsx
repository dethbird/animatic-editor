import { useAppStore } from "../../store/useAppStore";
import AssetStatusBadge from "./AssetStatusBadge";

/**
 * AssetBin — lists all assets in the current project.
 * Selecting an asset updates the selection slice.
 */
export default function AssetBin() {
  const project = useAppStore((s) => s.project);
  const selectedAssetId = useAppStore((s) => s.selectedAssetId);
  const selectAsset = useAppStore((s) => s.selectAsset);

  if (!project || project.assets.length === 0) {
    return (
      <div className="p-3 text-[#555] text-xs italic select-none">
        No assets. Import a Fountain JSON or add files manually.
      </div>
    );
  }

  const images = project.assets.filter((a) => a.type === "image");
  const audio = project.assets.filter((a) => a.type === "audio");

  return (
    <div className="flex flex-col">
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
