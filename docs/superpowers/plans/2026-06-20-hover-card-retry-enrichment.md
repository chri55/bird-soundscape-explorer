# Hover Card Fix, XC Retry, and Species Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the inactive soundscape card brightness filter dimming the hover card; add XC audio retry-with-replacement; add Wikipedia summary and eBird link to the species detail panel.

**Architecture:** Three independent changes: (1) a one-line CSS class move in SoundscapeGrid, (2) retry/spare-pool logic wired into useSoundscape's rebuild effect with in-place voice replacement to keep array indices stable, (3) a new wikipedia.ts API client consumed by SpeciesDetail alongside the existing photo/taxonomy fetches.

**Tech Stack:** React 19, TypeScript (`verbatimModuleSyntax: true` — all type-only imports must use `import type`), Tailwind CSS v4, Vitest (`globals: true` — do NOT import `describe`/`it`/`expect`/`vi`/`beforeEach`/`afterEach`), React Testing Library (`fireEvent` only — no `@testing-library/user-event`), Wikipedia REST API v1.

## Global Constraints

- `verbatimModuleSyntax: true` — every type-only import must use `import type { … }` or inline `import { type Foo }`. Mixed value+type imports can use the `type` keyword on individual specifiers.
- Vitest `globals: true` — test files must NOT explicitly import `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`. Those are globals.
- Tests use `fireEvent` from `@testing-library/react`. Never use `@testing-library/user-event`.
- No new npm dependencies. Wikipedia REST API requires no key.
- `npm run build` must pass (TypeScript strict mode, no unused variables).
- `npm test` must pass (Vitest, `--passWithNoTests`).

---

### Task 1: SoundscapeGrid Brightness Fix

**Files:**
- Modify: `src/components/SoundscapeGrid.tsx` (line 17)

**Interfaces:**
- Consumes: `SoundscapeVoice` from `../hooks/useSoundscape` (no changes to the type in this task)
- Produces: unchanged component API; `brightness-50` is now on the inner card div instead of the outer wrapper

**Problem:** Line 17 of `SoundscapeGrid.tsx` applies `brightness-50` on the outer `relative group` wrapper when a voice is inactive. The hover card popup is an absolutely-positioned child of this wrapper and inherits the CSS filter, appearing dim.

**Fix:** Remove `brightness-50` from the outer wrapper's className. Apply it only to the inner `h-[110px]` card content div.

- [ ] **Step 1: Read the current file**

Open `src/components/SoundscapeGrid.tsx` to confirm the exact text before editing.

- [ ] **Step 2: Edit the outer wrapper — remove brightness-50**

In `src/components/SoundscapeGrid.tsx`, find this className string on the outer wrapper div (around line 16-18):

```tsx
className={`relative group rounded-lg ring-2 transition-all duration-300 ${
  voice.isActive ? 'ring-green-400' : 'ring-transparent brightness-50'
}`}
```

Replace with:

```tsx
className={`relative group rounded-lg ring-2 transition-all duration-300 ${
  voice.isActive ? 'ring-green-400' : 'ring-transparent'
}`}
```

- [ ] **Step 3: Edit the inner card div — add brightness-50**

Find the inner card content div (around line 47):

```tsx
<div className="relative w-full h-[110px] rounded-lg overflow-hidden bg-black/60">
```

Replace with:

```tsx
<div className={`relative w-full h-[110px] rounded-lg overflow-hidden bg-black/60 transition-all duration-300 ${
  !voice.isActive ? 'brightness-50' : ''
}`}>
```

- [ ] **Step 4: Run the existing tests to confirm they still pass**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: All tests PASS. (The existing `'inactive card has brightness-50 class'` test checks `container.querySelector('.brightness-50')` — this still finds the class on the inner div.)

- [ ] **Step 5: Commit**

```bash
git add src/components/SoundscapeGrid.tsx
git commit -m "fix: move brightness-50 off hover card's parent wrapper to inner card div only"
```

---

### Task 2: XC Audio Retry + Voice Replacement

**Files:**
- Modify: `src/hooks/useSoundscape.ts`
- Modify: `src/hooks/useSoundscape.test.ts`
- Modify: `src/components/SoundscapeGrid.tsx` (filter `isFailed` voices)
- Modify: `src/components/SoundscapeGrid.test.tsx` (add `isFailed` to `makeVoice`)

