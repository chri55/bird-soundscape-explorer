# Code Cleanliness Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate four real cleanliness problems: duplicated scoring logic, duplicated date-parsing, an API client that inconsistently swallows errors, and a pair of near-identical internal functions whose names obscure their relationship.

**Findings summary:** A focused read of `src/` found four concrete issues. (1) The `qualityRank` map and `typeScore` function are copy-pasted verbatim into both `src/hooks/useSoundscape.ts` and `src/utils/species.ts` — any future change must be made twice. (2) A three-line date-parsing snippet (`obsDt.split(' ')[0]` → `split('-').map(Number)` → `new Date(year, month-1, day)`) appears identically in `SpeciesListRow.tsx` and `SpeciesDetail.tsx`. (3) `src/api/inat.ts` is the only API client that does not throw on a non-OK HTTP response, silently letting a later `.json()` call throw an opaque JSON-parse error instead of a meaningful status message — inconsistent with `ebird.ts`, `nps.ts`, and `xeno-canto.ts`. (4) Inside `useSoundscape.ts`, `stopAll` and `pauseAll` share almost identical bodies; `stopAll` is used exclusively to reset on data change and the name doesn't communicate that distinction. None of these are style nitpicks — they are maintenance traps and one is a silent failure mode.

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest

## Global Constraints

- verbatimModuleSyntax: true — type-only imports must use `import type { ... }` on a separate line
- Hook tests in `src/hooks/` use Vitest globals (no explicit imports); API tests in `src/api/` import explicitly from `'vitest'`
- Run tests: `npm run test`; single file: `npx vitest run src/path/to/file.test.ts`

---

### Task 1: Extract shared recording-quality helpers into `src/utils/recording-quality.ts`

**Files:**
- Create: `src/utils/recording-quality.ts`
- Modify: `src/hooks/useSoundscape.ts`
- Modify: `src/utils/species.ts`

**Problem:** `qualityRank` and `typeScore` are copy-pasted identically into `useSoundscape.ts` (lines 41–42) and `species.ts` (lines 17–18).

- [ ] **Step 1: Create the shared module**

  Create `src/utils/recording-quality.ts` with this exact content:

  ```typescript
  /** Quality rank A=best (0) … E=worst (4). Unknown quality gets 5 (treated as worst). */
  export const qualityRank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

  /** Songs score 0 (preferred); everything else scores 1. */
  export const typeScore = (type: string): number =>
    type.toLowerCase().includes('song') ? 0 : 1;
  ```

- [ ] **Step 2: Update `src/hooks/useSoundscape.ts`**

  Replace the two local definitions (lines 41–42):
  ```typescript
  const qualityRank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const typeScore = (type: string) => (type.toLowerCase().includes('song') ? 0 : 1);
  ```
  with an import:
  ```typescript
  import { qualityRank, typeScore } from '../utils/recording-quality';
  ```
  (Add this import line alongside the existing `import type` lines near the top of the file.)

- [ ] **Step 3: Update `src/utils/species.ts`**

  Replace the two local definitions (lines 17–18):
  ```typescript
  const qualityRank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const typeScore = (type: string) => (type.toLowerCase().includes('song') ? 0 : 1);
  ```
  with an import:
  ```typescript
  import { qualityRank, typeScore } from './recording-quality';
  ```

- [ ] **Step 4: Run tests**

  `npm run test`

  Expected: all tests pass (the observable behavior of `selectVoices` and `bestRecording` is unchanged).

- [ ] **Step 5: Commit**

  `git commit -m "refactor: extract shared qualityRank/typeScore helpers into utils/recording-quality"`

---

### Task 2: Extract `formatObsDate` to eliminate duplicated date-parsing

**Files:**
- Modify: `src/utils/species.ts`
- Modify: `src/components/SpeciesListRow.tsx`
- Modify: `src/components/SpeciesDetail.tsx`
- Modify: `src/utils/species.test.ts`

**Problem:** Both `SpeciesListRow.tsx` (lines 11–14) and `SpeciesDetail.tsx` (lines 47–50) contain this identical block:

```typescript
const datePart = obs.obsDt.split(' ')[0] ?? obs.obsDt;
const [year, month, day] = datePart.split('-').map(Number);
const dateStr = new Date(year, (month ?? 1) - 1, day ?? 1)
  .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
```

- [ ] **Step 1: Write failing test for the new function**

  Add to `src/utils/species.test.ts`:

  ```typescript
  import { deduplicateObs, bestRecording, formatObsDate } from './species';

  describe('formatObsDate', () => {
    it('formats a datetime string to locale date', () => {
      expect(formatObsDate('2024-06-15 08:00')).toBe('Jun 15, 2024');
    });

    it('formats a date-only string', () => {
      expect(formatObsDate('2024-01-03')).toBe('Jan 3, 2024');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  `npx vitest run src/utils/species.test.ts`

  Expected: FAIL (formatObsDate is not yet exported)

- [ ] **Step 3: Add `formatObsDate` to `src/utils/species.ts`**

  Append to the end of `src/utils/species.ts`:

  ```typescript
  /**
   * Parses an eBird obsDt string ("YYYY-MM-DD" or "YYYY-MM-DD HH:MM") and
   * returns a human-readable date like "Jun 15, 2024".
   */
  export function formatObsDate(obsDt: string): string {
    const datePart = obsDt.split(' ')[0] ?? obsDt;
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1)
      .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

  `npx vitest run src/utils/species.test.ts`

  Expected: PASS

