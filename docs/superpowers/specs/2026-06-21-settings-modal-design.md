# Settings Modal & Bird Exclusion Filter Design

## Goal

A settings modal opened from the app header that contains (1) a persistent bird exclusion list that prevents specified species from appearing in the soundscape now-playing slots globally, and (2) an about/attribution section listing data sources. Designed to work on mobile as well as desktop.

---

## Architecture

A new `useExclusionList` hook owns the localStorage persistence. `SettingsModal` is a new component that receives the exclusion list and available species as props. `useSoundscape` gains a 4th param `excludedSciNames` that filters candidates at selection time. `MapView` wires all three together and adds the gear button to the header.

**Data flow:**

```
MapView
├── header  ←  faGear button (always visible, top-right of header)
├── SettingsModal (conditionally visible, rendered in MapView)
│   ├── Excluded Birds section  ←  search + list
│   └── About section  ←  data source attribution
└── useSoundscape(recordings, recentObs, notableObs, excludedSciNames)
                                                      ↑
                                            useExclusionList()
```

---

## Feature 1: `useExclusionList` Hook

### Storage

localStorage key: `bird_exclusions_v1`

Format: JSON array of `ExclusionEntry`:

```typescript
interface ExclusionEntry {
  sciName: string;
  comName: string;
}
```

No TTL — exclusions are permanent until the user removes them.

### Interface

```typescript
// src/hooks/useExclusionList.ts
export interface ExclusionEntry {
  sciName: string;
  comName: string;
}

export function useExclusionList(): {
  exclusions: ExclusionEntry[];
  excludedSciNames: Set<string>;
  addExclusion: (sciName: string, comName: string) => void;
  removeExclusion: (sciName: string) => void;
}
```

- `exclusions` — full array (for display in modal)
- `excludedSciNames` — derived `Set<string>` (for fast lookup in `useSoundscape`)
- `addExclusion` — adds if not already present, writes to localStorage
- `removeExclusion` — removes by `sciName`, writes to localStorage

State is held in React `useState`; reads from localStorage on mount only. Writes go to both state and localStorage synchronously.

---

## Feature 2: `SettingsModal` Component

### Props

```typescript
// src/components/SettingsModal.tsx
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableObs: EBirdObservation[];   // recentObs + notableObs from MapView
  exclusions: ExclusionEntry[];
  onAddExclusion: (sciName: string, comName: string) => void;
  onRemoveExclusion: (sciName: string) => void;
}
```

### Layout

Full-screen dark backdrop (`fixed inset-0 bg-black/60 z-[2000]`). Clicking the backdrop calls `onClose`. Centered card (`max-w-lg w-full mx-4 max-h-[90vh] flex flex-col bg-gray-900 rounded-xl overflow-hidden`). On small screens the card is full-width (the `mx-4` provides edge padding).

Modal structure:

```
┌─────────────────────────────┐
│ Settings               [X]  │  ← sticky header
├─────────────────────────────┤
│ Excluded Birds              │
│ [Search loaded birds…    ]  │
│  ┌─ results dropdown ──────┐│  ← shows while typing, max 8
│  │ Canada Goose            ││
│  │ Branta canadensis       ││
│  └─────────────────────────┘│
│                             │
│  Canada Goose          [X]  │  ← exclusion list
│  No birds excluded…         │  ← empty state
├─────────────────────────────┤
│ About                       │
│ eBird · Xeno-canto · …      │
└─────────────────────────────┘
```

### Excluded Birds section

**Search input:** filters `availableObs` by `comName` case-insensitive substring match. Shows only species not already in `exclusions`. Dropdown hidden when query is empty. Max 8 results shown.

If `availableObs.length === 0`: input `disabled`, placeholder `"Drop a pin to see birds"`.

**Clicking a result:** calls `onAddExclusion(obs.sciName, obs.comName)`, clears the search input, closes the dropdown.

**Exclusion list:** rendered below the search. Each row: `comName` on the left, X button (`type="button"`, `aria-label="Remove {comName}"`) on the right. Empty state text: `"No birds excluded — soundscape picks from all available species."`.

### About section

Separated by a horizontal rule. Lists five data sources:

| Source | Description |
|--------|-------------|
| **eBird** (Cornell Lab of Ornithology) | Recent bird sighting data |
| **Xeno-canto** | Bird audio recordings |
| **iNaturalist** | Bird photos |
| **National Park Service** | Park locations |
| **OpenStreetMap** | Map tiles |

