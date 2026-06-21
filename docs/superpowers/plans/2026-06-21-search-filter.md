# Search & Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating national park search box on the map (with map zoom on selection) and a text filter input on the species panel that narrows both bird lists by substring.

**Architecture:** Three tasks: (1) create the standalone `ParkSearch` component; (2) wire it into `MapView` alongside a `FlyToController` that zooms the map when a park is selected; (3) add `filterQuery` state and a filter input to `SpeciesPanel`. Tasks 1 and 3 are independent of each other and can be reviewed separately.

**Tech Stack:** React 19 + TypeScript, react-leaflet v5, Tailwind CSS v4, Font Awesome, Vitest + React Testing Library

## Global Constraints

- `verbatimModuleSyntax: true` — type-only imports must use `import type { ... }` on a separate line
- Run tests: `npm run test`; existing 135 tests must still pass after each task
- No new npm packages — Font Awesome and react-leaflet are already installed
- Tailwind CSS v4 — inline `className` strings only, no `@apply`

---

### Task 1: ParkSearch component

**Files:**
- Create: `src/components/ParkSearch.tsx`
- Create: `src/components/ParkSearch.test.tsx`

**Interfaces:**
- Consumes: `NpsPark` from `../api/nps`, `LatLng` from `../utils/geo`
- Produces: `export function ParkSearch({ parks, onSelect }: ParkSearchProps): JSX.Element`
  where `interface ParkSearchProps { parks: NpsPark[]; onSelect: (pos: LatLng) => void }`

- [ ] **Step 1: Write failing tests**

Create `src/components/ParkSearch.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ParkSearch } from './ParkSearch';
import type { NpsPark } from '../api/nps';

function makePark(name: string, lat: string, lng: string, code: string): NpsPark {
  return { parkCode: code, fullName: name, latitude: lat, longitude: lng };
}

const parks: NpsPark[] = [
  makePark('Yellowstone National Park', '44.42', '-110.58', 'yell'),
  makePark('Yosemite National Park', '37.86', '-119.53', 'yose'),
  makePark('Grand Canyon National Park', '36.10', '-112.09', 'grca'),
];

describe('ParkSearch', () => {
  it('shows no dropdown when query is empty', () => {
    render(<ParkSearch parks={parks} onSelect={vi.fn()} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('filters parks by case-insensitive substring match', () => {
    render(<ParkSearch parks={parks} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yello' } });
    expect(screen.getByText('Yellowstone National Park')).toBeInTheDocument();
    expect(screen.queryByText('Yosemite National Park')).not.toBeInTheDocument();
  });

  it('calls onSelect with parsed lat/lng when a result is clicked', () => {
    const onSelect = vi.fn();
    render(<ParkSearch parks={parks} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yellow' } });
    fireEvent.click(screen.getByText('Yellowstone National Park'));
    expect(onSelect).toHaveBeenCalledWith({ lat: 44.42, lng: -110.58 });
  });

  it('clears input and closes dropdown after selection', () => {
    render(<ParkSearch parks={parks} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yellow' } });
    fireEvent.click(screen.getByText('Yellowstone National Park'));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('clears input and closes dropdown on Escape', () => {
    render(<ParkSearch parks={parks} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yellow' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('caps results at 8', () => {
    const manyParks: NpsPark[] = Array.from({ length: 15 }, (_, i) =>
      makePark(`Park ${i} National Park`, '39.0', '-105.0', `p${i}`),
    );
    render(<ParkSearch parks={manyParks} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'park' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/ParkSearch.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/components/ParkSearch.tsx`**

