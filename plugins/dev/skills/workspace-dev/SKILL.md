---
name: workspace-dev
description: Work productively inside a workspace — know ports, URLs, env vars, CLI commands, health checks
---

# Workspace Dev

Use this skill when working inside an isolated workspace environment. It tells you how to find context, check health, and use the workspace CLI.

## Detect Workspace Context

Read `.workspace.json` from the current directory tree (walks up like `.git`):

```json
{
  "name": "ws-test",
  "index": 1,
  "project": "golf",
  "branch": "bokendell/golf-286-mastra-thread-injector",
  "path": "/Users/bokendell/repos/projects",
  "ports": { "golf-api": 3110, "golf-admin": 3111, "golf-mobile": 3112 },
  "hostnames": { "golf-api": "golf-api-ws-test-dev.bokendell.com" },
  "databaseUrl": "postgresql://...",
  "linearIssueId": "GOLF-286"
}
```

If no `.workspace.json` exists, you're not in a workspace. Use `swarm workspace list` to see available ones.

## Port Formula

`base_port + (workspace_index x 10) + app_offset`

| Project | Base | API (0) | Admin (1) | App/Mobile (2) | Inngest | AI |
|---------|------|---------|-----------|----------------|---------|-----|
| golf | 3100 | +0 | +1 | +2 | +6 | +5 |
| portfolio | 3200 | +0 | +1 | +2 | +5 | -- |
| hive | 3300 | +0 | +1 | +2 | +5 | -- |

Workspace index 1 = +10 to all ports. Index 2 = +20. Max 9 workspaces per project.

## URL Scheme

`https://<app-id>-<workspace-name>-dev.bokendell.com`

Flat (1-level) because Cloudflare Universal SSL wildcard only covers `*.bokendell.com`.

## Environment Variables

`.env.workspace` is auto-generated and loaded by Turbo via `globalDotEnv`:

```
PORT_GOLF_API=3110
PORT_GOLF_ADMIN=3111
PORT_GOLF_MOBILE=3112
PORT_GOLF_INNGEST=3116
PORT=3110
GOLF_API_URL=https://golf-api-ws-test-dev.bokendell.com
DATABASE_URL=postgresql://...
```

Infisical secrets are merged via `swarm run` wrapper. Shell vars and `.env.workspace` **win** over Infisical.

## CLI Commands

| Command | Purpose |
|---------|---------|
| `swarm workspace status [name]` | Ports, URLs, health checks, Infisical links, DB info. Auto-detects from cwd. |
| `swarm workspace ps` | Running dev processes, cloudflared tunnels, listening ports |
| `swarm workspace dev [name]` | Start all dev servers via turbo |
| `swarm workspace stop [name]` | Stop dev servers |
| `swarm workspace cleanup` | Kill orphaned processes. `--all` kills everything. `--kill-tunnel` for cloudflared only. |
| `swarm workspace tunnel restart` | Regenerate tunnel config + re-register DNS for all workspaces |
| `swarm workspace create <name> --project <p>` | Full workspace setup (ports, Neon branch, tunnel, DNS) |
| `swarm workspace destroy <name> --force` | Soft-delete, cleanup Neon branch |
| `swarm workspace list` | List all tracked workspaces |

## Operational Checklist

When starting work in a workspace:

1. `swarm workspace status` - verify workspace context and health
2. `swarm workspace ps` - check if dev processes are already running
3. If not running: `swarm workspace dev`
4. After changes to registry/apps: `swarm workspace tunnel restart`
5. When done: `swarm workspace stop` or `swarm workspace cleanup`

## Database

- Connection string: `DATABASE_URL` in `.env.workspace`
- Neon console: shown in `swarm workspace status` output
- Each workspace has an isolated Neon branch — safe to run migrations

## Linear Integration

- `linearIssueId` auto-detected from branch name (e.g., `bokendell/golf-286-...` -> `GOLF-286`)
- Override with `--linear-id GOLF-123` on create
- Visible in `swarm workspace status` and the swarm dashboard

## Snippets

Ready-to-copy commands for common tasks. Prefer these over building commands from scratch.

### Discover current workspace context

```bash
# From inside a worktree — finds .workspace.json walking up like .git
jq . .workspace.json                               # full workspace state
jq -r .name .workspace.json                        # just the name
jq -r .databaseUrl .workspace.json                 # masked DB URL
jq -r '.ports | to_entries[] | "\(.key)=\(.value)"' .workspace.json
```

### Check what's running

```bash
swarm workspace ps                                    # devs + cloudflared + ports
swarm workspace status                                # full health check
curl -sf http://localhost:$(jq -r .ports.\"golf-api\" .workspace.json)/health
```

### Watch logs with filters

```bash
swarm workspace logs --follow                         # live tail
swarm workspace logs --app=golf-api --since=5m        # last 5 min of golf-api
swarm workspace logs --level=error --since=1h         # errors in past hour
swarm workspace logs --search=inngest --lines=500     # search msg content
swarm workspace logs --json | jq 'select(.app=="golf-api" and .stream=="stderr")'
```

### Call the workspace API

```bash
# Get the API port from .workspace.json
PORT=$(jq -r '.ports."golf-api"' .workspace.json)

# Health
curl -sf http://localhost:$PORT/health | jq

# Authenticated tRPC query
curl -s "http://localhost:$PORT/api/trpc/workspaces.list" \
  -H "Authorization: Bearer $(infisical secrets get TEST_API_KEY_ADMIN --path=/apps/golf/api --env=development --plain --silent)" | jq
```

### Inngest events

```bash
swarm inngest runs                                    # recent function runs (workspace-scoped)
swarm inngest list                                    # registered functions
swarm inngest trigger my/event --data '{"foo": 1}'    # send a test event
```

### Database queries

```bash
swarm db console                                      # psql against workspace DB
swarm db console --workspace=ws-test                  # explicit workspace

# One-shot query (no interactive shell)
psql "$(jq -r .databaseUrl .workspace.json)" -c "SELECT count(*) FROM courses"
```

### Reset / cleanup

```bash
swarm workspace cleanup                               # stale PIDs only
swarm workspace cleanup --all                         # kill all devs + tunnels
swarm workspace tunnel restart                        # fix DNS/tunnel drift
swarm workspace reset --fresh-db --force              # nuke + recreate Neon branch
```

### Verify API auth keys

```bash
swarm workspace verify-keys                           # ensures TEST_API_KEY_* work, recreates if broken
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| URL returns NXDOMAIN | DNS not registered | `swarm workspace tunnel restart` |
| Port conflict | Stale process from prior workspace | `swarm workspace cleanup --all` |
| Missing DATABASE_URL | Neon branch failed during create | Recreate workspace |
| Wrong port | .env.workspace not loaded | Check Turbo `globalDotEnv` config |
| Workspace not found | Not registered in Hive | `swarm workspace list` to verify |
