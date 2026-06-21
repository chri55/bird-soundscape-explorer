import type { SoundscapeVoice } from '../hooks/useSoundscape';
import { Skeleton } from './Skeleton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';

interface SoundscapeGridProps {
  voices: SoundscapeVoice[];
  onToggleMute: (index: number) => void;
}

export function SoundscapeGrid({ voices, onToggleMute }: SoundscapeGridProps) {
  if (voices.length === 0) return null;

  return (
    <div className="grid grid-cols-8 gap-2 p-1 w-full">
      {voices.map((voice, i) => {
        if (voice.isFailed) return null;
        return (
          <div
            key={voice.recording.id}
            className={`relative group rounded-lg ring-2 transition-all duration-300 ${
              voice.isActive ? 'ring-green-400' : 'ring-transparent'
            }`}
          >
            {/* Hover card — appears above the card */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-48 bg-gray-900 rounded-lg overflow-hidden shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 pointer-events-none">
              <div className="aspect-video bg-gray-800">
                {voice.photo ? (
                  <img
                    aria-hidden="true"
                    src={voice.photo.largeUrl}
                    alt={voice.recording.en}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white text-xs text-center px-2">{voice.recording.en}</span>
                  </div>
                )}
              </div>
              <div className="p-2 space-y-0.5">
                <p className="text-white text-xs font-semibold truncate">{voice.recording.en}</p>
                <p className="text-gray-400 text-xs italic truncate">{voice.sciName}</p>
                {voice.photo && (
                  <p className="text-gray-500 text-xs truncate">{voice.photo.attribution}</p>
                )}
                <p className="text-gray-500 text-xs truncate">Rec: {voice.recording.rec}</p>
              </div>
            </div>

            {/* Mute button */}
            <button
              onClick={e => { e.stopPropagation(); onToggleMute(i); }}
              aria-label={voice.isMuted ? 'Unmute bird' : 'Mute bird'}
              className={`absolute top-1 right-1 z-20 w-6 h-6 flex items-center justify-center rounded text-white bg-black/50 hover:bg-black/70 transition-opacity duration-150 ${
                voice.isMuted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <FontAwesomeIcon icon={voice.isMuted ? faVolumeXmark : faVolumeHigh} className="text-xs" />
            </button>

            {/* Card content */}
            <div className={`relative w-full h-[110px] rounded-lg overflow-hidden bg-black/60 transition-all duration-300 ${
              (!voice.isActive || voice.isMuted) ? 'brightness-50' : ''
            }`}>
              {voice.isLoading ? (
                <Skeleton className="w-full h-full rounded-none" />
              ) : voice.photo ? (
                <img
                  src={voice.photo.photoUrl}
                  alt={voice.recording.en}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center px-1">
                  <p className="text-white text-xs text-center leading-tight">{voice.recording.en}</p>
                </div>
              )}
              {!voice.isLoading && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                  <p className={`text-xs text-white truncate transition-opacity duration-300 ${voice.isActive ? 'opacity-100' : 'opacity-60'}`}>
                    {voice.recording.en}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
