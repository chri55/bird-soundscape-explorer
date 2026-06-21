import { renderHook, waitFor } from '@testing-library/react';
import { useNpsParks } from './useNpsParks';
import { fetchParks } from '../api/nps';
import type { NpsPark } from '../api/nps';

vi.mock('../api/nps');

const PARK: NpsPark = {
  parkCode: 'yose',
  fullName: 'Yosemite National Park',
  latitude: '37.8651',
  longitude: '-119.5383',
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchParks).mockReset();
});

it('cache miss: calls fetchParks, writes result to localStorage, and returns parks', async () => {
  vi.mocked(fetchParks).mockResolvedValue([PARK]);

  const { result } = renderHook(() => useNpsParks());

  await waitFor(() => expect(result.current).toHaveLength(1));

  expect(fetchParks).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem('nps_parks_v1')!)).toEqual([PARK]);
});

it('cache hit: returns cached parks without calling fetchParks', () => {
  localStorage.setItem('nps_parks_v1', JSON.stringify([PARK]));

  const { result } = renderHook(() => useNpsParks());

  expect(result.current).toEqual([PARK]);
  expect(fetchParks).not.toHaveBeenCalled();
});

it('fetch error on cache miss: returns empty array and does not write to localStorage', async () => {
  vi.mocked(fetchParks).mockRejectedValue(new Error('network error'));

  const { result } = renderHook(() => useNpsParks());

  await waitFor(() => expect(fetchParks).toHaveBeenCalledTimes(1));

  expect(result.current).toEqual([]);
  expect(localStorage.getItem('nps_parks_v1')).toBeNull();
});
