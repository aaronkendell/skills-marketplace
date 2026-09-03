---
name: cloud-agent
description: >
  How to run a bokendell app repo inside a cloud VM — a Cursor Cloud Agent or
  a Claude Code cloud session (vs `swarm workspace dev` on a laptop). Use when starting servers/apps (API, admin,
  web, mobile/Metro, Inngest, workers, MCP servers), deciding which services a
  task needs, wiring Infisical/swarm in the sandbox, or exposing something to a
  phone/browser over a tunnel. On a laptop keep using `swarm workspace dev`.
---

# Running a repo in a cloud VM (Cursor Cloud Agent · Claude Code cloud session)

**Repo specifics live in the repo.** golf, hive and keepings each have their own
`.claude/skills/cloud-agent/` covering their apps, secrets, bootstrap script and
which services a task needs. Read that one alongside this. This skill carries only
what is true of every repo in a cloud VM.


Laptop = `swarm workspace dev` (Neon branch + tunnels + port allocation). A
Cloud Agent is different: a **prebuilt environment** provides the toolchain and
a local stack, and you start only the apps a task needs. This skill is the map
from "I need app X" to "run Y". It's org-generic; read the repo's own
`bokendell.config.ts` / `packages/config` app registry and each app's `dev`
script for the specific ids, ports, and Infisical paths.

## The environment (shared base image + per-repo install/start)

Repos boot from `ghcr.io/aaronkendell/cloud-agent-base` (Node 24, pnpm, Infisical
CLI, cloudflared, postgresql-client, build toolchain; user `ubuntu`) via
`.cursor/environment.json` → `build.dockerfile` (Cursor's schema has no `image`,
`name`, or `user` keys — a committed environment.json overrides the dashboard).
Non-DB repos ship a one-line `FROM` Dockerfile; DB repos add their Postgres
major/extensions on top. Committed lifecycle scripts live in the cloud-agnostic `scripts/cloud/` folder (`.cursor/environment.json` + `.cursor/Dockerfile` and `.claude/settings.json` only point at them):

- `scripts/cloud/install.sh` — writes `~/.npmrc` with `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` (a `${VAR}` ref, never the literal token) + `verify-deps-before-run=false`, then `pnpm install --frozen-lockfile` (with `CI=1` so the root `prepare`/lefthook hook is skipped).
- `scripts/cloud/start.sh` — per-boot: bring up local Postgres + Redis if the repo uses them (no systemd → `pg_ctlcluster` directly), apply migrations by calling `drizzle-kit migrate` directly (not via pnpm; `push` needs a TTY), write `.env.workspace` pointing at the local stack, and reconstruct `~/.config/bokendell/infisical.json` (keyed by the repo's swarm account) from `INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET` so `swarm run` authenticates.

Secrets in the Cursor Secrets UI (least-privilege): a **dev, read-only** Infisical machine identity per repo (`INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET`). `NODE_AUTH_TOKEN` is optional — `start.sh` pulls `GITHUB_PACKAGES_TOKEN` (`/infrastructure/github`, env `development`, present in every project) into `~/.npmrc` each boot. Everything else is fetched from Infisical at run time (env slug `development`). To mimic prod, delete `.env.workspace` so Infisical's Neon/Upstash URLs win.


## Claude Code cloud sessions — same scripts, thin parity layer

Claude cloud sessions (claude.ai/code, `claude --cloud`, routines, mobile app)
run on Anthropic's VM (Ubuntu 24.04, ~4 vCPU · 16 GB · 30 GB, Node 20–22,
PG16, Redis, Docker). The base image can't be replaced, so the Dockerfile
doesn't apply; the repo's `scripts/cloud/*.sh` still do. Per repo:

- The environment's **setup script** is the repo-agnostic *fleet toolchain
  script* (hq `docs/tools/cloud-runbook.md`): Node 24 (+ a shim over the VM's
  `/opt/node22/bin`, which shadows `/usr/local/bin` in interactive shells), pnpm,
  Infisical CLI via npm (`@infisical/cli` — no GitHub release binaries),
  cloudflared, plus a best-effort dep warm-up. It must not reference repo paths —
  its working directory is not the repo (relative paths exit 127).
- `.claude/settings.json` SessionStart hook (matcher `startup|resume`, timeout
  900) runs `scripts/cloud/claude-session.sh`, which exits immediately unless
  `CLAUDE_CODE_REMOTE=true`, then: toolchain guard → `GITHUB_PACKAGES_TOKEN`
  from Infisical → `install.sh` → start dockerd (not running per session) →
  `start.sh`. Full output: `/tmp/cloud-session.log`; WARNING lines on stdout.
- `start.sh` takes a Docker path when `CLOUD_PG_IMAGE` is set (DB repos whose
  Postgres major/extensions aren't in Anthropic's image, e.g.
  `ghcr.io/aaronkendell/test-postgres:latest`); otherwise the baked cluster.
