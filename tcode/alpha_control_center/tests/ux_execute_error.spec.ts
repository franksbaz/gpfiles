/**
 * Phase 18.1 — Execute error surfacing tests
 *
 * Verifies:
 * - API 500 → red persistent toast with error message
 * - Proposal card shows "FAILED" overlay after execute error
 * - API success → green toast with confirmation
 * - Dismiss button clears error toast
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:2112';

const PROPOSAL_ID = 'test-exec-err-001';

const PENDING_PROPOSAL = {
  id: PROPOSAL_ID,
  ts_created: new Date(Date.now() - 5000).toISOString(),
  ts_expires: new Date(Date.now() + 55000).toISOString(),
  status: 'pending',
  strategy: 'GAMMA_SCALP',
  direction: 'BULLISH',
  legs: [{ strike: 400, type: 'CALL', action: 'BUY', quantity: 1, fill_price: null }],
  entry_price: 5.0,
  stop_price: 3.0,
  target_price: 8.0,
  kelly_fraction: 0.05,
  quantity: 1,
  confidence: 0.72,
  regime_snapshot: { regime: 'BULLISH_TREND', confidence: 0.8 },
  signals_contributing: ['GAMMA_SCALP'],
};

const QUEUE_RESPONSE = {
  proposals: [PENDING_PROPOSAL],
  stats: { pending: 1, executed: 0, skipped: 0, expired: 0 },
  updated_at: new Date().toISOString(),
};

const FAILED_PROPOSAL = { ...PENDING_PROPOSAL, status: 'execute_failed' };

async function gotoAndWait(page: Page) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="status-bar"]', { timeout: 15_000 });
  await page.waitForTimeout(1500);
}

test('execute API 500 → red toast with error message', async ({ page }) => {
  // Mock proposals endpoint to return a pending proposal
  await page.route('**/api/trades/proposed', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(QUEUE_RESPONSE) });
  });

  // Mock execute endpoint to return 500 with error body
  await page.route(`**/api/trades/proposed/${PROPOSAL_ID}/execute`, (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'expiry is empty — proposal missing expiration_date' }),
    });
  });

  await gotoAndWait(page);

  // Find and click Execute button
  const execBtn = page.locator(`[data-testid="execute-btn-${PROPOSAL_ID}"]`);
  await execBtn.waitFor({ timeout: 5000 });

  // In paper mode there's no countdown, click fires immediately
  await execBtn.click();

  // Red toast should appear
  const toast = page.locator('[data-testid="execute-toast"]');
  await toast.waitFor({ timeout: 5000 });
  await expect(toast).toBeVisible();

  const toastText = await toast.textContent();
  expect(toastText).toContain('expiry is empty');

  // Error toast has a dismiss button
  const dismissBtn = toast.locator('button[aria-label="Dismiss"]');
  await expect(dismissBtn).toBeVisible();
});

test('dismiss button clears error toast', async ({ page }) => {
  await page.route('**/api/trades/proposed', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(QUEUE_RESPONSE) });
  });
  await page.route(`**/api/trades/proposed/${PROPOSAL_ID}/execute`, (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'strike is 0 — proposal missing recommended_strike' }),
    });
  });

  await gotoAndWait(page);

  const execBtn = page.locator(`[data-testid="execute-btn-${PROPOSAL_ID}"]`);
  await execBtn.waitFor({ timeout: 5000 });
  await execBtn.click();

  const toast = page.locator('[data-testid="execute-toast"]');
  await toast.waitFor({ timeout: 5000 });

  const dismissBtn = toast.locator('button[aria-label="Dismiss"]');
  await dismissBtn.click();
  await expect(toast).not.toBeVisible();
});

test('execute_failed status → FAILED overlay on proposal card', async ({ page }) => {
  // Return proposal already in execute_failed state
  const failedQueue = {
    ...QUEUE_RESPONSE,
    proposals: [FAILED_PROPOSAL],
  };

  await page.route('**/api/trades/proposed', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(failedQueue) });
  });

  await gotoAndWait(page);

  const card = page.locator(`[data-testid="proposal-card-${PROPOSAL_ID}"]`);
  await card.waitFor({ timeout: 5000 });

  // Overlay with "FAILED" text should be visible
  const overlay = card.locator('.proposal-status-overlay.execute_failed');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('FAILED');
});

test('execute success → green toast with confirmation', async ({ page }) => {
  await page.route('**/api/trades/proposed', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(QUEUE_RESPONSE) });
  });
  await page.route(`**/api/trades/proposed/${PROPOSAL_ID}/execute`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: 'execute', order_result: { parent_order_id: 99001 } }),
    });
  });

  await gotoAndWait(page);

  const execBtn = page.locator(`[data-testid="execute-btn-${PROPOSAL_ID}"]`);
  await execBtn.waitFor({ timeout: 5000 });
  await execBtn.click();

  const toast = page.locator('[data-testid="execute-toast"]');
  await toast.waitFor({ timeout: 5000 });
  await expect(toast).toBeVisible();

  const toastText = await toast.textContent();
  expect(toastText).toContain('Order submitted');

  // Success toasts auto-dismiss (no permanent dismiss button)
  const dismissBtn = toast.locator('button[aria-label="Dismiss"]');
  await expect(dismissBtn).not.toBeVisible();
});
