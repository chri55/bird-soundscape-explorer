import { useState, useEffect } from 'react';
import type { NpsPark } from '../api/nps';
import { fetchParks } from '../api/nps';

const CACHE_KEY = 'nps_parks_v1';

export function useNpsParks(): NpsPark[] {
  const [parks, setParks] = useState<NpsPark[]>(() => {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw) as NpsPark[]; } catch { return []; }
  });

  useEffect(() => {
    if (localStorage.getItem(CACHE_KEY)) return;
    void fetchParks()
      .then(data => {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        setParks(data);
      })
      .catch(() => {});
  }, []);

  return parks;
}
