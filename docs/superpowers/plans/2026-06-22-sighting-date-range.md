# Sighting Date Range & Notable Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track earliest and most recent dates when deduplicating species observations, display them as a date range in the species list, and rename "Rare" / "Rarest Sightings" to "Notable" / "Notable Sightings".

**Architecture:** Add a `DeduplicatedObs` type (extends `EBirdObservation` with `firstObsDt`) returned by `deduplicateObs`. `SpeciesListRow` consumes `DeduplicatedObs` and renders a range when `firstObsDt ≠ obsDt`. `SpeciesPanel` gains no new props — the type change flows through automatically.

**Tech Stack:** React 19 + TypeScript, Vitest + React Testing Library.

## Global Constraints

- `verbatimModuleSyntax: true` — type-only imports must use a separate `import type` line
- Test files use Vitest globals — no explicit `import { describe, it, expect, vi }` in test files
- `DeduplicatedObs` must extend (not replace) `EBirdObservation` — downstream consumers that only need `EBirdObservation` remain unaffected
- `obsDt` on a `DeduplicatedObs` is always the **most recent** date across merged observations; `firstObsDt` is the **earliest**
- Date format uses en-US locale; same-year ranges omit the year from the first date: `Jun 1 – Jun 15, 2024`; cross-year ranges include the year on both: `Dec 28, 2023 – Jan 3, 2024`
- The en-dash character between dates is `–` (U+2013), not a hyphen

---

### Task 1: `DeduplicatedObs` type and updated `deduplicateObs`

**Files:**
- Modify: `src/utils/species.ts`
- Modify: `src/utils/species.test.ts`

**Interfaces:**
- Produces: `DeduplicatedObs` interface and updated `deduplicateObs` function consumed by Task 2

```typescript
// DeduplicatedObs produced by this task:
export interface DeduplicatedObs extends EBirdObservation {
  firstObsDt: string; // earliest obsDt across all merged observations (same format as obsDt)
  // obsDt (inherited) = most recent obsDt
}

export function deduplicateObs(obs: EBirdObservation[]): DeduplicatedObs[]
```

- [ ] **Step 1: Write the new and updated failing tests**

Replace the contents of `src/utils/species.test.ts` from line 55 onward (the `'keeps comName, locName, obsDt from the first occurrence'` test and everything before `describe('bestRecording'`). The updated deduplicateObs block:

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

  it('keeps comName and locName from the first occurrence, sets obsDt to most recent', () => {
    const obs = [
      makeObs('Turdus migratorius', 5, { comName: 'American Robin', locName: 'Central Park', obsDt: '2024-01-01 08:00' }),
      makeObs('Turdus migratorius', 3, { comName: 'Other Name', locName: 'Other Park', obsDt: '2024-02-01 09:00' }),
    ];
    const result = deduplicateObs(obs);
    expect(result[0].comName).toBe('American Robin');
    expect(result[0].locName).toBe('Central Park');
    expect(result[0].obsDt).toBe('2024-02-01 09:00');
    expect(result[0].firstObsDt).toBe('2024-01-01 08:00');
  });

  it('sets firstObsDt = obsDt for a single observation', () => {
    const obs = [makeObs('Turdus migratorius', 5, { obsDt: '2024-06-15 08:00' })];
    const result = deduplicateObs(obs);
    expect(result[0].firstObsDt).toBe('2024-06-15 08:00');
    expect(result[0].obsDt).toBe('2024-06-15 08:00');
  });

  it('correctly identifies earliest and latest when second obs is earlier', () => {
    const obs = [
      makeObs('Turdus migratorius', 5, { obsDt: '2024-06-15 08:00' }),
      makeObs('Turdus migratorius', 3, { obsDt: '2024-05-01 07:00' }),
    ];
    const result = deduplicateObs(obs);
    expect(result[0].firstObsDt).toBe('2024-05-01 07:00');
    expect(result[0].obsDt).toBe('2024-06-15 08:00');
  });

  it('correctly identifies min and max across three observations in non-sorted order', () => {
    const obs = [
      makeObs('Turdus migratorius', 1, { obsDt: '2024-06-10 08:00' }),
      makeObs('Turdus migratorius', 1, { obsDt: '2024-06-01 08:00' }),
      makeObs('Turdus migratorius', 1, { obsDt: '2024-06-20 08:00' }),
    ];
    const result = deduplicateObs(obs);
    expect(result[0].firstObsDt).toBe('2024-06-01 08:00');
    expect(result[0].obsDt).toBe('2024-06-20 08:00');
  });
});
```

Then keep the existing `describe('bestRecording', ...)` block unchanged after it.

- [ ] **Step 2: Run tests to verify the new assertions fail**

```bash
npx vitest run src/utils/species.test.ts
```

Expected: the updated `'keeps comName and locName...'` test and the three new `firstObsDt` tests fail; existing passing tests still pass.

- [ ] **Step 3: Update `src/utils/species.ts`**

Replace the full file:

```typescript
import type { EBirdObservation } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';
import { qualityRank, typeScore } from './recording-quality';

