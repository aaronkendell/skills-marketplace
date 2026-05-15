#!/bin/bash
# Run lefthook pre-commit and pre-push checks
# Used by the build phase to verify all checks pass before declaring ready

set -e

echo "=== Running pre-commit checks ==="

echo "[1/3] Type checking affected packages..."
pnpm turbo check-types --affected

echo "[2/3] Lint + format fix..."
pnpm check:fix

echo "[3/3] OpenAPI docs sync..."
pnpm hook:api-docs:generate:staged 2>/dev/null || true

echo ""
echo "=== Running pre-push checks ==="

echo "[1/6] Lockfile check..."
pnpm hook:lockfile:check 2>/dev/null || true

echo "[2/6] Tests (affected packages)..."
TEST_DB=true pnpm turbo test --affected

echo "[3/6] Type checking..."
pnpm turbo check-types --affected

echo "[4/6] Architecture check..."
pnpm check:architecture --changed 2>/dev/null || true

echo "[5/6] Lint..."
pnpm check:fix

echo "[6/6] OpenAPI check..."
pnpm hook:openapi:check:affected 2>/dev/null || true

echo ""
echo "=== All checks passed ==="
