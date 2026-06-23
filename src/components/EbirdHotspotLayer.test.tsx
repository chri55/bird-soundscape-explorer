import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
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

vi.mock('leaflet', () => ({
  default: {},
  markerClusterGroup: vi.fn(() => mockClusterGroup),
  marker: vi.fn(() => ({
    bindTooltip: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  })),
  divIcon: vi.fn(() => ({})),
}));

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
});
