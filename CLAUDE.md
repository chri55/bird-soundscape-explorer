# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (HMR)
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run test      # Vitest (--passWithNoTests)
npm run preview   # serve the dist build locally
```

Run a single test file: `npx vitest run src/path/to/file.test.ts`

## Environment variables

Set them in `.env.local`:

```
VITE_EBIRD_API_KEY=       # from ebird.org/api/keygen
VITE_XC_API_KEY=          # from xeno-canto.org/account
VITE_NPS_API_KEY=         # from developer.nps.gov/api/keygen
```

## Architecture

**Bird Soundscape Explorer** — click a map pin, hear the birds that live there in that season.

### Tech stack

React 19 + TypeScript, Vite 8, Tailwind CSS v4 (via `@tailwindcss/vite` plugin), Wouter for routing, Vitest + React Testing Library for tests.

### API layer (`src/api/`)

Three typed API clients, each reading keys from `import.meta.env`:

- **`ebird.ts`** — `fetchRecentNearby(lat, lng)` → `EBirdObservation[]` from `GET /data/obs/geo/recent`. Sends key as `x-ebirdapitoken` header. Provides the "what's here right now" species list.
- **`xeno-canto.ts`** — `fetchRecordings(query)` and `fetchRecordingsByBox(latMin, latMax, lonMin, lonMax, month?)` from Xeno-canto API v3. Key is a query param. Provides MP3 URLs (`XCRecording.file`) for the audio soundscape.
- **`nps.ts`** — `fetchParks()` → `NpsPark[]` from `GET /parks`. Provides national park locations and codes.

### Seasonal simulation

There is no eBird endpoint for seasonal frequency data. The seasonal slider works by querying Xeno-canto with a `box:` bounding query and the `mon:` filter (built into `fetchRecordingsByBox`'s optional `month` param). Recordings made by birders in January naturally reflect winter species; July reflects summer species. This is the intentional design — not a gap to fill.

### Current state

`src/App.tsx` is a temporary smoke-test component that calls both APIs and logs to the console. The real UI (Leaflet map, species panel, time slider, life list) still needs to be built per `SPEC.md`.

### Life list persistence

`localStorage` only — no backend in v1. Life list add/remove/persist logic should have unit tests.

### Test setup

`vite.config.ts` configures Vitest with `globals: true`, `environment: 'jsdom'`, and `src/test-setup.ts` (which imports `@testing-library/jest-dom`). Mock `fetch` in unit tests for the API clients.
