import { useState, useEffect, useRef, useCallback } from 'react';
import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import { fetchBirdPhoto } from '../api/inat';

export const MIN_INTERVAL_MS = 3_000;
export const MAX_INTERVAL_MS = 30_000;
export const JITTER_FACTOR = 0.25;
export const MAX_VOICES = 8;
export const INITIAL_STAGGER_MS = 3_000;
export const INITIAL_VOICES = 3;
export const SPARE_VOICES = 4;
export const MAX_AUDIO_RETRIES = 2;
export const RETRY_DELAY_MS = 1_000;

export interface SoundscapeVoice {
  recording: XCRecording;
  sciName: string;
  howMany: number;
  intervalMs: number;
  isActive: boolean;
  isLoading: boolean;
  isFailed: boolean;
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
  limit = MAX_VOICES,
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
    .slice(0, limit);
}

export function computeIntervalMs(
  howMany: number,
  minHowMany: number,
  maxHowMany: number,
): number {
  const rawRatio =
    maxHowMany === minHowMany
      ? 0.5
      : (howMany - minHowMany) / (maxHowMany - minHowMany);
  const ratio = Math.max(0, Math.min(1, rawRatio));
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
  const sparePoolRef = useRef<{ recording: XCRecording; sciName: string; howMany: number }[]>([]);
  const retryCountsRef = useRef<number[]>([]);

  const stopAll = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; a.src = ''; a.load(); });
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
    let cancelled = false;

    const allCandidates = selectVoices(recordings, recentObs, MAX_VOICES + SPARE_VOICES);
    const selected = allCandidates.slice(0, MAX_VOICES);
    sparePoolRef.current = allCandidates.slice(MAX_VOICES);
    retryCountsRef.current = selected.map(() => 0);

    if (selected.length === 0) {
      setVoices([]);
      audioRefs.current = [];
      intervalsRef.current = [];
      return () => { cancelled = true; };
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
        isLoading: true,
        isFailed: false,
        photo: null,
      })),
    );

    // replaceFailedVoice and attachAudioListeners are mutually recursive function
    // declarations — both hoisted to the top of this arrow-function scope, so each
    // can reference the other regardless of source order.

    function replaceFailedVoice(idx: number) {
      const a = audioRefs.current[idx];
      if (a) { a.src = ''; a.load(); }

      const spare = sparePoolRef.current.shift();
      if (!spare) {
        setVoices(v => v.map((voice, vi) => vi === idx ? { ...voice, isFailed: true } : voice));
        return;
      }

      const newAudio = new Audio(spare.recording.file);
      audioRefs.current[idx] = newAudio;
      retryCountsRef.current[idx] = 0;
      intervalsRef.current[idx] = MAX_INTERVAL_MS;

      setVoices(v => v.map((voice, vi) => vi === idx ? {
        recording: spare.recording,
        sciName: spare.sciName,
        howMany: spare.howMany,
        intervalMs: MAX_INTERVAL_MS,
        isActive: false,
        isLoading: true,
        isFailed: false,
        photo: null,
      } : voice));

      attachAudioListeners(newAudio, idx);

      void fetchBirdPhoto(spare.sciName).catch(() => null).then(photo => {
        if (!cancelled) {
          setVoices(v => v.map((voice, vi) =>
            vi === idx ? { ...voice, photo: photo ?? null } : voice,
          ));
        }
      });

      if (isPlayingRef.current) {
        timersRef.current.push(
          setTimeout(() => startVoice(idx), Math.random() * INITIAL_STAGGER_MS),
        );
      }
    }

    function attachAudioListeners(audio: HTMLAudioElement, idx: number) {
      audio.addEventListener('canplay', () => {
        if (cancelled) return;
        setVoices(v => v.map((voice, vi) => vi === idx ? { ...voice, isLoading: false } : voice));
      }, { once: true } as AddEventListenerOptions);

      audio.addEventListener('error', () => {
        if (cancelled) return;
        const retries = retryCountsRef.current[idx] ?? 0;
        if (retries < MAX_AUDIO_RETRIES) {
          retryCountsRef.current[idx] = retries + 1;
          setTimeout(() => {
            if (cancelled) return;
            const a = audioRefs.current[idx];
            if (!a) return;
            a.src = a.src;
            a.load();
            attachAudioListeners(a, idx);
          }, RETRY_DELAY_MS);
        } else {
          replaceFailedVoice(idx);
        }
      }, { once: true } as AddEventListenerOptions);
    }

    audioRefs.current.forEach((audio, idx) => {
      attachAudioListeners(audio, idx);
    });

    void Promise.all(
      selected.map(s => fetchBirdPhoto(s.sciName).catch(() => null)),
    ).then(photos => {
      if (cancelled) return;
      setVoices(v => v.map((voice, i) => ({ ...voice, photo: photos[i] ?? null })));
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingsKey, recentObsKey, stopAll]);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      stopAll();
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      audioRefs.current.forEach((_, i) => {
        const delay = i < INITIAL_VOICES
          ? Math.random() * INITIAL_STAGGER_MS
          : (intervalsRef.current[i] ?? MAX_INTERVAL_MS);
        timersRef.current.push(setTimeout(() => startVoice(i), delay));
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
