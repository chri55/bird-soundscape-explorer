# Accessibility Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified WCAG 2.1 AA gaps, code cleanliness issues, and keyboard accessibility bugs across the app — surgical changes only, no new features.

**Architecture:** Four independent task groups covering (1) SoundscapeGrid keyboard access, (2) SettingsModal dialog semantics + focus trap, (3) SpeciesDetail/SpeciesListRow label and cast fixes, (4) color contrast. Tasks 3 and 4 modify overlapping files but carry distinct concerns and can be reviewed separately.

**Tech Stack:** React 19 + TypeScript, Vitest + React Testing Library, Tailwind CSS v4. `verbatimModuleSyntax: true` — type-only imports must use a separate `import type` line. Test files use Vitest globals (no explicit `import ... from 'vitest'`).

## Global Constraints

- `verbatimModuleSyntax: true`: every type-only import must be `import type { ... }` on its own line
- Test files use Vitest globals — no `import { describe, it, expect, vi } from 'vitest'`
- YAGNI: no new features, no extra props, no helper abstractions beyond what each fix requires
- Run tests with: `npx vitest run src/components/<File>.test.tsx`
- Full suite: `npm run test`
- TypeScript: `npm run build` (must stay clean)

---

### Task 1: SoundscapeGrid — keyboard access + aria-hidden tooltip

**Files:**
- Modify: `src/components/SoundscapeGrid.tsx`
- Modify: `src/components/SoundscapeGrid.test.tsx`

**Interfaces:**
- Consumes: `SoundscapeVoice` (unchanged), `SoundscapeGridProps` (unchanged)
- Produces: card wrappers navigable by keyboard; tooltip hidden from screen readers

---

- [ ] **Step 1: Write the six failing tests**

Add these tests at the bottom of the `describe('SoundscapeGrid', ...)` block in `src/components/SoundscapeGrid.test.tsx`:

```tsx
  it('card wrapper has role="button" with bird name as accessible label', () => {
    render(<SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'American Robin' })).toBeInTheDocument();
  });

  it('card wrapper has tabIndex={0}', () => {
    render(<SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'American Robin' }).tabIndex).toBe(0);
  });

  it('card wrapper has aria-pressed="false" when not selected', () => {
    render(<SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'American Robin' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('pressing Enter on card wrapper fires selection callback', () => {
    const onSelectedVoiceChange = vi.fn();
    const voice = makeVoice();
    render(
      <SoundscapeGrid voices={[voice]} onToggleMute={vi.fn()} onReroll={vi.fn()} onSelectedVoiceChange={onSelectedVoiceChange} />,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'American Robin' }), { key: 'Enter' });
    expect(onSelectedVoiceChange).toHaveBeenCalledWith(voice);
  });

  it('pressing Space on card wrapper fires selection callback', () => {
    const onSelectedVoiceChange = vi.fn();
    const voice = makeVoice();
    render(
      <SoundscapeGrid voices={[voice]} onToggleMute={vi.fn()} onReroll={vi.fn()} onSelectedVoiceChange={onSelectedVoiceChange} />,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'American Robin' }), { key: ' ' });
    expect(onSelectedVoiceChange).toHaveBeenCalledWith(voice);
  });

  it('hover tooltip container has aria-hidden="true"', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
    const tooltip = container.querySelector('.absolute.bottom-full');
    expect(tooltip).toHaveAttribute('aria-hidden', 'true');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: 6 new tests FAIL (the existing tests still pass).

- [ ] **Step 3: Implement the changes in SoundscapeGrid.tsx**

In `src/components/SoundscapeGrid.tsx`, replace the card wrapper `<div>` and tooltip container `<div>` as follows.

**Card wrapper** — replace:
```tsx
          <div
            key={voice.recording.id}
            onClick={() => handleCardClick(i)}
            className={`relative group rounded-lg ring-2 transition-all duration-300 cursor-pointer ${
              voice.isActive ? 'ring-green-400' : 'ring-transparent'
            }`}
          >
