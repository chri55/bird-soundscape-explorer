import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import {
  selectVoices, computeIntervalMs,
  MIN_INTERVAL_MS, MAX_INTERVAL_MS, MAX_VOICES,
  INITIAL_VOICES, SPARE_VOICES, MAX_AUDIO_RETRIES, RETRY_DELAY_MS,
  useSoundscape, INITIAL_STAGGER_MS,
  SECONDARY_STAGGER_MIN_MS, SECONDARY_STAGGER_MAX_MS,
} from './useSoundscape';
import { renderHook, act } from '@testing-library/react';
import { fetchBirdPhoto } from '../api/inat';
import { fetchRecordings } from '../api/xeno-canto';
import { addToBlocklist } from '../utils/xc-blocklist';

vi.mock('../api/inat', () => ({ fetchBirdPhoto: vi.fn().mockResolvedValue(null) }));
vi.mock('../api/xeno-canto', () => ({ fetchRecordings: vi.fn() }));

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

  it('clamps ratio to [0,1] for out-of-range howMany', () => {
    // howMany above max → ratio=1 → MIN_INTERVAL_MS
    expect(computeIntervalMs(100, 1, 10)).toBe(MIN_INTERVAL_MS);
    // howMany below min → ratio=0 → MAX_INTERVAL_MS
    expect(computeIntervalMs(0, 1, 10)).toBe(MAX_INTERVAL_MS);
  });
});

// ── MockAudio ──────────────────────────────────────────────────────────────
class MockAudio {
  src: string;
  currentTime = 0;
  private _handlers: Record<string, Array<{ fn: () => void; once: boolean }>> = {};
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  load = vi.fn();
  constructor(src: string) { this.src = src; }
  addEventListener(event: string, handler: () => void, options?: { once?: boolean } | boolean) {
    const once = typeof options === 'boolean' ? options : (options?.once ?? false);
    (this._handlers[event] ??= []).push({ fn: handler, once });
  }
  removeEventListener(event: string, handler: () => void) {
    this._handlers[event] = (this._handlers[event] ?? []).filter(h => h.fn !== handler);
  }
  // Test helper: fire the event; only auto-remove handlers registered with { once: true }
  emit(event: string) {
    const entries = [...(this._handlers[event] ?? [])];
    this._handlers[event] = (this._handlers[event] ?? []).filter(h => !h.once);
    entries.forEach(h => h.fn());
  }
}

const audioInstances: MockAudio[] = [];

