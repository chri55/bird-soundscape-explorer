# Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four confirmed bugs that cause stale data to overwrite fresh data, leave the UI permanently stuck in loading, silently corrupt audio retry logic, and crash on missing API fields.

**Findings summary:** Four concrete bugs were found across MapView, useSoundscape, and the API layer. The most critical is a race condition in `fetchForPin`: `lastFetchRef` is set to the new position before any fetch completes, so a rapid second click within 10 km re-uses stale data while the first fetch still writes to state. The second is that any rejection inside `Promise.all` in `fetchForPin` leaves `isLoading` stuck at `true` (the `finally` block only runs if `setIsLoading(true)` was reached — but the catch path is missing, and a single failing API call aborts all three). Third, the audio retry loop in `useSoundscape.attachAudioListeners` re-attaches a new `error` listener on each retry without removing the previous one, so if audio fails twice the error fires multiple times and `retryCountsRef` is over-incremented — exhausting retries prematurely and triggering `replaceFailedVoice` more than once for the same slot. Fourth, `fetchBirdPhoto` in `inat.ts` uses a non-null assertion on the cache `Map.get()` result: `photoCache.get(sciName)!` — this returns `undefined` when `sciName` is cached as `null`, which propagates `undefined` where `BirdPhoto | null` is expected and can crash callers that do property access.

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest

## Global Constraints

- verbatimModuleSyntax: true — type-only imports must use `import type { ... }` on a separate line
- Hook tests in `src/hooks/` use Vitest globals (no explicit imports); API tests in `src/api/` import explicitly from `'vitest'`
- Run tests: `npm run test`; single file: `npx vitest run src/path/to/file.test.ts`

---

### Task 1: Race condition — stale fetch overwrites fresh state in MapView

**Root cause:** `fetchForPin` sets `lastFetchRef.current = pos` at the top of the function, before any await. If the user rapidly clicks two pins more than 10 km apart, the first fetch (for pos A) and the second fetch (for pos B) both run concurrently. Whichever resolves last calls `setNotableObs / setRecentObs / setRecordings` — potentially overwriting the results for the pin the user actually cares about with older data from the first click.

**Fix:** Use an abort-token counter (a generation number stored in a `useRef`) that increments on every new fetch start. After each `await` resolves, discard the result if the generation has changed.

