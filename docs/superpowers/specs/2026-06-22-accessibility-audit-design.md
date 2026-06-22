# Accessibility Audit Design

## Goal

Fix all identified bugs, code cleanliness issues, and WCAG 2.1 AA accessibility gaps across the app. No new features — surgical fixes only.

---

## Bugs & Code Cleanliness

### 1. Unnecessary type cast in SpeciesDetail

`src/components/SpeciesDetail.tsx` line 110:

```tsx
audio.addEventListener('ended', () => setPlayState('idle'), { once: true } as AddEventListenerOptions);
```

`{ once: true }` is already valid `AddEventListenerOptions` without the cast. Remove `as AddEventListenerOptions`.

### 2. Missing `type="button"` on SpeciesListRow button

`src/components/SpeciesListRow.tsx` line 17: `<button onClick={onClick} className="...">` is missing `type="button"`. Without it, a button inside a form defaults to `type="submit"`. Add `type="button"`.

---

## Accessibility — Keyboard & Screen Reader Structure

### 3. SoundscapeGrid card wrappers: keyboard inaccessible

**Problem:** Each bird card is a `<div onClick>`. Div elements with click handlers are invisible to keyboard users (no Tab stop) and screen readers (no role). The cards contain `<button>` elements (reroll/mute), so the outer wrapper cannot become a `<button>` itself (nested buttons are invalid HTML).

**Fix:** Add to the card wrapper div:
- `role="button"`
- `tabIndex={0}`
- `aria-label={voice.recording.en}` — announces the bird name when focused
- `aria-pressed={selectedIndex === i}` — announces selected state
- `onKeyDown` handler: trigger `handleCardClick(i)` on `Enter` or `Space`

```tsx
<div
  key={voice.recording.id}
  role="button"
  tabIndex={0}
  aria-label={voice.recording.en}
  aria-pressed={selectedIndex === i}
  onClick={() => handleCardClick(i)}
  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(i); } }}
  className={`relative group rounded-lg ring-2 transition-all duration-300 cursor-pointer ${
    voice.isActive ? 'ring-green-400' : 'ring-transparent'
  }`}
>
```

### 4. SoundscapeGrid hover tooltip: always in DOM without aria-hidden

**Problem:** The `.absolute.bottom-full` tooltip div (the desktop hover card) is always rendered in the DOM. It is CSS-invisible (`opacity-0 invisible`) but screen readers still read its content, duplicating information already available elsewhere.

**Fix:** Add `aria-hidden="true"` to the tooltip container div:

```tsx
<div
  aria-hidden="true"
  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-48 bg-gray-900 ..."
>
```

### 5. SettingsModal: missing dialog semantics and focus trap

**Problem:** The modal has no `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby`, no focus trap, and does not restore focus on close. Screen readers don't know it's a modal; Tab key escapes into background content.

**Fix — three parts:**

**a. Dialog attributes** on the inner modal div:

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="settings-modal-title"
  ...
>
  <h2 id="settings-modal-title" ...>Settings</h2>
```

**b. Focus trap** — `useRef` + `useEffect` inside `SettingsModal`. On open, focus the first focusable element. On `keydown`, intercept Tab/Shift+Tab and cycle focus within the modal.

```tsx
const modalRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!isOpen) return;
  const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
    'button, input, a[href], [tabindex]:not([tabindex="-1"])',
  );
  if (!focusable?.length) return;
  focusable[0].focus();

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const first = focusable![0];
    const last = focusable![focusable!.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}, [isOpen]);
```

**c. Focus return** — In `MapView`, store a ref to the gear button and restore focus on modal close:

```tsx
const settingsButtonRef = useRef<HTMLButtonElement>(null);

// In the gear button JSX:
<button ref={settingsButtonRef} ... onClick={() => setSettingsOpen(true)}>

// Pass to SettingsModal:
<SettingsModal ... onClose={() => { setSettingsOpen(false); settingsButtonRef.current?.focus(); }} />
```

---

## Accessibility — Screen Reader Labels

### 6. Back button arrow character in SpeciesDetail

**Problem:** `← Back` — the `←` character is read aloud by some screen readers as "left-pointing arrow" or "leftwards arrow".

**Fix:** Wrap the arrow in `<span aria-hidden="true">`:

```tsx
<button onClick={onBack} aria-label="Back to species list" ...>
  <span aria-hidden="true">←</span> Back
