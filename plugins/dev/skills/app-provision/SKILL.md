---
name: app-provision
description: Provision a new app across Cloudflare, Infisical, Neon, Fly, Sentry, Grafana, Upstash and the rest — decide which vendors it needs, create what's scriptable, and print the manual checklist
---

# App Provisioning

Stand up a new app's infrastructure and wire it into Infisical.

Ten of the fourteen vendors can be created via API; Inngest, Langfuse Cloud,
RevenueCat projects and Expo cannot. **A provisioning run is never
unattended** — do what's scriptable, then hand over an explicit checklist.
Don't build toward full automation; the human is always in the loop.

Layout rules, reference syntax and the split-vs-share table live in
`references/patterns/infisical.md`. Read it before writing any secret.

---

## 0. Decide which vendors this app actually needs

Most apps need fewer than half the list. Ask before provisioning:

| Vendor | Include when |
|---|---|
| Infisical, Cloudflare, Fly, Neon | always — secrets, DNS, hosting, database |
| Upstash | there's caching, rate limiting, or a queue |
| Sentry, Grafana | always — errors and telemetry |
| Resend | the app sends email |
| Inngest | there are crons or async workflows |
| OpenRouter, Langfuse | there's LLM work (Langfuse only if you need tracing) |
| PostHog | there's a product surface worth measuring |
| Expo, RevenueCat, Apple | there's a mobile app / paid subscriptions |
| Turbo, GitHub | always — CI |

Also decide **new vs reuse** per vendor. Free-per-tenant vendors get their own
account; billed-per-tenant vendors share and isolate by project. See the
tenancy table in the pattern doc — don't re-derive it here.

---

## 1. Credentials this skill needs

Infisical machine identities: `~/.config/bokendell/infisical.json`, keyed by
project, with `bokendell` as the control plane. Everything below lives in
**bokendell**, since these create resources rather than serve traffic.

| Vendor | Secret | Scopes | Path |
|---|---|---|---|
| Cloudflare | `CLOUDFLARE_API_TOKEN` | Zone:Edit, DNS:Edit, R2:Edit, Tunnel:Edit, Account:Read | `/infrastructure/cloudflare` |
| Neon | `NEON_API_KEY` | org-scoped | `/infrastructure/neon` |
| Fly | `FLY_ORG_TOKEN` | org admin | `/infrastructure/fly` |
| Sentry | `SENTRY_BOOTSTRAP_TOKEN` | `project:admin`, `org:read` | `/infrastructure/sentry` (one per Sentry org — a promoted app holds its own) |
| Grafana | `GRAFANA_CLOUD_ACCESS_TOKEN` | `accesspolicies:write`, `stacks:write` | `/infrastructure/grafana` |
| Upstash | `UPSTASH_MANAGEMENT_KEY` | account | `/infrastructure/upstash` |
| PostHog | `POSTHOG_PERSONAL_API_KEY` | `organization:write`, `project:write` | `/infrastructure/posthog` |
| OpenRouter | `OPENROUTER_PROVISIONING_KEY` | key management | `/infrastructure/openrouter` |
| Resend | `RESEND_API_KEY` | full, **per account** | `/infrastructure/resend` |
| GitHub | `GITHUB_PACKAGES_TOKEN` | `repo`, `workflow`, `admin:org` | `/infrastructure/github` |

**Grafana is already covered.** `GRAFANA_BOOTSTRAP_TOKEN` carries
`accesspolicies:write` + `stacks:write` on the bokendell stack, so per-app,
per-environment OTLP tokens can be minted directly:

```
POST https://grafana.com/api/v1/accesspolicies?region=prod-us-west-0
  { name, realms: [{ type: "stack", identifier: "<stack-id>" }],
    scopes: ["metrics:write", "logs:write", "traces:write"] }
POST /api/v1/accesspolicies/<id>/tokens        → the token value
```

Don't confuse it with `GRAFANA_STACK_ADMIN_TOKEN`, which is *inside*-stack
scoped (service accounts, datasources) and 401s on access policies. Each
Grafana stack needs its own bootstrap token — the bokendell one has no reach
into golf's separate stack.

**Known gaps** — create these before a first real run:

- `CLOUDFLARE_API_TOKEN` — bokendell has none; the old one belonged to the
  shared pre-split account. Per-app tokens exist and are live.
- `NEON_API_KEY` — org keys were revoked in favour of project-scoped ones, so
  the control plane can't create *new* projects. The copy in
  `/infrastructure/github/actions` is **dead (401)**.
- `SENTRY_BOOTSTRAP_TOKEN` — authenticates but resolves **zero organizations**,
  so it can't create projects. Needs reissuing with `org:read` +
  `project:admin` on the target org.
- `UPSTASH_MANAGEMENT_KEY`, `OPENROUTER_PROVISIONING_KEY` — not yet created.

If a token is missing, say so and stop for that vendor. Never fall back to
another app's credential.

### Verify before trusting

