/**
 * usePlaybackEngine
 *
 * Drives two things while isPlaying is true:
 *  1. A requestAnimationFrame loop that advances currentTime in the store.
 *  2. Web Audio API scheduling for all audio clips in the active sequence,
 *     respecting volume, inPoint, fadeIn, and fadeOut.
 *
 * A fresh AudioContext is created per play session so that WebKitGTK's
 * silent-after-interaction bug is avoided. Raw ArrayBuffers are cached
 * across sessions (context-independent); decoding is repeated per session.
 *
 * Call this hook once at the AppShell level. It has no return value.
 */

import { useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAppStore } from '../../store/useAppStore';
import { getActiveSequence } from '../../lib/timelineSelectors';

export function usePlaybackEngine(): void {
  const isPlaying = useAppStore((s) => s.isPlaying);

  const acRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Map<string, ArrayBuffer>>(new Map());
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const genRef = useRef(0);

  function stopAllSources() {
    for (const src of scheduledSourcesRef.current) {
      try { src.stop(0); } catch { /* already ended naturally */ }
    }
    scheduledSourcesRef.current = [];
  }

  function cancelRaf() {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }

  // ── Play / Pause lifecycle ────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isPlaying) {
      cancelRaf();
      stopAllSources();
      // Close AudioContext so next play starts fresh (avoids WebKitGTK
      // auto-suspend bugs where resume() succeeds but output is silent).
      if (acRef.current) {
        acRef.current.close().catch(() => {});
        acRef.current = null;
      }
      return;
    }

    // Generation counter — every await checks this to abort if a newer
    // play session has started.
    const gen = ++genRef.current;

    const startSeqTime = useAppStore.getState().currentTime;
    const startWall = performance.now();

    // ── RAF loop: advances store currentTime ────────────────────────────────
    function tick() {
      if (gen !== genRef.current) return;

      const elapsed = (performance.now() - startWall) / 1000;
      const newTime = startSeqTime + elapsed;

      const proj = useAppStore.getState().project;
      const seq = getActiveSequence(proj);
      const dur = seq?.duration ?? 0;

      if (dur > 0 && newTime >= dur) {
        useAppStore.getState().setCurrentTime(dur);
        useAppStore.getState().pause();
        stopAllSources();
        return;
      }

      useAppStore.getState().setCurrentTime(newTime);
      rafIdRef.current = requestAnimationFrame(tick);
    }

    rafIdRef.current = requestAnimationFrame(tick);

    // ── Audio scheduling ────────────────────────────────────────────────────
    (async () => {
      // Fresh AudioContext per play session.
      const ac = new AudioContext();
      acRef.current = ac;
      await ac.resume();

      if (gen !== genRef.current) { ac.close().catch(() => {}); return; }

      const proj = useAppStore.getState().project;
      const seq = getActiveSequence(proj);
      if (!seq || !proj) return;

      const acBase = ac.currentTime;

      for (const track of seq.tracks) {
        if (track.kind !== 'audio' || track.muted) continue;

        for (const clip of track.clips) {
          if (gen !== genRef.current) return;
          if (clip.type !== 'audio' || !clip.assetId) continue;

          const clipEnd = clip.start + clip.duration;
          if (clipEnd <= startSeqTime) continue;

          const asset = proj.assets.find((a) => a.id === clip.assetId);
          if (!asset || asset.status !== 'ready' || !asset.localPath) continue;

          // ── Load (and cache) the raw ArrayBuffer, then decode per-AC ────
          let rawBuf = bufferCacheRef.current.get(asset.id);
          if (!rawBuf) {
            try {
              const url = convertFileSrc(asset.localPath);
              const resp = await fetch(url);
              rawBuf = await resp.arrayBuffer();
              bufferCacheRef.current.set(asset.id, rawBuf);
            } catch {
              continue;
            }
          }

          if (gen !== genRef.current) return;

          let buffer: AudioBuffer;
          try {
            // decodeAudioData detaches the ArrayBuffer, so pass a copy.
            buffer = await ac.decodeAudioData(rawBuf.slice(0));
          } catch {
            continue;
          }

          if (gen !== genRef.current) return;

          // ── Compute scheduling parameters ───────────────────────────────
          const delayInAudio = Math.max(0, clip.start - startSeqTime);
          const bufferOffset = clip.inPoint + Math.max(0, startSeqTime - clip.start);
          const remaining = clipEnd - startSeqTime;
          const playDuration = Math.min(remaining, buffer.duration - bufferOffset);

          if (playDuration <= 0) continue;

          // ── Wire gain + fades ───────────────────────────────────────────
          const gain = ac.createGain();
          const clipVol = clip.volume ?? 1.0;
          gain.gain.setValueAtTime(clipVol, acBase + delayInAudio);

          const fadeInDur = clip.fadeIn ?? 0;
          const fadeOutDur = clip.fadeOut ?? 0;

          if (fadeInDur > 0 && delayInAudio === 0 && startSeqTime <= clip.start + fadeInDur) {
            const fadeInProgress = Math.max(0, startSeqTime - clip.start);
            const remainingFade = fadeInDur - fadeInProgress;
            const startVol = clipVol * (fadeInProgress / fadeInDur);
            gain.gain.setValueAtTime(startVol, acBase);
            gain.gain.linearRampToValueAtTime(clipVol, acBase + remainingFade);
          }

          if (fadeOutDur > 0) {
            const fadeOutStart = acBase + delayInAudio + playDuration - fadeOutDur;
            if (fadeOutStart > acBase) {
              gain.gain.setValueAtTime(clipVol, fadeOutStart);
              gain.gain.linearRampToValueAtTime(0, acBase + delayInAudio + playDuration);
            }
          }

          gain.connect(ac.destination);

          const src = ac.createBufferSource();
          src.buffer = buffer;
          src.connect(gain);
          src.start(acBase + delayInAudio, bufferOffset, playDuration);

          scheduledSourcesRef.current.push(src);
        }
      }
    })();

    return () => {
      cancelRaf();
      stopAllSources();
    };
  }, [isPlaying]); // intentional: only react to the play/pause toggle

  // ── Unmount cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelRaf();
      stopAllSources();
      acRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
