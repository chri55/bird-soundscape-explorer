# Playback Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-bird XC play button in the species detail view and a per-slot reroll dice button in the soundscape grid that fetches a fresh species from the eBird observation list.

**Architecture:** Four tasks: (1) XC blocklist utility in localStorage; (2) play button added to SpeciesDetail; (3) `rerollVoice` added to `useSoundscape` (uses blocklist); (4) dice button wired into SoundscapeGrid and MapView. Tasks 1 and 2 are independent. Task 3 depends on Task 1. Task 4 depends on Task 3.

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Font Awesome (`@fortawesome/free-solid-svg-icons`), Vitest + React Testing Library

## Global Constraints

- `verbatimModuleSyntax: true` — type-only imports must use `import type { ... }` on a separate line
- Run tests: `npm run test`; existing 146 tests must still pass after each task
- No new npm packages — Font Awesome is already installed
- Tailwind CSS v4 — inline `className` strings only, no `@apply`
- All `<button>` elements must have `type="button"` explicitly

---

### Task 1: XC blocklist utility

**Files:**
- Create: `src/utils/xc-blocklist.ts`
- Create: `src/utils/xc-blocklist.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function readBlocklist(): Set<string>
  export function addToBlocklist(sciName: string): void
  ```

- [ ] **Step 1: Write failing tests**

Create `src/utils/xc-blocklist.test.ts`:

```typescript
import { readBlocklist, addToBlocklist } from './xc-blocklist';

beforeEach(() => { localStorage.clear(); });

describe('xc-blocklist', () => {
  it('readBlocklist returns empty set when storage is empty', () => {
    expect(readBlocklist().size).toBe(0);
  });

  it('addToBlocklist adds a sciName; readBlocklist includes it', () => {
    addToBlocklist('Turdus migratorius');
    expect(readBlocklist().has('Turdus migratorius')).toBe(true);
  });

  it('readBlocklist excludes entries older than 24h', () => {
    const old = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem('xc_no_recording_v1', JSON.stringify([
      { sciName: 'Turdus migratorius', blockedAt: old },
    ]));
    expect(readBlocklist().has('Turdus migratorius')).toBe(false);
  });

  it('readBlocklist prunes expired entries from storage', () => {
    const old = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem('xc_no_recording_v1', JSON.stringify([
      { sciName: 'Turdus migratorius', blockedAt: old },
    ]));
    readBlocklist();
    expect(
      JSON.parse(localStorage.getItem('xc_no_recording_v1') ?? '[]') as unknown[],
    ).toHaveLength(0);
  });

  it('readBlocklist includes entries younger than 24h', () => {
    const fresh = Date.now() - 1 * 60 * 60 * 1000;
    localStorage.setItem('xc_no_recording_v1', JSON.stringify([
      { sciName: 'Parus major', blockedAt: fresh },
    ]));
    expect(readBlocklist().has('Parus major')).toBe(true);
  });

  it('addToBlocklist replaces duplicate sciName rather than appending', () => {
    addToBlocklist('Turdus migratorius');
    addToBlocklist('Turdus migratorius');
    const entries = JSON.parse(
      localStorage.getItem('xc_no_recording_v1') ?? '[]',
    ) as unknown[];
    expect(entries).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/xc-blocklist.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/utils/xc-blocklist.ts`**

```typescript
const STORAGE_KEY = 'xc_no_recording_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

interface BlocklistEntry {
  sciName: string;
  blockedAt: number;
}

export function readBlocklist(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const entries = JSON.parse(raw) as BlocklistEntry[];
    const now = Date.now();
    const live = entries.filter(e => now - e.blockedAt < TTL_MS);
    if (live.length !== entries.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(live));
    }
    return new Set(live.map(e => e.sciName));
  } catch {
    return new Set();
  }
}

export function addToBlocklist(sciName: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const entries: BlocklistEntry[] = raw ? JSON.parse(raw) as BlocklistEntry[] : [];
    const now = Date.now();
    const pruned = entries.filter(e => now - e.blockedAt < TTL_MS && e.sciName !== sciName);
    pruned.push({ sciName, blockedAt: now });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage unavailable — silently no-op
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/utils/xc-blocklist.test.ts
```

Expected: 6 tests pass

- [ ] **Step 5: Run full suite**

```bash
npm run test
```

