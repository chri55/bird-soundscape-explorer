const BASE_URL = 'https://api.ebird.org/v2';

export interface EBirdObservation {
  speciesCode: string;
  comName: string;
  sciName: string;
  locName: string;
  obsDt: string;
  howMany?: number;
  lat: number;
  lng: number;
  // present when detail=full
  locId?: string;
  subId?: string;
  obsValid?: boolean;
  obsReviewed?: boolean;
  locationPrivate?: boolean;
}

export interface EBirdTaxon {
  sciName: string;
  comName: string;
  speciesCode: string;
  category: string;
  taxonOrder: number;
  bandingCodes: string[];
  comNameCodes: string[];
  sciNameCodes: string[];
  order: string;
  familyComName: string;
  familySciName: string;
}

function ebirdHeaders(): HeadersInit {
  return { 'x-ebirdapitoken': import.meta.env.VITE_EBIRD_API_KEY as string };
}

function clampDist(dist: number): number {
  return Math.min(dist, 50);
}

export async function fetchRecentNearby(
  lat: number,
  lng: number,
  options: { maxResults?: number; dist?: number } = {},
): Promise<EBirdObservation[]> {
  const { maxResults = 50, dist = 25 } = options;
  const url = `${BASE_URL}/data/obs/geo/recent?lat=${lat}&lng=${lng}&maxResults=${maxResults}&dist=${clampDist(dist)}`;
  const res = await fetch(url, { headers: ebirdHeaders() });
  if (!res.ok) throw new Error(`eBird error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<EBirdObservation[]>;
}

export async function fetchNearbyNotable(
  lat: number,
  lng: number,
  options: { dist?: number; maxResults?: number } = {},
): Promise<EBirdObservation[]> {
  const { dist = 25, maxResults = 50 } = options;
  const url = `${BASE_URL}/data/obs/geo/recent/notable?lat=${lat}&lng=${lng}&dist=${clampDist(dist)}&maxResults=${maxResults}`;
  const res = await fetch(url, { headers: ebirdHeaders() });
  if (!res.ok) throw new Error(`eBird error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<EBirdObservation[]>;
}

const taxonomyCache = new Map<string, EBirdTaxon | null>();

function getTaxonomyKey(): string {
  return `ebird-taxonomy-${new Date().getFullYear()}`;
}

function getTaxonomyCache(): Map<string, EBirdTaxon | null> {
  if (taxonomyCache.size > 0) return taxonomyCache;
  try {
    const stored = JSON.parse(localStorage.getItem(getTaxonomyKey()) ?? '{}') as Record<string, EBirdTaxon | null>;
    for (const [k, v] of Object.entries(stored)) taxonomyCache.set(k, v);
  } catch {
    // ignore corrupt cache
  }
  return taxonomyCache;
}

// For testing: clear in-memory cache
export function clearTaxonomyCache(): void {
  taxonomyCache.clear();
}

export async function fetchTaxonomy(speciesCodes: string[]): Promise<EBirdTaxon[]> {
  const cache = getTaxonomyCache();
  const missing = speciesCodes.filter(c => !cache.has(c));

  if (missing.length > 0) {
    const url = `${BASE_URL}/ref/taxonomy/ebird?fmt=json&species=${missing.join(',')}`;
    const res = await fetch(url, { headers: ebirdHeaders() });
    if (!res.ok) throw new Error(`eBird taxonomy error ${res.status}: ${await res.text()}`);
    const fetched = await res.json() as EBirdTaxon[];
    const fetchedMap = new Map(fetched.map(t => [t.speciesCode, t]));
    for (const code of missing) {
      cache.set(code, fetchedMap.get(code) ?? null);
    }
    // Persist: store as object (nulls included) so not-found codes are remembered
    const toStore: Record<string, EBirdTaxon | null> = {};
    for (const [k, v] of cache) toStore[k] = v;
    localStorage.setItem(getTaxonomyKey(), JSON.stringify(toStore));
  }

  return speciesCodes.map(c => cache.get(c) ?? null).filter((t): t is EBirdTaxon => t !== null);
}
