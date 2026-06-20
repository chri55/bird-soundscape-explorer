import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import { fetchRecordings } from '../api/xeno-canto';
import { fillRecordingGaps } from './soundscape-recordings';

vi.mock('../api/xeno-canto', () => ({
  fetchRecordings: vi.fn(),
}));

function makeRec(gen: string, sp: string, id = '1'): XCRecording {
  return {
    id, gen, sp, en: `${gen} ${sp}`, rec: 'Jane', cnt: 'US', loc: 'SF',
    lat: '37', lon: '-122', type: 'song', q: 'A',
    file: `https://xc.org/${id}.mp3`, date: '2024-01-01',
    'file-name': `${id}.mp3`, sono: { small: 'https://xc.org/s.png', med: 'https://xc.org/m.png' },
  };
}

function makeObs(sciName: string, howMany: number): EBirdObservation {
  return {
    speciesCode: sciName.replace(' ', ''), comName: sciName,
    sciName, locName: 'SF', obsDt: '2024-01-01', howMany,
    lat: 37.77, lng: -122.4,
  };
}

const emptyXCResponse = {
  numRecordings: '0', numSpecies: '0', page: 1, numPages: 1, recordings: [],
};

describe('fillRecordingGaps', () => {
  beforeEach(() => {
    vi.mocked(fetchRecordings).mockResolvedValue(emptyXCResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns existing array unchanged (same reference) when covered species >= target', async () => {
    const recs = [makeRec('Turdus', 'migratorius'), makeRec('Parus', 'major', '2')];
    const result = await fillRecordingGaps(recs, [], 2);
    expect(result).toBe(recs);
    expect(fetchRecordings).not.toHaveBeenCalled();
  });

  it('fast-paths when target is 0', async () => {
    const recs = [makeRec('Turdus', 'migratorius')];
    const result = await fillRecordingGaps(recs, [], 0);
    expect(result).toBe(recs);
    expect(fetchRecordings).not.toHaveBeenCalled();
  });

  it('calls fetchRecordings for gap species in howMany-descending order', async () => {
    const existing = [makeRec('Turdus', 'migratorius')];
    const recentObs = [
      makeObs('Parus major', 3),
      makeObs('Corvus brachyrhynchos', 10),
    ];
    await fillRecordingGaps(existing, recentObs, 3);
    expect(fetchRecordings).toHaveBeenCalledTimes(2);
    expect(fetchRecordings).toHaveBeenNthCalledWith(1, 'Corvus brachyrhynchos');
    expect(fetchRecordings).toHaveBeenNthCalledWith(2, 'Parus major');
  });

  it('merges gap recordings into the returned array after existing', async () => {
    const existing = [makeRec('Turdus', 'migratorius')];
    const gapRec = makeRec('Corvus', 'brachyrhynchos', '99');
    vi.mocked(fetchRecordings).mockResolvedValue({
      numRecordings: '1', numSpecies: '1', page: 1, numPages: 1, recordings: [gapRec],
    });
    const result = await fillRecordingGaps(existing, [makeObs('Corvus brachyrhynchos', 5)], 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('99');
  });

  it('skips species whose fetchRecordings rejects and does not throw', async () => {
    const existing = [makeRec('Turdus', 'migratorius')];
    vi.mocked(fetchRecordings).mockRejectedValue(new Error('503'));
    const result = await fillRecordingGaps(existing, [makeObs('Corvus brachyrhynchos', 5)], 2);
    expect(result).toEqual(existing);
  });

  it('does not query species already covered by existing recordings', async () => {
    const existing = [makeRec('Turdus', 'migratorius')];
    const recentObs = [
      makeObs('Turdus migratorius', 50),
      makeObs('Parus major', 3),
    ];
    await fillRecordingGaps(existing, recentObs, 2);
    expect(fetchRecordings).toHaveBeenCalledTimes(1);
    expect(fetchRecordings).toHaveBeenCalledWith('Parus major');
  });
});
