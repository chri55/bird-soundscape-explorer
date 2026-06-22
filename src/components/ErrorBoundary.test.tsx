import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('test crash');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // suppress jsdom's console.error for expected thrown errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(<ErrorBoundary><span>ok</span></ErrorBoundary>);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('renders a Refresh button in the fallback UI', () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('calls window.location.reload when Refresh button is clicked', () => {
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { reload: vi.fn() };
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(window.location.reload).toHaveBeenCalled();
    (window as any).location = originalLocation;
  });
});
