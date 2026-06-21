# Soundscape Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mute-all button to the soundscape bar, center the map on the continental US, and show loaded (not queued) audio count in the status text.

**Architecture:** Three independent changes — hook additions (`muteAll`, `allMuted`, `loadedCount` on `useSoundscape`), `SoundscapeControls` UI update (new props + mute button layout), and a one-line `MapView` center/zoom change plus prop wiring.

**Tech Stack:** React 19, TypeScript (`verbatimModuleSyntax: true`), Vitest with globals, React Testing Library, FontAwesome icons.

## Global Constraints

- `verbatimModuleSyntax: true` — type-only imports must use `import type { ... }` on a separate line from value imports of the same module.
- Hook tests (`src/hooks/`) use Vitest globals — no explicit `describe`/`it`/`expect`/`vi`/`beforeEach` imports.
- Component tests (`src/components/`) also use Vitest globals — follow existing pattern in `SoundscapeControls.test.tsx`.
- Run tests: `npm run test`; run a single file: `npx vitest run src/path/to/file.test.ts`

---

### Task 1: `useSoundscape` hook additions

**Files:**
- Modify: `src/hooks/useSoundscape.ts`
- Modify: `src/hooks/useSoundscape.test.ts`

**Interfaces:**
- Produces: `UseSoundscapeResult` gains three new members — exact signatures Tasks 2 and 3 depend on:
  ```typescript
  muteAll: () => void;
  allMuted: boolean;    // true iff voices.length > 0 && every voice has isMuted: true
  loadedCount: number;  // voices where isLoading === false && isFailed === false
  ```

- [ ] **Step 1: Write failing tests**

Append a new `describe` block at the end of `src/hooks/useSoundscape.test.ts` (after the closing `}` of `'useSoundscape — mute'`). The existing file already imports `renderHook`, `act`, fixtures `xcRec1`, `xcRec2`, `obs1`, `obs2`, and uses the `audioInstances` / `MockAudio` infra — all of that is available without re-importing.

```typescript
describe('useSoundscape — mute all and loaded count', () => {
  it('muteAll mutes all voices and pauses their audio', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1, xcRec2], [obs1, obs2]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.muteAll(); });

    expect(result.current.voices.every(v => v.isMuted)).toBe(true);
    expect(result.current.voices.every(v => !v.isActive)).toBe(true);
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(audioInstances[1].pause).toHaveBeenCalled();
  });

  it('muteAll unmutes all voices when all are already muted', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1, xcRec2], [obs1, obs2]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.muteAll(); }); // mute all
    act(() => { result.current.muteAll(); }); // unmute all

    expect(result.current.voices.every(v => v.isMuted)).toBe(false);
  });

  it('muteAll unmute while playing calls play on each voice audio', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1, xcRec2], [obs1, obs2]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    act(() => { result.current.muteAll(); }); // mute all
    const playsBefore = audioInstances.map(a => a.play.mock.calls.length);

    act(() => { result.current.muteAll(); }); // unmute all — should trigger startVoice

    expect(audioInstances[0].play.mock.calls.length).toBeGreaterThan(playsBefore[0]);
    expect(audioInstances[1].play.mock.calls.length).toBeGreaterThan(playsBefore[1]);
  });

  it('allMuted is false initially when voices exist', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.allMuted).toBe(false);
  });

  it('allMuted is true after muteAll', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1, xcRec2], [obs1, obs2]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.muteAll(); });

    expect(result.current.allMuted).toBe(true);
  });

  it('allMuted is false when voices array is empty', () => {
    const { result } = renderHook(() => useSoundscape([], []));
    expect(result.current.allMuted).toBe(false);
  });

  it('loadedCount is 0 initially (no canplay event has fired)', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1, xcRec2], [obs1, obs2]));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.loadedCount).toBe(0);
  });

  it('loadedCount increases as canplay fires for each voice', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1, xcRec2], [obs1, obs2]));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.loadedCount).toBe(0);

    act(() => { audioInstances[0].emit('canplay'); });
    expect(result.current.loadedCount).toBe(1);

    act(() => { audioInstances[1].emit('canplay'); });
    expect(result.current.loadedCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: TypeScript compile errors — "Property 'muteAll' does not exist on type 'UseSoundscapeResult'", "Property 'allMuted' does not exist", "Property 'loadedCount' does not exist". These confirm the implementation is missing.

- [ ] **Step 3: Implement the hook changes**

In `src/hooks/useSoundscape.ts`:

**3a. Update `UseSoundscapeResult` interface** (currently at lines 31–36):

```typescript
export interface UseSoundscapeResult {
  voices: SoundscapeVoice[];
  isPlaying: boolean;
  toggle: () => void;
  toggleMute: (index: number) => void;
  muteAll: () => void;
  allMuted: boolean;
  loadedCount: number;
}
```

**3b. Add `muteAll` callback** — insert after the closing `}, [startVoice]);` of `toggleMute` (currently around line 297) and before `const toggle = useCallback`:

```typescript
  const muteAll = useCallback(() => {
    const count = audioRefs.current.length;
    if (count === 0) return;
    const currentlyAllMuted =
      isMutedRef.current.length === count && isMutedRef.current.every(Boolean);
    if (currentlyAllMuted) {
      isMutedRef.current = new Array(count).fill(false);
      setVoices(v => v.map(voice => ({ ...voice, isMuted: false })));
      if (isPlayingRef.current) {
        audioRefs.current.forEach((_, i) => startVoice(i));
      }
    } else {
      isMutedRef.current = new Array(count).fill(true);
      audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; });
      setVoices(v => v.map(voice => ({ ...voice, isMuted: true, isActive: false })));
    }
  }, [startVoice]);
