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
    isLoading: false,
    photo: null,
    ...overrides,
  };
}

describe('SoundscapeGrid', () => {
  it('renders nothing when voices is empty', () => {
    const { container } = render(<SoundscapeGrid voices={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('has grid-cols-8 class on the container', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} />);
    expect(container.querySelector('.grid-cols-8')).toBeTruthy();
  });

  it('active card has ring-green-400 class', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: true })]} />);
    expect(container.querySelector('.ring-green-400')).toBeTruthy();
  });

  it('inactive card has brightness-50 class', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: false })]} />);
    expect(container.querySelector('.brightness-50')).toBeTruthy();
  });

  it('shows photo img when photo is available', () => {
    const voice = makeVoice({
      photo: { photoUrl: 'https://photo.jpg', largeUrl: 'https://photo-l.jpg', attribution: '© x', licenseCode: 'cc-by' },
    });
    render(<SoundscapeGrid voices={[voice]} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://photo.jpg');
  });

  it('shows placeholder text (not an img) when photo is null and not loading', () => {
    render(<SoundscapeGrid voices={[makeVoice({ photo: null, isLoading: false })]} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getAllByText('American Robin').length).toBeGreaterThan(0);
  });

  it('shows skeleton when isLoading is true', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isLoading: true })]} />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('hover card contains scientific name', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} />);
    expect(container.textContent).toContain('Turdus migratorius');
  });

  it('hover card contains recordist name', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} />);
    expect(container.textContent).toContain('Jane');
  });

  it('hover card is initially hidden (opacity-0 or invisible class)', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} />);
    const hoverCard = container.querySelector('.opacity-0, .invisible');
    expect(hoverCard).toBeTruthy();
  });
});
