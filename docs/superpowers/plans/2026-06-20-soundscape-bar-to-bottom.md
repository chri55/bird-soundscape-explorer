# Soundscape Bar to Bottom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the soundscape "now playing" bar back to the bottom of the page, below the map.

**Architecture:** Pure JSX reorder in `MapView.tsx` — move the conditional soundscape block from between `<header>` and the map flex row to after the map flex row. No logic, no new files, no tests.

**Tech Stack:** React 19 + TypeScript, Vite 8.

## Global Constraints

- No class changes — `relative z-10` on the soundscape bar stays in place
- `npm run build` must be clean after the change

---

## File Map

| File | Action |
|---|---|
| `src/components/MapView.tsx` | Reorder JSX blocks |

---

### Task 1: Move soundscape bar below the map

**Files:**
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Open `src/components/MapView.tsx` and locate the two blocks to swap**

The file currently looks like this (simplified):

```tsx
<div className="flex flex-col h-screen">
  <header ...>...</header>

  {soundscape.voices.length > 0 && (
    <div className="shrink-0 bg-gray-900 flex items-center gap-2 px-3 py-2 relative z-10">
      ...
    </div>
  )}

  <div className="flex flex-1 overflow-hidden">
    ...map and SpeciesPanel...
  </div>
</div>
```

- [ ] **Step 2: Reorder so the soundscape bar comes after the map flex row**

The result should look like this:

```tsx
<div className="flex flex-col h-screen">
  <header ...>...</header>

  <div className="flex flex-1 overflow-hidden">
    ...map and SpeciesPanel...
  </div>

  {soundscape.voices.length > 0 && (
    <div className="shrink-0 bg-gray-900 flex items-center gap-2 px-3 py-2 relative z-10">
      ...
    </div>
  )}
</div>
```

Move the entire `{soundscape.voices.length > 0 && (...)}` block — from the `{` to the closing `)}` — to after the closing `</div>` of the `flex flex-1 overflow-hidden` row. Do not change any class names or content inside either block.

- [ ] **Step 3: Verify the build is clean**

```bash
npm run build
```

Expected: clean build, no TypeScript errors, output similar to:
```
✓ built in ~600ms
```

- [ ] **Step 4: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: move soundscape bar back to bottom of page"
```
