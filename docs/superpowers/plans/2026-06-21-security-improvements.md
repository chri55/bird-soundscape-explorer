# Security Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the two exploitable attack surfaces (Leaflet `divIcon` HTML injection and unvalidated localStorage deserialization) and document the accepted risk of client-side API key exposure.

**Findings summary:** The codebase has two exploitable issues. First, `parkIcon` in `MapView.tsx` uses `L.divIcon({ html: '...' })` — if any future code ever interpolates API-supplied data into that string, it becomes a stored XSS sink. More critically, `useNpsParks` reads raw JSON from `localStorage` via `JSON.parse` and spreads the result directly into state; a compromised NPS API response (or any other origin with localStorage write access) could inject arbitrary `NpsPark` objects — including floating-point coordinate strings that `parseFloat` turns into `NaN`, crashing the map rendering. A separate low-severity issue is that the `VITE_XC_API_KEY` is appended as a raw query parameter to a third-party URL, which is unavoidable in a client-only SPA but worth documenting. No CVEs in the pinned dependency versions were identified as exploitable for this application's threat model.

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest

## Global Constraints

- verbatimModuleSyntax: true — type-only imports must use `import type { ... }` on a separate line
- Run tests: `npm run test`

---

### Task 1: Validate NpsPark objects deserialized from localStorage

**Severity:** High — Unvalidated `JSON.parse` result used directly as typed state. A poisoned localStorage entry (from a MITM response stored during an earlier session, XSS from another library, or a compromised NPS API) can inject arbitrary objects with unexpected `latitude`/`longitude` values. `parseFloat(park.latitude)` on a non-numeric string produces `NaN`, which silently breaks Leaflet marker positioning and can cause uncaught exceptions.

**File:** `src/hooks/useNpsParks.ts`

- [ ] Add a `isValidNpsPark` runtime type guard above the hook:

```typescript
function isValidNpsPark(value: unknown): value is NpsPark {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj['parkCode'] !== 'string') return false;
  if (typeof obj['fullName'] !== 'string') return false;
  if (typeof obj['latitude'] !== 'string') return false;
  if (typeof obj['longitude'] !== 'string') return false;
  // Ensure coordinates are numeric strings before they reach parseFloat
  if (Number.isNaN(parseFloat(obj['latitude'] as string))) return false;
  if (Number.isNaN(parseFloat(obj['longitude'] as string))) return false;
  return true;
}
```

- [ ] Apply the guard in `useState` initializer and after fetch, replacing the existing cast:

```typescript
// In useState initializer:
const raw = localStorage.getItem(CACHE_KEY);
if (!raw) return [];
try {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidNpsPark);
} catch { return []; }

// In useEffect after fetch:
.then(data => {
  // data is already NpsPark[] from fetchParks() which also filters lat/lng
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  setParks(data);
})
```

- [ ] Add a unit test in `src/hooks/useNpsParks.test.ts` (create if absent):

```typescript
import { renderHook } from '@testing-library/react';
import { useNpsParks } from './useNpsParks';

describe('useNpsParks localStorage validation', () => {
  beforeEach(() => localStorage.clear());

  it('ignores a poisoned localStorage entry with non-numeric coordinates', () => {
    localStorage.setItem('nps_parks_v1', JSON.stringify([
      { parkCode: 'evil', fullName: 'Evil Park', latitude: '<script>', longitude: '0' },
    ]));
    const { result } = renderHook(() => useNpsParks());
    expect(result.current).toHaveLength(0);
  });

  it('ignores entries missing required fields', () => {
    localStorage.setItem('nps_parks_v1', JSON.stringify([
      { parkCode: 'yose' }, // missing fullName, lat, lng
    ]));
    const { result } = renderHook(() => useNpsParks());
    expect(result.current).toHaveLength(0);
  });

  it('accepts a well-formed park', () => {
    localStorage.setItem('nps_parks_v1', JSON.stringify([
      { parkCode: 'yose', fullName: 'Yosemite', latitude: '37.8651', longitude: '-119.5383' },
    ]));
    const { result } = renderHook(() => useNpsParks());
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.parkCode).toBe('yose');
  });
});
```