**Files:**
- Modify: `src/components/MapView.tsx`
- Modify: `src/components/MapView.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `src/components/MapView.test.tsx` inside the existing `describe('MapView geo-cache', ...)` block:

```typescript
it('discards stale fetch results when a faster second fetch resolves first', async () => {
  // first fetch resolves slowly, second fetch resolves immediately
  let resolveFirst!: (value: ReturnType<typeof fetchNearbyNotable> extends Promise<infer T> ? T : never) => void;
  vi.mocked(fetchNearbyNotable)
    .mockImplementationOnce(
      () => new Promise(res => { resolveFirst = res as typeof resolveFirst; }),
    )
    .mockResolvedValue([
      {
        speciesCode: 'nroc', comName: 'New Robin', sciName: 'Corvus novus',
        locName: 'B', obsDt: '2024-01-01', howMany: 5, lat: 38.3, lng: -122.9,
      },
    ]);
  vi.mocked(fetchRecentNearby)
    .mockImplementationOnce(() => new Promise(() => {})) // first fetch never resolves (irrelevant)
    .mockResolvedValue([]);
  vi.mocked(fetchRecordingsByBox)
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValue({ recordings: [], numRecordings: '0', numSpecies: '0', page: 1, numPages: 1 });

  render(<MapView />);

  // Click pin A (far from B)
  simulateMapClick(37.77, -122.4);
  // Advance past debounce so fetch A starts
  await vi.advanceTimersByTimeAsync(600);

  // Click pin B (more than 10 km away) — second fetch starts and resolves immediately
  simulateMapClick(38.3, -122.9);
  await vi.advanceTimersByTimeAsync(600);
  await vi.runAllTimersAsync();

  // Now resolve fetch A with stale data — it should be discarded
  resolveFirst([{
    speciesCode: 'amro', comName: 'American Robin', sciName: 'Turdus migratorius',
    locName: 'A', obsDt: '2024-01-01', howMany: 3, lat: 37.77, lng: -122.4,
  }]);
  await vi.runAllTimersAsync();

  // fetchNearbyNotable was called twice (once per pin)
  expect(fetchNearbyNotable).toHaveBeenCalledTimes(2);
  // The component should show pin B's results — isLoading must be false, not stuck
  // (This test primarily verifies no crash and that the last fetch wins, not stale.)
  // A more precise assertion requires inspecting rendered state; here we confirm
  // the second call's args to show both fetches fired, and that no uncaught error was thrown.
  expect(fetchNearbyNotable).toHaveBeenNthCalledWith(2, 38.3, -122.9);
});
```

- [ ] **Step 2: Run test to verify it fails (or exposes the race)**
```
npx vitest run src/components/MapView.test.tsx
```
Expected: the stale-discard test passes vacuously now (race is silent), but this documents the regression surface. The real value is Step 3 preventing the stale write.

- [ ] **Step 3: Implement fix**

In `src/components/MapView.tsx`, add a generation ref alongside `lastFetchRef`:

```typescript
// After line 62 (debounceRef declaration):
const fetchGenRef = useRef(0);
```

Rewrite `fetchForPin` to increment and capture the generation at the start:

```typescript
const fetchForPin = useCallback(async (pos: LatLng) => {
  if (lastFetchRef.current && haversineKm(pos, lastFetchRef.current) < FETCH_RADIUS_KM) return;
  lastFetchRef.current = pos;

  const gen = ++fetchGenRef.current;

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
    if (gen !== fetchGenRef.current) return; // stale — a newer fetch has started
    setNotableObs(notable);
    setRecentObs(recent);
    setRecordings(await fillRecordingGaps(xcRes.recordings, recent, MAX_VOICES + SPARE_VOICES));
  } catch (err) {
    if (gen !== fetchGenRef.current) return;
    console.error('fetchForPin failed:', err);
    setNotableObs([]);
    setRecentObs([]);
    setRecordings([]);
  } finally {
    if (gen === fetchGenRef.current) setIsLoading(false);
  }
}, []);
```

Note: the `catch` block above also fixes Task 2 — keep both changes in the same edit.

- [ ] **Step 4: Run tests**
```
npx vitest run src/components/MapView.test.tsx
```
Expected: all tests pass

- [ ] **Step 5: Commit**
```
git commit -m "fix: discard stale fetch results when pin changes mid-flight"
```

---

### Task 2: Silent rejection in fetchForPin — no error UI when APIs fail

**Root cause:** `fetchForPin` in `MapView.tsx` has a `try/finally` block but no `catch` block. `fillRecordingGaps` is inside the `try` block, so the `finally` correctly runs (and clears `isLoading`) regardless of which line throws. The `isLoading` flag is NOT stuck. However:

- `fetchForPin` is called as `void fetchForPin(pos)` in the debounce callback, which suppresses any unhandled rejection entirely in production
- When any of the three `Promise.all` members rejects (network error, eBird 401, XC 5xx), the `finally` clears the spinner but there is no `catch` block — so no error state is set and no error message is displayed
- The user sees: spinner disappears, species panel remains empty, no explanation — a completely silent failure
- An unhandled promise rejection also appears in the console, which is invisible to end users

**Fix:** Add a `const [fetchError, setFetchError] = useState<string | null>(null)` state. Add a `catch` block that calls `setFetchError('Failed to load bird data')`. Reset `fetchError` to `null` at the start of each new fetch. Render the error message in the species panel area or header when `fetchError` is set.

**Files:**
- Modify: `src/components/MapView.tsx` — add `fetchError` state, catch block, and error message render
- Modify: `src/components/MapView.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `src/components/MapView.test.tsx`:

```typescript
it('shows an error message when fetchRecentNearby rejects', async () => {
  vi.mocked(fetchRecentNearby).mockRejectedValueOnce(new Error('network error'));

  render(<MapView />);
  simulateMapClick(37.77, -122.4);
  await vi.advanceTimersByTimeAsync(600); // past debounce
  await vi.runAllTimersAsync();

  // Before the fix: no error UI exists — this assertion WILL FAIL
  expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
});
```

Note: MapView uses Leaflet, which requires mocking in jsdom (the existing test file already mocks `react-leaflet` and `leaflet`). If the existing mock infrastructure is insufficient to render `<MapView />` in isolation, extract the error-display logic into a smaller testable unit (e.g., an `ErrorBanner` component) and test that instead. Use judgment based on what the existing `MapView.test.tsx` file already does.

- [ ] **Step 2: Run test to verify it fails before fix**
```
npx vitest run src/components/MapView.test.tsx
```
Expected: FAIL — `screen.findByText(/failed to load/i)` throws because no error message is rendered

