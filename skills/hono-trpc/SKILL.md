---
name: hono-trpc
description: Use when creating or modifying Hono API routes, tRPC routers, middleware, or OpenAPI endpoints. Triggers when adding new API endpoints, creating tRPC procedures, configuring middleware, or working with the Hono + tRPC + OpenAPI stack in this monorepo. Also use when debugging API issues.
---

# Hono + tRPC + OpenAPI API Skill

## Latest Documentation

Before implementing, consider fetching the latest docs for reference:
- Hono: `https://hono.dev/docs`
- tRPC v11: `https://trpc.io/docs`
- trpc-to-openapi: `https://github.com/jlalmes/trpc-to-openapi`

## Architecture Overview

The Golf API (`apps/golf/api`) uses a **Hono + tRPC + trpc-to-openapi** stack:

- **Hono** serves as the HTTP framework with middleware
- **tRPC** provides typed RPC procedures (mounted at `/api/trpc/*`)
- **trpc-to-openapi** exposes the same procedures as REST endpoints at `/api/v1/*`
- **OpenAPI docs** are generated from tRPC procedure metadata (Swagger UI at `/docs`, Scalar at `/reference`)
- **superjson** is the tRPC transformer (handles Dates, Maps, Sets, etc.)

```
Client (tRPC)  -->  /api/trpc/*      -->  tRPC procedures  -->  Domain services
Client (REST)  -->  /api/v1/*        -->  Same procedures   -->  Same services
Client (SSE)   -->  /api/v1/ai/*     -->  Plain Hono route  -->  Domain services
Auth           -->  /api/auth/*      -->  Better Auth handler
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/golf/api/src/app.ts` | Main Hono app, middleware stack, route mounting |
| `apps/golf/api/src/trpc/trpc.ts` | tRPC init, context type, procedures (public/protected/admin) |
| `apps/golf/api/src/trpc/router.ts` | Root router composing all sub-routers |
| `apps/golf/api/src/trpc/openapi-tags.ts` | Centralized OpenAPI tag constants |
| `apps/golf/api/src/trpc/routers/*.ts` | Individual domain routers |
| `apps/golf/api/src/core/services/index.ts` | Composition root for all services |
| `apps/golf/api/src/core/services/*.service-factory.ts` | Service factory files |
| `apps/golf/api/src/core/exceptions/handlers.ts` | Global Hono error handler |
| `apps/golf/api/src/core/middleware/*.ts` | Middleware (CORS, rate limit, etc.) |
| `apps/golf/api/src/routes/*.ts` | Plain Hono routes (non-tRPC, e.g. AI streaming) |

## Middleware Stack (Order Matters)

The middleware is applied in `app.ts` in this exact order:

```
1. requestIdMiddleware     - Generate/propagate request IDs
2. createSentryMiddleware  - Error capture (if SENTRY_DSN set)
3. secureHeadersMiddleware - Security headers
4. corsMiddleware          - Cross-origin handling
5. timeoutMiddleware       - Request timeout
6. loggingMiddleware       - Request/response logging with requestId correlation
7. prettyJSONMiddleware    - Pretty JSON responses (dev only)
8. createOtelMiddleware    - OpenTelemetry tracing (dev only)
9. sessionMiddleware       - Better Auth session extraction
```

## tRPC Context

The tRPC context is created from Hono middleware state. Defined in `apps/golf/api/src/trpc/trpc.ts`:

```typescript
export interface TRPCContext {
  user: BetterAuthSession["user"] | null;
  session: BetterAuthSession["session"] | null;
  requestId: string;
  headers: Headers;
}
```

Context is constructed identically for both tRPC and OpenAPI handlers:

```typescript
// tRPC handler (app.ts)
createContext: (_opts, c) => ({
  user: c.get("user"),
  session: c.get("session"),
  requestId: c.get("requestId"),
  headers: c.req.raw.headers,
})

// OpenAPI handler (app.ts)
createContext: () => ({
  user: c.get("user"),
  session: c.get("session"),
  requestId: c.get("requestId"),
  headers: c.req.raw.headers,
})
```

## Procedure Types

Three procedure types are available. All include the `errorHandling` middleware that maps `AppError` to `TRPCError`:

### publicProcedure

No auth required. Use for health checks, public data.