export interface DeduplicatedObs extends EBirdObservation {
  firstObsDt: string;
}

export function deduplicateObs(obs: EBirdObservation[]): DeduplicatedObs[] {
  const seen = new Map<string, DeduplicatedObs>();
  for (const o of obs) {
    const existing = seen.get(o.sciName);
    if (!existing) {
      seen.set(o.sciName, { ...o, howMany: o.howMany ?? 0, firstObsDt: o.obsDt });
    } else {
      const isLater = o.obsDt.slice(0, 10) > existing.obsDt.slice(0, 10);
      const isEarlier = o.obsDt.slice(0, 10) < existing.firstObsDt.slice(0, 10);
      seen.set(o.sciName, {
        ...existing,
        howMany: (existing.howMany ?? 0) + (o.howMany ?? 0),
        obsDt: isLater ? o.obsDt : existing.obsDt,
        firstObsDt: isEarlier ? o.obsDt : existing.firstObsDt,
      });
    }
  }
  return [...seen.values()];
}

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/species.test.ts
```

Expected: all tests pass (11 total including 4 new/updated deduplicateObs tests + 6 bestRecording tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/species.ts src/utils/species.test.ts
git commit -m "feat: track earliest/latest dates in deduplicateObs, add DeduplicatedObs type"
```

---

### Task 2: Date range display, Notable label, and SpeciesPanel heading

**Files:**
- Modify: `src/components/SpeciesListRow.tsx`
- Modify: `src/components/SpeciesListRow.test.tsx`
- Modify: `src/components/SpeciesPanel.tsx`
- Modify: `src/components/SpeciesPanel.test.tsx` (update "Rarest Sightings" → "Notable Sightings" assertions)

**Interfaces:**
- Consumes: `DeduplicatedObs` from `src/utils/species.ts` (Task 1)

- [ ] **Step 1: Write the updated and new tests for SpeciesListRow**

Replace the full contents of `src/components/SpeciesListRow.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeciesListRow } from './SpeciesListRow';
import type { DeduplicatedObs } from '../utils/species';

const obs: DeduplicatedObs = {
  speciesCode: 'amerob', comName: 'American Robin',
  sciName: 'Turdus migratorius', locName: 'Central Park',
  obsDt: '2024-06-15 08:00', firstObsDt: '2024-06-15 08:00', howMany: 12,
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

  it('shows Notable pill when isNotable', () => {
    render(<SpeciesListRow obs={obs} isNotable={true} onClick={vi.fn()} />);
    expect(screen.getByText('Notable')).toBeInTheDocument();
  });

  it('does not show Notable pill when not notable', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.queryByText('Notable')).toBeNull();
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

  it('button has type="button"', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('shows single date when firstObsDt equals obsDt', () => {
    render(<SpeciesListRow obs={{ ...obs, obsDt: '2024-06-15 08:00', firstObsDt: '2024-06-15 08:00' }} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText(/Jun 15, 2024/)).toBeInTheDocument();
    expect(screen.queryByText(/–/)).toBeNull();
  });

  it('shows date range with year only on last date when same year', () => {
    render(<SpeciesListRow obs={{ ...obs, obsDt: '2024-06-15 08:00', firstObsDt: '2024-06-01 08:00' }} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText(/Jun 1 – Jun 15, 2024/)).toBeInTheDocument();
  });

  it('shows date range with year on both dates when different years', () => {
    render(<SpeciesListRow obs={{ ...obs, obsDt: '2024-01-03 08:00', firstObsDt: '2023-12-28 08:00' }} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByText(/Dec 28, 2023 – Jan 3, 2024/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify the new tests fail**

```bash
npx vitest run src/components/SpeciesListRow.test.tsx
```

Expected: the `'shows Notable pill'` tests fail (currently shows "Rare"), and the three date range tests fail (component doesn't use `firstObsDt` yet).

- [ ] **Step 3: Replace `src/components/SpeciesListRow.tsx`**

```tsx
import type { JSX } from 'react';
import type { DeduplicatedObs } from '../utils/species';

