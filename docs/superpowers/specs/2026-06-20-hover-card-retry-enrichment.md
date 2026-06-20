# Spec: Hover Card Fix, XC Retry, and Species Enrichment

**Date:** 2026-06-20
**Scope:** Fix soundscape hover card visibility and dimming; add XC 503 retry with voice replacement; enrich species detail view with Wikipedia summary and eBird link.

---

## Summary

Three improvements:

1. **Hover card fix** — The `brightness-50` dim filter incorrectly applied to the hover card popup when a voice was inactive. Move it to only the inner card thumbnail. (The Leaflet z-index issue — adding `relative z-0` to the map wrapper — was already fixed manually and does not require implementation.)
2. **XC audio retry** — When an audio file returns 503 or fails to load, retry up to 2 times with a 1-second delay. If all retries fail, remove the voice and promote a spare from a pre-selected pool of up to 4 extra candidates.
3. **Species enrichment** — Add a Wikipedia summary paragraph and two external link buttons (Wikipedia, eBird) to the species detail panel.

---

## Architecture

### Files modified

| File | Change |
|---|---|
| `src/components/SoundscapeGrid.tsx` | Move `brightness-50` off outer wrapper, onto inner card content div only |
| `src/hooks/useSoundscape.ts` | Add optional `limit` param to `selectVoices`; add spare pool ref; add retry + replacement logic |
| `src/hooks/useSoundscape.test.ts` | Add tests for new `selectVoices` param, retry behavior, spare promotion |
| `src/api/wikipedia.ts` | **Create** — `fetchWikiSummary(name: string): Promise<WikiSummary \| null>` |
| `src/api/wikipedia.test.ts` | **Create** — unit tests for wiki API client |
| `src/components/SpeciesDetail.tsx` | Add Wikipedia extract section + Wikipedia and eBird link buttons |
| `src/components/SpeciesDetail.test.tsx` | Add tests: wiki section renders, links present |

---

## 1. Hover Card Brightness Fix (`SoundscapeGrid.tsx`)

**Problem:** The outer card wrapper has `brightness-50` applied when the voice is inactive. The hover card popup is a child of this wrapper, so it inherits the dim filter and appears dark.

**Fix:** Remove `brightness-50` from the outer `relative group` wrapper. Apply it only to the inner card content div (`h-[110px]`):

```tsx
// Outer wrapper — no brightness class
<div
  className={`relative group rounded-lg ring-2 transition-all duration-300 ${
    voice.isActive ? 'ring-green-400' : 'ring-transparent'
  }`}
>
  {/* Hover card — always full brightness, unchanged */}
  <div className="absolute bottom-full ...">...</div>

  {/* Inner card content — dimmed when inactive */}
  <div className={`relative w-full h-[110px] rounded-lg overflow-hidden bg-black/60 transition-all duration-300 ${
    !voice.isActive ? 'brightness-50' : ''
  }`}>
    ...
  </div>
</div>
```

No test changes needed for this — the existing grid tests don't assert on `brightness-50` placement beyond the container.

---

## 2. XC Audio Retry + Voice Replacement (`useSoundscape.ts`)

### `selectVoices` — optional `limit` param

Add an optional second parameter `limit` (default `MAX_VOICES`):

```typescript
export function selectVoices(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
  limit = MAX_VOICES,
): { recording: XCRecording; sciName: string; howMany: number }[]
```

The internal `.slice(0, MAX_VOICES)` becomes `.slice(0, limit)`.

### Spare pool

Add `export const SPARE_VOICES = 4` constant.

In the rebuild effect:
- Call `selectVoices(recordings, recentObs, MAX_VOICES + SPARE_VOICES)` to get up to 12 candidates
- First `MAX_VOICES` entries → active voices (as before)
- Remainder → stored in `sparePoolRef.current`

```typescript
const sparePoolRef = useRef<{ recording: XCRecording; sciName: string; howMany: number }[]>([]);
```

### Retry logic

After creating each `Audio` element in the rebuild effect, attach an `error` listener in addition to `canplay`. Use a per-voice retry counter stored in a ref array:

```typescript
export const MAX_AUDIO_RETRIES = 2;
export const RETRY_DELAY_MS = 1_000;
```

```typescript
const retryCountsRef = useRef<number[]>([]);
```

In the rebuild effect, initialize `retryCountsRef.current = selected.map(() => 0)`.

The error handler (written as a named function so it can re-attach itself):

```typescript
function attachAudioListeners(audio: HTMLAudioElement, idx: number) {
  audio.addEventListener('canplay', () => {
    setVoices(v => v.map((voice, vi) => vi === idx ? { ...voice, isLoading: false } : voice));
  }, { once: true } as AddEventListenerOptions);

  audio.addEventListener('error', () => {
    const retries = retryCountsRef.current[idx] ?? 0;
    if (retries < MAX_AUDIO_RETRIES) {
      retryCountsRef.current[idx] = retries + 1;
      setTimeout(() => {
        const a = audioRefs.current[idx];
        if (!a) return;
        a.src = a.src; // re-trigger load
        a.load();
        attachAudioListeners(a, idx);
      }, RETRY_DELAY_MS);
    } else {
      // All retries exhausted — replace with spare (or mark failed)
      replaceFailedVoice(idx);
    }
  }, { once: true } as AddEventListenerOptions);
}
```