**Interfaces:**
- Produces (from `useSoundscape.ts`, consumed by other files and tests):
  ```typescript
  export const SPARE_VOICES: number;        // = 4
  export const MAX_AUDIO_RETRIES: number;   // = 2
  export const RETRY_DELAY_MS: number;      // = 1_000

  // SoundscapeVoice gains isFailed: boolean
  export interface SoundscapeVoice {
    recording: XCRecording;
    sciName: string;
    howMany: number;
    intervalMs: number;
    isActive: boolean;
    isLoading: boolean;
    isFailed: boolean;   // ← new
    photo: BirdPhoto | null;
  }

  // selectVoices gains optional third param
  export function selectVoices(
    recordings: XCRecording[],
    recentObs: EBirdObservation[],
    limit?: number,   // default MAX_VOICES
  ): { recording: XCRecording; sciName: string; howMany: number }[]
  ```

**Design note:** Voices are replaced **in-place** (same array index) when a spare is promoted. This keeps `audioRefs.current[idx]`, `intervalsRef.current[idx]`, and `retryCountsRef.current[idx]` permanently aligned with `voices[idx]`. Filtering out by index would shift all subsequent indices and break that alignment.

- [ ] **Step 1: Write failing tests**

Add this `describe` block at the bottom of `src/hooks/useSoundscape.test.ts` (before the closing of the file):

```typescript
describe('useSoundscape — XC retry + voice replacement', () => {
  it('selectVoices respects explicit limit param', () => {
    const recs = Array.from({ length: 10 }, (_, i) =>
      makeRec({ gen: 'Sp', sp: String(i), id: String(i) }),
    );
    expect(selectVoices(recs, [], 5)).toHaveLength(5);
  });

  it('selectVoices returns all available when limit exceeds count', () => {
    expect(selectVoices([makeRec()], [], 12)).toHaveLength(1);
  });

  it('retries audio.load() on error and voice stays active', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });

    expect(audioInstances[0].load).toHaveBeenCalled();
    expect(result.current.voices[0].isFailed).toBe(false);
  });

  it('marks voice isFailed after MAX_AUDIO_RETRIES when spare pool empty', async () => {
    // xcRec1 only → no spare
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    // error → retry 1 → error → retry 2 → error → exhausted
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.voices[0].isFailed).toBe(true);
  });

  it('replaces failed voice in-place with spare from pool', async () => {
    // Need 9 recordings: first MAX_VOICES=8 become active voices, 9th goes to spare pool.
    // With only 2 recordings both land in active slots (slice(0,8) with 2 available = both),
    // leaving the spare pool empty — so we need at least MAX_VOICES+1 recordings here.
    const recs = Array.from({ length: 9 }, (_, i) =>
      makeRec({ gen: 'Sp', sp: String(i), id: String(i) }),
    );
    const obsList = Array.from({ length: 9 }, (_, i) =>
      makeObs(`Sp ${i}`, 10 - i),  // howMany: 10,9,8,...,2 (descending so sort is predictable)
    );
    const { result } = renderHook(() => useSoundscape(recs, obsList));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.voices).toHaveLength(8); // MAX_VOICES active

    const originalName = result.current.voices[0].sciName; // highest howMany = 'Sp 0'

    // exhaust retries on voice 0
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    // voice at same index 0 replaced with the spare (not removed from array)
    expect(result.current.voices[0].sciName).not.toBe(originalName);
    expect(result.current.voices[0].isFailed).toBe(false);
    expect(result.current.voices).toHaveLength(8); // length unchanged
  });
});
```

Also import the new constants at the top of the imports block. The test file currently imports:
```typescript
import {
  selectVoices, computeIntervalMs,
  MIN_INTERVAL_MS, MAX_INTERVAL_MS, MAX_VOICES,
  INITIAL_VOICES,
  useSoundscape, INITIAL_STAGGER_MS,
} from './useSoundscape';
```

Add `SPARE_VOICES, MAX_AUDIO_RETRIES, RETRY_DELAY_MS` to that import (we reference `RETRY_DELAY_MS` in the tests above):

