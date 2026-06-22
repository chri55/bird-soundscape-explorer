import { render, screen, fireEvent } from '@testing-library/react';
import { SoundscapeControls } from './SoundscapeControls';

describe('SoundscapeControls', () => {
  const defaultProps = {
    isPlaying: false as const,
    voiceCount: 0,
    loadedCount: 0,
    allMuted: false as const,
    onToggle: vi.fn(),
    onMuteAll: vi.fn(),
  };

  it('renders nothing when voiceCount is 0', () => {
    const { container } = render(<SoundscapeControls {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows loadedCount (not voiceCount) birds playing when playing', () => {
    render(
      <SoundscapeControls
        {...defaultProps}
        isPlaying={true}
        voiceCount={8}
        loadedCount={5}
      />,
    );
    expect(screen.getByText('5 birds playing')).toBeInTheDocument();
  });

  it('shows loadedCount (not voiceCount) birds ready when paused', () => {
    render(
      <SoundscapeControls
        {...defaultProps}
        voiceCount={8}
        loadedCount={3}
      />,
    );
    expect(screen.getByText('3 birds ready')).toBeInTheDocument();
  });

  it('calls onToggle when the play button is clicked', () => {
    const onToggle = vi.fn();
    render(
      <SoundscapeControls
        {...defaultProps}
        voiceCount={3}
        loadedCount={3}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play soundscape' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders a Font Awesome play icon (not emoji ▶) when paused', () => {
    const { container } = render(
      <SoundscapeControls {...defaultProps} voiceCount={1} loadedCount={1} />,
    );
    expect(container.querySelector('svg[data-icon="play"]')).toBeTruthy();
    expect(
      container.querySelector('button[aria-label="Play soundscape"]')?.textContent?.trim(),
    ).not.toBe('▶');
  });

  it('renders a Font Awesome pause icon (not emoji ⏸) when playing', () => {
    const { container } = render(
      <SoundscapeControls {...defaultProps} isPlaying={true} voiceCount={1} loadedCount={1} />,
    );
    expect(container.querySelector('svg[data-icon="pause"]')).toBeTruthy();
    expect(
      container.querySelector('button[aria-label="Pause soundscape"]')?.textContent?.trim(),
    ).not.toBe('⏸');
  });

  it('shows "Mute" button when not all voices are muted', () => {
    render(
      <SoundscapeControls {...defaultProps} voiceCount={3} loadedCount={3} allMuted={false} />,
    );
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
  });

  it('shows "Unmute" button when all voices are muted', () => {
    render(
      <SoundscapeControls {...defaultProps} voiceCount={3} loadedCount={3} allMuted={true} />,
    );
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
  });

  it('calls onMuteAll when the mute button is clicked', () => {
    const onMuteAll = vi.fn();
    render(
      <SoundscapeControls
        {...defaultProps}
        voiceCount={3}
        loadedCount={3}
        onMuteAll={onMuteAll}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(onMuteAll).toHaveBeenCalledTimes(1);
  });

  it('count text span has hidden class (hidden on mobile)', () => {
    const { container } = render(
      <SoundscapeControls {...defaultProps} isPlaying={false} voiceCount={3} loadedCount={3} />,
    );
    const span = Array.from(container.querySelectorAll('span')).find(
      el => el.textContent?.includes('birds'),
    );
    expect(span?.className.split(' ')).toContain('hidden');
  });

  it('mute button has bg-red-200 class when allMuted is true', () => {
    render(
      <SoundscapeControls {...defaultProps} voiceCount={1} loadedCount={1} allMuted={true} />,
    );
    expect(screen.getByRole('button', { name: 'Unmute' }).className).toContain('bg-red-200');
  });

  it('mute button has bg-white class when allMuted is false', () => {
    render(
      <SoundscapeControls {...defaultProps} voiceCount={1} loadedCount={1} allMuted={false} />,
    );
    expect(screen.getByRole('button', { name: 'Mute' }).className).toContain('bg-white');
  });

  it('play button has bg-green-500 class when playing', () => {
    render(
      <SoundscapeControls {...defaultProps} isPlaying={true} voiceCount={1} loadedCount={1} />,
    );
    expect(
      screen.getByRole('button', { name: 'Pause soundscape' }).className,
    ).toContain('bg-green-500');
  });
});
