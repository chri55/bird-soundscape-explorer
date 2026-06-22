import { render, screen, fireEvent } from '@testing-library/react';
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
    isFailed: false,
    isMuted: false,
    isRerolling: false,
    photo: null,
    ...overrides,
  };
}

describe('SoundscapeGrid', () => {
  it('renders nothing when voices is empty', () => {
    const { container } = render(<SoundscapeGrid voices={[]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('has grid-cols-4 class on the container', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(container.querySelector('.grid-cols-4')).toBeTruthy();
  });

  it('active card has ring-green-400 class', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: true })]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(container.querySelector('.ring-green-400')).toBeTruthy();
  });

  it('inactive card has brightness-50 class', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: false })]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(container.querySelector('.brightness-50')).toBeTruthy();
  });

  it('shows photo img when photo is available', () => {
    const voice = makeVoice({
      photo: { photoUrl: 'https://photo.jpg', largeUrl: 'https://photo-l.jpg', attribution: '© x', licenseCode: 'cc-by' },
    });
    render(<SoundscapeGrid voices={[voice]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://photo.jpg');
  });

  it('shows placeholder text (not an img) when photo is null and not loading', () => {
    render(<SoundscapeGrid voices={[makeVoice({ photo: null, isLoading: false })]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getAllByText('American Robin').length).toBeGreaterThan(0);
  });

  it('shows skeleton when isLoading is true', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isLoading: true })]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('hover card contains scientific name', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(container.textContent).toContain('Turdus migratorius');
  });

  it('hover card contains recordist name', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(container.textContent).toContain('Jane');
  });

  it('hover card is initially hidden (opacity-0 or invisible class)', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    const hoverCard = container.querySelector('.opacity-0, .invisible');
    expect(hoverCard).toBeTruthy();
  });

  it('does not render failed voices', () => {
    const rec2: XCRecording = {
      id: '2', gen: 'Parus', sp: 'major', en: 'Great Tit',
      rec: 'Jane', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
      type: 'song', q: 'A', file: 'https://xc.org/2.mp3', date: '2024-01-01',
      'file-name': '2.mp3', sono: { small: 'https://xc.org/sono2.png', med: 'https://xc.org/sonom.png' },
    };
    const voices = [
      makeVoice({ isFailed: true }),
      makeVoice({ recording: rec2, sciName: 'Parus major', isFailed: false }),
    ];
    const { container } = render(<SoundscapeGrid voices={voices} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(container.textContent).not.toContain('American Robin');
    expect(container.textContent).toContain('Great Tit');
  });

  it('muted voice shows volume-xmark icon always visible (not opacity-0)', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice({ isMuted: true })]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    expect(container.querySelector('svg[data-icon="volume-xmark"]')).toBeTruthy();
    const muteBtn = container.querySelector('button[aria-label="Unmute bird"]');
    expect(muteBtn).toBeTruthy();
    expect(muteBtn?.className).not.toContain('opacity-0');
  });

  it('renders a reroll button per non-failed voice', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    expect(container.querySelector('button[aria-label="Reroll bird"]')).toBeTruthy();
  });

  it('calls onReroll with the correct index when clicked', () => {
    const onReroll = vi.fn();
    const rec2 = {
      id: '2', gen: 'Parus', sp: 'major', en: 'Great Tit',
      rec: 'Jane', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
      type: 'song', q: 'A', file: 'https://xc.org/2.mp3', date: '2024-01-01',
      'file-name': '2.mp3', sono: { small: '', med: '' },
    };
    const voices = [
      makeVoice(),
      makeVoice({ recording: rec2, sciName: 'Parus major' }),
    ];
    const { container } = render(
      <SoundscapeGrid voices={voices} onToggleMute={vi.fn()} onReroll={onReroll} />,
    );
    const diceButtons = container.querySelectorAll('button[aria-label="Reroll bird"]');
    fireEvent.click(diceButtons[1]!);
    expect(onReroll).toHaveBeenCalledWith(1);
  });

  it('does not render reroll button for failed voices', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice({ isFailed: true })]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    expect(container.querySelector('button[aria-label="Reroll bird"]')).toBeNull();
  });

  it('calls onSelectedVoiceChange with voice when card is clicked', () => {
    const onSelectedVoiceChange = vi.fn();
    const voice = makeVoice();
    const { container } = render(
      <SoundscapeGrid voices={[voice]} onToggleMute={vi.fn()} onReroll={vi.fn()} onSelectedVoiceChange={onSelectedVoiceChange} />,
    );
    const grid = container.querySelector('.grid-cols-4')!;
    fireEvent.click(grid.children[0]!);
    expect(onSelectedVoiceChange).toHaveBeenCalledWith(voice);
  });

  it('calls onSelectedVoiceChange with null when same card is clicked again', () => {
    const onSelectedVoiceChange = vi.fn();
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} onSelectedVoiceChange={onSelectedVoiceChange} />,
    );
    const grid = container.querySelector('.grid-cols-4')!;
    fireEvent.click(grid.children[0]!);
    fireEvent.click(grid.children[0]!);
    expect(onSelectedVoiceChange).toHaveBeenLastCalledWith(null);
  });

  it('calls onSelectedVoiceChange with null when reroll button is clicked', () => {
    const onSelectedVoiceChange = vi.fn();
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} onSelectedVoiceChange={onSelectedVoiceChange} />,
    );
    const grid = container.querySelector('.grid-cols-4')!;
    fireEvent.click(grid.children[0]!);
    onSelectedVoiceChange.mockClear();
    fireEvent.click(container.querySelector('button[aria-label="Reroll bird"]')!);
    expect(onSelectedVoiceChange).toHaveBeenCalledWith(null);
  });

  it('selected card reroll button does not have standalone opacity-0 class', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    const grid = container.querySelector('.grid-cols-4')!;
    fireEvent.click(grid.children[0]!);
    const rerollBtn = container.querySelector('button[aria-label="Reroll bird"]')!;
    expect(rerollBtn.className.split(' ')).not.toContain('opacity-0');
  });

  it('unselected card reroll button has opacity-0 class', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    const rerollBtn = container.querySelector('button[aria-label="Reroll bird"]')!;
    expect(rerollBtn.className.split(' ')).toContain('opacity-0');
  });

  it('card name overlay has hidden class (hidden on mobile)', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice({ isLoading: false })]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    const overlay = container.querySelector('.absolute.bottom-0');
    expect(overlay?.className.split(' ')).toContain('hidden');
  });
});
