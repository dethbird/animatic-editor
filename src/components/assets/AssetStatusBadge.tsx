import type { AssetStatus } from "../../types/media";

const STATUS_STYLES: Record<AssetStatus, { dot: string; title: string }> = {
  ready:    { dot: "bg-green-500",  title: "Ready" },
  fetching: { dot: "bg-yellow-400 animate-pulse", title: "Downloading…" },
  error:    { dot: "bg-red-500",    title: "Error" },
};

export default function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const { dot, title } = STATUS_STYLES[status];
  return (
    <span
      title={title}
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${dot}`}
    />
  );
}
