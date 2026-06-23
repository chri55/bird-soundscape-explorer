import type { Page } from '@playwright/test';

export const HOTSPOT_MOCK = [
  { locId: 'L1', locName: 'Test Hotspot 1', countryCode: 'US', lat: 40.5, lng: -74.5, numSpeciesAllTime: 50 },
  { locId: 'L2', locName: 'Test Hotspot 2', countryCode: 'US', lat: 40.6, lng: -74.6, numSpeciesAllTime: 75 },
  { locId: 'L3', locName: 'Test Hotspot 3', countryCode: 'US', lat: 40.7, lng: -74.7, numSpeciesAllTime: 30 },
];

const NPS_MOCK = {
  data: [{ parkCode: 'yell', fullName: 'Yellowstone National Park', latitude: '44.42', longitude: '-110.58' }],
};

const EBIRD_OBS_MOCK: unknown[] = [];
const XC_MOCK = { recordings: [], numRecordings: '0', numSpecies: '0', page: 1, numPages: 1 };

export async function setupMockRoutes(page: Page): Promise<void> {
  await page.route('/api/nps*', route => route.fulfill({ json: NPS_MOCK }));
  await page.route('/api/ebird/ref/hotspot/geo*', route => route.fulfill({ json: HOTSPOT_MOCK }));
  await page.route('/api/ebird/data/obs/geo/recent*', route => route.fulfill({ json: EBIRD_OBS_MOCK }));
  await page.route('/api/ebird/data/obs/geo/recent/notable*', route => route.fulfill({ json: EBIRD_OBS_MOCK }));
  await page.route('/api/xc*', route => route.fulfill({ json: XC_MOCK }));
}

export async function waitForMapReady(page: Page): Promise<void> {
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
}

export async function setMapView(page: Page, lat: number, lng: number, zoom = 8): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.waitForFunction(() => !!(window as any).__leafletMap);
  await page.evaluate(({ lat, lng, zoom }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__leafletMap.setView([lat, lng], zoom);
  }, { lat, lng, zoom });
}