- [ ] Run `npm run test` — all tests must pass.

---

### Task 2: Validate eBird taxonomy deserialized from localStorage

**Severity:** Medium — `ebird.ts` stores a taxonomy cache keyed by year in localStorage. It deserializes via `JSON.parse` and casts directly to `Record<string, EBirdTaxon | null>` with no validation. If the cache is corrupted or poisoned, arbitrary objects will be returned to callers that assume valid `EBirdTaxon` shape (they render `taxon.order`, `taxon.familyComName` directly in JSX).

**File:** `src/api/ebird.ts`

- [ ] Add a runtime guard for `EBirdTaxon`:

```typescript
function isValidEBirdTaxon(value: unknown): value is EBirdTaxon {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['sciName'] === 'string' &&
    typeof obj['comName'] === 'string' &&
    typeof obj['speciesCode'] === 'string' &&
    typeof obj['category'] === 'string' &&
    typeof obj['order'] === 'string' &&
    typeof obj['familyComName'] === 'string' &&
    typeof obj['familySciName'] === 'string'
  );
}
```

- [ ] Replace the unguarded cast in `getTaxonomyCache()`:

```typescript
// Replace:
const stored = JSON.parse(localStorage.getItem(getTaxonomyKey()) ?? '{}') as Record<string, EBirdTaxon | null>;
for (const [k, v] of Object.entries(stored)) taxonomyCache.set(k, v);

// With:
const raw: unknown = JSON.parse(localStorage.getItem(getTaxonomyKey()) ?? '{}');
if (typeof raw === 'object' && raw !== null) {
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    taxonomyCache.set(k, v !== null && isValidEBirdTaxon(v) ? v : null);
  }
}
```

- [ ] Add a unit test in `src/api/ebird.test.ts` covering poisoned cache:

```typescript
import { clearTaxonomyCache, fetchTaxonomy } from './ebird';

describe('fetchTaxonomy localStorage validation', () => {
  beforeEach(() => {
    clearTaxonomyCache();
    localStorage.clear();
  });

  it('ignores a poisoned taxonomy entry and fetches fresh data', async () => {
    const year = new Date().getFullYear();
    localStorage.setItem(`ebird-taxonomy-${year}`, JSON.stringify({
      norfli: { sciName: '<script>alert(1)</script>', comName: 42 },
    }));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    const result = await fetchTaxonomy(['norfli']);
    expect(result).toHaveLength(0); // corrupted entry treated as null/miss
  });
});
```

- [ ] Run `npm run test` — all tests must pass.

---

### Task 3: Freeze the Leaflet divIcon HTML string — no API data interpolation

**Severity:** Medium (currently unexploitable; architectural risk) — `MapView.tsx` builds a park icon using `L.divIcon({ html: '...' })` with a fully static string today. This pattern is a known XSS sink if anyone later interpolates `park.fullName` or any other API field into the `html` string. The Popup text `{park.fullName}` is safe because React escapes JSX text nodes, but the `divIcon` path has no such protection.

**File:** `src/components/MapView.tsx`

- [ ] Extract the `parkIcon` definition into a named constant at module scope (already done), and add a comment explicitly forbidding API data interpolation:

```typescript
// SECURITY: Never interpolate API-supplied data (park.fullName, park.parkCode, etc.)
// into this html string — Leaflet injects it as raw innerHTML with no escaping.
// Use React <Popup> for user-visible park names instead.
const parkIcon = L.divIcon({
  html: '<div style="background:#16a34a;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});
```

- [ ] Verify the existing `<Popup>{park.fullName}</Popup>` is JSX (React-escaped) — it is, no change needed there.

- [ ] No test needed for a comment change; verify `npm run lint` passes.

---

### Task 4: Document accepted risk — API keys bundled in client JS

**Severity:** Informational — `VITE_EBIRD_API_KEY`, `VITE_XC_API_KEY`, and `VITE_NPS_API_KEY` are bundled into the built JS by Vite (all `VITE_` env vars are inlined at build time). Anyone who loads the app can extract these keys from the browser's network tab or source view. This is a structural limitation of client-only SPAs with no backend proxy.

