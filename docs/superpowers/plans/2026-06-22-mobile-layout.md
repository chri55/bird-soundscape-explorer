# Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile tab bar that switches between Map and Species List views, keeping the desktop layout exactly as-is.

**Architecture:** A new `MobileTabBar` component renders on mobile only (`md:hidden`). `MapView` gains a `mobileTab` state and uses Tailwind responsive classes to show/hide `SpeciesPanel` and the map column. The map is always mounted (never unmounted) so Leaflet doesn't reinitialize on tab switch.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), FontAwesome (`@fortawesome/react-fontawesome`), Vitest + React Testing Library.

## Global Constraints

- Desktop layout is **unchanged** — `md:flex-row` with SpeciesPanel as fixed-width sidebar, map taking remaining space, now-playing bar always visible when birds loaded.
- Map is always mounted in the DOM — only CSS-hidden on List tab. Never unmount `<MapContainer>`.
- The tab bar uses `md:hidden` — it must not appear on desktop at any breakpoint.
- Active tab color: `text-green-400`. Inactive: `text-gray-400`.
- `verbatimModuleSyntax: true` — type-only imports must use `import type { ... }` on a separate line.
- All new test files use Vitest globals (`describe`, `it`, `expect`, `vi`) — do NOT import them from `'vitest'`.

---

### Task 1: MobileTabBar component

**Files:**
- Create: `src/components/MobileTabBar.tsx`
- Create: `src/components/MobileTabBar.test.tsx`

**Interfaces:**
- Produces: `export type MobileTab = 'map' | 'list'` and `export function MobileTabBar({ activeTab, onTabChange })` — Task 2 imports both.

- [ ] **Step 1: Write the failing tests**

Create `src/components/MobileTabBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileTabBar } from './MobileTabBar';

describe('MobileTabBar', () => {
  it('renders Map and Species buttons', () => {
    render(<MobileTabBar activeTab="map" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Switch to map view' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Switch to species list' })).toBeTruthy();
  });

  it('applies active class to Map button when activeTab is map', () => {
    render(<MobileTabBar activeTab="map" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Switch to map view' }).className).toContain('text-green-400');
    expect(screen.getByRole('button', { name: 'Switch to species list' }).className).toContain('text-gray-400');
  });

  it('applies active class to Species button when activeTab is list', () => {
    render(<MobileTabBar activeTab="list" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Switch to map view' }).className).toContain('text-gray-400');
    expect(screen.getByRole('button', { name: 'Switch to species list' }).className).toContain('text-green-400');
  });

  it('calls onTabChange with "map" when Map button is clicked', () => {
    const onTabChange = vi.fn();
    render(<MobileTabBar activeTab="list" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to map view' }));
    expect(onTabChange).toHaveBeenCalledWith('map');
  });

  it('calls onTabChange with "list" when Species button is clicked', () => {
    const onTabChange = vi.fn();
    render(<MobileTabBar activeTab="map" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to species list' }));
    expect(onTabChange).toHaveBeenCalledWith('list');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/MobileTabBar.test.tsx
```

Expected: 5 failures — `MobileTabBar` not found.

- [ ] **Step 3: Implement MobileTabBar**

Create `src/components/MobileTabBar.tsx`:

```tsx
import type { JSX } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMap, faList } from '@fortawesome/free-solid-svg-icons';

export type MobileTab = 'map' | 'list';

export interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps): JSX.Element {
  return (
    <div className="md:hidden bg-gray-900 text-white flex shrink-0 border-t border-gray-700">
      <button
        type="button"
        aria-label="Switch to map view"
        onClick={() => onTabChange('map')}
        className={`flex-1 py-3 flex flex-col items-center gap-1 text-sm ${
          activeTab === 'map' ? 'text-green-400' : 'text-gray-400'
        }`}
      >
        <FontAwesomeIcon icon={faMap} />
        <span>Map</span>
      </button>
      <button
        type="button"
        aria-label="Switch to species list"
        onClick={() => onTabChange('list')}
        className={`flex-1 py-3 flex flex-col items-center gap-1 text-sm ${
          activeTab === 'list' ? 'text-green-400' : 'text-gray-400'
        }`}
      >
        <FontAwesomeIcon icon={faList} />
        <span>Species</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/MobileTabBar.test.tsx
```

Expected: 5 passed.

