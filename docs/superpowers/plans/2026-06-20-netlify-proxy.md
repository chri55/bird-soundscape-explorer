# Netlify Functions API Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move eBird, Xeno-canto, and NPS API keys out of the browser bundle by routing all API calls through thin Netlify Functions that inject keys server-side.

**Architecture:** Three proxy functions in `netlify/functions/` forward requests from `/api/ebird*`, `/api/xc*`, `/api/nps*` to the real upstream APIs, adding auth credentials from `process.env`. The three API clients in `src/api/` change only their base URL and drop key injection — all other logic is unchanged.

**Tech Stack:** Netlify Functions v1 (AWS Lambda), `@netlify/functions` TypeScript types, `netlify.toml` redirect rules, Netlify CLI (`netlify dev`) for local development.

## Global Constraints

- No unit tests for the function files — they are thin pass-throughs verified end-to-end via `netlify dev`
- Function env var names: `EBIRD_API_KEY`, `XC_API_KEY`, `NPS_API_KEY` — no `VITE_` prefix (functions use `process.env`, not the Vite bundle)
- Netlify redirect pattern uses `*` suffix (not `/*`) so it matches both `/api/ebird` (no sub-path) and `/api/ebird/data/obs/geo/recent` (with sub-path)
- `.env.local` is gitignored — update it manually but do not commit it
- `netlify-cli` is installed globally, not as a project devDependency

---

### Task 1: Netlify infrastructure and proxy functions

**Files:**
- Modify: `package.json` (add `@netlify/functions` devDependency)
- Create: `netlify.toml`
- Create: `netlify/functions/ebird.ts`
- Create: `netlify/functions/xc.ts`
- Create: `netlify/functions/nps.ts`

**Interfaces:**
- Produces: three HTTP endpoints consumed by Task 2's updated API clients:
  - `GET /api/ebird/<path>?<params>` → proxies to `https://api.ebird.org/v2/<path>?<params>` with `x-ebirdapitoken: process.env.EBIRD_API_KEY`
  - `GET /api/xc?<params>` → proxies to `https://xeno-canto.org/api/3/recordings?<params>&key=process.env.XC_API_KEY`
  - `GET /api/nps?<params>` → proxies to `https://developer.nps.gov/api/v1/parks?<params>&api_key=process.env.NPS_API_KEY`

- [ ] **Step 1: Install `@netlify/functions` devDependency**

```bash
npm install --save-dev @netlify/functions
```

Expected: `@netlify/functions` appears in `package.json` `devDependencies`. No runtime impact.

- [ ] **Step 2: Create `netlify.toml` at the project root**

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/ebird*"
  to = "/.netlify/functions/ebird"
  status = 200
  force = true

[[redirects]]
  from = "/api/xc*"
  to = "/.netlify/functions/xc"
  status = 200
  force = true

[[redirects]]
  from = "/api/nps*"
  to = "/.netlify/functions/nps"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

The last rule is the SPA fallback — any path not matching a real file serves `index.html` so Wouter client-side routes work after a hard refresh.

- [ ] **Step 3: Create `netlify/functions/ebird.ts`**

eBird has multiple upstream paths. The function strips `/api/ebird` from `event.path` to recover the sub-path, forwards all query params, and injects the key as a header.

