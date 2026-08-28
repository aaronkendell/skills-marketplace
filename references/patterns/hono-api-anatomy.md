# Hono API Anatomy — what every API in this monorepo needs

> Standardized recipe for adding a Hono API app (the kind that ships to Fly).
> All four current APIs — `golf-api`, `hive-api`, `portfolio-api`, `swarm-api` —
> follow this shape. New APIs should match it 1:1 so deploys, observability,
> and quality checks Just Work.

## Surface area — the 6 files

For each new API at `apps/api/`, you need exactly six configuration
files. Each has a specific job; together they wire into the standard
build → deploy → observe pipeline.

| File | Purpose | Templated from |
|---|---|---|
| `package.json` | Workspace member. Declares deps, `build` (tsup), `dev`, `openapi:*`, test scripts | mirror golf/api/package.json |
| `tsconfig.json` | TS settings. `extends @bokendell/tsconfig/api.json` | mirror golf/api/tsconfig.json |
| `tsup.config.ts` | Bundle config. **Must inline `@bokendell/*` workspace packages** (see *Externalization* below) | mirror golf/api/tsup.config.ts |
| `.cicd.yml` | Deploy + quality config (image build args, health probe, smoke/e2e toggles, env vars, sentry) | template below |
| `fly.toml` | Production Fly machine config (always-on, blue-green, two health checks, 1 cpu / 512mb) | template below |
| `fly.stage.toml` | (Optional) Stage Fly machine config — same shape, smaller machine, `<app>-stage` Fly app | template below |

Plus the shared infrastructure:
- `infrastructure/docker/api.Dockerfile` — already exists; takes build-args `APP_DIR`, `APP_FILTER`, `APP_SERVICE_NAME`
- `packages/db/`, `packages/domains/`, `packages/composition/`, `packages/client/` — domain layer per `docs/context/patterns/ddd.md`

## Externalization — the bundle bug to avoid

**tsup must NOT externalize `@bokendell/*` workspace packages** unless those packages
have a `.js` compiled output that lives in `node_modules/` at runtime.

The failure mode (caught in production 2026-05-12):
- tsup externalizes `@bokendell/hive-domains/users` → leaves it as a runtime `require()` in `dist/server.js`
- `packages/domains/package.json` exports `./users → ./src/packages/users/index.ts`
- Node at runtime tries to `require('@bokendell/hive-domains/users')`, can't load a `.ts` file → `MODULE_NOT_FOUND` crash on every boot

Two ways to be safe:

```ts
// tsup.config.ts — Option A: inline everything from the workspace
import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  bundle: true,
  noExternal: [/^@bokendell\//],   // 👈 force-bundle workspace packages
  // ... shared options
});
```

```ts
// tsup.config.ts — Option B: externalize but build companions
// (requires each @bokendell/* dep to have its own tsup → dist/*.js,
//  AND package.json exports pointing at the compiled paths)
// Only do this if you have a reason — Option A is simpler.
```

**Option A is the default.** When you add a new API or pull in a new `@bokendell/*`
dep, verify the build with `pnpm --filter '@bokendell/<app>-api' build` then
`node apps/api/dist/server.js` (with env stubs). It should boot and serve
without resolution errors.

## `.cicd.yml` template

Copy this verbatim into a new API; fill in the `${...}` placeholders. Keep the
section ordering — `swarm config get` parsing relies on the structure.

```yaml
name: ${app-name}-api
type: hono-api
description: ${one-line description}

health:
  path: /api/v1/health
  timeout: 5000
  expected-status: 200

# Default: no smoke/e2e tests. Flip enabled and point at the perf/e2e
# package when those land. golf-api is the reference for both.
smoke-tests:
  enabled: false
e2e-tests:
  enabled: false

quality-checks:
  openapi:
    enabled: true
    package-filter: "@bokendell/${app-name}-api"
  e2e:
    enabled: false

# After each deploy, PUT the Inngest serve endpoint so Inngest Cloud
# picks up new function configs. Set `enabled: false` if the API doesn't
# host Inngest functions (e.g. swarm-api today).
inngest:
  enabled: ${true|false}
  sync-path: /api/inngest

postman: { enabled: false }
bruno:   { enabled: false }       # flip to true if you maintain a bruno collection

deploy:
  platform: fly
  working-directory: apps/${app-name}/api
  change-paths:
    - apps/${app-name}/api/**
    - packages/${app-name}/**
    - packages/shared/**
    - infrastructure/docker/**

  image:
    dockerfile: infrastructure/docker/api.Dockerfile
    context: .
    build-args:
      APP_DIR: ${app-name}/api
      APP_FILTER: "@bokendell/${app-name}-api"
      APP_SERVICE_NAME: ${app-name}-api

  environments:
    # Stage is optional. Drop the block entirely if the API ships
    # straight to prod (most APIs today). Add it later if you need a
    # canary surface.
    stage:
      app: ${app-name}-api-stage
      config: apps/${app-name}/api/fly.stage.toml
      url: https://api.${app-name}.stage.bokendell.com
    production:
      app: ${app-name}-api-production
      config: apps/${app-name}/api/fly.toml
      url: https://api.${app-name}.bokendell.com    # or https://${app-name}-api.bokendell.com

  environment-variables:
    required:
      - DATABASE_URL
      - BETTER_AUTH_SECRET
      # ... add any non-optional Infisical keys

sentry:
  org: bokendell
  project: ${app-name}-api
```

## `fly.toml` template (production)

