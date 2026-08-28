# Remote tunnels — `swarm tunnel` + `remote-preview` skill

This doc covers the two tools for accessing locally-running dev servers from
off-network devices:

- **`swarm tunnel`** — named Cloudflare tunnels on `bokendell.com` for stable dev
  access. Use this for APIs and Expo.
- **`remote-preview` skill** — ephemeral `trycloudflare.com` URLs for mock
  approvals and brainstorming previews. Use this for one-off sharing.

Both wrap `cloudflared` and reuse the pattern already in use by hive at
`apps/api/scripts/dev/index.ts`.

---

## TL;DR

```bash
# One-time setup per app (creates named tunnel, DNS record)
pnpm swarm tunnel init --app golf-api

# Day-to-day: start dev with a public tunnel URL
pnpm swarm dev --tunnel golf-api

# Or, start a standalone tunnel in its own terminal
pnpm swarm tunnel start --app golf-api

# Inspect / stop
pnpm swarm tunnel list
pnpm swarm tunnel stop --label golf-api
pnpm swarm tunnel stop --all
```

For throwaway mock previews (no setup):

```bash
# From inside a Claude Code session, the remote-preview skill wraps this:
bash .claude/skills/remote-preview/scripts/share.sh 3000 "shadcn-login"
# → prints https://random-three-words.trycloudflare.com
```

---

## Why two tools?

| | `swarm tunnel` | `remote-preview` skill |
|---|---|---|
| Who runs it | You (or CI) via `pnpm swarm` | Claude inside a session |
| URL | `golf-api-dev.bokendell.com` (stable) | `random.trycloudflare.com` (ephemeral) |
| Setup | One-time `swarm tunnel init` per app | None |
| Gated auth | Cloudflare Access (recommended) | None — treat as public |
| Concurrent limit | Many (one cloudflared process each) | Many (same) |
| Lifetime | Until you stop it | Until the process dies or session ends |
| State file | `~/.bk/tunnels.json` | `/tmp/claude-remote-preview/tunnels.json` |
| Env override | Yes, `--tunnel` flag patches `process.env` | No, just a URL |

Use `swarm tunnel` when you want to work on your app *from anywhere* (mobile
device on a different network, reviewing your Next.js app on iPad, etc).
Use `remote-preview` when Claude has built a mock and you want to tap
"approve" from your phone without setting up infrastructure.

---

## Prerequisites

1. **`cloudflared` installed.**
   - macOS: `brew install cloudflared`
   - Linux: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   - Windows: `winget install --id Cloudflare.cloudflared`
2. **For named tunnels only**: you must own the `bokendell.com` zone in
   Cloudflare (already true in this repo). One-time: `cloudflared tunnel login`
   will open a browser to authorize the local daemon against the zone.

---

## One-time: create a named tunnel for an app

```bash
pnpm swarm tunnel init --app golf-api
```

What it runs (idempotent — safe to re-run):

```text
cloudflared tunnel login                              # browser auth (once)
cloudflared tunnel create bk-dev-golf-api             # creates the tunnel
cloudflared tunnel route dns bk-dev-golf-api golf-api-dev.bokendell.com
```

Then it prints the ingress stanza you must append to `~/.cloudflared/config.yml`:

```yaml
ingress:
  - hostname: golf-api-dev.bokendell.com
    service: http://localhost:3002
  - hostname: portfolio-api-dev.bokendell.com
    service: http://localhost:3002
  # ...one entry per app you've inited
  - service: http_status:404   # catch-all, must be last
```

Edit that file once, append entries as you init more apps.

### Lock it down with Cloudflare Access (strongly recommended)

In the Cloudflare dashboard → Zero Trust → Access → Applications → Add
application → Self-hosted. Set:

- Application domain: `golf-api-dev.bokendell.com` (or use `*-dev.bokendell.com`
  for one rule that covers all dev tunnels)
- Policy: Allow → Emails → your email

Once added, any request to `golf-api-dev.bokendell.com` requires you to
authenticate via email OTP before Cloudflare forwards it. This turns a public
tunnel into a private, self-gated URL — almost no work, massively reduced
blast radius.

