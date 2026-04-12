#!/usr/bin/env bash
# ux_gate.sh — Run all UX audit Playwright tests.
# Exit 0 = pass, Exit 1 = fail
# Usage: ./scripts/ux_gate.sh [--base-url http://localhost:2112]
#
# Requirements:
#   1. The frontend app to be running (PLAYWRIGHT_BASE_URL or http://localhost:2112)
#   2. Playwright available via local node_modules or npx

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/alpha_control_center"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:2112}"

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --base-url)
            BASE_URL="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo ""
echo "=== UX Gate — Playwright Tests ==="
echo "    Base URL: $BASE_URL"
echo "    Test dir: $FRONTEND_DIR/tests"
echo ""

# Resolve playwright binary: prefer local node_modules, fall back to npx
PLAYWRIGHT_BIN=""
if [ -x "$FRONTEND_DIR/node_modules/.bin/playwright" ]; then
    PLAYWRIGHT_BIN="$FRONTEND_DIR/node_modules/.bin/playwright"
elif command -v playwright &>/dev/null; then
    PLAYWRIGHT_BIN="$(command -v playwright)"
elif command -v npx &>/dev/null; then
    # npx will use cached playwright or download it
    PLAYWRIGHT_BIN="npx playwright"
else
    echo "WARN: Playwright not found (no local node_modules/.bin/playwright, no npx). Skipping UX gate."
    exit 0
fi

echo "    Playwright: $PLAYWRIGHT_BIN"
echo ""

# Check app is reachable — skip non-blocking if not running
if ! curl -sf --max-time 5 "$BASE_URL/api/status" > /dev/null 2>&1; then
    echo "WARN: App not reachable at $BASE_URL — skipping Playwright tests (not a gate failure in CI without app)."
    exit 0
fi

# Run Playwright tests — all three UX gates must pass
cd "$FRONTEND_DIR"
PLAYWRIGHT_BASE_URL="$BASE_URL" \
    $PLAYWRIGHT_BIN test \
    --config=playwright.config.ts \
    tests/ux_no_placeholders.spec.ts \
    tests/ux_every_hoverable_tooltipped.spec.ts \
    tests/ux_tooltip_no_clip.spec.ts \
    tests/ux_tooltip_visibility.spec.ts \
    tests/ux_integrity_gate.spec.ts \
    tests/ux_performance.spec.ts \
    "${@}"

STATUS=$?

if [ "$STATUS" -eq 0 ]; then
    echo ""
    echo "UX GATE: PASSED"
else
    echo ""
    echo "UX GATE: FAILED — see output above"
fi

exit $STATUS
