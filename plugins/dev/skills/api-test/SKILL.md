---
name: api-test
description: Test API endpoints in a workspace using OpenAPI specs, auth tokens from Infisical, and self-healing debugging for common failures
---

# API Test

Automated API testing harness for workspace environments. Self-healing — handles auth failures, recreates keys, restarts processes, and diagnoses errors without user intervention.

## Prerequisites

Must be inside a workspace (`.workspace.json` exists in cwd tree). The API must be running (`swarm workspace dev` in another terminal).

Quick health check before testing:

```bash
swarm workspace status   # Shows service health, URLs, Infisical links
swarm workspace ps       # Shows running processes
```

## Step 1: Discover Workspace URLs

Read `.workspace.json` for the project and construct base URLs:

```bash
# From .workspace.json ports (preferred — faster, no internet hop)
GOLF_API_URL="http://localhost:${PORT_GOLF_API:-3100}"

# From tunnel hostnames (when verifying external routing)
GOLF_API_URL="https://golf-api-ws-test-dev.bokendell.com"
```

## Step 2: Get Auth Credentials

Test keys live in Infisical at `/apps/<project>/api`:

```bash
infisical export --env=development --path=/apps/golf/api --format=dotenv --silent | grep TEST_API_KEY
# TEST_API_KEY_ADMIN=hive_...
# TEST_API_KEY_USER=hive_...
```

If keys are missing or not working, run `swarm workspace verify-keys` — it recreates and pushes to Infisical automatically (see Debugging > 401/403 below).

## Step 3: Read OpenAPI Specs

Each API has a generated spec:

```
apps/golf/api/openapi.json
apps/portfolio/api/openapi.json
apps/hive/api/openapi.json
```

If the spec is stale (endpoints were added/changed), regenerate:

```bash
pnpm --filter=@bokendell/golf-api openapi:generate
```

## Step 4: Test Patterns

### Health Check
```bash
curl -sf http://localhost:${PORT}/health
# Expect: 200 with JSON body
```

### tRPC Query (GET)
```bash
curl "http://localhost:${PORT}/api/trpc/workspaces.list" \
  -H "Authorization: Bearer ${TEST_API_KEY_ADMIN}"
```

### tRPC Mutation (POST)
```bash
curl -X POST "http://localhost:${PORT}/api/trpc/workspaces.create" \
  -H "Authorization: Bearer ${TEST_API_KEY_ADMIN}" \
  -H "Content-Type: application/json" \
  -d '{"json": {"name": "test", ...}}'
```

### Test Matrix

For each resource, verify:

| Test | Method | Expect |
|------|--------|--------|
| List | GET | 200, array response matching schema |
| Get by ID | GET | 200 for valid ID, 404 for unknown |
| Create | POST | 200 with created resource |
| Update | PATCH | 200 with updated fields |
| Delete | DELETE | 200/204 |
| Bad input | POST invalid body | 400 with validation errors |
| No auth | GET without Bearer | 401 |
| User-level auth | GET admin endpoint with USER key | 403 |

## Step 5: Verify Side Effects

After mutations, confirm the DB state changed:

```bash
# DATABASE_URL is in .env.workspace
psql "${DATABASE_URL}" -c "SELECT id, name FROM table WHERE id = '<created-id>'"
```

After events, verify Inngest ran the function:

```bash
INNGEST_URL="http://localhost:${PORT_GOLF_INNGEST:-3106}"
curl -s "${INNGEST_URL}/runs" | jq '.runs[] | select(.function_id == "<fn-id>")'
```

Or use the CLI (workspace-aware):
```bash
swarm inngest runs
swarm inngest list
swarm inngest trigger <event-name> --data '{"json": "data"}'
```

## Debugging — Self-Healing Playbook

Match the error to an action. **Always try the action first before asking the user.**

### 401 Unauthorized or 403 Forbidden

**Cause:** Test API key is missing, expired, or wrong scope.

**Fix:**
```bash
swarm workspace verify-keys
```

This:
1. Reads current TEST_API_KEY_ADMIN/USER from Infisical
2. Tests them against the API
3. If broken: creates new users, generates fresh keys, tests them, pushes to Infisical
4. Reports per-key status

After it runs, re-export Infisical and retry the test:
```bash
infisical export --env=development --path=/apps/golf/api --format=dotenv --silent
```

If 403 but key is valid: you're using USER key on admin endpoint. Switch to TEST_API_KEY_ADMIN.

### Missing Keys (`TEST_API_KEY_ADMIN` not set)

**Fix:** Same as 401 — `swarm workspace verify-keys` will seed fresh keys.