### Voice replacement

**Critical:** voices are replaced **in-place at the same index slot** rather than removed-and-appended. Removing from the array shifts all subsequent indices, breaking the permanent alignment between `voices[idx]`, `audioRefs.current[idx]`, `intervalsRef.current[idx]`, and `retryCountsRef.current[idx]`.

Add `isFailed?: boolean` to `SoundscapeVoice`. `SoundscapeGrid` filters out (`voice.isFailed`) voices before rendering.

`replaceFailedVoice(idx)` is a `useCallback`:

1. Pause and release the failed audio (`a.src=''; a.load()`)
2. If `sparePoolRef.current` is empty: update `voices[idx]` with `isFailed: true` — the slot is hidden from the grid
3. If spares exist, shift the first spare off the pool and replace in-place:
   - Create a new `Audio(spare.recording.file)`
   - Compute its `intervalMs` using `computeIntervalMs` (relative to the existing voices' howMany range)
   - Replace `audioRefs.current[idx]`, `intervalsRef.current[idx]`, `retryCountsRef.current[idx]` **at the same index**
   - Replace `voices[idx]` in state with the new voice entry (`isLoading: true`, `isFailed: false`)
   - Call `attachAudioListeners(newAudio, idx)`
   - Fetch its photo (`fetchBirdPhoto(spare.sciName)`) and update `voices[idx].photo` on resolve
   - If `isPlayingRef.current`, schedule `startVoice(idx)` with a random delay in `[0, INITIAL_STAGGER_MS]`

### Tests

New tests in `useSoundscape.test.ts`:

- `selectVoices` with explicit `limit` returns at most `limit` entries
- Error event triggers retry after `RETRY_DELAY_MS`
- After `MAX_AUDIO_RETRIES` errors, voice at the same index is replaced (not appended)
- Spare pool is populated from candidates beyond `MAX_VOICES`
- Failed voice slot is replaced by first spare (same index, new data)
- Failed voice slot is marked `isFailed: true` when spare pool is empty

---

## 3. Species Enrichment (`wikipedia.ts` + `SpeciesDetail.tsx`)

### `src/api/wikipedia.ts`

```typescript
export interface WikiSummary {
  extract: string;   // plain-text summary paragraph(s)
  pageUrl: string;   // desktop Wikipedia article URL
}

export async function fetchWikiSummary(name: string): Promise<WikiSummary | null>
```

Implementation:
- Encode `name` with `encodeURIComponent`
- `GET https://en.wikipedia.org/api/rest_v1/page/summary/{encodedName}`
- On 200: return `{ extract: data.extract, pageUrl: data.content_urls.desktop.page }`
- On 404 or any error: return `null`
- No API key required

Retry strategy: single attempt only (Wikipedia is reliable; 404 means the page doesn't exist under that name).

Fallback: `SpeciesDetail` first tries `obs.comName`, then `obs.sciName`. Whichever returns a non-null result is used. If both return null, the Wikipedia section is omitted.

### `SpeciesDetail.tsx` changes

Add `wikiSummary: WikiSummary | null` to the component's state. Fetch it in the existing `useEffect` alongside `fetchBirdPhoto` and `fetchTaxonomy`:

```typescript
Promise.all([
  fetchBirdPhoto(obs.sciName),
  fetchTaxonomy([obs.speciesCode]),
  fetchWikiSummary(obs.comName).then(r => r ?? fetchWikiSummary(obs.sciName)),
]).then(([p, taxa, wiki]) => { ... setWikiSummary(wiki); ... })
```

#### New UI sections

**Description block** (after taxonomy, before observation data):

```tsx
{wikiSummary && (
  <div className="px-4 py-2 border-t border-gray-100">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Wikipedia</p>
    <p className="text-sm text-gray-700 leading-relaxed">{wikiSummary.extract}</p>
  </div>
)}
```

**External links block** (at bottom, above photo attribution):

```tsx
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

The eBird link is always shown (we always have `obs.speciesCode`). The Wikipedia link only shows when a summary was found.

### Tests

New tests for `src/api/wikipedia.test.ts`:
- Returns `{ extract, pageUrl }` on 200 response
- Returns `null` on 404
- Returns `null` on network error

New tests for `SpeciesDetail.test.tsx`:
- Shows Wikipedia extract when `fetchWikiSummary` resolves with a summary
- Shows "Wikipedia ↗" link when summary available
- Always shows "eBird ↗" link
- Omits Wikipedia section when `fetchWikiSummary` returns null

---

## Definition of Done

- Hover card appears at full brightness regardless of voice active state
- XC audio retries up to 2 times on error, then removes and replaces the voice if a spare is available
- Species detail view shows a Wikipedia summary paragraph (when available) and two clearly labeled external links (Wikipedia ↗, eBird ↗)
- `npm run build` clean, `npm test` passes
