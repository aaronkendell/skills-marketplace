# Golf — Agent Context

**Status:** Active | **Linear:** GOLF | **Stack:** Expo (mobile), Hono + tRPC, Drizzle, Neon, Ably

## What it does
Golf scoring app with AI caddy analysis, live realtime scoring via Ably, multi-game type support (skins, stroke, stableford), stats computation, and social features (friends, settlement).

## Key file locations
- Mobile: `apps/golf/mobile/src/packages/`
- API: `apps/golf/api/src/packages/`
- DB schema: `packages/golf/db/src/models/`
- Business logic: `packages/golf/domains/src/packages/`
- API client: `packages/golf/client/src/`
- E2E tests: `packages/golf/e2e/api/`
- Performance tests: `packages/golf/performance/`

## Key packages
- `@bokendell/golf-domains` — DDD domains (rounds, courses, scoring, stats, notifications, settlement)
- `@bokendell/golf-db` — Drizzle schema + Testcontainers test infra
- `@bokendell/golf-client` — tRPC client + React Query

## Patterns used
- **Canonical reference** — golf is the standard for all tRPC, mobile, and DDD patterns. When in doubt, look here first
- Full DDD with Inngest for async jobs (stats computation, notification dispatch)
- tRPC via `useTRPC()` — auto-generated query keys, no manual queryFn
- Ably realtime channel per round (`round:{id}`) for live scoring
- Optimistic updates via `queryClient.setQueryData` before mutation, rollback on error
- Custom CORS for React Native (null origins, mobile scheme, Expo dev client)
- Sentry + OpenTelemetry + Langfuse for observability
- `InngestTestEngine` for testing async notification functions

## Where to go for more
- [Full docs](../../apps/golf/)
- [Current work](../../apps/golf/planning/)
