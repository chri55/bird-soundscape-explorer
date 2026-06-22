# DEBUG.md — Tweetr Development & Maintenance Guide

## Development setup

### Prerequisites

- **Node.js 18+** (project was built on v24 — any 18+ should work)
- **npm** (comes with Node)
- **Netlify CLI** — install globally once:
  ```bash
  npm install -g netlify-cli
  ```

### First-time setup

```bash
git clone https://github.com/chri55/bird-soundscape-explorer
cd bird-soundscape-explorer
npm install
```

Create `.env.local` at the project root with your API keys:

```
EBIRD_API_KEY=      # from ebird.org/api/keygen (free, instant)
XC_API_KEY=         # from xeno-canto.org/account (free, needs registration)
NPS_API_KEY=        # from developer.nps.gov/api/keygen (free, instant)
```

Link the repo to your Netlify site (one-time):

```bash
netlify link
```

This connects the local directory to a Netlify site so `netlify dev` can simulate the full production environment.

---

## Running locally

```bash
netlify dev
```

Opens at `http://localhost:8888`. This starts both the Vite dev server and the Netlify Functions runtime together.

**Do not use `npm run dev`** — it starts Vite alone, without the functions. Any click on the map will trigger API calls to `/api/ebird`, `/api/xc`, `/api/nps` which won't be handled, resulting in a JSON parse error (the browser gets an HTML 404 back instead of JSON).

---

## Deploying

Deployment is automatic. Any push to `master` triggers a Netlify build:

```bash
git push
```

Netlify runs `npm run build` (`tsc -b && vite build`), publishes `dist/`, and deploys the functions in `netlify/functions/`.

### Environment variables in production

API keys must be set in the Netlify dashboard — they are **not** in the git repo:

1. Go to your Netlify site → **Site configuration → Environment variables**
2. Add three variables (note: no `VITE_` prefix — these are server-side only):
   - `EBIRD_API_KEY`
   - `XC_API_KEY`
   - `NPS_API_KEY`

A deploy triggered without these set will build successfully but return 502 errors at runtime when the functions try to call the upstream APIs.

---

## After a long time away

Run these checks before resuming development:

```bash
npm outdated          # see which dependencies have updates
npm audit             # check for known security vulnerabilities
npm install           # re-sync node_modules if lockfile changed
```

### Things that can quietly break over time

| Item | How to check | Fix |
|------|-------------|-----|
| **eBird API key** expired or revoked | Drop a pin — check browser Network tab for 401 from `/api/ebird` | Regenerate at ebird.org/api/keygen |
| **Xeno-canto API key** expired | No audio loads — Network tab shows 401 from `/api/xc` | Log in to xeno-canto.org and check your API key |
| **NPS API key** expired | No park markers — Network tab shows 401 from `/api/nps` | Regenerate at developer.nps.gov |
| **Netlify Node runtime** deprecated | Build warning or function timeout on deploy | Update `netlify.toml` with `[functions] node_bundler = "esbuild"` if needed; check Netlify changelog |
| **React / Vite major version** | `npm outdated` shows major bumps | Read release notes before upgrading; run `npm test` after |
| **Leaflet breaking change** | Map blank after upgrade | Check Leaflet changelog; CSS import path may change |

---

## Debugging common issues

### JSON parse error in `fetchForPin`

```
Uncaught (in promise) SyntaxError: JSON.parse: unexpected character at line 1 column 1
```

**Cause:** Running `npm run dev` instead of `netlify dev`. The `/api/*` proxy routes don't exist under plain Vite.

**Fix:** Stop the dev server, run `netlify dev` instead.

---

### No birds loading after dropping a pin

Check the browser Network tab:

- **401 from `/api/ebird`** — eBird key missing or wrong. Check `.env.local` (local) or Netlify dashboard (production).
- **502 from `/api/ebird`** — The function ran but the upstream API call failed. Check if `EBIRD_API_KEY` is set in the environment the function is running in.
- **404 for `/api/ebird`** — Running `npm run dev` instead of `netlify dev`.
- **Request never made** — JavaScript error earlier in `fetchForPin`. Check the console for a prior error.

Same pattern applies to Xeno-canto (`/api/xc`) and NPS (`/api/nps`).

---

### Map is blank

- Check the console for a 404 on the Leaflet CSS file. The import lives in `src/components/MapView.tsx` — verify the package path is still correct after any Leaflet upgrade.
- Check that `leaflet` and `react-leaflet` versions are compatible (they have a tight version coupling — see react-leaflet.js.org for the compatibility table).

---

### Audio doesn't play

Browsers block audio that starts without a user gesture. The app is designed to require a click (map pin drop) before audio starts. If audio stops working:

- Check that the `<audio>` elements are being created (inspect the DOM).
- Check Network tab for failed MP3 fetches — Xeno-canto CDN URLs are direct (not proxied), so they must be reachable.
- Check the browser's autoplay policy settings; some users have it blocked globally.

---

### App crashes to a white screen

The `ErrorBoundary` component wraps the entire app and should catch render errors, showing a "Something went wrong — try refreshing" message. If you see a full white screen instead:

- The error may have occurred outside React's render cycle (e.g. in an event handler or async function). `ErrorBoundary` only catches render-phase errors.
- Open the browser console — `componentDidCatch` logs the error and component stack there.
- Common culprits: a `null` dereference after an API response shape changed, or a Leaflet map method called on an unmounted component.

---

### Netlify deploy fails

Check the build log in the Netlify dashboard (Deploys → failed deploy → Deploy log).

Common causes:

| Error in log | Cause | Fix |
|---|---|---|
| TypeScript error | Type mismatch introduced locally | Run `npm run build` locally to reproduce; fix the type error |
| `Cannot find module` | Dependency not in `package.json` or lockfile out of sync | Run `npm install` and commit the updated lockfile |
| `netlify/functions/*.ts` type error | Function file has a type error (now caught by `tsconfig.functions.json`) | Run `tsc -p tsconfig.functions.json` locally to see the error |
| Build succeeded but 502 at runtime | Environment variables not set in Netlify dashboard | Add `EBIRD_API_KEY`, `XC_API_KEY`, `NPS_API_KEY` under Site configuration → Environment variables |

---

## Architecture quick reference

For deeper context on how things fit together, read:

- `CLAUDE.md` — commands, API layer, tech stack overview
- `SPEC.md` — original feature spec and API documentation
- `docs/superpowers/plans/` — implementation plans for each feature, with rationale