---

## `swarm tunnel` command reference

### `swarm tunnel start`

Start a tunnel for a running local server.

```bash
# Named tunnel (default when --app is passed with known config)
pnpm swarm tunnel start --app golf-api

# Force quick trycloudflare URL even for a known app
pnpm swarm tunnel start --app golf-api --named=false

# Arbitrary port, no registry lookup
pnpm swarm tunnel start --port 3000 --label shadcn-login-preview
```

Starts `cloudflared`, records the PID + URL in `~/.bk/tunnels.json`, and
prints the public URL. Re-running with the same `--label` stops the prior
tunnel first.

Flags:

| Flag | Default | Meaning |
|---|---|---|
| `--app, -a` | — | Registry app id; looks up `dev.port` |
| `--port, -p` | — | Explicit local port (required if `--app` omitted) |
| `--label, -l` | `<app-id>` or `port-<port>` | Key in state file |
| `--named` | `false` | Use a named tunnel on `bokendell.com` |
| `--tunnelName` | `bk-dev-<label>` | Override tunnel name |
| `--hostname` | `<label>-dev.bokendell.com` | Override hostname |
| `--timeout` | `20000` | ms to wait for cloudflared to be ready |

### `swarm tunnel list`

```bash
pnpm swarm tunnel list
```

```text
LABEL           PORT  PID    KIND   STATUS  URL
--------------- ----- ------ ------ ------- --------------------------------------------
golf-api        3002  12345  named  alive   https://golf-api-dev.bokendell.com
shadcn-login    3000  12678  quick  alive   https://random-three-words.trycloudflare.com
```

### `swarm tunnel stop`

```bash
pnpm swarm tunnel stop --label golf-api
pnpm swarm tunnel stop --port 3002
pnpm swarm tunnel stop --all
```

Sends SIGTERM to each matched cloudflared, removes from state, keeps log file
at `~/.bk/logs/` in case you want to inspect why something failed.

### `swarm tunnel init`

```bash
pnpm swarm tunnel init --app golf-api
pnpm swarm tunnel init --app golf-api --dry-run       # print commands, don't run
pnpm swarm tunnel init --app golf-api --hostname custom.bokendell.com
```

See *One-time: create a named tunnel for an app* above.

---

## `swarm dev --tunnel` — bundling with the tunnel URL

For **Expo**, `EXPO_PUBLIC_*` is inlined at bundle time, so the tunnel URL
must be in the env *before* Metro starts. `swarm dev` handles this:

```bash
pnpm swarm dev --tunnel golf-api
```

Steps taken internally:

1. Look up `golf-api` in `@bokendell/core/registry` → port `3002`
2. `startTunnel` with `kind: "named"` → `golf-api-dev.bokendell.com`
3. Patch `process.env`:
   - `EXPO_PUBLIC_API_URL=https://golf-api-dev.bokendell.com`
   - `NEXT_PUBLIC_GOLF_API_URL=https://golf-api-dev.bokendell.com`
   - `TUNNEL_URL=https://golf-api-dev.bokendell.com`
   - `TUNNEL_ACTIVE=1`
4. Continue with the existing `devCommand` (turbo-powered) — child
   processes inherit the env

Add `--tunnelQuick` (which oclif exposes as `--tunnel-quick`) to use a
trycloudflare.com URL instead. No init needed, but CORS may need updating.

---

## CORS setup (one-time)

Named tunnels use `https://*-dev.bokendell.com`. Add this to each API's
`ALLOWED_ORIGINS` in Infisical:

```
# Infisical path: /apps/api (or /apps/api, etc.)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://development.bokendell.com,https://*-dev.bokendell.com
```

For quick tunnels, either also include `https://*.trycloudflare.com` (loose)
or add a one-off origin each time you preview (strict).

---

## State, logs, cleanup

- State file: `~/.bk/tunnels.json`
- Logs: `~/.bk/logs/<label>-<port>-<timestamp>.log`
- On crash or SIGKILL, the state file may list dead tunnels. `swarm tunnel list`
  shows `STATUS=dead` for these; run `swarm tunnel stop --all` to sweep them.
