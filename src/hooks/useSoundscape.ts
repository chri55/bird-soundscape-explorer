import { useState, useEffect, useRef, useCallback } from 'react';
import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import { fetchBirdPhoto } from '../api/inat';
import { fetchRecordings } from '../api/xeno-canto';
import { qualityRank, typeScore } from '../utils/recording-quality';
import { bestRecording } from '../utils/species';
import { readBlocklist, addToBlocklist } from '../utils/xc-blocklist';

export const MIN_INTERVAL_MS = 3_000;
export const MAX_INTERVAL_MS = 30_000;
export const JITTER_FACTOR = 0.25;
export const MAX_VOICES = 8;
export const INITIAL_STAGGER_MS = 3_000;
export const INITIAL_VOICES = 3;
export const SECONDARY_STAGGER_MIN_MS = 1_000;
export const SECONDARY_STAGGER_MAX_MS = 6_000;
export const SPARE_VOICES = 4;
export const MAX_AUDIO_RETRIES = 2;
export const RETRY_DELAY_MS = 1_000;
export const MAX_REROLL_ATTEMPTS = 5;

export interface SoundscapeVoice {
  recording: XCRecording;
  sciName: string;
  howMany: number;
  intervalMs: number;
  isActive: boolean;
  isLoading: boolean;
  isFailed: boolean;
  isMuted: boolean;
  photo: BirdPhoto | null;
}

