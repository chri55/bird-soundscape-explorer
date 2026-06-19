# Spec Revision: Featured Bird Card & API Expansion

**Date:** 2026-06-19  
**Scope:** Revises and extends `SPEC.md` based on confirmed API capabilities and limitations discovered during development.

---

## Summary of Changes to Original Spec

### Added
- iNaturalist as a third API (bird photos by scientific name, no key required)
- Featured Bird Card — persistent UI component, replaces the plain species list as the primary species surface
- `recentnotable` eBird endpoint for rarity signal
- Spectrogram display (`sono.med` from Xeno-canto) on the featured card
- eBird taxonomy endpoint (`/ref/taxonomy/ebird`) for family/order, cached in `localStorage` annually
- Geographic fetch cache (10 km dead zone around last fetch location)
- Rate limiting strategy and debounce

### Revised
- Audio blend stretch goal: "observation frequency" weighting replaced with Xeno-canto quality rating (`q: A–E`) — frequency data is not available in eBird v2
- `dist` hard cap (50 km) made explicit in spec
- Xeno-canto pagination: fetch page 1 only, cap at 50 recordings per query
- `detail=full` enabled by default on all eBird observation endpoints

### Unchanged
- All 5 original features and their priority order
- Xeno-canto `mon:` filter for seasonal simulation (confirmed correct approach — no eBird seasonal endpoint exists in v2)
- `localStorage` for life list persistence, no backend

---

## APIs

### eBird API 2.0
- Base: `https://api.ebird.org/v2`, auth via `x-ebirdapitoken` header
- Rate limit: ~1,000 req/day (free tier) — treat as a hard budget
- `dist` max: 50 km on all geo endpoints

### Xeno-canto API v3
- Base: `https://xeno-canto.org/api/3/recordings`
- Key via `key` query param
- Fetch page 1 only; cap at 50 recordings per query

### iNaturalist API v1 (new)
- Base: `https://api.inaturalist.org/v1`
- No API key required for read-only taxa lookups
- Rate limit: 100 req/min, 10,000 req/day
- CORS: API endpoint supports browser `fetch()`; photo S3 URLs must be used in `<img>` tags only (no `fetch()`)
- Attribution string must be displayed alongside every photo (provided in response)

---

## Geographic Fetch Cache

**Problem:** Moving the pin a few kilometres re-fires all APIs for a nearly identical species list.

**Solution:** After every successful API fetch, store `lastFetchLocation: LatLng`. On pin drop:
1. Compute haversine distance between new pin and `lastFetchLocation`
2. If distance < **10 km**: skip all API calls, keep current data
3. If distance ≥ 10 km (or no previous fetch): fire APIs, update `lastFetchLocation`

**Rationale:** eBird's default fetch radius is 25 km. A 10 km pin movement shifts that area by ~40% — enough to register a meaningfully different soundscape. Smaller moves produce effectively the same species list.

**Implementation:** `haversineKm(a: LatLng, b: LatLng): number` utility in `src/utils/geo.ts`. Easy to unit test with known coordinate pairs.

---

## Rate Limiting Strategy

- Pin-click debounced **500 ms** before any fetch fires
- Each pin drop costs at most: 2 eBird calls + 1 XC call + 1 iNaturalist call = 4 requests
- Geographic cache means re-pins within 10 km cost 0 requests
- At 4 req/pin-drop: ~250 meaningful drops before hitting eBird's daily ceiling — sufficient for development and personal use
- Taxonomy: 1 eBird call per year (localStorage cache with annual key e.g. `ebird-taxonomy-2026`)
- iNaturalist photos: session-level `Map<sciName, BirdPhoto | null>` cache — same species never fetched twice per session

---

## Featured Bird Card

### Behaviour
- Appears once a pin is dropped, always visible alongside the map
- Auto-selects one featured bird; a **Rarest / Most Common** toggle controls selection logic:
  - **Rarest (default):** first result from `fetchNearbyNotable`; falls back to most common if notable list is empty; toggle is hidden when fallback is active
  - **Most Common:** species with highest `howMany` from `fetchRecentNearby`
- Toggle switches selection and re-fetches photo/taxonomy for the new bird — does not re-hit eBird or Xeno-canto

