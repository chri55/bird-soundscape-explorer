import { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { NpsPark } from '../api/nps';
import type { LatLng } from '../utils/geo';

const MAX_RESULTS = 8;

interface ParkSearchProps {
  parks: NpsPark[];
  onSelect: (pos: LatLng) => void;
}

export function ParkSearch({ parks, onSelect }: ParkSearchProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = query.length === 0
    ? []
    : parks
        .filter(p => p.fullName.toLowerCase().includes(query.toLowerCase()))
        .slice(0, MAX_RESULTS);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function handleSelect(park: NpsPark) {
    onSelect({ lat: parseFloat(park.latitude), lng: parseFloat(park.longitude) });
    setQuery('');
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center bg-white rounded-lg shadow-lg px-3 py-2 gap-2">
        <FontAwesomeIcon icon={faMagnifyingGlass} className="text-gray-400 text-sm shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => { if (query) setIsOpen(true); }}
          onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setIsOpen(false); } }}
          placeholder="Search national parks…"
          className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 min-w-0"
          aria-label="Search national parks"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); }}
            aria-label="Clear search"
            className="shrink-0"
          >
            <FontAwesomeIcon icon={faXmark} className="text-gray-400 hover:text-gray-600 text-sm" />
          </button>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <ul className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg shadow-lg overflow-hidden z-50">
          {results.map(park => (
            <li key={park.parkCode}>
              <button
                className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 truncate block"
                onClick={() => handleSelect(park)}
              >
                {park.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