```typescript
import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  check: publicProcedure
    .meta({ openapi: { method: "GET", path: "/health", tags: [OPENAPI_TAGS.HEALTH], summary: "Health check" } })
    .input(z.void())
    .output(healthResponseSchema)
    .query(async () => {
      return healthService.check();
    }),
});
```

### protectedProcedure

Requires authenticated, non-anonymous user. Narrows `ctx.user` and `ctx.session` to non-null.

```typescript
import { protectedProcedure, router } from "../trpc";

export const usersRouter = router({
  updateSelf: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/users/me",
        tags: [OPENAPI_TAGS.USERS],
        summary: "Update the current user",
        protect: true,  // <-- marks as protected in OpenAPI spec
      },
    })
    .input(z.object({ data: updateUserSchema }))
    .output(userResponseSchema)
    .mutation(async ({ input, ctx }) => {
      // ctx.user is guaranteed non-null here
      const user = await userService.update(ctx.user.id, input.data, ctx.headers);
      return toUserResponse(user);
    }),
});
```

### adminProcedure

Extends `protectedProcedure` -- requires `ctx.user.role === "admin"`.

```typescript
import { adminProcedure, router } from "../trpc";

export const apiKeysAdminRouter = router({
  getAll: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/api-keys",
        tags: [OPENAPI_TAGS.ADMIN_API_KEYS],
        summary: "List all API keys",
        protect: true,
      },
    })
    .input(z.void())
    .output(apiKeyListResponseSchema)
    .query(async ({ ctx }) => {
      // ctx.user.role is guaranteed "admin" here
      const result = await auth.api.listApiKeys({ headers: ctx.headers });
      return toApiKeyResponseList(result ?? []);
    }),
});
```

## How to Add a New Router (Step-by-Step)

### 1. Define domain schemas and service

Schemas and services live in `packages/golf/domains/src/{domain}/`. The API imports from there:

```typescript
// packages/golf/domains/src/{domain}/index.ts exports:
// - Zod schemas for input/output validation
// - Service factory function (createXxxService)
// - Response mapper functions (toXxxResponse)
```

### 2. Create the service factory

Create `apps/golf/api/src/core/services/{domain}.service-factory.ts`:

```typescript
import { db } from "@bokendell/golf-db";
import { createXxxRepository, createXxxService } from "@bokendell/golf-domains/{domain}";

const xxxRepository = createXxxRepository({ db });
export const xxxService = createXxxService({ xxxRepository });
```

Export it from `apps/golf/api/src/core/services/index.ts`:

```typescript
export { xxxService } from "./{domain}.service-factory";
```

### 3. Add OpenAPI tag

Add to `apps/golf/api/src/trpc/openapi-tags.ts`:

```typescript
export const OPENAPI_TAGS = {
  // ... existing tags
  XXX: "Xxx",
} as const;
```

### 4. Create the router file

Create `apps/golf/api/src/trpc/routers/{domain}.ts`:

```typescript
import {
  xxxResponseSchema,
  xxxListResponseSchema,
  createXxxSchema,
  updateXxxSchema,
  toXxxResponse,
} from "@bokendell/golf-domains/{domain}";
import { z } from "zod";
import { xxxService } from "@/core/services";
import { OPENAPI_TAGS } from "../openapi-tags";
import { protectedProcedure, router } from "../trpc";

export const xxxRouter = router({
  getAll: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/{domain}",
        tags: [OPENAPI_TAGS.XXX],
        summary: "List all xxx",
        protect: true,
      },
    })
    .input(z.void())
    .output(xxxListResponseSchema)
    .query(async ({ ctx }) => {
      return xxxService.getAll(ctx.user.id);
    }),

  getById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/{domain}/{id}",
        tags: [OPENAPI_TAGS.XXX],
        summary: "Get xxx by ID",
        protect: true,
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(xxxResponseSchema)
    .query(async ({ input, ctx }) => {
      return xxxService.getById(input.id, ctx.user.id);
    }),

  create: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/{domain}",
        tags: [OPENAPI_TAGS.XXX],
        summary: "Create xxx",
        protect: true,
      },
    })
    .input(createXxxSchema)
    .output(xxxResponseSchema)
    .mutation(async ({ input, ctx }) => {
      return xxxService.create(input, ctx.user.id);
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/{domain}/{id}",
        tags: [OPENAPI_TAGS.XXX],
        summary: "Update xxx",
        protect: true,
      },
    })
    .input(z.object({ id: z.uuid(), data: updateXxxSchema }))
    .output(xxxResponseSchema)
    .mutation(async ({ input, ctx }) => {
      return xxxService.update(input.id, input.data, ctx.user.id);
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/{domain}/{id}",
        tags: [OPENAPI_TAGS.XXX],
        summary: "Delete xxx",
        protect: true,
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await xxxService.delete(input.id, ctx.user.id);
    }),
});
```