**Risk assessment per key:**
- **eBird**: Free hobbyist key. eBird rate-limits at 10,000 requests/day per key. Abuse would cause 429 errors for the real user; no billing impact.
- **NPS**: Free, unmetered for hobbyist use. Same rate-limit concern, no billing impact.
- **Xeno-canto**: Key is optional on XC API v3 (the `key=` param is a query parameter). XC itself has no billing model. A missing key degrades to anonymous rate limits.

**Files:** `src/api/ebird.ts`, `src/api/xeno-canto.ts`, `src/api/nps.ts`, `CLAUDE.md`

- [ ] Add a `## Security notes` section to `CLAUDE.md`:

```markdown
## Security notes

### API key exposure (accepted risk)

All three API keys (`VITE_EBIRD_API_KEY`, `VITE_XC_API_KEY`, `VITE_NPS_API_KEY`) are
inlined into the built JS by Vite. Any visitor can read them from the browser.

**Accepted because:**
- All three keys are free-tier hobbyist credentials with no billing.
- eBird and NPS rate-limit at the key level; abuse causes 429s for the real user but
  no financial exposure.
- Xeno-canto key is optional; the API degrades gracefully without one.

**Future mitigation (v2):** Route all API calls through a Netlify Function proxy so
keys stay server-side. A plan is at `docs/superpowers/plans/2026-06-20-netlify-proxy.md`.
```

- [ ] No code change required. Verify `npm run lint` passes.

---

### Task 5: Guard `fillRecordingGaps` against scientific name injection into Xeno-canto query

**Severity:** Low — `fillRecordingGaps` in `src/utils/soundscape-recordings.ts` builds a Xeno-canto query by splitting `obs.sciName` on whitespace and interpolating directly into `gen:${gen} sp:${rest.join(' ')}`. Scientific names from eBird are controlled vocabulary (e.g. `"Turdus migratorius"`) but they are not validated before use. A pathological name containing XC query operators (`:`, `+`, `box:`) would only affect the XC API query, not the DOM, but it could cause unexpected API results or error responses.

**File:** `src/utils/soundscape-recordings.ts`

- [ ] Add a simple allowlist validator before the query is built:

```typescript
/** Returns true if s looks like a single scientific-name token (letters, hyphens, apostrophes only). */
function isSafeNameToken(s: string): boolean {
  return /^[A-Za-z'\-]+$/.test(s);
}

// Inside fillRecordingGaps, replace the existing map:
gapSpecies.map(obs => {
  const [gen, ...rest] = obs.sciName.split(' ');
  const sp = rest.join(' ');
  if (!gen || !sp || !isSafeNameToken(gen) || rest.some(t => !isSafeNameToken(t))) {
    return Promise.resolve(null);
  }
  return fetchRecordings(`gen:${gen} sp:${sp}`).catch(() => null);
}),
```

- [ ] Add a unit test in `src/utils/soundscape-recordings.test.ts`:

```typescript
import { fillRecordingGaps } from './soundscape-recordings';
import type { EBirdObservation } from '../api/ebird';
import { vi } from 'vitest';
import * as xcApi from '../api/xeno-canto';

describe('fillRecordingGaps name sanitization', () => {
  it('skips species with injection characters in sciName', async () => {
    const spy = vi.spyOn(xcApi, 'fetchRecordings').mockResolvedValue({ recordings: [], numRecordings: '0', numSpecies: '0', page: 1, numPages: 1 });
    const obs: EBirdObservation[] = [
      { sciName: 'Evil box:0,0,90,180', comName: 'Evil Bird', speciesCode: 'x', locName: 'x', obsDt: '2024-01-01', lat: 0, lng: 0 },
    ];
    await fillRecordingGaps([], obs, 1);
    // fetchRecordings should not have been called with the injected string
    expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('box:'));
    spy.mockRestore();
  });
});
```

- [ ] Run `npm run test` — all tests must pass.
