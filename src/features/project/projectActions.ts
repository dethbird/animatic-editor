import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store/useAppStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the directory from an absolute file path (cross-platform). */
export function dirFromPath(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx >= 0 ? filePath.slice(0, idx) : filePath;
}

// ── New Project ───────────────────────────────────────────────────────────────

export async function newProjectAction(name: string): Promise<void> {
  const { setProject, markDirty } = useAppStore.getState();
  const project = await invoke<object>('new_project', { name });
  setProject(project as Parameters<typeof setProject>[0]);
  markDirty(false);
}

// ── Save Project ──────────────────────────────────────────────────────────────

/**
 * Save the current project. If no filePath is set, opens a save dialog first.
 * Returns the saved path, or null if the user cancelled.
 */
export async function saveProjectAction(): Promise<string | null> {
  const { project, setProject, markDirty } = useAppStore.getState();
  if (!project) return null;

  let savePath = project.filePath ?? null;

  if (!savePath) {
    const chosen = await invoke<string | null>('save_file_dialog', {
      defaultName: `${project.name.replace(/\s+/g, '-').toLowerCase()}.animatic.json`,
    });
    if (!chosen) return null;
    savePath = chosen;
  }

  await invoke('save_project', { project: { ...project, filePath: savePath }, path: savePath });

  // Update filePath in store
  setProject({ ...project, filePath: savePath });
  markDirty(false);
  return savePath;
}

// ── Open Project ──────────────────────────────────────────────────────────────

export async function openProjectAction(): Promise<void> {
  const { setProject } = useAppStore.getState();

  const path = await invoke<string | null>('open_file_dialog', {
    filters: [{ name: 'Animatic Project', extensions: ['json'] }],
  });
  if (!path) return;

  const project = await invoke<object>('open_project', { path });
  setProject({ ...(project as Parameters<typeof setProject>[0]), filePath: path });
}

// ── Ensure project is saved (gate for import) ─────────────────────────────────

/**
 * Ensures the project has a filePath (needed for media/ dir placement).
 * Prompts a save dialog if not yet saved.
 * Returns the project dir, or null if the user cancelled.
 */
export async function ensureProjectSaved(): Promise<string | null> {
  const { project } = useAppStore.getState();
  if (!project) return null;

  if (project.filePath) {
    return dirFromPath(project.filePath);
  }

  // Not saved yet — save first
  const savedPath = await saveProjectAction();
  if (!savedPath) return null;
  return dirFromPath(savedPath);
}
