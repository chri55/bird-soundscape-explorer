# Loading Feedback & Source Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a soundscape bar loading skeleton immediately when a pin is dropped, and make data-source names in Settings into clickable links that open in a new tab.

**Architecture:** Task 1 changes the outer condition on the soundscape bar from `voices.length > 0` to `isLoading || voices.length > 0`, adding a skeleton branch when loading and no voices yet. Task 2 wraps each source `<dt>` text in an `<a>` tag. Both tasks are independent and touch separate files.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library.

## Global Constraints

- `verbatimModuleSyntax: true` — type-only imports must use a separate `import type` line
- Test files use Vitest globals — do NOT add `import { describe, it, expect, vi }` to test files
- YAGNI — no changes beyond what each task specifies

---

### Task 1: Soundscape bar loading skeleton

**Files:**
- Modify: `src/components/MapView.tsx` (lines 183–229 — the soundscape bar section)
- Modify: `src/components/MapView.test.tsx`

**Interfaces:**
- Consumes: `isLoading: boolean` (already in `MapView` state), `soundscape.voices.length`, `mobileTab`
- Produces: nothing consumed by Task 2

- [ ] **Step 1: Add `screen` to the import in `MapView.test.tsx`**

Current line 1:
```tsx
import { render } from '@testing-library/react';
```

Replace with:
```tsx
import { render, screen } from '@testing-library/react';
```

- [ ] **Step 2: Write the failing test**

Add this test inside the existing `describe('MapView geo-cache', ...)` block, after the last `it(...)`:

```tsx
  it('shows loading skeleton while fetch is in flight', async () => {
    vi.mocked(fetchNearbyNotable).mockReturnValueOnce(new Promise(() => {}));
    render(<MapView />);
    simulateMapClick(37.77, -122.4);
    await vi.advanceTimersByTimeAsync(500);
    expect(screen.getByRole('status', { name: 'Loading birds' })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run src/components/MapView.test.tsx
```

Expected: the new test fails with "Unable to find an accessible element with the role 'status'".

- [ ] **Step 4: Replace the soundscape bar section in `MapView.tsx`**

Find and replace the block starting at `{soundscape.voices.length > 0 && (` (currently lines 183–229). Replace the entire block with:

```tsx
      {(isLoading || soundscape.voices.length > 0) && (
        <>
          {isLoading && soundscape.voices.length === 0 ? (
            <div
              role="status"
              aria-label="Loading birds"
              className={`shrink-0 bg-gray-900 items-center gap-3 px-3 py-2 ${
                mobileTab !== 'map' ? 'hidden md:flex' : 'flex'
              }`}
            >
              <div className="w-12 h-14 rounded bg-gray-700 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-700 rounded animate-pulse w-32" />
                <div className="h-3 bg-gray-700 rounded animate-pulse w-24" />
              </div>
            </div>
          ) : (
            <>
              {selectedVoice && mobileTab === 'map' && (
                <div className="md:hidden shrink-0 bg-gray-800 flex gap-3 px-3 py-2 items-center">
                  <div className="w-16 h-16 rounded overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                    {selectedVoice.photo ? (
                      <img
                        src={selectedVoice.photo.photoUrl}
                        alt={selectedVoice.recording.en}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <p className="text-white text-xs text-center px-1">{selectedVoice.recording.en}</p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">{selectedVoice.recording.en}</p>
                    <p className="text-gray-400 text-xs italic truncate">{selectedVoice.sciName}</p>
                    {selectedVoice.photo && (
                      <p className="text-gray-500 text-xs truncate">{selectedVoice.photo.attribution}</p>
                    )}
                    <p className="text-gray-500 text-xs truncate">Rec: {selectedVoice.recording.rec}</p>
                  </div>
                </div>
              )}
              <div className={`shrink-0 bg-gray-900 items-center gap-2 px-3 py-2 relative z-10 ${
                mobileTab !== 'map' ? 'hidden md:flex' : 'flex'
              }`}>
                <SoundscapeControls
                  isPlaying={soundscape.isPlaying}
                  voiceCount={soundscape.voices.length}
                  loadedCount={soundscape.loadedCount}
                  allMuted={soundscape.allMuted}
                  onToggle={soundscape.toggle}
                  onMuteAll={soundscape.muteAll}
                />
                <div className="flex-1 min-w-0 relative z-10">
                  <SoundscapeGrid
                    voices={soundscape.voices}
                    onToggleMute={soundscape.toggleMute}
                    onReroll={soundscape.rerollVoice}
                    onSelectedVoiceChange={setSelectedVoice}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/components/MapView.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/MapView.tsx src/components/MapView.test.tsx
git commit -m "feat: show loading skeleton in soundscape bar while fetching"
```

---

### Task 2: Source links in Settings

**Files:**
- Modify: `src/components/SettingsModal.tsx` (lines 148–167 — the About `<dl>`)
- Modify: `src/components/SettingsModal.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1
- Produces: nothing

- [ ] **Step 1: Write the failing test**

Add a new `it` block to `src/components/SettingsModal.test.tsx`, after the existing "renders About section with data sources" test:

```tsx
  it('source names in About section are links that open in a new tab', () => {
    render(<SettingsModal {...baseProps} />);
    const sources: [string, string][] = [
      ['eBird', 'https://ebird.org'],
      ['Xeno-canto', 'https://xeno-canto.org'],
      ['iNaturalist', 'https://www.inaturalist.org'],
      ['National Park Service', 'https://www.nps.gov'],
      ['OpenStreetMap', 'https://www.openstreetmap.org'],
    ];
    for (const [name, href] of sources) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/components/SettingsModal.test.tsx
```

Expected: the new test fails with "Unable to find an accessible element with the role 'link' and name 'eBird'".

- [ ] **Step 3: Update the About `<dl>` in `SettingsModal.tsx`**

Replace the `<dl>` block (lines 147–169) with:

```tsx
            <dl className="space-y-1 text-sm text-gray-400">
              <div>
                <dt className="inline">
                  <a href="https://ebird.org" target="_blank" rel="noopener noreferrer"
                     className="font-medium text-gray-300 hover:underline">eBird</a>
                </dt>
                <dd className="inline"> (Cornell Lab of Ornithology) — Recent bird sighting data</dd>
              </div>
              <div>
                <dt className="inline">
                  <a href="https://xeno-canto.org" target="_blank" rel="noopener noreferrer"
                     className="font-medium text-gray-300 hover:underline">Xeno-canto</a>
                </dt>
                <dd className="inline"> — Bird audio recordings</dd>
              </div>
              <div>
                <dt className="inline">
                  <a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer"
                     className="font-medium text-gray-300 hover:underline">iNaturalist</a>
                </dt>
                <dd className="inline"> — Bird photos</dd>
              </div>
              <div>
                <dt className="inline">
                  <a href="https://www.nps.gov" target="_blank" rel="noopener noreferrer"
                     className="font-medium text-gray-300 hover:underline">National Park Service</a>
                </dt>
                <dd className="inline"> — Park locations</dd>
              </div>
              <div>
                <dt className="inline">
                  <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer"
                     className="font-medium text-gray-300 hover:underline">OpenStreetMap</a>
                </dt>
                <dd className="inline"> — Map tiles</dd>
              </div>
            </dl>
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/components/SettingsModal.test.tsx
```

Expected: all tests pass including the new link test.

- [ ] **Step 5: Run the full suite to check for regressions**

```bash
npm test
```

Expected: all 229 tests across 21 files pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsModal.tsx src/components/SettingsModal.test.tsx
git commit -m "feat: make data source names in Settings into external links"
```