```

**3c. Update the return statement** (currently `return { voices, isPlaying, toggle, toggleMute };`):

```typescript
  const allMuted = voices.length > 0 && voices.every(v => v.isMuted);
  const loadedCount = voices.filter(v => !v.isLoading && !v.isFailed).length;

  return { voices, isPlaying, toggle, toggleMute, muteAll, allMuted, loadedCount };
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: all tests pass (the new describe block + all existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSoundscape.ts src/hooks/useSoundscape.test.ts
git commit -m "feat: add muteAll, allMuted, and loadedCount to useSoundscape"
```

---

### Task 2: `SoundscapeControls` update

**Files:**
- Modify: `src/components/SoundscapeControls.tsx`
- Modify: `src/components/SoundscapeControls.test.tsx`

**Interfaces:**
- Consumes: `allMuted: boolean`, `loadedCount: number` from Task 1's `UseSoundscapeResult`
- Produces: updated `SoundscapeControlsProps` with new required props `loadedCount`, `allMuted`, `onMuteAll` — Task 3 depends on this interface

- [ ] **Step 1: Write the updated test file**

Replace `src/components/SoundscapeControls.test.tsx` entirely:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SoundscapeControls } from './SoundscapeControls';

describe('SoundscapeControls', () => {
  const defaultProps = {
    isPlaying: false as const,
    voiceCount: 0,
    loadedCount: 0,
    allMuted: false as const,
    onToggle: vi.fn(),
    onMuteAll: vi.fn(),
  };

  it('renders nothing when voiceCount is 0', () => {
    const { container } = render(<SoundscapeControls {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows loadedCount (not voiceCount) birds playing when playing', () => {
    render(
      <SoundscapeControls
        {...defaultProps}
        isPlaying={true}
        voiceCount={8}
        loadedCount={5}
      />,
    );
    expect(screen.getByText('5 birds playing')).toBeInTheDocument();
  });

  it('shows loadedCount (not voiceCount) birds ready when paused', () => {
    render(
      <SoundscapeControls
        {...defaultProps}
        voiceCount={8}
        loadedCount={3}
      />,
    );
    expect(screen.getByText('3 birds ready')).toBeInTheDocument();
  });

  it('calls onToggle when the play button is clicked', () => {
    const onToggle = vi.fn();
    render(
      <SoundscapeControls
        {...defaultProps}
        voiceCount={3}
        loadedCount={3}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play soundscape' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders a Font Awesome play icon (not emoji ▶) when paused', () => {
    const { container } = render(
      <SoundscapeControls {...defaultProps} voiceCount={1} loadedCount={1} />,
    );
    expect(container.querySelector('svg[data-icon="play"]')).toBeTruthy();
    expect(
      container.querySelector('button[aria-label="Play soundscape"]')?.textContent?.trim(),
    ).not.toBe('▶');
  });

  it('renders a Font Awesome pause icon (not emoji ⏸) when playing', () => {
    const { container } = render(
      <SoundscapeControls {...defaultProps} isPlaying={true} voiceCount={1} loadedCount={1} />,
    );
    expect(container.querySelector('svg[data-icon="pause"]')).toBeTruthy();
    expect(
      container.querySelector('button[aria-label="Pause soundscape"]')?.textContent?.trim(),
    ).not.toBe('⏸');
  });

  it('shows "Mute" button when not all voices are muted', () => {
    render(
      <SoundscapeControls {...defaultProps} voiceCount={3} loadedCount={3} allMuted={false} />,
    );
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
  });

  it('shows "Unmute" button when all voices are muted', () => {
    render(
      <SoundscapeControls {...defaultProps} voiceCount={3} loadedCount={3} allMuted={true} />,
    );
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
  });

  it('calls onMuteAll when the mute button is clicked', () => {
    const onMuteAll = vi.fn();
    render(
      <SoundscapeControls
        {...defaultProps}
        voiceCount={3}
        loadedCount={3}
        onMuteAll={onMuteAll}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(onMuteAll).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run src/components/SoundscapeControls.test.tsx
```

Expected failures:
- TypeScript errors: `loadedCount`, `allMuted`, `onMuteAll` not in props type
- "5 birds playing" / "3 birds ready" tests fail (component still shows `voiceCount`, not `loadedCount`)
- "Mute" / "Unmute" / `onMuteAll` tests fail (button doesn't exist yet)

- [ ] **Step 3: Implement the updated component**

Replace `src/components/SoundscapeControls.tsx` entirely:

```typescript
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
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onToggle}
          aria-label={isPlaying ? 'Pause soundscape' : 'Play soundscape'}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-colors ${
            isPlaying
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-white hover:bg-gray-100 text-gray-900'
          }`}
        >
          {isPlaying ? <FontAwesomeIcon icon={faPause} /> : <FontAwesomeIcon icon={faPlay} />}
        </button>
        <button
          onClick={onMuteAll}
          className="text-xs text-gray-300 hover:text-white transition-colors"
        >
          {allMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>
      <span className="text-white text-sm">
        {isPlaying ? `${loadedCount} birds playing` : `${loadedCount} birds ready`}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run src/components/SoundscapeControls.test.tsx
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SoundscapeControls.tsx src/components/SoundscapeControls.test.tsx
git commit -m "feat: add mute-all button and loaded count to SoundscapeControls"
```

---

### Task 3: MapView wiring and map center

**Files:**
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- Consumes: `soundscape.muteAll`, `soundscape.allMuted`, `soundscape.loadedCount` from Task 1
- Consumes: updated `SoundscapeControlsProps` from Task 2 (new required props)

No new tests — this task only wires together what Tasks 1 and 2 already tested and changes one constant.

- [ ] **Step 1: Update the map center and zoom**

In `src/components/MapView.tsx`, find the `<MapContainer>` open tag (currently `center={[20, 0]} zoom={3}`) and change to:

```tsx
<MapContainer center={[39.5, -98.35]} zoom={4} className="w-full h-full cursor-crosshair">
```

`[39.5, -98.35]` is the geographic center of the contiguous United States. Zoom 4 shows all 48 states on a desktop viewport.

- [ ] **Step 2: Pass the new props to `SoundscapeControls`**

In `src/components/MapView.tsx`, find the `<SoundscapeControls ... />` block (currently inside the soundscape bar `div`):

```tsx
          <SoundscapeControls
            isPlaying={soundscape.isPlaying}
            voiceCount={soundscape.voices.length}
            onToggle={soundscape.toggle}
          />
```

Replace with:

```tsx
          <SoundscapeControls
            isPlaying={soundscape.isPlaying}
            voiceCount={soundscape.voices.length}
            loadedCount={soundscape.loadedCount}
            allMuted={soundscape.allMuted}
            onToggle={soundscape.toggle}
            onMuteAll={soundscape.muteAll}
          />
```

- [ ] **Step 3: Run the full test suite and build**

```bash
npm run test
```

Expected: all 123+ tests pass (no regressions).

```bash
npm run build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: wire soundscape controls props and center map on continental US"
```
