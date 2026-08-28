# Account registry

Identifiers, not secrets. Nothing here is sensitive on its own — every one of
these is visible to anyone already holding the matching credential — so this file
is checked in and readable without an Infisical round trip.

Credentials live in Infisical. See the `vendor-access` skill for how to read one
and how to scope a new one.

**Keep this current.** A wrong org slug fails with a message that reads like a
permissions problem, which is expensive to debug.

## Infisical projects

Six, each its own project with a machine identity in
`~/.config/bokendell/infisical.json`.

| Account | Covers |
|---|---|
| `bokendell` | workspace-level: hq, the mcp-gateway, observability |
| `golf` | the golf/Bagman app |
| `hive` | hive |
| `portfolio` | portfolio |
| `swarm` | the swarm CLI and API |
| `keepings` | keepings |

Layout inside each: `/apps/<app>`, `/infrastructure/<vendor>`, `/global`,
`/packages`. Vendor credentials go in `/infrastructure/<vendor>`, named for the
vendor and nothing else — the project already namespaces them, so no product
prefix.

## Fly.io — the slug is not the name

`--org` wants the slug. Passing the name fails with
`error getting organization: Could not find`.

| Name | Slug |
|---|---|
| bagman | `bagman-538` |
| hive | `hive-654` |
| portfolio | `portfolio-646` |
| swarm | `swarm-810` |

Token: `/infrastructure/fly` → `FLY_ORG_TOKEN`.

## Cloudflare — two accounts

| Account | ID |
|---|---|
| bokendell | `68d1d3c2007c97b6b380ccd3b1db73de` |
| bagman (`Admin@bagman.io`) | `b23508ceff6cb0ba5647e2cd568f41a7` |

Zone `bokendell.com`: `ea87cf52f80ba0f227dd8f2d46f73a5e`.

Token: `/infrastructure/cloudflare` → `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

Zero Trust team: `bokendell.cloudflareaccess.com` (renamed from `fiscax`; anything
still referencing the old name is stale).

## Sentry — two orgs

| Org | Products |
|---|---|
| `bagman` | golf |
| `bokendell` | hive, portfolio, swarm |

Token: `/infrastructure/sentry` → `SENTRY_AUTH_TOKEN`, with `SENTRY_ORG` and
per-app `SENTRY_PROJECT_*` / `SENTRY_DSN_*` alongside.

`sentry-cli` cannot query issues — use the REST API:
`GET /api/0/organizations/{org}/issues/?query=is:unresolved`.

## Grafana Cloud

| Stack | URL | OTLP region |
|---|---|---|
| bokendell | `https://bokendell.grafana.net` | `prod-us-central-0` |
| golf | *URL not recorded* — instance id `1729819` | `prod-us-east-3` |

`golf.grafana.net` is suspended; `keepings.grafana.net` does not exist.

Token: `/infrastructure/grafana` → `GRAFANA_URL` + `GRAFANA_SA_TOKEN`
(**Viewer** service account). bokendell currently has it as
`GRAFANA_SA_TOKEN_READONLY`; `GRAFANA_SA_TOKEN_MCP` on that stack is **Admin** and
can assign RBAC roles — do not use it from a session.

Cloud MCP is refused on the bokendell stack ("this Grafana instance does not have
Cloud MCP authorization enabled") despite Assistant being enabled, terms
accepted and `cloud-mcp:access` granted. Use the REST API.

## Langfuse — three projects, one host

`https://us.cloud.langfuse.com`. A key pair is scoped to **one project**; golf,
hive and portfolio are three separate projects and there is no key spanning them.

Token: `/infrastructure/langfuse` → `LANGFUSE_BASE_URL`, `LANGFUSE_PUBLIC_KEY`,
`LANGFUSE_SECRET_KEY`. The MCP endpoint takes HTTP Basic of `public:secret`.

## Resend — two accounts

| Account | Sending domain | Products |
|---|---|---|
| bagman | `bagman.io` | golf |
| bokendell | `bokendell.com` | hive, portfolio, swarm — different keys, same account |

Token: `/infrastructure/resend` → `RESEND_API_KEY`. Keepings has an entry but it
is empty in every environment; it does not use Resend yet.

## MCP

One connector: **`https://mcp.bokendell.com/oura`**. Everything else is a skill —
see `docs/access-map.md` in the mcp-gateway repo for why.

The gateway is a Cloudflare Worker on the bokendell account, KV namespace
`09c4e00b6d3b49d4823a3f5eb9925cc4`, behind Cloudflare Access on `/authorize` and
`/public`. Its own secrets are in `bokendell` `/apps/mcp-gateway`.
