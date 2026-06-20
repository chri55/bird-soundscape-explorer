# Spec: Move Soundscape Bar Back to Bottom

**Date:** 2026-06-20
**Scope:** Layout-only change to `src/components/MapView.tsx`.

## Change

Move the `{soundscape.voices.length > 0 && ...}` block in `MapView.tsx` from its current position between `<header>` and the map flex row, to after the map flex row.

**Before (current):**
```
<header>
{soundscape bar}       ← above map
<div flex-1>           ← map + SpeciesPanel
```

**After:**
```
<header>
<div flex-1>           ← map + SpeciesPanel
{soundscape bar}       ← below map (footer position)
```

No logic, no new files, no tests, no class changes. The `relative z-10` classes on the bar are unchanged.

## Definition of Done

- Soundscape bar renders below the map/species panel row
- `npm run build` clean