- [ ] **Step 5: Update `src/components/SpeciesListRow.tsx`**

  Add the import (alongside the existing `import type { EBirdObservation }` line):
  ```typescript
  import { formatObsDate } from '../utils/species';
  ```

  Replace lines 11–14:
  ```typescript
  const datePart = obs.obsDt.split(' ')[0] ?? obs.obsDt;
  const [year, month, day] = datePart.split('-').map(Number);
  const dateStr = new Date(year, (month ?? 1) - 1, day ?? 1)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  ```
  with:
  ```typescript
  const dateStr = formatObsDate(obs.obsDt);
  ```

- [ ] **Step 6: Update `src/components/SpeciesDetail.tsx`**

  Add the import (alongside the existing import from `'../utils/species'`):
  ```typescript
  import { bestRecording, formatObsDate } from '../utils/species';
  ```
  (Replace `import { bestRecording }` with the combined import above.)

  Replace lines 47–50:
  ```typescript
  const datePart = obs.obsDt.split(' ')[0] ?? obs.obsDt;
  const [year, month, day] = datePart.split('-').map(Number);
  const dateStr = new Date(year, (month ?? 1) - 1, day ?? 1)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  ```
  with:
  ```typescript
  const dateStr = formatObsDate(obs.obsDt);
  ```

- [ ] **Step 7: Run tests**

  `npm run test`

  Expected: all tests pass.

- [ ] **Step 8: Commit**

  `git commit -m "refactor: extract formatObsDate to eliminate duplicated date-parsing in components"`

---

### Task 3: Make `inat.ts` throw on non-OK responses (consistency fix)

**Files:**
- Modify: `src/api/inat.ts`
- Modify: `src/api/inat.test.ts`

**Problem:** Every other API client (`ebird.ts`, `nps.ts`, `xeno-canto.ts`) throws a descriptive error when `res.ok` is false. `inat.ts` omits this check entirely — a 500 or 429 silently falls through to `res.json()`, which throws an opaque parse error or hangs. This means callers see "SyntaxError: Unexpected token" instead of "iNaturalist error 429: Too Many Requests".

- [ ] **Step 1: Write a failing test**

  Add to `src/api/inat.test.ts` (inside the existing `describe('fetchBirdPhoto')` block):

  ```typescript
  it('throws a descriptive error on non-ok response', async () => {
    const { fetchBirdPhoto: fetch } = await import('./inat');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests',
    });
    await expect(fetch('Turdus migratorius')).rejects.toThrow('iNaturalist error 429');
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  `npx vitest run src/api/inat.test.ts`

  Expected: FAIL (the error is not currently thrown)

- [ ] **Step 3: Add the non-OK guard in `src/api/inat.ts`**

  In `fetchBirdPhoto`, after the `const res = await fetch(url);` line (line 36), add:

  ```typescript
  if (!res.ok) throw new Error(`iNaturalist error ${res.status}: ${await res.text()}`);
  ```

  The updated function body should read:
  ```typescript
  export async function fetchBirdPhoto(sciName: string): Promise<BirdPhoto | null> {
    if (photoCache.has(sciName)) return photoCache.get(sciName)!;

    const url = `${BASE_URL}/taxa?q=${encodeURIComponent(sciName)}&rank=species&per_page=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`iNaturalist error ${res.status}: ${await res.text()}`);

    const data = await res.json() as INatTaxaResponse;
    // ... rest unchanged
  ```

- [ ] **Step 4: Run test to verify it passes**

  `npx vitest run src/api/inat.test.ts`

  Expected: PASS

- [ ] **Step 5: Run all tests**

  `npm run test`

  Expected: all tests pass (callers in `useSoundscape.ts` already use `.catch(() => null)` on `fetchBirdPhoto`, so the thrown error is caught there).

- [ ] **Step 6: Commit**

  `git commit -m "fix: throw descriptive error on non-OK iNaturalist response (consistency with other API clients)"`

---

### Task 4: Rename `stopAll` to `resetVoices` in `useSoundscape.ts`

**Files:**
- Modify: `src/hooks/useSoundscape.ts`

**Problem:** `useSoundscape.ts` has two near-identical internal callbacks: `stopAll` (clears timers, pauses audio, clears `src`, calls `load()`) and `pauseAll` (clears timers, pauses audio only). `stopAll` is never called from UI — it is only called at the top of the data-rebuild `useEffect` to hard-reset the audio elements before assigning new URLs. Its name `stopAll` sounds like a user-visible pause/stop action, making it easy to confuse with `pauseAll`. Renaming to `resetVoices` communicates its actual purpose: tearing down audio state before rebuilding from new data.

- [ ] **Step 1: Rename `stopAll` to `resetVoices` in `src/hooks/useSoundscape.ts`**

  Change the `const stopAll = useCallback(...)` declaration:
  ```typescript
  const stopAll = useCallback(() => {
  ```
  to:
  ```typescript
  const resetVoices = useCallback(() => {
  ```

  Change the call site inside the `useEffect` (currently `stopAll()` on the first line of the effect body):
  ```typescript
  stopAll();
  ```
  to:
  ```typescript
  resetVoices();
  ```

  Change the dependency array at the bottom of the same `useEffect`:
  ```typescript
  }, [recordingsKey, recentObsKey, stopAll]);
  ```
  to:
  ```typescript
  }, [recordingsKey, recentObsKey, resetVoices]);
  ```

- [ ] **Step 2: Run tests**

  `npm run test`

  Expected: all tests pass (the function is internal; the public API surface is unchanged).

- [ ] **Step 3: Commit**

  `git commit -m "refactor: rename stopAll→resetVoices in useSoundscape to clarify it resets on data change, not pauses"`
