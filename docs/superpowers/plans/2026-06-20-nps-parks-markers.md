# NPS National Parks Map Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch all US national parks from the NPS API once on page load, cache them in localStorage, and render green circle markers on the Leaflet map; clicking a marker opens a popup with the park name and triggers the bird/soundscape fetch.

**Architecture:** A typed `fetchParks()` function in `src/api/nps.ts` returns `NpsPark[]` from a single GET request. A `useNpsParks()` hook in `src/hooks/useNpsParks.ts` calls it on mount (skipping the network if `localStorage` already has data) and exposes the result to `MapView`, which renders one `<Marker>/<Popup>` pair per park.

**Tech Stack:** React 19, TypeScript, react-leaflet `Marker`/`Popup`, `L.divIcon`, Vitest + React Testing Library.

## Global Constraints

- `verbatimModuleSyntax: true` — type-only imports must use `import type { ... }` on a separate line from value imports of the same module
- Vitest `globals: true` for hook tests — no explicit `describe`/`it`/`expect`/`vi`/`beforeEach` imports in `*.test.ts` files under `src/hooks/`
- API tests (`src/api/`) explicitly import `describe, it, expect, vi, beforeEach` from `'vitest'` (follow existing `ebird.test.ts` pattern)
- Cache key: exactly `'nps_parks_v1'`
- Park markers: `L.divIcon` with inline style `background:#16a34a`, 12×12 px circle — no external assets
- `.env.local` is gitignored — do not commit it
- `CLAUDE.md` update is committed alongside the API client

---

### Task 1: NPS API client

**Files:**
- Create: `src/api/nps.ts`
- Create: `src/api/nps.test.ts`
- Modify: `.env.local` (not committed — gitignored)
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: `interface NpsPark { parkCode: string; fullName: string; latitude: string; longitude: string; }` and `async function fetchParks(): Promise<NpsPark[]>` — both exported, used by Task 2.

- [ ] **Step 1: Write failing tests**

Create `src/api/nps.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchParks } from './nps';

const mockFetch = vi.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchParks', () => {
  it('calls the NPS parks endpoint with limit=500 and api_key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await fetchParks();

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('https://developer.nps.gov/api/v1/parks');
    expect(url).toContain('limit=500');
    expect(url).toContain('api_key=');
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
```

- [ ] **Step 2: Run tests — confirm all three fail**

```bash
npx vitest run src/api/nps.test.ts
```

Expected: 3 failures with "Cannot find module './nps'" or similar.

- [ ] **Step 3: Implement `src/api/nps.ts`**

```typescript
const BASE_URL = 'https://developer.nps.gov/api/v1';

export interface NpsPark {
  parkCode: string;
  fullName: string;
  latitude: string;
  longitude: string;
}

export async function fetchParks(): Promise<NpsPark[]> {
  const key = import.meta.env.VITE_NPS_API_KEY as string;
  const res = await fetch(`${BASE_URL}/parks?limit=500&api_key=${key}`);
  if (!res.ok) throw new Error(`NPS API ${res.status}`);
  const json = await res.json() as { data: NpsPark[] };
  return json.data.filter(p => p.latitude && p.longitude);
}
```

- [ ] **Step 4: Run tests — confirm all three pass**

```bash
npx vitest run src/api/nps.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Add `VITE_NPS_API_KEY` to `.env.local`**

Open `.env.local` and append this line (do NOT commit this file — it is gitignored):

```
VITE_NPS_API_KEY=       # from developer.nps.gov/api/keygen
```

- [ ] **Step 6: Update `CLAUDE.md` environment variables section**

In `CLAUDE.md`, replace:

```
## Environment variables

Both keys are required; set them in `.env.local`:

```
VITE_EBIRD_API_KEY=       # from ebird.org/api/keygen
VITE_XC_API_KEY=          # from xeno-canto.org/account
```
```

With:

```
## Environment variables

Set them in `.env.local`:

