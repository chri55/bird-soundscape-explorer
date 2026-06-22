# Mobile Soundscape Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the now-playing bird cards on mobile to a 4-column × 2-row square grid with tap-to-reveal buttons and a selected-bird info panel above the soundscape bar.

**Architecture:** `SoundscapeGrid` gains `selectedIndex` state and an optional `onSelectedVoiceChange` callback. `MapView` holds `selectedVoice` state and renders a `md:hidden` info panel above the soundscape bar when a card is selected. Desktop layout is completely unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library.

## Global Constraints

- Desktop layout unchanged — `grid-cols-8`, `h-[110px]` cards, hover-only buttons, no info panel.
- `onSelectedVoiceChange` is optional — defaults to no-op so all existing `SoundscapeGrid` call sites without the prop continue to compile and work.
- `verbatimModuleSyntax: true` — type-only imports must use `import type { ... }` on a separate line.
- Test files use Vitest globals (`describe`, `it`, `expect`, `vi`) — do NOT import them from `'vitest'`.
- The info panel is `md:hidden` — never shown on desktop.

---

### Task 1: SoundscapeGrid — grid layout, selection state, button visibility

**Files:**
- Modify: `src/components/SoundscapeGrid.tsx`
- Modify: `src/components/SoundscapeGrid.test.tsx`

**Interfaces:**
- Produces: updated `SoundscapeGridProps` with optional `onSelectedVoiceChange?: (voice: SoundscapeVoice | null) => void` — Task 2 passes this prop.

- [ ] **Step 1: Update existing test that will break**

The test `'has grid-cols-8 class on the container'` in `src/components/SoundscapeGrid.test.tsx` will fail once the grid class changes. Update it now so it becomes a failing test that drives the implementation:

Find:
```tsx
it('has grid-cols-8 class on the container', () => {
  const { container } = render(<SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
  expect(container.querySelector('.grid-cols-8')).toBeTruthy();
});
```

Replace with:
```tsx
it('has grid-cols-4 class on the container', () => {
  const { container } = render(<SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />);
  expect(container.querySelector('.grid-cols-4')).toBeTruthy();
});
```

- [ ] **Step 2: Add new failing tests**

Add these tests inside the existing `describe('SoundscapeGrid', () => {` block in `src/components/SoundscapeGrid.test.tsx`, after all existing tests:

```tsx
  it('calls onSelectedVoiceChange with voice when card is clicked', () => {
    const onSelectedVoiceChange = vi.fn();
    const voice = makeVoice();
    const { container } = render(
      <SoundscapeGrid voices={[voice]} onToggleMute={vi.fn()} onReroll={vi.fn()} onSelectedVoiceChange={onSelectedVoiceChange} />,
    );
    const grid = container.querySelector('.grid-cols-4')!;
    fireEvent.click(grid.children[0]!);
    expect(onSelectedVoiceChange).toHaveBeenCalledWith(voice);
  });

  it('calls onSelectedVoiceChange with null when same card is clicked again', () => {
    const onSelectedVoiceChange = vi.fn();
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} onSelectedVoiceChange={onSelectedVoiceChange} />,
    );
    const grid = container.querySelector('.grid-cols-4')!;
    fireEvent.click(grid.children[0]!);
    fireEvent.click(grid.children[0]!);
    expect(onSelectedVoiceChange).toHaveBeenLastCalledWith(null);
  });

  it('calls onSelectedVoiceChange with null when reroll button is clicked', () => {
    const onSelectedVoiceChange = vi.fn();
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} onSelectedVoiceChange={onSelectedVoiceChange} />,
    );
    const grid = container.querySelector('.grid-cols-4')!;
    fireEvent.click(grid.children[0]!);
    onSelectedVoiceChange.mockClear();
    fireEvent.click(container.querySelector('button[aria-label="Reroll bird"]')!);
    expect(onSelectedVoiceChange).toHaveBeenCalledWith(null);
  });

  it('selected card reroll button does not have standalone opacity-0 class', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    const grid = container.querySelector('.grid-cols-4')!;
    fireEvent.click(grid.children[0]!);
    const rerollBtn = container.querySelector('button[aria-label="Reroll bird"]')!;
    expect(rerollBtn.className.split(' ')).not.toContain('opacity-0');
  });

  it('unselected card reroll button has opacity-0 class', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    const rerollBtn = container.querySelector('button[aria-label="Reroll bird"]')!;
    expect(rerollBtn.className.split(' ')).toContain('opacity-0');
  });
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: 6 failures (1 updated test + 5 new tests). All other tests pass.

- [ ] **Step 4: Add useState import to SoundscapeGrid**

In `src/components/SoundscapeGrid.tsx`, add at the top (before the existing imports):

```tsx
import { useState } from 'react';
```

- [ ] **Step 5: Update the props interface and function signature**

Find:
```tsx
interface SoundscapeGridProps {
  voices: SoundscapeVoice[];
  onToggleMute: (index: number) => void;
  onReroll: (index: number) => void;
}

