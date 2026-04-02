import { useAppStore } from "../../store/useAppStore";
import { getTrackById } from "../../lib/timelineSelectors";
import type { Clip } from "../../types/timeline";

/**
 * InspectorPanel — edits properties of the selected clip.
 * Shows a message when nothing is selected.
 */
export default function InspectorPanel() {
  const project = useAppStore((s) => s.project);
  const selectedClipId = useAppStore((s) => s.selectedClipId);
  const selectedTrackId = useAppStore((s) => s.selectedTrackId);
  const updateClip = useAppStore((s) => s.updateClip);

  if (!project || !selectedClipId || !selectedTrackId) {
    return (
      <div className="p-4 text-[#555] text-xs italic select-none">
        No clip selected.
      </div>
    );
  }

  const track = getTrackById(project, selectedTrackId);
  const clip = track?.clips.find((c) => c.id === selectedClipId);

  if (!clip) {
    return (
      <div className="p-4 text-[#555] text-xs italic select-none">
        Clip not found.
      </div>
    );
  }

  const patch = (p: Partial<Clip>) => updateClip(selectedTrackId, selectedClipId, p);

  return (
    <div className="p-3 flex flex-col gap-3">
      <Section label="Clip">
        <Field
          label="Label"
          type="text"
          value={clip.label ?? ""}
          onChange={(v) => patch({ label: v as string })}
        />
        <Field
          label="Start (s)"
          type="number"
          value={clip.start}
          onChange={(v) => patch({ start: Math.max(0, v as number) })}
        />
        <Field
          label="Duration (s)"
          type="number"
          value={clip.duration}
          onChange={(v) => patch({ duration: Math.max(0.04, v as number) })}
        />
        <Field
          label="In Point (s)"
          type="number"
          value={clip.inPoint}
          onChange={(v) => patch({ inPoint: Math.max(0, v as number) })}
        />
      </Section>

      {clip.type === "audio" && (
        <Section label="Audio">
          <Field
            label="Volume"
            type="number"
            value={clip.volume ?? 1}
            onChange={(v) => patch({ volume: Math.min(1, Math.max(0, v as number)) })}
            step={0.05}
            min={0}
            max={1}
          />
          <Field
            label="Fade In (s)"
            type="number"
            value={clip.fadeIn ?? 0}
            onChange={(v) => patch({ fadeIn: Math.max(0, v as number) })}
          />
          <Field
            label="Fade Out (s)"
            type="number"
            value={clip.fadeOut ?? 0}
            onChange={(v) => patch({ fadeOut: Math.max(0, v as number) })}
          />
        </Section>
      )}

      {clip.type === "image" && (
        <Section label="Transform">
          <Field
            label="Scale"
            type="number"
            value={clip.transform?.scale ?? 1}
            onChange={(v) => patch({ transform: { ...clip.transform, scale: v as number } })}
            step={0.05}
          />
          <Field
            label="X"
            type="number"
            value={clip.transform?.x ?? 0}
            onChange={(v) => patch({ transform: { ...clip.transform, x: v as number } })}
          />
          <Field
            label="Y"
            type="number"
            value={clip.transform?.y ?? 0}
            onChange={(v) => patch({ transform: { ...clip.transform, y: v as number } })}
          />
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