Alternative (full test suite): `swarm db seed-users --test-suite --app <project>` recreates all 4 accounts and pushes to Infisical.

### Connection Refused (ECONNREFUSED, curl exit 7)

**Cause:** Dev server not running, crashed, or wrong port.

**Fix:**
```bash
swarm workspace ps   # Check what's actually running

# If dev not running, the user needs to start it in another terminal:
# swarm workspace dev <name>

# If dev IS running but port is wrong, verify .workspace.json ports
cat .workspace.json | jq .ports
```

Don't try to start `swarm workspace dev` from the agent — it's blocking and owns the terminal.

### 404 Not Found on Valid-Looking Endpoint

**Causes + fixes:**

1. **OpenAPI spec stale:**
   ```bash
   pnpm --filter=@bokendell/<project>-api openapi:generate
   ```

2. **tRPC path typo:** tRPC uses dot notation: `/api/trpc/<router>.<procedure>`. Check the actual router:
   ```bash
   grep -r "Router = router({" apps/<project>/api/src/packages/
   ```

3. **Route not registered:** Check `apps/<project>/api/src/packages/api/v1/trpc.router.ts` for the router import.

### 500 Internal Server Error

**Fix:**
1. **Check API stderr** where `swarm workspace dev` is running — errors print there. Common patterns:
   - Drizzle error → DB schema mismatch, run migrations
   - Zod error → unexpected data in the DB (null where not expected, etc.)
   - Timeout → external service (Linear, Superset) is down or slow

2. **Check Inngest** for failed background jobs:
   ```bash
   swarm inngest runs   # Look for status: "Failed"
   ```

3. **Check DB state:**
   ```bash
   psql "${DATABASE_URL}" -c "SELECT * FROM <table> ORDER BY created_at DESC LIMIT 5"
   ```

4. **Check typecheck:** A recent code change might have introduced a runtime error past type checking:
   ```bash
   pnpm turbo check-types --filter=@bokendell/<project>-api
   ```

### 400 Bad Request / Zod Validation Error

**Cause:** Request body doesn't match the Zod schema.

**Fix:** Read the response body — Zod errors are specific:
```json
{ "error": { "issues": [{ "path": ["name"], "message": "Required" }] } }
```

Compare against the OpenAPI request schema:
```bash
jq '.paths["/api/trpc/<procedure>"].post.requestBody' apps/<project>/api/openapi.json
```

### NXDOMAIN / Tunnel URL Unreachable

**Cause:** DNS not registered, or cloudflared not running.

**Fix:**
```bash
swarm workspace tunnel restart   # Regenerates config + re-registers DNS
# Wait 30s for Cloudflare DNS propagation
```

Then test tunnel URL. If still broken, verify cloudflared is running:
```bash
swarm workspace ps   # Look for cloudflared in the Tunnels section
```

### Port Conflict (EADDRINUSE)

**Cause:** Stale process holding the port, or another workspace using same ports.

**Fix:**
```bash
swarm workspace cleanup --all   # Kills all dev + tunnel processes
# Then user restarts: swarm workspace dev <name>
```

### Slow Response (>3s for simple queries)

**Causes + checks:**

1. **Neon cold start** — first query after idle takes ~500ms. Warm up:
   ```bash
   curl http://localhost:${PORT}/health   # Triggers DB connection
   ```

2. **Missing DB index** — check query with EXPLAIN:
   ```bash
   psql "${DATABASE_URL}" -c "EXPLAIN ANALYZE SELECT ..."
   ```

3. **External API timeout** (Linear, Superset) — check the endpoint's code for external calls. Consider adding circuit breakers.

### Schema Mismatch (Response Doesn't Match OpenAPI)

**Cause:** API returns extra/missing fields from what the schema says.

**Fix:**
1. Regenerate OpenAPI:
   ```bash
   pnpm --filter=@bokendell/<project>-api openapi:generate
   ```
2. Check the actual Zod schema in `apps/<project>/api/src/packages/<domain>/` — the OpenAPI is derived from it.
3. Check the DTO mapper — it might be adding computed fields not in the schema.

## Step 6: Report Results

For each endpoint tested:

```
POST /api/trpc/workspaces.create
  Status:   200 OK (expected 200)
  Time:     142ms
  Schema:   PASS
  Auth:     ADMIN=200, USER=403 (expected)
  Side FX:  DB row created ✓, Inngest job fired ✓
```

Flag:
- Unexpected 5xx
- Schema mismatches
- Slow responses (>2s for simple queries)
- Missing error responses (500 instead of 400 for bad input)
- Side effects that didn't happen (DB unchanged, job didn't fire)

