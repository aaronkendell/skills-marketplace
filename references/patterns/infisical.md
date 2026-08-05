# Infisical + vendor tenancy

How secrets are laid out, how references are written, and which vendors get
their own tenant per app. This is the contract the `app-provision` skill
follows and what `swarm secrets verify` checks.

---

## Where credentials live

`~/.config/bokendell/infisical.json` — one machine identity per project:

```json
{
  "accounts": {
    "golf":      { "clientId": "…", "clientSecret": "…", "projectId": "…" },
    "keepings":  { … }, "portfolio": { … }, "hive": { … }, "swarm": { … },
    "bokendell": { … }
  }
}
```

`bokendell` is the **control plane** — it holds only credentials that *create*
things. Every other entry is an app project holding only credentials the app
*uses*. That split is the privilege boundary; the folder names are identical on
both sides so there is one mental model, not two.

In CI the same identity arrives via OIDC, selected by the repo variables
`INFISICAL_IDENTITY_ID` and `INFISICAL_PROJECT_SLUG`. Never hardcode a fallback
identity in a workflow — a shared default silently authenticates one app into
another app's project, and nothing errors.

---

## Folder layout

```
/global                       APP_ENV, APP_NAMESPACE, APP_DOMAIN
/apps/<surface>               what that surface reads (api, admin, app, mobile, workers, …)
/packages/<pkg>               package-scoped config (db, e2e, …)
/infrastructure/<vendor>      one folder per vendor — cloudflare, neon, fly, sentry,
                              grafana, upstash, resend, inngest, openrouter,
                              posthog, langfuse, expo, apple, turbo, github,
                              github/actions, betterauth, infisical, revenuecat
```

Flat. No `/apps/<app>/…` nesting — the project *is* the app. No `/bootstrap/…`
subfolder — the project already tells you whether a credential is admin or
runtime.

---

## What goes in the vendor folder vs the app path

**Vendor-issued facts centralize. Values you derive or tune stay put.**

A Sentry DSN is issued by Sentry, opaque, and rotated there, so it lives in
`/infrastructure/sentry` keyed by surface — `SENTRY_DSN_API`,
`SENTRY_PROJECT_ADMIN`. One folder holds the whole Sentry footprint, so adding
a project or rotating a DSN is a single-folder edit.

`OTEL_SERVICE_NAME` is `${APP_NAMESPACE}-<role>` — derived from a global plus
the role its own path already names, with no vendor account behind it.
Centralizing it would spell the app name twice for no rotation benefit. Same
for `OTEL_NODE_ENABLED_INSTRUMENTATIONS`, `BETTER_AUTH_BASE_URL`,
`INNGEST_BASE_URL`: per-service knobs, not credentials.

Naming: the vendor folder holds **vendor-named** keys, apps hold the
**standard** names as references.

```
/infrastructure/grafana   GRAFANA_OTLP_ENDPOINT, GRAFANA_OTLP_AUTH_HEADER
/apps/api                 OTEL_EXPORTER_OTLP_ENDPOINT = ${…grafana.GRAFANA_OTLP_ENDPOINT}
```

---

## Reference shape

```
${<env>.<path.with.dots>.<KEY>}      ${production.infrastructure.resend.RESEND_API_KEY}
${KEY}                              same folder, same environment
```

The environment is part of the reference, so each environment stays independent
even where the value happens to match today. Never point a `development`
reference at `production`.

**References cannot cross projects.** Anything shared between apps — a Turbo
token, a GitHub packages token — is a *copy* in each project, not a reference.

### The failure mode this exists to prevent

A dangling reference resolves to an **empty string**. The UI shows the
reference, the app boots, and the secret is `""`. Nothing errors. Real examples
from this codebase:

- `BETTER_AUTH_SECRET` → `/infrastructure/auth`, but the folder is `betterauth`.
  Production only survived because Fly held the old value; the next deploy
  would have shipped an empty auth secret.
- Every OTLP exporter pointing at a collector that had been decommissioned.
- Three apps resolving to one Redis URL.

So: **after any secret change, verify every `${…}` expands non-empty.** Ask for
the same secrets twice — `expandSecretReferences=true` and `false` — and diff.
That check is the whole reason the layout is worth enforcing.

