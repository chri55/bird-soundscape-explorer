import { useState, useEffect } from 'react';
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
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    setFilterQuery('');
  }, [notableObs, recentObs]);

  if (selected) {
    return (
      <div className="w-full h-full md:w-80 flex flex-col bg-white border-b border-gray-200 md:border-b-0 md:border-l shrink-0 overflow-y-auto md:order-last">
        <SpeciesDetail obs={selected} recordings={recordings} onBack={() => setSelected(null)} />
      </div>
    );
  }

  const dedupedNotable = deduplicateObs(notableObs);
  const dedupedRecent = [...deduplicateObs(recentObs)].sort(
    (a, b) => (b.howMany ?? 0) - (a.howMany ?? 0),
  );

  const isEmpty = !isLoading && dedupedNotable.length === 0 && dedupedRecent.length === 0;

  const q = filterQuery.toLowerCase();
  const filteredNotable = dedupedNotable.filter(
    obs => !q || obs.comName.toLowerCase().includes(q) || obs.sciName.toLowerCase().includes(q),
  );
  const filteredRecent = dedupedRecent.filter(
    obs => !q || obs.comName.toLowerCase().includes(q) || obs.sciName.toLowerCase().includes(q),
  );

  return (
    <div className="w-full h-full md:w-80 flex flex-col bg-white border-b border-gray-200 md:border-b-0 md:border-l shrink-0 overflow-y-auto md:order-last">
      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-gray-500 text-sm">
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
          <div className="shrink-0 px-3 py-2 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="Filter birds…"
                className="w-full text-sm rounded-md border border-gray-200 px-3 py-1.5 pr-7 outline-none focus:border-green-400 text-gray-800 placeholder-gray-400"
                aria-label="Filter species"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  aria-label="Clear filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {dedupedNotable.length > 0 && (
            <section>
              <div className="sticky top-0 bg-white px-4 py-2 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Rarest Sightings
                </h3>
              </div>
              {filteredNotable.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">No matches</p>
              ) : (
                filteredNotable.map(obs => (
                  <SpeciesListRow
                    key={obs.sciName}
                    obs={obs}
                    isNotable={true}
                    onClick={() => setSelected(obs)}
                  />
                ))
              )}
            </section>
          )}
          {dedupedRecent.length > 0 && (
            <section>
              <div className="sticky top-0 bg-white px-4 py-2 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Most Common
                </h3>
              </div>
              {filteredRecent.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">No matches</p>
              ) : (
                filteredRecent.map(obs => (
                  <SpeciesListRow
                    key={obs.sciName}
                    obs={obs}
                    isNotable={false}
                    onClick={() => setSelected(obs)}
                  />
                ))
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
