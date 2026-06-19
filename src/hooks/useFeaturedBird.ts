import { useState, useEffect } from 'react';
import type { EBirdObservation, EBirdTaxon } from '../api/ebird';
import { fetchTaxonomy } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import { fetchBirdPhoto } from '../api/inat';
import type { XCRecording } from '../api/xeno-canto';

export interface UseFeaturedBirdInput {
  notableObservations: EBirdObservation[];
  recentObservations: EBirdObservation[];
  recordings: XCRecording[];
}

export interface UseFeaturedBirdResult {
  observation: EBirdObservation | null;
  taxon: EBirdTaxon | null;
  photo: BirdPhoto | null;
  recording: XCRecording | null;
  isNotable: boolean;
  mode: 'rarest' | 'common';
  onToggleMode: () => void;
  showToggle: boolean;
  loading: boolean;
}

function selectFeatured(
  mode: 'rarest' | 'common',
  notable: EBirdObservation[],
  recent: EBirdObservation[],
): { obs: EBirdObservation | null; isNotable: boolean; showToggle: boolean } {
  const hasNotable = notable.length > 0;

  if (mode === 'rarest' && hasNotable) {
    return { obs: notable[0], isNotable: true, showToggle: true };
  }

  const mostCommon = recent.reduce<EBirdObservation | null>(
    (best, obs) => (!best || (obs.howMany ?? 0) > (best.howMany ?? 0) ? obs : best),
    null,
  );

  return { obs: mostCommon, isNotable: false, showToggle: hasNotable };
}

function bestRecording(sciName: string, recordings: XCRecording[]): XCRecording | null {
  const parts = sciName.toLowerCase().split(' ');
  const genus = parts[0] ?? '';
  const species = parts[1] ?? '';
  const qualityRank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const typeScore = (type: string) => (type.toLowerCase().includes('song') ? 0 : 1);

  const matches = recordings.filter(
    r => r.gen.toLowerCase() === genus && r.sp.toLowerCase() === species,
  );

  if (matches.length === 0) return null;

  return [...matches].sort((a, b) => {
    const qDiff = (qualityRank[a.q] ?? 5) - (qualityRank[b.q] ?? 5);
    return qDiff !== 0 ? qDiff : typeScore(a.type) - typeScore(b.type);
  })[0];
}

export function useFeaturedBird({
  notableObservations,
  recentObservations,
  recordings,
}: UseFeaturedBirdInput): UseFeaturedBirdResult {
  const [mode, setMode] = useState<'rarest' | 'common'>('rarest');
  const [photo, setPhoto] = useState<BirdPhoto | null>(null);
  const [taxon, setTaxon] = useState<EBirdTaxon | null>(null);
  const [loading, setLoading] = useState(false);

  const { obs, isNotable, showToggle } = selectFeatured(mode, notableObservations, recentObservations);

  useEffect(() => {
    if (!obs) {
      setPhoto(null);
      setTaxon(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchBirdPhoto(obs.sciName),
      fetchTaxonomy([obs.speciesCode]),
    ])
      .then(([p, taxa]) => {
        if (!cancelled) {
          setPhoto(p);
          setTaxon(taxa[0] ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhoto(null);
          setTaxon(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [obs?.speciesCode]);

  const recording = obs ? bestRecording(obs.sciName, recordings) : null;

  return {
    observation: obs,
    taxon,
    photo,
    recording,
    isNotable,
    mode,
    onToggleMode: () => setMode(m => (m === 'rarest' ? 'common' : 'rarest')),
    showToggle,
    loading,
  };
}
