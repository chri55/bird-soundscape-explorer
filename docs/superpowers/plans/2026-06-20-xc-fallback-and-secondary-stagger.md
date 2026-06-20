# XC Fallback and Secondary Stagger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure audio always plays when eBird data exists (even when the XC bbox query returns 0 recordings), and have all 8 soundscape voices come in within 9 seconds of pressing play.

**Architecture:** A new pure utility `fillRecordingGaps` supplements the XC bbox results with per-species queries using eBird data when the species count falls below target; MapView awaits it before setting state. The secondary stagger fix is a two-constant change to `useSoundscape`'s `toggle()` delay formula.

**Tech Stack:** React 19 + TypeScript, Vitest + React Testing Library, Xeno-canto API v3.

## Global Constraints

- `verbatimModuleSyntax: true` — all type-only imports **must** use `import type`
- Vitest `globals: true` — no explicit `describe`/`it`/`expect`/`vi`/`beforeEach`/`afterEach` imports in test files
- Use `fireEvent` only (not `@testing-library/user-event`)
- `SPARE_VOICES = 4`, `MAX_VOICES = 8` → target = 12 — these constants live in `src/hooks/useSoundscape.ts`
- `INITIAL_STAGGER_MS = 3_000`, `INITIAL_VOICES = 3` — already exported from `useSoundscape.ts`
- Scientific name key format: `` `${rec.gen} ${rec.sp}` `` — matches eBird's `obs.sciName`
- Run tests with: `npx vitest run` (all) or `npx vitest run src/path/to/file.test.ts` (single file)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/utils/soundscape-recordings.ts` | Create | `fillRecordingGaps` utility |
| `src/utils/soundscape-recordings.test.ts` | Create | Unit tests for the utility |
| `src/components/MapView.tsx` | Modify | Wire `fillRecordingGaps` into `fetchForPin` |
| `src/hooks/useSoundscape.ts` | Modify | Add secondary stagger constants; update `toggle()` |
| `src/hooks/useSoundscape.test.ts` | Modify | Add/update tests for secondary stagger timing |

---

### Task 1: `fillRecordingGaps` utility + MapView wiring

**Files:**
- Create: `src/utils/soundscape-recordings.ts`
- Create: `src/utils/soundscape-recordings.test.ts`
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- Consumes: `XCRecording` from `../api/xeno-canto`; `EBirdObservation` from `../api/ebird`; `fetchRecordings(query: string): Promise<XCResponse>` from `../api/xeno-canto`
- Produces: `fillRecordingGaps(existing: XCRecording[], recentObs: EBirdObservation[], target: number): Promise<XCRecording[]>` — exported from `src/utils/soundscape-recordings.ts`

---

- [ ] **Step 1: Write the failing tests**

Create `src/utils/soundscape-recordings.test.ts`:

```typescript
import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import { fetchRecordings } from '../api/xeno-canto';
import { fillRecordingGaps } from './soundscape-recordings';

vi.mock('../api/xeno-canto', () => ({
  fetchRecordings: vi.fn(),
}));

function makeRec(gen: string, sp: string, id = '1'): XCRecording {
  return {
    id, gen, sp, en: `${gen} ${sp}`, rec: 'Jane', cnt: 'US', loc: 'SF',
    lat: '37', lon: '-122', type: 'song', q: 'A',
    file: `https://xc.org/${id}.mp3`, date: '2024-01-01',
    'file-name': `${id}.mp3`, sono: { small: 'https://xc.org/s.png', med: 'https://xc.org/m.png' },
  };
}

function makeObs(sciName: string, howMany: number): EBirdObservation {
  return {
    speciesCode: sciName.replace(' ', ''), comName: sciName,
    sciName, locName: 'SF', obsDt: '2024-01-01', howMany,
    lat: 37.77, lng: -122.4,
  };
}

const emptyXCResponse = {
  numRecordings: '0', numSpecies: '0', page: 1, numPages: 1, recordings: [],
};