```typescript
import { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { NpsPark } from '../api/nps';
import type { LatLng } from '../utils/geo';

const MAX_RESULTS = 8;

interface ParkSearchProps {
  parks: NpsPark[];
  onSelect: (pos: LatLng) => void;
}

export function ParkSearch({ parks, onSelect }: ParkSearchProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = query.length === 0
    ? []
    : parks
        .filter(p => p.fullName.toLowerCase().includes(query.toLowerCase()))
        .slice(0, MAX_RESULTS);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function handleSelect(park: NpsPark) {
    onSelect({ lat: parseFloat(park.latitude), lng: parseFloat(park.longitude) });
    setQuery('');
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center bg-white rounded-lg shadow-lg px-3 py-2 gap-2">
        <FontAwesomeIcon icon={faMagnifyingGlass} className="text-gray-400 text-sm shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => { if (query) setIsOpen(true); }}
          onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setIsOpen(false); } }}
          placeholder="Search national parks…"
          className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 min-w-0"
          aria-label="Search national parks"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); }}
            aria-label="Clear search"
            className="shrink-0"
          >
            <FontAwesomeIcon icon={faXmark} className="text-gray-400 hover:text-gray-600 text-sm" />
          </button>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <ul className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg shadow-lg overflow-hidden z-50">
          {results.map(park => (
            <li key={park.parkCode}>
              <button
                className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 truncate block"
                onClick={() => handleSelect(park)}
              >
                {park.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run ParkSearch tests**

```bash
npx vitest run src/components/ParkSearch.test.tsx
```

Expected: 6 tests pass

- [ ] **Step 5: Run full suite**

```bash
npm run test
```

Expected: 141 tests pass (135 existing + 6 new)

- [ ] **Step 6: Commit**

```bash
git add src/components/ParkSearch.tsx src/components/ParkSearch.test.tsx
git commit -m "feat: add ParkSearch component with substring filtering and dropdown"
```

---

### Task 2: Wire ParkSearch and FlyToController into MapView

**Files:**
- Modify: `src/components/MapView.tsx`
- Modify: `src/components/MapView.test.tsx`

**Interfaces:**
- Consumes: `ParkSearch` — `export function ParkSearch({ parks, onSelect }: { parks: NpsPark[]; onSelect: (pos: LatLng) => void }): JSX.Element` (from Task 1)
- Consumes: `useMap` from `react-leaflet` — returns Leaflet `Map` instance with `.flyTo([lat, lng], zoom)`

- [ ] **Step 1: Add `FlyToController` and wire `ParkSearch` in `src/components/MapView.tsx`**

**1a.** On line 2, add `useMap` to the react-leaflet import:

```typescript
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
```

**1b.** After line 22 (after the `ParkClusterLayer` import), add:

```typescript
import { ParkSearch } from './ParkSearch';
```

**1c.** After the `PinHandler` function (after line 46), add `FlyToController`:

```typescript
function FlyToController({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 10);
  }, [map, target]);
  return null;
}
```

**1d.** Inside `MapView`, after the existing state declarations (after `const [isLoading, setIsLoading] = useState(false);`), add:

```typescript
const [flyToTarget, setFlyToTarget] = useState<LatLng | null>(null);
```

**1e.** After the `handlePin` callback, add:

```typescript
const handleParkSearch = useCallback(
  (pos: LatLng) => {
    handlePin(pos);
    setFlyToTarget(pos);
  },
  [handlePin],
);
```

**1f.** Replace the map wrapper `div` in the JSX (the `<div className="flex-1 relative z-0 min-h-0">` block) with:

```tsx
<div className="flex-1 relative z-0 min-h-0">
  <div className="absolute top-3 left-3 z-[1000] w-64">
    <ParkSearch parks={parks} onSelect={handleParkSearch} />
  </div>
  <MapContainer center={[39.5, -98.35]} zoom={4} className="w-full h-full cursor-crosshair">
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <PinHandler onPin={handlePin} />
    {pin && <Marker position={[pin.lat, pin.lng]} icon={defaultIcon} />}
    <ParkClusterLayer parks={parks} onParkClick={handlePin} />
    <FlyToController target={flyToTarget} />
  </MapContainer>
</div>
```

- [ ] **Step 2: Update `src/components/MapView.test.tsx`**

On line 24, add `flyTo` to the `useMap` mock return value:

```typescript
useMap: vi.fn(() => ({ addLayer: vi.fn(), removeLayer: vi.fn(), flyTo: vi.fn() })),
```

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: 141 tests pass — no new tests needed (`FlyToController` requires a real Leaflet DOM environment and is verified by running the dev server)

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

Open the app. Type "yellow" in the floating search box — a dropdown showing "Yellowstone National Park" should appear. Click it — the map should animate to Yellowstone at zoom 10 and begin loading birds.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapView.tsx src/components/MapView.test.tsx
git commit -m "feat: wire ParkSearch and FlyToController into MapView"
```

---

### Task 3: Species list filter in SpeciesPanel

**Files:**
- Modify: `src/components/SpeciesPanel.tsx`
- Modify: `src/components/SpeciesPanel.test.tsx`

**Interfaces:**
- No new external interfaces — all changes are self-contained within `SpeciesPanel`

- [ ] **Step 1: Write failing tests**

Add these 5 tests inside the existing `describe('SpeciesPanel', ...)` block in `src/components/SpeciesPanel.test.tsx`:

```typescript
  it('shows filter input when species are loaded', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    expect(screen.getByPlaceholderText('Filter birds…')).toBeInTheDocument();
  });

  it('filters species by common name substring', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1), makeObs('American Robin', 2)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Filter birds…'), { target: { value: 'snow' } });
    expect(screen.getByText('Snow Bunting')).toBeInTheDocument();
    expect(screen.queryByText('American Robin')).not.toBeInTheDocument();
  });

  it('filters species by scientific name substring', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    // makeObs sets sciName = comName.toLowerCase().replace(' ', '.') → 'snow.bunting'
    fireEvent.change(screen.getByPlaceholderText('Filter birds…'), { target: { value: 'snow.bunt' } });
    expect(screen.getByText('Snow Bunting')).toBeInTheDocument();
  });

  it('shows No matches when filter has no results', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Filter birds…'), { target: { value: 'xyz' } });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('resets filter when notableObs prop changes', () => {
    const { rerender } = render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Filter birds…'), { target: { value: 'snow' } });
    expect(screen.getByPlaceholderText('Filter birds…')).toHaveValue('snow');

    rerender(
      <SpeciesPanel
        notableObs={[makeObs('American Robin', 2)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    expect(screen.getByPlaceholderText('Filter birds…')).toHaveValue('');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SpeciesPanel.test.tsx
```

