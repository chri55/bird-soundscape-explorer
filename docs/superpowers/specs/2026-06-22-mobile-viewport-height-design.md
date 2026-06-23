# Mobile Viewport Height Fix Design

## Problem

The root container in `MapView.tsx` uses `h-screen` (`height: 100vh`). On mobile browsers, `100vh` equals the full viewport including the browser's navigation bar — so when the nav bar is visible, the bottom `MobileTabBar` is hidden underneath it.

## Fix

Replace `h-screen` with `h-dvh` (`height: 100dvh`) on the root `div` in `src/components/MapView.tsx`.

`100dvh` always equals the currently visible viewport height. The app resizes fluidly as the browser UI shows and hides. No other changes are needed — all child layout (`flex-col`, `flex-1`, `overflow-hidden`, `shrink-0`) is relative to the root height and will adjust automatically.

## Browser support

`dvh` is supported in Firefox 101+, Chrome 108+, Safari 15.4+. Global coverage ~96% (caniuse).

## Files changed

- Modify: `src/components/MapView.tsx` — `h-screen` → `h-dvh` (one word, line 123)

## Out of scope

- `safe-area-inset-bottom` for iOS home indicator (separate concern, not requested)
- Any changes to `MobileTabBar` or other layout components
