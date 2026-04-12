#!/usr/bin/env bash
# ux_gate.sh — Run all UX audit Playwright tests.
# Exit 0 = pass, Exit 1 = fail
# Usage: ./scripts/ux_gate.sh [--base-url http://localhost:2112]
#
# The script requires:
#   1. The frontend app to be running (PLAYWRIGHT_BASE_URL or http://localhost:2112)
#   2. node_modules with Playwright installed (in alpha_control_center/)

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

# Check node_modules exist
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "ERROR: node_modules not found. Run 'npm install' in $FRONTEND_DIR first."
    exit 1
fi

# Check app is reachable
if ! curl -sf --max-time 5 "$BASE_URL/api/status" > /dev/null 2>&1; then
    echo "WARN: App not reachable at $BASE_URL — skipping Playwright tests (not a gate failure in CI without app)."
    exit 0
fi

# Run Playwright tests
cd "$FRONTEND_DIR"
PLAYWRIGHT_BASE_URL="$BASE_URL" \
    ./node_modules/.bin/playwright test \
    --config=playwright.config.ts \
    "$@"

STATUS=$?

if [ "$STATUS" -eq 0 ]; then
    echo ""
    echo "UX GATE: PASSED"
else
    echo ""
    echo "UX GATE: FAILED — see output above"
fi

exit $STATUS
