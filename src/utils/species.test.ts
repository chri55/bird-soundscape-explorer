import type { EBirdObservation } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';
import { deduplicateObs, bestRecording } from './species';

function makeObs(sciName: string, howMany: number | undefined, overrides: Partial<EBirdObservation> = {}): EBirdObservation {
  return {
    speciesCode: sciName.replace(' ', ''), comName: sciName, sciName,
    locName: 'SF', obsDt: '2024-01-01 08:00', howMany,
    lat: 37.77, lng: -122.4, obsValid: true, obsReviewed: true, locationPrivate: false,
    ...overrides,
  };
}

function makeRec(overrides: Partial<XCRecording> = {}): XCRecording {
  return {
    id: '1', gen: 'Turdus', sp: 'migratorius', en: 'American Robin',
    rec: 'Jane', cnt: 'US', loc: 'SF', lat: '37', lon: '-122',
    type: 'song', q: 'A', file: 'https://xc.org/1.mp3', date: '2024-01-01',
    'file-name': '1.mp3', sono: { small: 'https://xc.org/sono.png', med: 'https://xc.org/sonom.png' },
    ...overrides,
  };
}

describe('deduplicateObs', () => {
  it('passes through a list with all unique sciNames', () => {
    const obs = [makeObs('Turdus migratorius', 10), makeObs('Parus major', 3)];
    expect(deduplicateObs(obs)).toHaveLength(2);
  });

  it('combines duplicate sciNames and sums howMany', () => {
    const obs = [makeObs('Turdus migratorius', 10), makeObs('Turdus migratorius', 5)];
    const result = deduplicateObs(obs);
    expect(result).toHaveLength(1);
    expect(result[0].howMany).toBe(15);
  });

  it('treats undefined howMany as 0 when summing', () => {
    const obs = [makeObs('Turdus migratorius', undefined), makeObs('Turdus migratorius', 4)];
    const result = deduplicateObs(obs);
    expect(result[0].howMany).toBe(4);
  });

  it('preserves the first occurrence order', () => {
    const obs = [
      makeObs('Parus major', 3),
      makeObs('Turdus migratorius', 10),
      makeObs('Parus major', 2),
    ];
    const result = deduplicateObs(obs);
    expect(result[0].sciName).toBe('Parus major');
    expect(result[1].sciName).toBe('Turdus migratorius');
    expect(result[0].howMany).toBe(5);
  });

  it('keeps comName, locName, obsDt from the first occurrence', () => {
    const obs = [
      makeObs('Turdus migratorius', 5, { comName: 'American Robin', locName: 'Central Park', obsDt: '2024-01-01 08:00' }),
      makeObs('Turdus migratorius', 3, { comName: 'Other Name', locName: 'Other Park', obsDt: '2024-02-01 09:00' }),
    ];
    const result = deduplicateObs(obs);
    expect(result[0].comName).toBe('American Robin');
    expect(result[0].locName).toBe('Central Park');
    expect(result[0].obsDt).toBe('2024-01-01 08:00');
  });
});

describe('bestRecording', () => {
  it('returns null when no recordings match sciName', () => {
    expect(bestRecording('Corvus corax', [makeRec()])).toBeNull();
  });

  it('returns the single match when only one exists', () => {
    const result = bestRecording('Turdus migratorius', [makeRec({ id: '1' })]);
    expect(result?.id).toBe('1');
  });

  it('picks quality A over B', () => {
    const recs = [makeRec({ id: 'b', q: 'B' }), makeRec({ id: 'a', q: 'A' })];
    expect(bestRecording('Turdus migratorius', recs)?.id).toBe('a');
  });

  it('picks song over call when quality is equal', () => {
    const recs = [makeRec({ id: 'c', type: 'call' }), makeRec({ id: 's', type: 'song' })];
    expect(bestRecording('Turdus migratorius', recs)?.id).toBe('s');
  });

  it('quality beats type — lower quality song loses to higher quality call', () => {
    const recs = [makeRec({ id: 'bs', q: 'B', type: 'song' }), makeRec({ id: 'ac', q: 'A', type: 'call' })];
    expect(bestRecording('Turdus migratorius', recs)?.id).toBe('ac');
  });

  it('matches case-insensitively on genus and species', () => {
    const rec = makeRec({ gen: 'TURDUS', sp: 'MIGRATORIUS' });
    expect(bestRecording('Turdus migratorius', [rec])).not.toBeNull();
  });
});
