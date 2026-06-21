# Per-Bird Mute Button + Font Awesome Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-bird mute button to the now-playing bar and replace all emoji play/pause icons with Font Awesome icons.

**Architecture:** Three tasks: (1) install Font Awesome and swap emoji in `SoundscapeControls`; (2) add `isMuted`/`isMutedRef`/`toggleMute` to `useSoundscape` with full mute/unmute/clear logic; (3) wire the mute button into `SoundscapeGrid` and pass `toggleMute` down from `MapView`. Tasks 1 and 2 are independent; Task 3 depends on both.

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Font Awesome Free, Vitest + React Testing Library.

## Global Constraints

- `verbatimModuleSyntax: true` — all type-only imports must use `import type`
- Vitest `globals: true` — no explicit `describe`/`it`/`expect`/`vi`/`beforeEach`/`afterEach` imports in test files
- Test command (single file): `npx vitest run src/hooks/useSoundscape.test.ts`
- Test command (full suite): `npx vitest run`
- Build command: `npm run build`
- `stopAll` body is unchanged — still called only from the rebuild `useEffect`
- `pauseAll` body is unchanged — does NOT clear `isMuted` state
- Mute state resets to `false` for all voices when master play button fires (toggle from paused → playing)
- Mute state resets to `false` for all voices on rebuild (new pin dropped)

---

## File Map

| File | Action |
|---|---|
| `src/components/SoundscapeControls.tsx` | Replace emoji with FA `faPlay`/`faPause` |
| `src/components/SoundscapeControls.test.tsx` | Add 2 FA icon render tests |
| `src/hooks/useSoundscape.ts` | Add `isMuted`, `isMutedRef`, `toggleMute`; update `startVoice`, `ended`, `toggle`, rebuild effect |
| `src/hooks/useSoundscape.test.ts` | Add 5 mute behavior tests in new describe block |
| `src/components/SoundscapeGrid.tsx` | Add `onToggleMute` prop, mute button overlay, fix filter→map for index preservation |
| `src/components/MapView.tsx` | Pass `soundscape.toggleMute` to `SoundscapeGrid` |
| `src/components/SoundscapeGrid.test.tsx` | Add `isMuted: false` to fixture, `onToggleMute` to all renders, add muted-card test |

---

### Task 1: Font Awesome install + SoundscapeControls icon swap

**Files:**
- Modify: `src/components/SoundscapeControls.tsx`
- Modify: `src/components/SoundscapeControls.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: FA packages available for Tasks 2 and 3; `SoundscapeControls` renders `<svg data-icon="play">` / `<svg data-icon="pause">`

---

- [ ] **Step 1: Install Font Awesome packages**

```bash
npm install @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons @fortawesome/react-fontawesome
```

Expected: packages added to `node_modules`, `package.json` updated with all three FA packages.

- [ ] **Step 2: Write the two failing icon tests**

In `src/components/SoundscapeControls.test.tsx`, add these two tests inside the existing `describe('SoundscapeControls', ...)` block (after the last existing test):

```typescript
  it('renders a Font Awesome play icon (not emoji ▶) when paused', () => {
    const { container } = render(
      <SoundscapeControls isPlaying={false} voiceCount={1} onToggle={vi.fn()} />,
    );
    expect(container.querySelector('svg[data-icon="play"]')).toBeTruthy();
    expect(container.querySelector('button')?.textContent?.trim()).not.toBe('▶');
  });

  it('renders a Font Awesome pause icon (not emoji ⏸) when playing', () => {
    const { container } = render(
      <SoundscapeControls isPlaying={true} voiceCount={1} onToggle={vi.fn()} />,
    );
    expect(container.querySelector('svg[data-icon="pause"]')).toBeTruthy();
    expect(container.querySelector('button')?.textContent?.trim()).not.toBe('⏸');
  });
```

- [ ] **Step 3: Run the new tests to confirm they fail**

```bash
npx vitest run src/components/SoundscapeControls.test.tsx 2>&1 | tail -20
```

Expected: the two new tests FAIL; the four existing tests pass.

- [ ] **Step 4: Replace emoji with Font Awesome icons in SoundscapeControls**

Replace the entire contents of `src/components/SoundscapeControls.tsx` with:

```tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';

export interface SoundscapeControlsProps {
  isPlaying: boolean;
  voiceCount: number;
  onToggle: () => void;
}

