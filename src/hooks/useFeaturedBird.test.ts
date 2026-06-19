import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { EBirdObservation, EBirdTaxon } from '../api/ebird';
import type { BirdPhoto } from '../api/inat';
import type { XCRecording } from '../api/xeno-canto';

vi.mock('../api/ebird', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/ebird')>();
  return { ...actual, fetchTaxonomy: vi.fn() };
});
vi.mock('../api/inat', () => ({ fetchBirdPhoto: vi.fn() }));

import { fetchTaxonomy } from '../api/ebird';
import { fetchBirdPhoto } from '../api/inat';
import { useFeaturedBird } from './useFeaturedBird';

const notable: EBirdObservation = {
  speciesCode: 'snobun', comName: 'Snow Bunting', sciName: 'Plectrophenax nivalis',
  locName: 'Park', obsDt: '2026-06-19', howMany: 1, lat: 40.78, lng: -73.97,
};
const common: EBirdObservation = {
  speciesCode: 'amerob', comName: 'American Robin', sciName: 'Turdus migratorius',
  locName: 'Park', obsDt: '2026-06-19', howMany: 12, lat: 40.78, lng: -73.97,
};
const taxon: EBirdTaxon = {
  sciName: 'Plectrophenax nivalis', comName: 'Snow Bunting', speciesCode: 'snobun',
  category: 'species', taxonOrder: 36000, bandingCodes: [], comNameCodes: [], sciNameCodes: [],
  order: 'Passeriformes', familyComName: 'Old World Sparrows', familySciName: 'Passeridae',
};
const photo: BirdPhoto = {
  photoUrl: 'https://example.com/medium.jpg', largeUrl: 'https://example.com/large.jpg',
  attribution: '(c) Test', licenseCode: 'cc-by-nc',
};
const recording: XCRecording = {
  id: '1', gen: 'Plectrophenax', sp: 'nivalis', en: 'Snow Bunting',
  rec: 'Jane Doe', cnt: 'US', loc: 'Park', lat: '40.78', lon: '-73.97',
  type: 'song', q: 'A', file: 'https://xeno-canto.org/test.mp3',
  date: '2026-01-15', 'file-name': 'test.mp3',
  sono: { small: 'https://xeno-canto.org/sono/small.png', med: 'https://xeno-canto.org/sono/med.png' },
};

beforeEach(() => {
  vi.mocked(fetchBirdPhoto).mockReset();
  vi.mocked(fetchTaxonomy).mockReset();
  vi.mocked(fetchBirdPhoto).mockResolvedValue(photo);
  vi.mocked(fetchTaxonomy).mockResolvedValue([taxon]);
});

describe('useFeaturedBird', () => {
  it('selects first notable observation in rarest mode by default', async () => {
    const { result } = renderHook(() =>
      useFeaturedBird({ notableObservations: [notable], recentObservations: [common], recordings: [] }),
    );

    expect(result.current.observation?.speciesCode).toBe('snobun');
    expect(result.current.isNotable).toBe(true);
    expect(result.current.mode).toBe('rarest');
    expect(result.current.showToggle).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.photo).toEqual(photo);
    expect(result.current.taxon).toEqual(taxon);
  });

  it('falls back to most common when no notable observations exist', async () => {
    const { result } = renderHook(() =>
      useFeaturedBird({ notableObservations: [], recentObservations: [common], recordings: [] }),
    );

    expect(result.current.observation?.speciesCode).toBe('amerob');
    expect(result.current.isNotable).toBe(false);
    expect(result.current.showToggle).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('switches to common mode on onToggleMode', async () => {
    const { result } = renderHook(() =>
      useFeaturedBird({ notableObservations: [notable], recentObservations: [common], recordings: [] }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.onToggleMode());

    expect(result.current.mode).toBe('common');
    expect(result.current.observation?.speciesCode).toBe('amerob');
    expect(result.current.isNotable).toBe(false);
  });

  it('selects observation with highest howMany in common mode', async () => {
    const rare: EBirdObservation = { ...common, speciesCode: 'blujay', comName: 'Blue Jay', howMany: 3 };
    const { result } = renderHook(() =>
      useFeaturedBird({ notableObservations: [], recentObservations: [rare, common], recordings: [] }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.observation?.speciesCode).toBe('amerob'); // howMany: 12 wins
  });

  it('returns bestRecording matching the featured species', async () => {
    const { result } = renderHook(() =>
      useFeaturedBird({
        notableObservations: [notable],
        recentObservations: [],
        recordings: [recording],
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.recording?.id).toBe('1');
  });

  it('returns null recording when no recording matches the featured species', async () => {
    const { result } = renderHook(() =>
      useFeaturedBird({
        notableObservations: [notable],
        recentObservations: [],
        recordings: [{ ...recording, gen: 'Turdus', sp: 'migratorius' }],
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.recording).toBeNull();
  });

  it('returns null observation when all lists are empty', () => {
    const { result } = renderHook(() =>
      useFeaturedBird({ notableObservations: [], recentObservations: [], recordings: [] }),
    );

    expect(result.current.observation).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
