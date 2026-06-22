# Playback Enhancements Design

## Goal

Two independent playback features: (1) a play button in the bird detail view that fetches and plays the highest-quality XC recording for that species on demand; (2) a per-bird dice button in the soundscape grid that rerolls a single voice slot with a freshly-fetched species from the eBird observation list.

---

## Feature 1: XC Play Button in SpeciesDetail

### UI

A "Play call" button added to the external links row in `SpeciesDetail.tsx` (alongside the existing Wikipedia and eBird links). Uses Font Awesome icons:

- Idle: `faPlay` icon + label "Play call"
- Fetching: `faSpinner` with `fa-spin` class + label "Loading…"
- Playing: `faStop` icon + label "Stop"
- No result: button disabled, label "No recording"

### Behavior

- On first click: builds a `gen:{genus} sp:{species}` query from `obs.sciName` (split on space: genus = first word, species = second word), calls `fetchRecordings(query)` from `../api/xeno-canto`.
- Selects the highest-quality result using `qualityRank` and `typeScore` from `../utils/recording-quality` (same scoring already used by `useSoundscape`).
- Plays via a component-local `HTMLAudioElement` created in a `useRef`. Sets `audio.src = recording.file` and calls `audio.play()`.
- The fetched recording is cached in local state (`useState<XCRecording | null>`) — no re-fetch on stop/restart within the same detail view.
- On unmount, pauses the audio element.
- If `fetchRecordings` returns zero recordings, sets a `noRecording: true` state flag — button disables and shows "No recording".

### Attribution

Once a recording is loaded, shows a line below the button:

```
Rec: {recording.rec} · {recording.type} · Quality {recording.q} · {recording.loc}
```

Styled as `text-xs text-gray-500`.

### XC Query Format

`obs.sciName` is always `"Genus species"` (two words separated by a space). Split:

```typescript
const [genus, species] = obs.sciName.split(' ');
const query = `gen:${genus} sp:${species}`;
```

### Files Touched

| File | Change |
|------|--------|
| `src/components/SpeciesDetail.tsx` | Add play button, local audio state, attribution line |

No new API functions needed — `fetchRecordings` is already exported from `src/api/xeno-canto.ts`.

---

## Feature 2: Per-Bird Reroll in SoundscapeGrid

### UI

A dice button (`faDice` Font Awesome icon) on each bird card in `SoundscapeGrid`, positioned in the **top-left** corner. Same hover-reveal style as the existing mute button (top-right): `opacity-0 group-hover:opacity-100`, black/50 background, white icon, `w-6 h-6`.

### Behavior

Clicking calls `rerollVoice(index: number)` exposed from `useSoundscape`. The hook:

1. Immediately marks the slot as `isLoading: true` and `isActive: false` (shows skeleton in the card).
2. Builds a **candidate list** from `recentObs` + `notableObs` (union by `sciName`), sorted by `howMany` descending, excluding:
   - Species already active in other voice slots
   - Species in the XC blocklist (see below)
3. Iterates candidates in order. For each:
   a. Calls `fetchRecordings(\`gen:${genus} sp:${species}\`)`.
   b. Runs `bestRecording(sciName, recordings)` to pick the top result.
   c. If a usable recording is found: wires up the new voice (calls `startVoice(index, recording, sciName, howMany)`), stops iteration.
   d. If no recording found: writes the species to the XC blocklist, tries the next candidate.
4. If all candidates are exhausted without a result: marks the slot `isFailed: true`.
5. Maximum 5 candidates attempted per reroll to cap API calls.

### XC Blocklist

Stored in localStorage under key `xc_no_recording_v1`. Format:

```typescript
interface BlocklistEntry {
  sciName: string;
  blockedAt: number; // Date.now()
}
```

The blocklist is stored as a JSON array. On every read:
- Parse the array, filter out entries where `Date.now() - blockedAt > 24 * 60 * 60 * 1000`
- Write the pruned list back to localStorage
- Return the set of remaining `sciName` values

Extracted into `src/utils/xc-blocklist.ts`:

```typescript
const STORAGE_KEY = 'xc_no_recording_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

export function readBlocklist(): Set<string>
export function addToBlocklist(sciName: string): void
```

### `rerollVoice` on `UseSoundscapeResult`

```typescript
interface UseSoundscapeResult {
  // ... existing fields ...
  rerollVoice: (index: number) => void;
}
```

`rerollVoice` needs access to the current `recentObs` and `notableObs` lists. `useSoundscape` currently receives only `recordings` and `recentObs`. To support reroll:
- Pass `notableObs: EBirdObservation[]` as a third parameter to `useSoundscape`
- `MapView` already has both lists in state and passes them to `SpeciesPanel`; wire them to `useSoundscape` as well.

### Files Touched

| File | Change |
|------|--------|
| `src/utils/xc-blocklist.ts` | New — `readBlocklist`, `addToBlocklist` |
| `src/hooks/useSoundscape.ts` | Add `notableObs` param, add `rerollVoice`, expose on result |
| `src/components/SoundscapeGrid.tsx` | Add dice button, wire `onReroll` prop |
| `src/components/MapView.tsx` | Pass `notableObs` to `useSoundscape`, pass `soundscape.rerollVoice` to `SoundscapeGrid` |

---

## Icons

All icons from `@fortawesome/free-solid-svg-icons` (already installed):

| Usage | Icon |
|-------|------|
| Reroll button | `faDice` |
| Play call (idle) | `faPlay` |
| Play call (loading) | `faSpinner` (with `className="fa-spin"`) |
| Play call (playing) | `faStop` |

---

## Testing

**`xc-blocklist.ts`:** Unit tests for `readBlocklist` (prunes expired entries, returns live ones), `addToBlocklist` (writes entry, re-reading includes it). Mock `localStorage` and `Date.now`.

**`SpeciesDetail` play button:** Unit tests for idle state (button present), fetching state (spinner shown while promise pending), loaded state (stop button + attribution shown), no-recording state (button disabled).

**`SoundscapeGrid` dice button:** Unit test that dice button is rendered per non-failed voice and calls `onReroll` with the correct index.

**`useSoundscape` rerollVoice:** Unit tests that calling `rerollVoice(index)` sets that slot to `isLoading`, and that on a successful fetch it replaces the voice. Mock `fetchRecordings`.

**`MapView`:** No new tests needed — existing tests cover the wiring surface.