Expected: 5 new tests fail with "Unable to find an element with the placeholder text: Filter birds…"

- [ ] **Step 3: Replace `src/components/SpeciesPanel.tsx`**

```typescript
import { useState, useEffect } from 'react';
import type { JSX } from 'react';
import type { EBirdObservation } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';
import { deduplicateObs } from '../utils/species';
import { Skeleton } from './Skeleton';
import { SpeciesListRow } from './SpeciesListRow';
import { SpeciesDetail } from './SpeciesDetail';

export interface SpeciesPanelProps {
  notableObs: EBirdObservation[];
  recentObs: EBirdObservation[];
  recordings: XCRecording[];
  isLoading: boolean;
}

export function SpeciesPanel({ notableObs, recentObs, recordings, isLoading }: SpeciesPanelProps): JSX.Element {
  const [selected, setSelected] = useState<EBirdObservation | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    setFilterQuery('');
  }, [notableObs, recentObs]);

  if (selected) {
    return (
      <div className="w-full h-72 md:h-auto md:w-80 flex flex-col bg-white border-b border-gray-200 md:border-b-0 md:border-l shrink-0 overflow-y-auto md:order-last">
        <SpeciesDetail obs={selected} recordings={recordings} onBack={() => setSelected(null)} />
      </div>
    );
  }

  const dedupedNotable = deduplicateObs(notableObs);
  const dedupedRecent = [...deduplicateObs(recentObs)].sort(
    (a, b) => (b.howMany ?? 0) - (a.howMany ?? 0),
  );

  const isEmpty = !isLoading && dedupedNotable.length === 0 && dedupedRecent.length === 0;

  const q = filterQuery.toLowerCase();
  const filteredNotable = dedupedNotable.filter(
    obs => !q || obs.comName.toLowerCase().includes(q) || obs.sciName.toLowerCase().includes(q),
  );
  const filteredRecent = dedupedRecent.filter(
    obs => !q || obs.comName.toLowerCase().includes(q) || obs.sciName.toLowerCase().includes(q),
  );

  return (
    <div className="w-full h-72 md:h-auto md:w-80 flex flex-col bg-white border-b border-gray-200 md:border-b-0 md:border-l shrink-0 overflow-y-auto md:order-last">
      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-gray-400 text-sm">
            Drop a pin on the map to discover birds in this area
          </p>
        </div>
      ) : isLoading ? (
        <div className="p-4 space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-2">
            Rarest Sightings
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-2 mt-2">
            Most Common
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="shrink-0 px-3 py-2 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="Filter birds…"
                className="w-full text-sm rounded-md border border-gray-200 px-3 py-1.5 pr-7 outline-none focus:border-green-400 text-gray-800 placeholder-gray-400"
                aria-label="Filter species"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  aria-label="Clear filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {dedupedNotable.length > 0 && (
            <section>
              <div className="sticky top-0 bg-white px-4 py-2 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Rarest Sightings
                </h3>
              </div>
              {filteredNotable.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No matches</p>
              ) : (
                filteredNotable.map(obs => (
                  <SpeciesListRow
                    key={obs.sciName}
                    obs={obs}
                    isNotable={true}
                    onClick={() => setSelected(obs)}
                  />
                ))
              )}
            </section>
          )}
          {dedupedRecent.length > 0 && (
            <section>
              <div className="sticky top-0 bg-white px-4 py-2 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Most Common
                </h3>
              </div>
              {filteredRecent.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No matches</p>
              ) : (
                filteredRecent.map(obs => (
                  <SpeciesListRow
                    key={obs.sciName}
                    obs={obs}
                    isNotable={false}
                    onClick={() => setSelected(obs)}
                  />
                ))
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run SpeciesPanel tests**

```bash
npx vitest run src/components/SpeciesPanel.test.tsx
```

Expected: 13 tests pass (8 existing + 5 new)

- [ ] **Step 5: Run full suite**

```bash
npm run test
```

Expected: 146 tests pass (141 + 5 new)

- [ ] **Step 6: Commit**

```bash
git add src/components/SpeciesPanel.tsx src/components/SpeciesPanel.test.tsx
git commit -m "feat: add species list filter to SpeciesPanel"
```