### Card Contents
| Element | Source |
|---|---|
| Hero photo (full-width) | iNaturalist `medium_url` |
| Common name (large) | eBird `comName` |
| Scientific name (italic) | eBird `sciName` |
| Family + Order | eBird taxonomy (cached) |
| "Rare sighting" badge | Present only when bird is from `recentnotable` |
| Spectrogram image | Xeno-canto `sono.med` (best quality recording for species) |
| Recording type label | Xeno-canto `type` (song / call / alarm call) |
| Attribution line | iNaturalist `attribution` + XC recordist name |
| Rarest / Most Common toggle | UI only |

### Graceful Degradation
- No iNaturalist photo → spectrogram fills hero slot
- No Xeno-canto recording for featured species → photo-only, spectrogram hidden
- No notable birds in area → rarity mode falls back to most common silently, toggle hidden

---

## API Layer (`src/api/`)

### `ebird.ts` — additions
```typescript
/** Locally/nationally rare sightings near a pin (eBird-flagged). */
fetchNearbyNotable(lat, lng, options?: { dist?: number; back?: number; maxResults?: number }): Promise<EBirdObservation[]>

/** All recent sightings of one species near a pin. */
fetchNearbySpecies(speciesCode, lat, lng, options?: { dist?: number; back?: number }): Promise<EBirdObservation[]>

/**
 * eBird taxonomy. Cached in localStorage with annual key.
 * Pass speciesCodes to filter to a subset.
 */
fetchTaxonomy(speciesCodes?: string[]): Promise<EBirdTaxon[]>
```

New interfaces: `EBirdTaxon` (sciName, comName, speciesCode, category, order, familyComName, familySciName), extended `EBirdObservation` with optional `detail=full` fields (locId, subId, obsValid).

All observation endpoints use `detail=full` by default. `dist` clamped to 50 km max.

### `inat.ts` — new module
```typescript
/** Fetch representative photo for a species by scientific name. */
fetchBirdPhoto(sciName: string): Promise<BirdPhoto | null>

interface BirdPhoto {
  photoUrl: string;       // medium_url ~500px
  largeUrl: string;       // large size for expanded view
  attribution: string;    // must be displayed
  licenseCode: string;
}
```

Session-level `Map<sciName, BirdPhoto | null>` cache inside the module.

### `xeno-canto.ts` — no public API changes
Soundscape layer will select best recording per species using `q` rating (A preferred) and `type` (song > call > alarm call).

### `src/utils/geo.ts` — new utility
```typescript
/** Great-circle distance in kilometres between two lat/lng points. */
haversineKm(a: LatLng, b: LatLng): number
```

---

## Component: `FeaturedBirdCard`

Single-responsibility component. Props:
```typescript
interface FeaturedBirdCardProps {
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

All data-fetching lives in a parent hook (`useFeaturedBird`); the card is pure presentational. `useFeaturedBird` owns: the `mode` toggle state, selecting the featured `EBirdObservation` from the notable/common lists, and triggering `fetchBirdPhoto` + taxonomy lookup for the selected species. It receives the already-fetched eBird observation lists and XC recordings as inputs — it does not call eBird or Xeno-canto directly.

---

## Testing Additions

Beyond the original SPEC definition of done:

- `haversineKm` unit tests with known coordinate pairs
- Geographic cache: pin within 10 km does not trigger fetch; pin beyond 10 km does
- `fetchBirdPhoto`: mocked fetch — happy path, `total_results: 0` → null, `default_photo: null` → null
- `fetchNearbyNotable` and `fetchTaxonomy` unit tests with mocked fetch
- Taxonomy localStorage cache: second call serves from cache, not network
- `FeaturedBirdCard` component tests: renders photo + spectrogram, shows badge when `isNotable: true`, hides spectrogram when `recording: null`, hides toggle when `showToggle: false`

---

## Definition of Done (revised)

- All original SPEC criteria met
- `fetchBirdPhoto`, `fetchNearbyNotable`, `fetchTaxonomy`, `haversineKm` have unit tests
- Featured Bird Card renders correctly for all graceful-degradation states
- Geographic cache prevents re-fetch within 10 km
- Photo attribution displayed alongside every iNaturalist image
- `npm run build` clean, `npm test` passes
