import { useState, useEffect, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAppStore } from "../../store/useAppStore";
import { getTrackById } from "../../lib/timelineSelectors";
import type { Clip } from "../../types/timeline";
import type { Asset } from "../../types/media";

/**
 * InspectorPanel — shows properties of the selected clip, or info about the
 * selected asset when no clip is selected.
 */
export default function InspectorPanel() {
  const project = useAppStore((s) => s.project);
  const selectedClipId = useAppStore((s) => s.selectedClipId);
  const selectedTrackId = useAppStore((s) => s.selectedTrackId);
  const selectedAssetId = useAppStore((s) => s.selectedAssetId);
  const updateClip = useAppStore((s) => s.updateClip);
  const removeClip = useAppStore((s) => s.removeClip);
  const clearSelection = useAppStore((s) => s.clearSelection);

  // ── No project ────────────────────────────────────────────────────────────
  if (!project) {
    return <div className="p-4 text-[#555] text-xs italic select-none">No clip selected.</div>;
  }

  // ── Clip selected ─────────────────────────────────────────────────────────
  if (selectedClipId && selectedTrackId) {
    const track = getTrackById(project, selectedTrackId);
    const clip = track?.clips.find((c) => c.id === selectedClipId);

    if (!clip) {
      return <div className="p-4 text-[#555] text-xs italic select-none">Clip not found.</div>;
    }

    const patch = (p: Partial<Clip>) => updateClip(selectedTrackId, selectedClipId, p);

    return (
      <div className="p-3 flex flex-col gap-3">
        <Section label="Clip">
          <Field label="Label" type="text" value={clip.label ?? ""} onChange={(v) => patch({ label: v as string })} />
          <Field label="Start (s)" type="number" value={clip.start} onChange={(v) => patch({ start: Math.max(0, v as number) })} />
          <Field label="Duration (s)" type="number" value={clip.duration} onChange={(v) => patch({ duration: Math.max(0.04, v as number) })} />
          <Field label="In Point (s)" type="number" value={clip.inPoint} onChange={(v) => patch({ inPoint: Math.max(0, v as number) })} />
        </Section>

        {clip.type === "audio" && (
          <Section label="Audio">
            <Field label="Volume" type="number" value={clip.volume ?? 1} onChange={(v) => patch({ volume: Math.min(1, Math.max(0, v as number)) })} step={0.05} min={0} max={1} />
            <Field label="Fade In (s)" type="number" value={clip.fadeIn ?? 0} onChange={(v) => patch({ fadeIn: Math.max(0, v as number) })} />
            <Field label="Fade Out (s)" type="number" value={clip.fadeOut ?? 0} onChange={(v) => patch({ fadeOut: Math.max(0, v as number) })} />
          </Section>
        )}

        {clip.type === "image" && (
          <Section label="Transform">
            <Field label="Scale" type="number" value={clip.transform?.scale ?? 1} onChange={(v) => patch({ transform: { ...clip.transform, scale: v as number } })} step={0.05} />
            <Field label="X" type="number" value={clip.transform?.x ?? 0} onChange={(v) => patch({ transform: { ...clip.transform, x: v as number } })} />
            <Field label="Y" type="number" value={clip.transform?.y ?? 0} onChange={(v) => patch({ transform: { ...clip.transform, y: v as number } })} />
          </Section>
        )}

        {clip.scriptRef && (
          <Section label="Script Reference">
            <ReadOnly label="Panel" value={clip.scriptRef.panelId ?? "—"} />
            <ReadOnly label="Act" value={clip.scriptRef.act ?? "—"} />
            <ReadOnly label="Scene" value={clip.scriptRef.scene ?? "—"} />
            <ReadOnly label="Sequence" value={clip.scriptRef.sequence ?? "—"} />
          </Section>
        )}

        <Section label="Actions">
          <button
            onClick={() => { removeClip(selectedTrackId, selectedClipId); clearSelection(); }}
            className="w-full py-1 text-[11px] rounded bg-red-900/50 hover:bg-red-800/70 text-red-300 border border-red-800 transition-colors"
          >
            Remove from Timeline
          </button>
        </Section>
      </div>
    );
  }

  // ── Asset selected ────────────────────────────────────────────────────────
  if (selectedAssetId) {
    const asset = project.assets.find((a) => a.id === selectedAssetId);
    if (!asset) {
      return <div className="p-4 text-[#555] text-xs italic select-none">Asset not found.</div>;
    }
    return <AssetInfo asset={asset} />;
  }

  return <div className="p-4 text-[#555] text-xs italic select-none">No clip selected.</div>;
}