export interface UseSoundscapeResult {
  voices: SoundscapeVoice[];
  isPlaying: boolean;
  toggle: () => void;
  toggleMute: (index: number) => void;
  muteAll: () => void;
  allMuted: boolean;
  loadedCount: number;
  rerollVoice: (index: number) => void;
}

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
  notableObs: EBirdObservation[] = [],
): UseSoundscapeResult {
  const [voices, setVoices] = useState<SoundscapeVoice[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRefs    = useRef<HTMLAudioElement[]>([]);
  const timersRef    = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<number[]>([]);
  const isPlayingRef = useRef(false);
  const sparePoolRef = useRef<{ recording: XCRecording; sciName: string; howMany: number }[]>([]);
  const retryCountsRef = useRef<number[]>([]);
  const pendingEndedRef = useRef<boolean[]>([]);
  const isMutedRef = useRef<boolean[]>([]);
  const endedHandlersRef = useRef<Array<(() => void) | undefined>>([]);
  const notableObsRef = useRef<EBirdObservation[]>(notableObs);
  const recentObsRef  = useRef<EBirdObservation[]>(recentObs);
  const voicesRef     = useRef<SoundscapeVoice[]>([]);
  const rerollSeqRef  = useRef<number[]>([]);

  const stopAll = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; a.src = ''; a.load(); });
    isPlayingRef.current = false;
    setIsPlaying(false);
    setVoices(v => v.map(voice => ({ ...voice, isActive: false })));
  }, []);

  const pauseAll = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; });
    isPlayingRef.current = false;
    setIsPlaying(false);
    setVoices(v => v.map(voice => ({ ...voice, isActive: false })));
  }, []);

  useEffect(() => { notableObsRef.current = notableObs; }, [notableObs]);
  useEffect(() => { recentObsRef.current  = recentObs;  }, [recentObs]);
  useEffect(() => { voicesRef.current     = voices;     }, [voices]);

  const startVoice = useCallback((index: number) => {
    const audio = audioRefs.current[index];
    if (!audio || !isPlayingRef.current || isMutedRef.current[index]) return;

    void audio.play();
    setVoices(v => v.map((voice, i) => i === index ? { ...voice, isActive: true } : voice));

    if (!pendingEndedRef.current[index]) {
      pendingEndedRef.current[index] = true;

      // Remove any stale ended handler from a previous voice at this slot
      const oldHandler = endedHandlersRef.current[index];
      if (oldHandler) {
        audio.removeEventListener('ended', oldHandler);
      }

      const handler = () => {
        pendingEndedRef.current[index] = false;
        endedHandlersRef.current[index] = undefined;
        setVoices(v => v.map((voice, i) => i === index ? { ...voice, isActive: false } : voice));
        if (!isPlayingRef.current || isMutedRef.current[index]) return;
        const delay = applyJitter(intervalsRef.current[index] ?? MAX_INTERVAL_MS);
        timersRef.current.push(setTimeout(() => startVoice(index), delay));
      };
      endedHandlersRef.current[index] = handler;
      audio.addEventListener('ended', handler, { once: true } as AddEventListenerOptions);
    }
  }, []);

  // Stable keys derived from content so the effect doesn't re-fire on every render
  // when the caller passes inline array literals.
  const recordingsKey = recordings.map(r => r.id).join(',');
  const recentObsKey  = recentObs.map(o => o.sciName + o.howMany).join(',');

  // Rebuild when source data changes
  useEffect(() => {
    for (let i = 0; i < rerollSeqRef.current.length; i++) {
      rerollSeqRef.current[i] = (rerollSeqRef.current[i] ?? 0) + 1;
    }
    stopAll();
    pendingEndedRef.current = [];
    isMutedRef.current = [];
    endedHandlersRef.current = [];
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
        isMuted: false,
        photo: null,
      })),
    );

    // replaceFailedVoice and attachAudioListeners are mutually recursive function
    // declarations — both hoisted to the top of this arrow-function scope, so each
    // can reference the other regardless of source order.

    function replaceFailedVoice(idx: number) {
      const a = audioRefs.current[idx];
      if (a) {
        // Remove any stale ended listener before discarding this audio element
        const oldEnded = endedHandlersRef.current[idx];
        if (oldEnded) {
          a.removeEventListener('ended', oldEnded);
          endedHandlersRef.current[idx] = undefined;
        }
        a.src = ''; a.load();
      }

      const spare = sparePoolRef.current.shift();
      if (!spare) {
        setVoices(v => v.map((voice, vi) => vi === idx ? { ...voice, isFailed: true } : voice));
        return;
      }

      const newAudio = new Audio(spare.recording.file);
      audioRefs.current[idx] = newAudio;
      retryCountsRef.current[idx] = 0;
      intervalsRef.current[idx] = MAX_INTERVAL_MS;
      pendingEndedRef.current[idx] = false;
      isMutedRef.current[idx] = false;

      setVoices(v => v.map((voice, vi) => vi === idx ? {
        recording: spare.recording,
        sciName: spare.sciName,
        howMany: spare.howMany,
        intervalMs: MAX_INTERVAL_MS,
        isActive: false,
        isLoading: true,
        isFailed: false,
        isMuted: false,
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
          timersRef.current.push(setTimeout(() => {
            if (cancelled) return;
            const a = audioRefs.current[idx];
            if (!a) return;
            a.src = a.src;
            a.load();
            attachAudioListeners(a, idx);
          }, RETRY_DELAY_MS));
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
      setVoices(v => v.map((voice, i) =>
        voice.recording.id !== selected[i]?.recording.id
          ? voice
          : { ...voice, photo: photos[i] ?? null },
      ));
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingsKey, recentObsKey, stopAll]);

  const toggleMute = useCallback((index: number) => {
    const audio = audioRefs.current[index];
    if (!audio) return;

    if (!isMutedRef.current[index]) {
      isMutedRef.current[index] = true;
      audio.pause();
      audio.currentTime = 0;
      setVoices(v => v.map((voice, i) => i === index ? { ...voice, isMuted: true, isActive: false } : voice));
    } else {
      isMutedRef.current[index] = false;
      setVoices(v => v.map((voice, i) => i === index ? { ...voice, isMuted: false } : voice));
      if (isPlayingRef.current) startVoice(index);
    }
  }, [startVoice]);

  const muteAll = useCallback(() => {
    const count = audioRefs.current.length;
    if (count === 0) return;
    const currentlyAllMuted =
      isMutedRef.current.length === count && isMutedRef.current.every(Boolean);
    if (currentlyAllMuted) {
      isMutedRef.current = new Array(count).fill(false);
      setVoices(v => v.map(voice => ({ ...voice, isMuted: false, isActive: isPlayingRef.current })));
      if (isPlayingRef.current) {
        audioRefs.current.forEach((_, i) => startVoice(i));
      }
    } else {
      isMutedRef.current = new Array(count).fill(true);
      audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; });
      setVoices(v => v.map(voice => ({ ...voice, isMuted: true, isActive: false })));
    }
  }, [startVoice]);

  const rerollVoice = useCallback((index: number) => {
    // Stop and discard old audio for this slot
    const oldAudio = audioRefs.current[index];
    if (oldAudio) {
      const oldEnded = endedHandlersRef.current[index];
      if (oldEnded) {
        oldAudio.removeEventListener('ended', oldEnded);
        endedHandlersRef.current[index] = undefined;
      }
      oldAudio.pause();
      oldAudio.src = '';
      oldAudio.load();
    }
    isMutedRef.current[index]   = false;
    pendingEndedRef.current[index] = false;

    setVoices(v => v.map((voice, i) =>
      i === index ? { ...voice, isLoading: true, isActive: false, isFailed: false } : voice,
    ));

    // Build candidate list — union of notableObs + recentObs, deduped, excluding
    // species active in other slots and species in the 24h XC blocklist
    const activeSciNames = new Set(
      voicesRef.current.filter((_, i) => i !== index).map(v => v.sciName),
    );
    const blocklist = readBlocklist();
    const seen = new Set<string>();
    const allObs = [...notableObsRef.current, ...recentObsRef.current];
    const candidates: EBirdObservation[] = [];
    for (const obs of allObs) {
      if (!seen.has(obs.sciName) && !activeSciNames.has(obs.sciName) && !blocklist.has(obs.sciName)) {
        seen.add(obs.sciName);
        candidates.push(obs);
      }
    }
    candidates.sort((a, b) => (b.howMany ?? 0) - (a.howMany ?? 0));

    rerollSeqRef.current[index] = (rerollSeqRef.current[index] ?? 0) + 1;
    const mySeq = rerollSeqRef.current[index];

    void (async () => {
      for (const candidate of candidates.slice(0, MAX_REROLL_ATTEMPTS)) {
        const parts = candidate.sciName.trim().split(/\s+/);
        if (parts.length < 2 || !/^[A-Za-z]+$/.test(parts[1]!)) continue;
        const [genus, species] = parts;
        try {
          const response = await fetchRecordings(`gen:${genus} sp:${species}`);
          if (rerollSeqRef.current[index] !== mySeq) return;
          const best = bestRecording(candidate.sciName, response.recordings);
          if (best) {
            const newAudio = new Audio(best.file);
            audioRefs.current[index]       = newAudio;
            retryCountsRef.current[index]  = 0;
            intervalsRef.current[index]    = MAX_INTERVAL_MS;

            newAudio.addEventListener('canplay', () => {
              setVoices(v => v.map((voice, i) =>
                i === index ? { ...voice, isLoading: false } : voice,
              ));
              if (isPlayingRef.current && !isMutedRef.current[index]) startVoice(index);
            }, { once: true } as AddEventListenerOptions);

            newAudio.addEventListener('error', () => {
              setVoices(v => v.map((voice, i) =>
                i === index ? { ...voice, isFailed: true, isLoading: false } : voice,
              ));
            }, { once: true } as AddEventListenerOptions);

            const photo = await fetchBirdPhoto(candidate.sciName).catch(() => null);

            if (rerollSeqRef.current[index] !== mySeq) {
              newAudio.pause();
              newAudio.src = '';
              newAudio.load();
              return;
            }

            setVoices(v => v.map((voice, i) => i === index ? {
              recording: best,
              sciName:   candidate.sciName,
              howMany:   candidate.howMany ?? 1,
              intervalMs: MAX_INTERVAL_MS,
              isActive:  false,
              isLoading: true,
              isFailed:  false,
              isMuted:   false,
              photo:     photo ?? null,
            } : voice));
            return;
          } else {
            addToBlocklist(candidate.sciName);
          }
        } catch {
          // Network error — skip this candidate without blocklisting it
        }
      }
      // All attempts exhausted
      if (rerollSeqRef.current[index] !== mySeq) return;
      setVoices(v => v.map((voice, i) =>
        i === index ? { ...voice, isFailed: true, isLoading: false } : voice,
      ));
    })();
  }, [startVoice]);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      pauseAll();
    } else {
      const count = audioRefs.current.length;
      isMutedRef.current = new Array(count).fill(false);
      setVoices(v => v.map(voice => ({ ...voice, isMuted: false })));
      isPlayingRef.current = true;
      setIsPlaying(true);
      audioRefs.current.forEach((_, i) => {
        const delay = i < INITIAL_VOICES
          ? Math.random() * INITIAL_STAGGER_MS
          : INITIAL_STAGGER_MS
            + SECONDARY_STAGGER_MIN_MS
            + Math.random() * (SECONDARY_STAGGER_MAX_MS - SECONDARY_STAGGER_MIN_MS);
        timersRef.current.push(setTimeout(() => startVoice(i), delay));
      });
    }
  }, [pauseAll, startVoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      audioRefs.current.forEach(a => a.pause());
    };
  }, []);

  const allMuted = voices.length > 0 && voices.every(v => v.isMuted);
  const loadedCount = voices.filter(v => !v.isLoading && !v.isFailed).length;

  return { voices, isPlaying, toggle, toggleMute, muteAll, allMuted, loadedCount, rerollVoice };
}