```typescript
import type { Handler, HandlerEvent } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent) => {
  const path = event.path.replace('/api/ebird', '');
  const params = new URLSearchParams(
    Object.entries(event.queryStringParameters ?? {}) as [string, string][],
  );
  try {
    const res = await fetch(`https://api.ebird.org/v2${path}?${params}`, {
      headers: { 'x-ebirdapitoken': process.env.EBIRD_API_KEY! },
    });
    return {
      statusCode: res.status,
      body: await res.text(),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch {
    return { statusCode: 502, body: 'upstream error' };
  }
};
```

- [ ] **Step 4: Create `netlify/functions/xc.ts`**

Xeno-canto has a single endpoint. The function forwards all query params and appends the key.

```typescript
import type { Handler, HandlerEvent } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent) => {
  const params = new URLSearchParams(
    Object.entries(event.queryStringParameters ?? {}) as [string, string][],
  );
  params.set('key', process.env.XC_API_KEY!);
  try {
    const res = await fetch(`https://xeno-canto.org/api/3/recordings?${params}`);
    return {
      statusCode: res.status,
      body: await res.text(),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch {
    return { statusCode: 502, body: 'upstream error' };
  }
};
```

- [ ] **Step 5: Create `netlify/functions/nps.ts`**

NPS has a single endpoint. The function forwards all query params and appends the key.

```typescript
import type { Handler, HandlerEvent } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent) => {
  const params = new URLSearchParams(
    Object.entries(event.queryStringParameters ?? {}) as [string, string][],
  );
  params.set('api_key', process.env.NPS_API_KEY!);
  try {
    const res = await fetch(`https://developer.nps.gov/api/v1/parks?${params}`);
    return {
      statusCode: res.status,
      body: await res.text(),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch {
    return { statusCode: 502, body: 'upstream error' };
  }
};
```

- [ ] **Step 6: Verify the build still passes**

```bash
npm run build
```

Expected: exits 0. The function files are NOT compiled by `tsc -b` (they live outside `src/`) — this step verifies the existing source is unbroken. TypeScript in the function files is bundled by Netlify's esbuild at deploy time.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json netlify.toml netlify/functions/ebird.ts netlify/functions/xc.ts netlify/functions/nps.ts
git commit -m "feat: add Netlify Functions proxy for eBird, XC, and NPS APIs"
```

---

### Task 2: API client migration, test fix, and docs

**Files:**
- Modify: `src/api/ebird.ts`
- Modify: `src/api/xeno-canto.ts`
- Modify: `src/api/nps.ts`
- Modify: `src/api/nps.test.ts`
- Modify: `CLAUDE.md`
- Modify: `.env.local` (NOT committed — gitignored)

**Interfaces:**
- Consumes: `/api/ebird*`, `/api/xc*`, `/api/nps*` endpoints from Task 1

- [ ] **Step 1: Replace `src/api/ebird.ts`**

Remove `ebirdHeaders()` (which read `import.meta.env.VITE_EBIRD_API_KEY`), change `BASE_URL` to the proxy, and remove `{ headers: ebirdHeaders() }` from all three fetch calls. Full file:

```typescript
const BASE_URL = '/api/ebird';

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
  const res = await fetch(url);
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
  const res = await fetch(url);
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
    const res = await fetch(url);
    if (!res.ok) throw new Error(`eBird taxonomy error ${res.status}: ${await res.text()}`);
    const fetched = await res.json() as EBirdTaxon[];
    const fetchedMap = new Map(fetched.map(t => [t.speciesCode, t]));
    for (const code of missing) {
      cache.set(code, fetchedMap.get(code) ?? null);
    }
    const toStore: Record<string, EBirdTaxon | null> = {};
    for (const [k, v] of cache) toStore[k] = v;
    localStorage.setItem(getTaxonomyKey(), JSON.stringify(toStore));
  }

  return speciesCodes.map(c => cache.get(c) ?? null).filter((t): t is EBirdTaxon => t !== null);
}
```

- [ ] **Step 2: Replace `src/api/xeno-canto.ts`**

Remove `apiKey()` (which read `import.meta.env.VITE_XC_API_KEY`), change `BASE_URL` to the proxy, and remove the key from the URL construction. Full file:

```typescript
const BASE_URL = '/api/xc';

export interface XCRecording {
  id: string;
  gen: string;   // genus
  sp: string;    // species
  en: string;    // English name
  rec: string;   // recordist
  cnt: string;   // country
  loc: string;   // location name
  lat: string;
  lon: string;
  type: string;  // "call", "song", "alarm call", etc.
  q: string;     // quality rating A–E
  file: string;  // audio MP3 URL
  date: string;  // "YYYY-MM-DD"
  'file-name': string;
  sono: { small: string; med: string };
}

export interface XCResponse {
  numRecordings: string;
  numSpecies: string;
  page: number;
  numPages: number;
  recordings: XCRecording[];
}

export async function fetchRecordings(query: string): Promise<XCResponse> {
  const url = `${BASE_URL}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Xeno-canto error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<XCResponse>;
}

/** Fetch recordings from a geographic bounding box, optionally filtered by month (1-12). */
export async function fetchRecordingsByBox(
  latMin: number, latMax: number,
  lonMin: number, lonMax: number,
  month?: number,
): Promise<XCResponse> {
  let query = `box:${latMin},${lonMin},${latMax},${lonMax}`;
  if (month !== undefined) query += ` month:${month}`;
  query += ` grp:birds`;
  return fetchRecordings(query);
}
```

- [ ] **Step 3: Replace `src/api/nps.ts`**

Remove `BASE_URL` and the `VITE_NPS_API_KEY` read. `fetchParks` calls the proxy directly. Full file:

```typescript
export interface NpsPark {
  parkCode: string;
  fullName: string;
  latitude: string;
  longitude: string;
}

export async function fetchParks(): Promise<NpsPark[]> {
  const res = await fetch('/api/nps?limit=500');
  if (!res.ok) throw new Error(`NPS API ${res.status}`);
  const json = await res.json() as { data: NpsPark[] };
  return json.data.filter(p => p.latitude && p.longitude);
}
```

- [ ] **Step 4: Run tests — confirm they fail on the NPS URL assertion**

```bash
npx vitest run src/api/nps.test.ts
```

Expected: the first test (`calls the NPS parks endpoint with limit=500 and api_key`) fails because `fetchParks` now calls `/api/nps?limit=500` instead of the old URL. The other two tests pass.

- [ ] **Step 5: Fix `src/api/nps.test.ts`**

Update the first test — it now checks that the client calls the proxy URL. The key is no longer the client's responsibility. Replace lines 12–24:

```typescript
  it('calls the NPS proxy endpoint with limit=500', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await fetchParks();

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('/api/nps?limit=500');
  });
```

Leave tests 2 and 3 unchanged.

- [ ] **Step 6: Run tests — confirm all pass**

```bash
npm run test
```

Expected: all 15 test files, all tests passing.

- [ ] **Step 7: Run build**

```bash
npm run build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 8: Update `CLAUDE.md`**

Replace the Commands section:

```markdown
## Commands

```bash
netlify dev    # start dev server with functions (requires: npm install -g netlify-cli && netlify link)
npm run build  # tsc -b && vite build
npm run lint   # ESLint
npm run test   # Vitest (--passWithNoTests)
npm run preview  # serve the dist build locally
```

Run a single test file: `npx vitest run src/path/to/file.test.ts`
```

Replace the Environment variables section:

```markdown
## Environment variables

Set them in `.env.local` (for local dev via `netlify dev`) and in the Netlify dashboard (Site settings → Environment variables) for production. Keys are read by Netlify Functions server-side — they are NOT in the browser bundle.

```
EBIRD_API_KEY=            # from ebird.org/api/keygen
XC_API_KEY=               # from xeno-canto.org/account
NPS_API_KEY=              # from developer.nps.gov/api/keygen
```
```

In the API layer section, replace:

```
Three typed API clients, each reading keys from `import.meta.env`:
```

with:

```
Three typed API clients that call local proxy routes (`/api/ebird`, `/api/xc`, `/api/nps`). Keys are NOT in the browser — Netlify Functions inject them server-side:
```

- [ ] **Step 9: Update `.env.local` (do NOT commit)**

Open `.env.local` and rename the three keys (remove `VITE_` prefix, keep the values):

```
EBIRD_API_KEY=<your existing value>
XC_API_KEY=<your existing value>
NPS_API_KEY=<your existing value>
```

Delete the old `VITE_EBIRD_API_KEY`, `VITE_XC_API_KEY`, and `VITE_NPS_API_KEY` lines.

- [ ] **Step 10: Commit**

```bash
git add src/api/ebird.ts src/api/xeno-canto.ts src/api/nps.ts src/api/nps.test.ts CLAUDE.md
git commit -m "feat: migrate API clients to Netlify Functions proxy"
```

---

## End-to-end verification (manual, after both tasks)

After both tasks are committed, run:

```bash
npm install -g netlify-cli   # if not already installed
netlify link                  # one-time: connects repo to your Netlify site
netlify dev                   # starts Vite + functions on localhost:8888
```

Open `localhost:8888`, click a map location, and confirm:
- Birds load in the species panel
- Soundscape audio plays
- National park markers appear on the map

Network tab should show requests to `/api/ebird/...`, `/api/xc?...`, `/api/nps?...` — not to the real upstream API domains.
