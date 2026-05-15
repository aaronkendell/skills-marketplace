# Trading — Agent Context

**Status:** Planned | **Linear:** TRADING | **Stack:** Next.js, Hono + tRPC, Drizzle, Neon, React Flow, Trigger.dev, Mastra, Alpaca API

## What it does
AI-powered trading platform with a visual strategy builder. Users construct trading workflows on a React Flow canvas — signal sources, entry/exit conditions, position sizing, risk rules. Strategies execute via Trigger.dev against the Alpaca brokerage API. Mastra agents monitor positions and surface analysis. Shares a financial data layer with Fiscax.

## Key file locations
- Frontend: `apps/trading/app/src/`
- API: `apps/trading/api/src/`
- DB schema: `packages/trading/db/src/models/`
- Business logic: `packages/trading/domains/src/packages/`
- Strategy runner: `packages/trading/workflows/src/` (Trigger.dev task definitions)
- AI agents: `packages/trading/ai/src/` (Mastra agents, tools)

## Key packages
- `@bokendell/trading-domains` — DDD domains (strategies, positions, signals, orders, risk)
- `@bokendell/trading-db` — Drizzle schema + Neon
- `@bokendell/trading-client` — tRPC client + React Query

## Patterns used
- Full DDD (see `context/patterns/ddd.md`)
- tRPC for API (see `context/patterns/api.md`)
- Next.js App Router for frontend
- React Flow for visual strategy builder (nodes = signals, conditions, actions)
- Trigger.dev for strategy execution engine
- Alpaca API for brokerage (orders, positions, market data)
- Mastra agents for position monitoring and analysis
- Inngest for scheduled jobs (market data sync, position checks)

## Where to go for more
- [Full docs](../../apps/trading/)
- [Current work](../../apps/trading/planning/)
