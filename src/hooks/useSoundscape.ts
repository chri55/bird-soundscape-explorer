import { useState, useEffect, useRef, useCallback } from 'react';
import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import { fetchBirdPhoto } from '../api/inat';

export const MIN_INTERVAL_MS = 5_000;
export const MAX_INTERVAL_MS = 90_000;
export const JITTER_FACTOR = 0.25;
export const MAX_VOICES = 8;
export const INITIAL_STAGGER_MS = 3_000;

export interface SoundscapeVoice {
  recording: XCRecording;
  sciName: string;
  howMany: number;
  intervalMs: number;
  isActive: boolean;
  photo: BirdPhoto | null;
}

export interface UseSoundscapeResult {
  voices: SoundscapeVoice[];
  isPlaying: boolean;
  toggle: () => void;
}

const qualityRank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
const typeScore = (type: string) => (type.toLowerCase().includes('song') ? 0 : 1);

export function selectVoices(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
): { recording: XCRecording; sciName: string; howMany: number }[] {
  const howManyMap = new Map<string, number>(
    recentObs.map(obs => [obs.sciName, obs.howMany ?? 1]),
  );

  const bySpecies = new Map<string, XCRecording>();
  for (const rec of recordings) {
    const sciName = `${rec.gen} ${rec.sp}`;
    const existing = bySpecies.get(sciName);
    if (!existing) {
      bySpecies.set(sciName, rec);
    } else {
      const recScore = (qualityRank[rec.q] ?? 5) * 2 + typeScore(rec.type);
      const existScore = (qualityRank[existing.q] ?? 5) * 2 + typeScore(existing.type);
      if (recScore < existScore) bySpecies.set(sciName, rec);
    }
  }

  return [...bySpecies.entries()]
    .map(([sciName, recording]) => ({
      recording,
      sciName,
      howMany: howManyMap.get(sciName) ?? 1,
    }))
    .sort((a, b) => b.howMany - a.howMany)
    .slice(0, MAX_VOICES);
}

export function computeIntervalMs(
  howMany: number,
  minHowMany: number,
  maxHowMany: number,
): number {
  const ratio =
    maxHowMany === minHowMany
      ? 0.5
      : (howMany - minHowMany) / (maxHowMany - minHowMany);
  return MAX_INTERVAL_MS - ratio * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

export function applyJitter(baseMs: number): number {
  return baseMs * (1 + (Math.random() * 2 - 1) * JITTER_FACTOR);
}

export function useSoundscape(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
): UseSoundscapeResult {
  const [voices, setVoices] = useState<SoundscapeVoice[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRefs    = useRef<HTMLAudioElement[]>([]);
  const timersRef    = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<number[]>([]);
  const isPlayingRef = useRef(false);

  const stopAll = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; });
    isPlayingRef.current = false;
    setIsPlaying(false);
    setVoices(v => v.map(voice => ({ ...voice, isActive: false })));
  }, []);

  const startVoice = useCallback((index: number) => {
    const audio = audioRefs.current[index];
    if (!audio || !isPlayingRef.current) return;

    void audio.play();
    setVoices(v => v.map((voice, i) => i === index ? { ...voice, isActive: true } : voice));

    audio.addEventListener('ended', () => {
      setVoices(v => v.map((voice, i) => i === index ? { ...voice, isActive: false } : voice));
      if (!isPlayingRef.current) return;
      const delay = applyJitter(intervalsRef.current[index] ?? MAX_INTERVAL_MS);
      timersRef.current.push(setTimeout(() => startVoice(index), delay));
    }, { once: true } as AddEventListenerOptions);
  }, []);

  // Stable keys derived from content so the effect doesn't re-fire on every render
  // when the caller passes inline array literals.
  const recordingsKey = recordings.map(r => r.id).join(',');
  const recentObsKey  = recentObs.map(o => o.sciName + o.howMany).join(',');

  // Rebuild when source data changes
  useEffect(() => {
    stopAll();

    const selected = selectVoices(recordings, recentObs);
    if (selected.length === 0) {
      setVoices([]);
      audioRefs.current = [];
      intervalsRef.current = [];
      return;
    }

    const howManys = selected.map(s => s.howMany);
    const minH = Math.min(...howManys);
    const maxH = Math.max(...howManys);
    const intervals = selected.map(s => computeIntervalMs(s.howMany, minH, maxH));

    intervalsRef.current = intervals;
    audioRefs.current = selected.map(s => new Audio(s.recording.file));

    setVoices(
      selected.map((s, i) => ({
        recording: s.recording,
        sciName: s.sciName,
        howMany: s.howMany,
        intervalMs: intervals[i],
        isActive: false,
        photo: null,
      })),
    );

    void Promise.all(
      selected.map(s => fetchBirdPhoto(s.sciName).catch(() => null)),
    ).then(photos => {
      setVoices(v => v.map((voice, i) => ({ ...voice, photo: photos[i] ?? null })));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingsKey, recentObsKey, stopAll]);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      stopAll();
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      audioRefs.current.forEach((_, i) => {
        const stagger = Math.random() * INITIAL_STAGGER_MS;
        timersRef.current.push(setTimeout(() => startVoice(i), stagger));
      });
    }
  }, [stopAll, startVoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      audioRefs.current.forEach(a => a.pause());
    };
  }, []);

  return { voices, isPlaying, toggle };
}