export function SoundscapeControls({ isPlaying, voiceCount, onToggle }: SoundscapeControlsProps) {
  if (voiceCount === 0) return null;

  return (
    <div className="flex items-center gap-4 shrink-0">
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
      <span className="text-white text-sm">
        {isPlaying ? `${voiceCount} birds playing` : `${voiceCount} birds ready`}
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to confirm all pass**

```bash
npx vitest run src/components/SoundscapeControls.test.tsx 2>&1 | tail -20
```

Expected: all 6 tests pass.

- [ ] **Step 6: Build**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 7: Commit**

```bash
git add src/components/SoundscapeControls.tsx src/components/SoundscapeControls.test.tsx package.json package-lock.json
git commit -m "feat: replace emoji icons with Font Awesome in SoundscapeControls"
```

---

### Task 2: `isMuted` + `isMutedRef` + `toggleMute` in `useSoundscape`

**Files:**
- Modify: `src/hooks/useSoundscape.ts`
- Modify: `src/hooks/useSoundscape.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (Font Awesome not needed here)
- Produces:
  - `SoundscapeVoice.isMuted: boolean` — new field on every voice
  - `UseSoundscapeResult.toggleMute: (index: number) => void` — exported from hook
  - `useSoundscape(...)` return now includes `toggleMute`

---

- [ ] **Step 1: Write the 5 failing mute tests**

In `src/hooks/useSoundscape.test.ts`, add a new describe block after the last existing `describe(...)` block (after line 442 — the closing `}`):

```typescript
describe('useSoundscape — mute', () => {
  it('toggleMute mutes a voice: stops audio and marks it isMuted', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); }); // play
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    act(() => { result.current.toggleMute(0); });

    expect(result.current.voices[0].isMuted).toBe(true);
    expect(result.current.voices[0].isActive).toBe(false);
    expect(audioInstances[0].pause).toHaveBeenCalled();
  });

  it('muted voice does not restart after its audio ends', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); }); // play
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    act(() => { result.current.toggleMute(0); }); // mute

    const timerCountBefore = vi.getTimerCount();
    act(() => { audioInstances[0].emit('ended'); });
    expect(vi.getTimerCount()).toBe(timerCountBefore); // no new timer scheduled
  });

  it('toggleMute unmutes and resumes playback', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); }); // play
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    act(() => { result.current.toggleMute(0); }); // mute
    act(() => { result.current.toggleMute(0); }); // unmute

    expect(result.current.voices[0].isMuted).toBe(false);
    expect(audioInstances[0].play).toHaveBeenCalledTimes(2); // initial play + resume on unmute
  });

  it('master play clears all mutes', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); }); // play
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    act(() => { result.current.toggleMute(0); }); // mute
    expect(result.current.voices[0].isMuted).toBe(true);

    act(() => { result.current.toggle(); }); // pause (master)
    act(() => { result.current.toggle(); }); // play (master) — clears mutes
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    expect(result.current.voices[0].isMuted).toBe(false);
  });

  it('muted voice is skipped by startVoice stagger timer', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); }); // play — stagger timer scheduled but not yet fired
    act(() => { result.current.toggleMute(0); }); // mute BEFORE stagger fires

    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    expect(audioInstances[0].play).not.toHaveBeenCalled();
  });
});
```

Also add `toggleMute` to the import from `./useSoundscape` at the top of the test file. The current import is:
```typescript
import {
  selectVoices, computeIntervalMs,
  MIN_INTERVAL_MS, MAX_INTERVAL_MS, MAX_VOICES,
  INITIAL_VOICES, SPARE_VOICES, MAX_AUDIO_RETRIES, RETRY_DELAY_MS,
  useSoundscape, INITIAL_STAGGER_MS,
  SECONDARY_STAGGER_MIN_MS, SECONDARY_STAGGER_MAX_MS,
} from './useSoundscape';
```

No change needed to this import — `toggleMute` is accessed via `result.current.toggleMute`, not imported directly.

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
npx vitest run src/hooks/useSoundscape.test.ts 2>&1 | tail -30
```

Expected: the 5 new tests FAIL (most likely with `result.current.toggleMute is not a function`); all existing 28 tests pass.

- [ ] **Step 3: Add `isMuted` to the interfaces**

In `src/hooks/useSoundscape.ts`:

**Edit 1** — add `isMuted: boolean;` to `SoundscapeVoice` after `isFailed: boolean;`:

```typescript
export interface SoundscapeVoice {
  recording: XCRecording;
  sciName: string;
  howMany: number;
  intervalMs: number;
  isActive: boolean;
  isLoading: boolean;
  isFailed: boolean;
  isMuted: boolean;
  photo: BirdPhoto | null;
}
```

**Edit 2** — add `toggleMute` to `UseSoundscapeResult`:

```typescript
export interface UseSoundscapeResult {
  voices: SoundscapeVoice[];
  isPlaying: boolean;
  toggle: () => void;
  toggleMute: (index: number) => void;
}
```

- [ ] **Step 4: Add `isMutedRef`**

In the hook body, add `isMutedRef` after `pendingEndedRef` (currently line 101):

```typescript
  const pendingEndedRef = useRef<boolean[]>([]);
  const isMutedRef = useRef<boolean[]>([]);
```

- [ ] **Step 5: Update the rebuild effect**

**Edit 1** — reset `isMutedRef` after `pendingEndedRef` reset (currently line 148):

```typescript
    stopAll();
    pendingEndedRef.current = [];
    isMutedRef.current = [];
    let cancelled = false;
```

**Edit 2** — add `isMuted: false` to the initial `setVoices` call (currently lines 171-182):

```typescript
    setVoices(
      selected.map((s, i) => ({
        recording: s.recording,
        sciName: s.sciName,
        howMany: s.howMany,
        intervalMs: intervals[i],
        isActive: false,
        isLoading: true,
        isFailed: false,
        isMuted: false,
        photo: null,
      })),
    );
```

**Edit 3** — in `replaceFailedVoice`, add `isMutedRef.current[idx] = false;` after `pendingEndedRef.current[idx] = false;` (currently lines 198-202), and add `isMuted: false,` to the `setVoices` replacement call (currently lines 204-213):

```typescript
      const newAudio = new Audio(spare.recording.file);
      audioRefs.current[idx] = newAudio;
      retryCountsRef.current[idx] = 0;
      intervalsRef.current[idx] = MAX_INTERVAL_MS;
      pendingEndedRef.current[idx] = false;
      isMutedRef.current[idx] = false;

      setVoices(v => v.map((voice, vi) => vi === idx ? {
        recording: spare.recording,
        sciName: spare.sciName,
        howMany: spare.howMany,
        intervalMs: MAX_INTERVAL_MS,
        isActive: false,
        isLoading: true,
        isFailed: false,
        isMuted: false,
        photo: null,
      } : voice));
```

- [ ] **Step 6: Update `startVoice` and the `ended` handler**

**Edit 1** — add mute guard to `startVoice` (currently line 123):

```typescript
  const startVoice = useCallback((index: number) => {
    const audio = audioRefs.current[index];
    if (!audio || !isPlayingRef.current || isMutedRef.current[index]) return;

    void audio.play();
    setVoices(v => v.map((voice, i) => i === index ? { ...voice, isActive: true } : voice));

    if (!pendingEndedRef.current[index]) {
      pendingEndedRef.current[index] = true;
      audio.addEventListener('ended', () => {
        pendingEndedRef.current[index] = false;
        setVoices(v => v.map((voice, i) => i === index ? { ...voice, isActive: false } : voice));
        if (!isPlayingRef.current || isMutedRef.current[index]) return;
        const delay = applyJitter(intervalsRef.current[index] ?? MAX_INTERVAL_MS);
        timersRef.current.push(setTimeout(() => startVoice(index), delay));
      }, { once: true } as AddEventListenerOptions);
    }
  }, []);
```

(Two changes: the guard on line 3, and `|| isMutedRef.current[index]` in the `ended` handler check.)

- [ ] **Step 7: Add `toggleMute` and update `toggle`**

Add `toggleMute` immediately before the `toggle` callback (before line 276):

```typescript
  const toggleMute = useCallback((index: number) => {
    const audio = audioRefs.current[index];
    if (!audio) return;

    if (!isMutedRef.current[index]) {
      isMutedRef.current[index] = true;
      audio.pause();
      audio.currentTime = 0;
      setVoices(v => v.map((voice, i) => i === index ? { ...voice, isMuted: true, isActive: false } : voice));
    } else {
      isMutedRef.current[index] = false;
      setVoices(v => v.map((voice, i) => i === index ? { ...voice, isMuted: false } : voice));
      if (isPlayingRef.current) startVoice(index);
    }
  }, [startVoice]);
```

