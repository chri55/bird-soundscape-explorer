# Settings Modal & Bird Exclusion Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings modal (gear icon in header) with a persistent bird exclusion list and data-source attribution, wired into `useSoundscape` so excluded species are never selected for the now-playing slots.

**Architecture:** Four sequential tasks: (1) `useExclusionList` hook that owns localStorage persistence; (2) `SettingsModal` component that consumes the hook's types; (3) `useSoundscape` gains a 4th `excludedSciNames` param that filters candidates at rebuild and reroll time; (4) `MapView` wires all three together and adds the gear button.

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Font Awesome (`@fortawesome/free-solid-svg-icons`), Vitest + React Testing Library

## Global Constraints

- `verbatimModuleSyntax: true` — type-only imports must use `import type { ... }` on a separate line
- Run tests: `npm run test`; all existing tests must still pass after each task
- No new npm packages
- Tailwind CSS v4 — inline `className` strings only, no `@apply`
- All `<button>` elements must have `type="button"` explicitly

---

### Task 1: `useExclusionList` hook

**Files:**
- Create: `src/hooks/useExclusionList.ts`
- Create: `src/hooks/useExclusionList.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface ExclusionEntry {
    sciName: string;
    comName: string;
  }

  export function useExclusionList(): {
    exclusions: ExclusionEntry[];
    excludedSciNames: Set<string>;
    addExclusion: (sciName: string, comName: string) => void;
    removeExclusion: (sciName: string) => void;
  }
  ```

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useExclusionList.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useExclusionList } from './useExclusionList';

beforeEach(() => { localStorage.clear(); });