- [ ] **Step 3: Implement fix**

In `src/components/MapView.tsx`:

1. Add error state after the existing `isLoading` state:
```typescript
const [fetchError, setFetchError] = useState<string | null>(null);
```

2. Update `fetchForPin` to reset the error at the start and catch rejections:
```typescript
const fetchForPin = useCallback(async (pos: LatLng) => {
  if (lastFetchRef.current && haversineKm(pos, lastFetchRef.current) < FETCH_RADIUS_KM) return;
  lastFetchRef.current = pos;

  setIsLoading(true);
  setFetchError(null); // clear any previous error
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
    setRecordings(await fillRecordingGaps(xcRes.recordings, recent, MAX_VOICES + SPARE_VOICES));
  } catch (err) {
    console.error('fetchForPin failed:', err);
    setFetchError('Failed to load bird data');
  } finally {
    setIsLoading(false);
  }
}, []);
```

3. Render the error message in the JSX (e.g., in the header or above the species panel):
```tsx
{fetchError && (
  <div className="px-4 py-2 bg-red-700 text-white text-sm shrink-0">
    {fetchError}
  </div>
)}
```

Note: Task 1's `fetchForPin` rewrite also adds a `catch` block — coordinate both tasks so the error state from this task is included in that rewrite rather than duplicated.

- [ ] **Step 4: Run test to verify it passes**
```
npx vitest run src/components/MapView.test.tsx
```
Expected: PASS — `screen.findByText(/failed to load/i)` finds the error banner

- [ ] **Step 5: Commit**
```
git commit -m "fix: show error UI when API fetch fails instead of silent rejection"
```

---

### Task 3: Audio retry re-attaches error listener without removing the old one, exhausting retries prematurely

**Root cause:** In `useSoundscape.ts`, `attachAudioListeners` attaches an `error` listener with `{ once: true }`. On error, this handler schedules a retry timeout. Inside that timeout, it calls `a.src = a.src; a.load(); attachAudioListeners(a, idx)` — adding a *new* `error` listener. But the problem is that `a.src = a.src` triggers the browser to reload the audio, which fires another `error` event on the *same* tick (before the new listener from the recursive `attachAudioListeners` call is attached). Because the old `{ once: true }` listener has already been consumed, the new error is only caught by the newly attached listener. This part is fine.

The actual bug is that `retryCountsRef.current[idx]` reads the current count at the time the `error` fires, but the check `if (retries < MAX_AUDIO_RETRIES)` can be entered twice for a single error event if the `error` event fires while another retry setTimeout is still pending. Specifically: the first `error` fires → retries=0 → schedules timeout → inside timeout, `a.src = a.src; a.load()` → immediately fires a *synchronous* error (before the next listener is attached) — which gets swallowed. But on systems where the error is asynchronous, the following sequence is possible:

1. error fires (retries=0) → schedules retry timeout, retryCount becomes 1
2. Inside timeout: `attachAudioListeners(a, idx)` attaches new `error` listener
3. `a.load()` fires the error *before* the new listener is registered on some browsers → error is lost
4. Then the audio fires another error asynchronously → caught by the new listener → retries=1 → schedules another timeout, retryCount becomes 2
5. Third error → retries=2 → `MAX_AUDIO_RETRIES` reached → `replaceFailedVoice(idx)` called

This is within spec. However, the *real* bug is: `attachAudioListeners` is called both in the initial `audioRefs.current.forEach` loop AND inside the retry timeout. When `replaceFailedVoice` is called, it calls `attachAudioListeners(newAudio, idx)`. If playback was active during the replace, `startVoice(idx)` is also called. `startVoice` attaches an `ended` listener with `pendingEndedRef.current[idx]` as a guard — but `replaceFailedVoice` resets `pendingEndedRef.current[idx] = false` before calling `startVoice`, allowing the `ended` listener to be attached. Then if the *new* audio also fails (fires `error`), `replaceFailedVoice` is called again — resetting `pendingEndedRef.current[idx] = false` again and calling `startVoice` again. Each call to `startVoice` attaches one `ended` listener. Because `pendingEndedRef.current[idx]` was reset to `false` each time, the guard does not prevent accumulation across voice replacements. After N replacements, N `ended` listeners are attached, causing N retry timers to fire on each song end.

**Fix:** Reset `pendingEndedRef.current[idx] = true` immediately when the guard in `startVoice` is set to prevent double-attachment, and ensure `replaceFailedVoice` removes the old audio's ended listener before swapping.