- Environment form: setup = fleet toolchain script; vars
  `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET` (+ `CLOUD_PG_IMAGE`). `NODE_AUTH_TOKEN`
  is optional: `start.sh` resolves `GITHUB_PACKAGES_TOKEN` from Infisical
  (`/infrastructure/github`, env `development`) every boot and writes it into
  `~/.npmrc`;
  network **Custom** = Trusted + `nodejs.org`, `app.infisical.com`,
  `*.trycloudflare.com`, `*.argotunnel.com` (+ `*.neon.tech`, `*.upstash.io`
  only when mimicking prod). GitHub goes through Anthropic's proxy — no PAT.
- One env for the whole fleet: identities are per-repo keys
  (`INFISICAL_CLIENT_ID_GOLF` / `INFISICAL_CLIENT_SECRET_GOLF`, `…_HIVE`, …,
  `…_BOKENDELL` for core + hq); `claude-session.sh` maps them to the generic names.
  DB repos default their own `CLOUD_PG_IMAGE`. Pin with `/remote-env`. Hand-off: `claude --teleport`
  pulls branch + transcript to the laptop; `/remote-control` keeps the phone
  attached to a local session.
- Plugins installed at user scope do **not** load in cloud VMs. A repo that
  needs this skill in Claude cloud keeps a repo-local copy (`.claude/skills/`)
  or a pointer in `CLAUDE.md`.

## Lifecycle — the VM is ephemeral, not a server

Nothing stays running. Cursor suspends idle agents; Claude reclaims the VM after
idle and reopening gives a fresh one with the transcript restored. Caches keep
*files* (deps, images) — never processes. `start.sh` re-runs on every boot and
is idempotent; if something looks missing, run it again. Tunnels die with the
VM. Anything someone else must be able to reach is Fly/Vercel staging, not a
cloud session.

## Two rules that avoid the common failures

1. **tsx-based servers need workspace packages built first** (they import `@bokendell/*` from `dist`): `pnpm exec turbo run build --filter=<pkg>`. Next.js/Metro compile on the fly.
2. **Run apps with `swarm run --app <id>`** (Infisical injection) and start Next.js/Metro **from the app's own directory**. Never export `CI=1` globally — it disables Next/Metro watch. (`verify-deps-before-run=false` is set so `pnpm`/`swarm run` don't trip the lefthook hook.)

## Starting things (on demand — don't auto-run everything)

- **Hono/tsx API:** build its deps, then `swarm run --app <api id> -- ./node_modules/.bin/tsx apps/api/src/server.ts`; health is typically `GET /api/v1/health`.
- **Next.js (admin/marketing/design/web):** `cd apps/<x> && ../../swarm run --app <id> -- ../../node_modules/.bin/next dev --hostname 0.0.0.0 --port <port>`.
- **Email preview (react-email):** `cd packages/emails && ../../node_modules/.bin/email dev --dir ./src/templates --port <port>`.
- **Background jobs (Inngest + workers)** — when the repo has `apps/inngest` and/or `apps/workers`, async work only runs if BOTH the local Inngest dev server and the workers process are up, in this order:
  1. Inngest dev server: `cd apps/inngest && ../../node_modules/.bin/inngest-cli dev --port <PORT_*_INNGEST|3106> --no-discovery`. It has a web dashboard (viewable — tunnel it to watch runs).
  2. Workers: build first if tsx, then `swarm run --app <workers id> -- ./node_modules/.bin/tsx watch apps/workers/src/server.ts`. They register their function configs to the dev server over a connect-mode WebSocket, so start them AFTER step 1.
  3. API: it must point at the local dev server (`INNGEST_DEV` / `PORT_*_INNGEST`, from `.env.workspace` or Infisical dev) so events it emits reach the functions.
  Set `SKIP_AI_INNGEST=true` when the workspace has no real AI provider keys (the AI pipeline retries upstream auth failures fast enough to crash the dev process). To validate an async flow end to end: Inngest up → workers connected → API emits an event → confirm the run in the Inngest dashboard.