- The `remote-preview` skill uses a **separate** state file at
  `/tmp/claude-remote-preview/tunnels.json` to keep ownership clear.

---

## Security & risks

- Named dev tunnels are **publicly routable** by default. Gate them with
  Cloudflare Access (email OTP) — takes 5 minutes in the Zero Trust
  dashboard and completely changes the threat model.
- Quick tunnels have **no auth**. Treat every URL as logged and public.
- Never tunnel a service that reads production data. Dev DBs only.
- Metro over a tunnel works but HMR reconnects can be slow; prefer
  `expo start --tunnel` (Expo's own tunnel for the Metro port) combined
  with `swarm tunnel start --app <api>` for the API.
- Orphaned `cloudflared` processes on crash: `swarm tunnel stop --all` fixes.

---

## Troubleshooting

**"cloudflared did not report a trycloudflare URL within 20000ms"**
- Bump `--timeout 40000`
- Check `~/.bk/logs/<label>-*.log` for the actual cloudflared error
- If Cloudflare is degraded, wait it out or use the named tunnel path

**"Named tunnel did not register"**
- You haven't run `swarm tunnel init` for this app yet
- Or `~/.cloudflared/config.yml` is missing the ingress rule
- Or the hostname isn't DNS-routed: re-run `cloudflared tunnel route dns <name> <host>`

**"CORS blocked"**
- Add `https://*-dev.bokendell.com` to `ALLOWED_ORIGINS` in Infisical for
  the API you're tunneling

**"Expo is still pointing at localhost"**
- Expo inlines `EXPO_PUBLIC_*` at bundle time. Stop Metro, rerun
  `pnpm swarm dev --tunnel golf-api`, and wait for the bundle to rebuild.

---

## Related files

- `packages/shared/cli/src/lib/tunnel/` — shared helper used by both
  `swarm tunnel` and `swarm dev --tunnel`
- `packages/shared/cli/src/commands/tunnel/` — `swarm tunnel {start,list,stop,init}`
- `packages/shared/cli/src/commands/dev/index.ts` — `--tunnel` flag
- `.claude/skills/remote-preview/` — Claude-invoked quick-tunnel skill
- `apps/api/scripts/dev/index.ts` — original pattern this is based on

---

## Workspace Tunnel System

Each dev workspace gets stable named tunnel URLs on `*.dev.bokendell.com`, managed automatically by the `swarm workspace` CLI.

### How it works

- **DNS**: A wildcard CNAME `*.dev.bokendell.com` points to the named Cloudflare tunnel
- **Config**: `swarm workspace create/destroy` regenerates `~/.cloudflared/config.yml` (full regeneration, never patching) via `generateCloudflaredConfig()` in `packages/shared/cli/src/lib/workspace/tunnel.ts`
- **Reload**: cloudflared receives `SIGHUP` for hot-reload when already running; spawns a new detached daemon otherwise

### URL pattern

```
https://<app>-<workspace-name>.dev.bokendell.com
```

Examples for workspace `ws1` on the golf project:
- `golf-api-ws1.dev.bokendell.com` — golf API (port 3110)
- `golf-admin-ws1.dev.bokendell.com` — golf admin (port 3111)
- `inngest.dev.bokendell.com` — Inngest dev server (shared, always port 8288)

### Workspace vs quick tunnel decision tree

```
Is .workspace.json present in CWD?
  YES → Use https://<app>-<workspace>.dev.bokendell.com (stable, named)
  NO  → Is this a permanent app URL? (API, Expo)
          YES → Use `swarm tunnel` (named, one-time setup)
          NO  → Use remote-preview skill (quick, ephemeral trycloudflare.com)
```

Note: `trycloudflare.com` URLs may be blocked on Tailscale Wi-Fi. Named tunnels on `*.dev.bokendell.com` always work.

### Legacy rules

The cloudflared config always includes a legacy rule for `agents-dev.bokendell.com` → port 3300 (hive-api), preserved for existing Linear webhooks.
