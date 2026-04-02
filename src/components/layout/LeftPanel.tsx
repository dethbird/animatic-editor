import AssetBin from "../assets/AssetBin";

/**
 * LeftPanel — asset bin / import section.
 * Fixed width, scrollable content.
 */
export default function LeftPanel() {
  return (
    <div className="flex flex-col w-56 shrink-0 border-r border-[#333] bg-[#212121] overflow-hidden">
      <PanelHeader label="Assets" />
      <div className="flex-1 overflow-y-auto">
        <AssetBin />
      </div>
    </div>
  );
}

function PanelHeader({ label }: { label: string }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#888] border-b border-[#333] shrink-0">
      {label}
    </div>
  );
}