```
VITE_EBIRD_API_KEY=       # from ebird.org/api/keygen
VITE_XC_API_KEY=          # from xeno-canto.org/account
VITE_NPS_API_KEY=         # from developer.nps.gov/api/keygen
```
```

- [ ] **Step 7: Commit**

```bash
git add src/api/nps.ts src/api/nps.test.ts CLAUDE.md
git commit -m "feat: add NPS API client with fetchParks"
```

---

### Task 2: `useNpsParks` hook

**Files:**
- Create: `src/hooks/useNpsParks.ts`
- Create: `src/hooks/useNpsParks.test.ts`

**Interfaces:**
- Consumes: `NpsPark` (type) and `fetchParks()` from `'../api/nps'`
- Produces: `function useNpsParks(): NpsPark[]` — exported default-named, used by Task 3.

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useNpsParks.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useNpsParks } from './useNpsParks';
import { fetchParks } from '../api/nps';
import type { NpsPark } from '../api/nps';

vi.mock('../api/nps');

const PARK: NpsPark = {
  parkCode: 'yose',
  fullName: 'Yosemite National Park',
  latitude: '37.8651',
  longitude: '-119.5383',
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchParks).mockReset();
});

it('cache miss: calls fetchParks, writes result to localStorage, and returns parks', async () => {
  vi.mocked(fetchParks).mockResolvedValue([PARK]);

  const { result } = renderHook(() => useNpsParks());

  await waitFor(() => expect(result.current).toHaveLength(1));

  expect(fetchParks).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem('nps_parks_v1')!)).toEqual([PARK]);
});

it('cache hit: returns cached parks without calling fetchParks', () => {
  localStorage.setItem('nps_parks_v1', JSON.stringify([PARK]));

  const { result } = renderHook(() => useNpsParks());

  expect(result.current).toEqual([PARK]);
  expect(fetchParks).not.toHaveBeenCalled();
});

it('fetch error on cache miss: returns empty array and does not write to localStorage', async () => {
  vi.mocked(fetchParks).mockRejectedValue(new Error('network error'));

  const { result } = renderHook(() => useNpsParks());

  await waitFor(() => expect(fetchParks).toHaveBeenCalledTimes(1));

  expect(result.current).toEqual([]);
  expect(localStorage.getItem('nps_parks_v1')).toBeNull();
});
```

- [ ] **Step 2: Run tests — confirm all three fail**

```bash
npx vitest run src/hooks/useNpsParks.test.ts
```

Expected: 3 failures — module not found.

- [ ] **Step 3: Implement `src/hooks/useNpsParks.ts`**

```typescript
import { useState, useEffect } from 'react';
import type { NpsPark } from '../api/nps';
import { fetchParks } from '../api/nps';

const CACHE_KEY = 'nps_parks_v1';

export function useNpsParks(): NpsPark[] {
  const [parks, setParks] = useState<NpsPark[]>(() => {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw) as NpsPark[]; } catch { return []; }
  });

  useEffect(() => {
    if (localStorage.getItem(CACHE_KEY)) return;
    void fetchParks()
      .then(data => {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        setParks(data);
      })
      .catch(() => {});
  }, []);

  return parks;
}
```

- [ ] **Step 4: Run tests — confirm all three pass**

```bash
npx vitest run src/hooks/useNpsParks.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNpsParks.ts src/hooks/useNpsParks.test.ts
git commit -m "feat: add useNpsParks hook with localStorage caching"
```

---

### Task 3: MapView integration

**Files:**
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- Consumes: `useNpsParks(): NpsPark[]` from `'../hooks/useNpsParks'` (Task 2)
- Consumes: `NpsPark` type from `'../api/nps'` (Task 1) — needed only if you type-annotate a variable; TypeScript infers it from `useNpsParks()` so no explicit import is required

No new test file — park marker rendering is a direct prop-to-JSX mapping with no logic to unit-test independently.

- [ ] **Step 1: Add import for `useNpsParks` and `Popup` in `MapView.tsx`**

Current line 2 in `src/components/MapView.tsx`:
```typescript
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
```

Change to:
```typescript
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
```

After the last existing import (after `SoundscapeControls` import), add:
```typescript
import { useNpsParks } from '../hooks/useNpsParks';
```

- [ ] **Step 2: Add `parkIcon` constant at module level**

Current `src/components/MapView.tsx` has `defaultIcon` ending at the closing `});` around line 30. After the closing `});` of `defaultIcon`, add:

```typescript
const parkIcon = L.divIcon({
  html: '<div style="background:#16a34a;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});
```

`parkIcon` must be defined at module level (outside the component function), same as `defaultIcon`.

- [ ] **Step 3: Call `useNpsParks()` inside the component body**

In the `MapView` component body, after the existing line:
```typescript
const soundscape = useSoundscape(recordings, recentObs);
```

Add:
```typescript
const parks = useNpsParks();
```

- [ ] **Step 4: Render park markers in `MapContainer`**

Inside the `<MapContainer>` JSX, after the existing user-pin marker:
```tsx
{pin && <Marker position={[pin.lat, pin.lng]} icon={defaultIcon} />}
```

Add:
```tsx
{parks.map(park => (
  <Marker
    key={park.parkCode}
    position={[parseFloat(park.latitude), parseFloat(park.longitude)]}
    icon={parkIcon}
    eventHandlers={{ click: () => handlePin({ lat: parseFloat(park.latitude), lng: parseFloat(park.longitude) }) }}
  >
    <Popup>{park.fullName}</Popup>
  </Marker>
))}
```

- [ ] **Step 5: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass (the new hook/API tests from Tasks 1–2 plus all existing tests).

- [ ] **Step 6: Run the TypeScript build**

```bash
npm run build
```

Expected: exits 0 with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: render NPS national park markers on map"
```
