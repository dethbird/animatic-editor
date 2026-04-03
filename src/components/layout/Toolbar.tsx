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
 *
 * Uses only React state for prompts/alerts — Tauri's WebView does not support
 * window.prompt / window.alert on Linux.
 */
export default function Toolbar() {
  const project = useAppStore((s) => s.project);
  const dirty = useAppStore((s) => s.dirty);
  const addAsset = useAppStore((s) => s.addAsset);
  const exportStatus = useAppStore((s) => s.exportStatus);
  const exportProgress = useAppStore((s) => s.exportProgress);
  const resetExport = useAppStore((s) => s.resetExport);

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"info" | "error">("info");
  // Inline "New Project" prompt — replaces window.prompt which crashes Tauri on Linux
  const [showNewInput, setShowNewInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("Untitled Animatic");

  const isExporting = exportStatus === "running";

  function notify(msg: string, kind: "info" | "error" = "info") {
    setImportStatus(msg);
    setStatusKind(kind);
  }

  // ── New ───────────────────────────────────────────────────────────────────
  const handleNew = () => {
    setNewProjectName("Untitled Animatic");
    setShowNewInput(true);
  };

  const confirmNew = async () => {
    const name = newProjectName.trim() || "Untitled Animatic";
    setShowNewInput(false);
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
      notify("Create a project first (New).", "error");
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
      notify("Failed to read or parse the JSON file.", "error");
      return;
    }

    if (!Array.isArray(payload.panels) || payload.panels.length === 0) {
      notify("No panels found in the JSON file.", "error");
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
    } catch (err) {
      notify(`Could not probe image: ${err}. Is ffprobe installed?`, "error");
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
    } catch (err) {
      notify(`Could not probe audio: ${err}. Is ffprobe installed?`, "error");
    }
  };

  const noProject = !project;

  return (
    <>
      {/* Inline "New Project" input — replaces window.prompt */}
      {showNewInput && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2a3a] border-b border-blue-800 shrink-0">
          <span className="text-[11px] text-blue-300 shrink-0">Project name:</span>
          <input
            autoFocus
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmNew();
              if (e.key === "Escape") setShowNewInput(false);
            }}
            className="flex-1 bg-[#0d1b2a] border border-blue-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={confirmNew}
            className="px-3 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
          >
            Create
          </button>
          <button
            onClick={() => setShowNewInput(false)}
            className="px-3 py-0.5 bg-[#333] hover:bg-[#444] text-[#ccc] text-xs rounded"
          >
            Cancel
          </button>
        </div>
      )}

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

      {/* Import progress / error indicator */}
      {importStatus && (
        <span
          className={[
            "ml-3 text-[11px] italic cursor-pointer",
            statusKind === "error" ? "text-red-400" : "text-[#888]",
          ].join(" ")}
          onClick={() => setImportStatus(null)}
          title="Click to dismiss"
        >
          {importStatus}
        </span>
      )}

      {/* Project name */}
      {project && (
        <span className="ml-auto text-[11px] text-[#555]">
          {project.name}{dirty ? " (unsaved)" : ""}
        </span>
      )}
    </div>
  </>
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

