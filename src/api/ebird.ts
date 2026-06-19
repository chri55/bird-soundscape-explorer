const BASE_URL = 'https://api.ebird.org/v2';

export interface EBirdObservation {
  speciesCode: string;
  comName: string;
  sciName: string;
  locName: string;
  obsDt: string;
  howMany?: number;
  lat: number;
  lng: number;
}

export async function fetchRecentNearby(lat: number, lng: number, maxResults = 50): Promise<EBirdObservation[]> {
  const key = import.meta.env.VITE_EBIRD_API_KEY as string;
  const url = `${BASE_URL}/data/obs/geo/recent?lat=${lat}&lng=${lng}&maxResults=${maxResults}`;
  const res = await fetch(url, { headers: { 'x-ebirdapitoken': key } });
  if (!res.ok) throw new Error(`eBird error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<EBirdObservation[]>;
}
