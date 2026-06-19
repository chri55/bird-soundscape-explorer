import { render, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// --- Mock leaflet before importing MapView ---
vi.mock('leaflet', () => ({
  default: {
    icon: () => ({}),
  },
}));

// Capture the onPin callback so tests can trigger pin drops directly.
let capturedOnPin: ((pos: { lat: number; lng: number }) => void) | null = null;

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMapEvents: (handlers: { click?: (e: { latlng: { lat: number; lng: number } }) => void }) => {
    // PinHandler passes { click(e) { onPin(...) } }. Capture the handler so tests can call it.
    if (handlers.click) {
      capturedOnPin = (pos) => handlers.click!({ latlng: pos });
    }
    return null;
  },
}));

// --- Mock image assets that Leaflet tries to import ---
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'marker-icon.png' }));
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'marker-icon-2x.png' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'marker-shadow.png' }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// --- Mock API modules ---
import { fetchRecentNearby, fetchNearbyNotable } from '../api/ebird';
import { fetchRecordingsByBox } from '../api/xeno-canto';

vi.mock('../api/ebird', () => ({
  fetchRecentNearby: vi.fn().mockResolvedValue([]),
  fetchNearbyNotable: vi.fn().mockResolvedValue([]),
  fetchTaxonomy: vi.fn().mockResolvedValue([]),
}));

vi.mock('../api/xeno-canto', () => ({
  fetchRecordingsByBox: vi.fn().mockResolvedValue({ recordings: [] }),
}));

// Mock useFeaturedBird and FeaturedBirdCard to keep the test focused on caching
vi.mock('../hooks/useFeaturedBird', () => ({
  useFeaturedBird: () => ({
    observation: null,
    taxon: null,
    photo: null,
    recording: null,
    isNotable: false,
    mode: 'rarest',
    onToggleMode: vi.fn(),
    showToggle: false,
    loading: false,
  }),
}));

vi.mock('./FeaturedBirdCard', () => ({
  FeaturedBirdCard: () => null,
}));

vi.mock('../api/inat', () => ({
  fetchBirdPhoto: vi.fn().mockResolvedValue(null),
}));

// Import MapView after all mocks are set up.
import MapView from './MapView';

// Test coordinates:
// Location A: San Francisco
const LOC_A = { lat: 37.7749, lng: -122.4194 };
// Location B: ~1.1 km north of A (within 10 km)
const LOC_B_CLOSE = { lat: 37.7849, lng: -122.4194 };
// Location C: ~11 km north of A (beyond 10 km)
const LOC_C_FAR = { lat: 37.8749, lng: -122.4194 };

const DEBOUNCE_MS = 500;

describe('MapView geographic cache', () => {
  beforeEach(() => {
    capturedOnPin = null;
    vi.useFakeTimers();
    vi.mocked(fetchRecentNearby).mockClear();
    vi.mocked(fetchNearbyNotable).mockClear();
    vi.mocked(fetchRecordingsByBox).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips all API calls when second pin is within 10 km of the first', async () => {
    render(<MapView />);

    // First pin drop at location A — should trigger APIs
    act(() => {
      capturedOnPin!(LOC_A);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });

    expect(fetchNearbyNotable).toHaveBeenCalledTimes(1);
    expect(fetchRecentNearby).toHaveBeenCalledTimes(1);
    expect(fetchRecordingsByBox).toHaveBeenCalledTimes(1);

    // Second pin drop within 10 km — should NOT trigger APIs again
    act(() => {
      capturedOnPin!(LOC_B_CLOSE);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });

    // Still only called once each — cache prevented re-fetch
    expect(fetchNearbyNotable).toHaveBeenCalledTimes(1);
    expect(fetchRecentNearby).toHaveBeenCalledTimes(1);
    expect(fetchRecordingsByBox).toHaveBeenCalledTimes(1);
  });

  it('triggers new API calls when second pin is beyond 10 km of the first', async () => {
    render(<MapView />);

    // First pin drop at location A
    act(() => {
      capturedOnPin!(LOC_A);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });

    expect(fetchNearbyNotable).toHaveBeenCalledTimes(1);
    expect(fetchRecentNearby).toHaveBeenCalledTimes(1);
    expect(fetchRecordingsByBox).toHaveBeenCalledTimes(1);

    // Second pin drop beyond 10 km — SHOULD trigger APIs again
    act(() => {
      capturedOnPin!(LOC_C_FAR);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });

    // Called twice — cache miss triggered a new fetch
    expect(fetchNearbyNotable).toHaveBeenCalledTimes(2);
    expect(fetchRecentNearby).toHaveBeenCalledTimes(2);
    expect(fetchRecordingsByBox).toHaveBeenCalledTimes(2);
  });
});
