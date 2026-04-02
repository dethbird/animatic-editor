/**
 * Toolbar — top bar with New / Open / Save / Import / Export actions.
 * Actions are wired to Tauri commands in Phase 4. This is the static shell.
 */
export default function Toolbar() {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-[#252525] border-b border-[#333] shrink-0 select-none">
      <span className="text-[#aaa] font-semibold text-xs tracking-widest mr-4 uppercase">
        Animatic Editor
      </span>

      <ToolbarButton label="New" />
      <ToolbarButton label="Open" />
      <ToolbarButton label="Save" />

      <div className="w-px h-4 bg-[#444] mx-2" />

      <ToolbarButton label="Import Fountain JSON" />
      <ToolbarButton label="Add Image" />
      <ToolbarButton label="Add Audio" />

      <div className="w-px h-4 bg-[#444] mx-2" />

      <ToolbarButton label="Export MP4" highlight />
    </div>
  );
}

function ToolbarButton({
  label,
  highlight = false,
  onClick,
}: {
  label: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-2.5 py-1 rounded text-xs font-medium transition-colors",
        highlight
          ? "bg-blue-600 hover:bg-blue-500 text-white"
          : "bg-[#333] hover:bg-[#444] text-[#ccc]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