```typescript
import {
  selectVoices, computeIntervalMs,
  MIN_INTERVAL_MS, MAX_INTERVAL_MS, MAX_VOICES,
  INITIAL_VOICES, SPARE_VOICES, MAX_AUDIO_RETRIES, RETRY_DELAY_MS,
  useSoundscape, INITIAL_STAGGER_MS,
} from './useSoundscape';
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: the 4 new tests FAIL (exports not yet defined), existing tests PASS.

- [ ] **Step 3: Add new constants and update `SoundscapeVoice` in `useSoundscape.ts`**

After the existing constants block (after `INITIAL_VOICES`), add:

```typescript
export const SPARE_VOICES = 4;
export const MAX_AUDIO_RETRIES = 2;
export const RETRY_DELAY_MS = 1_000;
```

Add `isFailed: boolean` to the `SoundscapeVoice` interface:

```typescript
export interface SoundscapeVoice {
  recording: XCRecording;
  sciName: string;
  howMany: number;
  intervalMs: number;
  isActive: boolean;
  isLoading: boolean;
  isFailed: boolean;
  photo: BirdPhoto | null;
}
```

- [ ] **Step 4: Update `selectVoices` signature**

Change the function signature to accept an optional `limit` param:

```typescript
export function selectVoices(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
  limit = MAX_VOICES,
): { recording: XCRecording; sciName: string; howMany: number }[] {
```

Change the final `.slice(0, MAX_VOICES)` to `.slice(0, limit)`:

```typescript
  return [...bySpecies.entries()]
    .map(([sciName, recording]) => ({
      recording,
      sciName,
      howMany: howManyMap.get(sciName) ?? 1,
    }))
    .sort((a, b) => b.howMany - a.howMany)
    .slice(0, limit);
```

- [ ] **Step 5: Add `sparePoolRef` and `retryCountsRef` inside `useSoundscape`**

After the existing `const isPlayingRef = useRef(false);` line, add:

```typescript
const sparePoolRef = useRef<{ recording: XCRecording; sciName: string; howMany: number }[]>([]);
const retryCountsRef = useRef<number[]>([]);
```

- [ ] **Step 6: Rewrite the rebuild effect**

Replace the entire `useEffect(() => { ... }, [recordingsKey, recentObsKey, stopAll]);` block with:

```typescript
useEffect(() => {
  stopAll();
  let cancelled = false;

  const allCandidates = selectVoices(recordings, recentObs, MAX_VOICES + SPARE_VOICES);
  const selected = allCandidates.slice(0, MAX_VOICES);
  sparePoolRef.current = allCandidates.slice(MAX_VOICES);
  retryCountsRef.current = selected.map(() => 0);

  if (selected.length === 0) {
    setVoices([]);
    audioRefs.current = [];
    intervalsRef.current = [];
    return () => { cancelled = true; };
  }

  const howManys = selected.map(s => s.howMany);
  const minH = Math.min(...howManys);
  const maxH = Math.max(...howManys);
  const intervals = selected.map(s => computeIntervalMs(s.howMany, minH, maxH));

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
      isFailed: false,
      photo: null,
    })),
  );

  // replaceFailedVoice and attachAudioListeners are mutually recursive function
  // declarations — both hoisted to the top of this arrow-function scope, so each
  // can reference the other regardless of source order.

  function replaceFailedVoice(idx: number) {
    const a = audioRefs.current[idx];
    if (a) { a.src = ''; a.load(); }

    const spare = sparePoolRef.current.shift();
    if (!spare) {
      setVoices(v => v.map((voice, vi) => vi === idx ? { ...voice, isFailed: true } : voice));
      return;
    }

    const newAudio = new Audio(spare.recording.file);
    audioRefs.current[idx] = newAudio;
    retryCountsRef.current[idx] = 0;
    intervalsRef.current[idx] = MAX_INTERVAL_MS;

    setVoices(v => v.map((voice, vi) => vi === idx ? {
      recording: spare.recording,
      sciName: spare.sciName,
      howMany: spare.howMany,
      intervalMs: MAX_INTERVAL_MS,
      isActive: false,
      isLoading: true,
      isFailed: false,
      photo: null,
    } : voice));

    attachAudioListeners(newAudio, idx);

    void fetchBirdPhoto(spare.sciName).catch(() => null).then(photo => {
      if (!cancelled) {
        setVoices(v => v.map((voice, vi) =>
          vi === idx ? { ...voice, photo: photo ?? null } : voice,
        ));
      }
    });

    if (isPlayingRef.current) {
      timersRef.current.push(
        setTimeout(() => startVoice(idx), Math.random() * INITIAL_STAGGER_MS),
      );
    }
  }

  function attachAudioListeners(audio: HTMLAudioElement, idx: number) {
    audio.addEventListener('canplay', () => {
      if (cancelled) return;
      setVoices(v => v.map((voice, vi) => vi === idx ? { ...voice, isLoading: false } : voice));
    }, { once: true } as AddEventListenerOptions);

    audio.addEventListener('error', () => {
      if (cancelled) return;
      const retries = retryCountsRef.current[idx] ?? 0;
      if (retries < MAX_AUDIO_RETRIES) {
        retryCountsRef.current[idx] = retries + 1;
        setTimeout(() => {
          if (cancelled) return;
          const a = audioRefs.current[idx];
          if (!a) return;
          a.src = a.src;
          a.load();
          attachAudioListeners(a, idx);
        }, RETRY_DELAY_MS);
      } else {
        replaceFailedVoice(idx);
      }
    }, { once: true } as AddEventListenerOptions);
  }

  audioRefs.current.forEach((audio, idx) => {
    attachAudioListeners(audio, idx);
  });

  void Promise.all(
    selected.map(s => fetchBirdPhoto(s.sciName).catch(() => null)),
  ).then(photos => {
    if (cancelled) return;
    setVoices(v => v.map((voice, i) => ({ ...voice, photo: photos[i] ?? null })));
  });

  return () => { cancelled = true; };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [recordingsKey, recentObsKey, stopAll]);
