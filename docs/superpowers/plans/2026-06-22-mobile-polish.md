# Mobile Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five targeted mobile UI improvements — hide count text, remove card name overlay, redesign soundscape controls as stacked rectangles, make settings modal full-screen, and fix header coordinate wrapping.

**Architecture:** Pure CSS class changes and minor JSX restructuring across four existing components. No new components, no new props, no state changes. Desktop layout is completely unchanged for all five items.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library.

## Global Constraints

- Desktop layout unchanged — every mobile-only class must have an `md:` counterpart that restores desktop behavior.
- `verbatimModuleSyntax: true` — type-only imports must use `import type { ... }` on a separate line.
- Test files use Vitest globals (`describe`, `it`, `expect`, `vi`) — do NOT import them from `'vitest'`.
- Tests query DOM class strings directly (e.g. `className.includes('hidden')`) to verify Tailwind responsive classes — jsdom does not apply CSS, so asserting on class presence is the correct technique.

---

### Task 1: SoundscapeControls — hide count text and redesign buttons as stacked rectangles

**Files:**
- Modify: `src/components/SoundscapeControls.tsx`
- Modify: `src/components/SoundscapeControls.test.tsx`

**Interfaces:**
- No interface changes — `SoundscapeControlsProps` is unchanged.

- [ ] **Step 1: Add failing tests**

Open `src/components/SoundscapeControls.test.tsx`. Add these four tests inside the existing `describe('SoundscapeControls', () => {` block, after all existing tests:

```tsx
  it('count text span has hidden class (hidden on mobile)', () => {
    const { container } = render(
      <SoundscapeControls {...defaultProps} isPlaying={false} voiceCount={3} loadedCount={3} />,
    );
    const span = Array.from(container.querySelectorAll('span')).find(
      el => el.textContent?.includes('birds'),
    );
    expect(span?.className.split(' ')).toContain('hidden');
  });

  it('mute button has bg-red-200 class when allMuted is true', () => {
    render(
      <SoundscapeControls {...defaultProps} voiceCount={1} loadedCount={1} allMuted={true} />,
    );
    expect(screen.getByRole('button', { name: 'Unmute' }).className).toContain('bg-red-200');
  });

  it('mute button has bg-white class when allMuted is false', () => {
    render(
      <SoundscapeControls {...defaultProps} voiceCount={1} loadedCount={1} allMuted={false} />,
    );
    expect(screen.getByRole('button', { name: 'Mute' }).className).toContain('bg-white');
  });

  it('play button has bg-green-500 class when playing', () => {
    render(
      <SoundscapeControls {...defaultProps} isPlaying={true} voiceCount={1} loadedCount={1} />,
    );
    expect(
      screen.getByRole('button', { name: 'Pause soundscape' }).className,
    ).toContain('bg-green-500');
  });
```

- [ ] **Step 2: Run tests to verify the new tests fail**

```bash
npx vitest run src/components/SoundscapeControls.test.tsx
```

Expected: 4 new failures; all existing tests still pass.

- [ ] **Step 3: Rewrite SoundscapeControls**

Replace the entire file content of `src/components/SoundscapeControls.tsx` with:

```tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';

export interface SoundscapeControlsProps {
  isPlaying: boolean;
  voiceCount: number;
  loadedCount: number;
  allMuted: boolean;
  onToggle: () => void;
  onMuteAll: () => void;
}

export function SoundscapeControls({
  isPlaying,
  voiceCount,
  loadedCount,
  allMuted,
  onToggle,
  onMuteAll,
}: SoundscapeControlsProps) {
  if (voiceCount === 0) return null;

  return (
    <div className="flex items-center gap-4 shrink-0">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onToggle}
          aria-label={isPlaying ? 'Pause soundscape' : 'Play soundscape'}
          className={`w-12 h-7 rounded flex items-center justify-center text-sm transition-colors ${
            isPlaying
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-white hover:bg-gray-100 text-gray-900'
          }`}
        >
          {isPlaying ? <FontAwesomeIcon icon={faPause} /> : <FontAwesomeIcon icon={faPlay} />}
        </button>
        <button
          type="button"
          onClick={onMuteAll}
          className={`w-12 h-7 rounded text-xs transition-colors ${
            allMuted
              ? 'bg-red-200 hover:bg-red-300 text-red-800'
              : 'bg-white hover:bg-gray-100 text-gray-900'
          }`}
        >
          {allMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>
      <span className="hidden md:inline text-white text-sm">
        {isPlaying ? `${loadedCount} birds playing` : `${loadedCount} birds ready`}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run SoundscapeControls tests**

```bash
npx vitest run src/components/SoundscapeControls.test.tsx
```

Expected: all tests pass (including the 4 new ones and all 9 existing ones).

- [ ] **Step 5: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/SoundscapeControls.tsx src/components/SoundscapeControls.test.tsx
git commit -m "feat: redesign soundscape controls as stacked rectangles, hide count on mobile"
```

