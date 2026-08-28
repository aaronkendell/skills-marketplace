# @bokendell/api — Agent Context

Location: `packages/shared/api/`

## What it exports
The shared API foundation used by every app's Hono server. Provides the app factory, oRPC base, middleware stack, error handling, and webhook utilities.

- `createApiApp(config)` — Hono app factory with standard middleware stack (CORS, logging, requestId, secureHeaders, timeout, rate limiting, error handler, OpenAPI, Scalar docs)
- `createBaseOrpc(config)` — oRPC base with `publicProcedure`, `protectedProcedure`, `adminProcedure`, `internalProcedure` and `AppError → ORPCError` mapping
- `baseEnvSchema` — base Zod env schema; extend per app with `.extend({...})`
- `requireAuth`, `requireAdmin` — Hono middleware for REST routes
- `corsMiddleware`, `createCorsMiddleware` — CORS setup (supports mobile null origins, `exp://`, app schemes)
- `verifyHmacSha256Signature`, `isFreshWebhookTimestamp` — webhook security utilities
- `generateApiSpec` — OpenAPI spec generation helper
- `createRateLimitMiddleware`, `createGlobalRateLimitMiddleware` — Upstash-backed rate limiting

## How to use
```typescript
import { createApiApp, createBaseOrpc, baseEnvSchema } from "@bokendell/api";

const app = createApiApp({ title: "My API", version: "1.0.0" });
const { router, createCaller, publicProcedure, protectedProcedure } = createBaseOrpc({ ... });
```

## Notes
- See `context/patterns/api.md` for the full API patterns guide
- Every app API imports from here — do not duplicate middleware setup
- `BaseApiContext` type is the oRPC context shape: `{ requestId, user, session }`
