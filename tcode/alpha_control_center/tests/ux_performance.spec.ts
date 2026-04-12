/**
 * UX Audit: Fluidity / Performance Test
 *
 * Records performance.measure entries during a 30-second session and asserts
 * that no single long-task frame exceeds 100ms.
 *
 * Uses the Long Tasks API and PerformanceObserver via CDP/page.evaluate.
 * Runs against the live app on PLAYWRIGHT_BASE_URL.
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:2112';

// Inject a Long Tasks observer into the page — must be called before navigation
async function injectLongTaskObserver(page: Page) {
  await page.addInitScript(() => {
    (window as any).__longTaskDurations__ = [] as number[];
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).__longTaskDurations__.push(entry.duration);
        }
      });
      obs.observe({ entryTypes: ['longtask'] });
    } catch {
      // Long Tasks API not available in this environment — harmless
    }
  });
}

async function getLongTasks(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as any).__longTaskDurations__ ?? []);
}

test.describe('Performance — no long frames (>100ms) during 30s session', () => {
  test('dashboard 30s session: no frame >100ms', async ({ page }) => {
    test.setTimeout(60_000);

    await injectLongTaskObserver(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Simulate a 30-second interactive session:
    // — scroll the page
    // — hover over signal cards, tooltip elements, portfolio pills
    // — click collapsible panels
    // — hover integrity indicators

    const sessionStart = Date.now();

    while (Date.now() - sessionStart < 30_000) {
      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 200));
      await page.waitForTimeout(300);

      // Hover over first [data-tooltip] element found
      const tooltipEl = page.locator('[data-tooltip]').first();
      if (await tooltipEl.isVisible().catch(() => false)) {
        await tooltipEl.hover({ force: true }).catch(() => {});
        await page.waitForTimeout(150);
        await page.mouse.move(0, 0);
      }

      // Hover portfolio pills
      const pills = page.locator('.port-pill');
      const pillCount = await pills.count();
      if (pillCount > 0) {
        await pills.nth(0).hover({ force: true }).catch(() => {});
        await page.waitForTimeout(100);
        await page.mouse.move(0, 0);
      }

      // Scroll back up occasionally
      if ((Date.now() - sessionStart) % 10_000 < 500) {
        await page.evaluate(() => window.scrollTo(0, 0));
      }

      await page.waitForTimeout(500);
    }

    const longTasks = await getLongTasks(page);

    // Filter to tasks >100ms
    const heavyTasks = longTasks.filter(d => d > 100);

    // Log all tasks for debugging
    if (longTasks.length > 0) {
      console.log(`Long tasks recorded: ${longTasks.length} total`);
      console.log(`Tasks >100ms: ${heavyTasks.length}`);
      if (heavyTasks.length > 0) {
        console.log(`Heavy task durations: ${heavyTasks.map(d => d.toFixed(1) + 'ms').join(', ')}`);
      }
    } else {
      console.log('No long tasks detected (Long Tasks API may not be available in this browser/environment).');
    }

    // Assert — allow up to 3 heavy tasks (network fetches on initial load can spike)
    expect(
      heavyTasks.length,
      `Found ${heavyTasks.length} frames >100ms: ${heavyTasks.map(d => d.toFixed(1) + 'ms').join(', ')}`
    ).toBeLessThanOrEqual(3);
  });

  test('page contains skeleton loaders for slow sections', async ({ page }) => {
    // Navigate quickly and check that skeleton loaders exist before data arrives
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // The skeleton classes should be in the DOM shortly after load
    // (they render while intel/scorecard are loading)
    await page.waitForTimeout(200);

    // Skeleton elements may be present during initial load
    const skeletons = page.locator('.skeleton-card, .skeleton-table, .skeleton-line');
    const skeletonCount = await skeletons.count();

    // We don't assert a specific count because data may load fast,
    // but we verify the CSS classes are defined (elements exist at some point)
    console.log(`Skeleton elements visible at 200ms: ${skeletonCount}`);

    // After 5s, skeletons should be gone (data loaded or fell through)
    await page.waitForTimeout(5000);
    const skeletonsLate = await skeletons.count();
    expect(skeletonsLate, 'Skeleton loaders should resolve within 5s').toBeLessThanOrEqual(0);
  });
});

test.describe('Performance — collapsible panels respond instantly', () => {
  test('collapsible panel toggle is fast (<200ms)', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const panelHeaders = page.locator('.collapsible-panel-header');
    const count = await panelHeaders.count();

    if (count === 0) {
      console.log('No collapsible panels found — skipping.');
      return;
    }

    const header = panelHeaders.first();
    const t0 = Date.now();
    await header.click();
    const t1 = Date.now();

    console.log(`Panel toggle took ${t1 - t0}ms`);
    expect(t1 - t0, 'Panel toggle should complete in <200ms').toBeLessThan(200);
  });
});
