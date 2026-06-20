# Spec: Species Panel, UX Polish, and Soundscape Hover Card

**Date:** 2026-06-20
**Scope:** Replace single-bird featured card with a full species list panel; add hover cards to soundscape strip; add loading skeletons throughout; fix ORB-blocked sonogram images; make soundscape strip an 8-column grid.

---

## Summary

Four improvements delivered together:

1. **Sonogram fix** — Remove all `<img src={sono...}>` references. Use a styled text placeholder when no iNaturalist photo is available.
2. **Species Panel** — Replace `FeaturedBirdCard` / `useFeaturedBird` with a new panel showing scrollable Rarest and Most Common lists, clickable into a detail view.
3. **Loading skeletons** — Pulsing placeholders everywhere data is in-flight: panel rows, photos, audio cards.
4. **Soundscape grid + hover card** — 8-column grid fills available width; each card shows a hover popover with full photo, names, and attributions.

---

## Architecture

### New / modified files

| File | Action |
|---|---|
| `src/utils/species.ts` | **Create** — `deduplicateObs`, `bestRecording` |
| `src/components/Skeleton.tsx` | **Create** — reusable pulsing skeleton block |
| `src/components/SpeciesPanel.tsx` | **Create** — list + detail panel, manages selected species |
| `src/components/SpeciesListRow.tsx` | **Create** — one row in the list |
| `src/components/SpeciesDetail.tsx` | **Create** — detail view with back button |
| `src/components/SoundscapeGrid.tsx` | **Modify** — grid-cols-8, hover card, loading state, no sonogram |
| `src/hooks/useSoundscape.ts` | **Modify** — per-voice `isLoading` state |
| `src/components/MapView.tsx` | **Modify** — swap FeaturedBirdCard for SpeciesPanel |
| `src/components/FeaturedBirdCard.tsx` | **Delete** |
| `src/hooks/useFeaturedBird.ts` | **Delete** |

---

## 1. Utility: `src/utils/species.ts`

### `deduplicateObs`

```typescript
export function deduplicateObs(obs: EBirdObservation[]): EBirdObservation[] 
```

- Groups by `sciName`
- Sums `howMany` (treating `undefined` as 0)
- Keeps `comName`, `obsDt`, `locName`, `speciesCode` from the first occurrence
- Returns array in original order (first occurrence of each species)

### `bestRecording`

Extracted verbatim from `useFeaturedBird.ts`. Ranks recordings for a given `sciName` from `XCRecording[]`: quality A > B > C > D > E, then song > call > other. Returns best match or `null`.

```typescript
export function bestRecording(sciName: string, recordings: XCRecording[]): XCRecording | null
```

---

## 2. Skeleton: `src/components/Skeleton.tsx`

```typescript
interface SkeletonProps {
  className?: string;
}
export function Skeleton({ className = '' }: SkeletonProps): JSX.Element
```

Renders a `<div>` with Tailwind `animate-pulse bg-gray-200 rounded` plus any passed `className`. Used everywhere a loading placeholder is needed.

---

## 3. Species Panel

### `SpeciesListRow` (`src/components/SpeciesListRow.tsx`)

```typescript
interface SpeciesListRowProps {
  obs: EBirdObservation;
  isNotable: boolean;
  onClick: () => void;
}
```

Renders a clickable row:
- **Left:** Common name (bold, truncated), scientific name (italic, small, gray), date + location (xs, gray, truncated)
- **Right:** Count badge (`"N seen"`) if `howMany > 0`; amber `"Rare"` pill if `isNotable`
- Hover: light gray background

### `SpeciesDetail` (`src/components/SpeciesDetail.tsx`)

```typescript
interface SpeciesDetailProps {
  obs: EBirdObservation;
  recordings: XCRecording[];
  onBack: () => void;
}
```

- **Back button** — `← Back` at top left, calls `onBack`
- Fetches `fetchBirdPhoto(obs.sciName)` and `fetchTaxonomy([obs.speciesCode])` on mount (cancelled on unmount)
- Shows `Skeleton` while loading
- **Hero photo** — `photo.photoUrl` if available; else dark placeholder div with `obs.comName` centered in white text. No sonogram.
- **Names** — `obs.comName` (large, bold), `obs.sciName` (italic, gray)
- **Taxonomy** — `taxon.order · taxon.familyComName` (small, gray) — omitted if taxon null
- **Observation data** — count (`obs.howMany` if > 0), `obs.obsDt` (formatted as `MMM D, YYYY`), `obs.locName`
- **Recording credit** — if recording found: `"Recording by [rec.rec] · [rec.type] · Quality [rec.q]"`. No spectrogram image.
- **Photo attribution** — `photo.attribution` if photo present
- Uses `bestRecording(obs.sciName, recordings)` from `src/utils/species.ts`

### `SpeciesPanel` (`src/components/SpeciesPanel.tsx`)

```typescript
interface SpeciesPanelProps {
  notableObs: EBirdObservation[];
  recentObs: EBirdObservation[];
  recordings: XCRecording[];
  isLoading: boolean;
}
```

Manages `selectedObs: EBirdObservation | null` state.

**When `selectedObs` is set:** renders `<SpeciesDetail obs={selectedObs} recordings={recordings} onBack={() => setSelectedObs(null)} />`

