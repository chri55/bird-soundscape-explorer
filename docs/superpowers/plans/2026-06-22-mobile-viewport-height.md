# Mobile Viewport Height Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `h-screen` with `h-dvh` on the root container so the app fits the visible viewport on mobile browsers.

**Architecture:** The root `div` in `MapView.tsx` uses `h-screen` (`100vh`), which on mobile includes the browser's UI chrome. Changing to `h-dvh` (`100dvh`) makes the app always fill the currently visible height. All child layout is relative and adjusts automatically — no other changes needed.

**Tech Stack:** React 19, Tailwind CSS v4.

## Global Constraints

- Tailwind CSS v4 is used via `@tailwindcss/vite` — `h-dvh` is a built-in utility, no config needed.
- Do not touch any file other than `src/components/MapView.tsx`.

---

### Task 1: Replace `h-screen` with `h-dvh` in MapView

**Files:**
- Modify: `src/components/MapView.tsx` (line 123 — the root `div` of the `return` statement)

**Interfaces:**
- Consumes: nothing
- Produces: nothing (visual-only change)

Note: `h-dvh` is a CSS layout change — jsdom does not implement viewport units, so there is no meaningful unit test to write. Verification is by running the full existing test suite (to confirm no regressions) and visual inspection on mobile.

- [ ] **Step 1: Make the change**

In `src/components/MapView.tsx`, find the root `div` of the `return` statement (currently line 123):

```tsx
    <div className="flex flex-col h-screen">
```

Change it to:

```tsx
    <div className="flex flex-col h-dvh">
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass (228 tests across 21 files).

- [ ] **Step 3: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "fix: use h-dvh so app fits visible viewport on mobile browsers"
```
