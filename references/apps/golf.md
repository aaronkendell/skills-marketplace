# Golf — Agent Context

**Status:** Active | **Linear:** GOLF | **Stack:** Expo (mobile), Hono + oRPC, Drizzle, Neon, Ably

## What it does
Golf scoring app with AI caddy analysis, live realtime scoring via Ably, multi-game type support (skins, stroke, stableford), stats computation, and social features (friends, settlement).

## Key file locations
- Mobile: `apps/mobile/src/packages/`
- API: `apps/api/src/packages/` — one package per feature, each a
  `{domain}.contract.ts` + `{domain}.orpc.router.ts` pair
- oRPC kernel: `apps/api/src/packages/api/` (procedures, tiers, root + v1 routers)
- Composition root: `packages/composition/src/` — Awilix container, env, `createGolfApp`
- Workers: `apps/workers/src/` · Async jobs: `apps/inngest/src/`
- Admin: `apps/admin/src/` · Design studio: `apps/design/src/`
- DB schema: `packages/db/src/models/`
- Business logic: `packages/domains/src/packages/`
- API client: `packages/client/src/`
- E2E tests: `packages/e2e/api/`
- Performance tests: `packages/performance/`

## Key packages
- `@bokendell/golf-domains` — DDD domains (rounds, courses, scoring, stats, notifications, settlement)
- `@bokendell/golf-db` — Drizzle schema + Testcontainers test infra
- `@bokendell/golf-client` — oRPC client + the canonical `q` query builders
- `@bokendell/golf-composition` — Awilix cradle, zod env, `createGolfApp`

## Patterns used
- **Canonical reference** — golf is the standard for all oRPC, mobile, and DDD patterns. When in doubt, look here first
- Full DDD with Inngest for async jobs (stats computation, notification dispatch)
- **Contract-first oRPC** — `implement(contract)` + tier middleware; scopes declared
  once in the contract so router and docs can't drift
- REST at `/api/v1` + RPC at `/api/rpc`; permalinks (OG, share, `.well-known`) at `/`
- Client reads go through `q.{domain}.{entry}()`, never `orpc.<proc>.queryOptions()`
  at a call site; invalidation via `orpc.<path>.key({ input })`
- Ably realtime channel per round (`round:{id}`) for live scoring
- Optimistic updates via `queryClient.setQueryData` before mutation, rollback on error
- Custom CORS for React Native (null origins, mobile scheme, Expo dev client)
- Sentry + OpenTelemetry + Langfuse for observability
- `InngestTestEngine` for testing async notification functions

## Where to go for more
- [Full docs](../../apps/golf/)
- [Current work](../../apps/golf/planning/)