```

- [ ] **Step 7: Run the useSoundscape tests**

```bash
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: all tests PASS including the 4 new ones.

- [ ] **Step 8: Filter `isFailed` voices in `SoundscapeGrid.tsx`**

In `src/components/SoundscapeGrid.tsx`, the map currently reads:

```tsx
{voices.map(voice => (
```

Change to:

```tsx
{voices.filter(v => !v.isFailed).map(voice => (
```

- [ ] **Step 9: Update `makeVoice` in `SoundscapeGrid.test.tsx` and add a new test**

In `src/components/SoundscapeGrid.test.tsx`, update the `makeVoice` helper to include `isFailed: false`:

```typescript
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
    isFailed: false,
    photo: null,
    ...overrides,
  };
}
```

Add a test for the isFailed filter at the bottom of the `describe('SoundscapeGrid')` block:

```typescript
it('does not render failed voices', () => {
  const rec2: XCRecording = {
    id: '2', gen: 'Parus', sp: 'major', en: 'Great Tit',
    rec: 'Jane', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
    type: 'song', q: 'A', file: 'https://xc.org/2.mp3', date: '2024-01-01',
    'file-name': '2.mp3', sono: { small: 'https://xc.org/sono2.png', med: 'https://xc.org/sonom.png' },
  };
  const voices = [
    makeVoice({ isFailed: true }),
    makeVoice({ recording: rec2, sciName: 'Parus major', isFailed: false }),
  ];
  const { container } = render(<SoundscapeGrid voices={voices} />);
  expect(container.textContent).not.toContain('American Robin');
  expect(container.textContent).toContain('Great Tit');
});
```

- [ ] **Step 10: Run all modified test files**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx src/hooks/useSoundscape.test.ts
```

Expected: all tests PASS.

- [ ] **Step 11: Run the full test suite and build**

```bash
npm test && npm run build
```

Expected: all tests PASS, build succeeds with no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add src/hooks/useSoundscape.ts src/hooks/useSoundscape.test.ts \
        src/components/SoundscapeGrid.tsx src/components/SoundscapeGrid.test.tsx
git commit -m "feat: XC audio retry with spare-pool voice replacement on failure"
```

---

### Task 3: Wikipedia Summary + eBird Link in SpeciesDetail

**Files:**
- Create: `src/api/wikipedia.ts`
- Create: `src/api/wikipedia.test.ts`
- Modify: `src/components/SpeciesDetail.tsx`
- Modify: `src/components/SpeciesDetail.test.tsx`

