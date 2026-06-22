import { useState, useMemo } from 'react';

const STORAGE_KEY = 'bird_exclusions_v1';

export interface ExclusionEntry {
  sciName: string;
  comName: string;
}

function readStorage(): ExclusionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ExclusionEntry[];
  } catch {
    return [];
  }
}

function writeStorage(entries: ExclusionEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable — silently no-op
  }
}

export function useExclusionList(): {
  exclusions: ExclusionEntry[];
  excludedSciNames: Set<string>;
  addExclusion: (sciName: string, comName: string) => void;
  removeExclusion: (sciName: string) => void;
} {
  const [exclusions, setExclusions] = useState<ExclusionEntry[]>(() => readStorage());

  const excludedSciNames = useMemo(
    () => new Set(exclusions.map(e => e.sciName)),
    [exclusions],
  );

  const addExclusion = (sciName: string, comName: string) => {
    setExclusions(prev => {
      if (prev.some(e => e.sciName === sciName)) return prev;
      const next = [...prev, { sciName, comName }];
      writeStorage(next);
      return next;
    });
  };

  const removeExclusion = (sciName: string) => {
    setExclusions(prev => {
      const next = prev.filter(e => e.sciName !== sciName);
      writeStorage(next);
      return next;
    });
  };

  return { exclusions, excludedSciNames, addExclusion, removeExclusion };
}
