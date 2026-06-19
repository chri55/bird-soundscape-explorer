import type { EBirdObservation, EBirdTaxon } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import type { XCRecording } from '../api/xeno-canto';

export interface FeaturedBirdCardProps {
  observation: EBirdObservation;
  taxon: EBirdTaxon | null;
  photo: BirdPhoto | null;
  recording: XCRecording | null;
  isNotable: boolean;
  mode: 'rarest' | 'common';
  onToggleMode: () => void;
  showToggle: boolean;
}

export function FeaturedBirdCard({
  observation,
  taxon,
  photo,
  recording,
  isNotable,
  mode,
  onToggleMode,
  showToggle,
}: FeaturedBirdCardProps) {
  return (
    <div className="w-80 flex flex-col bg-white border-l border-gray-200 overflow-y-auto shrink-0">
      {showToggle && (
        <div className="flex border-b border-gray-100 text-sm shrink-0">
          <button
            className={`flex-1 py-2 font-medium transition-colors ${
              mode === 'rarest' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => mode !== 'rarest' && onToggleMode()}
          >
            Rarest
          </button>
          <button
            className={`flex-1 py-2 font-medium transition-colors ${
              mode === 'common' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => mode !== 'common' && onToggleMode()}
          >
            Most Common
          </button>
        </div>
      )}

      {/* Hero image */}
      <div className="relative shrink-0">
        {photo ? (
          <img
            src={photo.photoUrl}
            alt={observation.comName}
            className="w-full aspect-video object-cover"
          />
        ) : recording?.sono.med ? (
          <img
            src={recording.sono.med}
            alt={`Spectrogram of ${observation.comName}`}
            className="w-full aspect-video object-cover bg-gray-900"
          />
        ) : (
          <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
            No image available
          </div>
        )}
        {isNotable && (
          <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
            Rare sighting
          </span>
        )}
      </div>

      {/* Names */}
      <div className="px-4 pt-3 pb-1">
        <h2 className="text-lg font-bold text-gray-900 leading-tight">{observation.comName}</h2>
        <p className="text-sm italic text-gray-500 mt-0.5">{observation.sciName}</p>
      </div>

      {/* Taxonomy */}
      {taxon && (
        <div className="px-4 py-1 text-xs text-gray-500">
          {taxon.order} · {taxon.familyComName}
        </div>
      )}

      {/* Spectrogram (secondary, shown when photo is also present) */}
      {photo && recording?.sono.med && (
        <div className="px-4 py-2">
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{recording.type}</p>
          <img
            src={recording.sono.med}
            alt="Sound spectrogram"
            className="w-full rounded border border-gray-100"
          />
        </div>
      )}

      {/* Attribution */}
      <div className="mt-auto px-4 py-3 text-xs text-gray-400 space-y-1 border-t border-gray-100">
        {photo && <p>{photo.attribution}</p>}
        {recording && <p>Recording: {recording.rec}</p>}
      </div>
    </div>
  );
}
