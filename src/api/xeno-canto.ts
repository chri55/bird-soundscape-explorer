const BASE_URL = '/api/xc';

export interface XCRecording {
  id: string;
  gen: string;   // genus
  sp: string;    // species
  en: string;    // English name
  rec: string;   // recordist
  cnt: string;   // country
  loc: string;   // location name
  lat: string;
  lon: string;
  type: string;  // "call", "song", "alarm call", etc.
  q: string;     // quality rating A–E
  file: string;  // audio MP3 URL
  date: string;  // "YYYY-MM-DD"
  'file-name': string;
  sono: { small: string; med: string };
}

export interface XCResponse {
  numRecordings: string;
  numSpecies: string;
  page: number;
  numPages: number;
  recordings: XCRecording[];
}

export async function fetchRecordings(query: string): Promise<XCResponse> {
  const url = `${BASE_URL}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Xeno-canto error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<XCResponse>;
}

/** Fetch recordings from a geographic bounding box, optionally filtered by month (1-12). */
export async function fetchRecordingsByBox(
  latMin: number, latMax: number,
  lonMin: number, lonMax: number,
  month?: number,
): Promise<XCResponse> {
  let query = `box:${latMin},${lonMin},${latMax},${lonMax}`;
  if (month !== undefined) query += ` month:${month}`;
  query += ` grp:birds`;
  return fetchRecordings(query);
}
