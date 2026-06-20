# Bird Soundscape Audio Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a looping multi-species audio soundscape with per-voice `isActive` tracking, a floating bird photo grid that lights up when each species calls, and a Teams-style play/pause control bar.

**Architecture:** `useSoundscape` hook selects up to 8 species voices from XC recordings (weighted by eBird `howMany`), schedules each via HTML5 `<audio>` with interval-based repetition (common → short gaps, rare → long gaps), and exposes `isActive` per voice. `SoundscapeGrid` renders a floating strip of photo cards that dim/brighten with `isActive`. `SoundscapeControls` is the full-width bottom play/pause bar. `MapView` is modified to compose all three.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + `@testing-library/react`, HTML5 `<audio>` elements (no audio library).

## Global Constraints

- TypeScript with `verbatimModuleSyntax: true` — use `import type` for type-only imports
- Vitest `globals: true` — no explicit imports for `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`
- No new npm dependencies — HTML5 Audio only
- Constants (exact values): `MIN_INTERVAL_MS = 5_000`, `MAX_INTERVAL_MS = 90_000`, `JITTER_FACTOR = 0.25`, `MAX_VOICES = 8`, `INITIAL_STAGGER_MS = 3_000`
- Use `fireEvent` from `@testing-library/react` (not `userEvent` — not installed)
- `npm run build` must pass clean after every task
- `npm test` must pass after every task

---

## File Structure

| File | Action |
|---|---|
| `src/hooks/useSoundscape.ts` | Create — constants, pure helpers, hook function |
| `src/hooks/useSoundscape.test.ts` | Create |
| `src/components/SoundscapeControls.tsx` | Create |
| `src/components/SoundscapeControls.test.tsx` | Create |
| `src/components/SoundscapeGrid.tsx` | Create |
| `src/components/SoundscapeGrid.test.tsx` | Create |
| `src/components/MapView.tsx` | Modify — add relative wrapper, compose new components |

---

### Task 1: `useSoundscape` — pure helpers + constants

**Files:**
- Create: `src/hooks/useSoundscape.ts`
- Create: `src/hooks/useSoundscape.test.ts`

**Produces (consumed by Tasks 2–5):**
```typescript
export const MIN_INTERVAL_MS: number  // 5_000
export const MAX_INTERVAL_MS: number  // 90_000
export const JITTER_FACTOR: number    // 0.25
export const MAX_VOICES: number       // 8
export const INITIAL_STAGGER_MS: number // 3_000

export interface SoundscapeVoice {
  recording: XCRecording;
  sciName: string;
  howMany: number;
  intervalMs: number;
  isActive: boolean;
  photo: BirdPhoto | null;
}

export interface UseSoundscapeResult {
  voices: SoundscapeVoice[];
  isPlaying: boolean;
  toggle: () => void;
}

export function selectVoices(recordings: XCRecording[], recentObs: EBirdObservation[]): { recording: XCRecording; sciName: string; howMany: number }[]
export function computeIntervalMs(howMany: number, minHowMany: number, maxHowMany: number): number
export function applyJitter(baseMs: number): number
```

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useSoundscape.test.ts`:

```typescript
import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import {
  selectVoices, computeIntervalMs,
  MIN_INTERVAL_MS, MAX_INTERVAL_MS, MAX_VOICES,
} from './useSoundscape';

function makeRec(overrides: Partial<XCRecording> = {}): XCRecording {
  return {
    id: '1', gen: 'Turdus', sp: 'migratorius', en: 'American Robin',
    rec: 'Jane', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
    type: 'song', q: 'A', file: 'https://xc.org/1.mp3', date: '2024-01-01',
    'file-name': '1.mp3', sono: { small: 'https://xc.org/sono1.png', med: 'https://xc.org/sono1m.png' },
    ...overrides,
  };
}

function makeObs(sciName: string, howMany: number): EBirdObservation {
  return {
    speciesCode: sciName.replace(' ', ''), comName: sciName,
    sciName, locName: 'SF', obsDt: '2024-01-01', howMany,
    lat: 37.77, lng: -122.4, obsValid: true, obsReviewed: true, locationPrivate: false,
  };
}