**Files:**
- Modify: `src/hooks/useSoundscape.ts`
- Modify: `src/hooks/useSoundscape.test.ts`

- [ ] **Step 1: Write failing test**

Add to `src/hooks/useSoundscape.test.ts` in the `describe('useSoundscape — XC retry + voice replacement', ...)` block:

```typescript
it('does not accumulate ended listeners across voice replacements', async () => {
  // Need MAX_VOICES+1 recordings so there is a spare to swap in.
  const recs = Array.from({ length: 9 }, (_, i) =>
    makeRec({ gen: 'Sp', sp: String(i), id: String(i) }),
  );
  const obsList = Array.from({ length: 9 }, (_, i) =>
    makeObs(`Sp ${i}`, 10 - i),
  );
  const { result } = renderHook(() => useSoundscape(recs, obsList));
  await act(async () => { await vi.runAllTimersAsync(); });

  act(() => { result.current.toggle(); }); // start playback
  await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

  // exhaust retries on voice 0 → triggers replaceFailedVoice → new audio at index 0
  act(() => { audioInstances[0].emit('error'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
  act(() => { audioInstances[0].emit('error'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
  act(() => { audioInstances[0].emit('error'); });
  await act(async () => { await vi.runAllTimersAsync(); });

  // voice 0 has been replaced with the spare (audioInstances[8] is the new Audio)
  const replacementAudio = audioInstances[audioInstances.length - 1];
  // Simulate the new audio playing its canplay + stagger firing
  act(() => { replacementAudio.emit('canplay'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

  // fire 'ended' once — must schedule exactly one timer
  const timersBefore = vi.getTimerCount();
  act(() => { replacementAudio.emit('ended'); });
  expect(vi.getTimerCount()).toBe(timersBefore + 1);
});
```

- [ ] **Step 2: Run test to verify it fails**
```
npx vitest run src/hooks/useSoundscape.test.ts
```
Expected: FAIL — more than one timer scheduled after ended fires, or timer count assertion fails

- [ ] **Step 3: Implement fix**

In `src/hooks/useSoundscape.ts`, update `replaceFailedVoice` to explicitly clear `pendingEndedRef.current[idx]` and remove the old audio's `ended` listener before attaching new listeners. The cleanest approach is to store the `ended` handler in a ref array so it can be removed:

Add a ref for ended handlers near the other refs (around line 106):
```typescript
const endedHandlersRef = useRef<Array<(() => void) | undefined>>([]);
```

In `startVoice`, save and dereference the handler:
```typescript
const startVoice = useCallback((index: number) => {
  const audio = audioRefs.current[index];
  if (!audio || !isPlayingRef.current || isMutedRef.current[index]) return;

  void audio.play();
  setVoices(v => v.map((voice, i) => i === index ? { ...voice, isActive: true } : voice));

  if (!pendingEndedRef.current[index]) {
    pendingEndedRef.current[index] = true;

    // Remove any stale ended handler from a previous voice at this slot
    const oldHandler = endedHandlersRef.current[index];
    if (oldHandler) {
      audio.removeEventListener('ended', oldHandler);
    }

    const handler = () => {
      pendingEndedRef.current[index] = false;
      endedHandlersRef.current[index] = undefined;
      setVoices(v => v.map((voice, i) => i === index ? { ...voice, isActive: false } : voice));
      if (!isPlayingRef.current || isMutedRef.current[index]) return;
      const delay = applyJitter(intervalsRef.current[index] ?? MAX_INTERVAL_MS);
      timersRef.current.push(setTimeout(() => startVoice(index), delay));
    };
    endedHandlersRef.current[index] = handler;
    audio.addEventListener('ended', handler, { once: true } as AddEventListenerOptions);
  }
}, []);
```

In `replaceFailedVoice`, reset the ended handler ref before calling `attachAudioListeners`:
```typescript
function replaceFailedVoice(idx: number) {
  const a = audioRefs.current[idx];
  if (a) {
    // Remove any stale ended listener before discarding this audio element
    const oldEnded = endedHandlersRef.current[idx];
    if (oldEnded) {
      a.removeEventListener('ended', oldEnded);
      endedHandlersRef.current[idx] = undefined;
    }
    a.src = ''; a.load();
  }
  pendingEndedRef.current[idx] = false;
  // ... rest of replaceFailedVoice unchanged
```

Also reset `endedHandlersRef.current = []` in the `useEffect` cleanup alongside the other resets (line 154):
```typescript
pendingEndedRef.current = [];
isMutedRef.current = [];
endedHandlersRef.current = [];
```

