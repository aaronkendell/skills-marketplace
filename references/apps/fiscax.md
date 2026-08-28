# Fiscax — Agent Context

**Status:** Planned | **Linear:** FISCAX | **Stack:** Next.js, Hono + oRPC, Drizzle, Neon, React Flow, Trigger.dev, QuickBooks, Plaid, Stripe

## What it does
Financial automation platform with a visual workflow builder. Users connect data sources (QuickBooks, Plaid, Stripe) and build automation workflows via a React Flow drag-and-drop canvas — categorization rules, reconciliation pipelines, reporting triggers. Workflows run on Trigger.dev. Companion to the Trading app (shared financial data layer).

## Key file locations
- Frontend: `apps/fiscax/app/src/`
- API: `apps/fiscax/api/src/`
- DB schema: `packages/fiscax/db/src/models/`
- Business logic: `packages/fiscax/domains/src/packages/`
- Workflow runner: `packages/fiscax/workflows/src/` (Trigger.dev task definitions)

## Key packages
- `@bokendell/fiscax-domains` — DDD domains (workflows, data-sources, runs, reports)
- `@bokendell/fiscax-db` — Drizzle schema + Neon
- `@bokendell/fiscax-client` — oRPC client + React Query

## Patterns used
- Full DDD (see `context/patterns/ddd.md`)
- oRPC for API (see `context/patterns/api.md`)
- Next.js App Router for frontend
- React Flow for visual workflow builder (nodes = data sources, transforms, actions)
- Trigger.dev for workflow execution engine
- QuickBooks OAuth + webhook integration
- Plaid Link for bank account connection
- Stripe for subscription billing

## Where to go for more
- [Full docs](../../apps/fiscax/)
- [Current work](../../apps/fiscax/planning/)
