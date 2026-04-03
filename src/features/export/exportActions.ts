import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useAppStore } from '../../store/useAppStore';

type ExportProgressEvent = {
  progress: number;
  stage: string;
};

/**
 * Runs the full export pipeline:
 *  1. Shows a save-file dialog for the output MP4 path.
 *  2. Registers a Tauri event listener for `export-progress`.
 *  3. Invokes the Rust `start_export` command.
 *  4. Cleans up the listener and updates the store when done.
 *
 * Call this from the toolbar Export MP4 button.
 * Returns the output path on success, or null if the user cancelled.
 */
export async function exportAction(): Promise<string | null> {
  const state = useAppStore.getState();
  const { project, startExport, setExportProgress, finishExport, failExport } = state;

  if (!project) return null;

  // Pick output path
  const outputPath = await invoke<string | null>('save_file_dialog', {
    defaultName: `${project.name ?? 'animatic'}.mp4`,
  });
  if (!outputPath) return null;

  const jobId = `export-${Date.now()}`;
  startExport(jobId);

  let unlisten: UnlistenFn | null = null;
  try {
    unlisten = await listen<ExportProgressEvent>('export-progress', (event) => {
      setExportProgress(event.payload.progress);
    });

    await invoke('start_export', { project, outputPath });
    finishExport();
    return outputPath;
  } catch (err) {
    failExport(String(err));
    return null;
  } finally {
    unlisten?.();
  }
}
