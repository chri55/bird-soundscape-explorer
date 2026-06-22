# Project Spec: Tweetr

## Overview

A React + TypeScript web app that lets you drop a pin anywhere on the globe
and hear what the bird soundscape sounds like there — right now, and at any
other time of year. The map is the primary interface: click a spot, get a
layered audio collage of the birds that live there in that season.

This is a learning project — the goal is depth of practice with a real
multi-API integration, not minimal scope. Target: 1-2 weeks of work.

## Tech stack

- Vite + React + TypeScript
- Leaflet + OpenStreetMap tiles for the interactive map (no key required)
- Wouter for pages
- Tailwind for styling
- Vitest + React Testing Library for tests
- `localStorage` for persisting the life list (no backend for v1)

## APIs

### eBird API 2.0 — recent nearby sightings
- Base URL: `https://api.ebird.org/v2`
- Auth: free API key from https://ebird.org/api/keygen — send as header
  `x-ebirdapitoken`
- Key endpoint: `GET /data/obs/geo/recent` — species observed near a lat/lng
  in the last N days (max 30). Returns common/scientific names, sighting
  location, date, and observer count.
- Use: provides the "what's here right now" species list for a map pin

### Xeno-canto API v3 — bird call recordings
- Base URL: `https://xeno-canto.org/api/3/recordings`
- Auth: free API key for registered XC members (https://xeno-canto.org/account)
  — pass as `key` query parameter
- Query by species name (`?query=<name>&key=<key>`) **or** by bounding box
  (`?query=box:lat-min,lat-max,lon-min,lon-max&key=<key>`)
- Response fields per recording: `file` (MP3 URL), `type` (call/song/alarm),
  `q` (quality A–E), `lat`/`lon`, `date`, `en`/`gen`/`sp` (names)
- Use: provides recordings for the soundscape layer; date metadata on each
  recording enables month-based seasonal filtering

## Seasonal simulation approach

There is no public eBird endpoint for weekly frequency bar charts. The seasonal
simulation uses Xeno-canto instead: query the geographic bounding box around
the pin, pull all recordings, then filter client-side by the `date` month field.
Recordings made by birders in January naturally contain winter species; July
recordings contain summer species and migrants. This gives a lightweight but
genuine seasonal signal without a heavy raster API.

For a future upgrade, eBird Status & Trends (`https://st.ebird.org/api/`) has
weekly abundance models for ~1,000 species as GeoTIFF/zarr rasters — useful but
requires a separate access request and significant data download infrastructure.

## Features, in priority order

1. **Map pin + soundscape** — interactive Leaflet map; user clicks to drop a
   pin; app fetches eBird recent observations and Xeno-canto recordings for
   the area; layers 3–5 audio clips simultaneously to produce a soundscape
2. **Species panel** — alongside the map, list which species are contributing
   to the soundscape; click a species to hear its recording in isolation,
   see its common/scientific name and recording metadata
3. **Time-of-year slider** — a month (1–12) or season selector; switches the
   soundscape from eBird "current" mode to Xeno-canto date-filtered mode for
   the selected month; lets you hear how the same location sounds in January
   vs July
4. **My Life List** — let the user mark species as personally heard/seen from
   the species panel; persisted in localStorage with timestamp and optional
   note; accessible from a dedicated Life List page
5. **Search/browse** — look up any species by name to hear its recordings
   independently of the map, browse call vs song recordings
6. **(Stretch)** Blend/crossfade audio clips for a smoother soundscape;
   volume weighted by eBird observation frequency or Xeno-canto quality rating

## Environment variables required

```
VITE_EBIRD_API_KEY=       # from ebird.org/api/keygen
VITE_XC_API_KEY=          # from xeno-canto.org/account (free, needs registration)
```

## Out of scope for v1

- Backend/server, database, user accounts/auth
- eBird Status & Trends raster data (too heavyweight for v1)
- Submitting recordings to Xeno-canto
- Offline support

## Verification / Definition of done

- API client functions for both eBird and Xeno-canto are typed, handle
  network/HTTP errors, and have unit tests with mocked `fetch`
- Life list add/remove/persist logic has unit tests
- Core pages (map/soundscape view, species panel, life list) render without
  errors and have at least basic component tests
- `npm run build` succeeds with no type errors
- `npm test` passes

## Suggested build order

1. ~~Scaffold the project~~ ✓ — update API stubs from v2 to v3 (Xeno-canto)
   and add XC key support; verify both APIs respond
2. Leaflet map page — click to place a pin, log the lat/lng
3. eBird integration — fetch species list for the pin; render species panel
4. Xeno-canto integration — fetch recordings for each species; build audio
   layer that plays 3–5 clips simultaneously (Web Audio API or `<audio>` tags)
5. Time-of-year slider — switch to Xeno-canto `box:` query filtered by month
6. Life list with persistence + tests
7. Search/browse page
8. Polish, then the weighted-blend stretch goal
