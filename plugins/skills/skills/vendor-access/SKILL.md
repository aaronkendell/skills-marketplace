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

## Identifiers live beside the credential

There is no registry file and no per-repo list. **The identifier is a secret in
the same `/infrastructure/<vendor>` folder as the token it belongs to**, so one
read gets both and the two cannot drift.

| Vendor | Token | Identifier beside it |
|---|---|---|
| Fly | `FLY_ORG_TOKEN` | `FLY_ORG_SLUG` — the slug, **not** the name |
| Sentry | `SENTRY_READ_TOKEN` (queries) · `SENTRY_AUTH_TOKEN` (CI) | `SENTRY_ORG`, `SENTRY_PROJECT_*` |
| Cloudflare | `CLOUDFLARE_API_TOKEN` | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID` |
| Grafana | `GRAFANA_SA_TOKEN` (Viewer) | `GRAFANA_URL` |
| Langfuse | `LANGFUSE_SECRET_KEY` | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASE_URL` |
| Resend | `RESEND_API_KEY` | — |
| Inngest | `INNGEST_API_KEY` (`sk-inn-api-`) | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` | — |
| Upstash | `UPSTASH_REDIS_REST_TOKEN` | `UPSTASH_REDIS_REST_URL`, `REDIS_URL` |
| Neon | `NEON_API_KEY` (`napi_`, project-scoped) | `NEON_PROJECT_ID` |
| PostHog | `POSTHOG_PERSONAL_API_KEY` | `POSTHOG_HOST`, `POSTHOG_PROJECT_ID` |
| RevenueCat | `REVENUECAT_API_KEY` (v1 `sk_`) | `REVENUECAT_PROJECT_ID` |

So the shape of every lookup is the same:

```bash
GRAFANA_URL=$(fetch /infrastructure/grafana GRAFANA_URL)
GRAFANA_SA_TOKEN=$(fetch /infrastructure/grafana GRAFANA_SA_TOKEN)
curl -s "$GRAFANA_URL/api/search?limit=1" -H "Authorization: Bearer $GRAFANA_SA_TOKEN"
```

Read the identifier; never hardcode or guess one. A wrong Fly org slug fails with
`error getting organization: Could not find`, which reads like a permissions
problem and is not.

**Which Infisical project?** The one named for the app you are working in —
`golf`, `hive`, `portfolio`, `swarm`, `keepings` — or `bokendell` for anything
workspace-level. Products do not share credentials even when they share an
account: hive, portfolio and swarm all use the `bokendell` Sentry org and the
`bokendell.grafana.net` stack, but each holds its own token, so one can be
revoked without touching the others.

### Two Sentry tokens, and they are not interchangeable

- `SENTRY_AUTH_TOKEN` — CI: releases, source maps, deploys. **Cannot read
  issues**; it returns 403.
- `SENTRY_READ_TOKEN` — `org:read`, `project:read`, `event:read`. This is the one
  for querying.

`sentry-cli` has no issue-query command at all. Use the REST API:

```bash
curl -s "https://sentry.io/api/0/organizations/$SENTRY_ORG/issues/?query=is:unresolved" \
  -H "Authorization: Bearer $SENTRY_READ_TOKEN"
```

### Inngest — the CLI covers the whole Cloud MCP surface

`npx inngest-cli@latest api` reaches run debugging, event-run lookup, traces,
invocation, app syncs, webhooks, environments, keys and Insights — everything the
Cloud MCP exposes. Add `--prod` to target Cloud rather than a local dev server.

```bash
INNGEST_API_KEY=$(fetch /infrastructure/inngest INNGEST_API_KEY)
npx inngest-cli@latest api --prod --api-key "$INNGEST_API_KEY" get-account
npx inngest-cli@latest api --prod --api-key "$INNGEST_API_KEY" get-account-envs
```

Keys are scoped per org **and** per environment, so read the one for the
environment you are targeting. `INNGEST_API_KEY` starts `sk-inn-api-`; the
signing and event keys are different things and are not accepted here.

Several operations mutate — sending events, invoking functions, rerunning or
cancelling runs, syncing apps, patching environments. Say what you are about to
do before doing it against production.

### Neon keys are project-scoped

`napi_` keys reject anything outside their project by design, so
`GET /api/v2/projects` returns 404 and `GET /api/v2/projects/$NEON_PROJECT_ID`
returns 200. That is correct behaviour, not a broken key — read
`NEON_PROJECT_ID` and address the project directly, or use `neonctl`.

### RevenueCat has two kinds of key, and they are not interchangeable

`REVENUECAT_API_KEY` here is a **v1 secret SDK key** (`sk_…`). It does not work
against the v2 project-management API, which is what the `rc` CLI and the MCP
server both use — v2 endpoints answer 403 with it.

For `rc`, mint a **v2 API key** in the RevenueCat dashboard (Project Settings →
API keys → v2), store it as `REVENUECAT_V2_API_KEY`, and pass it as `RC_API_KEY`
or `--api-key`. Never `rc auth login`, which is browser OAuth:

```bash
RC_API_KEY=$(fetch /infrastructure/revenuecat REVENUECAT_V2_API_KEY) \
  npx @revenuecat/cli projects list
