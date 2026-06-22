# Mobile Polish Design

## Goal

Five targeted mobile UI improvements to reduce clutter, improve touch targets, and fix layout issues on narrow screens. Desktop layout is completely unchanged for all five items.

---

## 1. Hide "X birds ready/playing" text on mobile

The `SoundscapeControls` component renders a `<span>` showing `"{loadedCount} birds playing"` or `"{loadedCount} birds ready"`. On mobile the soundscape bar is compact and this text consumes horizontal space without adding value. Add `hidden md:inline` to the span so it is invisible on mobile and unchanged on desktop.

**File:** `src/components/SoundscapeControls.tsx`

---

## 2. Remove card name overlay on mobile

Each bird card in `SoundscapeGrid` has an `absolute bottom-0` div containing the bird's common name. On mobile, the tap-to-select info panel above the soundscape bar already shows the name (plus photo, scientific name, recordist). The overlay is redundant. Add `hidden md:block` to that bottom-overlay div so it is invisible on mobile and unchanged on desktop.

**File:** `src/components/SoundscapeGrid.tsx`

---

## 3. SoundscapeControls button redesign — stacked rectangles

Replace the current `w-12 h-12 rounded-full` play button + tiny `"Mute"/"Unmute"` text link with two stacked rectangular buttons. This is a global change (both mobile and desktop) that improves touch-target size.

### Layout

```
┌────────────┐
│  ▶ / ❚❚    │  ← play/pause button
├────────────┤
│  Mute      │  ← mute button
└────────────┘
```

Two `<button>` elements inside a `flex flex-col gap-1` wrapper, each `w-12 h-7` with `rounded`.

### Play/pause button

- Active (playing): `bg-green-500 hover:bg-green-600 text-white`
- Inactive (paused): `bg-white hover:bg-gray-100 text-gray-900`
- Icon: `faPlay` / `faPause` (unchanged)

### Mute button

- Unmuted: `bg-white hover:bg-gray-100 text-gray-900 text-xs`
- Muted: `bg-red-200 hover:bg-red-300 text-red-800 text-xs`
- Label text: `"Mute"` when unmuted, `"Unmute"` when muted

Remove the outer `flex flex-col items-center gap-1` wrapper around the old circle + text pair. The new `flex flex-col gap-1` wraps both new buttons.

**File:** `src/components/SoundscapeControls.tsx`

---

## 4. Settings modal full-screen on mobile

On mobile, the settings modal should fill the entire viewport. On desktop it stays as a centered card.

### Modal inner div class changes

| | Mobile | Desktop (`md:`) |
|---|---|---|
| Width | `w-full` | `max-w-lg w-full mx-4` |
| Height | `h-full` | `max-h-[90vh]` |
| Corners | none | `rounded-xl` |

Combined class: `w-full h-full md:max-w-lg md:w-auto md:mx-4 md:max-h-[90vh] md:rounded-xl flex flex-col bg-gray-900 overflow-hidden`

The existing `flex items-center justify-center` on the backdrop div is fine — on desktop it centers the card; on mobile `h-full` makes the modal fill the space regardless.

### X button

Make the close button larger on mobile. Change `p-1 text-gray-400 hover:text-white` to `p-2 text-gray-400 hover:text-white text-lg`.

**File:** `src/components/SettingsModal.tsx`

---

## 5. Coordinates stay on one line in the header

The header in `MapView` has a `flex items-center` row: title → coordinates → gear icon. On narrow screens the coordinate string (`37.7749, -122.4194`) can wrap internally at the space after the comma, and the title may push items out of alignment.

### Fix

- Add `whitespace-nowrap shrink-0` to the coordinate `<span>` so it never wraps.
- Add `min-w-0 truncate` to the title `<span>` so it shrinks and truncates rather than pushing the coordinates off screen.

**File:** `src/components/MapView.tsx`

---

## Files Touched

| File | Change |
|------|--------|
| `src/components/SoundscapeControls.tsx` | Hide count text on mobile; redesign buttons as stacked rectangles |
| `src/components/SoundscapeGrid.tsx` | Hide card name overlay on mobile |
| `src/components/SettingsModal.tsx` | Full-screen on mobile; larger X button |
| `src/components/MapView.tsx` | Header coordinates: `whitespace-nowrap shrink-0`; title: `min-w-0 truncate` |

---

## Testing

**`SoundscapeControls`:**
- Play button has `bg-green-500` class when playing, `bg-white` when paused
- Mute button has `bg-red-200` class when `allMuted` is true
- Mute button has `bg-white` class when `allMuted` is false
- Count span has `hidden` class (hidden on mobile by default in jsdom)

**`SoundscapeGrid`:**
- Name overlay div has `hidden` class (hidden on mobile by default)

**`SettingsModal`:**
- Inner modal div has `h-full` class (mobile full-screen)
- Inner modal div has `md:max-h-[90vh]` class (desktop unchanged)

**`MapView`:** Layout fixes are visual — no new tests needed.

---

## Desktop Unchanged

- Count text: `md:inline` restores it
- Card name overlay: `md:block` restores it
- Button shapes: new rectangles are global (desktop also gets the improved buttons)
- Settings modal: `md:rounded-xl md:max-h-[90vh] md:mx-4 md:max-w-lg` restores card layout
- Header: title truncation only triggers when there's not enough space; coordinates never wrap
