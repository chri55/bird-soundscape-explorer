import { useState, useEffect } from 'react';
import type { JSX } from 'react';
import type { EBirdObservation, EBirdTaxon } from '../api/ebird';
import { fetchTaxonomy } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import { fetchBirdPhoto } from '../api/inat';
import type { XCRecording } from '../api/xeno-canto';
import { bestRecording } from '../utils/species';
import { Skeleton } from './Skeleton';

export interface SpeciesDetailProps {
  obs: EBirdObservation;
  recordings: XCRecording[];
  onBack: () => void;
}

export function SpeciesDetail({ obs, recordings, onBack }: SpeciesDetailProps): JSX.Element {
  const [photo, setPhoto] = useState<BirdPhoto | null>(null);
  const [taxon, setTaxon] = useState<EBirdTaxon | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchBirdPhoto(obs.sciName), fetchTaxonomy([obs.speciesCode])])
      .then(([p, taxa]) => {
        if (!cancelled) { setPhoto(p); setTaxon(taxa[0] ?? null); setLoading(false); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [obs.sciName, obs.speciesCode]);

  const recording = bestRecording(obs.sciName, recordings);

  const datePart = obs.obsDt.split(' ')[0] ?? obs.obsDt;
  const [year, month, day] = datePart.split('-').map(Number);
  const dateStr = new Date(year, (month ?? 1) - 1, day ?? 1)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Back button */}
      <div className="shrink-0 px-4 py-2 border-b border-gray-100">
        <button
          onClick={onBack}
          className="text-sm text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
        >
          ← Back
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          <Skeleton className="w-full aspect-video" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="shrink-0">
            {photo ? (
              <img
                src={photo.photoUrl}
                alt={obs.comName}
                className="w-full aspect-video object-cover"
              />
            ) : (
              <div className="w-full aspect-video bg-gray-800" />
            )}
          </div>

          {/* Names */}
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{obs.comName}</h2>
            <p className="text-sm italic text-gray-500 mt-0.5">{obs.sciName}</p>
          </div>

          {/* Taxonomy */}
          {taxon && (
            <div className="px-4 py-1 text-xs text-gray-500">
              {taxon.order} · {taxon.familyComName}
            </div>
          )}

          {/* Observation data */}
          <div className="px-4 py-2 text-xs text-gray-600 space-y-1">
            {(obs.howMany ?? 0) > 0 && <p>{obs.howMany} seen</p>}
            <p>{dateStr}</p>
            <p>{obs.locName}</p>
          </div>

          {/* Recording credit */}
          {recording && (
            <div className="px-4 py-2 text-xs text-gray-500">
              <p>Recording by {recording.rec} · {recording.type} · Quality {recording.q}</p>
            </div>
          )}

          {/* Photo attribution */}
          {photo && (
            <div className="mt-auto px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
              <p>{photo.attribution}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
