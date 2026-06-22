import type { JSX } from 'react';
import type { DeduplicatedObs } from '../utils/species';

export interface SpeciesListRowProps {
  obs: DeduplicatedObs;
  isNotable: boolean;
  onClick: () => void;
}

function parseDatePart(dt: string): Date {
  const [year, month, day] = dt.slice(0, 10).split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function SpeciesListRow({ obs, isNotable, onClick }: SpeciesListRowProps): JSX.Element {
  const firstDate = parseDatePart(obs.firstObsDt);
  const lastDate = parseDatePart(obs.obsDt);
  const sameDay = obs.firstObsDt.slice(0, 10) === obs.obsDt.slice(0, 10);

  let dateStr: string;
  if (sameDay) {
    dateStr = lastDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } else if (firstDate.getFullYear() === lastDate.getFullYear()) {
    const first = firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const last = lastDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    dateStr = `${first} – ${last}`;
  } else {
    const first = firstDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const last = lastDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    dateStr = `${first} – ${last}`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 flex items-start justify-between gap-2"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 text-sm truncate">{obs.comName}</p>
        <p className="italic text-gray-500 text-xs truncate">{obs.sciName}</p>
        <p className="text-gray-500 text-xs truncate mt-0.5">{dateStr} · {obs.locName}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {(obs.howMany ?? 0) > 0 && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {obs.howMany} seen
          </span>
        )}
        {isNotable && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            Notable
          </span>
        )}
      </div>
    </button>
  );
}
