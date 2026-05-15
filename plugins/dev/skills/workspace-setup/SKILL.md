---
name: workspace-setup
description: Bootstrap a workspace from scratch — full lifecycle from zero to running dev environment, portable to cloud workers
---

# Workspace Setup

Complete runbook for creating an isolated workspace. Works on local machines and cloud workers.

## Prerequisites

| Requirement | Check | Install |
|-------------|-------|---------|
| Node.js 22+ | `node -v` | `brew install node` |
| pnpm 10+ | `pnpm -v` | `npm i -g pnpm` |
| cloudflared | `cloudflared version` | `brew install cloudflared` |
| Infisical CLI | `infisical --version` | `brew install infisical/get-cli/infisical` |
| HIVE_API_URL | `echo $HIVE_API_URL` | Set to `http://localhost:3300` (local) or production URL |
| HIVE_API_KEY | `echo $HIVE_API_KEY` | Get from `swarm db seed bootstrap-key` or Infisical `/apps/cli` |

## Full Lifecycle

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Create Workspace

```bash
swarm workspace create <name> --project <project> [--branch <branch>] [--linear-id <TEAM-123>]
```

This command:
- Validates name (alphanumeric + dashes)
- Registers machine as a device with Hive API
- Allocates next available workspace index (1-9)
- Computes ports: `base_port + (index x 10) + app_offset`
- Creates Neon database branch (isolated from main)
- Generates tunnel ingress rules + registers DNS CNAMEs
- Syncs workspace to Superset (if configured)
- Auto-detects Linear issue from branch name (e.g., `golf-286-...` -> `GOLF-286`)
- Writes `.env.workspace` + `.workspace.json` to worktree root

**Example:**
```bash
swarm workspace create ws-feat --project golf --branch feat/new-scoring
# Output: Workspace "ws-feat" created (golf, index 1)
#         Linear: https://linear.app/bokendell/issue/GOLF-286
#         Ports: golf-api 3110, golf-admin 3111, golf-mobile 3112, golf-inngest 3116
#         URLs: golf-api-ws-feat-dev.bokendell.com, ...
```

### 3. Start Dev Servers

```bash
swarm workspace dev ws-feat
```

Launches all project apps via turbo with workspace port overrides. Infrastructure apps (Inngest, Mastra) are included.

### 4. Verify Health

```bash
swarm workspace status ws-feat
```

Shows:
- Service health (OK/DOWN per app)
- All URLs
- Database connection (masked)
- Infisical links per app
- Linear issue link
- Dev process PID

### 5. Work

Normal development. All apps bind to workspace-specific ports. Database is isolated. Tunnel URLs are live.

### 6. Destroy When Done

```bash
swarm workspace destroy ws-feat --force
```

Cleans up:
- Neon database branch deleted
- Workspace soft-deleted in Hive
- Local `.env.workspace` + `.workspace.json` removed

## Cloud Worker Portability

The `.superset/config.json` at repo root defines the interface for automated orchestrators:

```json
{
  "setup": ["pnpm install", "swarm workspace create $SUPERSET_WORKSPACE_NAME --project $SUPERSET_PROJECT ..."],
  "teardown": ["swarm workspace destroy $SUPERSET_WORKSPACE_NAME --force"],
  "run": ["swarm workspace dev $SUPERSET_WORKSPACE_NAME"]
}
```

**Environment variables for cloud workers:**

| Variable | Purpose |
|----------|---------|
| `SUPERSET_WORKSPACE_NAME` | Workspace identifier |
| `SUPERSET_PROJECT` | Project (golf, portfolio, hive) |
| `SUPERSET_WORKSPACE_PATH` | Worktree root path |
| `SUPERSET_LINEAR_ID` | Optional Linear issue to link |
| `HIVE_API_URL` | Hive API endpoint |
| `HIVE_API_KEY` | Machine credential for Hive |

A cloud worker just needs these env vars + the prerequisites installed. Everything else is computed.

## Troubleshooting

| Problem | Command | What It Does |
|---------|---------|-------------|
| See what's running | `swarm workspace ps` | Shows dev processes, cloudflared, listening ports |
| Kill everything | `swarm workspace cleanup --all` | Kills all dev + tunnel processes |
| Fix broken URLs | `swarm workspace tunnel restart` | Regenerates ingress + re-registers DNS |
| Port conflict | `swarm workspace cleanup --all` then `swarm workspace dev` | Clears stale processes |
| New app not showing | `swarm workspace tunnel restart` | Picks up new registry entries |
| DNS not resolving | Wait 30s after `tunnel restart` | Cloudflare DNS propagation |
| DB connection refused | `swarm workspace status` | Check if DATABASE_URL is set and Neon branch exists |

## Snippets

### Fresh-machine bootstrap (local)

```bash
# 1. Install prerequisites
brew install node pnpm cloudflared infisical/get-cli/infisical
npm i -g neonctl
neonctl auth                                       # one-time OAuth
infisical login                                    # one-time

# 2. Export Hive credentials
export HIVE_API_URL=http://localhost:3300
export HIVE_API_KEY=hive_...                       # from /apps/cli in Infisical

# 3. Install deps
pnpm install

# 4. Create workspace (auto-detects Linear ID from branch)
swarm workspace create my-feature --project golf

# 5. Start dev
swarm workspace dev my-feature

# 6. (Second terminal) Verify test keys
swarm workspace verify-keys my-feature

# 7. When done
swarm workspace destroy my-feature --force
```

### Quick audit of a running workspace

```bash
swarm workspace status                                # health, URLs, Infisical links, DB
swarm workspace ps                                    # processes + ports
swarm workspace logs --level=error --since=10m        # recent errors
```

### Cloud worker invocation pattern

```bash
# Superset orchestrator calls these with SUPERSET_* env vars set
export SUPERSET_WORKSPACE_NAME=ws-42
export SUPERSET_PROJECT=golf
export SUPERSET_WORKSPACE_PATH=/workspaces/ws-42
export SUPERSET_LINEAR_ID=GOLF-123  # optional

# Then the Superset-provided commands run:
pnpm install
pnpm swarm workspace create $SUPERSET_WORKSPACE_NAME \
  --project $SUPERSET_PROJECT \
  --branch $(git -C $SUPERSET_WORKSPACE_PATH branch --show-current) \
  --path $SUPERSET_WORKSPACE_PATH \
  ${SUPERSET_LINEAR_ID:+--linear-id $SUPERSET_LINEAR_ID}
pnpm swarm workspace dev $SUPERSET_WORKSPACE_NAME
```

### Destroy everything local (nuclear option)

```bash
swarm workspace cleanup --all                         # kill processes
for ws in $(swarm workspace list --json | jq -r '.[].name'); do
  swarm workspace destroy "$ws" --force
done
```

### Port check

```bash
lsof -iTCP -sTCP:LISTEN -nP | awk '$9 ~ /:31[0-9][0-9]$/ {print}'  # golf range
```

## Port Reference

| Project | Base | ws1 (+10) | ws2 (+20) | ws3 (+30) |
|---------|------|-----------|-----------|-----------|
| golf-api | 3100 | 3110 | 3120 | 3130 |
| golf-admin | 3101 | 3111 | 3121 | 3131 |
| golf-mobile | 3102 | 3112 | 3122 | 3132 |
| golf-inngest | 3106 | 3116 | 3126 | 3136 |
| golf-ai | 3105 | 3115 | 3125 | 3135 |
| portfolio-api | 3200 | 3210 | 3220 | 3230 |
| hive-api | 3300 | 3310 | 3320 | 3330 |
