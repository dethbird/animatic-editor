import type { FountainImportPayload, FountainPanel } from '../../types/import';
import type { Asset } from '../../types/media';
import type { Clip, Marker } from '../../types/timeline';
import { generateId } from '../../lib/ids';
import { DEFAULT_CLIP_DURATION_FALLBACK } from '../../lib/projectDefaults';

export type ImportedTimeline = {
  clipRows: { trackId: string; clip: Clip }[];
  markers: Marker[];
  sequenceDuration: number;
};

/**
 * Pure function — converts a FountainImportPayload into timeline clip rows and
 * markers, using a pre-built URL→Asset map. Does not touch the store.
 *
 * Rules:
 * - Image clip → V1, audio clip → A1, linked via linkedClipId.
 * - Clips are packed sequentially (one after another, no gaps).
 * - If panel.duration is absent, use audio duration if available, else 3s fallback.
 * - Missing image → skip image clip. Missing audio → image clip with no linked audio.
 * - Markers created on act/scene/sequence boundary changes.
 */
export function buildTimelineFromImport(
  payload: FountainImportPayload,
  urlToAsset: Map<string, Asset>,
): ImportedTimeline {
  const clipRows: { trackId: string; clip: Clip }[] = [];
  const markers: Marker[] = [];
  let cursor = 0; // current time position in seconds

  let lastAct: string | undefined;
  let lastScene: string | undefined;
  let lastSequence: string | undefined;

  for (const panel of payload.panels) {
    const imageAsset = panel.image ? urlToAsset.get(panel.image) ?? null : null;
    const audioAsset = panel.audio ? urlToAsset.get(panel.audio) ?? null : null;

    // Resolve clip duration
    const duration =
      panel.duration ??
      (audioAsset?.duration ?? null) ??
      DEFAULT_CLIP_DURATION_FALLBACK;

    // Emit markers for boundary changes
    const markerLabels: string[] = [];
    if (panel.act && panel.act !== lastAct) markerLabels.push(panel.act);
    if (panel.scene && panel.scene !== lastScene) markerLabels.push(panel.scene);
    if (panel.sequence && panel.sequence !== lastSequence) markerLabels.push(panel.sequence);

    if (markerLabels.length > 0) {
      markers.push({ id: generateId(), time: cursor, label: markerLabels.join(' / ') });
    }
    lastAct = panel.act ?? lastAct;
    lastScene = panel.scene ?? lastScene;
    lastSequence = panel.sequence ?? lastSequence;

    const imageClipId = generateId();
    const audioClipId = generateId();
    const scriptRef = {
      panelId: panel.id,
      act: panel.act,
      scene: panel.scene,
      sequence: panel.sequence,
    };

    // Image clip on V1
    if (imageAsset && imageAsset.status === 'ready') {
      const imageClip: Clip = {
        id: imageClipId,
        assetId: imageAsset.id,
        type: 'image',
        start: cursor,
        duration,
        inPoint: 0,
        label: panel.title ?? panel.id,
        linkedClipId: audioAsset ? audioClipId : undefined,
        scriptRef,
      };
      clipRows.push({ trackId: 'v1', clip: imageClip });
    }

    // Audio clip on A1
    if (audioAsset && audioAsset.status === 'ready') {
      const audioClip: Clip = {
        id: audioClipId,
        assetId: audioAsset.id,
        type: 'audio',
        start: cursor,
        duration,
        inPoint: 0,
        volume: 1,
        linkedClipId: imageAsset ? imageClipId : undefined,
        scriptRef,
      };
      clipRows.push({ trackId: 'a1', clip: audioClip });
    }

    cursor += duration;
  }

  return {
    clipRows,
    markers,
    sequenceDuration: cursor,
  };
}

/** Collect all unique image + audio URLs from a panel list. */
export function collectUniqueUrls(panels: FountainPanel[]): string[] {
  const seen = new Set<string>();
  for (const panel of panels) {
    if (panel.image) seen.add(panel.image);
    if (panel.audio) seen.add(panel.audio);
  }
  return Array.from(seen);
}
