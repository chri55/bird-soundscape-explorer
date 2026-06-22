# Mobile Soundscape Grid Design

## Goal

Reshape the now-playing bird cards on mobile to a 4-column × 2-row square grid with tap-to-reveal buttons and a centered info panel above the soundscape bar. Desktop layout is unchanged.

---

## Architecture

`SoundscapeGrid` gains local `selectedIndex` state and a new `onSelectedVoiceChange` callback prop. `MapView` holds `selectedVoice` state and renders a `md:hidden` info panel above the soundscape bar when a bird is selected.

```
MapView
├── [md:hidden info panel]     ← selectedVoice, above soundscape bar
└── soundscape bar
    ├── SoundscapeControls
    └── SoundscapeGrid         ← manages selectedIndex internally
```

---

## SoundscapeGrid Changes

### Grid layout

```
grid-cols-4 md:grid-cols-8
```

Mobile: 4 columns × 2 rows = 8 birds. Desktop: 8 columns × 1 row (unchanged).

### Card size

```
aspect-square md:aspect-auto md:h-[110px]
```

Mobile: square. On a 390px screen with `gap-2 px-3`, each card is ~93px — well above the 44px touch-target minimum. Desktop: `h-[110px]` fixed height (unchanged).

### Selected state

```typescript
const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
```

- Tapping the card body (not a button) toggles selection: `setSelectedIndex(i === selectedIndex ? null : i)`
- Tapping a button (`e.stopPropagation()` already present) does not affect selection
- When a voice is rerolled (`onReroll`), clear selection: `setSelectedIndex(null)` before calling `onReroll(i)`

### Button visibility

Reroll and mute buttons are currently `opacity-0 group-hover:opacity-100`. Change to:

```
// when this card is selected on mobile
opacity-100 md:opacity-0 md:group-hover:opacity-100

// when not selected
opacity-0 group-hover:opacity-100
```

The desktop hover-only behavior is preserved via `md:group-hover:opacity-100`.

### New prop

```typescript
onSelectedVoiceChange?: (voice: SoundscapeVoice | null) => void;
```

Optional — defaults to a no-op so existing call sites without it continue to compile. Called in the same handler that updates `selectedIndex`. Passes the `SoundscapeVoice` when a card is selected, `null` when deselected.

---

## Mobile Info Panel (MapView)

### State

```typescript
const [selectedVoice, setSelectedVoice] = useState<SoundscapeVoice | null>(null);
```

Passed to `SoundscapeGrid` as `onSelectedVoiceChange={setSelectedVoice}`.

### Placement

Rendered immediately above the soundscape bar, inside the same `mobileTab` visibility gate:

```tsx
{soundscape.voices.length > 0 && (
  <>
    {selectedVoice && (
      <div className="md:hidden shrink-0 bg-gray-800 flex gap-3 px-3 py-2 items-start">
        {/* photo */}
        {/* info text */}
      </div>
    )}
    <div className={`shrink-0 bg-gray-900 ...`}>
      {/* controls + grid */}
    </div>
  </>
)}
```

### Panel content

Mirrors the desktop hover card content:

| Element | Source |
|---------|--------|
| Photo (square, 64×64px) | `voice.photo.photoUrl` (or name text if null) |
| Common name | `voice.recording.en` |
| Scientific name (italic) | `voice.sciName` |
| Attribution | `voice.photo.attribution` (omit if no photo) |
| Recordist | `voice.recording.rec` |

Layout: photo thumbnail on the left, text block on the right. Full width of the soundscape bar. `bg-gray-800` to visually separate from the `bg-gray-900` bar below.

---

## Desktop Unchanged

- `md:grid-cols-8` keeps the 8-column single-row layout
- `md:h-[110px] md:aspect-auto` restores fixed height
- `md:opacity-0 md:group-hover:opacity-100` keeps hover-only buttons
- Info panel is `md:hidden` — never shown on desktop
- Desktop hover tooltip (absolute positioned per card) is untouched

---

## Files Touched

| File | Change |
|------|--------|
| `src/components/SoundscapeGrid.tsx` | `selectedIndex` state, grid/card classes, button visibility, `onSelectedVoiceChange` prop |
| `src/components/SoundscapeGrid.test.tsx` | Tests for new selectedIndex behavior and prop |
| `src/components/MapView.tsx` | `selectedVoice` state, info panel above soundscape bar |

---

## Testing

**`SoundscapeGrid`:**
- Grid has `grid-cols-4` class (mobile-first)
- Clicking card body calls `onSelectedVoiceChange` with the voice
- Clicking card body again (same card) calls `onSelectedVoiceChange(null)`
- Clicking a different card calls `onSelectedVoiceChange` with the new voice
- Reroll button click calls `onSelectedVoiceChange(null)` then `onReroll`
- Selected card's buttons do not have `opacity-0` class
- Unselected card's buttons have `opacity-0` class

**`MapView`:** No new tests — info panel is a layout concern verified visually.