**When `selectedObs` is null:** renders the list view:

```
┌─────────────────────────────────┐
│ Rarest Sightings                │
│ ─────────────────────────────── │
│ [row] [row] [row] ...scrollable │
│                                 │
│ Most Common                     │
│ ─────────────────────────────── │
│ [row] [row] [row] ...scrollable │
└─────────────────────────────────┘
```

- **Rarest Sightings** — `deduplicateObs(notableObs)`, in eBird order, all entries with `isNotable=true`
- **Most Common** — `deduplicateObs(recentObs)`, sorted by summed `howMany` descending, `isNotable=false`
- Each section has a sticky section header (`"Rarest Sightings"` / `"Most Common"`) with `sticky top-0 bg-white` so it stays visible while the panel scrolls
- **Loading state** (`isLoading=true`): show 4 skeleton rows in each section instead of real rows
- **Empty state** (not loading, no obs): show `"Drop a pin on the map to discover birds in this area"` centered message (only if both lists are empty; if one section is empty it just omits that section)

Panel is `w-80 flex flex-col bg-white border-l border-gray-200 shrink-0 overflow-y-auto`.

---

## 4. Soundscape Grid Updates (`src/components/SoundscapeGrid.tsx`)

### 8-column grid

Replace the flex row with a `grid grid-cols-8` that fills available width. Each card stretches to fill its column. Remove `w-[90px]` fixed width; use `h-[110px]` for consistent height. Cards get `w-full`.

### Sonogram removal

Remove `voice.recording.sono.small` fallback from `imgSrc`. When `voice.photo` is null, render a dark placeholder `<div>` with the bird's common name (`voice.recording.en`) centered in small white text instead of an image.

### Hover card

Each card gets `group relative` on its outer wrapper. On hover (`group-hover:visible` / `group-hover:opacity-100`), a popover appears **above** the card:

```
┌─────────────────────────┐
│ [photo or placeholder]  │
│ Common Name             │
│ Scientific name (italic)│
│ © attribution           │
│ Rec: recordist name     │
└─────────────────────────┘
```

- Width: `w-48`, positioned `absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50`
- Photo: `voice.photo.largeUrl` if available; else dark placeholder with name
- Hidden by default (`opacity-0 invisible`), visible on hover (`group-hover:opacity-100 group-hover:visible`), `transition-opacity duration-150`
- Omit attribution lines if null

### Per-card loading state

`SoundscapeVoice` gets a new `isLoading: boolean` field (see hook section below). When `isLoading` is true, the card shows a `Skeleton` overlay instead of the photo.

---

## 5. `useSoundscape` — per-voice `isLoading`

Add `isLoading: boolean` to `SoundscapeVoice`:

```typescript
export interface SoundscapeVoice {
  // ... existing fields ...
  isLoading: boolean;  // true until audio fires 'canplay'
}
```

When each `Audio` object is created (in the rebuild effect):
- Set `voice.isLoading = true` initially
- Attach a one-time `'canplay'` listener: `audio.addEventListener('canplay', () => setVoices(v => v.map((voice, i) => i === idx ? { ...voice, isLoading: false } : voice)), { once: true })`

When `stopAll` is called (new pin / toggle off), `isLoading` resets to `true` for all voices (since new Audio elements will be created on rebuild).

---

## 6. MapView changes

- Remove `useFeaturedBird` import and call
- Remove `FeaturedBirdCard` import and render
- Add `SpeciesPanel` import
- Add `isLoading` state (boolean) — set to `true` when `handlePin` fires, set to `false` after the `Promise.all` in `fetchForPin` settles (both success and error)
- Pass `{ notableObs, recentObs, recordings, isLoading }` to `SpeciesPanel`

---

## Deletions

- `src/components/FeaturedBirdCard.tsx` — deleted
- `src/hooks/useFeaturedBird.ts` — deleted
- All their tests — deleted

---

## Testing

- **`deduplicateObs`**: same sciName entries merge and sum howMany; order preserved; undefined howMany treated as 0
- **`bestRecording`**: quality ranking, song-over-call tiebreak (already tested via useFeaturedBird — tests move to species.ts)
- **`Skeleton`**: renders with animate-pulse class; accepts className override
- **`SpeciesListRow`**: renders name, sciName, count, date/loc; rare pill shown when isNotable; onClick fires
- **`SpeciesDetail`**: renders skeleton while loading; shows photo when resolved; shows back button; calls onBack
- **`SpeciesPanel`**: shows skeleton rows when isLoading; renders both sections; clicking row shows detail; back returns to list; empty state message when no obs
- **`SoundscapeGrid`**: grid-cols-8 class present; no img tag when photo null (placeholder div instead); hover card content rendered; isLoading shows skeleton
- **`useSoundscape`**: isLoading true initially per voice; transitions false on canplay event

---

## Definition of Done

- No `sono` image URLs loaded anywhere in the app
- Right panel shows two scrollable species lists after pin drop
- Clicking any row navigates to detail view with back button
- Skeleton placeholders shown during all async operations
- Soundscape bar is an 8-column grid, cards fill available width
- Hover card appears on each soundscape card
- `npm run build` clean, `npm test` passes