```

### Grafana tokens are per app and per environment

Named `<app>-<env>-readonly`, Viewer role — reads answer 200, writes answer 403.
Never use an Admin service account from a session: an Admin one can assign RBAC
roles, which is escalation from something meant to read dashboards.

Only golf has a `staging` environment; it is the only product with stage infra.

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

## Verified working

Every one of these was exercised against the live vendor with the Infisical
credential, production environment, on 2026-08-28:

| Vendor | golf | hive | portfolio | swarm | keepings | bokendell |
|---|---|---|---|---|---|---|
| Sentry (issues) | 200 | 200 | 200 | 200 | — | 200 |
| Grafana (search) | 200 | 200 | 200 | 200 | — | 200 |
| Resend (domains) | 200 | 200 | 200 | 200 | — | — |
| Langfuse (projects) | 200 | 200 | 200 | — | — | — |
| Fly (apps list) | ok | ok | ok | ok | — | — |
| Cloudflare (workers) | 403* | 200 | 200 | 200 | — | 200 |
| Inngest (account) | 200 | 200 | 200 | — | 200 | — |
| OpenRouter (key) | 200 | 200 | 200 | — | 200 | 200 |
| Upstash (redis ping) | 200 | 200 | 200 | 200 | 200 | — |
| OTLP push | 200 | 200 | 200 | 200 | — | 200 |

`*` golf's Cloudflare token is scoped to R2/Pages and cannot list Workers. Not a
fault unless golf needs Workers.

A dash means the credential is absent, which is usually correct — swarm has no
Langfuse project, keepings sends no email, bokendell runs no Fly apps.

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

## Enumerating secrets without leaking them

`infisical secrets` with **no output flag renders a table with every value in plaintext**.
Never run it bare in a session whose transcript you would not want to hold credentials.
There is no `--json` flag (that errors with `unknown flag: --json` on 0.43.x); the flag is
`-o/--output`:

```bash
# names only — the safe default for "what is in this folder?"
INFISICAL_TOKEN="$TOK" infisical secrets \
  --projectId="$PID" --path=/infrastructure/<vendor> --env=production \
  -o json --silent | jq -r '.[].secretKey'

# which /infrastructure folders exist at all
INFISICAL_TOKEN="$TOK" infisical secrets folders get \
  --projectId="$PID" --path=/infrastructure --env=production -o json --silent

# one known value, when you actually need it (never echo it)
INFISICAL_TOKEN="$TOK" infisical secrets get NAME \
  --projectId="$PID" --path=/infrastructure/<vendor> --env=production --plain --silent
```

The `-o json` shape is `[{ "secretKey": ..., "secretValue": ... }]`, so `.[].secretKey` is
the names-only projection. `--recursive` walks sub-folders when you want the whole tree.

**Environment slugs differ by interface**: the REST API wants `environment=production`, the
CLI wants `--env=prod` in some versions and `--env=production` in others — check with a
folder listing before assuming an empty result means "no secrets".

## Which Fly token to use

`/infrastructure/fly` holds four keys, and they are not interchangeable:

| Key | Use |
|---|---|
| `FLY_API_TOKEN` | **the default** — org deploy token, and the name every swarm surface reads (composition env, deploy adapter, fly client, runner controller) |
| `FLY_CICD_ORG_TOKEN` | CI's token. Leave it to CI; revoking it breaks deploys |
| `FLY_ORG_TOKEN` | the older org token, kept for compatibility |
| `FLY_ORG_SLUG` | not a credential — the `--org` argument. Note flyctl reports this value as the org *name* and a shorter string as the slug; both are accepted by `--org` |

For any read-only query (`fly apps list`, `fly status`, `fly logs`) use `FLY_API_TOKEN`.

## Five things a live audit had to guess (fixed here 2026-08-28)

**1. The `fetch` helper this skill keeps calling.** Examples below say `fetch <path> <NAME>`
but never defined it. It is:

```bash
fetch() {  # fetch /infrastructure/<vendor> SECRET_NAME  -> value on stdout, nothing logged
  INFISICAL_TOKEN="$TOK" infisical secrets get "$2" \
    --projectId="$PID" --path="$1" --env="${INFISICAL_ENV:-production}" --plain --silent
}
```

**2. Folder listing returns `folderName`, not `name`.** `secrets folders get -o json` yields
objects keyed `folderId`, `folderName`, `folderPath` — `jq -r '.[].name'` gives a column of
nulls:

```bash
INFISICAL_TOKEN="$TOK" infisical secrets folders get \
  --projectId="$PID" --path=/infrastructure --env=production -o json --silent \
  | jq -r '.[].folderName'
```

**3. Neon: use the REST API, not `neonctl`.** The CLI is not present in every environment
(absent from Claude cloud sessions before toolchain v3.7). REST always works:

```bash
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID"      # 200
```
Listing all projects 404s by design — these keys are project-scoped.

**4. Sentry has two tokens and the map row names the wrong one.** For *reading* issues use
**`SENTRY_READ_TOKEN`**. `SENTRY_AUTH_TOKEN` is the CI token for releases and sourcemaps and
returns **403** on the issues endpoint — that 403 is the control proving the two are not
interchangeable, not a fault.

**5. Grafana 503s on first contact.** Two consecutive 503s followed by clean 200s is normal
edge behaviour, not a credential problem. **Retry up to three times before concluding
anything**; a single-shot probe will mis-report a healthy stack as down:

```bash
for i in 1 2 3; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $GRAFANA_SA_TOKEN" \
    "$GRAFANA_URL/api/search?limit=1")
  [ "$code" = "503" ] || break
  sleep 2
done
echo "$code"
```
