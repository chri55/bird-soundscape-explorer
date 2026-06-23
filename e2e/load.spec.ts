import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForMapReady } from './helpers';

test.describe('Page load', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('map container renders', async ({ page }) => {
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('search box is visible', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: 'Search parks and hotspots' })).toBeVisible();
  });

  test('DOM Content Loaded under 4000ms', async ({ page }) => {
    const dclMs = await page.evaluate(() => {
      const { domContentLoadedEventEnd, navigationStart } = performance.timing;
      return domContentLoadedEventEnd - navigationStart;
    });
    test.info().annotations.push({ type: 'dcl_ms', description: String(dclMs) });
    expect(dclMs).toBeLessThan(4000);
  });
});
