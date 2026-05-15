# Home Videos — Agent Context

**Status:** Planned | **Linear:** HOMEVIDS | **Stack:** Expo (TV + mobile), Next.js admin, Hono + tRPC, Drizzle, Neon, Cloudflare R2, Python (Apple Vision)

## What it does
Family video archiving platform. A macOS/Python worker running on M1 Max uses Apple Vision (PyObjC) for AI processing — face detection, scene tagging, speech transcription. Videos are stored in Cloudflare R2. A React Native TV app (iOS, Android, Apple TV, Android TV) handles playback and browsing; a Next.js + Refine admin dashboard handles library management.

## Key file locations
- Mobile/TV app: `apps/home-videos/mobile/src/packages/`
- Admin: `apps/home-videos/admin/src/`
- API: `apps/home-videos/api/src/`
- Python worker: `apps/home-videos/worker/` (Apple Vision, PyObjC, M1 Mac)
- DB schema: `packages/home-videos/db/src/models/`
- Business logic: `packages/home-videos/domains/src/packages/`

## Key packages
- `@bokendell/home-videos-domains` — DDD domains (videos, people, albums, search)
- `@bokendell/home-videos-db` — Drizzle schema + Neon
- `@bokendell/home-videos-client` — tRPC client + React Query

## Patterns used
- Full DDD (see `context/patterns/ddd.md`)
- tRPC for API (see `context/patterns/api.md`)
- Expo Router for TV + mobile navigation (golf is canonical mobile reference)
- Cloudflare R2 for video + thumbnail storage
- Python worker: Apple Vision via PyObjC for face detection, scene tagging, transcription
- Inngest for async processing pipeline (upload → transcode → AI → index)

## Where to go for more
- [Full docs](../../apps/home-videos/)
- [Current work](../../apps/home-videos/planning/)
