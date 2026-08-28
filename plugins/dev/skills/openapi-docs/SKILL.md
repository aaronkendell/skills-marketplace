---
name: openapi-docs
description: Find OpenAPI specs for every API in the monorepo — both on-disk JSON files and live URLs served by each API
---

# OpenAPI Docs

Every API in this monorepo publishes an OpenAPI spec in two forms: an on-disk JSON file and live URLs served by the running dev server. Use this skill to locate them without guessing.

## On-Disk Spec Files

Each API has a checked-in `openapi.json` at the package root. These are the source of truth for API contracts used by tests, clients, and tooling.

| Project | Path |
|---------|------|
| golf | `apps/api/openapi.json` |
| portfolio | `apps/api/openapi.json` |
| hive | `apps/api/openapi.json` |

These are **generated** from Zod schemas in the router code. Don't edit them by hand — regenerate instead.

## Live URLs (per running workspace)

While `swarm workspace dev` is running, each API serves three documentation surfaces:

| Path | What it is |
|------|-----------|
| `/openapi.json` | Raw OpenAPI 3.x JSON spec |
| `/docs` | Swagger UI (interactive, classic) |
| `/reference` | Scalar UI (prettier, modern — preferred for humans) |

### Workspace URL formula

Base URL = `http://localhost:<workspace-api-port>` (fast) or `https://<app-id>-<workspace>-dev.bokendell.com` (tunnel).

| Workspace | golf-api URL for spec |
|-----------|----------------------|
| main (no workspace) | http://localhost:3100/openapi.json |
| ws1 | http://localhost:3110/openapi.json |
| ws-test (tunnel) | https://golf-api-ws-test-dev.bokendell.com/openapi.json |

Get the workspace's API port from `.workspace.json.ports` or run `swarm workspace status`.

## Regenerating

When the router or Zod schemas change, regenerate the spec:

```bash
# Single project
swarm openapi regenerate golf

# All projects
swarm openapi regenerate --all

# Also regenerate Postman + Bruno collections
swarm openapi regenerate golf --api-docs
```

Under the hood this runs `pnpm --filter=@bokendell/<project>-api openapi:generate`.

## How to Use the Spec

### For API testing (manual or agent-driven)

Parse `openapi.json` to discover endpoints:

```bash
jq -r '.paths | keys[]' apps/api/openapi.json
```

Get the request schema for an endpoint:

```bash
jq '.paths["/api/v1/workspaces"].post.requestBody.content["application/json"].schema' \
  apps/api/openapi.json
```

Get the response schema:

```bash
jq '.paths["/api/v1/workspaces"].post.responses["200"]' \
  apps/api/openapi.json
```

### For clients

OpenAPI-generated client SDKs live alongside the API spec — check `packages/client` for the generated types and oRPC client wrappers.

### Related collections

Every API also publishes:
- **Postman collection** at `apps/api/postman/collections/<project>-api.postman_collection.json`
- **Bruno collection** at `apps/api/bruno/` (directory-based)

These are regenerated alongside the OpenAPI spec when you pass `--api-docs`.

## Spec Freshness

If an API call returns 404 for an endpoint you see in the code, or the response shape doesn't match the spec, the spec is likely stale. Fix it:

```bash
swarm openapi regenerate <project>
```

Then retry. If the issue persists, the router registration may be missing — check `apps/api/src/packages/api/v1/orpc.router.ts` for the route.

## Tags (Section Grouping)

Each endpoint has a tag for grouping in the UI. Find the tag registry at:

```
apps/api/src/packages/api/openapi-tags.ts
```

Tags like `WORKSPACES`, `USERS`, `HEALTH` group routes together in the Scalar/Swagger UI.

## Snippets

### Open the live UI

```bash
PORT=$(jq -r '.ports."golf-api"' .workspace.json)
open "http://localhost:$PORT/reference"            # Scalar UI
open "http://localhost:$PORT/docs"                 # Swagger UI
```

### List all endpoints in the spec

```bash
jq -r '.paths | keys[]' apps/api/openapi.json
```

### Group endpoints by tag

```bash
jq -r '
  .paths
  | to_entries[]
  | .key as $path
  | .value
  | to_entries[]
  | "\(.value.tags[0] // "untagged")\t\(.key | ascii_upcase)\t\($path)"
' apps/api/openapi.json | sort
```

### Inspect one endpoint's full definition

```bash
PATH='/api/v1/workspaces'
jq --arg p "$PATH" '.paths[$p]' apps/api/openapi.json
```

### Diff spec against what the running API serves

```bash
# Checked-in spec
jq . apps/api/openapi.json > /tmp/spec-disk.json

# Live spec
PORT=$(jq -r '.ports."golf-api"' .workspace.json)
curl -s "http://localhost:$PORT/openapi.json" | jq . > /tmp/spec-live.json

# Diff (non-empty output = disk spec is stale, regenerate)
diff /tmp/spec-disk.json /tmp/spec-live.json
```

### Regenerate after router changes

```bash
swarm openapi regenerate golf                         # spec only (fast)
swarm openapi regenerate golf --api-docs              # + Postman/Bruno collections
swarm openapi regenerate --all                        # every project
```

### Extract request/response schemas

```bash
# Request body schema
jq '.paths["/api/v1/workspaces"].post.requestBody.content["application/json"].schema' \
  apps/api/openapi.json

# Successful response schema
jq '.paths["/api/v1/workspaces"].post.responses."200".content["application/json"].schema' \
  apps/api/openapi.json
```

### Find all endpoints that require admin scope

```bash
jq -r '
  .paths | to_entries[] | .key as $path
  | .value | to_entries[]
  | select(.value.security // [] | map(.admin != null) | any)
  | "\($path) \(.key | ascii_upcase)"
' apps/api/openapi.json
```

## Quick Reference

| Need | Command or path |
|------|-----------------|
| Read spec file | `jq . apps/api/openapi.json` |
| Open live UI | `open http://localhost:<port>/reference` |
| Regenerate spec | `swarm openapi regenerate <project>` |
| List all endpoints | `jq -r '.paths \| keys[]' apps/api/openapi.json` |
| Get endpoint schema | `jq '.paths["<path>"]' apps/api/openapi.json` |
| Check if endpoint exists | `jq '.paths["<path>"] != null' ...` |
