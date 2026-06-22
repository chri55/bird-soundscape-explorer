import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchParks } from './nps';

const mockFetch = vi.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchParks', () => {
  it('calls the NPS proxy endpoint with limit=500', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await fetchParks();

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('/api/nps?limit=500');
  });

  it('returns only parks with non-empty latitude and longitude', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { parkCode: 'yose', fullName: 'Yosemite', latitude: '37.8651', longitude: '-119.5383' },
          { parkCode: 'nocoords', fullName: 'No Coords', latitude: '', longitude: '' },
        ],
      }),
    });

    const result = await fetchParks();

    expect(result).toHaveLength(1);
    expect(result[0].parkCode).toBe('yose');
  });

  it('throws on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(fetchParks()).rejects.toThrow('NPS API 403');
  });
});
