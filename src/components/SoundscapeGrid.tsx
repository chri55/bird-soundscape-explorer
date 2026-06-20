import type { SoundscapeVoice } from '../hooks/useSoundscape';

interface SoundscapeGridProps {
  voices: SoundscapeVoice[];
}

export function SoundscapeGrid({ voices }: SoundscapeGridProps) {
  if (voices.length === 0) return null;

  return (
    <div className="flex gap-2 items-center overflow-x-auto px-1 py-1">
      {voices.map(voice => {
        const imgSrc = voice.photo?.photoUrl ?? voice.recording.sono.small;
        return (
          <div
            key={voice.recording.id}
            className={`shrink-0 rounded-lg ring-2 transition-all duration-300 ${
              voice.isActive ? 'ring-green-400' : 'ring-transparent brightness-50'
            }`}
          >
            <div className="relative w-[90px] h-[110px] rounded-lg overflow-hidden bg-black/60">
              <img
                src={imgSrc}
                alt={voice.recording.en}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                <p className={`text-xs text-white truncate transition-opacity duration-300 ${voice.isActive ? 'opacity-100' : 'opacity-60'}`}>
                  {voice.recording.en}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
