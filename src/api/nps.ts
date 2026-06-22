export interface NpsPark {
  parkCode: string;
  fullName: string;
  latitude: string;
  longitude: string;
}

export async function fetchParks(): Promise<NpsPark[]> {
  const res = await fetch('/api/nps?limit=500');
  if (!res.ok) throw new Error(`NPS API ${res.status}`);
  const json = await res.json() as { data: NpsPark[] };
  return json.data.filter(p => p.latitude && p.longitude);
}