beforeEach(() => {
  audioInstances.length = 0;
  vi.stubGlobal('Audio', class extends MockAudio {
    constructor(src: string) { super(src); audioInstances.push(this); }
  });
  vi.useFakeTimers();
  vi.mocked(fetchRecordings).mockResolvedValue({
    numRecordings: '0', numSpecies: '0', page: 1, numPages: 1, recordings: [],
  });
  localStorage.clear();
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

describe('useSoundscape — audio tuning', () => {
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

  it('first INITIAL_VOICES voices fire within INITIAL_STAGGER_MS', async () => {
    // 4 recordings: voices 0-2 are "initial", voice 3 waits its intervalMs
    const recs = [
      makeRec({ gen: 'Sp', sp: 'a', id: '1' }),
      makeRec({ gen: 'Sp', sp: 'b', id: '2' }),
      makeRec({ gen: 'Sp', sp: 'c', id: '3' }),
      makeRec({ gen: 'Sp', sp: 'd', id: '4' }),
    ];
    const obs = [
      makeObs('Sp a', 10), makeObs('Sp b', 9), makeObs('Sp c', 8), makeObs('Sp d', 1),
    ];
    const { result } = renderHook(() => useSoundscape(recs, obs));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); });
    // After INITIAL_STAGGER_MS, first 3 should have played
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    const playedCount = audioInstances.slice(0, 3).filter(a => a.play.mock.calls.length > 0).length;
    expect(playedCount).toBe(3);
    // Voice 3's secondary stagger delay is at least INITIAL_STAGGER_MS + SECONDARY_STAGGER_MIN_MS — not yet played
    expect(audioInstances[3]?.play).not.toHaveBeenCalled();
  });

  it('voice isLoading transitions false when canplay fires', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.voices[0].isLoading).toBe(true);

    act(() => { audioInstances[0].emit('canplay'); });
    expect(result.current.voices[0].isLoading).toBe(false);
  });

  it('secondary voices do not fire before INITIAL_STAGGER_MS + SECONDARY_STAGGER_MIN_MS', async () => {
    const recs = [
      makeRec({ gen: 'Sp', sp: 'a', id: '1' }),
      makeRec({ gen: 'Sp', sp: 'b', id: '2' }),
      makeRec({ gen: 'Sp', sp: 'c', id: '3' }),
      makeRec({ gen: 'Sp', sp: 'd', id: '4' }),
    ];
    const obs = [
      makeObs('Sp a', 10), makeObs('Sp b', 9), makeObs('Sp c', 8), makeObs('Sp d', 1),
    ];
    const { result } = renderHook(() => useSoundscape(recs, obs));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); });
    // Advance to just before the earliest a secondary voice can fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + SECONDARY_STAGGER_MIN_MS - 100);
    });
    expect(audioInstances[3]?.play).not.toHaveBeenCalled();
  });

  it('secondary voices all fire by INITIAL_STAGGER_MS + SECONDARY_STAGGER_MAX_MS', async () => {
    const recs = [
      makeRec({ gen: 'Sp', sp: 'a', id: '1' }),
      makeRec({ gen: 'Sp', sp: 'b', id: '2' }),
      makeRec({ gen: 'Sp', sp: 'c', id: '3' }),
      makeRec({ gen: 'Sp', sp: 'd', id: '4' }),
    ];
    const obs = [
      makeObs('Sp a', 10), makeObs('Sp b', 9), makeObs('Sp c', 8), makeObs('Sp d', 1),
    ];
    const { result } = renderHook(() => useSoundscape(recs, obs));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); });
    // Advance past the latest any secondary voice can fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + SECONDARY_STAGGER_MAX_MS + 500);
    });
    expect(audioInstances[3].play).toHaveBeenCalled();
  });
});

