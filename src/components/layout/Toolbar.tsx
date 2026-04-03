import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../store/useAppStore";
import {
  newProjectAction,
  openProjectAction,
  saveProjectAction,
  ensureProjectSaved,
} from "../../features/project/projectActions";
import { runImport, type FetchProgress } from "../../features/importer/assetFetcher";
import { exportAction } from "../../features/export/exportActions";
import type { FountainImportPayload } from "../../types/import";
import { generateId } from "../../lib/ids";

/**
 * Toolbar — top bar with New / Open / Save / Import / Add Image / Add Audio / Export actions.
 */
export default function Toolbar() {
  const project = useAppStore((s) => s.project);
  const dirty = useAppStore((s) => s.dirty);
  const addAsset = useAppStore((s) => s.addAsset);
  const exportStatus = useAppStore((s) => s.exportStatus);
  const exportProgress = useAppStore((s) => s.exportProgress);
  const resetExport = useAppStore((s) => s.resetExport);

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const isExporting = exportStatus === "running";

  // ── New ───────────────────────────────────────────────────────────────────
  const handleNew = async () => {
    const name = window.prompt("Project name:", "Untitled Animatic");
    if (!name) return;
    await newProjectAction(name);
    setImportStatus(null);
  };

  // ── Open ──────────────────────────────────────────────────────────────────
  const handleOpen = async () => {
    await openProjectAction();
    setImportStatus(null);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    await saveProjectAction();
  };

  // ── Import Fountain JSON ──────────────────────────────────────────────────
  const handleImport = async () => {
    if (!project) {
      window.alert("Create a project first (New).");
      return;
    }

    // Gate: project must be saved so we know the media/ dir location
    const projectDir = await ensureProjectSaved();
    if (!projectDir) return; // user cancelled save dialog

    // Pick the Fountain JSON file
    const filePath = await invoke<string | null>("open_file_dialog", {
      filters: [{ name: "Fountain JSON", extensions: ["json"] }],
    });
    if (!filePath) return;

    // Read + parse
    let payload: FountainImportPayload;
    try {
      const raw = await invoke<string>("read_text_file", { path: filePath });
      payload = JSON.parse(raw) as FountainImportPayload;
    } catch {
      window.alert("Failed to read or parse the JSON file.");
      return;
    }

    if (!Array.isArray(payload.panels) || payload.panels.length === 0) {
      window.alert("No panels found in the JSON file.");
      return;
    }

    // Run import pipeline with progress feedback
    setImportStatus(`Downloading 0 / ${payload.panels.length} assets…`);

    const onProgress = (p: FetchProgress) => {
      setImportStatus(`Downloading ${p.downloaded + p.failed} / ${p.total} assets…`);
    };

    try {
      const report = await runImport(payload, projectDir, onProgress);
      const msg =
        report.failed > 0
          ? `Import done. ${report.downloaded} ready, ${report.failed} failed.`
          : `Import done. ${report.downloaded} assets, timeline built.`;
      setImportStatus(msg);
    } catch (err) {
      console.error(err);
      setImportStatus("Import failed — see console for details.");
    }
  };

  // ── Add Image ─────────────────────────────────────────────────────────────
  const handleAddImage = async () => {
    if (!project) return;
    const filePath = await invoke<string | null>("open_file_dialog", {
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });
    if (!filePath) return;

    try {
      const info = await invoke<{
        kind: string; width?: number; height?: number; duration?: number;
      }>("probe_media", { path: filePath });

      addAsset({
        id: generateId(),
        type: "image",
        name: filePath.split("/").pop() ?? filePath,
        localPath: filePath,
        status: "ready",
        width: info.width,
        height: info.height,
      });
    } catch {
      window.alert("Could not probe that file. Is ffprobe installed?");
    }
  };

  // ── Export MP4 ────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!project) return;
    const outPath = await exportAction();
    if (outPath) {
      console.log("Export saved to:", outPath);
    }
  };

  // ── Add Audio ─────────────────────────────────────────────────────────────
  const handleAddAudio = async () => {
    if (!project) return;
    const filePath = await invoke<string | null>("open_file_dialog", {
      filters: [{ name: "Audio", extensions: ["wav", "mp3", "ogg", "aac", "flac", "m4a"] }],
    });
    if (!filePath) return;

    try {
      const info = await invoke<{
        kind: string; duration?: number; sampleRate?: number; channels?: number;
      }>("probe_media", { path: filePath });

      addAsset({
        id: generateId(),
        type: "audio",
        name: filePath.split("/").pop() ?? filePath,
        localPath: filePath,
        status: "ready",
        duration: info.duration,
        sampleRate: info.sampleRate,
        channels: info.channels,
      });
    } catch {
      window.alert("Could not probe that file. Is ffprobe installed?");
    }
  };

  const noProject = !project;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-[#252525] border-b border-[#333] shrink-0 select-none flex-wrap">
      <span className="text-[#aaa] font-semibold text-xs tracking-widest mr-4 uppercase">
        Animatic Editor
      </span>

      <ToolbarButton label="New" onClick={handleNew} />
      <ToolbarButton label="Open" onClick={handleOpen} />
      <ToolbarButton
        label={dirty ? "Save •" : "Save"}
        onClick={handleSave}
        disabled={noProject}
      />

      <div className="w-px h-4 bg-[#444] mx-2" />

      <ToolbarButton
        label="Import Fountain JSON"
        onClick={handleImport}
        disabled={noProject}
      />
      <ToolbarButton
        label="Add Image"
        onClick={handleAddImage}
        disabled={noProject}
      />
      <ToolbarButton
        label="Add Audio"
        onClick={handleAddAudio}
        disabled={noProject}
      />

      <div className="w-px h-4 bg-[#444] mx-2" />

      <ToolbarButton
        label={isExporting ? `Exporting ${exportProgress}%…` : "Export MP4"}
        highlight
        disabled={noProject || isExporting}
        onClick={handleExport}
      />

      {/* Export done/error banners */}
      {exportStatus === "done" && (
        <span
          className="ml-2 text-[11px] text-green-400 italic cursor-pointer"
          onClick={resetExport}
          title="Click to dismiss"
        >
          Export complete ✓
        </span>
      )}
      {exportStatus === "error" && (
        <span
          className="ml-2 text-[11px] text-red-400 italic cursor-pointer"
          onClick={resetExport}
          title="Click to dismiss"
        >
          Export failed — see console
        </span>
      )}

      {/* Import progress indicator */}
      {importStatus && (
        <span className="ml-3 text-[11px] text-[#888] italic">{importStatus}</span>
      )}

      {/* Project name */}
      {project && (
        <span className="ml-auto text-[11px] text-[#555]">
          {project.name}{dirty ? " (unsaved)" : ""}
        </span>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  highlight = false,
  disabled = false,
  onClick,
}: {
  label: string;
  highlight?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-default",
        highlight
          ? "bg-blue-600 hover:bg-blue-500 text-white"
          : "bg-[#333] hover:bg-[#444] text-[#ccc]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