Replace `toggle` (currently lines 276-291) with:

```typescript
  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      pauseAll();
    } else {
      const count = audioRefs.current.length;
      isMutedRef.current = new Array(count).fill(false);
      setVoices(v => v.map(voice => ({ ...voice, isMuted: false })));
      isPlayingRef.current = true;
      setIsPlaying(true);
      audioRefs.current.forEach((_, i) => {
        const delay = i < INITIAL_VOICES
          ? Math.random() * INITIAL_STAGGER_MS
          : INITIAL_STAGGER_MS
            + SECONDARY_STAGGER_MIN_MS
            + Math.random() * (SECONDARY_STAGGER_MAX_MS - SECONDARY_STAGGER_MIN_MS);
        timersRef.current.push(setTimeout(() => startVoice(i), delay));
      });
    }
  }, [pauseAll, startVoice]);
```

Update the return statement (currently line 301):

```typescript
  return { voices, isPlaying, toggle, toggleMute };
```

- [ ] **Step 8: Run the failing tests to confirm they now pass**

```bash
npx vitest run src/hooks/useSoundscape.test.ts 2>&1 | tail -30
```

Expected: all 33 tests pass (28 existing + 5 new).

- [ ] **Step 9: Run the full suite**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/useSoundscape.ts src/hooks/useSoundscape.test.ts
git commit -m "feat: add per-voice mute state and toggleMute to useSoundscape"
```

---

### Task 3: `SoundscapeGrid` mute button + `MapView` wiring

**Files:**
- Modify: `src/components/SoundscapeGrid.tsx`
- Modify: `src/components/MapView.tsx`
- Modify: `src/components/SoundscapeGrid.test.tsx`

**Interfaces:**
- Consumes from Task 1: `@fortawesome/react-fontawesome`, `faVolumeHigh`, `faVolumeXmark` from `@fortawesome/free-solid-svg-icons`
- Consumes from Task 2: `SoundscapeVoice.isMuted: boolean`, `UseSoundscapeResult.toggleMute: (index: number) => void`
- Produces: mute button visible on hover (unmuted) or always visible (muted) on each bird card

---

- [ ] **Step 1: Write the failing SoundscapeGrid mute test**

In `src/components/SoundscapeGrid.test.tsx`:

**Edit 1** — add `isMuted: false` to the `makeVoice` fixture (after `isFailed: false`):

```typescript
function makeVoice(overrides: Partial<SoundscapeVoice> = {}): SoundscapeVoice {
  const recording: XCRecording = {
    id: '1', gen: 'Turdus', sp: 'migratorius', en: 'American Robin',
    rec: 'Jane', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
    type: 'song', q: 'A', file: 'https://xc.org/1.mp3', date: '2024-01-01',
    'file-name': '1.mp3', sono: { small: 'https://xc.org/sono.png', med: 'https://xc.org/sonom.png' },
  };
  return {
    recording,
    sciName: 'Turdus migratorius',
    howMany: 10,
    intervalMs: 5000,
    isActive: false,
    isLoading: false,
    isFailed: false,
    isMuted: false,
    photo: null,
    ...overrides,
  };
}
```

**Edit 2** — add `onToggleMute={vi.fn()}` to ALL existing `render(...)` calls in the file. There are 11 existing tests — each one that calls `render(<SoundscapeGrid voices={...} />)` needs the new prop. For example:

```typescript
// BEFORE:
render(<SoundscapeGrid voices={[]} />);
// AFTER:
render(<SoundscapeGrid voices={[]} onToggleMute={vi.fn()} />);
```

Apply this to all 11 render calls (including the one in the `does not render failed voices` test which uses a local `voices` array).

**Edit 3** — add the new mute button test inside the existing `describe('SoundscapeGrid', ...)` block (after the last existing test):

```typescript
  it('muted voice shows volume-xmark icon always visible (not opacity-0)', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice({ isMuted: true })]} onToggleMute={vi.fn()} />,
    );
    expect(container.querySelector('svg[data-icon="volume-xmark"]')).toBeTruthy();
    const muteBtn = container.querySelector('button[aria-label="Unmute bird"]');
    expect(muteBtn).toBeTruthy();
    expect(muteBtn?.className).not.toContain('opacity-0');
  });
