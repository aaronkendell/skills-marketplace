# Offline — Agent Context

**Status:** Planned | **Linear:** OFFLINE | **Stack:** Expo (mobile), Hono + tRPC, Drizzle, Neon + PostGIS, H3

## What it does
Hyperlocal social app built around intentional digital consumption. Key mechanics: 30-minute daily scroll cap, proximity-based content (PostGIS + H3 hex grid for zone segmentation), Persona ID verification for real-identity accounts, and content authenticity enforcement. Users only see content from people physically nearby.

## Key file locations
- Mobile: `apps/offline/mobile/src/packages/`
- API: `apps/offline/api/src/`
- DB schema: `packages/offline/db/src/models/`
- Business logic: `packages/offline/domains/src/packages/`

## Key packages
- `@bokendell/offline-domains` — DDD domains (posts, zones, identity, feed, limits)
- `@bokendell/offline-db` — Drizzle schema + Neon with PostGIS extension
- `@bokendell/offline-client` — tRPC client + React Query

## Patterns used
- Full DDD (see `context/patterns/ddd.md`)
- tRPC for API (see `context/patterns/api.md`)
- Expo Router for mobile (golf is canonical mobile reference)
- PostGIS for geospatial queries (proximity feeds, zone detection)
- H3 hex grid for zone segmentation
- Persona for government ID verification
- Inngest for async jobs (feed generation, limit enforcement, moderation)
- 30-min daily scroll cap enforced server-side

## Where to go for more
- [Full docs](../../apps/offline/)
- [Current work](../../apps/offline/planning/)
