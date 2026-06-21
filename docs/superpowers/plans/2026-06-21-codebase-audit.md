# Codebase Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Parallelism note:** Tasks 1–4 are fully independent. If your execution method supports parallel dispatch, run all four simultaneously.

**Goal:** Produce four focused improvement plans — one each for code cleanliness, security, performance, and bugs — by dispatching a dedicated review agent per domain.

**Architecture:** Four review-only agents each read `src/` in full, surface their top 3–5 notable findings, and write a self-contained implementation plan to `docs/superpowers/plans/`. No fixes are implemented here; the output plans are executed independently in future sessions.

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest, Wouter. Codebase: `/Users/chris/dev/bird-soundscape`.

## Global Constraints

- Agents read `src/` only (plus `package.json` for security). Do not modify any source file.
- Each agent writes exactly one plan file and commits it.
- Plan files follow the standard format (see each task's Step 1).
- 3–5 findings per agent, ordered by impact (most impactful first).
- Agents must NOT implement any fixes — review and planning only.

---

### Task 1: Code Cleanliness Review

**Files:**
- Create: `docs/superpowers/plans/2026-06-21-cleanliness-improvements.md`

**Interfaces:**
- Produces: A self-contained implementation plan for cleanliness fixes, consumed directly by SDD when executed.

- [ ] **Step 1: Dispatch the cleanliness review agent**

Dispatch a general-purpose subagent (model: `sonnet`) with this prompt:

```
You are a senior engineer doing a focused code cleanliness review of a React 19 + TypeScript project.

Project: Bird Soundscape Explorer
Location: /Users/chris/dev/bird-soundscape
Focus: src/ directory only

## Your Mandate

Read the full src/ directory and identify the top 3–5 code cleanliness issues. Focus on:
1. Functions or hooks doing more than one thing — candidates for extraction
2. Duplicated logic across files that could be a shared utility
3. Naming inconsistencies — identifiers whose names don't match what they do
4. Dead code or unused exports
5. Inconsistent patterns across similar files (e.g., two API clients structured differently for no reason)

Ignore: style nitpicks (spacing, import order), things consistent within their own file, minor naming preferences.

## What to Read

Read all files in src/ — pay particular attention to:
- src/hooks/ (useSoundscape.ts is large and complex)
- src/api/ (three clients that should follow the same pattern)
- src/components/ (MapView.tsx is the largest component)
- src/utils/

## What to Produce

Write a self-contained implementation plan to:
  docs/superpowers/plans/2026-06-21-cleanliness-improvements.md

The plan must follow this exact format:

```markdown
# Code Cleanliness Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence]

**Findings summary:** [1 paragraph — what was found and why it matters]

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest

## Global Constraints

- verbatimModuleSyntax: true — type-only imports must use `import type { ... }` on a separate line
- Hook tests in src/hooks/ use Vitest globals (no explicit imports); API tests in src/api/ import explicitly from 'vitest'
- Run tests: `npm run test`; single file: `npx vitest run src/path/to/file.test.ts`

---

### Task 1: [Most impactful finding — fix title]

**Files:**
- Modify: `src/path/to/file.ts`

- [ ] **Step 1: [action]**
[Exact code or command]

- [ ] **Step 2: Run tests**
`npm run test`
Expected: all tests pass

- [ ] **Step 3: Commit**
`git commit -m "refactor: [description]"`

### Task 2: ...
```

Tasks must be ordered by impact (most valuable first). Each task must contain actual code or commands — no placeholders.

## Constraints

- Do NOT implement any fixes. Write the plan only.
- After writing the plan file, commit it:
  `git add docs/superpowers/plans/2026-06-21-cleanliness-improvements.md && git commit -m "docs: add code cleanliness improvement plan"`

## Report back with:
- Status: DONE | BLOCKED
- Path to plan file written
- One-line summary of your top finding
```

- [ ] **Step 2: Verify plan file was written**

```bash
ls docs/superpowers/plans/2026-06-21-cleanliness-improvements.md
```

Expected: file exists with content. If missing, re-dispatch with more context.

---

### Task 2: Security Review

**Files:**
- Create: `docs/superpowers/plans/2026-06-21-security-improvements.md`

**Interfaces:**
- Produces: A self-contained implementation plan for security fixes.

- [ ] **Step 1: Dispatch the security review agent**

Dispatch a general-purpose subagent (model: `sonnet`) with this prompt:

```
You are a senior security engineer doing a focused security review of a client-only React 19 + TypeScript SPA.

Project: Bird Soundscape Explorer
Location: /Users/chris/dev/bird-soundscape
Focus: src/ directory + package.json

## Your Mandate

Read the full src/ directory and package.json. Identify the top 3–5 security issues. Focus on:
1. API key exposure — keys live in import.meta.env (VITE_ prefix), which means they are bundled into the client JS. Assess actual risk: which APIs use these keys, what can an attacker do with them, and is there any scoping/rate-limiting?
2. XSS surfaces — any place where API-supplied data (species names, recording titles, park names) is rendered as HTML or used unsanitized in JSX (dangerouslySetInnerHTML, href/src from API data, etc.)
3. Input sanitization — map click coordinates, any text inputs, query parameters passed to API calls
4. localStorage data handling — what's stored, could it be poisoned by a compromised API response, and is it deserialized unsafely (JSON.parse without validation)
5. Known CVEs in package.json — only flag if a specific package version has a published CVE you can name. Do not speculate.

Excluded: HTTPS/TLS (handled by hosting), CORS (handled by the APIs), authentication (no auth in v1).

## What to Read

- src/api/ — all three API clients (how keys are sent, how responses are parsed)
- src/components/ — all JSX (look for dangerouslySetInnerHTML, href/src from API data)
- src/hooks/ — localStorage use in useNpsParks, audio src assignment in useSoundscape
- package.json — dependency versions

## What to Produce

Write a self-contained implementation plan to:
  docs/superpowers/plans/2026-06-21-security-improvements.md

The plan must follow this exact format:

```markdown
# Security Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence]

**Findings summary:** [1 paragraph — what was found and why it matters]

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest

## Global Constraints

- verbatimModuleSyntax: true — type-only imports must use `import type { ... }` on a separate line
- Run tests: `npm run test`

---

### Task 1: [Most critical finding — fix title]

**Files:**
- Modify: `src/path/to/file.ts`

- [ ] **Step 1: [action]**
[Exact code or command]

- [ ] **Step 2: Run tests**
`npm run test`
Expected: all tests pass

- [ ] **Step 3: Commit**
`git commit -m "fix: [security description]"`

### Task 2: ...
```

Tasks must be ordered by severity (most critical first). Each task must contain actual code or commands — no placeholders. If a finding is informational only (e.g., "API keys are bundled but this is unavoidable in client-only SPAs"), write it as a documentation task (add a comment or README note explaining the accepted risk).

## Constraints

- Do NOT implement any fixes. Write the plan only.
- After writing the plan file, commit it:
  `git add docs/superpowers/plans/2026-06-21-security-improvements.md && git commit -m "docs: add security improvement plan"`

## Report back with:
- Status: DONE | BLOCKED
- Path to plan file written
- One-line summary of your most critical finding
```

- [ ] **Step 2: Verify plan file was written**

```bash
ls docs/superpowers/plans/2026-06-21-security-improvements.md
```

Expected: file exists with content.

---

### Task 3: Performance Review

**Files:**
- Create: `docs/superpowers/plans/2026-06-21-performance-improvements.md`

**Interfaces:**
- Produces: A self-contained implementation plan for performance fixes.

- [ ] **Step 1: Dispatch the performance review agent**

Dispatch a general-purpose subagent (model: `sonnet`) with this prompt:

```
You are a senior frontend performance engineer doing a focused performance review of a React 19 + TypeScript SPA.

Project: Bird Soundscape Explorer — click a map pin, hear the birds that live there (Leaflet map + Web Audio)
Location: /Users/chris/dev/bird-soundscape
Focus: src/ directory only

## Your Mandate

Read the full src/ directory and identify the top 3–5 performance issues a user would notice on a typical mobile device or when the app has been used for several minutes. Focus on:
1. Audio resource lifecycle in useSoundscape — are HTMLAudioElement instances cleaned up when recordings change (new pin clicked)? Could there be a leak of Audio objects and event listeners?
2. Unnecessary re-renders — missing useMemo/useCallback/React.memo where the component tree re-renders for unchanged data
3. Map/marker rendering — useNpsParks loads all US national parks (~500 markers). Is every park rendered as a Leaflet Marker? What's the cost at that scale?
4. Bundle size contributors — check imports for large dependencies that could be lazy-loaded or tree-shaken
5. Fetch concurrency — eBird + XC + NPS are called in parallel via Promise.all in MapView. Is there any unnecessary waterfall or redundant fetch?

Excluded: micro-optimizations (sub-millisecond gains), server-side concerns (no backend), premature optimization of cold paths.

## What to Read

Read all files in src/ — pay particular attention to:
- src/hooks/useSoundscape.ts (audio lifecycle, the largest hook)
- src/hooks/useNpsParks.ts (marker data, localStorage cache)
- src/components/MapView.tsx (fetch orchestration, Leaflet rendering)
- src/components/SoundscapeGrid.tsx (grid re-render on voice updates)

## What to Produce

Write a self-contained implementation plan to:
  docs/superpowers/plans/2026-06-21-performance-improvements.md

The plan must follow this exact format:

```markdown
# Performance Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence]

**Findings summary:** [1 paragraph — what was found and why it matters]

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest, react-leaflet

## Global Constraints

- verbatimModuleSyntax: true — type-only imports must use `import type { ... }` on a separate line
- Hook tests in src/hooks/ use Vitest globals; run tests: `npm run test`

---

### Task 1: [Most impactful finding — fix title]

**Files:**
- Modify: `src/path/to/file.ts`

- [ ] **Step 1: [action]**
[Exact code or command]

- [ ] **Step 2: Run tests**
`npm run test`
Expected: all tests pass

- [ ] **Step 3: Commit**
`git commit -m "perf: [description]"`

### Task 2: ...
```

Tasks must be ordered by impact (most impactful first). Each task must contain actual code or commands — no placeholders.

## Constraints

- Do NOT implement any fixes. Write the plan only.
- After writing the plan file, commit it:
  `git add docs/superpowers/plans/2026-06-21-performance-improvements.md && git commit -m "docs: add performance improvement plan"`

## Report back with:
- Status: DONE | BLOCKED
- Path to plan file written
- One-line summary of your most impactful finding
```

- [ ] **Step 2: Verify plan file was written**

```bash
ls docs/superpowers/plans/2026-06-21-performance-improvements.md
```

Expected: file exists with content.

---

### Task 4: Bug Review

**Files:**
- Create: `docs/superpowers/plans/2026-06-21-bugs-improvements.md`

**Interfaces:**
- Produces: A self-contained implementation plan for bug fixes.

- [ ] **Step 1: Dispatch the bugs review agent**

Dispatch a general-purpose subagent (model: `sonnet`) with this prompt:

```
You are a senior engineer doing a focused bug review of a React 19 + TypeScript SPA.

Project: Bird Soundscape Explorer — click a map pin, hear the birds that live there
Location: /Users/chris/dev/bird-soundscape
Focus: src/ directory only

## Your Mandate

Read the full src/ directory and identify the top 3–5 logic errors, race conditions, or unhandled edge cases that would cause incorrect behavior for a real user. Focus on:
1. Race conditions in MapView — rapid pin clicks trigger overlapping fetch chains (fetchRecentNearby + fetchNearbyNotable + fetchRecordingsByBox all in parallel). The DEBOUNCE_MS (500ms) throttles starts but does nothing about in-flight fetches. Does a stale response arriving late overwrite a fresher one?
2. Unhandled promise rejections — any async functions that could reject without a catch, leaving the UI stuck in a loading state or silently broken
3. Soundscape edge cases — what happens if toggle() is called before audio is loaded? What if recordings change while playback is active (new pin clicked mid-listen)? Does useSoundscape clean up timers and event listeners reliably?
4. TypeScript unsafe casts — `as any`, `as unknown as T`, non-null assertions (`!`) used where the value could genuinely be null/undefined at runtime
5. API response validation — does the app crash or silently produce wrong data if eBird or XC returns a malformed response (missing field, unexpected type)?

Excluded: visual/UX bugs (wrong color, layout), test-only bugs, hypothetical bugs in code paths that don't exist yet.

## What to Read

Read all files in src/ — pay particular attention to:
- src/components/MapView.tsx (fetch orchestration, debounce, pin handling)
- src/hooks/useSoundscape.ts (toggle, startVoice, cleanup effects, timer management)
- src/api/ (all three API clients — response parsing)
- src/utils/ (any shared logic)

## What to Produce

Write a self-contained implementation plan to:
  docs/superpowers/plans/2026-06-21-bugs-improvements.md

The plan must follow this exact format:

```markdown
# Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence]

**Findings summary:** [1 paragraph — what was found and why it matters]

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest

## Global Constraints

- verbatimModuleSyntax: true — type-only imports must use `import type { ... }` on a separate line
- Hook tests in src/hooks/ use Vitest globals; API tests in src/api/ import explicitly from 'vitest'
- Run tests: `npm run test`; single file: `npx vitest run src/path/to/file.test.ts`

---

### Task 1: [Most critical bug — fix title]

**Files:**
- Modify: `src/path/to/file.ts`

- [ ] **Step 1: Write failing test**
[Exact test code]

- [ ] **Step 2: Run test to verify it fails**
`npx vitest run src/path/to/file.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement fix**
[Exact code]

- [ ] **Step 4: Run test to verify it passes**
`npx vitest run src/path/to/file.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git commit -m "fix: [description]"`

### Task 2: ...
```

Tasks must be ordered by severity (most critical first). Each task must contain actual code — no placeholders. Bug fix tasks should use TDD where the bug is testable.

## Constraints

- Do NOT implement any fixes. Write the plan only.
- After writing the plan file, commit it:
  `git add docs/superpowers/plans/2026-06-21-bugs-improvements.md && git commit -m "docs: add bug fixes improvement plan"`

## Report back with:
- Status: DONE | BLOCKED
- Path to plan file written
- One-line summary of the most critical bug found
```

- [ ] **Step 2: Verify plan file was written**

```bash
ls docs/superpowers/plans/2026-06-21-bugs-improvements.md
```

Expected: file exists with content.
