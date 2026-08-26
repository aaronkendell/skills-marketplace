---
name: cloud-agent
description: >
  How to run a bokendell app repo inside a Cursor Cloud Agent (vs `swarm
  workspace dev` on a laptop). Use when starting servers/apps (API, admin,
  web, mobile/Metro, Inngest, workers, MCP servers), deciding which services a
  task needs, wiring Infisical/swarm in the sandbox, or exposing something to a
  phone/browser over a tunnel. On a laptop keep using `swarm workspace dev`.
---

# Running a repo in a Cursor Cloud Agent

Laptop = `swarm workspace dev` (Neon branch + tunnels + port allocation). A
Cloud Agent is different: a **prebuilt environment** provides the toolchain and
a local stack, and you start only the apps a task needs. This skill is the map
from "I need app X" to "run Y". It's org-generic; read the repo's own
`bokendell.config.ts` / `packages/config` app registry and each app's `dev`
script for the specific ids, ports, and Infisical paths.

## The environment (shared base image + per-repo install/start)

Repos boot from `ghcr.io/aaronkendell/cloud-agent-base` (Node 24, pnpm, Infisical
CLI, cloudflared, postgresql-client, build toolchain; user `ubuntu`), referenced
from `.cursor/environment.json`. DB repos extend it via `.cursor/Dockerfile`
(`FROM` the base + their Postgres major/extensions). Committed lifecycle scripts:

- `.cursor/install.sh` — writes `~/.npmrc` with `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` (a `${VAR}` ref, never the literal token) + `verify-deps-before-run=false`, then `pnpm install --frozen-lockfile` (with `CI=1` so the root `prepare`/lefthook hook is skipped).
- `.cursor/start.sh` — per-boot: bring up local Postgres + Redis if the repo uses them (no systemd → `pg_ctlcluster` directly), apply migrations by calling `drizzle-kit migrate` directly (not via pnpm; `push` needs a TTY), write `.env.workspace` pointing at the local stack, and reconstruct `~/.config/bokendell/infisical.json` (keyed by the repo's swarm account) from `INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET` so `swarm run` authenticates.

Secrets in the Cursor Secrets UI (least-privilege): `NODE_AUTH_TOKEN` (GitHub PAT, read:packages — team scope) and a **dev, read-only** Infisical machine identity per repo (`INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET`). Everything else is fetched from Infisical at run time (env slug `development`). To mimic prod, delete `.env.workspace` so Infisical's Neon/Upstash URLs win.

## Two rules that avoid the common failures

1. **tsx-based servers need workspace packages built first** (they import `@bokendell/*` from `dist`): `pnpm exec turbo run build --filter=<pkg>`. Next.js/Metro compile on the fly.
2. **Run apps with `swarm run --app <id>`** (Infisical injection) and start Next.js/Metro **from the app's own directory**. Never export `CI=1` globally — it disables Next/Metro watch. (`verify-deps-before-run=false` is set so `pnpm`/`swarm run` don't trip the lefthook hook.)

## Starting things (on demand — don't auto-run everything)

- **Hono/tsx API:** build its deps, then `swarm run --app <api id> -- ./node_modules/.bin/tsx apps/api/src/server.ts`; health is typically `GET /api/v1/health`.
- **Next.js (admin/marketing/design/web):** `cd apps/<x> && ../../swarm run --app <id> -- ../../node_modules/.bin/next dev --hostname 0.0.0.0 --port <port>`.
- **Email preview (react-email):** `cd packages/emails && ../../node_modules/.bin/email dev --dir ./src/templates --port <port>`.
- **Inngest:** `cd apps/inngest && ../../node_modules/.bin/inngest-cli dev --port <port> --no-discovery`; then **workers** via `swarm run --app <workers id> -- tsx watch src/server.ts` (registers to the dev server).
- **Mobile / Metro:** use the repo's `.cursor/mobile-tunnel.sh` — it boots + tunnels the API and Metro and wires `EXPO_PUBLIC_API_URL` + `EXPO_PACKAGER_PROXY_URL`. The phone needs the EAS dev client already installed; open the printed Metro URL in "Enter URL manually".
- **MCP servers (hq-style):** actually RUN them and check the handshake — HTTP/SSE: curl the endpoint / list tools; stdio: a minimal `initialize` handshake or the repo's MCP test.
- **Pure library repos (core):** no servers — validate with `turbo run build`, `check-types`, `test`, and lint.
- **Docker-only services (e.g. Sockudo realtime):** not available unless Docker is enabled; use the stage instance.

## Tunnels (phone / external browser)

Everything runs inside the VM; reach it with `cloudflared tunnel --url http://localhost:<port>` (outbound-only; prints a `*.trycloudflare.com` URL). APIs already trust `*.trycloudflare.com` for CORS. Quick-tunnel URLs rotate on restart — use a named tunnel token for a fixed hostname.

## Long-running processes

Run dev servers/tunnels under tmux or `nohup` with a log; don't block a single foreground command. Treat multi-hour idle survival as test-before-relying (the VM can sleep); mobile-tunnel.sh includes a watchdog that restarts a dropped tunnel.

## Connecting & viewing (default behavior)

The user wants to *see and use* what's running, not just be told it started. When a
repo has any viewable surface, proactively bring it up, expose it, and report the
public URL plus exactly how to open it — then keep it running for them:

- **Web surfaces** (admin / marketing / design studio / email preview): start the dev server, `cloudflared tunnel --url http://localhost:<port>`, and give the `https://<...>.trycloudflare.com` URL to open in a browser.
- **Mobile**: run `.cursor/mobile-tunnel.sh` and give the Metro URL to paste into the EAS dev client ("Enter URL manually"), noting the API tunnel it talks to (`EXPO_PUBLIC_API_URL`). The device must already have the custom dev client installed.
- **APIs**: share the tunnel URL + a sample endpoint (e.g. `/api/v1/health`, `/docs`).
- **MCP servers** (HTTP/SSE): tunnel it and give the URL + how to point a client at it; for stdio, give the run command.

Keep these under tmux or `nohup` with the mobile-tunnel watchdog. Quick-tunnel URLs
are random and rotate on restart — offer a named Cloudflare tunnel (token) if the
user wants a fixed hostname. End the session by listing every live URL.

## Network

Keep "Allow all" egress. If locking down, the allowlist must include `*.trycloudflare.com` + `*.argotunnel.com` (cloudflared edge) plus `registry.npmjs.org`, `npm.pkg.github.com`, `ghcr.io`, `github.com`, `app.infisical.com`, `*.neon.tech`, `*.upstash.io`, and the AI/observability hosts.