describe('selectVoices', () => {
  it('returns one entry per species, picking quality A over B', () => {
    const recs = [
      makeRec({ q: 'B', id: '2' }),
      makeRec({ q: 'A', id: '1' }),
    ];
    const result = selectVoices(recs, [makeObs('Turdus migratorius', 10)]);
    expect(result).toHaveLength(1);
    expect(result[0].recording.q).toBe('A');
  });

  it('prefers song over call when quality is equal', () => {
    const recs = [
      makeRec({ type: 'call', id: '1' }),
      makeRec({ type: 'song', id: '2' }),
    ];
    const result = selectVoices(recs, []);
    expect(result[0].recording.type).toBe('song');
  });

  it('sorts by howMany descending', () => {
    const recs = [
      makeRec({ gen: 'Parus', sp: 'major', id: '10' }),
      makeRec({ gen: 'Turdus', sp: 'migratorius', id: '11' }),
    ];
    const obs = [makeObs('Turdus migratorius', 10), makeObs('Parus major', 2)];
    const result = selectVoices(recs, obs);
    expect(result[0].sciName).toBe('Turdus migratorius');
    expect(result[1].sciName).toBe('Parus major');
  });

  it('defaults howMany to 1 for species absent from recentObs', () => {
    const result = selectVoices([makeRec()], []);
    expect(result[0].howMany).toBe(1);
  });

  it('caps output at MAX_VOICES', () => {
    const recs = Array.from({ length: 12 }, (_, i) =>
      makeRec({ gen: 'Sp', sp: String(i), id: String(i) }),
    );
    expect(selectVoices(recs, [])).toHaveLength(MAX_VOICES);
  });
});