```toml
# ${app-name}-api · production
#
# <one-line description of the API's role>

app = "${app-name}-api-production"
primary_region = "iad"

# NO inline [build] block. Image is built + pushed by deploy-fly.yml,
# flyctl deploy uses --image to pull the prebuilt artifact. Drop a
# [build] block back here ONLY as a manual-deploy fallback (e.g. when
# GHCR is down): {dockerfile = "../../../infrastructure/docker/api.Dockerfile",
# build.args = {APP_DIR=..., APP_FILTER=..., APP_SERVICE_NAME=...}}.

[deploy]
  # Blue-green: green VM boots, waits for health checks, traffic flips,
  # blue VM destroyed. Health checks gate the promotion.
  strategy = "bluegreen"
  wait_timeout = "10m"

[http_service]
  internal_port = 3000
  force_https = true
  # Always-on. `suspend` snapshots the machine to disk on idle, resumes
  # in ~1s on next request — much cheaper than scale-to-zero's cold boot,
  # and the cost difference at low traffic is ~$1-2/mo.
  auto_stop_machines = "suspend"
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  # Shallow probe: every 15s. Hits the Hono server's /api/v1/health.
  # Fly's bluegreen promotion gates on this.
  [[http_service.checks]]
    grace_period = "10s"
    interval = "15s"
    method = "GET"
    path = "/api/v1/health"
    timeout = "3s"

  # Deep probe: every 60s. Includes the DB ping via ?deep=true.
  # A failed deep check moves status from healthy → degraded but doesn't
  # auto-restart (transient DB blips shouldn't bounce the API).
  [[http_service.checks]]
    grace_period = "30s"
    interval = "60s"
    method = "GET"
    path = "/api/v1/health?deep=true"
    timeout = "10s"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory = "512mb"   # 256mb only if the API has no AI/Mastra deps (swarm-api)
```

## `fly.stage.toml` template

Same shape as production, with `-stage` suffix everywhere and smaller machine:

```toml
app = "${app-name}-api-stage"
primary_region = "iad"

[deploy]
  strategy = "bluegreen"
  wait_timeout = "10m"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "suspend"
  auto_start_machines = true
  min_machines_running = 0    # stage can scale to zero — cheaper, slower wake is fine
  processes = ["app"]

  [[http_service.checks]]
    grace_period = "10s"
    interval = "15s"
    method = "GET"
    path = "/api/v1/health"
    timeout = "3s"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory = "256mb"
```

## One-time Fly + DNS bootstrap per app

After the config files exist, the Fly + DNS plumbing has to be set up once per
app. Run these locally with `flyctl`:

```bash
# Production
flyctl apps create ${app-name}-api-production --org bokendell
flyctl ips allocate-v4 -a ${app-name}-api-production         # + v6
flyctl certs add api.${app-name}.bokendell.com -a ${app-name}-api-production
# Add the AAAA / A / CNAME records flyctl prints to your DNS provider

# Stage (if used)
flyctl apps create ${app-name}-api-stage --org bokendell
flyctl ips allocate-v4 -a ${app-name}-api-stage
flyctl certs add api.${app-name}.stage.bokendell.com -a ${app-name}-api-stage

# Infisical secrets — provision the keys listed in the .cicd.yml
# environment-variables.required block at /apps/${app-name}/api in
# both `production` and `stage` envs.
```

`swarm env audit --app ${app-name}-api` will tell you if anything's missing
once the workflow can run.

## Standardization gaps today (TODO)

State of the four current APIs:

| | golf | hive | portfolio | swarm |
|---|---|---|---|---|
| `tsup.config.ts` inlines `@bokendell/*` | ⚠️ verify | ⚠️ verify | ⚠️ verify | ⚠️ verify |
| `fly.toml` no inline `[build]` | ✓ | ✗ legacy | ✗ legacy | ✓ |
| `min_machines_running = 1` | ✓ | ✓ | ✓ (fixed 2026-05-12) | ✓ |
| Two health checks (shallow + deep) | ✓ | ✓ | ✓ | ✓ (fixed 2026-05-12) |
| `wait_timeout = "10m"` | ✓ | ✓ | ✓ | ✓ (fixed 2026-05-12) |
| `.cicd.yml` deploy.image block | ✓ | ✓ | ✓ | ✓ |
| Stage env in `.cicd.yml` | ✓ | ✗ | ✗ | ✗ |

Cleanup items to chase when the in-flight prod incident is resolved:
1. **Verify tsup config of all four APIs inlines `@bokendell/*`**. The 2026-05-12 incident (`MODULE_NOT_FOUND` on `/hive-domains/users`, `/portfolio-domains/ai`) confirms hive-api and portfolio-api are externalizing them. Fix the tsup configs, ship a redeploy, the crash-loop clears.
2. **Remove `[build]` blocks from `hive-api/fly.toml` and `portfolio-api/fly.toml`** to match golf/swarm's image-only shape.
3. **Add a `swarm api scaffold <name>` CLI command** that generates all six files from these templates. Mechanical work; pays for itself the next time you add an app.
4. **Consider stage envs for hive/portfolio/swarm** if a canary surface becomes useful (currently they ship straight to prod). Adds a `fly.stage.toml` + Fly app per service.

## Why not a shared `fly.toml` template file?

Tempting, but Fly's `flyctl` doesn't support includes or variable
substitution in `fly.toml`. Every per-app file is concrete. The
`.cicd.yml` carries the variable bits (`app:`, `url:`, `config:`); the
fly.toml stays per-app but follows the template above byte-for-byte
except for the `app =` line.

The right abstraction layer is a code generator (the `swarm api
scaffold <name>` command above), not a YAML template loader.

## See also

- `docs/context/patterns/api.md` — Hono + oRPC routing patterns
- `docs/context/patterns/ddd.md` — domain layer that sits behind the API
- `docs/context/patterns/ci-costs.md` — deploy workflow + cost shape
- `infrastructure/docker/api.Dockerfile` — the shared build image
