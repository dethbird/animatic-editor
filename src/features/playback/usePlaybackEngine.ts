/**
 * usePlaybackEngine
 *
 * Drives two things while isPlaying is true:
 *  1. A requestAnimationFrame loop that advances currentTime in the store.
 *  2. Web Audio API scheduling for all audio clips in the active sequence,
 *     respecting volume, inPoint, fadeIn, and fadeOut.
 *
 * Call this hook once at the AppShell level. It has no return value.
 */

import { useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAppStore } from '../../store/useAppStore';
import { getActiveSequence } from '../../lib/timelineSelectors';

export function usePlaybackEngine(): void {
  // Only subscribe to isPlaying — all other state is read via getState() to
  // avoid stale closures and prevent unnecessary re-renders.
  const isPlaying = useAppStore((s) => s.isPlaying);

  const acRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const rafIdRef = useRef<number | null>(null);

  // ── Stable helpers (only touch refs, no closure over render values) ──────

  function getAc(): AudioContext {
    if (!acRef.current || acRef.current.state === 'closed') {
      acRef.current = new AudioContext();
    }
    return acRef.current;
  }

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
      return;
    }

    // Read current position directly from store (avoids stale closure).
    const startSeqTime = useAppStore.getState().currentTime;
    const startWall = performance.now();

    // ── RAF loop: advances store currentTime ────────────────────────────────
    function tick() {
      const elapsed = (performance.now() - startWall) / 1000;
      const newTime = startSeqTime + elapsed;

      const proj = useAppStore.getState().project;
      const seq = getActiveSequence(proj);
      const dur = seq?.duration ?? 0;

      if (dur > 0 && newTime >= dur) {
        // Reached end — clamp and stop.
        useAppStore.getState().setCurrentTime(dur);
        useAppStore.getState().pause();
        stopAllSources();
        return; // do NOT re-queue another frame
      }

      useAppStore.getState().setCurrentTime(newTime);
      rafIdRef.current = requestAnimationFrame(tick);
    }

    rafIdRef.current = requestAnimationFrame(tick);

    // ── Audio scheduling ────────────────────────────────────────────────────
    // Fire-and-forget async IIFE; RAF above starts immediately so the UI
    // stay responsive even if buffer loading takes a moment.
    (async () => {
      const ac = getAc();
      await ac.resume();

      const proj = useAppStore.getState().project;
      const seq = getActiveSequence(proj);
      if (!seq || !proj) return;

      // Snapshot the AudioContext clock at the moment we begin scheduling.
      // All clip start times are expressed relative to this base.
      const acBase = ac.currentTime;

      for (const track of seq.tracks) {
        if (track.kind !== 'audio' || track.muted) continue;

        for (const clip of track.clips) {
          if (clip.type !== 'audio' || !clip.assetId) continue;

          // Skip clips that have already ended.
          const clipEnd = clip.start + clip.duration;
          if (clipEnd <= startSeqTime) continue;

          const asset = proj.assets.find((a) => a.id === clip.assetId);
          if (!asset || asset.status !== 'ready' || !asset.localPath) continue;

          // ── Load (and cache) the decoded audio buffer ───────────────────
          let buffer = bufferCacheRef.current.get(asset.id);
          if (!buffer) {
            try {
              const url = convertFileSrc(asset.localPath);
              const resp = await fetch(url);
              const ab = await resp.arrayBuffer();
              buffer = await ac.decodeAudioData(ab);
              bufferCacheRef.current.set(asset.id, buffer);
            } catch {
              continue; // skip unloadable assets
            }
          }

          // ── Compute scheduling parameters ───────────────────────────────
          // How many seconds until this clip should start (could be 0 if we
          // are already mid-clip).
          const delayInAudio = Math.max(0, clip.start - startSeqTime);

          // Where inside the source buffer to begin reading from (accounts
          // for inPoint + seeking into a clip that has already started).
          const bufferOffset = clip.inPoint + Math.max(0, startSeqTime - clip.start);

          // How many seconds of audio to play (clip remainder, capped at
          // remaining buffer length).
          const remaining = clipEnd - startSeqTime;
          const playDuration = Math.min(remaining, buffer.duration - bufferOffset);

          if (playDuration <= 0) continue;

          // ── Wire gain + fades ───────────────────────────────────────────
          const gain = ac.createGain();
          gain.gain.setValueAtTime(clip.volume ?? 1.0, acBase + delayInAudio);

          const clipVol = clip.volume ?? 1.0;
          const fadeInDur = clip.fadeIn ?? 0;
          const fadeOutDur = clip.fadeOut ?? 0;

          // Fade in only applies when starting at (or before) the clip head.
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

          // ── Create and schedule the buffer source ───────────────────────
          const src = ac.createBufferSource();
          src.buffer = buffer;
          src.connect(gain);
          src.start(acBase + delayInAudio, bufferOffset, playDuration);

          scheduledSourcesRef.current.push(src);
        }
      }
    })();

    // Cleanup: runs when isPlaying flips to false (or component unmounts).
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
