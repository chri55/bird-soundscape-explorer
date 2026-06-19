# Featured Bird Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Featured Bird Card sidebar that auto-selects and displays the rarest (or most common) bird near a map pin, showing a photo, spectrogram, taxonomy, and a rarity toggle — with no required user interaction.

**Architecture:** Pin drops trigger debounced, geographically-cached API calls to eBird (recent + notable observations) and Xeno-canto (recordings). A `useFeaturedBird` hook selects the featured species and fetches its photo from iNaturalist and taxonomy from eBird. A pure `FeaturedBirdCard` component renders the result alongside the map.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library, eBird API v2, Xeno-canto API v3, iNaturalist API v1.

## Global Constraints

- All API keys read from `import.meta.env.VITE_EBIRD_API_KEY` and `import.meta.env.VITE_XC_API_KEY`; iNaturalist requires no key
- eBird `dist` param hard-capped at 50 km on all geo endpoints
- iNaturalist photo S3 URLs used only in `<img>` tags — never `fetch()`'d (no CORS)
- iNaturalist `attribution` string must be displayed alongside every photo
- `npm test` must pass; `npm run build` must be clean after every task
- No new npm packages — all six tasks use existing dependencies

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/geo.ts` | Create | `LatLng` interface + `haversineKm` |
| `src/utils/geo.test.ts` | Create | Tests for haversineKm |
| `src/api/ebird.ts` | Modify | Add `EBirdTaxon`, extend `EBirdObservation`, add `fetchNearbyNotable` + `fetchTaxonomy` |
| `src/api/ebird.test.ts` | Create | Tests for new eBird functions |
| `src/api/inat.ts` | Create | `BirdPhoto` interface + `fetchBirdPhoto` with session cache |
| `src/api/inat.test.ts` | Create | Tests for fetchBirdPhoto |
| `src/hooks/useFeaturedBird.ts` | Create | Hook: mode toggle, species selection, photo + taxonomy fetch |
| `src/hooks/useFeaturedBird.test.ts` | Create | Hook tests |
| `src/components/FeaturedBirdCard.tsx` | Create | Pure presentational card component |
| `src/components/FeaturedBirdCard.test.tsx` | Create | Component render tests |
| `src/components/MapView.tsx` | Modify | Add debounce, geo cache, API calls, render FeaturedBirdCard |

---

## Task 1: Geo Utility

**Files:**
- Create: `src/utils/geo.ts`
- Create: `src/utils/geo.test.ts`
- Modify: `src/components/MapView.tsx` (import `LatLng` from geo instead of defining it locally)

**Interfaces:**
- Produces: `export interface LatLng { lat: number; lng: number }` and `export function haversineKm(a: LatLng, b: LatLng): number`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/geo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { haversineKm } from './geo';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm({ lat: 51.5, lng: -0.1 }, { lat: 51.5, lng: -0.1 })).toBe(0);
  });

  it('returns ~341 km between London and Paris', () => {
    const km = haversineKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 });
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(350);
  });

  it('returns less than 10 for points 5 km apart', () => {
    // Move ~5 km north from (51.5, -0.1): 1 degree lat ≈ 111 km, so 0.045 deg ≈ 5 km
    const km = haversineKm({ lat: 51.5, lng: -0.1 }, { lat: 51.545, lng: -0.1 });
    expect(km).toBeLessThan(10);
  });

  it('returns more than 10 for points 15 km apart', () => {
    // 0.135 deg lat ≈ 15 km
    const km = haversineKm({ lat: 51.5, lng: -0.1 }, { lat: 51.635, lng: -0.1 });
    expect(km).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --run src/utils/geo.test.ts
```

Expected: `Cannot find module './geo'`

- [ ] **Step 3: Create `src/utils/geo.ts`**

