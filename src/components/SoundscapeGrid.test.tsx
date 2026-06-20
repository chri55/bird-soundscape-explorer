import { render, screen } from '@testing-library/react';
import { SoundscapeGrid } from './SoundscapeGrid';
import type { SoundscapeVoice } from '../hooks/useSoundscape';
import type { XCRecording } from '../api/xeno-canto';

function makeVoice(overrides: Partial<SoundscapeVoice> = {}): SoundscapeVoice {
  const recording: XCRecording = {
    id: '1', gen: 'Turdus', sp: 'migratorius', en: 'American Robin',
    rec: 'Jane', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
    type: 'song', q: 'A', file: 'https://xc.org/1.mp3', date: '2024-01-01',
    'file-name': '1.mp3', sono: { small: 'https://xc.org/sono.png', med: 'https://xc.org/sonom.png' },
  };
  return {
    recording,
    sciName: 'Turdus migratorius',
    howMany: 10,
    intervalMs: 5000,
    isActive: false,
    photo: null,
    ...overrides,
  };
}

describe('SoundscapeGrid', () => {
  it('renders nothing when voices is empty', () => {
    const { container } = render(<SoundscapeGrid voices={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one card per voice using recording.en as alt text', () => {
    const voices = [
      makeVoice({ recording: { ...makeVoice().recording, en: 'American Robin', gen: 'Turdus', sp: 'migratorius', id: '1' } }),
      makeVoice({ sciName: 'Parus major', recording: { ...makeVoice().recording, en: 'Great Tit', gen: 'Parus', sp: 'major', id: '2' } }),
    ];
    render(<SoundscapeGrid voices={voices} />);
    expect(screen.getByAltText('American Robin')).toBeInTheDocument();
    expect(screen.getByAltText('Great Tit')).toBeInTheDocument();
  });

  it('active card has ring-green-400 class', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: true })]} />);
    expect(container.querySelector('.ring-green-400')).toBeTruthy();
  });

  it('inactive card does not have ring-green-400', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: false })]} />);
    expect(container.querySelector('.ring-green-400')).toBeNull();
  });

  it('inactive card has brightness-50 class', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: false })]} />);
    expect(container.querySelector('.brightness-50')).toBeTruthy();
  });

  it('uses photo.photoUrl when photo is available', () => {
    const voice = makeVoice({
      photo: { photoUrl: 'https://photo.jpg', largeUrl: 'https://photo-l.jpg', attribution: '© x', licenseCode: 'cc-by' },
    });
    render(<SoundscapeGrid voices={[voice]} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://photo.jpg');
  });

  it('falls back to recording.sono.small when photo is null', () => {
    render(<SoundscapeGrid voices={[makeVoice({ photo: null })]} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://xc.org/sono.png');
  });
});
