---
name: workspace
description: Manage dev workspaces — create, stop, start, status, URLs. Use when the user mentions "workspace", "start servers", "stop servers", "which workspace", "what port", or "show URLs".
---

# Workspace Management

Manage dev workspaces: check status, create, start/stop servers, destroy, recover tunnels, and look up URLs and ports.

## 1. Check Current Workspace

Read the workspace descriptor for the current worktree:

```bash
cat .workspace.json 2>/dev/null
```

List all workspaces across the monorepo:

```bash
pnpm swarm workspace list
```

## 2. Create a Workspace

```bash
pnpm swarm workspace create <name> \
  --branch $(git branch --show-current) \
  --project golf \
  --path $(pwd)
```

`--project` accepts: `golf | portfolio | hive`

This provisions a Neon database branch, allocates a port block, and writes `.workspace.json` into the worktree.

## 3. Start Dev Servers

From inside the worktree (name inferred from `.workspace.json`):

```bash
pnpm swarm workspace dev
```

Or target a workspace by name from any directory:

```bash
pnpm swarm workspace dev <name>
```

## 4. Stop Dev Servers

```bash
pnpm swarm workspace stop <name>
```

## 5. Destroy a Workspace

Deletes the Neon branch and frees allocated ports. The `--force` flag skips the confirmation prompt.

```bash
pnpm swarm workspace destroy <name> --force
```

## 6. Tunnel Recovery

If tunnel URLs become unreachable, restart the tunnel without bouncing the dev servers:

```bash
pnpm swarm workspace tunnel restart
```

## 7. URL Patterns

Public tunnel URLs follow the pattern:

```
https://<app>-<workspace-name>.dev.bokendell.com
```

Examples for workspace `ws1`:

| App | URL |
|-----|-----|
| golf-api | `https://golf-api-ws1.dev.bokendell.com` |
| golf-admin | `https://golf-admin-ws1.dev.bokendell.com` |

Always use tunnel URLs in `curl` commands and integration tests — do not use `localhost` when testing across workspaces or from CI.

## 8. Port Assignments

Formula: `project_base + (workspace_index × 10) + app_offset`

| Project | Main | ws1 | ws2 |
|---------|------|-----|-----|
| golf-api | 3100 | 3110 | 3120 |
| golf-admin | 3101 | 3111 | 3121 |
| portfolio-api | 3200 | 3210 | 3220 |
| hive-api | 3300 | 3310 | 3320 |

Base ports: golf = 3100, portfolio = 3200, hive = 3300.

## 9. Testing Tip

Use tunnel URLs, not `localhost`, when running `curl` against a workspace:

```bash
# Good — works from any machine, stable across port changes
curl https://golf-api-ws1.dev.bokendell.com/health

# Avoid — breaks if port changes or running remotely
curl http://localhost:3110/health
```
