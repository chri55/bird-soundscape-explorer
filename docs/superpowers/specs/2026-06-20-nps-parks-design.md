# NPS National Parks Map Markers Design

## Goal

Fetch all US national parks from the NPS API once on page load, cache them in localStorage, and render special markers on the Leaflet map. Clicking a park marker opens a popup with the park name AND triggers the bird/soundscape fetch for that location.

---

## Motivation

National parks are biodiversity hotspots with heavy birding activity. Surfacing them as clickable map markers lets users instantly explore what a park sounds like without having to know where to click.

---

## Environment Variable

`.env.local` gets a new entry:
```
VITE_NPS_API_KEY=   # from developer.nps.gov
```

`CLAUDE.md` environment variables section updated to document this key.

---

## Data & API Layer

### `src/api/nps.ts`

Follows the same pattern as `ebird.ts` and `xeno-canto.ts`.

```typescript
const BASE_URL = 'https://developer.nps.gov/api/v1';

export interface NpsPark {
  parkCode: string;
  fullName: string;
  latitude: string;   // NPS API returns coordinates as strings
  longitude: string;
}

export async function fetchParks(): Promise<NpsPark[]> {
  const key = import.meta.env.VITE_NPS_API_KEY;
  const res = await fetch(`${BASE_URL}/parks?limit=500&api_key=${key}`);
  if (!res.ok) throw new Error(`NPS API ${res.status}`);
  const json = await res.json() as { data: NpsPark[] };
  return json.data.filter(p => p.latitude && p.longitude);
}
```

- Auth: `api_key` query param (CORS-open; no proxy needed)
- `limit=500` returns all 474 parks in a single request
- Filter removes any entries with empty lat/lng strings (defensive; all 474 currently have coordinates)

### `src/hooks/useNpsParks.ts`

```typescript
const CACHE_KEY = 'nps_parks_v1';

export function useNpsParks(): NpsPark[] {
  const [parks, setParks] = useState<NpsPark[]>(() => {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw) as NpsPark[]; } catch { return []; }
  });

  useEffect(() => {
    if (parks.length > 0) return;   // cache hit — skip fetch
    void fetchParks()
      .then(data => {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        setParks(data);
      })
      .catch(() => {});             // parks are nice-to-have; fail silently
  }, []);

  return parks;
}
```

**Cache behavior:**
- Eager init reads from `localStorage` synchronously on first render — no loading flicker on repeat visits
- `parks.length > 0` guard skips the network fetch when cache is populated
- Corrupted JSON in `localStorage`: `try/catch` returns `[]`, triggering a re-fetch that overwrites the bad entry
- Cache invalidation: clear `localStorage` manually. The `v1` suffix in `CACHE_KEY` allows future forced invalidation by bumping the version

---

## Map Integration (`src/components/MapView.tsx`)

### Park marker icon

```typescript
const parkIcon = L.divIcon({
  html: '<div style="background:#16a34a;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});
```

Small green circle — visually distinct from the blue default pin used for the user's dropped location.

### Component changes

One new line at the top of the component body:
```typescript
const parks = useNpsParks();
```

Park markers rendered inside `MapContainer`, after the user pin `<Marker>`:
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

**Click behavior:** Leaflet opens the `<Popup>` automatically (standard react-leaflet behavior). `handlePin` fires in the same click — it moves the blue user pin to the park's coordinates and triggers the debounced bird/soundscape fetch. The `PinHandler` map-click handler is not involved; `handlePin` is called directly.

---

## Testing

### `src/api/nps.test.ts` (3 tests, mock `fetch`)

1. Calls the correct URL with `api_key` as a query param
2. Returns `data[]` filtered to entries with non-empty `latitude` and `longitude`
3. Throws on a non-OK response (e.g. 403)

### `src/hooks/useNpsParks.test.ts` (3 tests, mock `fetchParks` and `localStorage`)

1. **Cache miss** — `localStorage` empty: calls `fetchParks`, writes result to `localStorage`, returns parks
2. **Cache hit** — `localStorage` pre-populated: does NOT call `fetchParks`, returns cached parks immediately
3. **Fetch error on cache miss** — `fetchParks` rejects: hook returns `[]`, no crash, nothing written to `localStorage`

No new `MapView` tests — park marker rendering is a direct prop-to-JSX mapping with no logic to unit-test independently.

---

## Constraints

- `verbatimModuleSyntax: true` — all type-only imports must use `import type`
- Vitest `globals: true` — no explicit `describe`/`it`/`expect`/`vi` imports in test files
- No backend — localStorage only
- Parks are additive and optional: if the NPS API is unreachable and localStorage is empty, the map still works normally with no park markers