```

- [ ] **Step 2: Run the new test to confirm it fails**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx 2>&1 | tail -20
```

Expected: the new mute test FAILS; the existing tests may also fail due to the missing `onToggleMute` prop (TypeScript error) — that's expected.

- [ ] **Step 3: Update `SoundscapeGrid.tsx` with mute button**

Replace the entire contents of `src/components/SoundscapeGrid.tsx` with:

```tsx
import type { SoundscapeVoice } from '../hooks/useSoundscape';
import { Skeleton } from './Skeleton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';

interface SoundscapeGridProps {
  voices: SoundscapeVoice[];
  onToggleMute: (index: number) => void;
}

export function SoundscapeGrid({ voices, onToggleMute }: SoundscapeGridProps) {
  if (voices.length === 0) return null;

  return (
    <div className="grid grid-cols-8 gap-2 p-1 w-full">
      {voices.map((voice, i) => {
        if (voice.isFailed) return null;
        return (
          <div
            key={voice.recording.id}
            className={`relative group rounded-lg ring-2 transition-all duration-300 ${
              voice.isActive ? 'ring-green-400' : 'ring-transparent'
            }`}
          >
            {/* Hover card — appears above the card */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-48 bg-gray-900 rounded-lg overflow-hidden shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 pointer-events-none">
              <div className="aspect-video bg-gray-800">
                {voice.photo ? (
                  <img
                    aria-hidden="true"
                    src={voice.photo.largeUrl}
                    alt={voice.recording.en}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white text-xs text-center px-2">{voice.recording.en}</span>
                  </div>
                )}
              </div>
              <div className="p-2 space-y-0.5">
                <p className="text-white text-xs font-semibold truncate">{voice.recording.en}</p>
                <p className="text-gray-400 text-xs italic truncate">{voice.sciName}</p>
                {voice.photo && (
                  <p className="text-gray-500 text-xs truncate">{voice.photo.attribution}</p>
                )}
                <p className="text-gray-500 text-xs truncate">Rec: {voice.recording.rec}</p>
              </div>
            </div>

            {/* Mute button */}
            <button
              onClick={e => { e.stopPropagation(); onToggleMute(i); }}
              aria-label={voice.isMuted ? 'Unmute bird' : 'Mute bird'}
              className={`absolute top-1 right-1 z-20 w-6 h-6 flex items-center justify-center rounded text-white bg-black/50 hover:bg-black/70 transition-opacity duration-150 ${
                voice.isMuted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <FontAwesomeIcon icon={voice.isMuted ? faVolumeXmark : faVolumeHigh} className="text-xs" />
            </button>

            {/* Card content */}
            <div className={`relative w-full h-[110px] rounded-lg overflow-hidden bg-black/60 transition-all duration-300 ${
              (!voice.isActive || voice.isMuted) ? 'brightness-50' : ''
            }`}>
              {voice.isLoading ? (
                <Skeleton className="w-full h-full rounded-none" />
              ) : voice.photo ? (
                <img
                  src={voice.photo.photoUrl}
                  alt={voice.recording.en}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center px-1">
                  <p className="text-white text-xs text-center leading-tight">{voice.recording.en}</p>
                </div>
              )}
              {!voice.isLoading && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                  <p className={`text-xs text-white truncate transition-opacity duration-300 ${voice.isActive ? 'opacity-100' : 'opacity-60'}`}>
                    {voice.recording.en}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Update `MapView.tsx` to pass `toggleMute`**

In `src/components/MapView.tsx`, find the `<SoundscapeGrid` line and add the `onToggleMute` prop:

```tsx
          <div className="flex-1 min-w-0 relative z-10">
            <SoundscapeGrid voices={soundscape.voices} onToggleMute={soundscape.toggleMute} />
          </div>
```

- [ ] **Step 5: Run the failing tests to confirm they pass**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx 2>&1 | tail -20
```

Expected: all 12 tests pass (11 existing + 1 new).

- [ ] **Step 6: Run the full suite**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 7: Build**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/SoundscapeGrid.tsx src/components/MapView.tsx src/components/SoundscapeGrid.test.tsx
git commit -m "feat: add per-bird mute button with Font Awesome icons to SoundscapeGrid"
```
