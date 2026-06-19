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
  const url = `${BASE_URL}/data/obs/geo/recent?lat=${lat}&lng=${lng}&maxResults=${maxResults}&dist=${clampDist(dist)}&detail=full`;
  const res = await fetch(url, { headers: ebirdHeaders() });
  if (!res.ok) throw new Error(`eBird error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<EBirdObservation[]>;
}

export async function fetchNearbyNotable(
  lat: number,
  lng: number,
  options: { dist?: number; back?: number; maxResults?: number } = {},
): Promise<EBirdObservation[]> {
  const { dist = 25, back = 14, maxResults = 50 } = options;
  const url = `${BASE_URL}/data/obs/geo/recentnotable?lat=${lat}&lng=${lng}&dist=${clampDist(dist)}&back=${back}&maxResults=${maxResults}&detail=full`;
  const res = await fetch(url, { headers: ebirdHeaders() });
  if (!res.ok) throw new Error(`eBird error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<EBirdObservation[]>;
}

const TAXONOMY_KEY = `ebird-taxonomy-${new Date().getFullYear()}`;

function getTaxonomyCache(): Record<string, EBirdTaxon> {
  try {
    return JSON.parse(localStorage.getItem(TAXONOMY_KEY) ?? '{}') as Record<string, EBirdTaxon>;
  } catch {
    return {};
  }
}

export async function fetchTaxonomy(speciesCodes: string[]): Promise<EBirdTaxon[]> {
  const cache = getTaxonomyCache();
  const missing = speciesCodes.filter(c => !(c in cache));

  if (missing.length > 0) {
    const url = `${BASE_URL}/ref/taxonomy/ebird?fmt=json&species=${missing.join(',')}`;
    const res = await fetch(url, { headers: ebirdHeaders() });
    if (!res.ok) throw new Error(`eBird taxonomy error ${res.status}: ${await res.text()}`);
    const fetched = await res.json() as EBirdTaxon[];
    for (const t of fetched) cache[t.speciesCode] = t;
    localStorage.setItem(TAXONOMY_KEY, JSON.stringify(cache));
  }

  return speciesCodes.map(c => cache[c]).filter(Boolean);
}
