---
name: fly-ops
description: Operating Fly.io from a session — apps, machines, logs, secrets, deploys, certs and volumes across the bagman, hive, portfolio and swarm orgs. Covers getting a scoped token out of Infisical rather than relying on an ambient login, which token scope to use for which job, and why flyctl is driven through its CLI here rather than through an MCP server. Use for any Fly.io question: deploying, restarting, reading logs, suspended machines, IPs, certificates, or "why is the app 502ing".
---

# Fly.io operations

flyctl is a CLI, and that is how it is driven here. There is an experimental
`fly mcp` server too — read "Why not the MCP server" below before reaching for it.

## The orgs

Four, and the **slug is not the name**. `--org` wants the slug; passing the name
fails with `error getting organization: Could not find`.

| Name | Slug | Apps |
|---|---|---|
| bagman | `bagman-538` | `bagman-api`, `bagman-admin`, `bagman-workers`, `bagman-design`, `bagman-marketing` (+ `-stage`) |
| hive | `hive-654` | `hive-api`, `hive-app-production`, `hive-workers` |
| portfolio | `portfolio-646` | `portfolio-api-production`, `portfolio-app-production`, `portfolio-admin`, `portfolio-workers` |
| swarm | `swarm-810` | `swarm-api-production`, `swarm-design` |

`fly orgs list` prints both columns when in doubt.

## Tokens: scope deliberately, every time

An ambient `fly auth` login carries your full account. That is fine at a keyboard
and wrong for anything autonomous. Mint the narrowest token for the job and pass
it with `-t`, or export `FLY_API_TOKEN`.

```bash
fly tokens create readonly --org bagman-538 --name "<what for>" --expiry 8760h
fly tokens create deploy   -a bagman-api    --name "<what for>" --expiry 720h
fly tokens create org      --org bagman-538 --name "<what for>" --expiry 720h
```

- **readonly** — status, logs, lists. Cannot deploy or destroy. Default choice.
- **deploy -a APP** — one app. Right for CI and for a task scoped to one service.
- **org** — everything in the org. Only when a human is watching.

The default expiry on `readonly` is twenty years. Always pass `--expiry`.

### Reading a token from Infisical

Never ask for `infisical login`; the CLI is always unauthenticated. Use the
machine identity, and pick the account whose project owns the secret.

```bash
CFG=~/.config/bokendell/infisical.json; ACCT=bokendell   # or golf / hive / ...
read -r CID CSEC PID < <(python3 -c "
import json; a=json.load(open('$CFG'))['accounts']['$ACCT']
print(a['clientId'], a['clientSecret'], a['projectId'])")
TOK=$(infisical login --method=universal-auth --client-id="$CID" --client-secret="$CSEC" --plain --silent)
FLY_API_TOKEN=$(INFISICAL_TOKEN="$TOK" infisical secrets get FLY_API_TOKEN \
  --projectId="$PID" --path=/infrastructure/fly --env=production --plain --silent)
```

Never echo a token into output, a file or a commit.

## The commands that matter

```bash
fly status -a APP                  # deployment, machines, health at a glance
fly logs -a APP --no-tail          # recent logs; drop --no-tail to follow
fly machine list -a APP
fly machine status <id> -a APP     # state, command, event log
fly secrets list -a APP            # names and digests only, never values
fly secrets set K=V -a APP         # triggers a deploy unless --stage
fly deploy -a APP --image IMG --yes
fly ips list -a APP
fly config show -a APP             # the app config as Fly holds it
fly config save -a APP             # write it to a local fly.toml
```

## Things that will cost an hour if you do not know them

**Secrets set with `--stage` do nothing until a deploy.** `fly secrets set` alone
restarts machines and applies; with `--stage` it says "staged, but not set on
VMs" and the old value keeps running. Read that line.

**App config and machine config drift.** `fly config show` can declare an
`http_service` while `fly machine status --json` reports `services: null`. The
Fly proxy then has nothing to route to and the edge answers 502 with the app
looking healthy. `fly deploy` reconciles them; it is a no-op when they agree.

**`.fly.dev` DNS caches hard.** Destroy and recreate an app and your resolver may
hold the old shared IPv4 for a while — connections fail or land on a stranger's
app. Verify with `fly ips list -a APP`, then
`curl --resolve APP.fly.dev:443:<ip>` to bypass the cache.

**Suspended is normal.** `auto_stop_machines = "suspend"` means most apps sit
suspended and wake on the first request. A cold request can take seconds; a
timeout on the first try is not necessarily a fault.

**Public and custom hostnames share one door.** `.fly.dev` and any custom domain
resolve to the same public ingress IPs. Releasing the IPs removes both. There is
no way to keep a custom domain public while making `.fly.dev` unreachable — for
that you want no public IP at all (`fly ips allocate-v6 --private`, `--flycast`)
plus a tunnel.

## Why not the MCP server

`fly mcp launch` hosts a stdio MCP server on Fly and `fly mcp server` runs one
locally. Both are marked experimental, and as of August 2026 the hosted HTTP
transport is not usable by a conformant client:

- it returns `content-type: text/event-stream` and then writes bare JSON lines
  with no `data:` framing, so the stream cannot be parsed — a client connects and
  reports no tools;
- it issues no `Mcp-Session-Id` and delivers replies to whichever GET stream is
  open, so two clients receive each other's responses.

The CLI has none of those problems, is already installed, and takes a scoped
token. Use it. Revisit when `fly mcp wrap` frames SSE properly and isolates
sessions.

## Deploys belong to CI

`.github/workflows/` in each repo calls the org's reusable workflows for real
deploys. Deploying by hand from a session is for breaking glass, not for
shipping — and if you do, say so plainly in the summary.
