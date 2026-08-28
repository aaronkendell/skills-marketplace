# Goals — Agent Context

**Status:** Active | **Linear:** GOALS | **Stack:** Expo (mobile), Hono + oRPC, Drizzle, Neon

## What it does
Mobile goal-tracking app with life areas, hierarchical goals, habit scheduling, AI coaching, and weekly review system.

## Key file locations
- Mobile: `apps/goals/mobile/src/packages/`
- API: `apps/goals/api/src/packages/`
- DB schema: `packages/goals/db/src/models/`
- Business logic: `packages/goals/domains/src/`
- API client: `packages/goals/client/src/`
- Test infra: `packages/goals/db/src/testing/`

## Key packages
- `@bokendell/goals-domains` — DDD business logic (entities, services, repositories)
- `@bokendell/goals-db` — Drizzle schema + Testcontainers test infra + factories
- `@bokendell/goals-client` — oRPC client + React Query hooks

## Patterns used
- Full DDD: entities, services, repositories, mappers, presentation schemas
- Full mobile architecture: containers → domain hooks → form hooks → stores → screens → components
- `@bokendell/goals-db/testing` for integration tests (`connectToTestDatabase`, `factories`)
- **Note:** migrating HTTP client → oRPC (golf is the canonical oRPC reference)
- `.nullable()` not `.optional()` for RHF compatibility

## Where to go for more
- [Full docs](../../apps/goals/)
- [Architecture](../../apps/goals/architecture.md)
- [Current work](../../apps/goals/planning/)
