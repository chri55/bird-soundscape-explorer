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
