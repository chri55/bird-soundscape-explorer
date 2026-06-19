import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNearbyNotable, fetchTaxonomy, clearTaxonomyCache } from './ebird';
import type { EBirdTaxon } from './ebird';

const mockFetch = vi.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
  clearTaxonomyCache();
});

const mockNotableResponse: unknown[] = [
  {
    speciesCode: 'snobun',
    comName: 'Snow Bunting',
    sciName: 'Plectrophenax nivalis',
    locName: 'Central Park',
    obsDt: '2026-06-19 08:00',
    howMany: 1,
    lat: 40.78,
    lng: -73.97,
    locId: 'L109516',
    subId: 'S12345',
    obsValid: true,
    obsReviewed: false,
    locationPrivate: false,
  },
];

const mockTaxonResponse: unknown[] = [
  {
    sciName: 'Plectrophenax nivalis',
    comName: 'Snow Bunting',
    speciesCode: 'snobun',
    category: 'species',
    taxonOrder: 36000,
    bandingCodes: ['SNBU'],
    comNameCodes: ['SNBU'],
    sciNameCodes: ['PLNI'],
    order: 'Passeriformes',
    familyComName: 'Old World Sparrows',
    familySciName: 'Passeridae',
  },
];

describe('fetchNearbyNotable', () => {
  it('fetches notable observations and returns them', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotableResponse,
    });

    const result = await fetchNearbyNotable(40.78, -73.97);
    expect(result).toHaveLength(1);
    expect(result[0].speciesCode).toBe('snobun');
    expect(result[0].locId).toBe('L109516');

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/data/obs/geo/recentnotable');
    expect(url).toContain('lat=40.78');
    expect(url).toContain('detail=full');
  });

  it('clamps dist to 50 km', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await fetchNearbyNotable(40.78, -73.97, { dist: 100 });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('dist=50');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
    await expect(fetchNearbyNotable(0, 0)).rejects.toThrow('eBird error 401');
  });
});

describe('fetchTaxonomy', () => {
  it('fetches taxonomy for given species codes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTaxonResponse,
    });

    const result = await fetchTaxonomy(['snobun']);
    expect(result).toHaveLength(1);
    expect(result[0].familyComName).toBe('Old World Sparrows');
    expect(result[0].order).toBe('Passeriformes');
  });

  it('serves subsequent calls for same codes from localStorage cache', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTaxonResponse,
    });

    await fetchTaxonomy(['snobun']);
    mockFetch.mockClear();

    const result = await fetchTaxonomy(['snobun']);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result[0].speciesCode).toBe('snobun');
  });

  it('fetches from network for uncached species codes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTaxonResponse,
    });
    await fetchTaxonomy(['snobun']);
    mockFetch.mockClear();

    const newTaxon: EBirdTaxon = { ...mockTaxonResponse[0] as EBirdTaxon, speciesCode: 'amerob', comName: 'American Robin', sciName: 'Turdus migratorius' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [newTaxon],
    });

    const result = await fetchTaxonomy(['snobun', 'amerob']);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
  });

  it('does not re-fetch codes the API did not return', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [], // API returns nothing for 'unknown'
    });

    await fetchTaxonomy(['unknown']);
    mockFetch.mockClear();

    const result = await fetchTaxonomy(['unknown']);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });
});