- **Mobile / Metro (agent-driven, the default):** go through **simrig**, never cloudflared/ngrok. The simulator lives on the owner's Mac; the relay at `https://rig.bokendell.com` bridges to it, and the Metro tunnel is a plain WebSocket upgrade on 443 to that same relay, so it works under the Claude cloud CONNECT proxy where cloudflared (port 7844) and ngrok (muxed stream) do not. Prereqs in the cloud environment: `RIG_TOKEN` set, the sim-rig MCP connector (or `.mcp.json` / `.cursor/mcp.json` with `Authorization: Bearer ${RIG_TOKEN}`), and a GitHub token that can read `simrig-dev/simrig` until the CLI is on npm. Steps: (1) call the `get-agent-skill` MCP tool first, it teaches the loop; (2) install the CLI: `gh repo clone simrig-dev/simrig /tmp/simrig -- --depth 1 && (cd /tmp/simrig && pnpm install --frozen-lockfile && pnpm build)`; (3) from the app dir, with the app's `EXPO_PUBLIC_*` loaded: `APP_VARIANT=development infisical run -- env RIG_RELAY_HTTP_URL=https://rig.bokendell.com RIG_RELAY_URL=wss://rig.bokendell.com pnpm --dir /tmp/simrig rig expo dev --skip-fingerprint` (drop `--skip-fingerprint` when native code changed; on `NEEDS_BUILD` it prints the exact `eas build`); (4) drive and verify with the sim-rig tools (`ios-screenshot-and-element-tree`, `ios-use`, `ios-logs`, `ios-network`, `ios-record`); (5) `rig expo stop --instance-id <id> --delete`. Fallback when a tunnel is impossible: install the bundled-JS `e2e-test` EAS profile via `ios-install-app` and drive that. `scripts/cloud/mobile-tunnel.sh` is ONLY for handing a Metro URL to a human's physical phone, and only from a Cursor agent or the laptop.
- **MCP servers (hq-style):** actually RUN them and check the handshake — HTTP/SSE: curl the endpoint / list tools; stdio: a minimal `initialize` handshake or the repo's MCP test.
- **Pure library repos (core):** no servers — validate with `turbo run build`, `check-types`, `test`, and lint.
- **Docker-only services (e.g. Sockudo realtime):** not available unless Docker is enabled; use the stage instance.

## Tunnels (phone / external browser)

For simulators driven by an agent, do not tunnel at all: simrig's relay carries both the tool calls and the Metro tunnel (see Mobile / Metro above). The providers below are for a human's browser or physical phone.

**Provider depends on the runtime.** cloudflared needs a raw outbound connection on
port 7844 (QUIC or TCP/h2): Cursor Cloud Agents allow it, but Claude Code cloud
sessions route all egress through an HTTP CONNECT proxy limited to 443, so
cloudflared fails its edge pre-check and quick-tunnel URLs return Cloudflare 1033 /
HTTP 530. `mobile-tunnel.sh` probes 7844 and falls back to a single ngrok agent
(`connect.ngrok-agent.com:443`, honours `HTTPS_PROXY`) publishing both endpoints;
it needs `NGROK_AUTHTOKEN` in the environment or at Infisical `/infrastructure/ngrok`.
With neither provider, do device testing from a Cursor agent or the laptop.

Everything runs inside the VM; reach it with `bash scripts/cloud/tunnel.sh <port> [name]` (fleet helper with a restart watchdog; `--list` shows live URLs) or raw `cloudflared tunnel --url http://localhost:<port>` (outbound-only; prints a `*.trycloudflare.com` URL). APIs already trust `*.trycloudflare.com` for CORS. Quick-tunnel URLs rotate on restart — use a named tunnel token for a fixed hostname.

## Long-running processes

Run dev servers/tunnels under tmux or `nohup` with a log; don't block a single foreground command. Treat multi-hour idle survival as test-before-relying (the VM can sleep); mobile-tunnel.sh includes a watchdog that restarts a dropped tunnel.

## Connecting & viewing (default behavior)

The user wants to *see and use* what's running. Match the verification method to the
surface — and know the key constraint: **a quick tunnel only lives as long as the VM
serving it.** A *verification subagent* suspends the moment its task ends, so its
tunnel dies within seconds; the *primary agent* the user launched stays alive while
the session is open. So:

- **Web surfaces** (admin / marketing / design studio / email preview): don't gate "done" on a live tunnel. **Verify with a durable screenshot** — drive headless Chrome against `http://localhost:<port>` and attach the image as proof (this persists; a tunnel URL does not). Offer a `cloudflared tunnel --url http://localhost:<port>` URL **on request** for the user to click around live during the session.
- **Mobile** (the case where live device testing matters): verify on a **simrig lease** from this session, `rig expo dev` plus the sim-rig tools, and attach durable proof: an `ios-record` recording link or the screenshot from `ios-screenshot-and-element-tree`. Release the lease when done (idle leases reap themselves, but an open tunnel does not keep one alive). Only when the user wants to test on their own phone, and only from a Cursor agent or the laptop, run `scripts/cloud/mobile-tunnel.sh` and hand over the Metro URL, keeping this primary session open so the tunnel stays up.
- **APIs**: validate fully and non-visually — `GET /api/v1/health` 200, `/docs` — no tunnel needed for proof.
- **MCP servers** (HTTP/SSE): tunnel + list tools; stdio: give the run command.

Keep long-lived processes under tmux/`nohup` with the mobile-tunnel watchdog. Quick-tunnel
URLs are random and rotate on restart — offer a named Cloudflare tunnel (token) for a
fixed hostname. End with a list of live URLs (noting they last only while the session runs).

## Network

Keep "Allow all" egress. If locking down, the allowlist must include `*.trycloudflare.com` + `*.argotunnel.com` (cloudflared edge) plus `registry.npmjs.org`, `npm.pkg.github.com`, `ghcr.io`, `github.com`, `app.infisical.com`, `*.neon.tech`, `*.upstash.io`, and the AI/observability hosts.
