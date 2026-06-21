import { render, screen, fireEvent } from '@testing-library/react';
import { SoundscapeControls } from './SoundscapeControls';

describe('SoundscapeControls', () => {
  it('renders nothing when voiceCount is 0', () => {
    const { container } = render(
      <SoundscapeControls isPlaying={false} voiceCount={0} onToggle={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "N birds playing" when playing', () => {
    render(<SoundscapeControls isPlaying={true} voiceCount={5} onToggle={vi.fn()} />);
    expect(screen.getByText('5 birds playing')).toBeInTheDocument();
  });

  it('shows "N birds ready" when paused', () => {
    render(<SoundscapeControls isPlaying={false} voiceCount={3} onToggle={vi.fn()} />);
    expect(screen.getByText('3 birds ready')).toBeInTheDocument();
  });

  it('calls onToggle when the button is clicked', () => {
    const onToggle = vi.fn();
    render(<SoundscapeControls isPlaying={false} voiceCount={3} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders a Font Awesome play icon (not emoji ▶) when paused', () => {
    const { container } = render(
      <SoundscapeControls isPlaying={false} voiceCount={1} onToggle={vi.fn()} />,
    );
    expect(container.querySelector('svg[data-icon="play"]')).toBeTruthy();
    expect(container.querySelector('button')?.textContent?.trim()).not.toBe('▶');
  });

  it('renders a Font Awesome pause icon (not emoji ⏸) when playing', () => {
    const { container } = render(
      <SoundscapeControls isPlaying={true} voiceCount={1} onToggle={vi.fn()} />,
    );
    expect(container.querySelector('svg[data-icon="pause"]')).toBeTruthy();
    expect(container.querySelector('button')?.textContent?.trim()).not.toBe('⏸');
  });
});
