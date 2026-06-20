# Species Panel & UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-bird featured card with a scrollable species list panel, add hover cards and loading skeletons to the soundscape bar, fix ORB-blocked sonogram images, and tune audio playback frequency and startup.

**Architecture:** New utility module (`species.ts`) holds pure functions shared across components; a new `SpeciesPanel` manages list/detail navigation state; `useSoundscape` gains per-voice `isLoading` and tuned constants; `SoundscapeGrid` becomes an 8-column grid with hover cards; old `useFeaturedBird` / `FeaturedBirdCard` are deleted.

**Tech Stack:** React 19, TypeScript (`verbatimModuleSyntax: true`), Tailwind CSS v4, Vitest + `@testing-library/react` (`globals: true`, `fireEvent` only — no `userEvent`).

## Global Constraints

- TypeScript `verbatimModuleSyntax: true` — every type-only import must use `import type`
- Vitest `globals: true` — no explicit `describe`/`it`/`expect`/`vi`/`beforeEach`/`afterEach` imports needed
- No new npm dependencies
- No `<img>` tags loading Xeno-canto sonogram URLs (`sono.small` / `sono.med`) anywhere in the app
- `npm run build` must pass clean after every task
- `npm test` must pass after every task

---

## File Map

| File | Action |
|---|---|
| `src/utils/species.ts` | **Create** — `deduplicateObs`, `bestRecording` |
| `src/utils/species.test.ts` | **Create** |
| `src/components/Skeleton.tsx` | **Create** — reusable pulsing placeholder |
| `src/components/SpeciesListRow.tsx` | **Create** — one clickable row |
| `src/components/SpeciesListRow.test.tsx` | **Create** |
| `src/components/SpeciesDetail.tsx` | **Create** — detail view with back button |
| `src/components/SpeciesDetail.test.tsx` | **Create** |
| `src/components/SpeciesPanel.tsx` | **Create** — list + detail panel |
| `src/components/SpeciesPanel.test.tsx` | **Create** |
| `src/hooks/useSoundscape.ts` | **Modify** — new constants, `INITIAL_VOICES`, `isLoading` per voice |
| `src/hooks/useSoundscape.test.ts` | **Modify** — update constant assertions, add new tests |
| `src/components/SoundscapeGrid.tsx` | **Modify** — grid-cols-8, hover card, skeleton, no sonogram |
| `src/components/SoundscapeGrid.test.tsx` | **Modify** — update for new structure |
| `src/components/MapView.tsx` | **Modify** — swap panel, add isLoading state |
| `src/components/FeaturedBirdCard.tsx` | **Delete** |
| `src/components/FeaturedBirdCard.test.tsx` | **Delete** |
| `src/hooks/useFeaturedBird.ts` | **Delete** |
| `src/hooks/useFeaturedBird.test.ts` | **Delete** |

---

### Task 1: Species utility functions

**Files:**
- Create: `src/utils/species.ts`
- Create: `src/utils/species.test.ts`

**Produces (used by Tasks 3, 4):**
```typescript
export function deduplicateObs(obs: EBirdObservation[]): EBirdObservation[]
export function bestRecording(sciName: string, recordings: XCRecording[]): XCRecording | null
```

- [ ] **Step 1: Write failing tests**

Create `src/utils/species.test.ts`:

```typescript
import type { EBirdObservation } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';
import { deduplicateObs, bestRecording } from './species';

function makeObs(sciName: string, howMany: number | undefined, overrides: Partial<EBirdObservation> = {}): EBirdObservation {
  return {
    speciesCode: sciName.replace(' ', ''), comName: sciName, sciName,
    locName: 'SF', obsDt: '2024-01-01 08:00', howMany,
    lat: 37.77, lng: -122.4, obsValid: true, obsReviewed: true, locationPrivate: false,
    ...overrides,
  };
}

function makeRec(overrides: Partial<XCRecording> = {}): XCRecording {
  return {
    id: '1', gen: 'Turdus', sp: 'migratorius', en: 'American Robin',
    rec: 'Jane', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
    type: 'song', q: 'A', file: 'https://xc.org/1.mp3', date: '2024-01-01',
    'file-name': '1.mp3', sono: { small: 'https://xc.org/sono.png', med: 'https://xc.org/sonom.png' },
    ...overrides,
  };
}

describe('deduplicateObs', () => {
  it('passes through a list with all unique sciNames', () => {
    const obs = [makeObs('Turdus migratorius', 10), makeObs('Parus major', 3)];
    expect(deduplicateObs(obs)).toHaveLength(2);
  });

  it('combines duplicate sciNames and sums howMany', () => {
    const obs = [makeObs('Turdus migratorius', 10), makeObs('Turdus migratorius', 5)];
    const result = deduplicateObs(obs);
    expect(result).toHaveLength(1);
    expect(result[0].howMany).toBe(15);
  });

  it('treats undefined howMany as 0 when summing', () => {
    const obs = [makeObs('Turdus migratorius', undefined), makeObs('Turdus migratorius', 4)];
    const result = deduplicateObs(obs);
    expect(result[0].howMany).toBe(4);
  });

  it('preserves the first occurrence order', () => {
    const obs = [
      makeObs('Parus major', 3),
      makeObs('Turdus migratorius', 10),
      makeObs('Parus major', 2),
    ];
    const result = deduplicateObs(obs);
    expect(result[0].sciName).toBe('Parus major');
    expect(result[1].sciName).toBe('Turdus migratorius');
    expect(result[0].howMany).toBe(5);
  });

  it('keeps comName, locName, obsDt from the first occurrence', () => {
    const obs = [
      makeObs('Turdus migratorius', 5, { comName: 'American Robin', locName: 'Central Park', obsDt: '2024-01-01 08:00' }),
      makeObs('Turdus migratorius', 3, { comName: 'Other Name', locName: 'Other Park', obsDt: '2024-02-01 09:00' }),
    ];
    const result = deduplicateObs(obs);
    expect(result[0].comName).toBe('American Robin');
    expect(result[0].locName).toBe('Central Park');
    expect(result[0].obsDt).toBe('2024-01-01 08:00');
  });
});

describe('bestRecording', () => {
  it('returns null when no recordings match sciName', () => {
    expect(bestRecording('Corvus corax', [makeRec()])).toBeNull();
  });

  it('returns the single match when only one exists', () => {
    const result = bestRecording('Turdus migratorius', [makeRec({ id: '1' })]);
    expect(result?.id).toBe('1');
  });

  it('picks quality A over B', () => {
    const recs = [makeRec({ id: 'b', q: 'B' }), makeRec({ id: 'a', q: 'A' })];
    expect(bestRecording('Turdus migratorius', recs)?.id).toBe('a');
  });

  it('picks song over call when quality is equal', () => {
    const recs = [makeRec({ id: 'c', type: 'call' }), makeRec({ id: 's', type: 'song' })];
    expect(bestRecording('Turdus migratorius', recs)?.id).toBe('s');
  });

  it('quality beats type — lower quality song loses to higher quality call', () => {
    const recs = [makeRec({ id: 'bs', q: 'B', type: 'song' }), makeRec({ id: 'ac', q: 'A', type: 'call' })];
    expect(bestRecording('Turdus migratorius', recs)?.id).toBe('ac');
  });

  it('matches case-insensitively on genus and species', () => {
    const rec = makeRec({ gen: 'TURDUS', sp: 'MIGRATORIUS' });
    expect(bestRecording('Turdus migratorius', [rec])).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/utils/species.test.ts
```

