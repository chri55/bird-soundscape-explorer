import { test, expect } from '@playwright/test';
import { HOTSPOT_MOCK, setMapView, waitForMapReady } from './helpers';

// Helper: set up all routes with a counting hotspot handler
async function setupWithHotspotCounter(page: Parameters<typeof setMapView>[0]) {
  let count = 0;
  await page.route('/api/nps*', route =>
    route.fulfill({ json: { data: [{ parkCode: 'yell', fullName: 'Yellowstone National Park', latitude: '44.42', longitude: '-110.58' }] } }),
  );
  await page.route('/api/ebird/data/obs/geo/recent*', route => route.fulfill({ json: [] }));
  await page.route('/api/ebird/data/obs/geo/recent/notable*', route => route.fulfill({ json: [] }));
  await page.route('/api/xc*', route =>
    route.fulfill({ json: { recordings: [], numRecordings: '0', numSpecies: '0', page: 1, numPages: 1 } }),
  );
  await page.route('/api/ebird/ref/hotspot/geo*', route => {
    count++;
    return route.fulfill({ json: HOTSPOT_MOCK });
  });
  return { getCount: () => count, resetCount: () => { count = 0; } };
}

test.describe('Hotspot debounce', () => {
  test('rapid pan to 10 cells fires only 1 API call', async ({ page }) => {
    const { getCount, resetCount } = await setupWithHotspotCounter(page);
    await page.goto('/');
    await waitForMapReady(page);

    // Allow the initial mount fetch (center [39.5, -98.35]) to complete
    await page.waitForTimeout(1000);
    resetCount();

    // Pan to 10 distinct cells within the debounce window
    for (let i = 1; i <= 10; i++) {
      await setMapView(page, 40 + i, -74 + i, 8);
    }

    // Wait for debounce to settle and fetch to complete
    await page.waitForTimeout(1000);

    test.info().annotations.push({ type: 'api_calls_after_rapid_pan', description: String(getCount()) });
    expect(getCount()).toBe(1);
  });
});

test.describe('Hotspot cell dedup', () => {
  test('revisiting the same 1° cell does not re-fetch', async ({ page }) => {
    const { getCount, resetCount } = await setupWithHotspotCounter(page);
    await page.goto('/');
    await waitForMapReady(page);
    await page.waitForTimeout(1000);
    resetCount();

    // Visit cell "41:-75" (Math.floor(41)=41, Math.floor(-75)=-75)
    await setMapView(page, 41, -75, 8);
    await page.waitForTimeout(1000);
    expect(getCount()).toBe(1);

    // Visit same cell again with slightly different coordinates
    // Math.floor(41.5)=41, Math.floor(-74.5)=-75 → same key "41:-75"
    await setMapView(page, 41.5, -74.5, 8);
    await page.waitForTimeout(1000);
    expect(getCount()).toBe(1); // no new call

    // Visit a different cell
    await setMapView(page, 45, -80, 8);
    await page.waitForTimeout(1000);
    expect(getCount()).toBe(2);

    test.info().annotations.push({ type: 'total_api_calls', description: String(getCount()) });
  });
});
