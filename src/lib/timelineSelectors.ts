import type { Project } from '../types/project';
import type { Clip, Sequence, Track } from '../types/timeline';

/** Returns the active sequence from the project, or undefined if none. */
export function getActiveSequence(project: Project | null): Sequence | undefined {
  if (!project) return undefined;
  return project.sequences.find((s) => s.id === project.activeSequenceId);
}

/** Returns a sequence by id. */
export function getSequenceById(project: Project | null, id: string): Sequence | undefined {
  return project?.sequences.find((s) => s.id === id);
}

/** Returns a track by id within the active sequence. */
export function getTrackById(project: Project | null, trackId: string): Track | undefined {
  return getActiveSequence(project)?.tracks.find((t) => t.id === trackId);
}

/** Returns a clip by id within a track. */
export function getClipById(track: Track, clipId: string): Clip | undefined {
  return track.clips.find((c) => c.id === clipId);
}

/**
 * Returns clips that overlap the given time (start <= time < start + duration).
 * Operates on a single track.
 */
export function getClipsAtTime(track: Track, time: number): Clip[] {
  return track.clips.filter(
    (c) => c.start <= time && time < c.start + c.duration,
  );
}

/**
 * Hook-friendly selector: finds the topmost visible image clip at the given
 * time across all non-muted video tracks (V1 takes priority over V2, etc.).
 * Returns the first matching clip, or undefined.
 */
export function useActiveVideoClip(
  project: Project | null,
  currentTime: number,
): Clip | undefined {
  const seq = getActiveSequence(project);
  if (!seq) return undefined;

  const videoTracks = seq.tracks.filter((t) => t.kind === 'video' && !t.muted && !t.locked);
  for (const track of videoTracks) {
    const clip = getClipsAtTime(track, currentTime).find((c) => c.type === 'image');
    if (clip) return clip;
  }
  return undefined;
}

/**
 * Returns all audio clips that are active at the given time across all
 * non-muted audio tracks. Used by the playback engine to schedule audio.
 */
export function getActiveAudioClips(project: Project | null, currentTime: number): Clip[] {
  const seq = getActiveSequence(project);
  if (!seq) return [];

  return seq.tracks
    .filter((t) => t.kind === 'audio' && !t.muted)
    .flatMap((t) => getClipsAtTime(t, currentTime));
}

/** Returns the end time (seconds) of the last clip on a track, or 0 for empty tracks. */
export function getTrackEndTime(track: Track): number {
  if (track.clips.length === 0) return 0;
  return Math.max(...track.clips.map((c) => c.start + c.duration));
}

/**
 * Returns all clips on a track whose start time is >= the given time.
 * Used by ripple insert to find clips that need to shift forward.
 */
export function getClipsStartingAtOrAfter(track: Track, time: number): Clip[] {
  return track.clips.filter((c) => c.start >= time);
}