export function SoundscapeGrid({ voices, onToggleMute, onReroll }: SoundscapeGridProps) {
  if (voices.length === 0) return null;
```

Replace with:
```tsx
interface SoundscapeGridProps {
  voices: SoundscapeVoice[];
  onToggleMute: (index: number) => void;
  onReroll: (index: number) => void;
  onSelectedVoiceChange?: (voice: SoundscapeVoice | null) => void;
}

export function SoundscapeGrid({ voices, onToggleMute, onReroll, onSelectedVoiceChange }: SoundscapeGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  function handleCardClick(i: number) {
    const next = i === selectedIndex ? null : i;
    setSelectedIndex(next);
    onSelectedVoiceChange?.(next !== null ? voices[next] : null);
  }

  if (voices.length === 0) return null;
```

- [ ] **Step 6: Update grid class**

Find:
```tsx
    <div className="grid grid-cols-8 gap-2 p-1 w-full">
```

Replace with:
```tsx
    <div className="grid grid-cols-4 md:grid-cols-8 gap-2 p-1 w-full">
```

- [ ] **Step 7: Add onClick and cursor-pointer to the card wrapper**

Find:
```tsx
          <div
            key={voice.recording.id}
            className={`relative group rounded-lg ring-2 transition-all duration-300 ${
              voice.isActive ? 'ring-green-400' : 'ring-transparent'
            }`}
          >
```

Replace with:
```tsx
          <div
            key={voice.recording.id}
            onClick={() => handleCardClick(i)}
            className={`relative group rounded-lg ring-2 transition-all duration-300 cursor-pointer ${
              voice.isActive ? 'ring-green-400' : 'ring-transparent'
            }`}
          >
```

- [ ] **Step 8: Update card content div to square on mobile**

Find:
```tsx
            <div className={`relative w-full h-[110px] rounded-lg overflow-hidden bg-black/60 transition-all duration-300 ${
```

Replace with:
```tsx
            <div className={`relative w-full aspect-square md:aspect-auto md:h-[110px] rounded-lg overflow-hidden bg-black/60 transition-all duration-300 ${
```

- [ ] **Step 9: Update reroll button visibility and handler**

Find:
```tsx
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onReroll(i); }}
                aria-label="Reroll bird"
                disabled={voice.isRerolling}
                className={`absolute top-1 left-1 z-20 w-6 h-6 flex items-center justify-center rounded text-white bg-black/50 hover:bg-black/70 transition-opacity duration-150 ${
                  voice.isRerolling ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
```

Replace with:
```tsx
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setSelectedIndex(null); onSelectedVoiceChange?.(null); onReroll(i); }}
                aria-label="Reroll bird"
                disabled={voice.isRerolling}
                className={`absolute top-1 left-1 z-20 w-6 h-6 flex items-center justify-center rounded text-white bg-black/50 hover:bg-black/70 transition-opacity duration-150 ${
                  voice.isRerolling
                    ? 'opacity-100'
                    : selectedIndex === i
                      ? 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                }`}
              >
```

- [ ] **Step 10: Update mute button visibility**

Find:
```tsx
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggleMute(i); }}
                aria-label={voice.isMuted ? 'Unmute bird' : 'Mute bird'}
                className={`absolute top-1 right-1 z-20 w-6 h-6 flex items-center justify-center rounded text-white bg-black/50 hover:bg-black/70 transition-opacity duration-150 ${
                  voice.isMuted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
```

Replace with:
```tsx
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggleMute(i); }}
                aria-label={voice.isMuted ? 'Unmute bird' : 'Mute bird'}
                className={`absolute top-1 right-1 z-20 w-6 h-6 flex items-center justify-center rounded text-white bg-black/50 hover:bg-black/70 transition-opacity duration-150 ${
                  voice.isMuted
                    ? 'opacity-100'
                    : selectedIndex === i
                      ? 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                }`}
              >
```

- [ ] **Step 11: Run the SoundscapeGrid tests**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: all tests pass.

- [ ] **Step 12: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 13: Commit**

```bash
git add src/components/SoundscapeGrid.tsx src/components/SoundscapeGrid.test.tsx
git commit -m "feat: mobile 4-col square grid with tap-to-reveal buttons"
```

---

### Task 2: MapView — selectedVoice state and info panel

**Files:**
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- Consumes: `onSelectedVoiceChange?: (voice: SoundscapeVoice | null) => void` from Task 1's updated `SoundscapeGrid`.

- [ ] **Step 1: Add SoundscapeVoice type import to MapView**

In `src/components/MapView.tsx`, find the existing soundscape import line:

```tsx
import { useSoundscape, MAX_VOICES, SPARE_VOICES } from '../hooks/useSoundscape';
```

Add a new line immediately after it:

```tsx
import type { SoundscapeVoice } from '../hooks/useSoundscape';
```

- [ ] **Step 2: Add selectedVoice state**

Find the `settingsOpen` state declaration:

```tsx
  const [settingsOpen, setSettingsOpen] = useState(false);
```

Add a new line immediately after it:

```tsx
  const [selectedVoice, setSelectedVoice] = useState<SoundscapeVoice | null>(null);
```

- [ ] **Step 3: Pass onSelectedVoiceChange to SoundscapeGrid**

Find:

```tsx
            <SoundscapeGrid
              voices={soundscape.voices}
              onToggleMute={soundscape.toggleMute}
              onReroll={soundscape.rerollVoice}
            />
```

Replace with:

```tsx
            <SoundscapeGrid
              voices={soundscape.voices}
              onToggleMute={soundscape.toggleMute}
              onReroll={soundscape.rerollVoice}
              onSelectedVoiceChange={setSelectedVoice}
            />
```

- [ ] **Step 4: Add the info panel above the soundscape bar**

Find the entire soundscape bar block:

```tsx
      {soundscape.voices.length > 0 && (
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
      )}
```

Replace with:

```tsx
      {soundscape.voices.length > 0 && (
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
```

- [ ] **Step 5: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: mobile selected-bird info panel above soundscape bar"
```