Expected: FAIL — "Cannot find module './species'"

- [ ] **Step 3: Implement**

Create `src/utils/species.ts`:

```typescript
import type { EBirdObservation } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';

export function deduplicateObs(obs: EBirdObservation[]): EBirdObservation[] {
  const seen = new Map<string, EBirdObservation>();
  for (const o of obs) {
    const existing = seen.get(o.sciName);
    if (!existing) {
      seen.set(o.sciName, { ...o, howMany: o.howMany ?? 0 });
    } else {
      seen.set(o.sciName, { ...existing, howMany: (existing.howMany ?? 0) + (o.howMany ?? 0) });
    }
  }
  return [...seen.values()];
}

const qualityRank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
const typeScore = (type: string) => (type.toLowerCase().includes('song') ? 0 : 1);

export function bestRecording(sciName: string, recordings: XCRecording[]): XCRecording | null {
  const parts = sciName.toLowerCase().split(' ');
  const genus = parts[0] ?? '';
  const species = parts[1] ?? '';

  const matches = recordings.filter(
    r => r.gen.toLowerCase() === genus && r.sp.toLowerCase() === species,
  );

  if (matches.length === 0) return null;

  return [...matches].sort((a, b) => {
    const qDiff = (qualityRank[a.q] ?? 5) - (qualityRank[b.q] ?? 5);
    return qDiff !== 0 ? qDiff : typeScore(a.type) - typeScore(b.type);
  })[0];
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```
npx vitest run src/utils/species.test.ts
```

Expected: 11/11 pass

- [ ] **Step 5: Full suite + build**

```
npx vitest run && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/species.ts src/utils/species.test.ts
git commit -m "feat: add deduplicateObs and bestRecording utility functions"
```

---

### Task 2: `Skeleton` + `SpeciesListRow` components

**Files:**
- Create: `src/components/Skeleton.tsx`
- Create: `src/components/SpeciesListRow.tsx`
- Create: `src/components/SpeciesListRow.test.tsx`

**Consumes from Task 1:** `import type { EBirdObservation } from '../api/ebird'`

**Produces:**
```typescript
// Skeleton.tsx
export function Skeleton({ className = '' }: { className?: string }): JSX.Element

// SpeciesListRow.tsx
export interface SpeciesListRowProps {
  obs: EBirdObservation;
  isNotable: boolean;
  onClick: () => void;
}
export function SpeciesListRow(props: SpeciesListRowProps): JSX.Element
```

- [ ] **Step 1: Write failing tests**

Create `src/components/SpeciesListRow.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeciesListRow } from './SpeciesListRow';
import type { EBirdObservation } from '../api/ebird';

const obs: EBirdObservation = {
  speciesCode: 'amerob', comName: 'American Robin',
  sciName: 'Turdus migratorius', locName: 'Central Park',
  obsDt: '2024-06-15 08:00', howMany: 12,
  lat: 40.78, lng: -73.97, obsValid: true, obsReviewed: false, locationPrivate: false,
};

