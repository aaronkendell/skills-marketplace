# Monorepo Overview

pnpm + Turbo monorepo. TypeScript throughout. All apps share infrastructure but have clear ownership boundaries.

## Architecture philosophy

Three layers, each with a distinct role:

```
apps/{app}/{sub-app}/     ← runnable processes (API server, mobile app, web app, worker)
packages/{app}/{pkg}/     ← app-specific logic used across that app's sub-apps
packages/shared/{pkg}/    ← truly shared across multiple apps
```

**`apps/`** are thin. They handle routing, middleware, and controller wiring — that's it. No business logic.

**`packages/{app}/domains/`** is where all business logic lives. It's independent of any HTTP framework, fully testable in isolation, and can be used by the API, CLI, workers, admin — any consumer.

**`packages/{app}/db/`** owns schema, models, and migrations. Separated from domains so DB concerns don't leak into business logic.

**`packages/shared/`** is for things multiple apps need — UI components, email templates, core utilities. If only one app uses it, it lives in `packages/{app}/`.

## Workspace layout

```
apps/
├── portfolio/
│   ├── app/          # Next.js 16 web frontend
│   ├── api/          # Hono + tRPC backend
│   └── admin/        # Refine admin dashboard
├── goals/
│   ├── mobile/       # Expo (iOS + Android)
│   └── api/          # Hono + tRPC backend
├── golf/
│   ├── mobile/       # Expo (iOS + Android)
│   ├── api/          # Hono + tRPC backend
│   └── admin/        # Refine admin dashboard
├── agents/
│   ├── api/          # Hono API + swarm orchestrator (same process)
│   ├── vault-sync/   # Vault sync worker
│   └── discord/      # Discord.js bot
├── home-videos/      # (planned) Expo TV + web + Python AI worker
├── datahub/          # (planned) Hono API + Expo mobile
├── offline/          # (planned) Hono API + Expo mobile
├── fiscax/           # (planned) Hono API + web
└── trading/          # (planned) Hono API + web

packages/
├── shared/
│   ├── api/          # Hono app factory, tRPC base, middleware, webhooks — used by all APIs
│   ├── ui/           # Shadcn/ui web components — used by all web/admin apps
│   ├── mobile-ui/    # Shared mobile UI — used by all Expo apps
│   ├── emails/       # Email templates + sending (Resend + React Email)
│   ├── push-notifications/ # Expo push notification utilities
│   ├── storage/      # Cloudflare R2 client, presigned URLs, file validation
│   ├── core/         # Core utilities, error classes, ID generation (createId)
│   ├── db-core/      # Neon driver setup, shared DB abstractions
│   ├── redis/        # Upstash Redis client + rate limiter
│   ├── tsconfig/     # Shared TypeScript configs (base, next, expo)
│   └── vitest-config/ # Shared Vitest configs
├── portfolio/
│   ├── domains/      # Business logic (service/repository pattern)
│   ├── db/           # Drizzle schema + migrations
│   ├── client/       # Typed API client + React Query hooks
│   ├── auth/         # Better Auth configuration
│   ├── ai/           # Mastra + Vercel AI SDK integrations
│   ├── e2e/          # Playwright E2E tests
│   └── performance/  # K6 performance tests
├── goals/
│   ├── domains/      # Business logic (full DDD)
│   ├── db/           # Drizzle schema + test factories + Testcontainers setup
│   ├── client/       # Typed API client + React Query hooks + query keys
│   ├── e2e/          # Playwright E2E tests
│   └── performance/  # K6 performance tests
├── golf/
│   ├── domains/      # Business logic (full DDD)
│   ├── db/           # Drizzle schema + test factories + Testcontainers setup
│   ├── client/       # Typed API client + React Query hooks + query keys
│   ├── e2e/          # Playwright E2E tests
│   └── performance/  # K6 performance tests
└── agents/
    └── domains/      # All agent logic: swarm, AI/Mastra, vault (DDD)

tools/
└── cli/              # TypeScript CLI (`pnpm bk`) — monorepo utilities
```

## All apps

| App | Sub-apps | Package prefix | Linear team | Status |
|-----|----------|---------------|-------------|--------|
| portfolio | app, api, admin | `@bokendell/portfolio-*` | MISC | Active |
| goals | mobile, api | `@bokendell/goals-*` | GOALS | Active |
| golf | mobile, api, admin | `@bokendell/golf-*` | GOLF | Active |
| agents | api, vault-sync, discord | `@bokendell/hive-*` | AGENTS | Active |
| home-videos | (planned) | `@bokendell/home-videos-*` | MISC | Planned |
| datahub | (planned) | `@bokendell/datahub-*` | MISC | Planned |
| offline | (planned) | `@bokendell/offline-*` | MISC | Planned |
| fiscax | (planned) | `@bokendell/fiscax-*` | MISC | Planned |
| trading | (planned) | `@bokendell/trading-*` | TRADING | Planned |
| cli | — | — | MISC | Active |

**Linear teams**: AGENTS, TRADING, GOALS, GOLF, MISC

## Package decision rules

**Put it in `packages/shared/`** when:
- Two or more apps need it
- It has no app-specific domain knowledge
- Examples: UI components, email templates, core utils, Redis client

**Put it in `packages/{app}/`** when:
- It's specific to one app's domain but used by multiple of that app's sub-apps
- Examples: `domains` (business logic), `db` (schema), `client` (typed API client)

**Put it in `apps/{app}/{sub-app}/`** when:
- It's a runnable process — server, mobile app, worker, bot
- It handles routing, middleware, controllers — never business logic

## Dependency conventions

- `catalog:` — version pinned in `pnpm-workspace.yaml` (use this for all shared external deps)
- `workspace:*` — internal monorepo package, always resolves to local
- Explicit version — external package not worth adding to catalog

## Key commands

```bash
# Development
pnpm dev:portfolio                              # All portfolio sub-apps
turbo dev --filter='@bokendell/golf-api'        # One specific sub-app

# Building
pnpm build                                      # Build everything
turbo build --filter='@bokendell/goals-*'       # One app's packages

# Code quality (Biome — not ESLint/Prettier)
pnpm check                                      # Lint + format check (all)
pnpm check:fix                                  # Auto-fix lint + format
pnpm check-types                                # TypeScript check (all)
turbo check-types --filter='@bokendell/golf-api' # One specific workspace

# Testing
pnpm test                                       # Unit tests (fast, no Docker)
TEST_DB=true pnpm test                          # Include integration tests (requires Docker)
pnpm e2e                                        # Playwright E2E
turbo test --filter='@bokendell/goals-domains'  # One package's tests
```

## Turbo pipelines

`turbo.json` defines: `build`, `dev`, `test`, `check-types`, `check`, `e2e`, `clean`

- Always use `--filter=@bokendell/{package-name}` to scope to one workspace
- `TEST_DB=true` runs are cached separately from plain `test` runs
- `dev`, `test:watch`, `e2e:ui` are persistent tasks (never cached)
- `build`, `test`, `check-types` are cached — outputs reused if inputs unchanged
