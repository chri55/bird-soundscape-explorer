import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useMapEvents } from 'react-leaflet';
import { EbirdHotspotLayer } from './EbirdHotspotLayer';

const mockAddLayer = vi.fn();
const mockRemoveLayer = vi.fn();
const mockAddLayers = vi.fn();
const mockRemoveLayers = vi.fn();

const mockMap = {
  getZoom: vi.fn(() => 8),
  getCenter: vi.fn(() => ({ lat: 40, lng: -74 })),
  addLayer: mockAddLayer,
  removeLayer: mockRemoveLayer,
};

const mockClusterGroup = {
  addLayers: mockAddLayers,
  removeLayers: mockRemoveLayers,
};

vi.mock('react-leaflet', () => ({
  useMap: () => mockMap,
  useMapEvents: vi.fn(),
}));

vi.mock('leaflet', () => {
  const mockMarker = () => ({
    bindTooltip: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  });
  const leaflet = {
    markerClusterGroup: vi.fn(() => mockClusterGroup),
    marker: vi.fn(mockMarker),
    divIcon: vi.fn(() => ({})),
  };
  return { default: leaflet, ...leaflet };
});

vi.mock('leaflet.markercluster', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  }));
});

describe('EbirdHotspotLayer', () => {
  it('renders without crashing and returns no DOM output', () => {
    const { container } = render(
      <EbirdHotspotLayer onHotspotClick={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('adds the cluster group to the map on mount', () => {
    render(<EbirdHotspotLayer onHotspotClick={vi.fn()} />);
    expect(mockAddLayer).toHaveBeenCalledWith(mockClusterGroup);
  });

  it('calls removeLayers when more than MAX_CELLS (30) distinct cells are loaded', async () => {
    vi.useFakeTimers();

    // Each fetch returns a unique hotspot so addToCluster always writes to cellMarkers
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const id = ++callCount;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{
          locId: `L${id}`,
          locName: `Hotspot ${id}`,
          countryCode: 'US',
          lat: 40 + id * 0.01,
          lng: -74 + id * 0.01,
          numSpeciesAllTime: id,
        }]),
      });
    }));

    // Capture the moveend handler registered by the component
    let capturedMoveend: (() => void) | null = null;
    vi.mocked(useMapEvents).mockImplementation((handlers) => {
      capturedMoveend = handlers.moveend as () => void;
      return {} as ReturnType<typeof useMapEvents>;
    });

    render(<EbirdHotspotLayer onHotspotClick={vi.fn()} />);
    expect(capturedMoveend).not.toBeNull();

    // Fire moveend for 31 distinct cells, each with a unique center
    for (let i = 0; i < 31; i++) {
      mockMap.getCenter.mockReturnValue({ lat: 40 + i, lng: -74 + i });
      capturedMoveend!();
      // Advance past the debounce and flush async work
      await act(async () => {
        await vi.runAllTimersAsync();
      });
    }

    expect(mockRemoveLayers).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('calls onNewHotspots with the newly added hotspot objects', async () => {
    vi.useFakeTimers();
    const hotspot = {
      locId: 'L12345',
      locName: 'Central Park',
      countryCode: 'US',
      lat: 40.78,
      lng: -73.97,
      numSpeciesAllTime: 200,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([hotspot]),
    }));
    const onNewHotspots = vi.fn();

    render(
      <EbirdHotspotLayer onHotspotClick={vi.fn()} onNewHotspots={onNewHotspots} />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(onNewHotspots).toHaveBeenCalledWith([hotspot]);
    vi.useRealTimers();
  });
});
