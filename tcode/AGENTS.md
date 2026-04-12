# AGENTS.md — Hard rules for AI agents working in this repo

Read this file in full before any change. These are not suggestions — they are gates that block merge.

## UI/UX gates (MOST violated — read twice)

1. **No placeholders.** `...`, `--`, `N/A`, `Loading…` lingering past initial mount is a fail. If a data source is unreachable, render the actual error message ("IB Gateway not reachable on port 4002") with retry timestamp — never a silent ellipsis or em-dash.

2. **Every hoverable has a tooltip.** Anything with `cursor: pointer`, `:hover` styles, an `onClick`, `role="button"`, or visual click affordance MUST have `data-tooltip`/`title`/`aria-label`. Audit by enumerating all such DOM nodes and asserting accessible-name presence.

3. **Tooltips must flip at viewport edges.** Use floating-ui or Radix with `flip()` middleware on every tooltip — never raw CSS positioning. A tooltip clipped offscreen at any viewport width is a fail. Verify via `getBoundingClientRect()` after hover at 1280/1440/1920 widths AND within 200px of every edge.

4. **Every numeric value drills down.** NAV, cash, P&L, signal confidence, premium, strike, IV, Greeks — all clickable to expand a breakdown showing source, computation, timestamp, raw inputs.

5. **No fake/random/mock data in production paths.** All prices, directions, confidence from real market sources only. The rule applies to display values too — no hardcoded "$1000" demo NAV in any code path that could ship.

## Verification artifact required for any UI PR

Writing test files is not the same as proving UX works. The PR description must include:
- Real-Chrome (not headless) screenshots of every changed panel at 1280, 1440, 1920 widths
- Proof the placeholder-string scanner Playwright check passes (`...`, `--`, `N/A`, `Loading…` absent post-mount)
- Proof the every-hoverable-has-tooltip Playwright check passes
- Proof the tooltip-fully-onscreen Playwright check passes for elements within 200px of every edge

If `scripts/ux_gate.sh` doesn't enforce all four, fix the script as part of the PR.

## Build & data integrity gates

6. **No commits without `scripts/e2e_smoke.sh` passing.**
7. **No commits to signal logic without `scripts/backtest_gate.sh` passing** (Sharpe ≥ 0.5, MaxDD ≤ 15%).
8. **Restart publisher after Python changes:** `kill $(pgrep -f publisher.py)` then re-launch.
9. **Engine subprocess paths use `cmd.Dir = repo root`** — no hardcoded absolute paths to old repo locations.

## When in doubt

Search Notion via MCP for "TSLA Alpha — Project Hub" for full context, anti-patterns, and strategies.