```typescript
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const chord =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng * sinDLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --run src/utils/geo.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Update `MapView.tsx` to import `LatLng` from geo**

Replace the `export interface LatLng` block in `src/components/MapView.tsx` with an import:

```typescript
import { LatLng } from '../utils/geo';
```

Remove lines 21–24 (`export interface LatLng { ... }`).

- [ ] **Step 6: Verify build is clean**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/geo.ts src/utils/geo.test.ts src/components/MapView.tsx
git commit -m "feat: add haversineKm geo utility; move LatLng to geo.ts"
```

---

## Task 2: Expand eBird API Client

**Files:**
- Modify: `src/api/ebird.ts`
- Create: `src/api/ebird.test.ts`

**Interfaces:**
- Produces:
  - `export interface EBirdTaxon { sciName, comName, speciesCode, category, taxonOrder, bandingCodes, comNameCodes, sciNameCodes, order, familyComName, familySciName }`
  - `export async function fetchNearbyNotable(lat, lng, options?): Promise<EBirdObservation[]>`
  - `export async function fetchTaxonomy(speciesCodes: string[]): Promise<EBirdTaxon[]>` — lazy localStorage cache keyed `ebird-taxonomy-YYYY`

- [ ] **Step 1: Write failing tests**

Create `src/api/ebird.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNearbyNotable, fetchTaxonomy, EBirdTaxon } from './ebird';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
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

    const newTaxon: EBirdTaxon = { ...mockTaxonResponse[0] as EBirdTaxon, speciesCode: 'amerob', comName: 'American Robin', sciName: 'Turdus migratorius' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [newTaxon],
    });

    const result = await fetchTaxonomy(['snobun', 'amerob']);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --run src/api/ebird.test.ts
```

Expected: `fetchNearbyNotable is not a function`, `fetchTaxonomy is not a function`

- [ ] **Step 3: Update `src/api/ebird.ts`**

Replace the entire file:

```typescript
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --run src/api/ebird.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/api/ebird.ts src/api/ebird.test.ts
git commit -m "feat: add fetchNearbyNotable and fetchTaxonomy to eBird client"
```

---

## Task 3: iNaturalist Photo Client

**Files:**
- Create: `src/api/inat.ts`
- Create: `src/api/inat.test.ts`

**Interfaces:**
- Produces: `export interface BirdPhoto { photoUrl, largeUrl, attribution, licenseCode }` and `export async function fetchBirdPhoto(sciName: string): Promise<BirdPhoto | null>`

- [ ] **Step 1: Write failing tests**

Create `src/api/inat.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --run src/api/inat.test.ts
```

Expected: `Cannot find module './inat'`

- [ ] **Step 3: Create `src/api/inat.ts`**

```typescript
const BASE_URL = 'https://api.inaturalist.org/v1';

export interface BirdPhoto {
  photoUrl: string;
  largeUrl: string;
  attribution: string;
  licenseCode: string;
}

interface INatPhoto {
  id: number;
  license_code: string;
  attribution: string;
  medium_url: string;
}

interface INatTaxon {
  id: number;
  name: string;
  matched_term: string;
  default_photo: INatPhoto | null;
}

interface INatTaxaResponse {
  total_results: number;
  results: INatTaxon[];
}

const photoCache = new Map<string, BirdPhoto | null>();

export async function fetchBirdPhoto(sciName: string): Promise<BirdPhoto | null> {
  if (photoCache.has(sciName)) return photoCache.get(sciName)!;

  const url = `${BASE_URL}/taxa?q=${encodeURIComponent(sciName)}&rank=species&per_page=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iNaturalist error ${res.status}: ${await res.text()}`);

  const data = await res.json() as INatTaxaResponse;

  if (data.total_results === 0 || !data.results[0]?.default_photo) {
    photoCache.set(sciName, null);
    return null;
  }

  const photo = data.results[0].default_photo!;
  const largeUrl = photo.medium_url.replace('/medium.', '/large.');

  const result: BirdPhoto = {
    photoUrl: photo.medium_url,
    largeUrl,
    attribution: photo.attribution,
    licenseCode: photo.license_code,
  };

  photoCache.set(sciName, result);
  return result;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --run src/api/inat.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/api/inat.ts src/api/inat.test.ts
git commit -m "feat: add iNaturalist photo client with session cache"
```