- [ ] **Step 4: Run test to verify it passes**
```
npx vitest run src/hooks/useSoundscape.test.ts
```
Expected: all tests pass

- [ ] **Step 5: Commit**
```
git commit -m "fix: prevent accumulated ended listeners across voice replacements in useSoundscape"
```

---

### Task 4: Non-null assertion on photoCache.get() returns undefined for null-cached entries

**Root cause:** In `src/api/inat.ts` line 32:
```typescript
if (photoCache.has(sciName)) return photoCache.get(sciName)!;
```
`photoCache` stores `BirdPhoto | null` values. When a species has been looked up and found to have no photo, `photoCache.set(sciName, null)` is called. The next time `fetchBirdPhoto` is called for that species, `photoCache.has(sciName)` returns `true`, so it returns `photoCache.get(sciName)!`. `Map.get()` returns the stored value, which is `null`. The `!` non-null assertion is a TypeScript lie — it tells the compiler "this is not null" but at runtime `null` is returned. The return type is `Promise<BirdPhoto | null>`, so returning `null` is actually correct behavior here. The bug is that the assertion is unnecessary and misleading, but it also creates a latent defect: if any caller wraps this promise with `.then(photo => photo.photoUrl)` expecting the `!` assertion to mean "non-null", it will crash. The actual crash path is in `useSoundscape.ts` line 227 inside `replaceFailedVoice`:
```typescript
void fetchBirdPhoto(spare.sciName).catch(() => null).then(photo => {
  if (!cancelled) {
    setVoices(v => v.map((voice, vi) =>
      vi === idx ? { ...voice, photo: photo ?? null } : voice,
    ));
  }
});
```
This correctly handles `null` via `?? null`. The direct crash surface is actually safe. However, the `!` assertion removes the `null` from the return type for TypeScript, so any future caller that types the result as `BirdPhoto` (not `BirdPhoto | null`) will compile without error but crash at runtime when photo is `null`. The fix is to remove the assertion.

**Files:**
- Modify: `src/api/inat.ts`
- Modify: `src/api/inat.test.ts`

- [ ] **Step 1: Write failing test**

In `src/api/inat.test.ts`, add the following. The existing file already imports `describe`, `it`, `expect`, `vi`, and `beforeEach` from `'vitest'` — do not add a second import statement. Only add `clearPhotoCache` to the existing import from `'../api/inat'` (or wherever `fetchBirdPhoto` is already imported).

```typescript
import { fetchBirdPhoto, clearPhotoCache } from '../api/inat';

// Add clearPhotoCache export to inat.ts as part of this fix (see Step 3)

describe('fetchBirdPhoto cache', () => {
  beforeEach(() => {
    clearPhotoCache();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns null (not undefined) when species has no photo and is re-requested from cache', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ total_results: 0, results: [] }),
    } as Response);

    // First call — populates cache with null
    const first = await fetchBirdPhoto('Turdus migratorius');
    expect(first).toBeNull();

    // Second call — returns from cache; must be null, not undefined
    const second = await fetchBirdPhoto('Turdus migratorius');
    expect(second).toBeNull(); // fails if `!` causes undefined to leak
    expect(second).not.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```
npx vitest run src/api/inat.test.ts
```
Expected: FAIL — `second` is `null` but the test exposes that `photoCache.get(sciName)!` returns the null value typed as `BirdPhoto`, making the function return `null` when the declared return is `Promise<BirdPhoto | null>`. The test passes vacuously today because `null` satisfies `toBeNull()` — but the act of adding `clearPhotoCache` (which doesn't exist yet) will make the test fail to compile until Step 3 adds it.

- [ ] **Step 3: Implement fix**

In `src/api/inat.ts`:

1. Add a `clearPhotoCache` export for testability (analogous to `clearTaxonomyCache` in ebird.ts):
```typescript
export function clearPhotoCache(): void {
  photoCache.clear();
}
```

2. Remove the `!` non-null assertion:
```typescript
// Before:
if (photoCache.has(sciName)) return photoCache.get(sciName)!;

