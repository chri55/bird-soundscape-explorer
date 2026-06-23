import { test, expect } from '@playwright/test';
import { setupMockRoutes, setMapView, waitForMapReady } from './helpers';

test.describe('Memory bound during panning', () => {
  // performance.memory is Chrome-only — not available in Firefox without COOP/COEP headers
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chrome-only: performance.memory unavailable in Firefox');

  test('JS heap grows less than 5MB after panning 12 distinct cells', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForMapReady(page);

    // Let initial mount fetch settle
    await page.waitForTimeout(1000);

    type PerfWithMemory = Performance & { memory?: { usedJSHeapSize: number } };

    const baselineHeap = await page.evaluate(
      () => (performance as PerfWithMemory).memory?.usedJSHeapSize ?? 0,
    );

    // Pan to 12 distinct 1° cells, waiting 800ms between each (600ms debounce + 200ms buffer)
    for (let i = 0; i < 12; i++) {
      await setMapView(page, 42 + i, -70 - i, 8);
      await page.waitForTimeout(800);
    }

    const finalHeap = await page.evaluate(
      () => (performance as PerfWithMemory).memory?.usedJSHeapSize ?? 0,
    );

    const baselineMB = baselineHeap / (1024 * 1024);
    const finalMB = finalHeap / (1024 * 1024);
    const growthMB = finalMB - baselineMB;

    test.info().annotations.push(
      { type: 'baseline_heap_mb', description: baselineMB.toFixed(2) },
      { type: 'final_heap_mb', description: finalMB.toFixed(2) },
      { type: 'growth_mb', description: growthMB.toFixed(2) },
    );

    expect(growthMB).toBeLessThan(5);
  });
});
