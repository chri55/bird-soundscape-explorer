import { fetchWikiSummary } from './wikipedia';

const mockFetch = vi.fn();
(global as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchWikiSummary', () => {
  it('returns extract and pageUrl on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        extract: 'The American Robin is a migratory songbird.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/American_robin' } },
      }),
    });
    const result = await fetchWikiSummary('American Robin');
    expect(result).toEqual({
      extract: 'The American Robin is a migratory songbird.',
      pageUrl: 'https://en.wikipedia.org/wiki/American_robin',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://en.wikipedia.org/api/rest_v1/page/summary/American%20Robin',
    );
  });

  it('returns null on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchWikiSummary('Nonexistent Bird');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchWikiSummary('American Robin');
    expect(result).toBeNull();
  });
});
