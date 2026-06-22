import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faVolumeXmark, faVolume } from '@fortawesome/free-solid-svg-icons';

export interface SoundscapeControlsProps {
  isPlaying: boolean;
  voiceCount: number;
  loadedCount: number;
  allMuted: boolean;
  onToggle: () => void;
  onMuteAll: () => void;
}

export function SoundscapeControls({
  isPlaying,
  voiceCount,
  loadedCount,
  allMuted,
  onToggle,
  onMuteAll,
}: SoundscapeControlsProps) {
  if (voiceCount === 0) return null;

  return (
    <div className="flex items-center gap-4 shrink-0">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onToggle}
          aria-label={isPlaying ? 'Pause soundscape' : 'Play soundscape'}
          className={`w-12 h-7 rounded flex items-center justify-center text-sm transition-colors ${
            isPlaying
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-white hover:bg-gray-100 text-gray-900'
          }`}
        >
          {isPlaying ? <FontAwesomeIcon icon={faPause} /> : <FontAwesomeIcon icon={faPlay} />}
        </button>
        <button
          type="button"
          aria-label={allMuted ? 'Unmute' : 'Mute'}
          onClick={onMuteAll}
          className={`w-12 h-7 rounded text-xs transition-colors ${
            allMuted
              ? 'bg-red-200 hover:bg-red-300 text-red-800'
              : 'bg-white hover:bg-gray-100 text-gray-900'
          }`}
        >
          {allMuted ? <FontAwesomeIcon icon={faVolumeXmark}/> : <FontAwesomeIcon icon={faVolume}/>}
        </button>
      </div>
      <span className="hidden md:inline text-white text-sm">
        {isPlaying ? `${loadedCount} birds playing` : `${loadedCount} birds ready`}
      </span>
    </div>
  );
}