describe('useExclusionList', () => {
  it('returns empty exclusions when storage is empty', () => {
    const { result } = renderHook(() => useExclusionList());
    expect(result.current.exclusions).toHaveLength(0);
    expect(result.current.excludedSciNames.size).toBe(0);
  });

  it('addExclusion adds an entry and updates excludedSciNames', () => {
    const { result } = renderHook(() => useExclusionList());
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    expect(result.current.exclusions).toHaveLength(1);
    expect(result.current.exclusions[0]).toEqual({ sciName: 'Branta canadensis', comName: 'Canada Goose' });
    expect(result.current.excludedSciNames.has('Branta canadensis')).toBe(true);
  });

  it('addExclusion ignores duplicate sciName', () => {
    const { result } = renderHook(() => useExclusionList());
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    expect(result.current.exclusions).toHaveLength(1);
  });

  it('removeExclusion removes by sciName', () => {
    const { result } = renderHook(() => useExclusionList());
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    act(() => { result.current.removeExclusion('Branta canadensis'); });
    expect(result.current.exclusions).toHaveLength(0);
    expect(result.current.excludedSciNames.has('Branta canadensis')).toBe(false);
  });

  it('reads existing exclusions from localStorage on mount', () => {
    localStorage.setItem('bird_exclusions_v1', JSON.stringify([
      { sciName: 'Branta canadensis', comName: 'Canada Goose' },
    ]));
    const { result } = renderHook(() => useExclusionList());
    expect(result.current.exclusions).toHaveLength(1);
    expect(result.current.excludedSciNames.has('Branta canadensis')).toBe(true);
  });

  it('persists additions to localStorage', () => {
    const { result } = renderHook(() => useExclusionList());
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    const stored = JSON.parse(localStorage.getItem('bird_exclusions_v1') ?? '[]') as unknown[];
    expect(stored).toHaveLength(1);
  });

  it('persists removals to localStorage', () => {
    const { result } = renderHook(() => useExclusionList());
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    act(() => { result.current.removeExclusion('Branta canadensis'); });
    const stored = JSON.parse(localStorage.getItem('bird_exclusions_v1') ?? '[]') as unknown[];
    expect(stored).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/useExclusionList.test.ts
```

Expected: FAIL — "Cannot find module './useExclusionList'"

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useExclusionList.ts`:

```typescript
import { useState, useMemo } from 'react';

const STORAGE_KEY = 'bird_exclusions_v1';

export interface ExclusionEntry {
  sciName: string;
  comName: string;
}

function readStorage(): ExclusionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ExclusionEntry[];
  } catch {
    return [];
  }
}

function writeStorage(entries: ExclusionEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable — silently no-op
  }
}

export function useExclusionList(): {
  exclusions: ExclusionEntry[];
  excludedSciNames: Set<string>;
  addExclusion: (sciName: string, comName: string) => void;
  removeExclusion: (sciName: string) => void;
} {
  const [exclusions, setExclusions] = useState<ExclusionEntry[]>(() => readStorage());

  const excludedSciNames = useMemo(
    () => new Set(exclusions.map(e => e.sciName)),
    [exclusions],
  );

  const addExclusion = (sciName: string, comName: string) => {
    setExclusions(prev => {
      if (prev.some(e => e.sciName === sciName)) return prev;
      const next = [...prev, { sciName, comName }];
      writeStorage(next);
      return next;
    });
  };

  const removeExclusion = (sciName: string) => {
    setExclusions(prev => {
      const next = prev.filter(e => e.sciName !== sciName);
      writeStorage(next);
      return next;
    });
  };

  return { exclusions, excludedSciNames, addExclusion, removeExclusion };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/useExclusionList.test.ts
```

Expected: 7 tests passing

- [ ] **Step 5: Run the full suite to confirm no regressions**

```bash
npm run test
```

Expected: all tests passing

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useExclusionList.ts src/hooks/useExclusionList.test.ts
git commit -m "feat: add useExclusionList hook with localStorage persistence"
```

---

### Task 2: `SettingsModal` component

**Files:**
- Create: `src/components/SettingsModal.tsx`
- Create: `src/components/SettingsModal.test.tsx`

**Interfaces:**
- Consumes:
  ```typescript
  import type { ExclusionEntry } from '../hooks/useExclusionList';
  import type { EBirdObservation } from '../api/ebird';
  ```
- Produces:
  ```typescript
  export function SettingsModal(props: SettingsModalProps): JSX.Element | null
  interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableObs: EBirdObservation[];
    exclusions: ExclusionEntry[];
    onAddExclusion: (sciName: string, comName: string) => void;
    onRemoveExclusion: (sciName: string) => void;
  }
  ```

- [ ] **Step 1: Write failing tests**

Create `src/components/SettingsModal.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import type { EBirdObservation } from '../api/ebird';
import type { ExclusionEntry } from '../hooks/useExclusionList';

function makeObs(sciName: string, comName: string): EBirdObservation {
  return {
    speciesCode: sciName.replace(' ', ''), comName, sciName,
    locName: 'SF', obsDt: '2024-01-01', howMany: 1,
    lat: 37.77, lng: -122.4, obsValid: true, obsReviewed: true, locationPrivate: false,
  };
}

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  availableObs: [] as EBirdObservation[],
  exclusions: [] as ExclusionEntry[],
  onAddExclusion: vi.fn(),
  onRemoveExclusion: vi.fn(),
};

describe('SettingsModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(<SettingsModal {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal heading when isOpen is true', () => {
    render(<SettingsModal {...baseProps} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('disables search input when availableObs is empty', () => {
    render(<SettingsModal {...baseProps} availableObs={[]} />);
    expect(screen.getByPlaceholderText('Drop a pin to see birds')).toBeDisabled();
  });

  it('shows filtered results when typing a matching substring', () => {
    const obs = [makeObs('Branta canadensis', 'Canada Goose')];
    render(<SettingsModal {...baseProps} availableObs={obs} />);
    fireEvent.change(screen.getByPlaceholderText('Search loaded birds…'), { target: { value: 'canada' } });
    expect(screen.getByText('Canada Goose')).toBeInTheDocument();
  });

  it('does not show result for already-excluded species', () => {
    const obs = [makeObs('Branta canadensis', 'Canada Goose')];
    const exclusions: ExclusionEntry[] = [{ sciName: 'Branta canadensis', comName: 'Canada Goose' }];
    render(<SettingsModal {...baseProps} availableObs={obs} exclusions={exclusions} />);
    fireEvent.change(screen.getByPlaceholderText('Search loaded birds…'), { target: { value: 'canada' } });
    // The result in the dropdown is filtered out; only the exclusion list entry shows
    const matches = screen.queryAllByText('Canada Goose');
    // Exclusion list shows one instance; dropdown result is absent
    expect(matches).toHaveLength(1);
  });

  it('calls onAddExclusion with sciName and comName when a result is clicked', () => {
    const onAddExclusion = vi.fn();
    const obs = [makeObs('Branta canadensis', 'Canada Goose')];
    render(<SettingsModal {...baseProps} availableObs={obs} onAddExclusion={onAddExclusion} />);
    fireEvent.change(screen.getByPlaceholderText('Search loaded birds…'), { target: { value: 'canada' } });
    fireEvent.click(screen.getByText('Canada Goose'));
    expect(onAddExclusion).toHaveBeenCalledWith('Branta canadensis', 'Canada Goose');
  });

  it('shows empty-state text when exclusions list is empty', () => {
    render(<SettingsModal {...baseProps} exclusions={[]} />);
    expect(screen.getByText(/No birds excluded/)).toBeInTheDocument();
  });

  it('shows excluded species in the exclusion list', () => {
    const exclusions: ExclusionEntry[] = [{ sciName: 'Branta canadensis', comName: 'Canada Goose' }];
    render(<SettingsModal {...baseProps} exclusions={exclusions} />);
    expect(screen.getByText('Canada Goose')).toBeInTheDocument();
  });

  it('calls onRemoveExclusion with sciName when X button is clicked', () => {
    const onRemoveExclusion = vi.fn();
    const exclusions: ExclusionEntry[] = [{ sciName: 'Branta canadensis', comName: 'Canada Goose' }];
    render(<SettingsModal {...baseProps} exclusions={exclusions} onRemoveExclusion={onRemoveExclusion} />);
    fireEvent.click(screen.getByLabelText('Remove Canada Goose'));
    expect(onRemoveExclusion).toHaveBeenCalledWith('Branta canadensis');
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<SettingsModal {...baseProps} onClose={onClose} />);
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when modal card is clicked', () => {
    const onClose = vi.fn();
    render(<SettingsModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Settings'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders About section with data sources', () => {
    render(<SettingsModal {...baseProps} />);
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('eBird')).toBeInTheDocument();
    expect(screen.getByText('Xeno-canto')).toBeInTheDocument();
    expect(screen.getByText('iNaturalist')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SettingsModal.test.tsx
```

Expected: FAIL — "Cannot find module './SettingsModal'"

- [ ] **Step 3: Implement the component**

Create `src/components/SettingsModal.tsx`:

```typescript
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { EBirdObservation } from '../api/ebird';
import type { ExclusionEntry } from '../hooks/useExclusionList';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableObs: EBirdObservation[];
  exclusions: ExclusionEntry[];
  onAddExclusion: (sciName: string, comName: string) => void;
  onRemoveExclusion: (sciName: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  availableObs,
  exclusions,
  onAddExclusion,
  onRemoveExclusion,
}: SettingsModalProps) {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const excludedSciNames = new Set(exclusions.map(e => e.sciName));
  const results = availableObs
    .filter(obs =>
      !excludedSciNames.has(obs.sciName) &&
      obs.comName.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 8);

  const showDropdown = query.length > 0 && results.length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full mx-4 max-h-[90vh] flex flex-col bg-gray-900 rounded-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
          <h2 className="text-white font-semibold">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          <section>
            <h3 className="text-white font-medium mb-2">Excluded Birds</h3>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={availableObs.length === 0}
                placeholder={availableObs.length === 0 ? 'Drop a pin to see birds' : 'Search loaded birds…'}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              />
              {showDropdown && (
                <ul className="absolute top-full mt-1 w-full bg-gray-800 rounded shadow-lg z-10 overflow-hidden">
                  {results.map(obs => (
                    <li key={obs.sciName}>
                      <button
                        type="button"
                        onClick={() => {
                          onAddExclusion(obs.sciName, obs.comName);
                          setQuery('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors"
                      >
                        <div className="text-white text-sm">{obs.comName}</div>
                        <div className="text-gray-400 text-xs italic">{obs.sciName}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 space-y-1">
              {exclusions.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No birds excluded — soundscape picks from all available species.
                </p>
              ) : (
                exclusions.map(entry => (
                  <div key={entry.sciName} className="flex items-center justify-between py-1">
                    <span className="text-white text-sm">{entry.comName}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${entry.comName}`}
                      onClick={() => onRemoveExclusion(entry.sciName)}
                      className="p-1 text-gray-400 hover:text-white transition-colors ml-2 shrink-0"
                    >
                      <FontAwesomeIcon icon={faXmark} className="text-xs" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h3 className="text-white font-medium mb-2">About</h3>
            <dl className="space-y-1 text-sm text-gray-400">
              <div>
                <dt className="inline font-medium text-gray-300">eBird</dt>
                <dd className="inline"> (Cornell Lab of Ornithology) — Recent bird sighting data</dd>
              </div>
              <div>
                <dt className="inline font-medium text-gray-300">Xeno-canto</dt>
                <dd className="inline"> — Bird audio recordings</dd>
              </div>
              <div>
                <dt className="inline font-medium text-gray-300">iNaturalist</dt>
                <dd className="inline"> — Bird photos</dd>
              </div>
              <div>
                <dt className="inline font-medium text-gray-300">National Park Service</dt>
                <dd className="inline"> — Park locations</dd>
              </div>
              <div>
                <dt className="inline font-medium text-gray-300">OpenStreetMap</dt>
                <dd className="inline"> — Map tiles</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/SettingsModal.test.tsx
```

Expected: 11 tests passing

- [ ] **Step 5: Run the full suite to confirm no regressions**

```bash
npm run test
```

Expected: all tests passing

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsModal.tsx src/components/SettingsModal.test.tsx
git commit -m "feat: add SettingsModal component with exclusion list and about section"
```

---

### Task 3: `useSoundscape` exclusion param

**Files:**
- Modify: `src/hooks/useSoundscape.ts`
- Modify: `src/hooks/useSoundscape.test.ts`

**Interfaces:**
- Consumes: nothing new (uses built-in `Set<string>`)
- Produces (updated signature):
  ```typescript
  export function useSoundscape(
    recordings: XCRecording[],
    recentObs: EBirdObservation[],
    notableObs: EBirdObservation[],
    excludedSciNames: Set<string>,
  ): UseSoundscapeResult
  ```

- [ ] **Step 1: Write failing tests**

Add these two tests to the `describe('rerollVoice', ...)` block at the bottom of `src/hooks/useSoundscape.test.ts`, before the closing `});`:

```typescript
  it('excludes specified species from initial voices', async () => {
    const excluded = new Set(['Turdus migratorius']);
    const { result } = renderHook(() =>
      useSoundscape([xcRec1, xcRec2], [obs1, obs2], [], excluded),
    );
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.voices.every(v => v.sciName !== 'Turdus migratorius')).toBe(true);
    expect(result.current.voices.some(v => v.sciName === 'Parus major')).toBe(true);
  });

  it('rerollVoice skips excluded species', async () => {
    const excluded = new Set(['Parus major']);
    const notableObs = [makeObs('Parus major', 5)];
    const { result } = renderHook(() =>
      useSoundscape([xcRec1], [obs1], notableObs, excluded),
    );
    await act(async () => { await vi.runAllTimersAsync(); });

    await act(async () => { result.current.rerollVoice(0); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(vi.mocked(fetchRecordings)).not.toHaveBeenCalledWith('gen:Parus sp:major');
  });
```

Note: these tests go inside the **existing** `describe('rerollVoice', ...)` block (which is currently a top-level describe at the end of the file).

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: the two new tests fail — `useSoundscape` currently has no 4th param, so the excluded species still appear.

- [ ] **Step 3: Add the 4th param and `excludedSciNamesRef` to `useSoundscape.ts`**

In `src/hooks/useSoundscape.ts`, change the function signature (line 97):

```typescript
export function useSoundscape(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
  notableObs: EBirdObservation[] = [],
  excludedSciNames: Set<string> = new Set(),
): UseSoundscapeResult {
```

After the existing `const rerollSeqRef = useRef<number[]>([]);` line (line 117), add:

```typescript
  const excludedSciNamesRef = useRef<Set<string>>(excludedSciNames);
```

After the existing three single-line `useEffect` calls that sync the obs refs (lines 137–139), add:

```typescript
  useEffect(() => { excludedSciNamesRef.current = excludedSciNames; }, [excludedSciNames]);
```

In the rebuild effect, change line 186 from:

```typescript
    const allCandidates = selectVoices(recordings, recentObs, MAX_VOICES + SPARE_VOICES);
```

to:

```typescript
    const allCandidates = selectVoices(recordings, recentObs, MAX_VOICES + SPARE_VOICES)
      .filter(c => !excludedSciNamesRef.current.has(c.sciName));
```

In `rerollVoice` (around line 392), change the candidate-loop guard from:

```typescript
      if (!seen.has(obs.sciName) && !activeSciNames.has(obs.sciName) && !blocklist.has(obs.sciName)) {
```

to:

```typescript
      if (!seen.has(obs.sciName) && !activeSciNames.has(obs.sciName) && !blocklist.has(obs.sciName) && !excludedSciNamesRef.current.has(obs.sciName)) {
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/useSoundscape.test.ts
```

Expected: all tests passing (including the two new ones)

- [ ] **Step 5: Run the full suite to confirm no regressions**

```bash
npm run test
```

Expected: all tests passing

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSoundscape.ts src/hooks/useSoundscape.test.ts
git commit -m "feat: useSoundscape excludes specified species from voices and reroll"
```

---

### Task 4: MapView wiring

**Files:**
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- Consumes from Task 1: `useExclusionList` — `{ exclusions, excludedSciNames, addExclusion, removeExclusion }`
- Consumes from Task 2: `SettingsModal`
- Consumes from Task 3: `useSoundscape` now accepts `excludedSciNames` as 4th arg

No new test file — the `MapView.test.tsx` tests exercise the rendered output through a mock and will pass as long as the component still renders its key elements. No new behaviour in MapView needs unit testing beyond what the individual component/hook tests cover.

- [ ] **Step 1: Add new imports to `src/components/MapView.tsx`**

At the top of the file, after the existing imports, add:

```typescript
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { useExclusionList } from '../hooks/useExclusionList';
import { SettingsModal } from './SettingsModal';
```

(`FontAwesomeIcon` may already be imported — if so, only add `faGear` to its existing import.)

- [ ] **Step 2: Add `settingsOpen` state and `useExclusionList` inside `MapView`**

After the existing `const [flyToTarget, setFlyToTarget] = useState<LatLng | null>(null);` line, add:

```typescript
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { exclusions, excludedSciNames, addExclusion, removeExclusion } = useExclusionList();
```

- [ ] **Step 3: Pass `excludedSciNames` to `useSoundscape`**

Change the existing `useSoundscape` call from:

```typescript
  const soundscape = useSoundscape(recordings, recentObs, notableObs);
```

to:

```typescript
  const soundscape = useSoundscape(recordings, recentObs, notableObs, excludedSciNames);
```

- [ ] **Step 4: Add the `availableObs` derivation**

After the `useSoundscape` line, add:

```typescript
  const availableObs = [...notableObs, ...recentObs].filter(
    (obs, i, arr) => arr.findIndex(o => o.sciName === obs.sciName) === i,
  );
```

- [ ] **Step 5: Update the header JSX**

Replace the existing `<header>` block:

```tsx
      <header className="px-4 py-2 bg-green-800 text-white flex items-center gap-3 shrink-0">
        <span className="text-lg font-semibold">Bird Soundscape Explorer</span>
        {pin && (
          <span className="text-sm text-green-200 ml-auto">
            {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
          </span>
        )}
      </header>
```

with:

```tsx
      <header className="px-4 py-2 bg-green-800 text-white flex items-center gap-3 shrink-0">
        <span className="text-lg font-semibold">Bird Soundscape Explorer</span>
        {pin && (
          <span className="text-sm text-green-200 ml-auto">
            {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
          </span>
        )}
        <button
          type="button"
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
          className={`${pin ? '' : 'ml-auto '}p-1 rounded hover:bg-green-700 transition-colors`}
        >
          <FontAwesomeIcon icon={faGear} />
        </button>
      </header>
```

- [ ] **Step 6: Add `<SettingsModal>` to the return**

Inside the outermost `<div className="flex flex-col h-screen">`, add `<SettingsModal>` as the last child, just before the closing `</div>`:

```tsx
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          availableObs={availableObs}
          exclusions={exclusions}
          onAddExclusion={addExclusion}
          onRemoveExclusion={removeExclusion}
        />
```

- [ ] **Step 7: Run the full test suite**

```bash
npm run test
```

Expected: all tests passing

- [ ] **Step 8: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: wire settings modal and bird exclusion into MapView"
```