Every one of these is a live API call away from being checked, and several
"present" credentials turned out dead. Probe read-only before a run: Sentry
`GET /api/0/organizations/`, Grafana `GET /api/v1/accesspolicies`, Fly GraphQL
`{ organizations { nodes { slug } } }`, Neon `GET /api/v2/projects`, Cloudflare
`GET /user/tokens/verify`, OpenRouter `GET /api/v1/key`, Resend `GET /domains`,
PostHog `GET /api/organizations/`, Upstash `GET <rest-url>/ping`, Langfuse
`GET /api/public/projects`.

A token that authenticates is not a token that is *scoped correctly* — check
what it can see, not just that it returns 200.

---

## 2. Sequence

Order matters: Infisical first so everything downstream has somewhere to land,
DNS last so nothing points at an app that isn't up.

1. **Infisical** — create the project, `development`/`stage`/`production`,
   `/global` (`APP_ENV`, `APP_NAMESPACE`, `APP_DOMAIN`), and a machine
   identity. Add it to `~/.config/bokendell/infisical.json`.
2. **Neon** — project, then a `stage` branch off production. Write
   `NEON_PROJECT_ID` and a project-scoped key per environment into
   `/infrastructure/neon`; the branch connection string is the env's
   `DATABASE_URL`.
3. **Fly** — org (if splitting), then one app per environment
   (`<app>-production`). Mint a **deploy token per app**
   (`fly tokens create deploy -a <app>-<env>`) — that splits by environment for
   free and beats an org token on least privilege.
4. **Upstash** — one database per environment, moved to the app's team. Create
   as **pay-as-you-go with a $20 budget**: `POST /v2/redis/database` with
   `{plan: "payg", budget: 20, tls: true}`, then `POST /v2/redis/move-to-team`
   with `{team_id, database_id}`. Never share a database across apps; key
   collisions are silent, and three apps here were found sharing one.

   **Gotcha:** `GET /v2/redis/databases` lists only *personal* databases. Once a
   database is moved to a team it vanishes from that endpoint, and `?team_id=`
   doesn't bring it back — there's no documented way to list team-owned
   databases. An empty response does **not** mean the account has none. Verify a
   database by pinging its REST URL, not by looking for it in the list.

   **Therefore: persist `database_id` from the create response**, as
   `UPSTASH_DATABASE_ID` next to the credentials. It is the only handle for
   `DELETE /v2/redis/database/{id}` later, and because team databases can't be
   listed, a lost id means the database can only be removed from the console.
   The hostname's numeric suffix is *not* the id.
5. **Sentry** — one project per surface. Write DSNs to `/infrastructure/sentry`
   as `SENTRY_DSN_<SURFACE>`, referenced from each app path.

   Two token types, and confusing them is why a token can look fine and still
   fail. An **Organization Auth Token** (`sntrys_…`, Settings → Auth Tokens) has
   fixed CI-only permissions — that's what sourcemap upload and releases use. An
   **Internal Integration** (Settings → Custom Integrations) has customizable
   scopes and is the only way to get `project:admin` for *creating* projects. It
   is not an OAuth app: it issues a token directly, no authorization flow. Use
   its **token**, not its client secret — the secret only verifies webhooks.
6. **Grafana** — mint an access-policy token scoped
   `metrics:write,logs:write,traces:write`. Same stack is fine; separation is
   by `service.namespace`. Write `GRAFANA_OTLP_{ENDPOINT,AUTH_HEADER}`.
7. **OpenRouter** — a workspace for the app, then a provisioning-key-issued API
   key per environment with its own spend cap.
8. **Resend** — verify the domain, create an API key. Free tier is one domain
   per account, so this usually means a fresh account and signup email.
9. **PostHog** — a project (free tier: a new **org**), write the project API key.
10. **Cloudflare** — DNS records, R2 buckets, tunnel routes. Last, so records
    only appear once targets exist.

Then **verify**: expand every reference and assert none resolve empty. A
dangling reference is invisible otherwise. See the pattern doc.

---

## 3. Manual checklist to print

Always output this — these have no provisioning API:

- [ ] **Inngest** — create the app, then Event Key + Signing Key per
      environment; paste into `/infrastructure/inngest`.
- [ ] **Langfuse Cloud** — create org + project by hand (the admin API is
      Enterprise self-host only); paste keys into `/infrastructure/langfuse`.
- [ ] **RevenueCat** — create the project in the dashboard and a v2 secret key;
      apps, products and entitlements can then be scripted.
- [ ] **Expo** — `eas init` in the mobile app, then set `EXPO_TOKEN`.
- [ ] **Apple** — bundle ids, certificates, ASC key, if there's a mobile app.
- [ ] Signup emails for any vendor needing its own account — route via
      Cloudflare Email Routing catch-all, distinct local parts, not `+` aliases.

---

## 4. Promoting or transferring later

Starting shared and splitting later is the intended path:

- **Neon** — transfer between orgs; the connection string doesn't change.
- **Fly** — `fly apps move -o <org>`.
- **Cloudflare** — move the zone; registrar locks can delay this ~10 days after
  a transfer or registration, so start early.
- **Infisical** — no transfer feature. Recreate the project by script and
  rewrite references in lockstep with the paths they point at, or every `${…}`
  silently resolves empty in the new project.

Verify after every migration. The whole class of bug here is silent.
