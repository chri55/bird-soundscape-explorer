import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';

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
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onToggle}
          aria-label={isPlaying ? 'Pause soundscape' : 'Play soundscape'}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-colors ${
            isPlaying
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-white hover:bg-gray-100 text-gray-900'
          }`}
        >
          {isPlaying ? <FontAwesomeIcon icon={faPause} /> : <FontAwesomeIcon icon={faPlay} />}
        </button>
        <button
          onClick={onMuteAll}
          className="text-xs text-gray-300 hover:text-white transition-colors"
        >
          {allMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>
      <span className="text-white text-sm">
        {isPlaying ? `${loadedCount} birds playing` : `${loadedCount} birds ready`}
      </span>
    </div>
  );
}