```
with:
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

**Tooltip container** — replace:
```tsx
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-48 bg-gray-900 rounded-lg overflow-hidden shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 pointer-events-none">
```
with:
```tsx
            <div
              aria-hidden="true"
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-48 bg-gray-900 rounded-lg overflow-hidden shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 pointer-events-none"
            >
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: ALL tests pass including all 6 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/SoundscapeGrid.tsx src/components/SoundscapeGrid.test.tsx
git commit -m "feat: make SoundscapeGrid cards keyboard accessible with ARIA attributes"
```

---

### Task 2: SettingsModal — dialog semantics + focus trap + MapView focus return

**Files:**
- Modify: `src/components/SettingsModal.tsx`
- Modify: `src/components/SettingsModal.test.tsx`
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- Consumes: `SettingsModalProps` (unchanged — `onClose: () => void` signature stays)
- Produces: modal has `role="dialog"`, `aria-modal`, `aria-labelledby`; focus trapped on open; focus returns to gear button on close

---

- [ ] **Step 1: Write the four failing tests**

Add these tests at the bottom of the `describe('SettingsModal', ...)` block in `src/components/SettingsModal.test.tsx`:

```tsx
  it('modal div has role="dialog"', () => {
    render(<SettingsModal {...baseProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('modal div has aria-modal="true"', () => {
    render(<SettingsModal {...baseProps} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('modal heading has id="settings-modal-title" and dialog has aria-labelledby pointing to it', () => {
    render(<SettingsModal {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'settings-modal-title');
    expect(screen.getByRole('heading', { name: 'Settings' })).toHaveAttribute('id', 'settings-modal-title');
  });

  it('closes button receives focus when modal opens', () => {
    render(<SettingsModal {...baseProps} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close settings' }));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SettingsModal.test.tsx
```

Expected: 4 new tests FAIL (existing tests still pass).

- [ ] **Step 3: Implement changes in SettingsModal.tsx**

**a. Update imports** — replace:
```tsx
import { useState } from 'react';
```
with:
```tsx
import { useState, useRef, useEffect } from 'react';
```

**b. Add `modalRef` and focus-trap effect** — insert between `const [query, setQuery] = useState('');` and `if (!isOpen) return null;`:
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

**c. Add ARIA attributes to the inner modal div** — replace:
```tsx
      <div
        className="w-full h-full flex flex-col bg-gray-900 overflow-hidden md:h-auto md:max-w-lg md:mx-4 md:max-h-[90vh] md:rounded-xl"
        onClick={e => e.stopPropagation()}
      >
```
with:
```tsx
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        ref={modalRef}
        className="w-full h-full flex flex-col bg-gray-900 overflow-hidden md:h-auto md:max-w-lg md:mx-4 md:max-h-[90vh] md:rounded-xl"
        onClick={e => e.stopPropagation()}
      >
```

**d. Add `id` to the Settings heading** — replace:
```tsx
          <h2 className="text-white font-semibold">Settings</h2>
```
with:
```tsx
          <h2 id="settings-modal-title" className="text-white font-semibold">Settings</h2>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/SettingsModal.test.tsx
```

Expected: ALL tests pass including all 4 new ones.

- [ ] **Step 5: Add focus return in MapView.tsx**

MapView already imports `useRef` (line 1: `import { useState, useRef, useCallback, useEffect } from 'react';`).

**a. Add settingsButtonRef** — find the line `const [settingsOpen, setSettingsOpen] = useState(false);` and add below it:
```tsx
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
```

**b. Add ref to the gear button** — replace:
```tsx
        <button
          type="button"
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
          className={`${pin ? '' : 'ml-auto '}p-1 rounded hover:bg-green-700 transition-colors`}
        >
```
with:
```tsx
        <button
          ref={settingsButtonRef}
          type="button"
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
          className={`${pin ? '' : 'ml-auto '}p-1 rounded hover:bg-green-700 transition-colors`}
        >
```

**c. Restore focus on close** — replace:
```tsx
        onClose={() => setSettingsOpen(false)}
```
with:
```tsx
        onClose={() => { setSettingsOpen(false); settingsButtonRef.current?.focus(); }}
```

- [ ] **Step 6: Run full suite to verify no regressions**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/SettingsModal.tsx src/components/SettingsModal.test.tsx src/components/MapView.tsx
git commit -m "feat: add dialog ARIA semantics, focus trap, and focus return to SettingsModal"
```

---

### Task 3: SpeciesDetail labels + SpeciesListRow type="button" + cast removal

**Files:**
- Modify: `src/components/SpeciesDetail.tsx`
- Modify: `src/components/SpeciesDetail.test.tsx`
- Modify: `src/components/SpeciesListRow.tsx`
- Modify: `src/components/SpeciesListRow.test.tsx`

**Interfaces:**
- Consumes: `EBirdObservation` (unchanged), `onBack: () => void` (unchanged)
- Produces: back button has `aria-label`; external links announce new tab; cast removed; button has `type="button"`

---

- [ ] **Step 1: Write the failing tests**

**In `src/components/SpeciesListRow.test.tsx`** — add inside `describe('SpeciesListRow', ...)`:

```tsx
  it('button has type="button"', () => {
    render(<SpeciesListRow obs={obs} isNotable={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
```

**In `src/components/SpeciesDetail.test.tsx`** — add inside `describe('SpeciesDetail', ...)`:

```tsx
  it('back button has aria-label "Back to species list"', async () => {
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByRole('button', { name: 'Back to species list' })).toBeInTheDocument();
  });

  it('back button arrow span is aria-hidden', async () => {
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    const backBtn = screen.getByRole('button', { name: 'Back to species list' });
    const arrowSpan = backBtn.querySelector('[aria-hidden="true"]');
    expect(arrowSpan).toBeTruthy();
    expect(arrowSpan?.textContent).toBe('←');
  });

  it('eBird link announces it opens in a new tab', async () => {
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByRole('link', { name: 'eBird species page (opens in new tab)' })).toBeInTheDocument();
  });

  it('Wikipedia link announces it opens in a new tab', async () => {
    vi.mocked(fetchWikiSummary).mockResolvedValue({
      extract: 'A bird.',
      pageUrl: 'https://en.wikipedia.org/wiki/American_robin',
    });
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByRole('link', { name: 'Wikipedia (opens in new tab)' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SpeciesListRow.test.tsx src/components/SpeciesDetail.test.tsx
```

Expected: 5 new tests FAIL (existing tests still pass).

- [ ] **Step 3: Implement changes in SpeciesListRow.tsx**

Replace:
```tsx
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 flex items-start justify-between gap-2"
    >
```
with:
```tsx
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 flex items-start justify-between gap-2"
    >
```

- [ ] **Step 4: Implement changes in SpeciesDetail.tsx**

**a. Remove unnecessary cast** (line ~110) — replace:
```tsx
    audio.addEventListener('ended', () => setPlayState('idle'), { once: true } as AddEventListenerOptions);
```
with:
```tsx
    audio.addEventListener('ended', () => setPlayState('idle'), { once: true });
```

**b. Back button: add aria-label + aria-hidden arrow** — replace:
```tsx
        <button
          onClick={onBack}
          className="text-sm text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
        >
          ← Back
        </button>
```
with:
```tsx
        <button
          type="button"
          aria-label="Back to species list"
          onClick={onBack}
          className="text-sm text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
        >
          <span aria-hidden="true">←</span> Back
        </button>
```

**c. Wikipedia external link: add aria-label** — replace:
```tsx
              <a
                href={wikiSummary.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
              >
                Wikipedia ↗
              </a>
```
with:
```tsx
              <a
                href={wikiSummary.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Wikipedia (opens in new tab)"
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
              >
                Wikipedia ↗
              </a>
```

**d. eBird external link: add aria-label** — replace:
```tsx
            <a
              href={`https://ebird.org/species/${obs.speciesCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 font-medium"
            >
              eBird ↗
            </a>
```
with:
```tsx
            <a
              href={`https://ebird.org/species/${obs.speciesCode}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="eBird species page (opens in new tab)"
              className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 font-medium"
            >
              eBird ↗
            </a>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/components/SpeciesListRow.test.tsx src/components/SpeciesDetail.test.tsx
```

Expected: ALL tests pass including all 5 new ones.

Note: The existing test `it('calls onBack when back button is clicked', ...)` currently uses `screen.getByText(/Back/)`. After the change, this still finds the button by its visible text content ("← Back" → `← Back` is now `<span>←</span> Back`). The text query `/Back/` matches the text node " Back" and the span's text, so the query still resolves to the button. The test still passes.

The existing test `it('always shows eBird link', ...)` uses `screen.getByText('eBird ↗')`. The link's visible text is unchanged — the aria-label is additional metadata, not a text change. Test still passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/SpeciesDetail.tsx src/components/SpeciesDetail.test.tsx \
        src/components/SpeciesListRow.tsx src/components/SpeciesListRow.test.tsx
git commit -m "fix: add ARIA labels to back/external-link buttons, remove unnecessary type cast"
```

---

### Task 4: Color contrast — text-gray-400 → text-gray-500 on white backgrounds

**Files:**
- Modify: `src/components/SpeciesListRow.tsx`
- Modify: `src/components/SpeciesPanel.tsx`
- Modify: `src/components/SpeciesDetail.tsx`

**Interfaces:** No interface changes. Visual only: `gray-500` (#6b7280, 4.6:1 on white) replaces `gray-400` (#9ca3af, 2.7:1 on white) for these six specific instances on white/light panel backgrounds. Do NOT touch any `text-gray-400` on dark backgrounds (gray-900, gray-800 etc.) — those pass contrast already.

---

- [ ] **Step 1: No new tests**

This task changes CSS class names only. Verify correctness by running the full suite and checking the build; no new tests are needed.

- [ ] **Step 2: Fix SpeciesListRow.tsx — date/location line**

Replace:
```tsx
        <p className="text-gray-400 text-xs truncate mt-0.5">{dateStr} · {obs.locName}</p>
```
with:
```tsx
        <p className="text-gray-500 text-xs truncate mt-0.5">{dateStr} · {obs.locName}</p>
```

- [ ] **Step 3: Fix SpeciesPanel.tsx — three instances**

**Empty state ("Drop a pin…")** — replace:
```tsx
          <p className="text-gray-400 text-sm">
            Drop a pin on the map to discover birds in this area
          </p>
```
with:
```tsx
          <p className="text-gray-500 text-sm">
            Drop a pin on the map to discover birds in this area
          </p>
```

**"No matches" under Rarest Sightings** — replace:
```tsx
              {filteredNotable.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No matches</p>
```
with:
```tsx
              {filteredNotable.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">No matches</p>
```

**"No matches" under Most Common** — replace:
```tsx
              {filteredRecent.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No matches</p>
```
with:
```tsx
              {filteredRecent.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">No matches</p>
```

- [ ] **Step 4: Fix SpeciesDetail.tsx — two instances**

**Wikipedia section label** — replace:
```tsx
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Wikipedia</p>
```
with:
```tsx
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Wikipedia</p>
```

**Photo attribution container** — replace:
```tsx
            <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
```
with:
```tsx
            <div className="px-4 py-3 text-xs text-gray-500 border-t border-gray-100">
```

- [ ] **Step 5: Run the full test suite and build**

```bash
npm run test && npm run build
```

Expected: all tests pass, build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/SpeciesListRow.tsx src/components/SpeciesPanel.tsx src/components/SpeciesDetail.tsx
git commit -m "fix: improve text contrast on white panels (gray-400 → gray-500, WCAG AA)"
```