describe('fillRecordingGaps', () => {
  beforeEach(() => {
    vi.mocked(fetchRecordings).mockResolvedValue(emptyXCResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns existing array unchanged (same reference) when covered species >= target', async () => {
    const recs = [makeRec('Turdus', 'migratorius'), makeRec('Parus', 'major', '2')];
    const result = await fillRecordingGaps(recs, [], 2);
    expect(result).toBe(recs);
    expect(fetchRecordings).not.toHaveBeenCalled();
  });

  it('fast-paths when target is 0', async () => {
    const recs = [makeRec('Turdus', 'migratorius')];
    const result = await fillRecordingGaps(recs, [], 0);
    expect(result).toBe(recs);
    expect(fetchRecordings).not.toHaveBeenCalled();
  });

  it('calls fetchRecordings for gap species in howMany-descending order', async () => {
    const existing = [makeRec('Turdus', 'migratorius')];
    const recentObs = [
      makeObs('Parus major', 3),
      makeObs('Corvus brachyrhynchos', 10),
    ];
    await fillRecordingGaps(existing, recentObs, 3);
    expect(fetchRecordings).toHaveBeenCalledTimes(2);
    expect(fetchRecordings).toHaveBeenNthCalledWith(1, 'Corvus brachyrhynchos');
    expect(fetchRecordings).toHaveBeenNthCalledWith(2, 'Parus major');
  });

  it('merges gap recordings into the returned array after existing', async () => {
    const existing = [makeRec('Turdus', 'migratorius')];
    const gapRec = makeRec('Corvus', 'brachyrhynchos', '99');
    vi.mocked(fetchRecordings).mockResolvedValue({
      numRecordings: '1', numSpecies: '1', page: 1, numPages: 1, recordings: [gapRec],
    });
    const result = await fillRecordingGaps(existing, [makeObs('Corvus brachyrhynchos', 5)], 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('99');
  });

  it('skips species whose fetchRecordings rejects and does not throw', async () => {
    const existing = [makeRec('Turdus', 'migratorius')];
    vi.mocked(fetchRecordings).mockRejectedValue(new Error('503'));
    const result = await fillRecordingGaps(existing, [makeObs('Corvus brachyrhynchos', 5)], 2);
    expect(result).toEqual(existing);
  });

  it('does not query species already covered by existing recordings', async () => {
    const existing = [makeRec('Turdus', 'migratorius')];
    const recentObs = [
      makeObs('Turdus migratorius', 50),
      makeObs('Parus major', 3),
    ];
    await fillRecordingGaps(existing, recentObs, 2);
    expect(fetchRecordings).toHaveBeenCalledTimes(1);
    expect(fetchRecordings).toHaveBeenCalledWith('Parus major');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/utils/soundscape-recordings.test.ts
```

Expected: FAIL — `fillRecordingGaps` not found / module not found.

- [ ] **Step 3: Create `src/utils/soundscape-recordings.ts`**

```typescript
import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import { fetchRecordings } from '../api/xeno-canto';

export async function fillRecordingGaps(
  existing: XCRecording[],
  recentObs: EBirdObservation[],
  target: number,
): Promise<XCRecording[]> {
  const coveredSciNames = new Set(existing.map(r => `${r.gen} ${r.sp}`));
  if (coveredSciNames.size >= target) return existing;

  const needed = target - coveredSciNames.size;
  const gapSpecies = recentObs
    .filter(obs => !coveredSciNames.has(obs.sciName))
    .sort((a, b) => (b.howMany ?? 1) - (a.howMany ?? 1))
    .slice(0, needed);

  const results = await Promise.all(
    gapSpecies.map(obs => fetchRecordings(obs.sciName).catch(() => null)),
  );

  const gapRecordings = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .flatMap(r => r.recordings);

  return [...existing, ...gapRecordings];
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/utils/soundscape-recordings.test.ts
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Wire `fillRecordingGaps` into `MapView.tsx`**

In `src/components/MapView.tsx`, make two edits:

**Edit 1** — update the `useSoundscape` import line to also export constants:

```typescript
// Before:
import { useSoundscape } from '../hooks/useSoundscape';

// After:
import { useSoundscape, MAX_VOICES, SPARE_VOICES } from '../hooks/useSoundscape';
```

**Edit 2** — add the `fillRecordingGaps` import after the `fetchRecordingsByBox` import:

```typescript
// After:
import { fetchRecordingsByBox } from '../api/xeno-canto';
import { fillRecordingGaps } from '../utils/soundscape-recordings';
```

**Edit 3** — in `fetchForPin`, replace the `setRecordings` line:

```typescript
// Before (line 76):
setRecordings(xcRes.recordings);

// After:
setRecordings(await fillRecordingGaps(xcRes.recordings, recent, MAX_VOICES + SPARE_VOICES));
```

`fetchForPin` is already `async`, so `await` is valid here.

- [ ] **Step 6: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 7: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/utils/soundscape-recordings.ts src/utils/soundscape-recordings.test.ts src/components/MapView.tsx
git commit -m "feat: fill XC recording gaps from eBird species list"
```

---

### Task 2: Secondary voice stagger

**Files:**
- Modify: `src/hooks/useSoundscape.ts`
- Modify: `src/hooks/useSoundscape.test.ts`

**Interfaces:**
- Consumes: existing constants `INITIAL_VOICES`, `INITIAL_STAGGER_MS` from the same file
- Produces: `SECONDARY_STAGGER_MIN_MS = 1_000` and `SECONDARY_STAGGER_MAX_MS = 6_000` exported from `src/hooks/useSoundscape.ts`; voices 3–7 now enter at 4–9 s from play press

---

- [ ] **Step 1: Write the failing tests**

In `src/hooks/useSoundscape.test.ts`:

**Edit 1** — add `SECONDARY_STAGGER_MIN_MS, SECONDARY_STAGGER_MAX_MS` to the named import block at the top of the file. The current import is:

```typescript
import {
  selectVoices, computeIntervalMs,
  MIN_INTERVAL_MS, MAX_INTERVAL_MS, MAX_VOICES,
  INITIAL_VOICES, SPARE_VOICES, MAX_AUDIO_RETRIES, RETRY_DELAY_MS,
  useSoundscape, INITIAL_STAGGER_MS,
} from './useSoundscape';
```

Change it to:

```typescript
import {
  selectVoices, computeIntervalMs,
  MIN_INTERVAL_MS, MAX_INTERVAL_MS, MAX_VOICES,
  INITIAL_VOICES, SPARE_VOICES, MAX_AUDIO_RETRIES, RETRY_DELAY_MS,
  useSoundscape, INITIAL_STAGGER_MS,
  SECONDARY_STAGGER_MIN_MS, SECONDARY_STAGGER_MAX_MS,
} from './useSoundscape';
```

**Edit 2** — update the comment in the existing `'first INITIAL_VOICES voices fire within INITIAL_STAGGER_MS'` test. Find this comment inside that test:

```typescript
    // Voice 3's delay is MAX_INTERVAL_MS (howMany=1, all others higher) — not yet played
```

Replace it with:

```typescript
    // Voice 3's secondary stagger delay is at least INITIAL_STAGGER_MS + SECONDARY_STAGGER_MIN_MS — not yet played
```

**Edit 3** — add two new tests at the end of the `'useSoundscape — audio tuning'` describe block (after the `'voice isLoading transitions false when canplay fires'` test, before the closing `}`):

```typescript
  it('secondary voices do not fire before INITIAL_STAGGER_MS + SECONDARY_STAGGER_MIN_MS', async () => {
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
    // Advance to just before the earliest a secondary voice can fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + SECONDARY_STAGGER_MIN_MS - 100);
    });
    expect(audioInstances[3]?.play).not.toHaveBeenCalled();
  });

  it('secondary voices all fire by INITIAL_STAGGER_MS + SECONDARY_STAGGER_MAX_MS', async () => {
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
    // Advance past the latest any secondary voice can fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + SECONDARY_STAGGER_MAX_MS + 500);
    });
    expect(audioInstances[3].play).toHaveBeenCalled();
  });
```

Note: `makeRec` in `useSoundscape.test.ts` accepts an object `Partial<XCRecording>` — use the existing `makeRec({ gen: 'Sp', sp: 'a', id: '1' })` call style, which already matches the helper defined at line 14.

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: the two new stagger tests FAIL with `SECONDARY_STAGGER_MIN_MS is not exported` / import error.

- [ ] **Step 3: Add constants and update `toggle()` in `src/hooks/useSoundscape.ts`**

**Edit 1** — add the two new constants after the existing `INITIAL_VOICES` and `INITIAL_STAGGER_MS` lines. The current constants block ends at:

```typescript
export const INITIAL_STAGGER_MS = 3_000;
export const INITIAL_VOICES = 3;
export const SPARE_VOICES = 4;
```

Add two lines immediately after `INITIAL_VOICES`:

```typescript
export const INITIAL_STAGGER_MS = 3_000;
export const INITIAL_VOICES = 3;
export const SECONDARY_STAGGER_MIN_MS = 1_000;
export const SECONDARY_STAGGER_MAX_MS = 6_000;
export const SPARE_VOICES = 4;
```

**Edit 2** — in `toggle()` (around line 265), update the delay formula. Find:

```typescript
        const delay = i < INITIAL_VOICES
          ? Math.random() * INITIAL_STAGGER_MS
          : (intervalsRef.current[i] ?? MAX_INTERVAL_MS);
```

Replace with:

```typescript
        const delay = i < INITIAL_VOICES
          ? Math.random() * INITIAL_STAGGER_MS
          : INITIAL_STAGGER_MS
            + SECONDARY_STAGGER_MIN_MS
            + Math.random() * (SECONDARY_STAGGER_MAX_MS - SECONDARY_STAGGER_MIN_MS);
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: all tests pass, including the two new stagger tests.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSoundscape.ts src/hooks/useSoundscape.test.ts
git commit -m "feat: tighten secondary voice stagger to 4-9s from play press"
```
