# Netlify Functions API Proxy Design

## Goal

Move all three API keys (eBird, Xeno-canto, NPS) out of the client-side JavaScript bundle and into server-side Netlify Functions, so the app can be deployed publicly without exposing secrets.

---

## Problem

`VITE_*` environment variables are embedded in the compiled `dist/` bundle at build time. Anyone who inspects the network tab or source code can read the keys. Deploying the app publicly requires a proxy layer that injects keys server-side.

---

## Architecture

Three thin Netlify Functions act as proxies — one per API. The browser calls `/api/ebird/*`, `/api/xc/*`, `/api/nps/*` on the same domain; the function adds the secret key and forwards the request to the real upstream API; the response comes back to the browser unchanged.

```
Browser → /api/ebird/data/obs/geo/recent?lat=…
         ↓  (netlify.toml redirect)
         Netlify Function: ebird.ts
         ↓  (adds x-ebirdapitoken header from process.env)
         https://api.ebird.org/v2/data/obs/geo/recent?lat=…
         ↓
         Response forwarded back to browser
```

Keys are stored in Netlify's environment dashboard for production, and in `.env.local` (no `VITE_` prefix) for local development. They are never present in the browser bundle.

Note: Xeno-canto audio files (`XCRecording.file`) are direct CDN URLs loaded by `HTMLAudioElement` — they bypass the proxy entirely. The proxy only handles the metadata API call (`fetchRecordingsByBox`). All audio retry/fallback logic in `useSoundscape.ts` is unaffected.

---

## Files

**New files:**
- `netlify.toml` — build config + `/api/*` → function redirect rules + SPA fallback
- `netlify/functions/ebird.ts` — eBird proxy (multiple paths, auth header)
- `netlify/functions/xc.ts` — Xeno-canto proxy (single endpoint, `key` query param)
- `netlify/functions/nps.ts` — NPS proxy (single endpoint, `api_key` query param)

**Modified files:**
- `src/api/ebird.ts` — `BASE_URL` → `'/api/ebird'`, remove auth headers from fetch calls
- `src/api/xeno-canto.ts` — URL → `'/api/xc'`, remove `key` from URLSearchParams
- `src/api/nps.ts` — URL → `'/api/nps?limit=500'`, remove `api_key` construction
- `src/api/nps.test.ts` — update URL assertions to match new proxy URL
- `.env.local` — rename `VITE_EBIRD_API_KEY` → `EBIRD_API_KEY`, same for XC and NPS
- `CLAUDE.md` — update dev command and env var docs

**New dev dependency:** `@netlify/functions` (TypeScript types only — no runtime impact).

---

## `netlify.toml`

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

The last redirect is the SPA fallback — unmatched paths serve `index.html` so Wouter client-side routes work after a hard refresh.

---

## Netlify Functions

All three functions share the same pattern: forward query params from the incoming request, inject the secret key, call the upstream API, return the response with its original status code.

### `netlify/functions/ebird.ts`

eBird has multiple paths (`/data/obs/geo/recent`, `/data/obs/geo/recent/notable`, `/product/spp/taxonomy`). The function strips the `/api/ebird` prefix from `event.path` to recover the upstream sub-path.

```typescript
import type { Handler, HandlerEvent } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent) => {
  const path = event.path.replace('/api/ebird', '');
  const params = new URLSearchParams(
    Object.entries(event.queryStringParameters ?? {}) as [string, string][]
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

### `netlify/functions/xc.ts`

Xeno-canto has a single endpoint. The function appends `key` from the environment; the client no longer sends it.

```typescript
import type { Handler, HandlerEvent } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent) => {
  const params = new URLSearchParams(
    Object.entries(event.queryStringParameters ?? {}) as [string, string][]
  );
  params.set('key', process.env.XC_API_KEY!);
  try {
    const res = await fetch(`https://xeno-canto.org/api/2/recordings?${params}`);
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

### `netlify/functions/nps.ts`

NPS has a single endpoint. The function appends `api_key`; the client sends only `limit=500`.

```typescript
import type { Handler, HandlerEvent } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent) => {
  const params = new URLSearchParams(
    Object.entries(event.queryStringParameters ?? {}) as [string, string][]
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

---

## API Client Changes

### `src/api/ebird.ts`

```typescript
// Before:
const BASE_URL = 'https://api.ebird.org/v2';
// fetch calls include: headers: { 'x-ebirdapitoken': import.meta.env.VITE_EBIRD_API_KEY }

// After:
const BASE_URL = '/api/ebird';
// fetch calls: no headers object (key added by function)
```

Path construction (e.g. `${BASE_URL}/data/obs/geo/recent?lat=…`) is unchanged.

### `src/api/xeno-canto.ts`

```typescript
// Before:
const params = new URLSearchParams({ query, key: import.meta.env.VITE_XC_API_KEY });
const url = `https://xeno-canto.org/api/2/recordings?${params}`;

// After:
const params = new URLSearchParams({ query });
const url = `/api/xc?${params}`;
```

### `src/api/nps.ts`

```typescript
// Before:
const key = import.meta.env.VITE_NPS_API_KEY as string;
const res = await fetch(`${BASE_URL}/parks?limit=500&api_key=${key}`);

// After:
const res = await fetch('/api/nps?limit=500');
```

---

## Test Updates

`src/api/nps.test.ts` currently asserts the URL contains `https://developer.nps.gov/api/v1/parks` and `api_key=`. After the change the client calls `/api/nps?limit=500`, so those assertions update to:

```typescript
expect(url).toBe('/api/nps?limit=500');
```

The `api_key=` test is removed — key injection is now the function's responsibility, not the client's.

`src/api/ebird.test.ts` checks path fragments (`/data/obs/geo/recent`, `lat=40.78`) — these remain present in the new proxy URL and pass unchanged.

---

## Environment Variables

**`.env.local`** (local dev, gitignored — rename existing keys, drop `VITE_` prefix):

```
EBIRD_API_KEY=       # from ebird.org/api/keygen
XC_API_KEY=          # from xeno-canto.org/account
NPS_API_KEY=         # from developer.nps.gov/api/keygen
```

**Netlify dashboard:** Site settings → Environment variables → add the same three.

The `VITE_*` entries are removed from both `.env.local` and any Netlify env config — they are no longer referenced anywhere in the codebase.

---

## Local Development

`netlify dev` replaces `npm run dev`. The Netlify CLI:
1. Reads `netlify.toml` to find the build/dev command (`npm run dev`)
2. Starts Vite internally on its usual port
3. Runs the functions runtime alongside it
4. Exposes everything through a single port (default 8888)
5. Applies redirect rules so `/api/ebird/*` routes to the local function

**Prerequisites:**
```bash
npm install -g netlify-cli   # one-time global install
netlify link                  # one-time: connects local repo to your Netlify site
```

Then daily dev is just:
```bash
netlify dev
```

**`CLAUDE.md` updates:**
- Dev command: `netlify dev` (replaces `npm run dev`)
- Env vars section: document `EBIRD_API_KEY`, `XC_API_KEY`, `NPS_API_KEY` (no `VITE_` prefix)
- Note that `netlify-cli` must be installed globally

---

## Constraints

- No Redis, no Express, no separate service — Netlify Functions co-deploy with the frontend
- Functions are thin proxies only — no business logic, no caching (NPS data is already cached client-side in localStorage)
- `@netlify/functions` added as a devDependency (types only)
- Audio playback (direct CDN URLs) is unaffected — proxy only handles metadata API calls
- `netlify dev` is the only workflow change for local development