export interface SpeciesListRowProps {
  obs: DeduplicatedObs;
  isNotable: boolean;
  onClick: () => void;
}

function parseDatePart(dt: string): Date {
  const [year, month, day] = dt.slice(0, 10).split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function SpeciesListRow({ obs, isNotable, onClick }: SpeciesListRowProps): JSX.Element {
  const firstDate = parseDatePart(obs.firstObsDt);
  const lastDate = parseDatePart(obs.obsDt);
  const sameDay = obs.firstObsDt.slice(0, 10) === obs.obsDt.slice(0, 10);

  let dateStr: string;
  if (sameDay) {
    dateStr = lastDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } else if (firstDate.getFullYear() === lastDate.getFullYear()) {
    const first = firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const last = lastDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    dateStr = `${first} – ${last}`;
  } else {
    const first = firstDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const last = lastDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    dateStr = `${first} – ${last}`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 flex items-start justify-between gap-2"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 text-sm truncate">{obs.comName}</p>
        <p className="italic text-gray-500 text-xs truncate">{obs.sciName}</p>
        <p className="text-gray-500 text-xs truncate mt-0.5">{dateStr} · {obs.locName}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {(obs.howMany ?? 0) > 0 && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {obs.howMany} seen
          </span>
        )}
        {isNotable && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            Notable
          </span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Run SpeciesListRow tests to verify they pass**

```bash
npx vitest run src/components/SpeciesListRow.test.tsx
```

Expected: all 12 tests pass.

- [ ] **Step 5: Update `src/components/SpeciesPanel.tsx` — rename headings**

Make two text replacements in `src/components/SpeciesPanel.tsx`:

Change line 59 (loading skeleton heading):
```tsx
            Rarest Sightings
```
to:
```tsx
            Notable Sightings
```

Change line 99 (live panel section heading):
```tsx
                  Rarest Sightings
```
to:
```tsx
                  Notable Sightings
```

No other changes to `SpeciesPanel.tsx` are needed — the `deduplicateObs` return type change (`DeduplicatedObs[]`) flows through automatically to the `SpeciesListRow obs` prop.

- [ ] **Step 6: Update `src/components/SpeciesPanel.test.tsx` — fix heading assertions**

Find the two assertions that check for `'Rarest Sightings'` and change each to `'Notable Sightings'`:

```typescript
// Line 43 — change:
expect(screen.getByText('Rarest Sightings')).toBeInTheDocument();
// to:
expect(screen.getByText('Notable Sightings')).toBeInTheDocument();

// Line 98 — change:
expect(screen.getByText('Rarest Sightings')).toBeInTheDocument();
// to:
expect(screen.getByText('Notable Sightings')).toBeInTheDocument();
```

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: all tests pass with no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/components/SpeciesListRow.tsx src/components/SpeciesListRow.test.tsx src/components/SpeciesPanel.tsx src/components/SpeciesPanel.test.tsx
git commit -m "feat: show sighting date range in species list, rename Rare to Notable"
```
