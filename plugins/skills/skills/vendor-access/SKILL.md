---
name: vendor-access
description: How to reach every third-party service in this workspace — Cloudflare, Fly, Sentry, Grafana, Langfuse, Resend, Neon, Infisical — from a session. Which CLI or API to use for each, the exact account and org identifiers, which Infisical path holds the credential, what permissions to scope a token to, and how to run every one of them headless in a cloud agent. Use whenever a task needs a vendor's data or a vendor's credential, or when creating or scoping a token.
---

# Reaching the vendors

Everything here runs from a shell with a token read from Infisical at call time.
There is no MCP connector for any of it — see "Why not MCP" at the end.

**Every command below must work headless.** Cloud agents have no browser and no
TTY: never run an interactive login (`wrangler login`, `fly auth login`,
`gh auth login`, `infisical login` without `--method`), never rely on a cached
session, and pass credentials by environment variable or flag.

## Getting any credential

The machine identity is the only thing that has to exist on the box. Never ask a
human to run `infisical login`; the CLI is always unauthenticated.

```bash
CFG=~/.config/bokendell/infisical.json
ACCT=bokendell   # golf | keepings | swarm | hive | portfolio | bokendell
read -r CID CSEC PID < <(python3 -c "
import json; a=json.load(open('$CFG'))['accounts']['$ACCT']
print(a['clientId'], a['clientSecret'], a['projectId'])")
TOKEN=$(infisical login --method=universal-auth --client-id="$CID" --client-secret="$CSEC" --plain --silent)

INFISICAL_TOKEN="$TOKEN" infisical secrets get <NAME> \
  --projectId="$PID" --path=<PATH> --env=production --plain --silent
```

`--projectId` is required outside a repo with `.infisical.json`. Environments are
`development` / `staging` / `production`. Never echo a secret into output, a
file, or a commit.

**`bokendell` is the account for anything workspace-level.** Product credentials
live in that product's own project.

## The map

Credentials live at **`/infrastructure/<vendor>`** in the Infisical project that
owns them, named for the vendor and nothing else. The project already namespaces
them, so there is no product prefix: `golf` `/infrastructure/fly` `FLY_ORG_TOKEN`
says everything.

| Vendor | Use | Secret name |
|---|---|---|
| **Cloudflare** | `wrangler` for Workers/KV/R2/D1, REST for the rest | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| **Fly** | `flyctl` | `FLY_ORG_TOKEN` |
| **Sentry** | **REST** — `sentry-cli` cannot query issues | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` |
| **Grafana** | **REST** — no first-party query CLI | `GRAFANA_URL`, `GRAFANA_SA_TOKEN` (Viewer) |
| **Langfuse** | CLI or REST | `LANGFUSE_{BASE_URL,PUBLIC_KEY,SECRET_KEY}` |
| **Resend** | `resend-cli` | `RESEND_API_KEY` |
| **Neon** | `neonctl` | `NEON_API_KEY` |
| **GitHub** | `gh` | `GITHUB_TOKEN` from the environment |

Skills for most of these are installed from the vendors' own repos:
`cloudflare/skills`, `getsentry/skills`, `grafana/skills`, `langfuse/skills`,
`resend/resend-skills`. Prefer them over improvising against the API.

## Identifiers

**They live in `registry.md`, next to this file.** Read it rather than guessing:
Fly org slugs, Cloudflare account and zone ids, Sentry orgs, Grafana stacks, the
three Langfuse projects, the two Resend accounts, and which Infisical project
owns each.

It sits here rather than in the workspace root because this marketplace is
installed at user scope and auto-updates, so it is present in every worktree and
every cloud agent — a workspace file would be missing exactly where an agent
needs it most. Other playbooks should reference this same path.

Nothing in it is secret. Identifiers are visible to anyone already holding the
matching credential, which is why it is a plain checked-in file and not an
Infisical round trip.

## Scoping tokens

Mint the narrowest token for the job and let it expire. Defaults are dangerous:
Fly's read-only tokens default to **twenty years**, and Cloudflare's templates
grant far more than their names suggest.

```bash
fly tokens create readonly --org bagman-538 --name "<what for>" --expiry 8760h
fly tokens create deploy   -a  bagman-api   --name "<what for>" --expiry 720h
```

**Cloudflare: build a Custom token, never a template.** Account scope, Read only:
Workers Scripts, Workers KV Storage, Workers R2 Storage, Workers Observability,
Workers Tail, D1, Queues, Hyperdrive, AI Gateway, Account Analytics, Account
Settings. Zone scope, Read: Zone, DNS, Analytics.

Never grant a session token `Workers Scripts: Edit`, `DNS: Edit`,
`Access: Apps and Policies: Edit`, or `API Tokens: Edit`. Those run and protect
the infrastructure, and a token holding them can rewrite the thing holding it.

**Verify before trusting a token.** A `403` means denied; anything else means the
permission is present and only the payload was rejected:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/workers/scripts/probe" \
  -H "Authorization: Bearer <TOKEN>" -H 'content-type: application/json' -d '{}'
```

**Grafana:** use a **Viewer** service account, not Admin. An Admin service
account can assign RBAC roles, which is escalation from something meant to read
dashboards.

**Sentry:** `org:read` unless something genuinely has to write.

**Resend:** a sending-only key where the job only sends.

## Headless notes per tool

- **wrangler** — `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the
  environment. Never `wrangler login`. Add `--yes` to `deploy`; `secret put`
  reads the value from stdin, so pipe it rather than typing it.
- **flyctl** — `FLY_API_TOKEN`, or `-t <token>`. `fly apps destroy` and
  `fly deploy` both need `--yes`. `fly secrets set --stage` does nothing until a
  deploy; without `--stage` it restarts the machines itself.
- **gh** — `GITHUB_TOKEN` in the environment. No `gh auth login`.
- **infisical** — always `--method=universal-auth` with the machine identity.
- **resend-cli** — `RESEND_API_KEY` in the environment. See
  <https://resend.com/docs/cli-agents> for the agent-oriented usage.
- **sentry / grafana / langfuse** — plain `curl` with a bearer. Nothing
  interactive to avoid.

## Sending email

We send with **React Email** rendered through Resend. Use the
`resend/resend-skills` skills — `react-email` for the templates,
`resend` / `resend-cli` for delivery, `email-best-practices` for the rest.

## Why not MCP

A connector's tool schema is sent on **every request**, used or not: Resend is 99
tools and roughly 33k tokens, Langfuse 84 and 21k across three projects,
Cloudflare around 2,500 API endpoints. A skill costs nothing until it is called.

Four MCP integrations were attempted in this workspace and four failed in their
own way — a vendor gate above the stack, a wrapper that framed SSE wrongly and
isolated no sessions, an image that silently ignored its auth token, and an
undocumented per-stack authorization server. `curl` against the same vendors
worked first time, every time.

The one exception is `oura`, which has no CLI and no third-party API, and is
served from the gateway at `mcp.bokendell.com/oura`.