- [ ] **Step 5: Run full suite to check for regressions**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/MobileTabBar.tsx src/components/MobileTabBar.test.tsx
git commit -m "feat: add MobileTabBar component for mobile tab navigation"
```

---

### Task 2: MapView wiring + SpeciesPanel height fix

**Files:**
- Modify: `src/components/MapView.tsx`
- Modify: `src/components/SpeciesPanel.tsx` (lines 27 and 49 — both root div occurrences)

**Interfaces:**
- Consumes: `MobileTab`, `MobileTabBar` from `'./MobileTabBar'` (Task 1)

**Context on layout approach:**

The SpeciesPanel wrapper uses `md:contents` — on desktop, `display: contents` makes the wrapper element itself invisible to the flex layout, so SpeciesPanel's own `md:w-80 md:order-last` classes apply directly to the flex row as if the wrapper wasn't there. On mobile, the wrapper provides the flex-col + flex-1 context for the List tab, or `hidden` for the Map tab.

SpeciesPanel's root div needs two changes: `h-72 md:h-auto` → `h-full` (height is now supplied by the wrapper's flex-1 context on mobile), and `md:order-last` stays on SpeciesPanel (since the wrapper vanishes via `contents` on desktop, SpeciesPanel's own `md:order-last` is what positions it as the right sidebar).

- [ ] **Step 1: Update SpeciesPanel root div (both occurrences)**

In `src/components/SpeciesPanel.tsx`, there are two identical root div class strings (line 27 and line 49). In **both**, replace:

```
w-full h-72 md:h-auto md:w-80 flex flex-col bg-white border-b border-gray-200 md:border-b-0 md:border-l shrink-0 overflow-y-auto md:order-last
```

with:

```
w-full h-full md:w-80 flex flex-col bg-white border-b border-gray-200 md:border-b-0 md:border-l shrink-0 overflow-y-auto md:order-last
```

Changes: `h-72 md:h-auto` → `h-full`. Everything else identical.

- [ ] **Step 2: Run full test suite — must still pass before touching MapView**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 3: Add mobileTab state and MobileTabBar import to MapView**

In `src/components/MapView.tsx`, add to the existing imports:

```tsx
import type { MobileTab } from './MobileTabBar';
import { MobileTabBar } from './MobileTabBar';
```

In the `MapView` function body, add after the `settingsOpen` state line:

```tsx
const [mobileTab, setMobileTab] = useState<MobileTab>('map');
```

- [ ] **Step 4: Wrap SpeciesPanel with visibility wrapper**

In `MapView`'s return, locate the `<SpeciesPanel ... />` call (currently a direct child of the `flex flex-col md:flex-row` div). Wrap it:

```tsx
<div className={`${mobileTab === 'list' ? 'flex flex-col flex-1' : 'hidden'} md:contents`}>
  <SpeciesPanel
    notableObs={notableObs}
    recentObs={recentObs}
    recordings={recordings}
    isLoading={isLoading}
  />
</div>
```

`md:contents` makes the wrapper transparent to the desktop flex layout — SpeciesPanel's own `md:w-80 md:order-last` take effect directly. On mobile: `flex flex-col flex-1` fills the content area on List tab; `hidden` hides it on Map tab.

- [ ] **Step 5: Add visibility to map column**

Locate the map column div (currently `<div className="flex-1 relative z-0 min-h-0">`). Change it to:

```tsx
<div className={`${mobileTab === 'map' ? '' : 'hidden md:block'} flex-1 relative z-0 min-h-0`}>
```

On mobile map tab: unchanged (`flex-1 relative z-0 min-h-0`). On mobile list tab: `hidden` hides it; `md:block` restores it on desktop. `flex-1` still applies as a flex item property on desktop.

- [ ] **Step 6: Center ParkSearch on mobile**

Inside the map column, locate:

```tsx
<div className="absolute top-3 left-14 z-[1000] w-64">
```

Change to:

```tsx
<div className="absolute top-3 left-1/2 -translate-x-1/2 md:left-14 md:translate-x-0 z-[1000] w-64">
```

On mobile: centered horizontally. On desktop: left-aligned at `left-14` (clears Leaflet zoom controls), translate reset to 0.

- [ ] **Step 7: Gate now-playing bar on mobile by tab**

Locate the now-playing bar (the `shrink-0 bg-gray-900 flex items-center gap-2 px-3 py-2 relative z-10` div). It is conditionally rendered when `soundscape.voices.length > 0`. Change:

```tsx
{soundscape.voices.length > 0 && (
  <div className="shrink-0 bg-gray-900 flex items-center gap-2 px-3 py-2 relative z-10">
```

to:

```tsx
{soundscape.voices.length > 0 && (
  <div className={`shrink-0 bg-gray-900 items-center gap-2 px-3 py-2 relative z-10 ${
    mobileTab !== 'map' ? 'hidden md:flex' : 'flex'
  }`}>
```

Note: `flex` moved from the static class into the conditional, so both branches supply the display value.

- [ ] **Step 8: Add MobileTabBar to MapView return**

In MapView's return, locate `<SettingsModal ... />` (last child of the outer `flex flex-col h-screen` div). Add `<MobileTabBar>` immediately before it:

```tsx
      <MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        availableObs={availableObs}
        exclusions={exclusions}
        onAddExclusion={addExclusion}
        onRemoveExclusion={removeExclusion}
      />
```

- [ ] **Step 9: Run full test suite**

```bash
npm run test
```

Expected: all tests pass (no MapView behavior tests need updating — the changes are layout-only).

- [ ] **Step 10: Commit**

```bash
git add src/components/MapView.tsx src/components/SpeciesPanel.tsx
git commit -m "feat: mobile tab bar layout with map/species tabs"
```
