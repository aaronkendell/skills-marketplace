# Portfolio — Agent Context

**Status:** Active | **Linear:** MISC | **Stack:** Next.js 16, Hono, Drizzle, Neon

## What it does
VS Code-themed personal portfolio site with functional terminal, AI chat, database-driven project showcase, and feature flags.

## Key file locations
- Frontend: `apps/portfolio/app/src/`
- API: `apps/portfolio/api/src/`
- Admin: `apps/portfolio/admin/src/`
- DB schema: `packages/portfolio/db/src/models/`
- Business logic: `packages/portfolio/services/src/` ⚠️ migrating to `packages/portfolio/domains/`
- AI: `packages/portfolio/ai/src/`

## Key packages
- `@bokendell/portfolio-db` — Drizzle schema + queries
- `@bokendell/portfolio-services` — business logic (migrating → `portfolio-domains`)
- `@bokendell/portfolio-client` — typed API client
- `@bokendell/portfolio-auth` — Better Auth config
- `@bokendell/portfolio-ai` — Mastra + Vercel AI SDK

## Patterns used
- **⚠️ In migration**: currently uses services pattern (`packages/portfolio/services/`), being migrated to full DDD (`packages/portfolio/domains/`). New work should target the DDD pattern — see `context/patterns/ddd.md`
- Hono + OpenAPI for API (not yet tRPC — will migrate)
- Next.js 16 App Router
- Magic link auth via Better Auth

## Where to go for more
- [Full docs](../../apps/portfolio/)
- [Architecture](../../apps/portfolio/architecture.md)
- [Current work](../../apps/portfolio/planning/)