### 5. Register in the root router

Add to `apps/golf/api/src/trpc/router.ts`:

```typescript
import { xxxRouter } from "./routers/{domain}";

export const appRouter = router({
  // ... existing routers
  xxx: xxxRouter,
});
```

### 6. Regenerate OpenAPI spec

```bash
cd apps/golf/api && pnpm openapi:generate
```

This generates `apps/golf/api/openapi.json` which is git-tracked.

## OpenAPI Metadata Pattern

Every procedure MUST have `.meta({ openapi: { ... } })` for the REST endpoint to work:

```typescript
.meta({
  openapi: {
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: "/resource/{paramName}",     // Path params use {curly braces}
    tags: [OPENAPI_TAGS.TAG_NAME],     // From openapi-tags.ts
    summary: "Short description",       // Shows in Swagger/Scalar UI
    protect: true,                      // Set true for protected/admin procedures
  },
})
```

**Important rules:**
- `.query()` procedures use `GET` method
- `.mutation()` procedures use `POST`, `PATCH`, `PUT`, or `DELETE`
- Path params (e.g., `{id}`) must match properties in the `.input()` schema
- `protect: true` adds security requirements to the OpenAPI spec

## Input/Output Validation

All procedures MUST have explicit `.input()` and `.output()` with Zod schemas:

```typescript
// For no input:
.input(z.void())

// For path params only:
.input(z.object({ id: z.uuid() }))

// For body with nested data (update pattern):
.input(z.object({ id: z.uuid(), data: updateSchema }))

// For query params (pagination):
.input(paginationInputSchema)  // from @bokendell/golf-domains/shared

// Output is always a Zod schema:
.output(responseSchema)
.output(z.void())  // for delete operations
```

Schemas are defined in `packages/golf/domains/src/{domain}/` and imported from `@bokendell/golf-domains/{domain}`.

## Error Handling

### In Services (Domain Layer)

Services throw `AppError` subclasses from `@bokendell/core`:

```typescript
import { NotFoundError, ValidationError } from "@bokendell/core";

// Throw in services:
throw new NotFoundError("Resource", id);
throw new ValidationError("Invalid input", { field: "name" });
```

### In tRPC (Automatic Mapping)

The `errorHandling` middleware in `trpc.ts` automatically maps `AppError` to `TRPCError`:

| HTTP Status | tRPC Code |
|-------------|-----------|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 408 | `TIMEOUT` |
| 409 | `CONFLICT` |
| 422 | `UNPROCESSABLE_CONTENT` |
| 504 | `TIMEOUT` |

The error formatter also enriches errors with:
- `errorCode`: The AppError code (e.g., `"NOT_FOUND"`)
- `details`: Extra context from AppError
- `zodError`: Flattened Zod errors for validation failures

### In Routers (Rarely Needed)

You usually do NOT need to catch errors in router handlers. Let the service throw and the middleware will handle it. Only catch if you need router-level logic:

```typescript
// Prefer: let service throw NotFoundError, middleware maps it
const result = await xxxService.getById(input.id, ctx.user.id);
// Service throws NotFoundError if not found -- no need to check here

// Exception: when the underlying API returns null (e.g., Better Auth)
const key = await auth.api.getApiKey({ query: { id: input.id }, headers: ctx.headers });
if (!key) {
  throw new NotFoundError("API key", input.id);
}
```

## Plain Hono Routes (Non-tRPC)

For cases where tRPC is not suitable (SSE streaming, file uploads, webhooks), use plain Hono routes:

```typescript
// apps/golf/api/src/routes/{name}.ts
import { requireAuth } from "@bokendell/golf-domains/auth";
import { Hono } from "hono";
import { requireUserId } from "@/core/context/utils";
import { someService } from "@/core/services";

export const myRoutes = new Hono();

// Apply auth middleware to all routes in this group
myRoutes.use("*", requireAuth);

myRoutes.post("/endpoint", async (c) => {
  const userId = requireUserId(c);
  const body = await c.req.json();
  // ... handle
  return c.json({ success: true });
});
```

Mount in `app.ts` BEFORE the OpenAPI catch-all:

```typescript
app.route("/api/v1/my-feature", myRoutes);

// MUST come before:
app.all("/api/v1/*", async (c) => { ... }); // OpenAPI catch-all
```

## Service Factory Pattern (Composition Root)

Services are created once in `apps/golf/api/src/core/services/` and imported by routers.

```typescript
// apps/golf/api/src/core/services/{domain}.service-factory.ts
import { db } from "@bokendell/golf-db";
import { createXxxRepository, createXxxService } from "@bokendell/golf-domains/{domain}";

const xxxRepository = createXxxRepository({ db });
export const xxxService = createXxxService({ xxxRepository });
```

For cross-domain dependencies, import from other factory files:

```typescript
// ai.service-factory.ts
import { createAIService } from "@bokendell/golf-domains/ai";
import { usageService } from "./usage.service-factory";

export const aiService = createAIService({ usageService });
```

Export all from `apps/golf/api/src/core/services/index.ts`:

```typescript
export { xxxService } from "./{domain}.service-factory";
```

## Rate Limiting

Rate limiters are defined in `apps/golf/api/src/core/middleware/rate-limit.ts` using `hono-rate-limiter` with Redis (Upstash) store.

For plain Hono routes, apply as middleware:
```typescript
myRoutes.use("*", myRateLimiter);
```

For tRPC procedures, rate limiting is applied at the Hono middleware level (before tRPC handler), not inside procedures.

## Testing API Routes

Tests use Vitest. Current test files are utility-focused (no router integration tests yet), but the pattern for testing Hono routes:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Context } from "hono";

// For unit testing utilities:
describe("myUtility", () => {
  it("should do something", () => {
    // Mock context as needed
    const mockContext = {
      json: vi.fn(),
      req: { raw: { headers: new Headers() } },
    } as unknown as Context;

    // Test behavior
  });
});
```

For testing tRPC procedures directly (without HTTP layer):

```typescript
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../trpc/router";

// Create a caller with mocked context
const caller = appRouter.createCaller({
  user: { id: "user-1", role: "admin", isAnonymous: false },
  session: { id: "session-1" },
  requestId: "test-request-id",
  headers: new Headers(),
});

describe("xxxRouter", () => {
  it("should return data", async () => {
    const result = await caller.xxx.getAll();
    expect(result).toBeDefined();
  });
});
```

## Import Conventions

- Path alias `@/` maps to `apps/golf/api/src/`
- Domain imports: `@bokendell/golf-domains/{domain}` (schemas, services, types)
- Database: `@bokendell/golf-db` (Drizzle db instance)
- Shared: `@bokendell/core` (errors, utilities), `@bokendell/redis` (Upstash client)
- tRPC internals: `../trpc` (relative to router files)

## Common Gotchas

1. **Always add `.meta({ openapi: ... })`** -- without it, the procedure works via tRPC but NOT via REST
2. **Path params must match input schema keys** -- `path: "/users/{id}"` requires `z.object({ id: z.uuid() })` in input
3. **Regenerate OpenAPI spec** after adding/changing routers: `pnpm openapi:generate`
4. **Mount plain Hono routes BEFORE the `/api/v1/*` catch-all** in `app.ts`
5. **`protect: true`** in openapi meta is required for protected/admin procedures to show auth in the spec
6. **Services handle their own DB access** -- do NOT pass `db` in context or router handlers
7. **Use `z.void()` for no-input procedures** -- not `z.object({})` or `z.undefined()`
8. **The `errorHandling` middleware handles all AppError mapping** -- do not manually catch and re-throw as TRPCError in router handlers
9. **superjson transformer** means tRPC clients get proper Date/Map/Set types, but REST endpoints return plain JSON
10. **OpenAPI spec is git-tracked** at `apps/golf/api/openapi.json` -- commit it after regeneration