---

## Task 4: FeaturedBirdCard Component

**Files:**
- Create: `src/components/FeaturedBirdCard.tsx`
- Create: `src/components/FeaturedBirdCard.test.tsx`

**Interfaces:**
- Consumes: `EBirdObservation`, `EBirdTaxon` from `../api/ebird`; `BirdPhoto` from `../api/inat`; `XCRecording` from `../api/xeno-canto`
- Produces: `export function FeaturedBirdCard(props: FeaturedBirdCardProps): JSX.Element`

```typescript
export interface FeaturedBirdCardProps {
  observation: EBirdObservation;
  taxon: EBirdTaxon | null;
  photo: BirdPhoto | null;
  recording: XCRecording | null;
  isNotable: boolean;
  mode: 'rarest' | 'common';
  onToggleMode: () => void;
  showToggle: boolean;
}
```

- [ ] **Step 1: Write failing tests**

Create `src/components/FeaturedBirdCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeaturedBirdCard, FeaturedBirdCardProps } from './FeaturedBirdCard';
import { EBirdObservation, EBirdTaxon } from '../api/ebird';
import { BirdPhoto } from '../api/inat';
import { XCRecording } from '../api/xeno-canto';

const obs: EBirdObservation = {
  speciesCode: 'snobun',
  comName: 'Snow Bunting',
  sciName: 'Plectrophenax nivalis',
  locName: 'Central Park',
  obsDt: '2026-06-19 08:00',
  howMany: 1,
  lat: 40.78,
  lng: -73.97,
};

const taxon: EBirdTaxon = {
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
};

const photo: BirdPhoto = {
  photoUrl: 'https://example.com/medium.jpg',
  largeUrl: 'https://example.com/large.jpg',
  attribution: '(c) Test User, CC BY-NC',
  licenseCode: 'cc-by-nc',
};

const recording: XCRecording = {
  id: '1',
  gen: 'Plectrophenax',
  sp: 'nivalis',
  en: 'Snow Bunting',
  rec: 'Jane Doe',
  cnt: 'United States',
  loc: 'Central Park',
  lat: '40.78',
  lon: '-73.97',
  type: 'song',
  q: 'A',
  file: 'https://xeno-canto.org/sounds/uploaded/test.mp3',
  date: '2026-01-15',
  'file-name': 'test.mp3',
  sono: {
    small: 'https://xeno-canto.org/sono/small/test.png',
    med: 'https://xeno-canto.org/sono/med/test.png',
  },
};

const defaults: FeaturedBirdCardProps = {
  observation: obs,
  taxon,
  photo,
  recording,
  isNotable: false,
  mode: 'rarest',
  onToggleMode: vi.fn(),
  showToggle: true,
};

describe('FeaturedBirdCard', () => {
  it('renders common and scientific name', () => {
    render(<FeaturedBirdCard {...defaults} />);
    expect(screen.getByText('Snow Bunting')).toBeInTheDocument();
    expect(screen.getByText('Plectrophenax nivalis')).toBeInTheDocument();
  });

  it('renders taxonomy when provided', () => {
    render(<FeaturedBirdCard {...defaults} />);
    expect(screen.getByText(/Passeriformes/)).toBeInTheDocument();
    expect(screen.getByText(/Old World Sparrows/)).toBeInTheDocument();
  });

  it('shows photo as hero image when photo is provided', () => {
    render(<FeaturedBirdCard {...defaults} />);
    const img = screen.getByAltText('Snow Bunting') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/medium.jpg');
  });

  it('shows spectrogram as hero when photo is null', () => {
    render(<FeaturedBirdCard {...defaults} photo={null} />);
    const img = screen.getByAltText(/Spectrogram of Snow Bunting/) as HTMLImageElement;
    expect(img.src).toBe('https://xeno-canto.org/sono/med/test.png');
  });

  it('shows fallback message when both photo and recording are null', () => {
    render(<FeaturedBirdCard {...defaults} photo={null} recording={null} />);
    expect(screen.getByText(/No image available/)).toBeInTheDocument();
  });

  it('shows Rare sighting badge when isNotable is true', () => {
    render(<FeaturedBirdCard {...defaults} isNotable />);
    expect(screen.getByText('Rare sighting')).toBeInTheDocument();
  });

  it('does not show badge when isNotable is false', () => {
    render(<FeaturedBirdCard {...defaults} isNotable={false} />);
    expect(screen.queryByText('Rare sighting')).not.toBeInTheDocument();
  });

  it('renders toggle buttons when showToggle is true', () => {
    render(<FeaturedBirdCard {...defaults} showToggle />);
    expect(screen.getByRole('button', { name: 'Rarest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Most Common' })).toBeInTheDocument();
  });

  it('hides toggle when showToggle is false', () => {
    render(<FeaturedBirdCard {...defaults} showToggle={false} />);
    expect(screen.queryByRole('button', { name: 'Rarest' })).not.toBeInTheDocument();
  });

  it('calls onToggleMode when inactive toggle button is clicked', () => {
    const onToggleMode = vi.fn();
    render(<FeaturedBirdCard {...defaults} mode="rarest" onToggleMode={onToggleMode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Most Common' }));
    expect(onToggleMode).toHaveBeenCalledOnce();
  });

  it('shows spectrogram section when photo and recording are both present', () => {
    render(<FeaturedBirdCard {...defaults} />);
    const imgs = screen.getAllByRole('img');
    const spectrogramImg = imgs.find(img => (img as HTMLImageElement).src.includes('sono'));
    expect(spectrogramImg).toBeTruthy();
  });

  it('hides spectrogram section when recording is null', () => {
    render(<FeaturedBirdCard {...defaults} recording={null} />);
    const imgs = screen.queryAllByRole('img');
    const spectrogramImg = imgs.find(img => (img as HTMLImageElement).src?.includes('sono'));
    expect(spectrogramImg).toBeUndefined();
  });

  it('displays photo attribution', () => {
    render(<FeaturedBirdCard {...defaults} />);
    expect(screen.getByText('(c) Test User, CC BY-NC')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --run src/components/FeaturedBirdCard.test.tsx
```