describe('computeIntervalMs', () => {
  it('returns MIN_INTERVAL_MS for the most common (max howMany)', () => {
    expect(computeIntervalMs(10, 1, 10)).toBe(MIN_INTERVAL_MS);
  });

  it('returns MAX_INTERVAL_MS for the least common (min howMany)', () => {
    expect(computeIntervalMs(1, 1, 10)).toBe(MAX_INTERVAL_MS);
  });

  it('returns midpoint when all howMany are equal', () => {
    const mid = (MIN_INTERVAL_MS + MAX_INTERVAL_MS) / 2;
    expect(computeIntervalMs(5, 5, 5)).toBe(mid);
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: FAIL — "Cannot find module './useSoundscape'"

- [ ] **Step 3: Write the implementation**

Create `src/hooks/useSoundscape.ts`:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import { fetchBirdPhoto } from '../api/inat';

export const MIN_INTERVAL_MS = 5_000;
export const MAX_INTERVAL_MS = 90_000;
export const JITTER_FACTOR = 0.25;
export const MAX_VOICES = 8;
export const INITIAL_STAGGER_MS = 3_000;

export interface SoundscapeVoice {
  recording: XCRecording;
  sciName: string;
  howMany: number;
  intervalMs: number;
  isActive: boolean;
  photo: BirdPhoto | null;
}

export interface UseSoundscapeResult {
  voices: SoundscapeVoice[];
  isPlaying: boolean;
  toggle: () => void;
}

const qualityRank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
const typeScore = (type: string) => (type.toLowerCase().includes('song') ? 0 : 1);

export function selectVoices(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
): { recording: XCRecording; sciName: string; howMany: number }[] {
  const howManyMap = new Map<string, number>(
    recentObs.map(obs => [obs.sciName, obs.howMany ?? 1]),
  );

  const bySpecies = new Map<string, XCRecording>();
  for (const rec of recordings) {
    const sciName = `${rec.gen} ${rec.sp}`;
    const existing = bySpecies.get(sciName);
    if (!existing) {
      bySpecies.set(sciName, rec);
    } else {
      const recScore = (qualityRank[rec.q] ?? 5) * 2 + typeScore(rec.type);
      const existScore = (qualityRank[existing.q] ?? 5) * 2 + typeScore(existing.type);
      if (recScore < existScore) bySpecies.set(sciName, rec);
    }
  }

  return [...bySpecies.entries()]
    .map(([sciName, recording]) => ({
      recording,
      sciName,
      howMany: howManyMap.get(sciName) ?? 1,
    }))
    .sort((a, b) => b.howMany - a.howMany)
    .slice(0, MAX_VOICES);
}

export function computeIntervalMs(
  howMany: number,
  minHowMany: number,
  maxHowMany: number,
): number {
  const ratio =
    maxHowMany === minHowMany
      ? 0.5
      : (howMany - minHowMany) / (maxHowMany - minHowMany);
  return MAX_INTERVAL_MS - ratio * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

export function applyJitter(baseMs: number): number {
  return baseMs * (1 + (Math.random() * 2 - 1) * JITTER_FACTOR);
}

export function useSoundscape(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
): UseSoundscapeResult {
  // Placeholder — completed in Task 2
  void recordings; void recentObs; void fetchBirdPhoto;
  void useState; void useEffect; void useRef; void useCallback;
  return { voices: [], isPlaying: false, toggle: () => {} };
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: 8 tests pass

- [ ] **Step 5: Build check**

```
npm run build
```

Expected: clean

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSoundscape.ts src/hooks/useSoundscape.test.ts
git commit -m "feat: add useSoundscape voice selection helpers and constants"
```

---

### Task 2: `useSoundscape` — hook body (audio scheduling, isActive, photos)

**Files:**
- Modify: `src/hooks/useSoundscape.ts` (replace placeholder hook body)
- Modify: `src/hooks/useSoundscape.test.ts` (append hook integration tests)

**Consumes from Task 1:** `SoundscapeVoice`, `UseSoundscapeResult`, `selectVoices`, `computeIntervalMs`, `applyJitter`, `INITIAL_STAGGER_MS`, `MAX_INTERVAL_MS`

**External deps:** `fetchBirdPhoto` from `../api/inat` — mock in tests.

- [ ] **Step 1: Append hook tests to `useSoundscape.test.ts`**

Append after the existing `describe` blocks:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useSoundscape, INITIAL_STAGGER_MS } from './useSoundscape';
import { fetchBirdPhoto } from '../api/inat';

vi.mock('../api/inat', () => ({ fetchBirdPhoto: vi.fn().mockResolvedValue(null) }));

// ── MockAudio ──────────────────────────────────────────────────────────────
class MockAudio {
  src: string;
  currentTime = 0;
  private _handlers: Record<string, Array<() => void>> = {};
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  constructor(src: string) { this.src = src; }
  addEventListener(event: string, handler: () => void) {
    (this._handlers[event] ??= []).push(handler);
  }
  removeEventListener(event: string, handler: () => void) {
    this._handlers[event] = (this._handlers[event] ?? []).filter(h => h !== handler);
  }
  // Test helper: fire the event and clear one-shot ended handlers
  emit(event: string) {
    const handlers = [...(this._handlers[event] ?? [])];
    if (event === 'ended') this._handlers['ended'] = [];
    handlers.forEach(h => h());
  }
}

const audioInstances: MockAudio[] = [];

beforeEach(() => {
  audioInstances.length = 0;
  vi.stubGlobal('Audio', class extends MockAudio {
    constructor(src: string) { super(src); audioInstances.push(this); }
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── Fixtures ───────────────────────────────────────────────────────────────
const xcRec1 = makeRec({ gen: 'Turdus', sp: 'migratorius', id: '1' });
const xcRec2 = makeRec({ gen: 'Parus', sp: 'major', id: '2' });
const obs1   = makeObs('Turdus migratorius', 10);
const obs2   = makeObs('Parus major', 2);

// ── Tests ──────────────────────────────────────────────────────────────────
describe('useSoundscape', () => {
  it('starts with isPlaying=false and voices populated from recordings', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1, xcRec2], [obs1, obs2]));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.voices).toHaveLength(2);
  });

  it('toggle() starts playback and plays audio after stagger', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); });
    expect(result.current.isPlaying).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });
    expect(audioInstances[0].play).toHaveBeenCalled();
  });

  it('sets isActive=true on play and false on ended', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });
    expect(result.current.voices[0].isActive).toBe(true);

    act(() => { audioInstances[0].emit('ended'); });
    expect(result.current.voices[0].isActive).toBe(false);
  });

  it('toggle() stop pauses audio and clears isActive', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); }); // play
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    act(() => { result.current.toggle(); }); // stop
    expect(result.current.isPlaying).toBe(false);
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(result.current.voices[0].isActive).toBe(false);
  });

  it('rebuilds voices and stops when recordings change', async () => {
    const { result, rerender } = renderHook(
      ({ recs, obs }: { recs: typeof xcRec1[]; obs: typeof obs1[] }) =>
        useSoundscape(recs, obs),
      { initialProps: { recs: [xcRec1], obs: [obs1] } },
    );
    await act(async () => { await vi.runAllTimersAsync(); });
    act(() => { result.current.toggle(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    rerender({ recs: [xcRec2], obs: [obs2] });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.voices[0].sciName).toBe('Parus major');
  });

  it('fetches a photo for each voice and stores it', async () => {
    vi.mocked(fetchBirdPhoto).mockResolvedValue({
      photoUrl: 'https://img.jpg', largeUrl: 'https://img-l.jpg',
      attribution: '© test', licenseCode: 'cc-by',
    });
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(fetchBirdPhoto).toHaveBeenCalledWith('Turdus migratorius');
    expect(result.current.voices[0].photo).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm new tests fail**

```
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: new `useSoundscape` describe block fails (placeholder returns empty voices)

- [ ] **Step 3: Replace the placeholder hook body in `useSoundscape.ts`**

Find the placeholder `useSoundscape` function (last function in the file) and replace it entirely with:

```typescript
export function useSoundscape(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
): UseSoundscapeResult {
  const [voices, setVoices] = useState<SoundscapeVoice[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRefs    = useRef<HTMLAudioElement[]>([]);
  const timersRef    = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<number[]>([]);
  const isPlayingRef = useRef(false);

  const stopAll = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; });
    isPlayingRef.current = false;
    setIsPlaying(false);
    setVoices(v => v.map(voice => ({ ...voice, isActive: false })));
  }, []);

  const startVoice = useCallback((index: number) => {
    const audio = audioRefs.current[index];
    if (!audio || !isPlayingRef.current) return;

    void audio.play();
    setVoices(v => v.map((voice, i) => i === index ? { ...voice, isActive: true } : voice));

    audio.addEventListener('ended', () => {
      setVoices(v => v.map((voice, i) => i === index ? { ...voice, isActive: false } : voice));
      if (!isPlayingRef.current) return;
      const delay = applyJitter(intervalsRef.current[index] ?? MAX_INTERVAL_MS);
      timersRef.current.push(setTimeout(() => startVoice(index), delay));
    }, { once: true } as AddEventListenerOptions);
  }, []);

  // Rebuild when source data changes
  useEffect(() => {
    stopAll();

    const selected = selectVoices(recordings, recentObs);
    if (selected.length === 0) {
      setVoices([]);
      audioRefs.current = [];
      intervalsRef.current = [];
      return;
    }

    const howManys = selected.map(s => s.howMany);
    const minH = Math.min(...howManys);
    const maxH = Math.max(...howManys);
    const intervals = selected.map(s => computeIntervalMs(s.howMany, minH, maxH));

    intervalsRef.current = intervals;
    audioRefs.current = selected.map(s => new Audio(s.recording.file));

    setVoices(
      selected.map((s, i) => ({
        recording: s.recording,
        sciName: s.sciName,
        howMany: s.howMany,
        intervalMs: intervals[i],
        isActive: false,
        photo: null,
      })),
    );

    void Promise.all(
      selected.map(s => fetchBirdPhoto(s.sciName).catch(() => null)),
    ).then(photos => {
      setVoices(v => v.map((voice, i) => ({ ...voice, photo: photos[i] ?? null })));
    });
  }, [recordings, recentObs, stopAll]);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      stopAll();
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      audioRefs.current.forEach((_, i) => {
        const stagger = Math.random() * INITIAL_STAGGER_MS;
        timersRef.current.push(setTimeout(() => startVoice(i), stagger));
      });
    }
  }, [stopAll, startVoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      audioRefs.current.forEach(a => a.pause());
    };
  }, []);

  return { voices, isPlaying, toggle };
}
```

- [ ] **Step 4: Run all tests and confirm they pass**

```
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: all 13 tests pass (8 pure helper + 5 hook)

- [ ] **Step 5: Full suite + build**

```
npx vitest run && npm run build
```

Expected: all tests pass, clean build

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSoundscape.ts src/hooks/useSoundscape.test.ts
git commit -m "feat: complete useSoundscape hook with audio scheduling and photo fetching"
```

---

### Task 3: `SoundscapeControls` component

**Files:**
- Create: `src/components/SoundscapeControls.tsx`
- Create: `src/components/SoundscapeControls.test.tsx`

**Produces:**
```typescript
export interface SoundscapeControlsProps {
  isPlaying: boolean;
  voiceCount: number;
  onToggle: () => void;
}
export function SoundscapeControls(props: SoundscapeControlsProps): JSX.Element | null
```

- [ ] **Step 1: Write failing tests**

Create `src/components/SoundscapeControls.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SoundscapeControls } from './SoundscapeControls';

describe('SoundscapeControls', () => {
  it('renders nothing when voiceCount is 0', () => {
    const { container } = render(
      <SoundscapeControls isPlaying={false} voiceCount={0} onToggle={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "N birds playing" when playing', () => {
    render(<SoundscapeControls isPlaying={true} voiceCount={5} onToggle={vi.fn()} />);
    expect(screen.getByText('5 birds playing')).toBeInTheDocument();
  });

  it('shows "N birds ready" when paused', () => {
    render(<SoundscapeControls isPlaying={false} voiceCount={3} onToggle={vi.fn()} />);
    expect(screen.getByText('3 birds ready')).toBeInTheDocument();
  });

  it('calls onToggle when the button is clicked', () => {
    const onToggle = vi.fn();
    render(<SoundscapeControls isPlaying={false} voiceCount={3} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```
npx vitest run src/components/SoundscapeControls.test.tsx
```

Expected: FAIL — "Cannot find module './SoundscapeControls'"

- [ ] **Step 3: Implement**

Create `src/components/SoundscapeControls.tsx`:

```typescript
export interface SoundscapeControlsProps {
  isPlaying: boolean;
  voiceCount: number;
  onToggle: () => void;
}

export function SoundscapeControls({ isPlaying, voiceCount, onToggle }: SoundscapeControlsProps) {
  if (voiceCount === 0) return null;

  return (
    <div className="shrink-0 bg-gray-900 flex items-center justify-center gap-4 py-3 px-6">
      <button
        onClick={onToggle}
        aria-label={isPlaying ? 'Pause soundscape' : 'Play soundscape'}
        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-colors ${
          isPlaying
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-white hover:bg-gray-100 text-gray-900'
        }`}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <span className="text-white text-sm">
        {isPlaying ? `${voiceCount} birds playing` : `${voiceCount} birds ready`}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and confirm pass**

```
npx vitest run src/components/SoundscapeControls.test.tsx
```

Expected: 4/4 pass

- [ ] **Step 5: Full suite + build**

```
npx vitest run && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/SoundscapeControls.tsx src/components/SoundscapeControls.test.tsx
git commit -m "feat: add SoundscapeControls play/pause bar"
```

---

### Task 4: `SoundscapeGrid` component

**Files:**
- Create: `src/components/SoundscapeGrid.tsx`
- Create: `src/components/SoundscapeGrid.test.tsx`

**Consumes from Task 1:** `import type { SoundscapeVoice } from '../hooks/useSoundscape'`

**Produces:**
```typescript
interface SoundscapeGridProps { voices: SoundscapeVoice[]; }
export function SoundscapeGrid(props: SoundscapeGridProps): JSX.Element | null
```

- [ ] **Step 1: Write failing tests**

Create `src/components/SoundscapeGrid.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { SoundscapeGrid } from './SoundscapeGrid';
import type { SoundscapeVoice } from '../hooks/useSoundscape';
import type { XCRecording } from '../api/xeno-canto';

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
    photo: null,
    ...overrides,
  };
}

describe('SoundscapeGrid', () => {
  it('renders nothing when voices is empty', () => {
    const { container } = render(<SoundscapeGrid voices={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one card per voice using recording.en as alt text', () => {
    const voices = [
      makeVoice({ recording: { ...makeVoice().recording, en: 'American Robin', gen: 'Turdus', sp: 'migratorius', id: '1' } }),
      makeVoice({ sciName: 'Parus major', recording: { ...makeVoice().recording, en: 'Great Tit', gen: 'Parus', sp: 'major', id: '2' } }),
    ];
    render(<SoundscapeGrid voices={voices} />);
    expect(screen.getByAltText('American Robin')).toBeInTheDocument();
    expect(screen.getByAltText('Great Tit')).toBeInTheDocument();
  });

  it('active card has ring-green-400 class', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: true })]} />);
    expect(container.querySelector('.ring-green-400')).toBeTruthy();
  });

  it('inactive card does not have ring-green-400', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: false })]} />);
    expect(container.querySelector('.ring-green-400')).toBeNull();
  });

  it('inactive card has brightness-50 class', () => {
    const { container } = render(<SoundscapeGrid voices={[makeVoice({ isActive: false })]} />);
    expect(container.querySelector('.brightness-50')).toBeTruthy();
  });

  it('uses photo.photoUrl when photo is available', () => {
    const voice = makeVoice({
      photo: { photoUrl: 'https://photo.jpg', largeUrl: 'https://photo-l.jpg', attribution: '© x', licenseCode: 'cc-by' },
    });
    render(<SoundscapeGrid voices={[voice]} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://photo.jpg');
  });

  it('falls back to recording.sono.small when photo is null', () => {
    render(<SoundscapeGrid voices={[makeVoice({ photo: null })]} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://xc.org/sono.png');
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: FAIL — "Cannot find module './SoundscapeGrid'"

- [ ] **Step 3: Implement**

Create `src/components/SoundscapeGrid.tsx`:

```typescript
import type { SoundscapeVoice } from '../hooks/useSoundscape';

interface SoundscapeGridProps {
  voices: SoundscapeVoice[];
}

export function SoundscapeGrid({ voices }: SoundscapeGridProps) {
  if (voices.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 z-20 p-2 flex gap-2">
      {voices.map(voice => {
        const imgSrc = voice.photo?.photoUrl ?? voice.recording.sono.small;
        return (
          <div
            key={voice.recording.id}
            className={`relative w-[90px] h-[110px] rounded-lg overflow-hidden bg-black/60 shrink-0 ring-2 transition-all duration-300 ${
              voice.isActive ? 'ring-green-400' : 'ring-transparent brightness-50'
            }`}
          >
            <img
              src={imgSrc}
              alt={voice.recording.en}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
              <p className={`text-xs text-white truncate transition-opacity duration-300 ${voice.isActive ? 'opacity-100' : 'opacity-60'}`}>
                {voice.recording.en}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests and confirm pass**

```
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: 7/7 pass

- [ ] **Step 5: Full suite + build**

```
npx vitest run && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/SoundscapeGrid.tsx src/components/SoundscapeGrid.test.tsx
git commit -m "feat: add SoundscapeGrid floating bird photo strip"
```

---

### Task 5: Wire MapView

**Files:**
- Modify: `src/components/MapView.tsx`

**Consumes from Tasks 1–4:**
- `useSoundscape` from `../hooks/useSoundscape`
- `SoundscapeGrid` from `./SoundscapeGrid`
- `SoundscapeControls` from `./SoundscapeControls`

No new test file needed. Run full suite to confirm existing MapView geo-cache tests still pass.

- [ ] **Step 1: Replace MapView.tsx**

Write `src/components/MapView.tsx` with this content (all existing logic preserved, new additions marked):

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

import type { LatLng } from '../utils/geo';
import { haversineKm } from '../utils/geo';
import type { EBirdObservation } from '../api/ebird';
import { fetchRecentNearby, fetchNearbyNotable } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';
import { fetchRecordingsByBox } from '../api/xeno-canto';
import { useFeaturedBird } from '../hooks/useFeaturedBird';
import { useSoundscape } from '../hooks/useSoundscape';
import { FeaturedBirdCard } from './FeaturedBirdCard';
import { SoundscapeGrid } from './SoundscapeGrid';
import { SoundscapeControls } from './SoundscapeControls';

const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const FETCH_RADIUS_KM = 10;
const DEBOUNCE_MS = 500;
const XC_BOX_DEG = 0.225;

function PinHandler({ onPin }: { onPin: (pos: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function MapView() {
  const [pin, setPin] = useState<LatLng | null>(null);
  const [notableObs, setNotableObs] = useState<EBirdObservation[]>([]);
  const [recentObs, setRecentObs] = useState<EBirdObservation[]>([]);
  const [recordings, setRecordings] = useState<XCRecording[]>([]);

  const lastFetchRef = useRef<LatLng | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const featured = useFeaturedBird({
    notableObservations: notableObs,
    recentObservations: recentObs,
    recordings,
  });

  const soundscape = useSoundscape(recordings, recentObs);

  const fetchForPin = useCallback(async (pos: LatLng) => {
    if (lastFetchRef.current && haversineKm(pos, lastFetchRef.current) < FETCH_RADIUS_KM) return;
    lastFetchRef.current = pos;

    const month = new Date().getMonth() + 1;
    const [notable, recent, xcRes] = await Promise.all([
      fetchNearbyNotable(pos.lat, pos.lng),
      fetchRecentNearby(pos.lat, pos.lng),
      fetchRecordingsByBox(
        pos.lat - XC_BOX_DEG,
        pos.lat + XC_BOX_DEG,
        pos.lng - XC_BOX_DEG,
        pos.lng + XC_BOX_DEG,
        month,
      ),
    ]);

    setNotableObs(notable);
    setRecentObs(recent);
    setRecordings(xcRes.recordings);
  }, []);

  const handlePin = useCallback(
    (pos: LatLng) => {
      setPin(pos);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void fetchForPin(pos), DEBOUNCE_MS);
    },
    [fetchForPin],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <header className="px-4 py-2 bg-green-800 text-white flex items-center gap-3 shrink-0">
        <span className="text-lg font-semibold">Bird Soundscape Explorer</span>
        {pin && (
          <span className="text-sm text-green-200 ml-auto">
            {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Map wrapper: relative so SoundscapeGrid can position inside it */}
        <div className="relative flex-1">
          <MapContainer center={[20, 0]} zoom={3} className="w-full h-full cursor-crosshair">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <PinHandler onPin={handlePin} />
            {pin && <Marker position={[pin.lat, pin.lng]} icon={defaultIcon} />}
          </MapContainer>
          <SoundscapeGrid voices={soundscape.voices} />
        </div>

        {featured.observation && (
          <FeaturedBirdCard
            observation={featured.observation}
            taxon={featured.taxon}
            photo={featured.photo}
            recording={featured.recording}
            isNotable={featured.isNotable}
            mode={featured.mode}
            onToggleMode={featured.onToggleMode}
            showToggle={featured.showToggle}
          />
        )}
      </div>

      <SoundscapeControls
        isPlaying={soundscape.isPlaying}
        voiceCount={soundscape.voices.length}
        onToggle={soundscape.toggle}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```
npx vitest run
```

Expected: all tests pass (MapView geo-cache tests + all new component/hook tests)

- [ ] **Step 3: Build check**

```
npm run build
```

Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: wire soundscape player and grid into MapView"
```
