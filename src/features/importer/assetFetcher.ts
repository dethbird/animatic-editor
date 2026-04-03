import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store/useAppStore';
import { generateId } from '../../lib/ids';
import type { Asset } from '../../types/media';
import type { FountainImportPayload } from '../../types/import';
import type { ImportReport } from '../../types/import';
import { collectUniqueUrls, buildTimelineFromImport } from './importFountain';

// Tauri command return shapes
interface DownloadResult {
  localPath: string;
  contentHash: string;
  fetchedAt: string;
}

interface MediaInfo {
  kind: string;
  duration?: number;
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
}

export type FetchProgress = {
  total: number;
  downloaded: number;
  failed: number;
};

/**
 * Full import pipeline:
 *
 * 1. Parse + validate the payload.
 * 2. Collect unique URLs.
 * 3. Create placeholder Asset records (status: 'fetching') in the store.
 * 4. Download + probe each URL concurrently; update assets to 'ready'/'error'.
 * 5. Build clips + markers from the resolved asset map.
 * 6. Insert clips + markers into the active sequence.
 *
 * @param payload   Parsed FountainImportPayload
 * @param projectDir Absolute path to the project directory (for media/ placement)
 * @param onProgress Called after each asset download completes
 * @returns ImportReport
 */
export async function runImport(
  payload: FountainImportPayload,
  projectDir: string,
  onProgress?: (p: FetchProgress) => void,
): Promise<ImportReport> {
  const store = useAppStore.getState();
  const urls = collectUniqueUrls(payload.panels);

  // -- Step 1: register placeholder assets -----------------------------------------
  const urlToAsset = new Map<string, Asset>();

  for (const url of urls) {
    const isImage = looksLikeImage(url);
    const asset: Asset = {
      id: generateId(),
      type: isImage ? 'image' : 'audio',
      name: nameFromUrl(url),
      sourceUrl: url,
      status: 'fetching',
    };
    store.addAsset(asset);
    urlToAsset.set(url, asset);
  }

  // -- Step 2: download + probe concurrently ----------------------------------------
  const report: ImportReport = {
    total: urls.length,
    downloaded: 0,
    failed: 0,
    assets: [],
  };

  await Promise.all(
    urls.map(async (url) => {
      const placeholder = urlToAsset.get(url)!;
      try {
        // Download
        const dl = await invoke<DownloadResult>('download_asset', {
          url,
          projectDir,
        });

        // Probe
        const info = await invoke<MediaInfo>('probe_media', { path: dl.localPath });

        // Build final asset
        const ready: Partial<Asset> = {
          localPath: dl.localPath,
          contentHash: dl.contentHash,
          fetchedAt: dl.fetchedAt,
          status: 'ready',
          type: (info.kind === 'image' ? 'image' : 'audio') as Asset['type'],
          duration: info.duration,
          width: info.width,
          height: info.height,
          sampleRate: info.sampleRate,
          channels: info.channels,
        };

        useAppStore.getState().updateAsset(placeholder.id, ready);
        urlToAsset.set(url, { ...placeholder, ...ready });

        report.downloaded++;
        report.assets.push({ url, assetId: placeholder.id, status: 'ready' });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[import] failed: ${url}\n  reason: ${errorMsg}`);
        useAppStore.getState().updateAsset(placeholder.id, { status: 'error', error: errorMsg });
        report.failed++;
        report.assets.push({ url, assetId: placeholder.id, status: 'error', error: errorMsg });
      }

      onProgress?.({ total: report.total, downloaded: report.downloaded, failed: report.failed });
    }),
  );

  // -- Step 3: build timeline --------------------------------------------------------
  const { clipRows, markers, sequenceDuration } = buildTimelineFromImport(payload, urlToAsset);

  const { addClip, addMarker, setSequenceDuration } = useAppStore.getState();
  for (const { trackId, clip } of clipRows) {
    addClip(trackId, clip);
  }
  for (const marker of markers) {
    addMarker(marker);
  }
  setSequenceDuration(sequenceDuration);

  return report;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif']);
const AUDIO_EXTS = new Set(['.wav', '.mp3', '.ogg', '.aac', '.flac', '.m4a', '.aiff']);

function extFromUrl(url: string): string {
  const clean = url.split('?')[0].split('/').pop() ?? '';
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot).toLowerCase() : '';
}

function looksLikeImage(url: string): boolean {
  const ext = extFromUrl(url);
  if (IMAGE_EXTS.has(ext)) return true;
  if (AUDIO_EXTS.has(ext)) return false;
  // Default to image for unknown types (ffprobe will correct it after probe)
  return true;
}

function nameFromUrl(url: string): string {
  return url.split('?')[0].split('/').pop() ?? url;
}
