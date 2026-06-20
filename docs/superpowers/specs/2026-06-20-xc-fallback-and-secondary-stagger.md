# Spec: XC Recording Fallback and Secondary Voice Stagger

**Date:** 2026-06-20
**Scope:** Supplement sparse XC bbox results with per-species queries using eBird data; stagger secondary soundscape voices into a tighter, more natural window after the first three.

---

## Summary

Two improvements:

1. **XC fallback** — When the geographic bounding-box query to Xeno-canto returns fewer than 12 distinct species (the active + spare pool target), query XC by scientific name for each eBird species not yet covered, prioritising the most-commonly-observed species first. Results are merged into the existing recordings before being passed to the soundscape hook. Quality selection (A › B › C › D › E, song › call) is already handled downstream by `selectVoices`.

2. **Secondary stagger** — Voices 3–7 currently receive an initial delay equal to their full `intervalMs` (up to 30 s), causing them to arrive all at once, very late. Change their startup delay to a random value in **[4 s, 9 s]** from the moment play is pressed (i.e. 1–6 s after the initial group's 3-second window closes), spreading them naturally across the first several seconds.

---

## Architecture

### Files modified / created

| File | Change |
|---|---|
| `src/utils/soundscape-recordings.ts` | **Create** — `fillRecordingGaps(existing, recentObs, target)` |
| `src/utils/soundscape-recordings.test.ts` | **Create** — unit tests for the utility |
| `src/components/MapView.tsx` | Replace `setRecordings(xcRes.recordings)` with the enriched result |
| `src/hooks/useSoundscape.ts` | Add `SECONDARY_STAGGER_MIN_MS`, `SECONDARY_STAGGER_MAX_MS`; update `toggle()` |
| `src/hooks/useSoundscape.test.ts` | Add tests for secondary stagger timing |

---

## 1. XC Recording Fallback (`soundscape-recordings.ts`)

### Interface

```typescript
import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import { fetchRecordings } from '../api/xeno-canto';

export async function fillRecordingGaps(
  existing: XCRecording[],
  recentObs: EBirdObservation[],
  target: number,
): Promise<XCRecording[]>
```

### Algorithm

1. Build `coveredSciNames: Set<string>` from `existing` using `` `${r.gen} ${r.sp}` `` (matches the format `selectVoices` uses).
2. If `coveredSciNames.size >= target` → return `existing` unchanged (fast-path, no extra network calls).
3. Compute gap count: `needed = target - coveredSciNames.size`.
4. Find gap species: filter `recentObs` to entries whose `obs.sciName` is not in `coveredSciNames`, sort by `obs.howMany` descending (most-observed first), take the top `needed` entries.
5. Fetch recordings in parallel: `Promise.all(gapSpecies.map(obs => fetchRecordings(obs.sciName).catch(() => null)))`. Individual failures return `null` — one 503 should not kill the whole batch.
6. Flatten non-null results' `.recordings` arrays, concatenate with `existing`, and return the merged array.

### Notes

- `fetchRecordings(obs.sciName)` queries XC globally with the exact scientific name (e.g. `"Turdus migratorius"`). Results from anywhere in the world are acceptable — quality is filtered downstream.
- The returned array may contain recordings for a species that already appears in `existing` (different recordings). `selectVoices` deduplicates to one recording per species and picks the highest quality, so duplicates are harmless.
- No cap on individual per-species page sizes; `selectVoices` takes only the best recording per species regardless of how many come back.

### MapView change

In `fetchForPin` (`src/components/MapView.tsx`), after the existing `Promise.all`:

```typescript
// Before
setRecordings(xcRes.recordings);

// After
import { fillRecordingGaps } from '../utils/soundscape-recordings';
import { MAX_VOICES, SPARE_VOICES } from '../hooks/useSoundscape';
// ...
const recordings = await fillRecordingGaps(xcRes.recordings, recent, MAX_VOICES + SPARE_VOICES);
setRecordings(recordings);
```

The parallel phase (`Promise.all` for eBird notable + recent + XC bbox) remains unchanged. The gap-fill is a sequential step that only fires extra requests when needed.

### Tests (`soundscape-recordings.test.ts`)

Mock `fetchRecordings` from `../api/xeno-canto`.

- Returns `existing` unchanged when `coveredSciNames.size >= target` (no extra `fetchRecordings` calls)
- Calls `fetchRecordings` for each gap species in order of howMany descending
- Merges gap recordings into the returned array
- Skips a species whose `fetchRecordings` call rejects (returns null from catch) without throwing
- Returns `existing` unchanged when `recentObs` is empty and existing already covers zero species but target is also 0 (edge: target=0 fast-paths immediately)

---

## 2. Secondary Voice Stagger (`useSoundscape.ts`)

### New constants

```typescript
export const SECONDARY_STAGGER_MIN_MS = 1_000;
export const SECONDARY_STAGGER_MAX_MS = 6_000;
```

### Updated `toggle()` delay logic

```typescript
const delay = i < INITIAL_VOICES
  ? Math.random() * INITIAL_STAGGER_MS
  : INITIAL_STAGGER_MS
    + SECONDARY_STAGGER_MIN_MS
    + Math.random() * (SECONDARY_STAGGER_MAX_MS - SECONDARY_STAGGER_MIN_MS);
```

| Voice index | Delay from play press |
|---|---|
| 0–2 (initial) | 0–3 s (unchanged) |
| 3–7 (secondary) | 4–9 s |

The 1 s floor (`SECONDARY_STAGGER_MIN_MS`) ensures a secondary voice cannot fire at the same moment as the last initial voice.

### Tests (`useSoundscape.test.ts`)

Add to the existing `'useSoundscape — audio tuning'` describe block:

```typescript
it('secondary voices do not fire before INITIAL_STAGGER_MS + SECONDARY_STAGGER_MIN_MS', async () => {
  const recs = [
    makeRec({ gen: 'Sp', sp: 'a', id: '1' }),
    makeRec({ gen: 'Sp', sp: 'b', id: '2' }),
    makeRec({ gen: 'Sp', sp: 'c', id: '3' }),
    makeRec({ gen: 'Sp', sp: 'd', id: '4' }),
  ];
  const obs = [makeObs('Sp a', 10), makeObs('Sp b', 9), makeObs('Sp c', 8), makeObs('Sp d', 1)];
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
  const obs = [makeObs('Sp a', 10), makeObs('Sp b', 9), makeObs('Sp c', 8), makeObs('Sp d', 1)];
  const { result } = renderHook(() => useSoundscape(recs, obs));
  await act(async () => { await vi.runAllTimersAsync(); });

  act(() => { result.current.toggle(); });
  // Advance past the latest any secondary voice can fire (INITIAL + MAX + buffer)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + SECONDARY_STAGGER_MAX_MS + 500);
  });
  expect(audioInstances[3].play).toHaveBeenCalled();
});
```

These two tests bracket the secondary stagger window deterministically: the first passes regardless of `Math.random()` because no delay can be less than `INITIAL_STAGGER_MS + SECONDARY_STAGGER_MIN_MS`; the second passes regardless of `Math.random()` because no delay can exceed `INITIAL_STAGGER_MS + SECONDARY_STAGGER_MAX_MS`.

---

## Definition of Done

- Dropping a pin in a sparse XC area (e.g. remote location with 0 bbox recordings) results in audible birds as long as eBird returned any nearby observations
- All 8 soundscape voices (when available) come in within the first 9 seconds of pressing play
- `npm run build` clean, `npm test` passes