---

### Task 2: SoundscapeGrid — hide card name overlay on mobile

**Files:**
- Modify: `src/components/SoundscapeGrid.tsx`
- Modify: `src/components/SoundscapeGrid.test.tsx`

**Interfaces:**
- No interface changes.

- [ ] **Step 1: Add failing test**

Open `src/components/SoundscapeGrid.test.tsx`. Add this test inside the existing `describe('SoundscapeGrid', () => {` block, after all existing tests:

```tsx
  it('card name overlay has hidden class (hidden on mobile)', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice({ isLoading: false })]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    const overlay = container.querySelector('.absolute.bottom-0');
    expect(overlay?.className.split(' ')).toContain('hidden');
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: 1 new failure; all existing tests still pass.

- [ ] **Step 3: Add `hidden md:block` to the overlay div**

In `src/components/SoundscapeGrid.tsx`, find:

```tsx
              {!voice.isLoading && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
```

Replace with:

```tsx
              {!voice.isLoading && (
                <div className="hidden md:block absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
```

- [ ] **Step 4: Run SoundscapeGrid tests**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/SoundscapeGrid.tsx src/components/SoundscapeGrid.test.tsx
git commit -m "feat: hide card name overlay on mobile"
```

---

### Task 3: SettingsModal — full-screen on mobile

**Files:**
- Modify: `src/components/SettingsModal.tsx`
- Modify: `src/components/SettingsModal.test.tsx`

**Interfaces:**
- No interface changes.

- [ ] **Step 1: Add failing tests**

Open `src/components/SettingsModal.test.tsx`. Add these tests inside the existing `describe('SettingsModal', () => {` block, after all existing tests:

```tsx
  it('modal inner div has h-full class for mobile full-screen', () => {
    const { container } = render(<SettingsModal {...baseProps} />);
    const modal = container.querySelector('.bg-gray-900');
    expect(modal?.className.split(' ')).toContain('h-full');
  });

  it('modal inner div has md:max-h-[90vh] class for desktop height cap', () => {
    const { container } = render(<SettingsModal {...baseProps} />);
    const modal = container.querySelector('.bg-gray-900');
    expect(modal?.className.split(' ')).toContain('md:max-h-[90vh]');
  });

  it('close button has p-2 class for easy tap', () => {
    render(<SettingsModal {...baseProps} />);
    expect(
      screen.getByRole('button', { name: 'Close settings' }).className.split(' '),
    ).toContain('p-2');
  });
```

- [ ] **Step 2: Run tests to verify the new tests fail**

```bash
npx vitest run src/components/SettingsModal.test.tsx
```

Expected: 3 new failures; all existing tests still pass.

- [ ] **Step 3: Update the inner modal div class**

In `src/components/SettingsModal.tsx`, find:

```tsx
      <div
        className="max-w-lg w-full mx-4 max-h-[90vh] flex flex-col bg-gray-900 rounded-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
```

Replace with:

```tsx
      <div
        className="w-full h-full flex flex-col bg-gray-900 overflow-hidden md:h-auto md:max-w-lg md:mx-4 md:max-h-[90vh] md:rounded-xl"
        onClick={e => e.stopPropagation()}
      >
```

- [ ] **Step 4: Update the close button to be larger**

Find:

```tsx
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
```

Replace with:

```tsx
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="p-2 text-lg text-gray-400 hover:text-white transition-colors"
          >
```

- [ ] **Step 5: Run SettingsModal tests**

```bash
npx vitest run src/components/SettingsModal.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/SettingsModal.tsx src/components/SettingsModal.test.tsx
git commit -m "feat: settings modal full-screen on mobile"
```

---

### Task 4: MapView header — coordinates nowrap, title truncate

**Files:**
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- No interface changes.

- [ ] **Step 1: Update the title span**

In `src/components/MapView.tsx`, find:

```tsx
        <span className="text-lg font-semibold">Bird Soundscape Explorer</span>
```

Replace with:

```tsx
        <span className="text-lg font-semibold min-w-0 truncate">Bird Soundscape Explorer</span>
```

- [ ] **Step 2: Update the coordinate span**

Find:

```tsx
          <span className="text-sm text-green-200 ml-auto">
            {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
          </span>
```

Replace with:

```tsx
          <span className="text-sm text-green-200 ml-auto whitespace-nowrap shrink-0">
            {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
          </span>
```

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "fix: keep header coordinates on one line on mobile"
```