describe('SpeciesListRow', () => {
  it('renders common name', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText('American Robin')).toBeInTheDocument();
  });

  it('renders scientific name', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText('Turdus migratorius')).toBeInTheDocument();
  });

  it('renders count badge when howMany > 0', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText('12 seen')).toBeInTheDocument();
  });

  it('omits count badge when howMany is 0', () => {
    render(<SpeciesListRow obs={{ ...obs, howMany: 0 }} isNotable={false} onClick={vi.fn()} />);
    expect(screen.queryByText(/seen/)).toBeNull();
  });

  it('shows Rare pill when isNotable', () => {
    render(<SpeciesListRow obs={obs} isNotable={true} onClick={vi.fn()} />);
    expect(screen.getByText('Rare')).toBeInTheDocument();
  });

  it('does not show Rare pill when not notable', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.queryByText('Rare')).toBeNull();
  });

  it('calls onClick when the row is clicked', () => {
    const onClick = vi.fn();
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={onClick} />);
    fireEvent.click(screen.getByText('American Robin'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders location name', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText(/Central Park/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/components/SpeciesListRow.test.tsx
```

Expected: FAIL — "Cannot find module './SpeciesListRow'"

- [ ] **Step 3: Create `Skeleton.tsx`**

Create `src/components/Skeleton.tsx`:

```typescript
export function Skeleton({ className = '' }: { className?: string }): JSX.Element {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}
```

- [ ] **Step 4: Create `SpeciesListRow.tsx`**

Create `src/components/SpeciesListRow.tsx`:

```typescript
import type { EBirdObservation } from '../api/ebird';

export interface SpeciesListRowProps {
  obs: EBirdObservation;
  isNotable: boolean;
  onClick: () => void;
}

export function SpeciesListRow({ obs, isNotable, onClick }: SpeciesListRowProps): JSX.Element {
  const datePart = obs.obsDt.split(' ')[0] ?? obs.obsDt;
  const [year, month, day] = datePart.split('-').map(Number);
  const dateStr = new Date(year, (month ?? 1) - 1, day ?? 1)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 flex items-start justify-between gap-2"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 text-sm truncate">{obs.comName}</p>
        <p className="italic text-gray-500 text-xs truncate">{obs.sciName}</p>
        <p className="text-gray-400 text-xs truncate mt-0.5">{dateStr} · {obs.locName}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {(obs.howMany ?? 0) > 0 && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {obs.howMany} seen
          </span>
        )}
        {isNotable && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            Rare
          </span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 5: Run tests and confirm they pass**

```
npx vitest run src/components/SpeciesListRow.test.tsx
```

Expected: 8/8 pass

- [ ] **Step 6: Full suite + build**

```
npx vitest run && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/components/Skeleton.tsx src/components/SpeciesListRow.tsx src/components/SpeciesListRow.test.tsx
git commit -m "feat: add Skeleton and SpeciesListRow components"
```

---

### Task 3: `SpeciesDetail` component

**Files:**
- Create: `src/components/SpeciesDetail.tsx`
- Create: `src/components/SpeciesDetail.test.tsx`

**Consumes from Task 1:**
```typescript
import { bestRecording } from '../utils/species';
// bestRecording(sciName: string, recordings: XCRecording[]): XCRecording | null
```

**Consumes from Task 2:** `import { Skeleton } from './Skeleton'`

**External deps mocked in tests:** `fetchBirdPhoto` from `../api/inat`, `fetchTaxonomy` from `../api/ebird`

**Produces:**
```typescript
export interface SpeciesDetailProps {
  obs: EBirdObservation;
  recordings: XCRecording[];
  onBack: () => void;
}
export function SpeciesDetail(props: SpeciesDetailProps): JSX.Element
```

- [ ] **Step 1: Write failing tests**

Create `src/components/SpeciesDetail.test.tsx`:

```typescript
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { SpeciesDetail } from './SpeciesDetail';
import { fetchBirdPhoto } from '../api/inat';
import { fetchTaxonomy } from '../api/ebird';
import type { EBirdObservation } from '../api/ebird';

vi.mock('../api/inat', () => ({ fetchBirdPhoto: vi.fn() }));
vi.mock('../api/ebird', () => ({
  fetchTaxonomy: vi.fn(),
  fetchRecentNearby: vi.fn(),
  fetchNearbyNotable: vi.fn(),
  clearTaxonomyCache: vi.fn(),
}));

const obs: EBirdObservation = {
  speciesCode: 'amerob', comName: 'American Robin',
  sciName: 'Turdus migratorius', locName: 'Central Park',
  obsDt: '2024-06-15 08:00', howMany: 12,
  lat: 40.78, lng: -73.97, obsValid: true, obsReviewed: false, locationPrivate: false,
};

beforeEach(() => {
  vi.mocked(fetchBirdPhoto).mockResolvedValue(null);
  vi.mocked(fetchTaxonomy).mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SpeciesDetail', () => {
  it('shows skeleton while loading', () => {
    vi.mocked(fetchBirdPhoto).mockImplementation(() => new Promise(() => {}));
    const { container } = render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders common name after load', async () => {
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByText('American Robin')).toBeInTheDocument();
  });

  it('renders scientific name after load', async () => {
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByText('Turdus migratorius')).toBeInTheDocument();
  });

  it('shows photo when fetchBirdPhoto resolves with one', async () => {
    vi.mocked(fetchBirdPhoto).mockResolvedValue({
      photoUrl: 'https://img.jpg', largeUrl: 'https://img-l.jpg',
      attribution: '© Test Photographer', licenseCode: 'cc-by',
    });
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://img.jpg');
  });

  it('shows placeholder text when no photo', async () => {
    vi.mocked(fetchBirdPhoto).mockResolvedValue(null);
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getAllByText('American Robin').length).toBeGreaterThan(0);
  });

  it('shows taxonomy when fetchTaxonomy resolves', async () => {
    vi.mocked(fetchTaxonomy).mockResolvedValue([{
      sciName: 'Turdus migratorius', comName: 'American Robin',
      speciesCode: 'amerob', category: 'species', taxonOrder: 1,
      bandingCodes: [], comNameCodes: [], sciNameCodes: [],
      order: 'Passeriformes', familyComName: 'Thrushes', familySciName: 'Turdidae',
    }]);
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByText(/Passeriformes/)).toBeInTheDocument();
    expect(screen.getByText(/Thrushes/)).toBeInTheDocument();
  });

  it('shows recording credit when a matching recording is provided', async () => {
    const rec = {
      id: '1', gen: 'Turdus', sp: 'migratorius', en: 'American Robin',
      rec: 'Jane Smith', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
      type: 'song', q: 'A', file: 'https://xc.org/1.mp3', date: '2024-01-01',
      'file-name': '1.mp3', sono: { small: 'https://xc.org/sono.png', med: 'https://xc.org/sonom.png' },
    };
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[rec]} onBack={vi.fn()} />);
    });
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={onBack} />);
    });
    fireEvent.click(screen.getByText(/Back/));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/components/SpeciesDetail.test.tsx
```

Expected: FAIL — "Cannot find module './SpeciesDetail'"

- [ ] **Step 3: Implement**

Create `src/components/SpeciesDetail.tsx`:

```typescript
import { useState, useEffect } from 'react';
import type { EBirdObservation, EBirdTaxon } from '../api/ebird';
import { fetchTaxonomy } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import { fetchBirdPhoto } from '../api/inat';
import type { XCRecording } from '../api/xeno-canto';
import { bestRecording } from '../utils/species';
import { Skeleton } from './Skeleton';

export interface SpeciesDetailProps {
  obs: EBirdObservation;
  recordings: XCRecording[];
  onBack: () => void;
}

export function SpeciesDetail({ obs, recordings, onBack }: SpeciesDetailProps): JSX.Element {
  const [photo, setPhoto] = useState<BirdPhoto | null>(null);
  const [taxon, setTaxon] = useState<EBirdTaxon | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchBirdPhoto(obs.sciName), fetchTaxonomy([obs.speciesCode])])
      .then(([p, taxa]) => {
        if (!cancelled) { setPhoto(p); setTaxon(taxa[0] ?? null); setLoading(false); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [obs.sciName, obs.speciesCode]);

  const recording = bestRecording(obs.sciName, recordings);

  const datePart = obs.obsDt.split(' ')[0] ?? obs.obsDt;
  const [year, month, day] = datePart.split('-').map(Number);
  const dateStr = new Date(year, (month ?? 1) - 1, day ?? 1)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Back button */}
      <div className="shrink-0 px-4 py-2 border-b border-gray-100">
        <button
          onClick={onBack}
          className="text-sm text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
        >
          ← Back
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          <Skeleton className="w-full aspect-video" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="shrink-0">
            {photo ? (
              <img
                src={photo.photoUrl}
                alt={obs.comName}
                className="w-full aspect-video object-cover"
              />
            ) : (
              <div className="w-full aspect-video bg-gray-800 flex items-center justify-center">
                <span className="text-white text-sm font-medium px-4 text-center">{obs.comName}</span>
              </div>
            )}
          </div>

          {/* Names */}
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{obs.comName}</h2>
            <p className="text-sm italic text-gray-500 mt-0.5">{obs.sciName}</p>
          </div>

          {/* Taxonomy */}
          {taxon && (
            <div className="px-4 py-1 text-xs text-gray-500">
              {taxon.order} · {taxon.familyComName}
            </div>
          )}

          {/* Observation data */}
          <div className="px-4 py-2 text-xs text-gray-600 space-y-1">
            {(obs.howMany ?? 0) > 0 && <p>{obs.howMany} seen</p>}
            <p>{dateStr}</p>
            <p>{obs.locName}</p>
          </div>

          {/* Recording credit */}
          {recording && (
            <div className="px-4 py-2 text-xs text-gray-500">
              <p>Recording by {recording.rec} · {recording.type} · Quality {recording.q}</p>
            </div>
          )}

          {/* Photo attribution */}
          {photo && (
            <div className="mt-auto px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
              <p>{photo.attribution}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```
npx vitest run src/components/SpeciesDetail.test.tsx
```

Expected: 8/8 pass

- [ ] **Step 5: Full suite + build**

```
npx vitest run && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/SpeciesDetail.tsx src/components/SpeciesDetail.test.tsx
git commit -m "feat: add SpeciesDetail component with photo, taxonomy, and recording credit"
```

---

### Task 4: `SpeciesPanel` component

**Files:**
- Create: `src/components/SpeciesPanel.tsx`
- Create: `src/components/SpeciesPanel.test.tsx`

**Consumes from Task 1:** `import { deduplicateObs } from '../utils/species'`
**Consumes from Task 2:** `import { Skeleton } from './Skeleton'; import { SpeciesListRow } from './SpeciesListRow'`
**Consumes from Task 3:** `import { SpeciesDetail } from './SpeciesDetail'`

**Produces:**
```typescript
export interface SpeciesPanelProps {
  notableObs: EBirdObservation[];
  recentObs: EBirdObservation[];
  recordings: XCRecording[];
  isLoading: boolean;
}
export function SpeciesPanel(props: SpeciesPanelProps): JSX.Element
```

- [ ] **Step 1: Write failing tests**

Create `src/components/SpeciesPanel.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeciesPanel } from './SpeciesPanel';
import type { EBirdObservation } from '../api/ebird';

vi.mock('../api/inat', () => ({ fetchBirdPhoto: vi.fn().mockResolvedValue(null) }));
vi.mock('../api/ebird', () => ({
  fetchTaxonomy: vi.fn().mockResolvedValue([]),
  fetchRecentNearby: vi.fn(),
  fetchNearbyNotable: vi.fn(),
  clearTaxonomyCache: vi.fn(),
}));

function makeObs(sciName: string, howMany: number, locName = 'SF'): EBirdObservation {
  return {
    speciesCode: sciName.replace(' ', ''), comName: sciName, sciName,
    locName, obsDt: '2024-06-15 08:00', howMany,
    lat: 37.77, lng: -122.4, obsValid: true, obsReviewed: false, locationPrivate: false,
  };
}

describe('SpeciesPanel', () => {
  it('shows empty state when no obs and not loading', () => {
    render(<SpeciesPanel notableObs={[]} recentObs={[]} recordings={[]} isLoading={false} />);
    expect(screen.getByText(/Drop a pin/)).toBeInTheDocument();
  });

  it('shows skeleton rows when isLoading', () => {
    const { container } = render(
      <SpeciesPanel notableObs={[]} recentObs={[]} recordings={[]} isLoading={true} />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders Rarest Sightings section when notableObs present', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Rarest Sightings')).toBeInTheDocument();
    expect(screen.getByText('Snow Bunting')).toBeInTheDocument();
  });

  it('renders Most Common section when recentObs present', () => {
    render(
      <SpeciesPanel
        notableObs={[]}
        recentObs={[makeObs('American Robin', 10)]}
        recordings={[]}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Most Common')).toBeInTheDocument();
    expect(screen.getByText('American Robin')).toBeInTheDocument();
  });

  it('deduplicates recentObs by sciName', () => {
    const obs = [makeObs('American Robin', 5), makeObs('American Robin', 3)];
    render(<SpeciesPanel notableObs={[]} recentObs={obs} recordings={[]} isLoading={false} />);
    const rows = screen.getAllByText('American Robin');
    expect(rows).toHaveLength(1);
  });

  it('sorts Most Common by summed howMany descending', () => {
    const obs = [makeObs('Sparrow', 2), makeObs('Robin', 10)];
    render(<SpeciesPanel notableObs={[]} recentObs={obs} recordings={[]} isLoading={false} />);
    const items = screen.getAllByText(/Sparrow|Robin/);
    expect(items[0].textContent).toBe('Robin');
  });

  it('clicking a row shows the detail view', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    fireEvent.click(screen.getByText('Snow Bunting'));
    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  it('Back button returns to list view', () => {
    render(
      <SpeciesPanel
        notableObs={[makeObs('Snow Bunting', 1)]}
        recentObs={[]}
        recordings={[]}
        isLoading={false}
      />,
    );
    fireEvent.click(screen.getByText('Snow Bunting'));
    fireEvent.click(screen.getByText('← Back'));
    expect(screen.getByText('Rarest Sightings')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/components/SpeciesPanel.test.tsx
```

Expected: FAIL — "Cannot find module './SpeciesPanel'"

- [ ] **Step 3: Implement**

Create `src/components/SpeciesPanel.tsx`:

```typescript
import { useState } from 'react';
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

  if (selected) {
    return (
      <div className="w-80 flex flex-col bg-white border-l border-gray-200 shrink-0 overflow-hidden">
        <SpeciesDetail obs={selected} recordings={recordings} onBack={() => setSelected(null)} />
      </div>
    );
  }

  const dedupedNotable = deduplicateObs(notableObs);
  const dedupedRecent = [...deduplicateObs(recentObs)].sort(
    (a, b) => (b.howMany ?? 0) - (a.howMany ?? 0),
  );

  const isEmpty = !isLoading && dedupedNotable.length === 0 && dedupedRecent.length === 0;

  return (
    <div className="w-80 flex flex-col bg-white border-l border-gray-200 shrink-0 overflow-y-auto">
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
          {dedupedNotable.length > 0 && (
            <section>
              <div className="sticky top-0 bg-white px-4 py-2 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Rarest Sightings
                </h3>
              </div>
              {dedupedNotable.map(obs => (
                <SpeciesListRow
                  key={obs.sciName}
                  obs={obs}
                  isNotable={true}
                  onClick={() => setSelected(obs)}
                />
              ))}
            </section>
          )}
          {dedupedRecent.length > 0 && (
            <section>
              <div className="sticky top-0 bg-white px-4 py-2 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Most Common
                </h3>
              </div>
              {dedupedRecent.map(obs => (
                <SpeciesListRow
                  key={obs.sciName}
                  obs={obs}
                  isNotable={false}
                  onClick={() => setSelected(obs)}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```
npx vitest run src/components/SpeciesPanel.test.tsx
```

Expected: 8/8 pass

- [ ] **Step 5: Full suite + build**

```
npx vitest run && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/SpeciesPanel.tsx src/components/SpeciesPanel.test.tsx
git commit -m "feat: add SpeciesPanel with scrollable rarest/common lists and detail navigation"
```

---

### Task 5: `useSoundscape` — audio tuning + `isLoading` per voice

**Files:**
- Modify: `src/hooks/useSoundscape.ts`
- Modify: `src/hooks/useSoundscape.test.ts`

**Changes to `useSoundscape.ts`:**
1. Update `MIN_INTERVAL_MS` from `5_000` to `3_000`
2. Update `MAX_INTERVAL_MS` from `90_000` to `30_000`
3. Add `export const INITIAL_VOICES = 3`
4. Add `isLoading: boolean` to `SoundscapeVoice`
5. Set `isLoading: true` in initial voice construction; attach `canplay` listener to flip it `false`
6. Update `toggle()` to use `INITIAL_VOICES`: first 3 voices stagger within `INITIAL_STAGGER_MS`; remaining voices use their `intervalMs` as initial delay

- [ ] **Step 1: Update the constants and `SoundscapeVoice` interface in `useSoundscape.ts`**

Replace the constants block and interface:

```typescript
export const MIN_INTERVAL_MS = 3_000;
export const MAX_INTERVAL_MS = 30_000;
export const JITTER_FACTOR = 0.25;
export const MAX_VOICES = 8;
export const INITIAL_STAGGER_MS = 3_000;
export const INITIAL_VOICES = 3;

export interface SoundscapeVoice {
  recording: XCRecording;
  sciName: string;
  howMany: number;
  intervalMs: number;
  isActive: boolean;
  isLoading: boolean;
  photo: BirdPhoto | null;
}
```

- [ ] **Step 2: Add `isLoading: true` to initial voice construction and attach `canplay` listeners**

In the rebuild `useEffect`, after the `audioRefs.current = selected.map(...)` line, update `setVoices` and add the `canplay` listener loop:

```typescript
    intervalsRef.current = intervals;
    audioRefs.current = selected.map(s => new Audio(s.recording.file));

    setVoices(
      selected.map((s, i) => ({
        recording: s.recording,
        sciName: s.sciName,
        howMany: s.howMany,
        intervalMs: intervals[i],
        isActive: false,
        isLoading: true,
        photo: null,
      })),
    );

    // Flip isLoading false when audio is ready to play
    audioRefs.current.forEach((audio, i) => {
      audio.addEventListener('canplay', () => {
        setVoices(v => v.map((voice, vi) => vi === i ? { ...voice, isLoading: false } : voice));
      }, { once: true } as AddEventListenerOptions);
    });
```

- [ ] **Step 3: Update `toggle()` for staggered startup**

Replace the `toggle` callback body:

```typescript
  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      stopAll();
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      audioRefs.current.forEach((_, i) => {
        const delay = i < INITIAL_VOICES
          ? Math.random() * INITIAL_STAGGER_MS
          : (intervalsRef.current[i] ?? MAX_INTERVAL_MS);
        timersRef.current.push(setTimeout(() => startVoice(i), delay));
      });
    }
  }, [stopAll, startVoice]);
```

- [ ] **Step 4: Update `useSoundscape.test.ts` — fix constant assertions and add new tests**

At the top of the test file, update the import to include `INITIAL_VOICES`:

```typescript
import {
  selectVoices, computeIntervalMs,
  MIN_INTERVAL_MS, MAX_INTERVAL_MS, MAX_VOICES,
  INITIAL_VOICES,
  useSoundscape, INITIAL_STAGGER_MS,
} from './useSoundscape';
```

Find the `computeIntervalMs` tests that assert `MIN_INTERVAL_MS` and `MAX_INTERVAL_MS` and confirm they still pass (they test the *relationship*, not the literal values — they should be fine).

Append these new tests after the existing `describe('useSoundscape', ...)` block:

```typescript
describe('useSoundscape — audio tuning', () => {
  beforeEach(() => {
    audioInstances.length = 0;
    vi.stubGlobal('Audio', class extends MockAudio {
      constructor(src: string) { super(src); audioInstances.push(this); }
    });
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('first INITIAL_VOICES voices fire within INITIAL_STAGGER_MS', async () => {
    // 4 recordings: voices 0-2 are "initial", voice 3 waits its intervalMs
    const recs = [
      makeRec({ gen: 'Sp', sp: 'a', id: '1' }),
      makeRec({ gen: 'Sp', sp: 'b', id: '2' }),
      makeRec({ gen: 'Sp', sp: 'c', id: '3' }),
      makeRec({ gen: 'Sp', sp: 'd', id: '4' }),
    ];
    const obs = [
      makeObs('Sp a', 10), makeObs('Sp b', 9), makeObs('Sp c', 8), makeObs('Sp d', 1),
    ];
    const { result } = renderHook(() => useSoundscape(recs, obs));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); });
    // After INITIAL_STAGGER_MS, first 3 should have played
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    const playedCount = audioInstances.slice(0, 3).filter(a => a.play.mock.calls.length > 0).length;
    expect(playedCount).toBe(3);
    // Voice 3's delay is MAX_INTERVAL_MS (howMany=1, all others higher) — not yet played
    expect(audioInstances[3]?.play).not.toHaveBeenCalled();
  });

  it('voice isLoading transitions false when canplay fires', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.voices[0].isLoading).toBe(true);

    act(() => { audioInstances[0].emit('canplay'); });
    expect(result.current.voices[0].isLoading).toBe(false);
  });
});
```

Note: the `MockAudio` class needs a `emit('canplay')` method. Add it to the `MockAudio` class (it already has `emit` for `ended`): the existing `emit` method in the test file already handles any event generically — confirm `emit('canplay')` works with the existing implementation. If `MockAudio.emit` only clears `ended` handlers, update it to be generic:

```typescript
  emit(event: string) {
    const handlers = [...(this._handlers[event] ?? [])];
    this._handlers[event] = []; // clear all (simulates { once: true })
    handlers.forEach(h => h());
  }
```

- [ ] **Step 5: Run tests and confirm they pass**

```
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: all tests pass (15 existing + 2 new = 17)

- [ ] **Step 6: Full suite + build**

```
npx vitest run && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useSoundscape.ts src/hooks/useSoundscape.test.ts
git commit -m "feat: tune audio intervals, add INITIAL_VOICES stagger, add per-voice isLoading"
```

---

### Task 6: `SoundscapeGrid` — grid, hover card, skeleton, no sonogram

**Files:**
- Modify: `src/components/SoundscapeGrid.tsx`
- Modify: `src/components/SoundscapeGrid.test.tsx`

**Consumes from Task 2:** `import { Skeleton } from './Skeleton'`
**Consumes from Task 5:** `SoundscapeVoice.isLoading` is now a required field

- [ ] **Step 1: Rewrite `SoundscapeGrid.test.tsx`**

Replace the entire file with:

```typescript
import { render, screen } from '@testing-library/react';
import { SoundscapeGrid } from './SoundscapeGrid';
import type { SoundscapeVoice } from '../hooks/useSoundscape';
import type { XCRecording } from '../api/xeno-canto';

function makeVoice(overrides: Partial<SoundscapeVoice> = {}): SoundscapeVoice {
  const recording: XCRecording = {
    id: '1', gen: 'Turdus', sp: 'migratorius', en: 'American Robin',
    rec: 'Jane', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
    type: 'song', q: 'A', file: 'https://xc.org/1.mp3', date: '2024-01-01',
    'file-name': '1.mp3', sono: { small: 'https://xc.org/sono.png', med: 'https://xc.org/sonom.png' },
  };
  return {
    recording,
    sciName: 'Turdus migratorius',
    howMany: 10,
    intervalMs: 5000,
    isActive: false,
    isLoading: false,
    photo: null,
    ...overrides,
  };
}

describe('SoundscapeGrid', () => {
  it('renders nothing when voices is empty', () => {
    const { container } = render(<SoundscapeGrid voices={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('has grid-cols-8 class on the container', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} />);
    expect(container.querySelector('.grid-cols-8')).toBeTruthy();
  });

  it('active card has ring-green-400 class', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: true })]} />);
    expect(container.querySelector('.ring-green-400')).toBeTruthy();
  });

  it('inactive card has brightness-50 class', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: false })]} />);
    expect(container.querySelector('.brightness-50')).toBeTruthy();
  });

  it('shows photo img when photo is available', () => {
    const voice = makeVoice({
      photo: { photoUrl: 'https://photo.jpg', largeUrl: 'https://photo-l.jpg', attribution: '© x', licenseCode: 'cc-by' },
    });
    render(<SoundscapeGrid voices={[voice]} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://photo.jpg');
  });

  it('shows placeholder text (not an img) when photo is null and not loading', () => {
    render(<SoundscapeGrid voices={[makeVoice({ photo: null, isLoading: false })]} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getAllByText('American Robin').length).toBeGreaterThan(0);
  });

  it('shows skeleton when isLoading is true', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isLoading: true })]} />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('hover card contains scientific name', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} />);
    expect(container.textContent).toContain('Turdus migratorius');
  });

  it('hover card contains recordist name', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} />);
    expect(container.textContent).toContain('Jane');
  });

  it('hover card is initially hidden (opacity-0 or invisible class)', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} />);
    const hoverCard = container.querySelector('.opacity-0, .invisible');
    expect(hoverCard).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to see which pass/fail**

