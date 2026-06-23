import { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { LatLng } from '../utils/geo';

const MAX_RESULTS = 8;

export interface SearchItem {
  name: string;
  lat: number;
  lng: number;
  subtitle: string;
}

interface PoiSearchProps {
  items: SearchItem[];
  onSelect: (pos: LatLng) => void;
}

export function PoiSearch({ items, onSelect }: PoiSearchProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = query.length === 0
    ? []
    : items
        .filter(item => item.name.toLowerCase().includes(query.toLowerCase()))
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

  function handleSelect(item: SearchItem) {
    onSelect({ lat: item.lat, lng: item.lng });
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
          placeholder="Search parks & hotspots…"
          className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 min-w-0"
          aria-label="Search parks and hotspots"
        />
        {query && (
          <button
            type="button"
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
          {results.map(item => (
            <li key={`${item.lat}:${item.lng}`}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 block"
                onClick={() => handleSelect(item)}
              >
                <span className="block truncate">{item.name}</span>
                <span className="block text-xs italic text-gray-400">{item.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
