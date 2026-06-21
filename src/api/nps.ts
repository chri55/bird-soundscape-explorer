const BASE_URL = 'https://developer.nps.gov/api/v1';

export interface NpsPark {
  parkCode: string;
  fullName: string;
  latitude: string;
  longitude: string;
}

export async function fetchParks(): Promise<NpsPark[]> {
  const key = import.meta.env.VITE_NPS_API_KEY as string;
  const res = await fetch(`${BASE_URL}/parks?limit=500&api_key=${key}`);
  if (!res.ok) throw new Error(`NPS API ${res.status}`);
  const json = await res.json() as { data: NpsPark[] };
  return json.data.filter(p => p.latitude && p.longitude);
}
