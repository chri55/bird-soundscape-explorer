import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { EBirdObservation } from '../api/ebird';
import type { ExclusionEntry } from '../hooks/useExclusionList';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableObs: EBirdObservation[];
  exclusions: ExclusionEntry[];
  onAddExclusion: (sciName: string, comName: string) => void;
  onRemoveExclusion: (sciName: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  availableObs,
  exclusions,
  onAddExclusion,
  onRemoveExclusion,
}: SettingsModalProps) {
  const [query, setQuery] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, input, a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    focusable[0].focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const first = focusable![0];
      const last = focusable![focusable!.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const excludedSciNames = new Set(exclusions.map(e => e.sciName));
  const results = availableObs
    .filter(obs =>
      !excludedSciNames.has(obs.sciName) &&
      obs.comName.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 8);

  const showDropdown = query.length > 0 && results.length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        ref={modalRef}
        className="w-full h-full flex flex-col bg-gray-900 overflow-hidden md:h-auto md:max-w-lg md:mx-4 md:max-h-[90vh] md:rounded-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
          <h2 id="settings-modal-title" className="text-white font-semibold">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="p-2 text-lg text-gray-400 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          <section>
            <h3 className="text-white font-medium mb-2">Excluded Birds</h3>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={availableObs.length === 0}
                placeholder={availableObs.length === 0 ? 'Drop a pin to see birds' : 'Search loaded birds…'}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              />
              {showDropdown && (
                <ul className="absolute top-full mt-1 w-full bg-gray-800 rounded shadow-lg z-10 overflow-hidden">
                  {results.map(obs => (
                    <li key={obs.sciName}>
                      <button
                        type="button"
                        onClick={() => {
                          onAddExclusion(obs.sciName, obs.comName);
                          setQuery('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors"
                      >
                        <div className="text-white text-sm">{obs.comName}</div>
                        <div className="text-gray-400 text-xs italic">{obs.sciName}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 space-y-1">
              {exclusions.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No birds excluded — soundscape picks from all available species.
                </p>
              ) : (
                exclusions.map(entry => (
                  <div key={entry.sciName} className="flex items-center justify-between py-1">
                    <span className="text-white text-sm">{entry.comName}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${entry.comName}`}
                      onClick={() => onRemoveExclusion(entry.sciName)}
                      className="p-1 text-gray-400 hover:text-white transition-colors ml-2 shrink-0"
                    >
                      <FontAwesomeIcon icon={faXmark} className="text-xs" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h3 className="text-white font-medium mb-2">About</h3>
            <dl className="space-y-1 text-sm text-gray-400">
              <div>
                <dt className="inline">
                  <a href="https://ebird.org" target="_blank" rel="noopener noreferrer"
                     className="font-medium text-gray-300 hover:underline">eBird</a>
                </dt>
                <dd className="inline"> (Cornell Lab of Ornithology) — Recent bird sighting data</dd>
              </div>
              <div>
                <dt className="inline">
                  <a href="https://xeno-canto.org" target="_blank" rel="noopener noreferrer"
                     className="font-medium text-gray-300 hover:underline">Xeno-canto</a>
                </dt>
                <dd className="inline"> — Bird audio recordings</dd>
              </div>
              <div>
                <dt className="inline">
                  <a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer"
                     className="font-medium text-gray-300 hover:underline">iNaturalist</a>
                </dt>
                <dd className="inline"> — Bird photos</dd>
              </div>
              <div>
                <dt className="inline">
                  <a href="https://www.nps.gov" target="_blank" rel="noopener noreferrer"
                     className="font-medium text-gray-300 hover:underline">National Park Service</a>
                </dt>
                <dd className="inline"> — Park locations</dd>
              </div>
              <div>
                <dt className="inline">
                  <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer"
                     className="font-medium text-gray-300 hover:underline">OpenStreetMap</a>
                </dt>
                <dd className="inline"> — Map tiles</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
