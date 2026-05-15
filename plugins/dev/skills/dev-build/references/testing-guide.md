# Testing Guide

Quick reference for testing patterns during the build phase. For full details, read `docs/context/patterns/testing.md`.

## API Testing with curl

```bash
# Golf API
curl -s "$GOLF_API_URL/api/v1/<endpoint>" \
  -H "Authorization: Bearer $GOLF_API_KEY" \
  -H "Content-Type: application/json" | jq .

# POST with body
curl -s "$GOLF_API_URL/api/v1/<endpoint>" \
  -X POST \
  -H "Authorization: Bearer $GOLF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}' | jq .

# Portfolio API
curl -s "$PORTFOLIO_API_URL/api/v1/<endpoint>" \
  -H "Authorization: Bearer $PORTFOLIO_API_KEY" | jq .

# Hive API
curl -s "$HIVE_API_URL/api/v1/<endpoint>" \
  -H "Authorization: Bearer $HIVE_API_KEY" | jq .
```

## Web UI Testing with Playwright CLI

```bash
# Open browser
playwright-cli open <url> --config ~/.claude/playwright/cli.config.json

# Navigate
playwright-cli goto <url>

# Take screenshot
playwright-cli screenshot [target]

# Snapshot (accessibility tree)
playwright-cli snapshot [element]

# Interact
playwright-cli click <target>
playwright-cli fill <target> <text>

# Auth persistence
playwright-cli state-save ~/.claude/browser-auth.json
playwright-cli state-load ~/.claude/browser-auth.json
```

## Unit/Integration Tests

```bash
# Unit tests (no Docker needed)
turbo test --filter='@bokendell/<package>'

# Integration tests (needs Docker for Testcontainers)
TEST_DB=true turbo test --filter='@bokendell/<package>'

# Specific test file
turbo test --filter='@bokendell/<package>' -- --run <test-name>
```

## Lefthook Checks

```bash
# Pre-commit (must pass before staging)
pnpm turbo check-types --affected
pnpm check:fix
pnpm hook:api-docs:generate:staged

# Pre-push (must pass before declaring ready)
TEST_DB=true pnpm turbo test --affected
pnpm check:architecture --changed
pnpm hook:openapi:check:affected
```

## App Dev Servers

```bash
# Golf
turbo dev --filter='@bokendell/golf-api'        # API (default port 3001)
turbo dev --filter='@bokendell/golf-admin'       # Admin dashboard

# Portfolio
turbo dev --filter='@bokendell/portfolio-api'    # API
turbo dev --filter='@bokendell/portfolio-app'    # Frontend
turbo dev --filter='@bokendell/portfolio-admin'  # Admin

# Hive
turbo dev --filter='@bokendell/hive-api'         # API
turbo dev --filter='@bokendell/hive-admin'       # Admin
```
