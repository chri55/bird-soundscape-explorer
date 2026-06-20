import type { JSX } from 'react';
import type { EBirdObservation } from '../api/ebird';

export interface SpeciesListRowProps {
  obs: EBirdObservation;
  isNotable: boolean;
  onClick: () => void;
}

export function SpeciesListRow({ obs, isNotable, onClick }: SpeciesListRowProps): JSX.Element {
  const datePart = obs.obsDt.split(' ')[0] ?? obs.obsDt;
  const [year, month, day] = datePart.split('-').map(Number);
  const dateStr = new Date(year, (month ?? 1) - 1, day ?? 1)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 flex items-start justify-between gap-2"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 text-sm truncate">{obs.comName}</p>
        {obs.sciName !== obs.comName && (
          <p className="italic text-gray-500 text-xs truncate">{obs.sciName}</p>
        )}
        <p className="text-gray-400 text-xs truncate mt-0.5">{dateStr} · {obs.locName}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {(obs.howMany ?? 0) > 0 && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {obs.howMany} seen
          </span>
        )}
        {isNotable && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            Rare
          </span>
        )}
      </div>
    </button>
  );
}
