const WIKI_API = 'https://en.wikipedia.org/api/rest_v1';

export interface WikiSummary {
  extract: string;
  pageUrl: string;
}

export async function fetchWikiSummary(name: string): Promise<WikiSummary | null> {
  try {
    const res = await fetch(`${WIKI_API}/page/summary/${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const data = await res.json() as {
      extract: string;
      content_urls: { desktop: { page: string } };
    };
    return { extract: data.extract, pageUrl: data.content_urls.desktop.page };
  } catch {
    return null;
  }
}