// ── Asset info view ───────────────────────────────────────────────────────────

function AssetInfo({ asset }: { asset: Asset }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Hold refs to the AudioContext and active source node so we can stop them
  const acRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  function stopAudio() {
    sourceRef.current?.stop();
    sourceRef.current = null;
    acRef.current?.close();
    acRef.current = null;
    setIsPlaying(false);
  }

  // Stop playback whenever the asset changes or the component unmounts
  useEffect(() => {
    return () => stopAudio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);

  async function togglePlay() {
    if (isPlaying) {
      stopAudio();
      return;
    }
    if (!asset.localPath) return;

    setIsLoading(true);
    try {
      const url = convertFileSrc(asset.localPath);
      const resp = await fetch(url);
      const rawBuf = await resp.arrayBuffer();

      const ac = new AudioContext();
      acRef.current = ac;
      const buffer = await ac.decodeAudioData(rawBuf);

      const source = ac.createBufferSource();
      source.buffer = buffer;
      source.connect(ac.destination);
      source.onended = () => {
        setIsPlaying(false);
        sourceRef.current = null;
      };
      source.start(0);
      sourceRef.current = source;
      setIsPlaying(true);
    } catch (err) {
      console.error("Audio preview failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const statusColor =
    asset.status === "ready" ? "text-green-400" :
    asset.status === "fetching" ? "text-yellow-400" : "text-red-400";

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Image thumbnail */}
      {asset.type === "image" && asset.localPath && (
        <div className="w-full rounded overflow-hidden bg-black border border-[#2a2a2a]">
          <img
            src={convertFileSrc(asset.localPath)}
            alt={asset.name}
            className="w-full object-contain max-h-40"
            draggable={false}
          />
        </div>
      )}

      {/* Audio preview */}
      {asset.type === "audio" && asset.localPath && (
        <div className="flex flex-col gap-1.5">
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className={[
              "w-full py-1.5 px-3 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50",
              isPlaying
                ? "bg-green-800 hover:bg-green-700 text-green-100"
                : "bg-[#2a2a2a] hover:bg-[#333] text-[#ccc]",
            ].join(" ")}
          >
            <span>{isLoading ? "⋯" : isPlaying ? "⏸" : "▶"}</span>
            <span>{isLoading ? "Loading…" : isPlaying ? "Pause" : "Play Preview"}</span>
          </button>
        </div>
      )}

      <Section label="Asset">
        <ReadOnly label="Name" value={asset.name} />
        <ReadOnly label="Type" value={asset.type} />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#888] w-20 shrink-0">Status</span>
          <span className={`text-[11px] ${statusColor}`}>{asset.status}</span>
        </div>
      </Section>

      {asset.type === "image" && (asset.width || asset.height) && (
        <Section label="Image">
          {asset.width && asset.height && (
            <ReadOnly label="Size" value={`${asset.width} × ${asset.height} px`} />
          )}
        </Section>
      )}

      {asset.type === "audio" && (
        <Section label="Audio">
          {asset.duration !== undefined && (
            <ReadOnly label="Duration" value={`${asset.duration.toFixed(2)}s`} />
          )}
          {asset.sampleRate !== undefined && (
            <ReadOnly label="Sample Rate" value={`${asset.sampleRate} Hz`} />
          )}
          {asset.channels !== undefined && (
            <ReadOnly label="Channels" value={String(asset.channels)} />
          )}
        </Section>
      )}

      {asset.sourceUrl && (
        <Section label="Source">
          <div className="text-[10px] text-[#666] break-all leading-relaxed">{asset.sourceUrl}</div>
        </Section>
      )}

      {asset.localPath && (
        <Section label="Local Path">
          <div className="text-[10px] text-[#666] break-all leading-relaxed">{asset.localPath}</div>
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[#666] mb-1.5 font-semibold">
        {label}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  step = 0.1,
  min,
  max,
}: {
  label: string;
  type: "text" | "number";
  value: string | number;
  onChange: (v: string | number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-[#888] w-20 shrink-0">{label}</label>
      <input
        type={type}
        value={value}
        step={type === "number" ? step : undefined}
        min={min}
        max={max}
        onChange={(e) =>
          onChange(type === "number" ? parseFloat(e.target.value) : e.target.value)
        }
        className="flex-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded px-2 py-0.5 text-xs text-[#ddd] focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[#888] w-20 shrink-0">{label}</span>
      <span className="text-[11px] text-[#aaa]">{value}</span>
    </div>
  );
}
