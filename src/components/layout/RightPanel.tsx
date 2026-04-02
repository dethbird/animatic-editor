import InspectorPanel from "../inspector/InspectorPanel";

/**
 * RightPanel — inspector for the selected clip / asset.
 * Fixed width, scrollable content.
 */
export default function RightPanel() {
  return (
    <div className="flex flex-col w-64 shrink-0 border-l border-[#333] bg-[#212121] overflow-hidden">
      <PanelHeader label="Inspector" />
      <div className="flex-1 overflow-y-auto">
        <InspectorPanel />
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
