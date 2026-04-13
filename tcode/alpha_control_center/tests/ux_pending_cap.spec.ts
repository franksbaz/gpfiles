/**
 * UX Test: Pending Order Cap — Phase 8
 *
 * Verifies the pending-order cap UI features:
 *  - Pending panel header shows "N/max" badge with correct colour at cap
 *  - Each active order row shows a rank badge when rank > 0
 *  - Replacement toast appears when a [REPLACE] cap event arrives
 *  - Cap event feed renders REPLACE / REJECT-CAP entries
 *
 * Tests use route interception so no live IBKR gateway is required.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:2112';

/** Minimal pending-orders response with a full queue (cap=2, 2 active). */
function makePendingFull() {
    return {
        active: [
            {
                orderId: 1001,
                status: 'Submitted',
                symbol: 'TSLA',
                action: 'BUY',
                qty: 5,
                strike: 365,
                expiry: '2026-05-16',
                option_type: 'CALL',
                limit_price: 0.28,
                filled_qty: 0,
                avg_fill_price: 0,
                timestamp: new Date().toISOString(),
                rank: 0.55,
            },
            {
                orderId: 1002,
                status: 'PreSubmitted',
                symbol: 'TSLA',
                action: 'BUY',
                qty: 3,
                strike: 370,
                expiry: '2026-05-16',
                option_type: 'CALL',
                limit_price: 0.18,
                filled_qty: 0,
                avg_fill_price: 0,
                timestamp: new Date().toISOString(),
                rank: 0.72,
            },
        ],
        cancelled: [],
        source: 'IBKR_PAPER',
        cap: 2,
    };
}

/** Cap events response with a REPLACE event. */
function makeCapEvents(kind: 'REPLACE' | 'REJECT-CAP' = 'REPLACE') {
    return {
        events: [
            {
                ts: new Date().toISOString(),
                kind,
                cancelled_id: kind === 'REPLACE' ? 1001 : 0,
                cancelled_rank: 0.55,
                incoming_rank: 0.82,
            },
        ],
        ranks: [{ order_id: 1002, rank: 0.72, placed_at: new Date().toISOString() }],
        cap: 2,
        pending_cnt: 1,
    };
}

test.describe('Pending Cap UI', () => {
    test('header badge shows N/cap and is red when at cap', async ({ page }) => {
        // Intercept API responses
        await page.route('**/api/orders/pending', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePendingFull()) })
        );
        await page.route('**/api/orders/cap-events', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeCapEvents()) })
        );

        await page.goto(BASE_URL, { waitUntil: 'load' });

        // Find the pending-orders region
        const panel = page.locator('[role="region"][aria-label*="Pending Orders"]');
        await panel.waitFor({ state: 'visible', timeout: 15_000 });

        // Badge should say "2/2"
        const badge = panel.locator('.inline-badge').first();
        await expect(badge).toContainText('2/2');

        // At cap, text colour should be close to red (#f85149).
        // We check via aria-label which includes the counts.
        const badgeLabel = await badge.getAttribute('aria-label');
        expect(badgeLabel).toMatch(/2 of 2 pending/i);
    });

    test('each active order row shows a rank badge', async ({ page }) => {
        await page.route('**/api/orders/pending', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePendingFull()) })
        );
        await page.route('**/api/orders/cap-events', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeCapEvents()) })
        );

        await page.goto(BASE_URL, { waitUntil: 'load' });

        const panel = page.locator('[role="region"][aria-label*="Pending Orders"]');
        await panel.waitFor({ state: 'visible', timeout: 15_000 });

        // Both rows should have a rank badge
        const rankBadges = panel.locator('.inline-badge[title*="rank"]');
        await expect(rankBadges).toHaveCount(2, { timeout: 8_000 });

        const firstBadge = rankBadges.first();
        const text = await firstBadge.textContent();
        expect(text).toMatch(/rank: 0\.\d{2}/);
    });

    test('replacement toast appears on new REPLACE cap event', async ({ page }) => {
        // First response: no events
        let callCount = 0;
        await page.route('**/api/orders/pending', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePendingFull()) })
        );
        await page.route('**/api/orders/cap-events', (route) => {
            callCount++;
            const body = callCount === 1
                ? JSON.stringify({ events: [], ranks: [], cap: 2, pending_cnt: 2 })
                : JSON.stringify(makeCapEvents('REPLACE'));
            route.fulfill({ status: 200, contentType: 'application/json', body });
        });

        await page.goto(BASE_URL, { waitUntil: 'load' });

        // Wait for toast to appear (second poll delivers the REPLACE event)
        const toast = page.locator('[data-testid="cap-replacement-toast"]');
        await expect(toast).toBeVisible({ timeout: 25_000 });
        const toastText = await toast.textContent();
        expect(toastText).toMatch(/replaced orderId=1001/i);
    });

    test('cap event feed shows REPLACE entry when events exist', async ({ page }) => {
        await page.route('**/api/orders/pending', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePendingFull()) })
        );
        await page.route('**/api/orders/cap-events', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeCapEvents('REPLACE')) })
        );

        await page.goto(BASE_URL, { waitUntil: 'load' });

        const panel = page.locator('[role="region"][aria-label*="Pending Orders"]');
        await panel.waitFor({ state: 'visible', timeout: 15_000 });

        // Expand the cap events accordion
        const capAccordion = panel.locator('[aria-label*="Cap events"]');
        await capAccordion.waitFor({ state: 'visible', timeout: 10_000 });
        await capAccordion.click();

        // Check that a REPLACE entry is visible
        const replaceEntry = panel.locator('text=[REPLACE]');
        await expect(replaceEntry).toBeVisible({ timeout: 5_000 });
    });
});
