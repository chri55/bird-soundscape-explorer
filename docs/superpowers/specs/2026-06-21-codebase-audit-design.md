# Codebase Audit Design

## Goal

Run four parallel subagent reviews of the Bird Soundscape Explorer codebase, one per domain. Each agent reads `src/`, surfaces its top 3–5 notable findings, and writes a self-contained implementation plan that can be executed independently via SDD.

## Scope

Each agent reads the full `src/` directory. No agent reads `docs/`, test fixtures, or config files unless a specific finding leads there. Agents focus on production source code; test files are only in scope when a finding is specifically about test quality.

---

## Agent 1: Code Cleanliness

**Mandate:** Find things that would confuse a new contributor or make the codebase harder to evolve.

**Focus areas (in priority order):**
1. Functions or hooks doing more than one thing — candidates for extraction
2. Duplicated logic across files that could be a shared utility
3. Naming inconsistencies — identifiers that don't match what they do
4. Dead code or unused exports
5. Inconsistent patterns across similar files (e.g., two API clients structured differently for no reason)

**Excluded:** Style nitpicks (spacing, import order), things already consistent with the rest of the file, minor naming preferences.

**Output:** `docs/superpowers/plans/2026-06-21-cleanliness-improvements.md`

---

## Agent 2: Security

**Mandate:** Find exploitable vulnerabilities and data-exposure risks in a client-only React app with three third-party API integrations.

**Focus areas (in priority order):**
1. API key exposure — keys live in `import.meta.env` (VITE_ prefix) which means they are bundled into the client; assess actual risk given the APIs and any rate-limiting/key-scoping available
2. XSS surfaces — any place where user-supplied or API-supplied data is rendered as HTML or used unsanitized in JSX
3. Input sanitization at user-facing boundaries — map click coordinates, any text inputs
4. `localStorage` data handling — what's stored, whether it could be poisoned by a third party, and whether it's deserialized unsafely
5. Known CVEs in direct dependencies — only flag if a package version in `package.json` has a published CVE; don't speculate

**Excluded:** HTTPS/TLS (handled by hosting), CORS (handled by the APIs themselves), authentication (no auth in v1).

**Output:** `docs/superpowers/plans/2026-06-21-security-improvements.md`

---

## Agent 3: Performance

**Mandate:** Find places where the app does unnecessary work that a user would notice at scale or on a typical mobile device.

**Focus areas (in priority order):**
1. Audio resource lifecycle in `useSoundscape` — are `HTMLAudioElement` instances cleaned up when recordings change? Leak risk when the user clicks a new pin?
2. Unnecessary re-renders — missing `useMemo`/`useCallback`/`React.memo` where the component tree re-renders for unchanged data
3. Map/marker rendering — what happens when `useNpsParks` returns hundreds of park markers? Is there any virtualization or clustering concern?
4. Bundle size contributors — any large dependencies that could be lazy-loaded or replaced with a lighter alternative
5. Fetch concurrency — are parallel API calls (eBird + XC + NPS) structured optimally, or is there a sequential waterfall?

**Excluded:** Micro-optimizations (sub-millisecond gains), server-side concerns (no backend), premature optimization of code paths that aren't on the critical path.

**Output:** `docs/superpowers/plans/2026-06-21-performance-improvements.md`

---

## Agent 4: Bugs

**Mandate:** Find logic errors, race conditions, and unhandled edge cases that would cause incorrect behavior for a real user.

**Focus areas (in priority order):**
1. Race conditions in `MapView` — rapid pin clicks trigger overlapping fetch chains; does `lastFetchRef` debounce protect against stale state being applied out of order?
2. Unhandled promise rejections — any `async` functions that could reject without a catch, leaving the UI in a broken state
3. Soundscape stagger/retry logic — edge cases in `useSoundscape` when recordings change mid-playback, or when `toggle()` is called before audio loads
4. TypeScript unsafe casts — `as any`, `as unknown as T`, non-null assertions (`!`) used where the value could genuinely be null/undefined
5. eBird/XC API response validation — does the app handle malformed or partial API responses gracefully, or do they throw at the parsing layer?

**Excluded:** Visual/UX bugs (wrong color, layout glitch), test bugs, hypothetical bugs in code paths that don't exist yet.

**Output:** `docs/superpowers/plans/2026-06-21-bugs-improvements.md`

---

## Plan File Format

Each agent writes a plan file following the standard implementation plan format:

```markdown
# [Area] Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence]

**Findings summary:** [1 paragraph — what was found and why it matters]

## Global Constraints
[Project-wide constraints relevant to fixes in this area]

---

### Task 1: [Most impactful fix first]
[Standard task format with files, steps, test steps, commit]

### Task 2: ...
```

Tasks are ordered by impact — most valuable fix first — so the plan can be stopped partway and still deliver the highest-value improvements.

---

## Execution

All four agents launch in parallel (no inter-dependencies between domains). Each agent:
1. Reads `src/` in full
2. Identifies top 3–5 notable findings in its domain
3. Writes a self-contained implementation plan
4. Does not implement any fixes — review and planning only

Plans land in `docs/superpowers/plans/` and are executed independently via SDD in a future session, in whatever order the user chooses.
