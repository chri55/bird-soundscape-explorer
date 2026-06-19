import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBirdPhoto } from './inat';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  // Clear the module-level cache between tests by re-importing
  vi.resetModules();
});

const mockResponse = {
  total_results: 1,
  results: [
    {
      id: 4849,
      name: 'Turdus migratorius',
      matched_term: 'Turdus migratorius',
      default_photo: {
        id: 34859026,
        license_code: 'cc-by-nc',
        attribution: '(c) John Reynolds, some rights reserved (CC BY-NC)',
        url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/34859026/square.jpg',
        original_dimensions: { height: 1365, width: 2048 },
        square_url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/34859026/square.jpg',
        medium_url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/34859026/medium.jpg',
      },
    },
  ],
};

describe('fetchBirdPhoto', () => {
  it('returns BirdPhoto for a valid species', async () => {
    const { fetchBirdPhoto: fetch } = await import('./inat');
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockResponse });

    const result = await fetch('Turdus migratorius');

    expect(result).not.toBeNull();
    expect(result!.photoUrl).toBe(
      'https://inaturalist-open-data.s3.amazonaws.com/photos/34859026/medium.jpg',
    );
    expect(result!.largeUrl).toBe(
      'https://inaturalist-open-data.s3.amazonaws.com/photos/34859026/large.jpg',
    );
    expect(result!.attribution).toBe('(c) John Reynolds, some rights reserved (CC BY-NC)');
    expect(result!.licenseCode).toBe('cc-by-nc');
  });

  it('returns null when total_results is 0', async () => {
    const { fetchBirdPhoto: fetch } = await import('./inat');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_results: 0, results: [] }),
    });

    const result = await fetch('Fakus birdus');
    expect(result).toBeNull();
  });

  it('returns null when default_photo is null', async () => {
    const { fetchBirdPhoto: fetch } = await import('./inat');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total_results: 1,
        results: [{ id: 1, name: 'Test', matched_term: 'Test', default_photo: null }],
      }),
    });

    const result = await fetch('Test species');
    expect(result).toBeNull();
  });

  it('encodes scientific name in the URL', async () => {
    const { fetchBirdPhoto: fetch } = await import('./inat');
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ total_results: 0, results: [] }) });

    await fetch('Parus major');
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('Parus%20major');
    expect(url).toContain('rank=species');
    expect(url).toContain('per_page=1');
  });
});