```
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: several failures (grid-cols-8, isLoading skeleton, hover card tests)

- [ ] **Step 3: Rewrite `SoundscapeGrid.tsx`**

Replace the entire file with:

```typescript
import type { SoundscapeVoice } from '../hooks/useSoundscape';
import { Skeleton } from './Skeleton';

interface SoundscapeGridProps {
  voices: SoundscapeVoice[];
}

export function SoundscapeGrid({ voices }: SoundscapeGridProps) {
  if (voices.length === 0) return null;

  return (
    <div className="grid grid-cols-8 gap-2 p-1 w-full">
      {voices.map(voice => (
        <div
          key={voice.recording.id}
          className={`relative group rounded-lg ring-2 transition-all duration-300 ${
            voice.isActive ? 'ring-green-400' : 'ring-transparent brightness-50'
          }`}
        >
          {/* Hover card — appears above the card */}
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-48 bg-gray-900 rounded-lg overflow-hidden shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 pointer-events-none">
            <div className="aspect-video bg-gray-800">
              {voice.photo ? (
                <img
                  src={voice.photo.largeUrl}
                  alt={voice.recording.en}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-white text-xs text-center px-2">{voice.recording.en}</span>
                </div>
              )}
            </div>
            <div className="p-2 space-y-0.5">
              <p className="text-white text-xs font-semibold truncate">{voice.recording.en}</p>
              <p className="text-gray-400 text-xs italic truncate">{voice.sciName}</p>
              {voice.photo && (
                <p className="text-gray-500 text-xs truncate">{voice.photo.attribution}</p>
              )}
              <p className="text-gray-500 text-xs truncate">Rec: {voice.recording.rec}</p>
            </div>
          </div>

          {/* Card content */}
          <div className="relative w-full h-[110px] rounded-lg overflow-hidden bg-black/60">
            {voice.isLoading ? (
              <Skeleton className="w-full h-full rounded-none" />
            ) : voice.photo ? (
              <img
                src={voice.photo.photoUrl}
                alt={voice.recording.en}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center px-1">
                <p className="text-white text-xs text-center leading-tight">{voice.recording.en}</p>
              </div>
            )}
            {!voice.isLoading && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                <p className={`text-xs text-white truncate transition-opacity duration-300 ${voice.isActive ? 'opacity-100' : 'opacity-60'}`}>
                  {voice.recording.en}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: 10/10 pass

- [ ] **Step 5: Full suite + build**

```
npx vitest run && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/SoundscapeGrid.tsx src/components/SoundscapeGrid.test.tsx
git commit -m "feat: SoundscapeGrid as 8-column grid with hover card and loading skeleton; remove sonogram"
```

---

### Task 7: Wire `MapView` + delete old files

**Files:**
- Modify: `src/components/MapView.tsx`
- Modify: `src/components/MapView.test.tsx`
- Delete: `src/components/FeaturedBirdCard.tsx`
- Delete: `src/components/FeaturedBirdCard.test.tsx`
- Delete: `src/hooks/useFeaturedBird.ts`
- Delete: `src/hooks/useFeaturedBird.test.ts`

**Consumes from Task 4:** `import { SpeciesPanel } from './SpeciesPanel'`

- [ ] **Step 1: Write the updated MapView**

Replace the entire `src/components/MapView.tsx` with:

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

import type { LatLng } from '../utils/geo';
import { haversineKm } from '../utils/geo';
import type { EBirdObservation } from '../api/ebird';
import { fetchRecentNearby, fetchNearbyNotable } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';
import { fetchRecordingsByBox } from '../api/xeno-canto';
import { useSoundscape } from '../hooks/useSoundscape';
import { SpeciesPanel } from './SpeciesPanel';
import { SoundscapeGrid } from './SoundscapeGrid';
import { SoundscapeControls } from './SoundscapeControls';

const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const FETCH_RADIUS_KM = 10;
const DEBOUNCE_MS = 500;
const XC_BOX_DEG = 0.225;

function PinHandler({ onPin }: { onPin: (pos: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function MapView() {
  const [pin, setPin] = useState<LatLng | null>(null);
  const [notableObs, setNotableObs] = useState<EBirdObservation[]>([]);
  const [recentObs, setRecentObs] = useState<EBirdObservation[]>([]);
  const [recordings, setRecordings] = useState<XCRecording[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const lastFetchRef = useRef<LatLng | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const soundscape = useSoundscape(recordings, recentObs);

  const fetchForPin = useCallback(async (pos: LatLng) => {
    if (lastFetchRef.current && haversineKm(pos, lastFetchRef.current) < FETCH_RADIUS_KM) return;
    lastFetchRef.current = pos;

    setIsLoading(true);
    const month = new Date().getMonth() + 1;
    try {
      const [notable, recent, xcRes] = await Promise.all([
        fetchNearbyNotable(pos.lat, pos.lng),
        fetchRecentNearby(pos.lat, pos.lng),
        fetchRecordingsByBox(
          pos.lat - XC_BOX_DEG,
          pos.lat + XC_BOX_DEG,
          pos.lng - XC_BOX_DEG,
          pos.lng + XC_BOX_DEG,
          month,
        ),
      ]);
      setNotableObs(notable);
      setRecentObs(recent);
      setRecordings(xcRes.recordings);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePin = useCallback(
    (pos: LatLng) => {
      setPin(pos);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void fetchForPin(pos), DEBOUNCE_MS);
    },
    [fetchForPin],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <header className="px-4 py-2 bg-green-800 text-white flex items-center gap-3 shrink-0">
        <span className="text-lg font-semibold">Bird Soundscape Explorer</span>
        {pin && (
          <span className="text-sm text-green-200 ml-auto">
            {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <MapContainer center={[20, 0]} zoom={3} className="w-full h-full cursor-crosshair">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <PinHandler onPin={handlePin} />
            {pin && <Marker position={[pin.lat, pin.lng]} icon={defaultIcon} />}
          </MapContainer>
        </div>

        <SpeciesPanel
          notableObs={notableObs}
          recentObs={recentObs}
          recordings={recordings}
          isLoading={isLoading}
        />
      </div>

      {soundscape.voices.length > 0 && (
        <div className="shrink-0 bg-gray-900 flex items-center gap-2 px-3 py-2">
          <SoundscapeControls
            isPlaying={soundscape.isPlaying}
            voiceCount={soundscape.voices.length}
            onToggle={soundscape.toggle}
          />
          <div className="flex-1 min-w-0">
            <SoundscapeGrid voices={soundscape.voices} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `MapView.test.tsx`**

Replace the test file with updated geo-cache tests that no longer reference `FeaturedBirdCard` or `useFeaturedBird`:

```typescript
import { render } from '@testing-library/react';
import MapView from './MapView';
import { fetchNearbyNotable, fetchRecentNearby } from '../api/ebird';
import { fetchRecordingsByBox } from '../api/xeno-canto';

vi.mock('../api/ebird', () => ({
  fetchNearbyNotable: vi.fn().mockResolvedValue([]),
  fetchRecentNearby: vi.fn().mockResolvedValue([]),
  fetchTaxonomy: vi.fn().mockResolvedValue([]),
  clearTaxonomyCache: vi.fn(),
}));

vi.mock('../api/xeno-canto', () => ({
  fetchRecordingsByBox: vi.fn().mockResolvedValue({ recordings: [], numRecordings: '0', numSpecies: '0', page: 1, numPages: 1 }),
}));

vi.mock('../api/inat', () => ({ fetchBirdPhoto: vi.fn().mockResolvedValue(null) }));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMapEvents: (handlers: { click?: (e: unknown) => void }) => { (globalThis as Record<string, unknown>)._mapClick = handlers.click; return null; },
}));

function simulateMapClick(lat: number, lng: number) {
  const click = (globalThis as Record<string, unknown>)._mapClick as ((e: { latlng: { lat: number; lng: number } }) => void) | undefined;
  click?.({ latlng: { lat, lng } });
}

describe('MapView geo-cache', () => {
  beforeEach(() => {
    vi.mocked(fetchNearbyNotable).mockClear();
    vi.mocked(fetchRecentNearby).mockClear();
    vi.mocked(fetchRecordingsByBox).mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls APIs when a pin is dropped', async () => {
    render(<MapView />);
    simulateMapClick(37.77, -122.4);
    await vi.runAllTimersAsync();
    expect(fetchNearbyNotable).toHaveBeenCalledWith(37.77, -122.4);
  });

  it('does not re-call APIs when second pin is within 10km', async () => {
    render(<MapView />);
    simulateMapClick(37.77, -122.4);
    await vi.runAllTimersAsync();
    vi.mocked(fetchNearbyNotable).mockClear();

    simulateMapClick(37.77 + 0.02, -122.4);
    await vi.runAllTimersAsync();
    expect(fetchNearbyNotable).not.toHaveBeenCalled();
  });

  it('re-calls APIs when pin moves more than 10km', async () => {
    render(<MapView />);
    simulateMapClick(37.77, -122.4);
    await vi.runAllTimersAsync();
    vi.mocked(fetchNearbyNotable).mockClear();

    simulateMapClick(37.77 + 0.5, -122.4);
    await vi.runAllTimersAsync();
    expect(fetchNearbyNotable).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to confirm they pass before deleting files**

```
npx vitest run src/components/MapView.test.tsx
```

Expected: 3/3 pass

- [ ] **Step 4: Delete the old files**

```bash
rm src/components/FeaturedBirdCard.tsx
rm src/components/FeaturedBirdCard.test.tsx
rm src/hooks/useFeaturedBird.ts
rm src/hooks/useFeaturedBird.test.ts
```

- [ ] **Step 5: Run full suite and confirm everything passes**

```
npx vitest run
```

Expected: all tests pass, no references to deleted files

- [ ] **Step 6: Build check**

```
npm run build
```

Expected: clean build

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire SpeciesPanel into MapView; remove FeaturedBirdCard and useFeaturedBird"
```
