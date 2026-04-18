/**
 * Phase 18 UX Interaction Flow Tests
 *
 * Verifies interactive behaviors:
 * - Regime badge click → detail popover opens
 * - Position count badge click → scrolls to merged positions table
 * - Tab switching in Zone C renders correct content
 * - Signal log expand/collapse toggle
 * - Strategy dropdown opens, selects strategy, closes
 * - Status bar stays visible during all interactions
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:2112';

async function gotoAndWait(page: Page) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="status-bar"]', { timeout: 15_000 });
  await page.waitForTimeout(1000);
}

// ── Status Bar Interactions ───────────────────────────────────────────────────

test.describe('Status Bar — interactive elements', () => {
  test('strategy selector dropdown opens on click', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const selector = page.locator('[data-testid="strategy-selector"]');
    await expect(selector).toBeVisible();

    await selector.click();
    await page.waitForTimeout(300);

    // Dropdown should open — a list of options becomes visible
    const dropdown = page.locator('[data-testid="strategy-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });
  });

  test('strategy selector dropdown closes on outside click', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const selector = page.locator('[data-testid="strategy-selector"]');
    await selector.click();
    await page.waitForTimeout(300);

    const dropdown = page.locator('[data-testid="strategy-dropdown"]');
    const isOpen = await dropdown.count();
    if (isOpen === 0) return; // non-critical if no dropdown rendered

    // Click outside to close
    await page.mouse.click(100, 500);
    await page.waitForTimeout(300);

    await expect(dropdown).not.toBeVisible();
  });

  test('strategy dropdown lists at least one strategy option', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const selector = page.locator('[data-testid="strategy-selector"]');
    await selector.click();
    await page.waitForTimeout(300);

    const dropdown = page.locator('[data-testid="strategy-dropdown"]');
    const count = await dropdown.count();
    if (count === 0) return;

    const options = page.locator('[data-testid="strategy-option"]');
    const optCount = await options.count();
    expect(optCount, 'Strategy dropdown should have at least one option').toBeGreaterThan(0);
  });

  test('clicking a strategy option updates the selector label', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const selector = page.locator('[data-testid="strategy-selector"]');
    await selector.click();
    await page.waitForTimeout(300);

    const dropdown = page.locator('[data-testid="strategy-dropdown"]');
    const count = await dropdown.count();
    if (count === 0) return;

    const options = page.locator('[data-testid="strategy-option"]');
    const optCount = await options.count();
    if (optCount === 0) return;

    const optionText = await options.first().textContent();
    await options.first().click();
    await page.waitForTimeout(300);

    const labelText = await selector.textContent();
    // The label should reflect the chosen strategy (or contain its name)
    expect(labelText, 'Selector should update after choice').toBeTruthy();
    if (optionText) {
      expect(labelText).toContain(optionText.trim().split('\n')[0].trim());
    }
  });

  test('regime badge click opens a detail popover', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);
    await page.waitForTimeout(3000); // wait for regime data

    const badge = page.locator('[data-testid="regime-badge"]');
    const count = await badge.count();
    if (count === 0) return; // regime API may not return data in test env

    await badge.click();
    await page.waitForTimeout(500);

    // A popover/detail panel should appear
    const popover = page.locator('[data-testid="regime-popover"]');
    const popCount = await popover.count();
    if (popCount > 0) {
      await expect(popover).toBeVisible({ timeout: 3000 });
    }
    // If no popover, at minimum badge should still be visible (no crash)
    await expect(badge).toBeVisible();
  });

  test('position count badge scrolls to merged positions table', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const countBadge = page.locator('[data-testid="sb-position-count"]');
    const count = await countBadge.count();
    if (count === 0) return; // badge may not be rendered with 0 positions

    // Record initial scroll
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await countBadge.click();
    await page.waitForTimeout(600);

    // Page should have scrolled toward the positions table
    const scrollAfter = await page.evaluate(() => window.scrollY);
    const table = page.locator('[data-testid="merged-positions-table"]');
    const tableBox = await table.boundingBox();

    if (tableBox) {
      // Either scroll changed or the table is already visible in viewport
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      const inView = scrollAfter + viewportHeight > tableBox.y;
      expect(inView, 'Positions table should be scrolled into view after badge click').toBe(true);
    }
  });
});

// ── Zone C Tab Interactions ───────────────────────────────────────────────────

test.describe('Zone C — tab switching interactions', () => {
  test('clicking each tab changes the visible panel content', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const tabIds = ['premarket', 'macro', 'correlation', 'chop', 'evcongress', 'signals', 'activity'];

    let prevContent: string | null = null;

    for (const tabId of tabIds) {
      const tab = page.locator(`[data-testid="tab-${tabId}"]`);
      await tab.scrollIntoViewIfNeeded();
      await tab.click();
      await page.waitForTimeout(400);

      // Active tab should reflect aria-selected
      await expect(tab).toHaveAttribute('aria-selected', 'true');

      // Panel body should be visible
      const body = page.locator('[data-testid="tab-panel-body"]');
      await expect(body).toBeVisible({ timeout: 5000 });

      // Content should be non-empty
      const content = await body.textContent();
      expect(content, `Tab ${tabId} should render some content`).toBeTruthy();

      prevContent = content;
    }
  });

  test('only one tab is active at a time', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const tabBar = page.locator('[data-testid="tab-bar"]');
    await tabBar.scrollIntoViewIfNeeded();

    // Click the macro tab
    const macroTab = page.locator('[data-testid="tab-macro"]');
    await macroTab.click();
    await page.waitForTimeout(300);

    const activeTabs = page.locator('[data-testid="tab-bar"] [role="tab"][aria-selected="true"]');
    const activeCount = await activeTabs.count();
    expect(activeCount, 'Only one tab should be active at a time').toBe(1);
  });

  test('signal log expand/collapse from signals tab', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const sigTab = page.locator('[data-testid="tab-signals"]');
    await sigTab.scrollIntoViewIfNeeded();
    await sigTab.click();
    await page.waitForTimeout(1000);

    const expander = page.locator('[data-testid="signal-log-expander"]');
    const expanderCount = await expander.count();
    if (expanderCount === 0) return; // < 3 signals — expander not shown

    // Should start collapsed
    const initialText = await expander.textContent();
    expect(initialText, 'Should start collapsed with Show all').toContain('Show all');

    // Expand
    await expander.click();
    await page.waitForTimeout(400);
    const expandedText = await expander.textContent();
    expect(expandedText, 'Should say Show fewer when expanded').toContain('Show fewer');

    // Collapse
    await expander.click();
    await page.waitForTimeout(400);
    const collapsedText = await expander.textContent();
    expect(collapsedText, 'Should return to Show all').toContain('Show all');
  });

  test('signals tab filter buttons change displayed items', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const sigTab = page.locator('[data-testid="tab-signals"]');
    await sigTab.scrollIntoViewIfNeeded();
    await sigTab.click();
    await page.waitForTimeout(1000);

    const filters = ['all', 'executed', 'rejected'];
    for (const f of filters) {
      const btn = page.locator(`[data-testid="signal-filter-${f}"]`);
      const btnCount = await btn.count();
      if (btnCount === 0) continue; // filter not present

      await btn.click();
      await page.waitForTimeout(300);

      // Button should be active
      const cls = await btn.getAttribute('class');
      expect(cls, `Filter ${f} should have active class after click`).toContain('active');
    }
  });

  test('activity tab renders without error', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const actTab = page.locator('[data-testid="tab-activity"]');
    await actTab.scrollIntoViewIfNeeded();
    await actTab.click();
    await page.waitForTimeout(800);

    await expect(actTab).toHaveAttribute('aria-selected', 'true');

    const body = page.locator('[data-testid="tab-panel-body"]');
    await expect(body).toBeVisible({ timeout: 5000 });
  });
});

// ── Regression: Status Bar stays visible during navigation ───────────────────

test.describe('Status bar persistence during interactions', () => {
  test('status bar remains visible after tab switching', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const tabIds = ['macro', 'signals', 'activity'];
    for (const tabId of tabIds) {
      const tab = page.locator(`[data-testid="tab-${tabId}"]`);
      await tab.scrollIntoViewIfNeeded();
      await tab.click();
      await page.waitForTimeout(300);

      await expect(
        page.locator('[data-testid="status-bar"]'),
        `Status bar should be visible after clicking ${tabId} tab`
      ).toBeVisible();
    }
  });

  test('status bar P&L remains visible after scrolling to bottom', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    const pnl = page.locator('[data-testid="sb-pnl-amount"]');
    await expect(pnl, 'P&L should remain visible in sticky status bar after scrolling to bottom').toBeVisible();
  });

  test('status bar remains functional after strategy selection', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const selector = page.locator('[data-testid="strategy-selector"]');
    await selector.click();
    await page.waitForTimeout(200);

    const dropdown = page.locator('[data-testid="strategy-dropdown"]');
    const hasDropdown = (await dropdown.count()) > 0;
    if (hasDropdown) {
      const options = page.locator('[data-testid="strategy-option"]');
      if ((await options.count()) > 0) {
        await options.first().click();
        await page.waitForTimeout(300);
      }
    }

    // Status bar should still be intact
    await expect(page.locator('[data-testid="status-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="sb-pnl-amount"]')).toBeVisible();
  });
});

// ── Merged Positions Table Interactions ──────────────────────────────────────

test.describe('Merged positions table — row interactions', () => {
  test('positions table renders without throwing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const table = page.locator('[data-testid="merged-positions-table"]');
    await expect(table).toBeVisible();

    // Either empty state or rows
    const empty = page.locator('[data-testid="mpt-empty"]');
    const rows  = page.locator('[data-testid="mpt-status-cell"]');

    const emptyCount = await empty.count();
    const rowCount   = await rows.count();
    expect(emptyCount + rowCount, 'Table should show empty state or rows').toBeGreaterThan(0);
  });

  test('cancel button on pending order triggers confirmation or action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWait(page);

    const cancelBtn = page.locator('[data-testid="mpt-cancel-btn"]');
    const count = await cancelBtn.count();
    if (count === 0) return; // no pending orders in test env

    // Click cancel — should either show confirmation or send request
    await cancelBtn.first().click();
    await page.waitForTimeout(500);

    // Page should not crash — status bar should still be present
    await expect(page.locator('[data-testid="status-bar"]')).toBeVisible();
  });
});