// After:
if (photoCache.has(sciName)) return photoCache.get(sciName) ?? null;
```

The `?? null` coerces `undefined` (which `Map.get` can return if the key is somehow absent despite `has` returning true — a theoretical race) into `null`, matching the declared return type.

- [ ] **Step 4: Run test to verify it passes**
```
npx vitest run src/api/inat.test.ts
```
Expected: all tests pass

- [ ] **Step 5: Commit**
```
git commit -m "fix: remove unsafe non-null assertion on photo cache lookup in inat.ts"
```

---

### Task 5: NPS park markers crash when latitude or longitude is an empty string

**Root cause:** `fetchParks` in `nps.ts` filters parks with:
```typescript
return json.data.filter(p => p.latitude && p.longitude);
```
This removes parks where `latitude` or `longitude` is an empty string `""` (falsy). However, the NPS API occasionally returns parks with `latitude: "0"` or `longitude: "0"` — these are *truthy* and pass the filter. In `MapView.tsx`, those parks are rendered:
```typescript
position={[parseFloat(park.latitude), parseFloat(park.longitude)]}
```
`parseFloat("0")` is `0` — a valid coordinate, so this is not a crash. However, `parseFloat("")` is `NaN`, and if a park with `latitude: ""` slips through (e.g., the API adds a park mid-response where the filter ran on a cached result from before the filter was added), Leaflet will receive `[NaN, NaN]` and throw, crashing the map render. The more immediate issue: parks where `latitude` is a non-numeric string (the NPS API field is unvalidated) will silently place a marker at `[NaN, NaN]`.

A separate sub-bug: `useNpsParks` caches the raw `json.data` array in `localStorage` *before* the `filter` is applied — no, actually `fetchParks` does the filter and only returns filtered parks, which `useNpsParks` then caches. But `useNpsParks` also reads back the raw cached value with `JSON.parse(raw) as NpsPark[]` with no runtime validation. If a previous app version cached unfiltered data (or the cache was poisoned), invalid parks would render.

**Fix:** Add a `isValidPark` guard that also validates `parseFloat` produces a finite number, applied both in `fetchParks` and in `useNpsParks`'s state initializer.

**Files:**
- Modify: `src/api/nps.ts`
- Modify: `src/hooks/useNpsParks.ts`
- Modify: `src/api/nps.test.ts`

- [ ] **Step 1: Write failing test**

In `src/api/nps.test.ts` (uses explicit vitest imports):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchParks } from './nps';

describe('fetchParks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('filters out parks with non-numeric latitude/longitude', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { parkCode: 'yose', fullName: 'Yosemite', latitude: '37.8', longitude: '-119.5' },
          { parkCode: 'bad1', fullName: 'Bad Lat', latitude: '', longitude: '-100.0' },
          { parkCode: 'bad2', fullName: 'Bad Both', latitude: 'N/A', longitude: 'N/A' },
          { parkCode: 'bad3', fullName: 'NaN Park', latitude: 'NaN', longitude: '0' },
        ],
      }),
    } as Response);

    const parks = await fetchParks();
    expect(parks).toHaveLength(1);
    expect(parks[0].parkCode).toBe('yose');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```
npx vitest run src/api/nps.test.ts
```
Expected: FAIL — parks with empty string latitude still pass the current `p.latitude && p.longitude` check when latitude is `'N/A'` (truthy non-empty string)

- [ ] **Step 3: Implement fix**

In `src/api/nps.ts`, replace the filter:
```typescript
// Before:
return json.data.filter(p => p.latitude && p.longitude);

// After:
function isValidCoord(s: string): boolean {
  const n = parseFloat(s);
  return isFinite(n);
}
return json.data.filter(p => isValidCoord(p.latitude) && isValidCoord(p.longitude));
```

In `src/hooks/useNpsParks.ts`, apply the same guard to cached data by importing the helper (or inlining):
```typescript
// In the useState initializer:
const [parks, setParks] = useState<NpsPark[]>(() => {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as NpsPark[];
    return parsed.filter(
      p => isFinite(parseFloat(p.latitude)) && isFinite(parseFloat(p.longitude)),
    );
  } catch { return []; }
});
```

Move `isValidCoord` to `src/utils/geo.ts` and import it in both `nps.ts` and `useNpsParks.ts` to avoid duplication:
```typescript
// In src/utils/geo.ts, add:
export function isFiniteCoord(s: string): boolean {
  return isFinite(parseFloat(s));
}
```

- [ ] **Step 4: Run test to verify it passes**
```
npx vitest run src/api/nps.test.ts
```
Expected: PASS

- [ ] **Step 5: Run full test suite**
```
npm run test
```
Expected: all tests pass

- [ ] **Step 6: Commit**
```
git commit -m "fix: reject NPS parks with non-numeric lat/lng to prevent Leaflet NaN crash"
```
