# Datahub — Agent Context

**Status:** Planned | **Linear:** DATAHUB | **Stack:** Hono + tRPC, Drizzle, Neon, MCP server, HealthKit, Stripe

## What it does
Personal data aggregation API and MCP server. Pulls data from HealthKit (health + activity), Google Calendar, location history, and Stripe subscriptions into a unified personal data store. Exposes a typed API and an MCP server so agents (and Claude) can query personal context — health trends, schedule, finances — in real time.

## Key file locations
- API: `apps/datahub/api/src/`
- MCP server: `apps/datahub/mcp/src/`
- DB schema: `packages/datahub/db/src/models/`
- Business logic: `packages/datahub/domains/src/packages/`
- Sync workers: `apps/datahub/workers/src/` (HealthKit, Calendar, Stripe ingestion)

## Key packages
- `@bokendell/datahub-domains` — DDD domains (health, location, calendar, finance)
- `@bokendell/datahub-db` — Drizzle schema + Neon
- `@bokendell/datahub-client` — tRPC client

## Patterns used
- Full DDD (see `context/patterns/ddd.md`)
- tRPC for API (see `context/patterns/api.md`)
- MCP server for agent access to personal data
- Inngest for scheduled sync jobs (HealthKit pull, Calendar sync, Stripe webhooks)
- Stripe subscriptions for service tier gating

## Where to go for more
- [Full docs](../../apps/datahub/)
- [Current work](../../apps/datahub/planning/)
