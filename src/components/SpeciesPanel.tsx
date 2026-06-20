import { useState } from 'react';
import type { JSX } from 'react';
import type { EBirdObservation } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';
import { deduplicateObs } from '../utils/species';
import { Skeleton } from './Skeleton';
import { SpeciesListRow } from './SpeciesListRow';
import { SpeciesDetail } from './SpeciesDetail';

export interface SpeciesPanelProps {
  notableObs: EBirdObservation[];
  recentObs: EBirdObservation[];
  recordings: XCRecording[];
  isLoading: boolean;
}

export function SpeciesPanel({ notableObs, recentObs, recordings, isLoading }: SpeciesPanelProps): JSX.Element {
  const [selected, setSelected] = useState<EBirdObservation | null>(null);

  if (selected) {
    return (
      <div className="w-80 flex flex-col bg-white border-l border-gray-200 shrink-0 overflow-y-auto">
        <SpeciesDetail obs={selected} recordings={recordings} onBack={() => setSelected(null)} />
      </div>
    );
  }

  const dedupedNotable = deduplicateObs(notableObs);
  const dedupedRecent = [...deduplicateObs(recentObs)].sort(
    (a, b) => (b.howMany ?? 0) - (a.howMany ?? 0),
  );

  const isEmpty = !isLoading && dedupedNotable.length === 0 && dedupedRecent.length === 0;

  return (
    <div className="w-80 flex flex-col bg-white border-l border-gray-200 shrink-0 overflow-y-auto">
      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-gray-400 text-sm">
            Drop a pin on the map to discover birds in this area
          </p>
        </div>
      ) : isLoading ? (
        <div className="p-4 space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-2">
            Rarest Sightings
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-2 mt-2">
            Most Common
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <>
          {dedupedNotable.length > 0 && (
            <section>
              <div className="sticky top-0 bg-white px-4 py-2 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Rarest Sightings
                </h3>
              </div>
              {dedupedNotable.map(obs => (
                <SpeciesListRow
                  key={obs.sciName}
                  obs={obs}
                  isNotable={true}
                  onClick={() => setSelected(obs)}
                />
              ))}
            </section>
          )}
          {dedupedRecent.length > 0 && (
            <section>
              <div className="sticky top-0 bg-white px-4 py-2 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Most Common
                </h3>
              </div>
              {dedupedRecent.map(obs => (
                <SpeciesListRow
                  key={obs.sciName}
                  obs={obs}
                  isNotable={false}
                  onClick={() => setSelected(obs)}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