</button>
```

### 7. External links opening in new tab without announcement

**Problem:** "Wikipedia ↗" and "eBird ↗" links in SpeciesDetail use `target="_blank"` but don't announce to screen readers that a new tab opens. The `↗` glyph is also read aloud.

**Fix:** Add descriptive `aria-label` to each external link:

```tsx
<a href={wikiSummary.pageUrl} target="_blank" rel="noopener noreferrer"
   aria-label="Wikipedia (opens in new tab)" ...>
  Wikipedia ↗
</a>
<a href={`https://ebird.org/species/${obs.speciesCode}`} target="_blank" rel="noopener noreferrer"
   aria-label="eBird species page (opens in new tab)" ...>
  eBird ↗
</a>
```

---

## Accessibility — Color Contrast

### 8. `text-gray-400` on white backgrounds fails WCAG AA

**Problem:** Tailwind `gray-400` is `#9ca3af`. On white (`#ffffff`) the contrast ratio is ~2.7:1. WCAG 2.1 AA requires 4.5:1 for normal text (under 18px regular or 14px bold).

`gray-400` on **dark** backgrounds passes (e.g. on `gray-900` it's ~4.9:1). Only instances on white/light backgrounds need fixing.

**Fix:** Replace `text-gray-400` with `text-gray-500` (`#6b7280`, 4.6:1 on white — passes AA) in these specific locations:

| File | Description |
|------|-------------|
| `SpeciesListRow.tsx` line 24 | Date/location line |
| `SpeciesPanel.tsx` line 52 | "Drop a pin…" empty state |
| `SpeciesPanel.tsx` line 103 | "No matches" under Rarest Sightings |
| `SpeciesPanel.tsx` line 124 | "No matches" under Most Common |
| `SpeciesDetail.tsx` line 166 | "Wikipedia" section label |
| `SpeciesDetail.tsx` line 239 | Photo attribution |

**Do NOT change** `text-gray-400` instances on dark backgrounds (SoundscapeGrid tooltip, SettingsModal About section, MapView info panel, MobileTabBar inactive tabs — all pass on their dark backgrounds).

---

## Files Touched

| File | Changes |
|------|---------|
| `src/components/SoundscapeGrid.tsx` | Card wrapper: role/tabIndex/aria-label/aria-pressed/onKeyDown; tooltip: aria-hidden |
| `src/components/SoundscapeGrid.test.tsx` | Tests for keyboard access and aria attributes |
| `src/components/SettingsModal.tsx` | role/aria-modal/aria-labelledby on modal div; id on h2; useRef + focus trap useEffect |
| `src/components/SettingsModal.test.tsx` | Tests for dialog role, aria-modal, focus on open |
| `src/components/MapView.tsx` | settingsButtonRef on gear button; focus restore on modal close |
| `src/components/SpeciesDetail.tsx` | Back button aria-label + aria-hidden on arrow; external link aria-labels; remove unnecessary cast |
| `src/components/SpeciesListRow.tsx` | Add `type="button"`; bump gray-400 → gray-500 on date line |
| `src/components/SpeciesPanel.tsx` | Bump gray-400 → gray-500 on empty/no-match text |

---

## Testing

**SoundscapeGrid:**
- Card wrapper has `role="button"`
- Card wrapper has `tabIndex={0}`
- Card wrapper has `aria-label` equal to bird common name
- Pressing Enter on card wrapper calls `handleCardClick`
- Tooltip container has `aria-hidden="true"`

**SettingsModal:**
- Modal div has `role="dialog"`
- Modal div has `aria-modal="true"`
- Modal h2 has `id="settings-modal-title"`
- Modal div has `aria-labelledby="settings-modal-title"`

**SpeciesDetail, SpeciesListRow, SpeciesPanel:** No new tests — changes are attribute additions and class substitutions verified visually and via existing tests.

---

## What Does NOT Change

- Desktop layout unchanged
- Mobile layout unchanged
- All Tailwind `text-gray-400` instances on dark backgrounds are left as-is
- No visual design changes beyond the gray-400 → gray-500 text bump on white panels