**Interfaces:**
- Produces from `wikipedia.ts`:
  ```typescript
  export interface WikiSummary {
    extract: string;   // plain-text summary paragraph
    pageUrl: string;   // desktop Wikipedia article URL
  }

  export async function fetchWikiSummary(name: string): Promise<WikiSummary | null>
  ```
- `SpeciesDetail` gains no new props; internal state changes only.

**Wikipedia API endpoint:** `GET https://en.wikipedia.org/api/rest_v1/page/summary/{encodedName}` — no API key, CORS-friendly.

Response shape used:
```json
{
  "extract": "The American Robin is…",
  "content_urls": { "desktop": { "page": "https://en.wikipedia.org/wiki/American_robin" } }
}
```

**Fallback strategy in `SpeciesDetail`:** try `obs.comName` first, then `obs.sciName` if the first returns null. If both return null, omit the Wikipedia section entirely (eBird link still shows).

- [ ] **Step 1: Create `src/api/wikipedia.ts`**

```typescript
const WIKI_API = 'https://en.wikipedia.org/api/rest_v1';

export interface WikiSummary {
  extract: string;
  pageUrl: string;
}

export async function fetchWikiSummary(name: string): Promise<WikiSummary | null> {
  try {
    const res = await fetch(`${WIKI_API}/page/summary/${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const data = await res.json() as {
      extract: string;
      content_urls: { desktop: { page: string } };
    };
    return { extract: data.extract, pageUrl: data.content_urls.desktop.page };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write failing tests — create `src/api/wikipedia.test.ts`**

```typescript
import { fetchWikiSummary } from './wikipedia';

const mockFetch = vi.fn();
(global as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchWikiSummary', () => {
  it('returns extract and pageUrl on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        extract: 'The American Robin is a migratory songbird.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/American_robin' } },
      }),
    });
    const result = await fetchWikiSummary('American Robin');
    expect(result).toEqual({
      extract: 'The American Robin is a migratory songbird.',
      pageUrl: 'https://en.wikipedia.org/wiki/American_robin',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://en.wikipedia.org/api/rest_v1/page/summary/American%20Robin',
    );
  });

  it('returns null on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchWikiSummary('Nonexistent Bird');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchWikiSummary('American Robin');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run the wikipedia tests to confirm they fail**

```bash
npx vitest run src/api/wikipedia.test.ts
```

Expected: tests FAIL because `wikipedia.ts` is not yet implemented (if created after tests) — actually since we created `wikipedia.ts` first in Step 1, the tests should PASS here. Verify they do.

Expected output: 3/3 PASS.

- [ ] **Step 4: Add SpeciesDetail tests**

In `src/components/SpeciesDetail.test.tsx`, add the `fetchWikiSummary` mock and new tests.

At the top of the file, add `fetchWikiSummary` to the imports section:

```typescript
import { fetchWikiSummary } from '../api/wikipedia';
```

Add a new `vi.mock` call after the existing mock declarations:

```typescript
vi.mock('../api/wikipedia', () => ({ fetchWikiSummary: vi.fn() }));
```

In the `beforeEach` block, add the default mock return:

```typescript
vi.mocked(fetchWikiSummary).mockResolvedValue(null);
```

The full updated `beforeEach` becomes:

```typescript
beforeEach(() => {
  vi.mocked(fetchBirdPhoto).mockResolvedValue(null);
  vi.mocked(fetchTaxonomy).mockResolvedValue([]);
  vi.mocked(fetchWikiSummary).mockResolvedValue(null);
});
```

Add these tests inside the `describe('SpeciesDetail')` block, after the existing tests:

```typescript
it('shows Wikipedia extract when summary is available', async () => {
  vi.mocked(fetchWikiSummary).mockResolvedValue({
    extract: 'The American Robin is a migratory thrush.',
    pageUrl: 'https://en.wikipedia.org/wiki/American_robin',
  });
  await act(async () => {
    render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
  });
  expect(screen.getByText('The American Robin is a migratory thrush.')).toBeInTheDocument();
});

it('shows Wikipedia link when summary is available', async () => {
  vi.mocked(fetchWikiSummary).mockResolvedValue({
    extract: 'A bird.',
    pageUrl: 'https://en.wikipedia.org/wiki/American_robin',
  });
  await act(async () => {
    render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
  });
  const wikiLink = screen.getByText('Wikipedia ↗');
  expect(wikiLink).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/American_robin');
});

it('always shows eBird link', async () => {
  await act(async () => {
    render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
  });
  const ebirdLink = screen.getByText('eBird ↗');
  expect(ebirdLink).toHaveAttribute('href', 'https://ebird.org/species/amerob');
});

it('omits Wikipedia section when summary is null', async () => {
  vi.mocked(fetchWikiSummary).mockResolvedValue(null);
  await act(async () => {
    render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
  });
  expect(screen.queryByText('Wikipedia ↗')).toBeNull();
});
```

- [ ] **Step 5: Run the SpeciesDetail tests to confirm new ones fail**

```bash
npx vitest run src/components/SpeciesDetail.test.tsx
```

Expected: the 4 new tests FAIL, existing tests PASS.

- [ ] **Step 6: Update `SpeciesDetail.tsx`**

Add the import for `WikiSummary` type and `fetchWikiSummary` function. The file currently has these imports:

```typescript
import { useState, useEffect } from 'react';
import type { JSX } from 'react';
import type { EBirdObservation, EBirdTaxon } from '../api/ebird';
import { fetchTaxonomy } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import { fetchBirdPhoto } from '../api/inat';
import type { XCRecording } from '../api/xeno-canto';
import { bestRecording } from '../utils/species';
import { Skeleton } from './Skeleton';
```

Add after the last existing import:

```typescript
import type { WikiSummary } from '../api/wikipedia';
import { fetchWikiSummary } from '../api/wikipedia';
```

Add `wikiSummary` state after the existing state declarations:

```typescript
const [wikiSummary, setWikiSummary] = useState<WikiSummary | null>(null);
```

Replace the existing `useEffect` (lines 22-31) with:

```typescript
useEffect(() => {
  let cancelled = false;
  setLoading(true);
  Promise.all([
    fetchBirdPhoto(obs.sciName),
    fetchTaxonomy([obs.speciesCode]),
    fetchWikiSummary(obs.comName).then(r => r ?? fetchWikiSummary(obs.sciName)),
  ])
    .then(([p, taxa, wiki]) => {
      if (!cancelled) {
        setPhoto(p);
        setTaxon(taxa[0] ?? null);
        setWikiSummary(wiki);
        setLoading(false);
      }
    })
    .catch(() => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
}, [obs.sciName, obs.speciesCode, obs.comName]);
```

Add the Wikipedia description block after the taxonomy section and before the observation data section. Find the taxonomy block:

```tsx
{/* Taxonomy */}
{taxon && (
  <div className="px-4 py-1 text-xs text-gray-500">
    {taxon.order} · {taxon.familyComName}
  </div>
)}
```

After it, insert:

```tsx
{/* Wikipedia summary */}
{wikiSummary && (
  <div className="px-4 py-2 border-t border-gray-100">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Wikipedia</p>
    <p className="text-sm text-gray-700 leading-relaxed">{wikiSummary.extract}</p>
  </div>
)}
```

Add the external links block before the photo attribution section. Find:

```tsx
{/* Photo attribution */}
{photo && (
  <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
    <p>{photo.attribution}</p>
  </div>
)}
```

Before it, insert:

```tsx
{/* External links */}
<div className="px-4 py-3 flex gap-2 border-t border-gray-100">
  {wikiSummary && (
    <a
      href={wikiSummary.pageUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
    >
      Wikipedia ↗
    </a>
  )}
  <a
    href={`https://ebird.org/species/${obs.speciesCode}`}
    target="_blank"
    rel="noopener noreferrer"
    className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 font-medium"
  >
    eBird ↗
  </a>
</div>
```

- [ ] **Step 7: Run the SpeciesDetail tests**

```bash
npx vitest run src/components/SpeciesDetail.test.tsx
```

Expected: all tests PASS, including the 4 new ones.

- [ ] **Step 8: Run the full test suite and build**

```bash
npm test && npm run build
```

Expected: all tests PASS, build succeeds with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/api/wikipedia.ts src/api/wikipedia.test.ts \
        src/components/SpeciesDetail.tsx src/components/SpeciesDetail.test.tsx
git commit -m "feat: add Wikipedia summary and eBird link to species detail panel"
```
