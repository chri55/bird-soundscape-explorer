# Mobile Layout Design

## Goal

Add a mobile-first responsive layout that keeps the desktop experience unchanged while giving mobile users a clean map-first view with a tab bar to switch between the map and the species list.

---

## Architecture

`MobileTabBar` is a new presentational component that renders only on mobile (`md:hidden`). `MapView` gains a `mobileTab` state that drives CSS visibility of existing sections. The map is always mounted (never unmounted on tab switch) so Leaflet doesn't reinitialize. All existing desktop layout classes are preserved.

---

## Mobile Layout (portrait phone)

Slot order top to bottom:

```
┌─────────────────────────────┐
│ Bird Soundscape Explorer ⚙  │  ← header (unchanged)
├─────────────────────────────┤
│                             │
│   Map  OR  Species List     │  ← flex-1, one visible at a time
│                             │
├─────────────────────────────┤
│  ▶  ║  [bird] [bird] …      │  ← now-playing bar (Map tab only)
├─────────────────────────────┤
│   🗺 Map    📋 Species       │  ← MobileTabBar (md:hidden)
└─────────────────────────────┘
```

Desktop layout is **unchanged** — `md:flex-row`, SpeciesPanel always visible left column, now-playing bar always visible when voices loaded, no tab bar.

---

## New Component: `MobileTabBar`

**File:** `src/components/MobileTabBar.tsx`

```typescript
interface MobileTabBarProps {
  activeTab: 'map' | 'list';
  onTabChange: (tab: 'map' | 'list') => void;
}
```

- Root element: `md:hidden` — not rendered on desktop at all
- Two `<button type="button">` elements, each `flex-1`
- Icons: `faMap` (Map tab), `faList` (Species List tab) from `@fortawesome/free-solid-svg-icons`
- Label text below the icon: "Map" and "Species"
- Active tab: `text-green-400`; inactive: `text-gray-400`
- Background: `bg-gray-900 text-white flex shrink-0`
- Button padding: `py-3 flex flex-col items-center gap-1 text-sm`
- `aria-label` on each button: `"Switch to map view"` / `"Switch to species list"`

---

## MapView Changes

### New state

```typescript
const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');
```

### SpeciesPanel visibility

Wrap SpeciesPanel in a div that applies responsive visibility:

- Map tab: `hidden md:flex` — hidden on mobile, always shown on desktop
- List tab: `flex md:flex` — shown on mobile and desktop

### Map column visibility

- Map tab: `flex md:flex flex-1 relative z-0 min-h-0` — shown both
- List tab: `hidden md:flex flex-1 relative z-0 min-h-0` — hidden on mobile, shown on desktop

The map is always rendered in the DOM regardless of tab — just CSS-hidden — so Leaflet never re-initialises.

### ParkSearch positioning

Change from `left-14` to centered on mobile, left-aligned on desktop:

```
top-3 left-1/2 -translate-x-1/2 md:left-14 md:translate-x-0 z-[1000] w-64
```

### Now-playing bar

Add responsive visibility: show on desktop always, show on mobile only when Map tab is active.

- Map tab: `flex` (existing behaviour)
- List tab: `hidden md:flex`

Condition: still gated on `soundscape.voices.length > 0` as before.

### MobileTabBar placement

Rendered as the second-to-last child of the outer `flex flex-col h-screen` div, immediately before `<SettingsModal>`.

```tsx
<MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} />
<SettingsModal ... />
```

---

## Files Touched

| File | Change |
|------|--------|
| `src/components/MobileTabBar.tsx` | New — tab bar component |
| `src/components/MobileTabBar.test.tsx` | New — unit tests |
| `src/components/MapView.tsx` | Add `mobileTab` state, visibility classes, ParkSearch centering, MobileTabBar |

---

## Testing

**`MobileTabBar`:**
- Renders a Map button and a Species button
- Map button has active class when `activeTab="map"`
- Species button has active class when `activeTab="list"`
- Clicking Map button calls `onTabChange('map')`
- Clicking Species button calls `onTabChange('list')`

**`MapView`:** No new MapView tests needed — existing tests cover the wiring surface. Visual tab switching is verified by running the dev server.
