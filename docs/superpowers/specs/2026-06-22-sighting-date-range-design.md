# Sighting Date Range & Notable Label Design

## Overview

When multiple observations of the same species are deduplicated into one row in the species panel, the earliest and most recent observation dates are now tracked and displayed as a range. The "Rare" label is renamed to "Notable" to match eBird API terminology, and the "Rarest Sightings" section heading becomes "Notable Sightings".

## Changes

### `src/utils/species.ts`

Add a `DeduplicatedObs` type:

```typescript
export interface DeduplicatedObs extends EBirdObservation {
  firstObsDt: string; // earliest obsDt across all merged observations
  // obsDt (inherited) = most recent obsDt across all merged observations
}
```

Update `deduplicateObs` to return `DeduplicatedObs[]`:

- On first encounter for a species: set both `obsDt` and `firstObsDt` to the observation's `obsDt`.
- On subsequent encounters: compare dates as ISO strings (`YYYY-MM-DD` prefix is lexicographically sortable). Update `obsDt` if the new date is later; update `firstObsDt` if the new date is earlier.
- Sum `howMany` as before.

### `src/components/SpeciesListRow.tsx`

- Change the `obs` prop type from `EBirdObservation` to `DeduplicatedObs`.
- Date display logic:
  - Extract the date-only prefix (`YYYY-MM-DD`) from both `firstObsDt` and `obsDt`.
  - If they are equal: render as before — single date (e.g. `Jun 15, 2024`).
  - If they differ: render a range. Same year: `Jun 1 – Jun 14, 2025`. Different years: `Dec 28, 2024 – Jan 3, 2025`. Format each date with `{ month: 'short', day: 'numeric' }` and append the year only on the last date when the years match, or on both dates when they differ.
- Change the pill text from `Rare` to `Notable`.

### `src/components/SpeciesPanel.tsx`

- Change both occurrences of `"Rarest Sightings"` to `"Notable Sightings"` (mobile tab label and panel section heading).
- No prop or logic changes needed — `deduplicateObs` return type change propagates automatically.

## Data flow

```
fetchNearbyNotable / fetchRecentNearby
  → EBirdObservation[] (raw, may have duplicates)
  → deduplicateObs() → DeduplicatedObs[] (one entry per species, date range tracked)
  → SpeciesPanel passes each DeduplicatedObs to SpeciesListRow
  → SpeciesListRow renders date range and "Notable" pill
```

## Tests

**`src/utils/species.test.ts`** — add/update cases for `deduplicateObs`:
- Single observation: `firstObsDt === obsDt`
- Two observations, same species, different dates: `firstObsDt` = earlier, `obsDt` = later
- Three observations: min/max correctly identified regardless of input order
- `howMany` still summed correctly

**`src/components/SpeciesListRow.test.tsx`** — add/update:
- Single date (no range): renders `Jun 15, 2024` as before
- Date range, same year: renders `Jun 1 – Jun 14, 2025`
- Date range, different years: renders `Dec 28, 2024 – Jan 3, 2025`
- "Rare" test updated to assert `Notable` instead
- Existing tests updated to pass `DeduplicatedObs` (add `firstObsDt` to the test fixture)

## Out of scope

- Showing the count of distinct sighting events (not requested)
- Changing sort order of the deduplicated list (not requested)
- Any changes to `SpeciesDetail` (shows a single raw observation, unaffected)