Expected: 152 tests pass (146 + 6)

- [ ] **Step 6: Commit**

```bash
git add src/utils/xc-blocklist.ts src/utils/xc-blocklist.test.ts
git commit -m "feat: add XC no-recording blocklist utility with 24h TTL"
```

---

### Task 2: XC play button in SpeciesDetail

**Files:**
- Modify: `src/components/SpeciesDetail.tsx`
- Modify: `src/components/SpeciesDetail.test.tsx`

**Interfaces:**
- Consumes: `fetchRecordings(query: string): Promise<XCResponse>` from `../api/xeno-canto` (already exported)
- Consumes: `bestRecording(sciName: string, recordings: XCRecording[]): XCRecording | null` from `../utils/species` (already exported)

- [ ] **Step 1: Add failing tests**

In `src/components/SpeciesDetail.test.tsx`:

**1a.** Add mock for xeno-canto at the top, alongside the other mocks:

```typescript
vi.mock('../api/xeno-canto', () => ({ fetchRecordings: vi.fn() }));
import { fetchRecordings } from '../api/xeno-canto';
```

**1b.** Add `fetchRecordings` default to `beforeEach`:

```typescript
  vi.mocked(fetchRecordings).mockResolvedValue({
    numRecordings: '0', numSpecies: '0', page: 1, numPages: 1, recordings: [],
  });
```

**1c.** Add `fetchRecordings` to `afterEach` clear:

No change needed — `vi.clearAllMocks()` already clears all mocks.

**1d.** Add these tests inside the `describe('SpeciesDetail', ...)` block:

```typescript
  it('shows Play call button after loading', async () => {
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    expect(screen.getByRole('button', { name: /play call/i })).toBeInTheDocument();
  });

  it('shows Loading while fetchRecordings is pending', async () => {
    vi.mocked(fetchRecordings).mockImplementation(() => new Promise(() => {}));
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    fireEvent.click(screen.getByRole('button', { name: /play call/i }));
    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows No recording when XC returns empty results', async () => {
    vi.mocked(fetchRecordings).mockResolvedValue({
      numRecordings: '0', numSpecies: '0', page: 1, numPages: 1, recordings: [],
    });
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /play call/i }));
    });
    expect(screen.getByRole('button', { name: /no recording/i })).toBeDisabled();
  });

  it('shows attribution text when recording is found', async () => {
    const xcRec = {
      id: '1', gen: 'Turdus', sp: 'migratorius', en: 'American Robin',
      rec: 'Jane Smith', cnt: 'US', loc: 'Central Park',
      lat: '40', lon: '-73', type: 'song', q: 'A',
      file: 'https://xc.org/1.mp3', date: '2024-01-01',
      'file-name': '1.mp3', sono: { small: '', med: '' },
    };
    vi.mocked(fetchRecordings).mockResolvedValue({
      numRecordings: '1', numSpecies: '1', page: 1, numPages: 1, recordings: [xcRec],
    });
    vi.stubGlobal('Audio', class {
      src: string;
      constructor(src: string) { this.src = src; }
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
      load = vi.fn();
      addEventListener = vi.fn();
    });
    await act(async () => {
      render(<SpeciesDetail obs={obs} recordings={[]} onBack={vi.fn()} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /play call/i }));
    });
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
```

- [ ] **Step 2: Run tests to verify new ones fail**

```bash
npx vitest run src/components/SpeciesDetail.test.tsx
```

Expected: 4 new tests fail (Play call button not found etc.)

- [ ] **Step 3: Update `src/components/SpeciesDetail.tsx`**

**3a.** Add imports at the top (after the existing `import type { WikiSummary }` line):

```typescript
import { fetchRecordings } from '../api/xeno-canto';
import { bestRecording } from '../utils/species';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faSpinner } from '@fortawesome/free-solid-svg-icons';
```

**3b.** Inside the `SpeciesDetail` function, add state after the existing `useState` calls:

```typescript
  const [playState, setPlayState] = useState<'idle' | 'loading' | 'playing' | 'none'>('idle');
  const [playRecording, setPlayRecording] = useState<XCRecording | null>(null);
  const playAudioRef = useRef<HTMLAudioElement | null>(null);
```

**3c.** Add two effects after the existing `useEffect` that fetches photo/taxonomy:

```typescript
  // Reset play state when the species changes
  useEffect(() => {
    if (playAudioRef.current) {
      playAudioRef.current.pause();
      playAudioRef.current = null;
    }
    setPlayState('idle');
    setPlayRecording(null);
  }, [obs.sciName]);

  // Pause audio on unmount
  useEffect(() => {
    return () => {
      playAudioRef.current?.pause();
    };
  }, []);
```

**3d.** Add `handlePlay` function before the `return` statement:

```typescript
  async function handlePlay() {
    if (playState === 'playing') {
      playAudioRef.current?.pause();
      playAudioRef.current?.load();
      setPlayState('idle');
      return;
    }
    if (playState === 'loading' || playState === 'none') return;

    setPlayState('loading');

    let rec = playRecording;
    if (!rec) {
      const [genus, species] = obs.sciName.split(' ');
      try {
        const response = await fetchRecordings(`gen:${genus} sp:${species}`);
        rec = bestRecording(obs.sciName, response.recordings);
      } catch {
        setPlayState('idle');
        return;
      }
      if (!rec) {
        setPlayState('none');
        return;
      }
      setPlayRecording(rec);
    }

    const audio = new Audio(rec.file);
    playAudioRef.current = audio;
    audio.addEventListener('ended', () => setPlayState('idle'), { once: true } as AddEventListenerOptions);
    void audio.play()
      .then(() => setPlayState('playing'))
      .catch(() => setPlayState('idle'));
  }
```

**3e.** In the JSX, add the play button and attribution inside the external links `div` (the one containing Wikipedia ↗ and eBird ↗), before the closing `</div>`:

```tsx
            <button
              type="button"
              onClick={() => void handlePlay()}
              disabled={playState === 'none' || playState === 'loading'}
              aria-label={
                playState === 'idle' ? 'Play call' :
                playState === 'loading' ? 'Loading' :
                playState === 'playing' ? 'Stop' : 'No recording'
              }
              className={`text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 ${
                playState === 'none'
                  ? 'bg-gray-100 text-gray-400 cursor-default'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              <FontAwesomeIcon
                icon={playState === 'loading' ? faSpinner : playState === 'playing' ? faStop : faPlay}
                className={playState === 'loading' ? 'fa-spin' : ''}
              />
              {playState === 'idle' && 'Play call'}
              {playState === 'loading' && 'Loading…'}
              {playState === 'playing' && 'Stop'}
              {playState === 'none' && 'No recording'}
            </button>
```

**3f.** Add attribution below the external links div (after it closes), before the photo attribution div:

```tsx
          {playRecording && (
            <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
              <p>Rec: {playRecording.rec} · {playRecording.type} · Quality {playRecording.q} · {playRecording.loc}</p>
            </div>
          )}
```

- [ ] **Step 4: Run SpeciesDetail tests**

```bash
npx vitest run src/components/SpeciesDetail.test.tsx
```

Expected: 14 tests pass (10 existing + 4 new)

- [ ] **Step 5: Run full suite**

```bash
npm run test
```

Expected: 156 tests pass (152 + 4)

- [ ] **Step 6: Commit**

```bash
git add src/components/SpeciesDetail.tsx src/components/SpeciesDetail.test.tsx
git commit -m "feat: add XC play button with attribution to SpeciesDetail"
```

---

### Task 3: rerollVoice in useSoundscape

**Files:**
- Modify: `src/hooks/useSoundscape.ts`
- Modify: `src/hooks/useSoundscape.test.ts`

**Interfaces:**
- Consumes (new): `readBlocklist`, `addToBlocklist` from `../utils/xc-blocklist` (Task 1)
- Consumes (new): `fetchRecordings` from `../api/xeno-canto`
- Consumes (new): `bestRecording` from `../utils/species`
- Produces: `useSoundscape(recordings, recentObs, notableObs?)` — `notableObs` defaults to `[]`
- Produces (new on `UseSoundscapeResult`): `rerollVoice: (index: number) => void`

- [ ] **Step 1: Add failing tests**

**1a.** Add imports and mock at the top of `src/hooks/useSoundscape.test.ts` (alongside the existing `inat` mock):

```typescript
import { fetchRecordings } from '../api/xeno-canto';
vi.mock('../api/xeno-canto', () => ({ fetchRecordings: vi.fn() }));
```

**1b.** Add `fetchRecordings` reset in `beforeEach`:

```typescript
  vi.mocked(fetchRecordings).mockResolvedValue({
    numRecordings: '0', numSpecies: '0', page: 1, numPages: 1, recordings: [],
  });
```

**1c.** Add this `describe` block at the bottom of the test file, after the existing `useSoundscape` describe:

```typescript
describe('rerollVoice', () => {
  it('sets slot to isLoading:true immediately on reroll', async () => {
    vi.mocked(fetchRecordings).mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.rerollVoice(0); });

    expect(result.current.voices[0].isLoading).toBe(true);
    expect(result.current.voices[0].isActive).toBe(false);
  });

  it('sets isFailed when all candidates return no XC recordings', async () => {
    vi.mocked(fetchRecordings).mockResolvedValue({
      numRecordings: '0', numSpecies: '0', page: 1, numPages: 1, recordings: [],
    });
    const notableObs = [makeObs('Parus major', 5)];
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1], notableObs));
    await act(async () => { await vi.runAllTimersAsync(); });

    await act(async () => { result.current.rerollVoice(0); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.voices[0].isFailed).toBe(true);
  });

  it('replaces voice sciName when a matching XC recording is found', async () => {
    const parusMajorRec = makeRec({ gen: 'Parus', sp: 'major', id: '99', en: 'Great Tit' });
    const notableObs = [makeObs('Parus major', 5)];
    vi.mocked(fetchRecordings).mockImplementation((query: string) =>
      Promise.resolve({
        numRecordings: query.includes('Parus') ? '1' : '0',
        numSpecies: query.includes('Parus') ? '1' : '0',
        page: 1, numPages: 1,
        recordings: query.includes('Parus') ? [parusMajorRec] : [],
      }),
    );
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1], notableObs));
    await act(async () => { await vi.runAllTimersAsync(); });

    await act(async () => { result.current.rerollVoice(0); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.voices[0].sciName).toBe('Parus major');
  });

  it('queries XC with gen:X sp:Y format derived from sciName', async () => {
    const notableObs = [makeObs('Parus major', 5)];
    vi.mocked(fetchRecordings).mockResolvedValue({
      numRecordings: '0', numSpecies: '0', page: 1, numPages: 1, recordings: [],
    });
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1], notableObs));
    await act(async () => { await vi.runAllTimersAsync(); });

    await act(async () => { result.current.rerollVoice(0); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(vi.mocked(fetchRecordings)).toHaveBeenCalledWith(
      expect.stringMatching(/gen:Parus sp:major/),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: 4 new `rerollVoice` tests fail (property does not exist)

- [ ] **Step 3: Update `src/hooks/useSoundscape.ts`**

**3a.** Add imports at the top (after the existing imports):

```typescript
import { fetchRecordings } from '../api/xeno-canto';
import { bestRecording } from '../utils/species';
import { readBlocklist, addToBlocklist } from '../utils/xc-blocklist';
```

**3b.** Add `notableObs` parameter to `useSoundscape` (default `[]`):

```typescript
export function useSoundscape(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
  notableObs: EBirdObservation[] = [],
): UseSoundscapeResult {
```

**3c.** Add `rerollVoice` to the `UseSoundscapeResult` interface:

```typescript
export interface UseSoundscapeResult {
  voices: SoundscapeVoice[];
  isPlaying: boolean;
  toggle: () => void;
  toggleMute: (index: number) => void;
  muteAll: () => void;
  allMuted: boolean;
  loadedCount: number;
  rerollVoice: (index: number) => void;
}
```

**3d.** Add three new refs inside the hook body, after the existing refs:

```typescript
  const notableObsRef = useRef<EBirdObservation[]>(notableObs);
  const recentObsRef  = useRef<EBirdObservation[]>(recentObs);
  const voicesRef     = useRef<SoundscapeVoice[]>([]);
```

**3e.** Add three effects to keep the refs in sync, after the existing `stopAll`/`pauseAll` callbacks:

```typescript
  useEffect(() => { notableObsRef.current = notableObs; }, [notableObs]);
  useEffect(() => { recentObsRef.current  = recentObs;  }, [recentObs]);
  useEffect(() => { voicesRef.current     = voices;     }, [voices]);
```

**3f.** Add the `MAX_REROLL_ATTEMPTS` constant at the top of the file alongside the other constants:

```typescript
export const MAX_REROLL_ATTEMPTS = 5;
```

**3g.** Add `rerollVoice` as a `useCallback` after the `muteAll` callback (before `toggle`):

```typescript
  const rerollVoice = useCallback((index: number) => {
    // Stop and discard old audio for this slot
    const oldAudio = audioRefs.current[index];
    if (oldAudio) {
      const oldEnded = endedHandlersRef.current[index];
      if (oldEnded) {
        oldAudio.removeEventListener('ended', oldEnded);
        endedHandlersRef.current[index] = undefined;
      }
      oldAudio.pause();
      oldAudio.src = '';
      oldAudio.load();
    }
    isMutedRef.current[index]   = false;
    pendingEndedRef.current[index] = false;

    setVoices(v => v.map((voice, i) =>
      i === index ? { ...voice, isLoading: true, isActive: false, isFailed: false } : voice,
    ));

    // Build candidate list — union of notableObs + recentObs, deduped, excluding
    // species active in other slots and species in the 24h XC blocklist
    const activeSciNames = new Set(
      voicesRef.current.filter((_, i) => i !== index).map(v => v.sciName),
    );
    const blocklist = readBlocklist();
    const seen = new Set<string>();
    const allObs = [...notableObsRef.current, ...recentObsRef.current];
    const candidates: EBirdObservation[] = [];
    for (const obs of allObs) {
      if (!seen.has(obs.sciName) && !activeSciNames.has(obs.sciName) && !blocklist.has(obs.sciName)) {
        seen.add(obs.sciName);
        candidates.push(obs);
      }
    }
    candidates.sort((a, b) => (b.howMany ?? 0) - (a.howMany ?? 0));

    void (async () => {
      for (const candidate of candidates.slice(0, MAX_REROLL_ATTEMPTS)) {
        const [genus, species] = candidate.sciName.split(' ');
        try {
          const response = await fetchRecordings(`gen:${genus} sp:${species}`);
          const best = bestRecording(candidate.sciName, response.recordings);
          if (best) {
            const newAudio = new Audio(best.file);
            audioRefs.current[index]       = newAudio;
            retryCountsRef.current[index]  = 0;
            intervalsRef.current[index]    = MAX_INTERVAL_MS;

            newAudio.addEventListener('canplay', () => {
              setVoices(v => v.map((voice, i) =>
                i === index ? { ...voice, isLoading: false } : voice,
              ));
              if (isPlayingRef.current && !isMutedRef.current[index]) startVoice(index);
            }, { once: true } as AddEventListenerOptions);

            newAudio.addEventListener('error', () => {
              setVoices(v => v.map((voice, i) =>
                i === index ? { ...voice, isFailed: true, isLoading: false } : voice,
              ));
            }, { once: true } as AddEventListenerOptions);

            const photo = await fetchBirdPhoto(candidate.sciName).catch(() => null);

            setVoices(v => v.map((voice, i) => i === index ? {
              recording: best,
              sciName:   candidate.sciName,
              howMany:   candidate.howMany ?? 1,
              intervalMs: MAX_INTERVAL_MS,
              isActive:  false,
              isLoading: true,
              isFailed:  false,
              isMuted:   false,
              photo:     photo ?? null,
            } : voice));
            return;
          } else {
            addToBlocklist(candidate.sciName);
          }
        } catch {
          // Network error — skip this candidate without blocklisting it
        }
      }
      // All attempts exhausted
      setVoices(v => v.map((voice, i) =>
        i === index ? { ...voice, isFailed: true, isLoading: false } : voice,
      ));
    })();
  }, [startVoice]);
```

**3h.** Add `rerollVoice` to the return statement at the bottom:

```typescript
  return { voices, isPlaying, toggle, toggleMute, muteAll, allMuted, loadedCount, rerollVoice };
```

- [ ] **Step 4: Run useSoundscape tests**

```bash
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: all tests pass (existing + 4 new rerollVoice tests)

- [ ] **Step 5: Run full suite**

```bash
npm run test
```

Expected: 160 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSoundscape.ts src/hooks/useSoundscape.test.ts
git commit -m "feat: add rerollVoice to useSoundscape with XC fetch and blocklist"
```

---

### Task 4: Dice button in SoundscapeGrid and MapView wiring

**Files:**
- Modify: `src/components/SoundscapeGrid.tsx`
- Modify: `src/components/SoundscapeGrid.test.tsx`
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- Consumes: `rerollVoice: (index: number) => void` from `useSoundscape` (Task 3)
- `SoundscapeGridProps` gains: `onReroll: (index: number) => void`

- [ ] **Step 1: Add failing tests**

Add these tests to `src/components/SoundscapeGrid.test.tsx` inside the `describe('SoundscapeGrid', ...)` block. First add `fireEvent` to the import:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
```

Then add the tests:

```typescript
  it('renders a reroll button per non-failed voice', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice()]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    expect(container.querySelector('button[aria-label="Reroll bird"]')).toBeTruthy();
  });

  it('calls onReroll with the correct index when clicked', () => {
    const onReroll = vi.fn();
    const rec2 = {
      id: '2', gen: 'Parus', sp: 'major', en: 'Great Tit',
      rec: 'Jane', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
      type: 'song', q: 'A', file: 'https://xc.org/2.mp3', date: '2024-01-01',
      'file-name': '2.mp3', sono: { small: '', med: '' },
    };
    const voices = [
      makeVoice(),
      makeVoice({ recording: rec2, sciName: 'Parus major' }),
    ];
    const { container } = render(
      <SoundscapeGrid voices={voices} onToggleMute={vi.fn()} onReroll={onReroll} />,
    );
    const diceButtons = container.querySelectorAll('button[aria-label="Reroll bird"]');
    fireEvent.click(diceButtons[1]!);
    expect(onReroll).toHaveBeenCalledWith(1);
  });

  it('does not render reroll button for failed voices', () => {
    const { container } = render(
      <SoundscapeGrid voices={[makeVoice({ isFailed: true })]} onToggleMute={vi.fn()} onReroll={vi.fn()} />,
    );
    expect(container.querySelector('button[aria-label="Reroll bird"]')).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: 3 new tests fail (onReroll prop not recognized)

- [ ] **Step 3: Update `src/components/SoundscapeGrid.tsx`**

**3a.** Add the `faDice` import at the top (alongside the existing FontAwesome imports):

```typescript
import { faVolumeHigh, faVolumeXmark, faDice } from '@fortawesome/free-solid-svg-icons';
```

**3b.** Add `onReroll` to `SoundscapeGridProps`:

```typescript
interface SoundscapeGridProps {
  voices: SoundscapeVoice[];
  onToggleMute: (index: number) => void;
  onReroll: (index: number) => void;
}
```

**3c.** Destructure `onReroll` in the function signature:

```typescript
export function SoundscapeGrid({ voices, onToggleMute, onReroll }: SoundscapeGridProps) {
```

**3d.** Add the dice button inside each card's `<div className="relative group ...">`, placed directly before the existing mute button:

```tsx
            {/* Reroll button */}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onReroll(i); }}
              aria-label="Reroll bird"
              className="absolute top-1 left-1 z-20 w-6 h-6 flex items-center justify-center rounded text-white bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            >
              <FontAwesomeIcon icon={faDice} className="text-xs" />
            </button>
```

- [ ] **Step 4: Update `src/components/MapView.tsx`**

**4a.** Pass `notableObs` to `useSoundscape` (line with `useSoundscape` call):

```typescript
  const soundscape = useSoundscape(recordings, recentObs, notableObs);
```

**4b.** Pass `onReroll` to `SoundscapeGrid`:

```tsx
            <SoundscapeGrid
              voices={soundscape.voices}
              onToggleMute={soundscape.toggleMute}
              onReroll={soundscape.rerollVoice}
            />
```

- [ ] **Step 5: Run SoundscapeGrid tests**

```bash
npx vitest run src/components/SoundscapeGrid.test.tsx
```

Expected: all tests pass (11 existing + 3 new = 14 total)

- [ ] **Step 6: Run full suite**

```bash
npm run test
```

Expected: 163 tests pass (160 + 3)

- [ ] **Step 7: Commit**

```bash
git add src/components/SoundscapeGrid.tsx src/components/SoundscapeGrid.test.tsx src/components/MapView.tsx
git commit -m "feat: add dice reroll button to SoundscapeGrid, wire rerollVoice from useSoundscape"
```