Expected: `Cannot find module './FeaturedBirdCard'`

- [ ] **Step 3: Create `src/components/FeaturedBirdCard.tsx`**

```typescript
import { EBirdObservation, EBirdTaxon } from '../api/ebird';
import { BirdPhoto } from '../api/inat';
import { XCRecording } from '../api/xeno-canto';

export interface FeaturedBirdCardProps {
  observation: EBirdObservation;
  taxon: EBirdTaxon | null;
  photo: BirdPhoto | null;
  recording: XCRecording | null;
  isNotable: boolean;
  mode: 'rarest' | 'common';
  onToggleMode: () => void;
  showToggle: boolean;
}

export function FeaturedBirdCard({
  observation,
  taxon,
  photo,
  recording,
  isNotable,
  mode,
  onToggleMode,
  showToggle,
}: FeaturedBirdCardProps) {
  return (
    <div className="w-80 flex flex-col bg-white border-l border-gray-200 overflow-y-auto shrink-0">
      {showToggle && (
        <div className="flex border-b border-gray-100 text-sm shrink-0">
          <button
            className={`flex-1 py-2 font-medium transition-colors ${
              mode === 'rarest' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => mode !== 'rarest' && onToggleMode()}
          >
            Rarest
          </button>
          <button
            className={`flex-1 py-2 font-medium transition-colors ${
              mode === 'common' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => mode !== 'common' && onToggleMode()}
          >
            Most Common
          </button>
        </div>
      )}

      {/* Hero image */}
      <div className="relative shrink-0">
        {photo ? (
          <img
            src={photo.photoUrl}
            alt={observation.comName}
            className="w-full aspect-video object-cover"
          />
        ) : recording?.sono.med ? (
          <img
            src={recording.sono.med}
            alt={`Spectrogram of ${observation.comName}`}
            className="w-full aspect-video object-cover bg-gray-900"
          />
        ) : (
          <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
            No image available
          </div>
        )}
        {isNotable && (
          <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
            Rare sighting
          </span>
        )}
      </div>

      {/* Names */}
      <div className="px-4 pt-3 pb-1">
        <h2 className="text-lg font-bold text-gray-900 leading-tight">{observation.comName}</h2>
        <p className="text-sm italic text-gray-500 mt-0.5">{observation.sciName}</p>
      </div>

      {/* Taxonomy */}
      {taxon && (
        <div className="px-4 py-1 text-xs text-gray-500">
          {taxon.order} · {taxon.familyComName}
        </div>
      )}

      {/* Spectrogram (secondary, shown when photo is also present) */}
      {photo && recording?.sono.med && (
        <div className="px-4 py-2">
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{recording.type}</p>
          <img
            src={recording.sono.med}
            alt="Sound spectrogram"
            className="w-full rounded border border-gray-100"
          />
        </div>
      )}

      {/* Attribution */}
      <div className="mt-auto px-4 py-3 text-xs text-gray-400 space-y-1 border-t border-gray-100">
        {photo && <p>{photo.attribution}</p>}
        {recording && <p>Recording: {recording.rec}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --run src/components/FeaturedBirdCard.test.tsx
```

Expected: 13 tests pass.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/FeaturedBirdCard.tsx src/components/FeaturedBirdCard.test.tsx
git commit -m "feat: add FeaturedBirdCard presentational component"
```

---

## Task 5: useFeaturedBird Hook

**Files:**
- Create: `src/hooks/useFeaturedBird.ts`
- Create: `src/hooks/useFeaturedBird.test.ts`

**Interfaces:**
- Consumes:
  - `EBirdObservation`, `EBirdTaxon`, `fetchTaxonomy` from `../api/ebird`
  - `BirdPhoto`, `fetchBirdPhoto` from `../api/inat`
  - `XCRecording` from `../api/xeno-canto`
- Produces:
```typescript
export function useFeaturedBird(input: UseFeaturedBirdInput): UseFeaturedBirdResult
interface UseFeaturedBirdInput {
  notableObservations: EBirdObservation[];
  recentObservations: EBirdObservation[];
  recordings: XCRecording[];
}
interface UseFeaturedBirdResult {
  observation: EBirdObservation | null;
  taxon: EBirdTaxon | null;
  photo: BirdPhoto | null;
  recording: XCRecording | null;
  isNotable: boolean;
  mode: 'rarest' | 'common';
  onToggleMode: () => void;
  showToggle: boolean;
  loading: boolean;
}
```

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useFeaturedBird.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { EBirdObservation, EBirdTaxon } from '../api/ebird';
import { BirdPhoto } from '../api/inat';
import { XCRecording } from '../api/xeno-canto';

vi.mock('../api/ebird', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/ebird')>();
  return { ...actual, fetchTaxonomy: vi.fn() };
});
vi.mock('../api/inat', () => ({ fetchBirdPhoto: vi.fn() }));

import { fetchTaxonomy } from '../api/ebird';
import { fetchBirdPhoto } from '../api/inat';
import { useFeaturedBird } from './useFeaturedBird';

const notable: EBirdObservation = {
  speciesCode: 'snobun', comName: 'Snow Bunting', sciName: 'Plectrophenax nivalis',
  locName: 'Park', obsDt: '2026-06-19', howMany: 1, lat: 40.78, lng: -73.97,
};
const common: EBirdObservation = {
  speciesCode: 'amerob', comName: 'American Robin', sciName: 'Turdus migratorius',
  locName: 'Park', obsDt: '2026-06-19', howMany: 12, lat: 40.78, lng: -73.97,
};
const taxon: EBirdTaxon = {
  sciName: 'Plectrophenax nivalis', comName: 'Snow Bunting', speciesCode: 'snobun',
  category: 'species', taxonOrder: 36000, bandingCodes: [], comNameCodes: [], sciNameCodes: [],
  order: 'Passeriformes', familyComName: 'Old World Sparrows', familySciName: 'Passeridae',
};
const photo: BirdPhoto = {
  photoUrl: 'https://example.com/medium.jpg', largeUrl: 'https://example.com/large.jpg',
  attribution: '(c) Test', licenseCode: 'cc-by-nc',
};
const recording: XCRecording = {
  id: '1', gen: 'Plectrophenax', sp: 'nivalis', en: 'Snow Bunting',
  rec: 'Jane Doe', cnt: 'US', loc: 'Park', lat: '40.78', lon: '-73.97',
  type: 'song', q: 'A', file: 'https://xeno-canto.org/test.mp3',
  date: '2026-01-15', 'file-name': 'test.mp3',
  sono: { small: 'https://xeno-canto.org/sono/small.png', med: 'https://xeno-canto.org/sono/med.png' },
};

beforeEach(() => {
  vi.mocked(fetchBirdPhoto).mockReset();
  vi.mocked(fetchTaxonomy).mockReset();
  vi.mocked(fetchBirdPhoto).mockResolvedValue(photo);
  vi.mocked(fetchTaxonomy).mockResolvedValue([taxon]);
});

describe('useFeaturedBird', () => {
  it('selects first notable observation in rarest mode by default', async () => {
    const { result } = renderHook(() =>
      useFeaturedBird({ notableObservations: [notable], recentObservations: [common], recordings: [] }),
    );

    expect(result.current.observation?.speciesCode).toBe('snobun');
    expect(result.current.isNotable).toBe(true);
    expect(result.current.mode).toBe('rarest');
    expect(result.current.showToggle).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.photo).toEqual(photo);
    expect(result.current.taxon).toEqual(taxon);
  });

  it('falls back to most common when no notable observations exist', async () => {
    const { result } = renderHook(() =>
      useFeaturedBird({ notableObservations: [], recentObservations: [common], recordings: [] }),
    );

    expect(result.current.observation?.speciesCode).toBe('amerob');
    expect(result.current.isNotable).toBe(false);
    expect(result.current.showToggle).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('switches to common mode on onToggleMode', async () => {
    const { result } = renderHook(() =>
      useFeaturedBird({ notableObservations: [notable], recentObservations: [common], recordings: [] }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.onToggleMode());

    expect(result.current.mode).toBe('common');
    expect(result.current.observation?.speciesCode).toBe('amerob');
    expect(result.current.isNotable).toBe(false);
  });

  it('selects observation with highest howMany in common mode', async () => {
    const rare: EBirdObservation = { ...common, speciesCode: 'blujay', comName: 'Blue Jay', howMany: 3 };
    const { result } = renderHook(() =>
      useFeaturedBird({ notableObservations: [], recentObservations: [rare, common], recordings: [] }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.observation?.speciesCode).toBe('amerob'); // howMany: 12 wins
  });

  it('returns bestRecording matching the featured species', async () => {
    const { result } = renderHook(() =>
      useFeaturedBird({
        notableObservations: [notable],
        recentObservations: [],
        recordings: [recording],
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.recording?.id).toBe('1');
  });

  it('returns null recording when no recording matches the featured species', async () => {
    const { result } = renderHook(() =>
      useFeaturedBird({
        notableObservations: [notable],
        recentObservations: [],
        recordings: [{ ...recording, gen: 'Turdus', sp: 'migratorius' }],
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.recording).toBeNull();
  });

  it('returns null observation when all lists are empty', () => {
    const { result } = renderHook(() =>
      useFeaturedBird({ notableObservations: [], recentObservations: [], recordings: [] }),
    );

    expect(result.current.observation).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --run src/hooks/useFeaturedBird.test.ts
```

Expected: `Cannot find module './useFeaturedBird'`

- [ ] **Step 3: Create `src/hooks/useFeaturedBird.ts`**

```typescript
import { useState, useEffect } from 'react';
import { EBirdObservation, EBirdTaxon, fetchTaxonomy } from '../api/ebird';
import { BirdPhoto, fetchBirdPhoto } from '../api/inat';
import { XCRecording } from '../api/xeno-canto';

export interface UseFeaturedBirdInput {
  notableObservations: EBirdObservation[];
  recentObservations: EBirdObservation[];
  recordings: XCRecording[];
}

export interface UseFeaturedBirdResult {
  observation: EBirdObservation | null;
  taxon: EBirdTaxon | null;
  photo: BirdPhoto | null;
  recording: XCRecording | null;
  isNotable: boolean;
  mode: 'rarest' | 'common';
  onToggleMode: () => void;
  showToggle: boolean;
  loading: boolean;
}

function selectFeatured(
  mode: 'rarest' | 'common',
  notable: EBirdObservation[],
  recent: EBirdObservation[],
): { obs: EBirdObservation | null; isNotable: boolean; showToggle: boolean } {
  const hasNotable = notable.length > 0;

  if (mode === 'rarest' && hasNotable) {
    return { obs: notable[0], isNotable: true, showToggle: true };
  }

  const mostCommon = recent.reduce<EBirdObservation | null>(
    (best, obs) => (!best || (obs.howMany ?? 0) > (best.howMany ?? 0) ? obs : best),
    null,
  );

  return { obs: mostCommon, isNotable: false, showToggle: hasNotable };
}

function bestRecording(sciName: string, recordings: XCRecording[]): XCRecording | null {
  const parts = sciName.toLowerCase().split(' ');
  const genus = parts[0] ?? '';
  const species = parts[1] ?? '';
  const qualityRank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const typeScore = (type: string) => (type.toLowerCase().includes('song') ? 0 : 1);

  const matches = recordings.filter(
    r => r.gen.toLowerCase() === genus && r.sp.toLowerCase() === species,
  );

  if (matches.length === 0) return null;

  return [...matches].sort((a, b) => {
    const qDiff = (qualityRank[a.q] ?? 5) - (qualityRank[b.q] ?? 5);
    return qDiff !== 0 ? qDiff : typeScore(a.type) - typeScore(b.type);
  })[0];
}

export function useFeaturedBird({
  notableObservations,
  recentObservations,
  recordings,
}: UseFeaturedBirdInput): UseFeaturedBirdResult {
  const [mode, setMode] = useState<'rarest' | 'common'>('rarest');
  const [photo, setPhoto] = useState<BirdPhoto | null>(null);
  const [taxon, setTaxon] = useState<EBirdTaxon | null>(null);
  const [loading, setLoading] = useState(false);

  const { obs, isNotable, showToggle } = selectFeatured(mode, notableObservations, recentObservations);

  useEffect(() => {
    if (!obs) {
      setPhoto(null);
      setTaxon(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchBirdPhoto(obs.sciName),
      fetchTaxonomy([obs.speciesCode]),
    ])
      .then(([p, taxa]) => {
        if (!cancelled) {
          setPhoto(p);
          setTaxon(taxa[0] ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhoto(null);
          setTaxon(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [obs?.speciesCode]);

  const recording = obs ? bestRecording(obs.sciName, recordings) : null;

  return {
    observation: obs,
    taxon,
    photo,
    recording,
    isNotable,
    mode,
    onToggleMode: () => setMode(m => (m === 'rarest' ? 'common' : 'rarest')),
    showToggle,
    loading,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --run src/hooks/useFeaturedBird.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFeaturedBird.ts src/hooks/useFeaturedBird.test.ts
git commit -m "feat: add useFeaturedBird hook with rarity toggle and species selection"
```

---

## Task 6: Wire MapView — Debounce, Geo Cache, API Calls, Render Card

**Files:**
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- Consumes:
  - `LatLng`, `haversineKm` from `../utils/geo`
  - `EBirdObservation`, `fetchRecentNearby`, `fetchNearbyNotable` from `../api/ebird`
  - `XCRecording`, `fetchRecordingsByBox` from `../api/xeno-canto`
  - `useFeaturedBird` from `../hooks/useFeaturedBird`
  - `FeaturedBirdCard` from `./FeaturedBirdCard`

- [ ] **Step 1: Replace `src/components/MapView.tsx`**

```typescript
import { useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

import { LatLng, haversineKm } from '../utils/geo';
import { EBirdObservation, fetchRecentNearby, fetchNearbyNotable } from '../api/ebird';
import { XCRecording, fetchRecordingsByBox } from '../api/xeno-canto';
import { useFeaturedBird } from '../hooks/useFeaturedBird';
import { FeaturedBirdCard } from './FeaturedBirdCard';

const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const FETCH_RADIUS_KM = 10;
const DEBOUNCE_MS = 500;
const XC_BOX_DEG = 0.225; // ≈25 km

function PinHandler({ onPin }: { onPin: (pos: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function MapView() {
  const [pin, setPin] = useState<LatLng | null>(null);
  const [notableObs, setNotableObs] = useState<EBirdObservation[]>([]);
  const [recentObs, setRecentObs] = useState<EBirdObservation[]>([]);
  const [recordings, setRecordings] = useState<XCRecording[]>([]);

  const lastFetchRef = useRef<LatLng | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const featured = useFeaturedBird({
    notableObservations: notableObs,
    recentObservations: recentObs,
    recordings,
  });

  const fetchForPin = useCallback(async (pos: LatLng) => {
    if (lastFetchRef.current && haversineKm(pos, lastFetchRef.current) < FETCH_RADIUS_KM) return;
    lastFetchRef.current = pos;

    const [notable, recent, xcRes] = await Promise.all([
      fetchNearbyNotable(pos.lat, pos.lng),
      fetchRecentNearby(pos.lat, pos.lng),
      fetchRecordingsByBox(
        pos.lat - XC_BOX_DEG,
        pos.lat + XC_BOX_DEG,
        pos.lng - XC_BOX_DEG,
        pos.lng + XC_BOX_DEG,
      ),
    ]);

    setNotableObs(notable);
    setRecentObs(recent);
    setRecordings(xcRes.recordings);
  }, []);

  const handlePin = useCallback(
    (pos: LatLng) => {
      setPin(pos);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void fetchForPin(pos), DEBOUNCE_MS);
    },
    [fetchForPin],
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="px-4 py-2 bg-green-800 text-white flex items-center gap-3 shrink-0">
        <span className="text-lg font-semibold">Bird Soundscape Explorer</span>
        {pin && (
          <span className="text-sm text-green-200 ml-auto">
            {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <MapContainer center={[20, 0]} zoom={3} className="flex-1 cursor-crosshair">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <PinHandler onPin={handlePin} />
          {pin && <Marker position={[pin.lat, pin.lng]} icon={defaultIcon} />}
        </MapContainer>

        {featured.observation && (
          <FeaturedBirdCard
            observation={featured.observation}
            taxon={featured.taxon}
            photo={featured.photo}
            recording={featured.recording}
            isNotable={featured.isNotable}
            mode={featured.mode}
            onToggleMode={featured.onToggleMode}
            showToggle={featured.showToggle}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite — expect PASS**

```bash
npm test -- --run
```

Expected: all tests pass (geo + ebird + inat + FeaturedBirdCard + useFeaturedBird).

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: no type errors, no build errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: wire MapView with debounce, geo cache, and FeaturedBirdCard"
```
