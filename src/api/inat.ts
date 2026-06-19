const BASE_URL = 'https://api.inaturalist.org/v1';

export interface BirdPhoto {
  photoUrl: string;
  largeUrl: string;
  attribution: string;
  licenseCode: string;
}

interface INatPhoto {
  id: number;
  license_code: string;
  attribution: string;
  medium_url: string;
}

interface INatTaxon {
  id: number;
  name: string;
  matched_term: string;
  default_photo: INatPhoto | null;
}

interface INatTaxaResponse {
  total_results: number;
  results: INatTaxon[];
}

const photoCache = new Map<string, BirdPhoto | null>();

export async function fetchBirdPhoto(sciName: string): Promise<BirdPhoto | null> {
  if (photoCache.has(sciName)) return photoCache.get(sciName)!;

  const url = `${BASE_URL}/taxa?q=${encodeURIComponent(sciName)}&rank=species&per_page=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iNaturalist error ${res.status}: ${await res.text()}`);

  const data = await res.json() as INatTaxaResponse;

  if (data.total_results === 0 || !data.results[0]?.default_photo) {
    photoCache.set(sciName, null);
    return null;
  }

  const photo = data.results[0].default_photo!;
  const largeUrl = photo.medium_url.replace('/medium.', '/large.');

  const result: BirdPhoto = {
    photoUrl: photo.medium_url,
    largeUrl,
    attribution: photo.attribution,
    licenseCode: photo.license_code,
  };

  photoCache.set(sciName, result);
  return result;
}
