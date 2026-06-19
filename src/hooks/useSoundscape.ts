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
  // Placeholder — completed in Task 2
  void recordings; void recentObs; void fetchBirdPhoto;
  void useState; void useEffect; void useRef; void useCallback;
  return { voices: [], isPlaying: false, toggle: () => {} };
}
