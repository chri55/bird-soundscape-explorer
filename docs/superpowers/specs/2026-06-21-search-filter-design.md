# Search & Filter Design

## Goal

Two independent but related discoverability improvements: (1) a park search box that lets users find and jump to any national park by name, dropping a pin and loading birds there; (2) a species list filter that lets users narrow the loaded species list by typing any substring of a bird's common or scientific name.

---

## Feature 1: Park Search

### UI Placement

A `ParkSearch` component is positioned as an absolutely-positioned CSS overlay in the top-left corner of the map div (`top-3 left-3 z-[1000]`), rendered as a sibling to `MapContainer` inside the same relative-positioned wrapper div. It is not a Leaflet layer and does not use `react-leaflet`.

### Behavior

- On mount (and whenever `parks` changes), the component holds the full park list in memory — no additional API calls, since `useNpsParks` already fetches and caches parks in localStorage.
- As the user types, the input filters `parks` by `fullName` using a case-insensitive substring match.
- Matches are shown in a dropdown list below the input, capped at 8 results.
- Clicking a result:
  1. Calls `onSelect({ lat: parseFloat(park.latitude), lng: parseFloat(park.longitude) })` — which in `MapView` is wired to `handlePin`, dropping a pin and triggering the full bird/soundscape fetch.
  2. Sets `flyToTarget` in `MapView` to the park's coordinates.
  3. Clears the search input and closes the dropdown.
- Pressing Escape or clicking outside closes the dropdown without selecting.
- The dropdown is hidden when the query is empty.

### Map Zoom

`MapView` holds `flyToTarget: LatLng | null` state. A `FlyToController` component rendered inside `MapContainer` watches this prop and calls `map.flyTo([lat, lng], 10)` whenever it changes. `FlyToController` is a local component defined inside `MapView.tsx` (too small for its own file).

```typescript
function FlyToController({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 10);
  }, [map, target]);
  return null;
}
```

### Component Interface

```typescript
// src/components/ParkSearch.tsx
interface ParkSearchProps {
  parks: NpsPark[];
  onSelect: (pos: LatLng) => void;
}
export function ParkSearch({ parks, onSelect }: ParkSearchProps): JSX.Element
```

### MapView wiring

```tsx
// Inside the map wrapper div, as sibling to MapContainer:
<div className="absolute top-3 left-3 z-[1000] w-64">
  <ParkSearch parks={parks} onSelect={pos => { handlePin(pos); setFlyToTarget(pos); }} />
</div>

// Inside MapContainer:
<FlyToController target={flyToTarget} />
```

### Styling

White background, rounded-lg, shadow-lg. Input has a search icon prefix (plain text "🔍" or a FontAwesome magnifying glass). Dropdown items use `hover:bg-gray-100`, truncate long names. Matches the app's existing Tailwind style.

---

## Feature 2: Species List Filter

### UI Placement

A text input rendered at the top of `SpeciesPanel`, between the panel wrapper and the species sections. Only visible when the panel is in the populated (non-loading, non-empty) state.

### Behavior

- Case-insensitive substring match against both `obs.comName` and `obs.sciName`.
- Filters both "Rarest Sightings" and "Most Common" sections simultaneously.
- Each section that has no matches after filtering shows a small "No matches" message in place of its rows (the section header remains visible).
- The filter query resets to `''` whenever `notableObs` or `recentObs` props change (i.e., on a new pin drop), via `useEffect`.
- No debounce needed — the list is small (typically < 30 species) and filtering is synchronous.

### State & Logic

Added entirely inside `SpeciesPanel.tsx`:

```typescript
const [filterQuery, setFilterQuery] = useState('');

useEffect(() => { setFilterQuery(''); }, [notableObs, recentObs]);

const q = filterQuery.toLowerCase();
const filteredNotable = dedupedNotable.filter(
  obs => obs.comName.toLowerCase().includes(q) || obs.sciName.toLowerCase().includes(q)
);
const filteredRecent = dedupedRecent.filter(
  obs => obs.comName.toLowerCase().includes(q) || obs.sciName.toLowerCase().includes(q)
);
```

### Styling

Full-width input inside the panel, `px-3 py-2 border-b border-gray-200 shrink-0`, placeholder "Filter birds…", small clear button (×) when query is non-empty.

---

## Files Touched

| File | Change |
|------|--------|
| `src/components/ParkSearch.tsx` | New — search input + dropdown |
| `src/components/MapView.tsx` | Add `flyToTarget` state, `FlyToController`, `ParkSearch` overlay, wire `onSelect` |
| `src/components/SpeciesPanel.tsx` | Add `filterQuery` state, filter input UI, filtered list logic |

No changes to API clients, hooks, or utility files.

---

## Testing

**`ParkSearch`:** Unit test that filtering by substring returns the right parks, selecting calls `onSelect` with correct coordinates, Escape closes the dropdown.

**`SpeciesPanel` filter:** Unit test that entering a query hides non-matching rows, shows "No matches" when nothing matches, and resets when `notableObs` prop changes.

**`FlyToController`:** No unit test — requires a real Leaflet DOM environment. Correctness verified by running the dev server.
