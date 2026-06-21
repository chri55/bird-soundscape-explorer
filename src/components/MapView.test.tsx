import { render } from '@testing-library/react';
import MapView from './MapView';
import { fetchNearbyNotable, fetchRecentNearby } from '../api/ebird';
import { fetchRecordingsByBox } from '../api/xeno-canto';

vi.mock('../api/ebird', () => ({
  fetchNearbyNotable: vi.fn().mockResolvedValue([]),
  fetchRecentNearby: vi.fn().mockResolvedValue([]),
  fetchTaxonomy: vi.fn().mockResolvedValue([]),
  clearTaxonomyCache: vi.fn(),
}));

vi.mock('../api/xeno-canto', () => ({
  fetchRecordingsByBox: vi.fn().mockResolvedValue({ recordings: [], numRecordings: '0', numSpecies: '0', page: 1, numPages: 1 }),
}));

vi.mock('../api/inat', () => ({ fetchBirdPhoto: vi.fn().mockResolvedValue(null) }));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMapEvents: (handlers: { click?: (e: unknown) => void }) => { (globalThis as Record<string, unknown>)._mapClick = handlers.click; return null; },
  useMap: vi.fn(() => ({ addLayer: vi.fn(), removeLayer: vi.fn(), flyTo: vi.fn() })),
}));

vi.mock('leaflet.markercluster', () => ({}));

vi.mock('leaflet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('leaflet')>();
  const mockClusterGroup = {
    addLayers: vi.fn(),
    addTo: vi.fn(),
  };
  return {
    ...actual,
    default: {
      ...actual.default,
      markerClusterGroup: vi.fn(() => mockClusterGroup),
    },
  };
});

function simulateMapClick(lat: number, lng: number) {
  const click = (globalThis as Record<string, unknown>)._mapClick as ((e: { latlng: { lat: number; lng: number } }) => void) | undefined;
  click?.({ latlng: { lat, lng } });
}

describe('MapView geo-cache', () => {
  beforeEach(() => {
    vi.mocked(fetchNearbyNotable).mockClear();
    vi.mocked(fetchRecentNearby).mockClear();
    vi.mocked(fetchRecordingsByBox).mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls APIs when a pin is dropped', async () => {
    render(<MapView />);
    simulateMapClick(37.77, -122.4);
    await vi.runAllTimersAsync();
    expect(fetchNearbyNotable).toHaveBeenCalledWith(37.77, -122.4);
  });

  it('does not re-call APIs when second pin is within 10km', async () => {
    render(<MapView />);
    simulateMapClick(37.77, -122.4);
    await vi.runAllTimersAsync();
    vi.mocked(fetchNearbyNotable).mockClear();

    simulateMapClick(37.77 + 0.02, -122.4);
    await vi.runAllTimersAsync();
    expect(fetchNearbyNotable).not.toHaveBeenCalled();
  });

  it('re-calls APIs when pin moves more than 10km', async () => {
    render(<MapView />);
    simulateMapClick(37.77, -122.4);
    await vi.runAllTimersAsync();
    vi.mocked(fetchNearbyNotable).mockClear();

    simulateMapClick(37.77 + 0.5, -122.4);
    await vi.runAllTimersAsync();
    expect(fetchNearbyNotable).toHaveBeenCalled();
  });
});