## Snippets

Copy-paste blocks for common API testing patterns. Replace `golf` with your project.

### Setup — load URLs, ports, and auth keys

```bash
PROJECT=golf
API_PORT=$(jq -r ".ports.\"${PROJECT}-api\"" .workspace.json)
INNGEST_PORT=$(jq -r ".ports.\"${PROJECT}-inngest\"" .workspace.json)
API_URL="http://localhost:$API_PORT"
INNGEST_URL="http://localhost:$INNGEST_PORT"

# Auth keys from Infisical (pushed by swarm workspace verify-keys / swarm db seed-users)
ADMIN_KEY=$(infisical secrets get TEST_API_KEY_ADMIN --path=/apps/$PROJECT/api --env=development --plain --silent)
USER_KEY=$(infisical secrets get TEST_API_KEY_USER  --path=/apps/$PROJECT/api --env=development --plain --silent)
```

### Quick smoke test

```bash
# Health
curl -sf $API_URL/health | jq

# Inngest functions registered
curl -sf $INNGEST_URL/fn | jq -r '.functions[].name'

# Auth works
curl -sf $API_URL/api/trpc/workspaces.list -H "Authorization: Bearer $ADMIN_KEY" | jq
```

### tRPC query (GET)

```bash
curl -s "$API_URL/api/trpc/workspaces.list" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  | jq
```

### tRPC mutation (POST)

```bash
curl -sX POST "$API_URL/api/trpc/workspaces.create" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"json": {"name": "test-ws", "project": "golf", "path": "/tmp/x", "branch": "main"}}' \
  | jq
```

### Auth matrix test

```bash
# Same endpoint with admin key (expect 200) and user key (expect 403 for admin routes)
curl -s -o /dev/null -w "%{http_code}\n" $API_URL/api/trpc/admin.users.list \
  -H "Authorization: Bearer $ADMIN_KEY"   # -> 200
curl -s -o /dev/null -w "%{http_code}\n" $API_URL/api/trpc/admin.users.list \
  -H "Authorization: Bearer $USER_KEY"    # -> 403
curl -s -o /dev/null -w "%{http_code}\n" $API_URL/api/trpc/admin.users.list \
                                          # -> 401
```

### Introspect OpenAPI

```bash
OPENAPI=apps/$PROJECT/api/openapi.json

# All paths
jq -r '.paths | keys[]' $OPENAPI

# Request schema for one path
jq '.paths["/api/trpc/workspaces.create"].post.requestBody' $OPENAPI

# Response schema
jq '.paths["/api/trpc/workspaces.create"].post.responses."200"' $OPENAPI

# Does endpoint exist?
jq '.paths["/api/trpc/my.endpoint"] != null' $OPENAPI
```

### Check side effects

```bash
# DB state after mutation
psql "$(jq -r .databaseUrl .workspace.json)" -c "SELECT * FROM workspaces ORDER BY created_at DESC LIMIT 5"

# Or use the CLI shortcut
swarm db console

# Inngest function runs after triggering an event
curl -sf $INNGEST_URL/runs | jq '.runs[] | {fn: .function_id, status, started: .started_at}'
```

### Live logs while testing

```bash
# In a second terminal:
swarm workspace logs --app=golf-api --follow        # watch API logs
swarm workspace logs --level=error --since=5m       # recent errors
swarm workspace logs --search=trpc --lines=200      # tRPC-related lines
```

### Self-healing on failure

```bash
# Auth fails (401/403 or missing key)
swarm workspace verify-keys

# Endpoint 404 or schema mismatch
swarm openapi regenerate golf

# Tunnel URL NXDOMAIN
swarm workspace tunnel restart

# Port conflicts or zombie processes
swarm workspace cleanup --all
```

## Commands Reference

| Problem | Command |
|---------|---------|
| Missing/broken auth keys | `swarm workspace verify-keys` |
| Full test user reset | `swarm db seed-users --test-suite --app <project>` |
| Dev not running | `swarm workspace ps` then ask user to run `swarm workspace dev` |
| Port conflict | `swarm workspace cleanup --all` |
| Tunnel/DNS issues | `swarm workspace tunnel restart` |
| Stale OpenAPI | `pnpm --filter=@bokendell/<project>-api openapi:generate` |
| Check background jobs | `swarm inngest runs` |
| Trigger an event | `swarm inngest trigger <event-name> --data '{}'` |
| Type errors | `pnpm turbo check-types --filter=@bokendell/<project>-api` |
| DB state | `psql "$DATABASE_URL"` |