describe('useSoundscape — XC retry + voice replacement', () => {
  it('selectVoices respects explicit limit param', () => {
    const recs = Array.from({ length: 10 }, (_, i) =>
      makeRec({ gen: 'Sp', sp: String(i), id: String(i) }),
    );
    expect(selectVoices(recs, [], 5)).toHaveLength(5);
  });

  it('selectVoices returns all available when limit exceeds count', () => {
    expect(selectVoices([makeRec()], [], 12)).toHaveLength(1);
  });

  it('retries audio.load() on error and voice stays active', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });

    expect(audioInstances[0].load).toHaveBeenCalled();
    expect(result.current.voices[0].isFailed).toBe(false);
  });

  it('marks voice isFailed after MAX_AUDIO_RETRIES when spare pool empty', async () => {
    // xcRec1 only → no spare
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    // error → retry 1 → error → retry 2 → error → exhausted
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.voices[0].isFailed).toBe(true);
  });

  it('replaces failed voice in-place with spare from pool', async () => {
    // Need 9 recordings: first MAX_VOICES=8 become active voices, 9th goes to spare pool.
    // With only 2 recordings both land in active slots (slice(0,8) with 2 available = both),
    // leaving the spare pool empty — so we need at least MAX_VOICES+1 recordings here.
    const recs = Array.from({ length: 9 }, (_, i) =>
      makeRec({ gen: 'Sp', sp: String(i), id: String(i) }),
    );
    const obsList = Array.from({ length: 9 }, (_, i) =>
      makeObs(`Sp ${i}`, 10 - i),  // howMany: 10,9,8,...,2 (descending so sort is predictable)
    );
    const { result } = renderHook(() => useSoundscape(recs, obsList));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.voices).toHaveLength(8); // MAX_VOICES active

    const originalName = result.current.voices[0].sciName; // highest howMany = 'Sp 0'

    // exhaust retries on voice 0
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    // voice at same index 0 replaced with the spare (not removed from array)
    expect(result.current.voices[0].sciName).not.toBe(originalName);
    expect(result.current.voices[0].isFailed).toBe(false);
    expect(result.current.voices).toHaveLength(8); // length unchanged
  });

  it('pause does not clear audio src (no error events triggered)', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); }); // play
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    act(() => { result.current.toggle(); }); // pause

    expect(audioInstances[0].src).not.toBe('');
    expect(audioInstances[0].load).not.toHaveBeenCalled();
  });

  it('pause preserves the voices array unchanged', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1, xcRec2], [obs1, obs2]));
    await act(async () => { await vi.runAllTimersAsync(); });

    const sciNamesBefore = result.current.voices.map(v => v.sciName);

    act(() => { result.current.toggle(); }); // play
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });
    act(() => { result.current.toggle(); }); // pause

    expect(result.current.voices.map(v => v.sciName)).toEqual(sciNamesBefore);
    expect(result.current.voices).toHaveLength(2);
  });

  it('does not accumulate ended listeners across voice replacements', async () => {
    // Need MAX_VOICES+1 recordings so there is a spare to swap in.
    const recs = Array.from({ length: 9 }, (_, i) =>
      makeRec({ gen: 'Sp', sp: String(i), id: String(i) }),
    );
    const obsList = Array.from({ length: 9 }, (_, i) =>
      makeObs(`Sp ${i}`, 10 - i),
    );
    const { result } = renderHook(() => useSoundscape(recs, obsList));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); }); // start playback
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    // exhaust retries on voice 0 → triggers replaceFailedVoice → new audio at index 0
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 100); });
    act(() => { audioInstances[0].emit('error'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    // voice 0 has been replaced with the spare (audioInstances[8] is the new Audio)
    const replacementAudio = audioInstances[audioInstances.length - 1];
    // Simulate the new audio playing its canplay + stagger firing
    act(() => { replacementAudio.emit('canplay'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    // fire 'ended' once — must schedule exactly one timer
    const timersBefore = vi.getTimerCount();
    act(() => { replacementAudio.emit('ended'); });
    expect(vi.getTimerCount()).toBe(timersBefore + 1);
  });

  it('resume after pause plays audio without adding duplicate ended listeners', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); }); // play
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });
    // audio is now playing

    act(() => { result.current.toggle(); }); // pause

    act(() => { result.current.toggle(); }); // resume
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    // fire ended once — should schedule exactly one next play timer
    const timerCountBefore = vi.getTimerCount();
    act(() => { audioInstances[0].emit('ended'); });
    // only one new timer should have been scheduled
    expect(vi.getTimerCount()).toBe(timerCountBefore + 1);
  });

  it('multiple pause/resume cycles do not accumulate ended listeners', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1]));
    await act(async () => { await vi.runAllTimersAsync(); });

    // 3 full pause/resume cycles
    for (let cycle = 0; cycle < 3; cycle++) {
      act(() => { result.current.toggle(); }); // play
      await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });
      act(() => { result.current.toggle(); }); // pause
    }

    act(() => { result.current.toggle(); }); // final play
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    const timerCountBefore = vi.getTimerCount();
    act(() => { audioInstances[0].emit('ended'); });
    expect(vi.getTimerCount()).toBe(timerCountBefore + 1); // still only one timer
  });
});

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
    expect(result.current.voices.every(v => !v.isActive)).toBe(true); // not playing → isActive false
  });

  it('muteAll unmute while playing calls play on each voice audio', async () => {
    const { result } = renderHook(() => useSoundscape([xcRec1, xcRec2], [obs1, obs2]));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.toggle(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(INITIAL_STAGGER_MS + 100); });

    act(() => { result.current.muteAll(); }); // mute all
    const playsBefore = audioInstances.map(a => a.play.mock.calls.length);

    act(() => { result.current.muteAll(); }); // unmute all — should trigger startVoice
    expect(result.current.voices.every(v => v.isActive)).toBe(true); // playing → isActive optimistically true

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

describe('rerollVoice', () => {
  it('sets slot to isRerolling:true immediately on reroll', async () => {
    vi.mocked(fetchRecordings).mockImplementation(() => new Promise(() => {}));
    // notableObs provides a candidate distinct from the current voice (obs1 = Turdus migratorius)
    const notableObs = [makeObs('Parus major', 5)];
    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1], notableObs));
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => { result.current.rerollVoice(0); });

    expect(result.current.voices[0].isRerolling).toBe(true);
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

    // Kick off reroll; fetchRecordings resolves immediately so the new Audio
    // for Parus major is created and waiting for canplay after this act.
    await act(async () => { result.current.rerollVoice(0); });

    // Emit canplay on the new audio to unblock the Promise.all atomic swap.
    act(() => { audioInstances[audioInstances.length - 1]!.emit('canplay'); });
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

  it('skips blocklisted species and does not call fetchRecordings for them', async () => {
    // Seed a fresh blocklist entry for notableObs species
    addToBlocklist('Parus major');

    const notableObs = [makeObs('Parus major', 5)];
    vi.mocked(fetchRecordings).mockResolvedValue({
      numRecordings: '0', numSpecies: '0', page: 1, numPages: 1, recordings: [],
    });

    const { result } = renderHook(() => useSoundscape([xcRec1], [obs1], notableObs));
    await act(async () => { await vi.runAllTimersAsync(); });

    await act(async () => { result.current.rerollVoice(0); });
    await act(async () => { await vi.runAllTimersAsync(); });

    // Parus major was blocklisted; fetchRecordings was called for Turdus migratorius (obs1) but not for Parus major
    expect(vi.mocked(fetchRecordings)).not.toHaveBeenCalledWith('gen:Parus sp:major');
  });

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

  it('concurrent rerolls on different slots do not produce duplicate sciNames', async () => {
    const xcRec_C = makeRec({ gen: 'Erithacus', sp: 'rubecula', id: '3', en: 'European Robin' });
    const xcRec_D = makeRec({ gen: 'Cyanistes', sp: 'caeruleus', id: '4', en: 'Blue Tit' });
    const obsC = makeObs('Erithacus rubecula', 3);
    const obsD = makeObs('Cyanistes caeruleus', 2);

    vi.mocked(fetchRecordings).mockImplementation((query: string) =>
      Promise.resolve({
        numRecordings: '1', numSpecies: '1', page: 1, numPages: 1,
        recordings: query.includes('Erithacus') ? [xcRec_C]
                 : query.includes('Cyanistes') ? [xcRec_D]
                 : [],
      }),
    );

    // 2 XC recordings → 2 initial voices (slots 0=Turdus, 1=Parus)
    // obsC and obsD are candidates for reroll (no recordings, not in slots)
    const { result } = renderHook(() =>
      useSoundscape([xcRec1, xcRec2], [obs1, obs2, obsC, obsD]),
    );
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.voices).toHaveLength(2);

    // Trigger both rerolls in the same synchronous tick — no await between them
    await act(async () => {
      result.current.rerollVoice(0);
      result.current.rerollVoice(1);
      await vi.runAllTimersAsync();
    });

    // Emit canplay on the two new Audio instances (indices 2 and 3; 0 and 1 are initial)
    act(() => {
      audioInstances[2]!.emit('canplay');
      audioInstances[3]!.emit('canplay');
    });
    await act(async () => { await vi.runAllTimersAsync(); });

    const sciNames = result.current.voices.map(v => v.sciName);
    expect(sciNames[0]).not.toBe(sciNames[1]);
    expect(new Set(sciNames).size).toBe(2);
    expect(['Erithacus rubecula', 'Cyanistes caeruleus']).toContain(sciNames[0]);
    expect(['Erithacus rubecula', 'Cyanistes caeruleus']).toContain(sciNames[1]);
  });
});