Styled as small `text-gray-400 text-sm` text.

### Keyboard / accessibility

- Modal is closed by the backdrop click or the X button
- The X button and remove buttons have explicit `aria-label`s
- `type="button"` on all buttons

---

## Feature 3: `useSoundscape` Exclusion Param

### Signature change

```typescript
export function useSoundscape(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
  notableObs: EBirdObservation[] = [],
  excludedSciNames: Set<string> = new Set(),
): UseSoundscapeResult
```

### Effect on candidate selection

In the rebuild effect, `selectVoices` already filters by the recordings available. The exclusion filter is applied **after** `selectVoices`:

```typescript
const allCandidates = selectVoices(recordings, recentObs, MAX_VOICES + SPARE_VOICES)
  .filter(c => !excludedSciNames.has(c.sciName));
```

In `rerollVoice`, the exclusion set is consulted in the candidate loop alongside the blocklist:

```typescript
if (!seen.has(obs.sciName)
  && !activeSciNames.has(obs.sciName)
  && !blocklist.has(obs.sciName)
  && !excludedSciNamesRef.current.has(obs.sciName)) {
```

A new `excludedSciNamesRef` (updated via `useEffect`) keeps the reroll closure up-to-date without triggering a rebuild.

---

## Feature 4: MapView wiring

### Header button

```tsx
<header className="px-4 py-2 bg-green-800 text-white flex items-center gap-3 shrink-0">
  <span className="text-lg font-semibold">Bird Soundscape Explorer</span>
  {pin && (
    <span className="text-sm text-green-200 ml-auto">
      {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
    </span>
  )}
  <button
    type="button"
    aria-label="Open settings"
    onClick={() => setSettingsOpen(true)}
    className={`${pin ? '' : 'ml-auto '}p-1 rounded hover:bg-green-700 transition-colors`}
  >
    <FontAwesomeIcon icon={faGear} />
  </button>
</header>
```

When `pin` is set, the coordinate display is `mr-2` and the gear button uses `ml-auto` only on the button (both can coexist with `flex items-center gap-3`). When there's no pin, the gear button pushes to the far right via `ml-auto`.

### New state and wiring

```typescript
const [settingsOpen, setSettingsOpen] = useState(false);
const { exclusions, excludedSciNames, addExclusion, removeExclusion } = useExclusionList();

const soundscape = useSoundscape(recordings, recentObs, notableObs, excludedSciNames);

const availableObs = [...notableObs, ...recentObs].filter(
  (obs, i, arr) => arr.findIndex(o => o.sciName === obs.sciName) === i,
);
```

`SettingsModal` rendered at the bottom of the MapView return, before the closing `</div>`:

```tsx
<SettingsModal
  isOpen={settingsOpen}
  onClose={() => setSettingsOpen(false)}
  availableObs={availableObs}
  exclusions={exclusions}
  onAddExclusion={addExclusion}
  onRemoveExclusion={removeExclusion}
/>
```

---

## Files Touched

| File | Change |
|------|--------|
| `src/hooks/useExclusionList.ts` | New — `ExclusionEntry`, `useExclusionList` |
| `src/hooks/useExclusionList.test.ts` | New — unit tests |
| `src/components/SettingsModal.tsx` | New — modal component |
| `src/components/SettingsModal.test.tsx` | New — unit tests |
| `src/hooks/useSoundscape.ts` | Add `excludedSciNames` 4th param + `excludedSciNamesRef` |
| `src/hooks/useSoundscape.test.ts` | Add tests for exclusion filtering |
| `src/components/MapView.tsx` | Gear button, `settingsOpen` state, modal wiring |

---

## Testing

**`useExclusionList`:** add, remove, dedup (adding same sciName twice keeps one entry), persistence (reads from localStorage on mount), empty state (returns empty set when storage is empty).

**`SettingsModal`:**
- Renders nothing when `isOpen` is false
- Shows search input when `isOpen` is true
- Filters `availableObs` by typed substring
- Calls `onAddExclusion` with correct args when a result is clicked
- Shows exclusion entries
- Calls `onRemoveExclusion` when X is clicked
- Search input disabled when `availableObs` is empty

**`useSoundscape` exclusion:**
- Excluded species do not appear in initial voices
- Excluded species are skipped in `rerollVoice` candidates

**`MapView`:** No new tests needed — existing tests cover the wiring surface.