---

## Vendor tenancy: split or share

**Split what's free per tenant. Share what's billed per tenant, isolating by
project within it.** Promote a shared vendor to its own tenant when the app has
users or revenue, or before a transfer conversation.

| Vendor | Model | Per app? |
|---|---|---|
| Cloudflare, Fly, Neon, Infisical, Upstash | free per tenant | **own account/org** |
| Resend | free = **1 domain** | **own account** (see email note) |
| PostHog | free = **1 project per org** | **own org** while free; PAYG allows 6 |
| Sentry, Grafana, Langfuse, Inngest, Expo, RevenueCat | billed per tenant | share, separate project/stack/workspace |
| OpenRouter | one account | **workspace** per app + provisioning key per env |

### Transferring out later

Start in a shared tenant, promote when the app is real:

| | Transfer? |
|---|---|
| Neon | ✓ console + API — **connection string unchanged** |
| Fly | ✓ `fly apps move -o <org>` |
| Cloudflare | ✓ zone move between accounts (registrar lock applies) |
| Infisical | ✗ no transfer — recreate by script |

### Vendors needing a distinct signup email

Free tiers that are one-per-*account* rather than one-per-org force a second
account, which forces a second email:

- **Resend** — 1 domain per free account. Confirmed.
- **Grafana Cloud** — a second stack generally means a second org. Check at signup.
- **Infisical** — free is 3 projects per org. Check whether your plan allows a
  second org on the same login before assuming.

Use **Cloudflare Email Routing** (free, catch-all) rather than paying for
mailboxes: `resend@<app-domain>` → your real inbox. Prefer distinct local parts
over `+` addressing — some vendors reject `+`.

---

## Bootstrap capability by vendor

What a provisioning run can actually do unattended:

| Vendor | Create tenant/project | Create credentials |
|---|---|---|
| Cloudflare | zones, DNS, R2, tunnels, tokens | ✓ |
| Infisical | projects, envs, folders, identities | ✓ |
| Neon | projects, branches, roles, scoped keys | ✓ |
| Fly | orgs, apps, deploy tokens | ✓ |
| Sentry | projects + DSN keys | ✓ |
| Upstash | databases, move-to-team | ✓ |
| Resend | domains, API keys | ✓ |
| PostHog | projects via org API | ✓ |
| OpenRouter | workspaces, provisioning keys w/ spend caps | ✓ |
| Grafana Cloud | stacks, access policies | ✓ (needs `accesspolicies:write`) |
| RevenueCat | apps/products/entitlements — **not projects** | dashboard |
| Expo | `eas init` | partial |
| Inngest | ✗ dashboard only | ✗ |
| Langfuse Cloud | ✗ admin API is Enterprise self-host only | ✗ |

Inngest and Langfuse have no provisioning API, RevenueCat can't create
projects, and Expo is a CLI init — so a new app **always** has manual steps. A
provisioning run should do the ten it can and print a checklist for the rest,
rather than pretending to be unattended.

---

## Verifying credentials

Storing a credential proves nothing. In one audit of this workspace, four
"present" secrets were dead and two more were scoped to the wrong tenant — all
invisible until probed. Check read-only before relying on any of them:

| Vendor | Probe | Confirms |
|---|---|---|
| Sentry | `GET /api/0/organizations/` | which orgs the token reaches |
| Grafana | `GET /api/v1/accesspolicies?region=` | scopes are echoed in the 401 body |
| Fly | GraphQL `{ organizations { nodes { slug } } apps { nodes { name } } }` | org + app reach |
| Neon | `GET /api/v2/projects` | project visibility |
| Cloudflare | `GET /user/tokens/verify` | token status |
| OpenRouter | `GET /api/v1/key` | spend limit + usage |
| Resend | `GET /domains` | which domain the account owns |
| PostHog | `GET /api/organizations/` | org scope |
| Upstash | `GET <rest-url>/ping` | database reachable |
| Langfuse | `GET /api/public/projects` (basic pk:sk) | project binding |

**A token that authenticates is not a token that is scoped correctly.** Assert
on what it can *see* — the org slug, the project name, the domain — not on the
status code. Two of the failures above returned a healthy 200 to a naive check
and were pointed at the wrong tenant entirely.
