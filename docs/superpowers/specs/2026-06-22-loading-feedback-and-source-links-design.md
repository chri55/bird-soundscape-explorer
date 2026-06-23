# Loading Feedback & Source Links Design

## Overview

Two small UX improvements: (1) the soundscape bar shows a loading skeleton immediately when a pin is dropped, giving the user feedback that something is happening; (2) the data source names in the Settings About section become clickable links that open in a new tab.

---

## Feature 1: Soundscape Bar Loading State

### Current behaviour

The soundscape bar (`SoundscapeControls` + `SoundscapeGrid`) is wrapped in a condition `{soundscape.voices.length > 0 && (...)}`. When a pin is dropped, `isLoading` becomes true but voices are still empty, so the bar is invisible. The user sees no feedback until audio is ready.

### New behaviour

The bar renders whenever `isLoading || soundscape.voices.length > 0`. While `isLoading` is true and voices are still empty, it shows a loading skeleton instead of the controls. Once loading finishes:

- If voices arrived → transition to the normal controls (existing behaviour).
- If voices are empty (no birds found) → bar hides (existing behaviour).

### Loading skeleton

A single strip inside the bar area (`bg-gray-900`, same background as the normal bar), containing:

```
<div className="shrink-0 bg-gray-900 flex items-center gap-3 px-3 py-2">
  <div className="w-12 h-14 rounded bg-gray-700 animate-pulse shrink-0" />
  <div className="flex-1 space-y-2">
    <div className="h-3 bg-gray-700 rounded animate-pulse w-32" />
    <div className="h-3 bg-gray-700 rounded animate-pulse w-24" />
  </div>
</div>
```

On mobile, the skeleton is hidden when `mobileTab !== 'map'` (same visibility rule as the normal bar).

### Files changed

- Modify: `src/components/MapView.tsx`
  - Change the outer condition from `soundscape.voices.length > 0` to `isLoading || soundscape.voices.length > 0`.
  - Add a loading skeleton branch: when `isLoading && soundscape.voices.length === 0`, render the skeleton; otherwise render the existing controls.

### Tests

- `src/components/MapView.test.tsx`: add a test asserting that the loading skeleton is present while `isLoading` is true and no voices exist. Existing tests cover the normal-controls path.

---

## Feature 2: Source Links in Settings

### Current behaviour

The About section in `SettingsModal` lists four data sources as plain `<dt>` text with no interactivity.

### New behaviour

Each source name becomes an `<a>` link opening the service's home page in a new tab. The `<dt>` element is replaced by an `<a>` styled to look like the existing `font-medium text-gray-300` text, with a subtle hover underline.

### Links

| Source | URL |
|---|---|
| eBird | `https://ebird.org` |
| Xeno-canto | `https://xeno-canto.org` |
| iNaturalist | `https://www.inaturalist.org` |
| National Park Service | `https://www.nps.gov` |

All links use `target="_blank" rel="noopener noreferrer"`.

### Files changed

- Modify: `src/components/SettingsModal.tsx`
  - Keep the `<dt>` element; wrap its text content in an `<a>` tag. The `<dt>` retains `className="inline"` and the `<a>` carries the styling and link attributes:
    ```tsx
    <dt className="inline">
      <a href="https://ebird.org" target="_blank" rel="noopener noreferrer"
         className="font-medium text-gray-300 hover:underline">eBird</a>
    </dt>
    ```
  - Apply the same pattern to Xeno-canto, iNaturalist, and National Park Service.

### Tests

- `src/components/SettingsModal.test.tsx`: update the existing "renders About section with data sources" test to assert that each source name is a link with the correct `href` and `target="_blank"`.

---

## Out of scope

- Styling the links with a distinct colour (the existing `text-gray-300` is intentional — these are attribution credits, not primary navigation)
- Adding NPS or iNaturalist to `SpeciesDetail` links (not requested)
- Any change to the soundscape bar's appearance after loading completes
