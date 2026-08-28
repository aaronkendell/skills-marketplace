# API Patterns (Hono + oRPC)

All backend APIs use Hono as the HTTP layer with oRPC for typed RPC endpoints. The shared foundation lives in `@bokendell/api`.

The architecture is a **Hono-with-oRPC hybrid**:
- Plain Hono routes for streaming (SSE, AI chat), webhooks, OG/share pages, `.well-known`.
- A single oRPC router mounted at the catch-all (`router.all("/api/v1/*", orpcHandler)`) for all CRUD + queries + mutations. The oRPC router is itself composed of ~30 topic routers per app.

This shape matters for performance: oRPC's router-tree walk happens **once at server boot**, not per request. Per-request work is a hashmap lookup → procedure dispatch → handler. The composition graph + oRPC tree-build are the cold-start cost; routing is essentially free at steady state.

---

## Startup vs request performance

**Where time goes** (numbers from a fresh tsx-run audit; compiled production builds are faster but the shape is the same):

| Phase | Golf API | Hive API | Portfolio API | Notes |
|---|---|---|---|---|
| `<app>-composition/container` import | ~16s | ~14s | ~13s | All services + transitive deps load (drizzle, better-auth, mastra, posthog, pusher, AWS, OTel) |
| Full app import (incl. routes + middleware) | ~20s | n/a | n/a | Composition + Hono wiring + oRPC router build |
| Service registrations | 93 | 120 | 70 | Awilix `.singleton()` resolvers — services constructed lazily on cradle access |
| Per-test boot (router test) | ~17s wall | similar | similar | Vitest reload — every test file re-evaluates the graph |
| Per-test boot (no composition) | ~6s wall | ~6s | ~6s | Vitest framework only |
| Per-request (steady state) | ~5–50ms | ~5–50ms | ~5–50ms | oRPC dispatch + handler + DB |

**Read this two ways:**

1. **In production with always-on Fly machines, request latency dominates and the cold cost is invisible to users.** A 16s boot once at deploy, then ms-per-request thereafter. Don't chase startup unless you have a specific target.
2. **In tests and dev, the cold cost is paid every file/restart.** With ~416 test files across the three apps, even partial parallelism leaves tens of seconds of pure module-load overhead before assertions run. This *is* worth chasing.

The CLI-style optimizations described in `docs/context/patterns/cli.md` (per-service lazy modules in composition, lazy router imports) were tried and reverted — see the "Composition lazy-load" section below for the post-mortem.

---

## When to use oRPC vs Hono REST

| Situation | Use |
|-----------|-----|
| Standard CRUD, queries, mutations | oRPC procedure |
| Streaming responses (AI chat, SSE) | Hono REST route |
| Inbound webhooks (Linear, Vault, etc.) | Hono REST route |
| Special-purpose pages (OG images, AASA, share pages) | Hono REST route |
| Internal service-to-service calls | oRPC `internalProcedure` |

**Default to oRPC.** Only reach for plain Hono when oRPC genuinely doesn't fit.

---

## App setup

Every API app uses `createApiApp` from `@bokendell/api/app`:

```typescript
// apps/api/src/app.ts
import { createApiApp } from "@bokendell/api/app";
import { auth, sessionMiddleware } from "@bokendell/{app}-domains/auth";

export const app = createApiApp({
  authHandler: (req) => auth.handler(req),
  sessionMiddleware,
  orpcRouter,
  router,           // plain Hono router for non-oRPC routes
  inngestHandler,
  docs: {
    title: "Golf API",
    description: "...",
  },

  // Optional
  cors: golfCorsConfig,
  rateLimit: { store: new RedisStore({ client: redis }) },
  observability: {
    sentry: { dsn: config.SENTRY_DSN, environment: config.NODE_ENV },
    otel: { serviceName: config.OTEL_SERVICE_NAME, ... },
  },
});
```

`createApiApp` wires up: Better Auth handler, session middleware, oRPC endpoint, Inngest handler, OpenAPI/Scalar docs at `/reference`, CORS, rate limiting, observability, and the global error handler. You don't configure any of those individually.

---

## Context

### Type

```typescript
// lib/context/types.ts
import type { Context } from "hono";
import type { BetterAuthSession } from "@bokendell/{app}-domains/auth";

export interface AppContextVariables {
  requestId: string;
  user: BetterAuthSession["user"] | null;
  session: BetterAuthSession["session"] | null;
}

export type AppContext = Context<{ Variables: AppContextVariables }>;
```

### Helpers

```typescript
// lib/context/utils.ts
export function getContext(c: Context) {
  return {
    requestId: c.get("requestId") as string,
    user: c.get("user") as BetterAuthSession["user"] | null,
    session: c.get("session") as BetterAuthSession["session"] | null,
  };
}

export function requireUserId(c: Context): string {
  const user = c.get("user") as BetterAuthSession["user"] | null;
  if (!user?.id) throw new UnauthorizedError("Authentication required");
  return user.id;
}
```

### In oRPC context

```typescript
// The oRPC context factory — passed to createOpenApiFetchHandler
createContext: (c) => ({
  user: c.get("user"),
  session: c.get("session"),
  requestId: c.get("requestId"),
  headers: c.req.raw.headers,
})
```

### In oRPC context (golf) — `GolfApiContext` + `getCradle`

Golf runs oRPC. The request context is the **concrete** `GolfApiContext`
declared once in `apps/api/src/packages/api/procedures/base.ts` and threaded,
typed, into every handler via `os.$context<GolfApiContext>()`:

```ts
export interface GolfApiContext {
  user: BetterAuthSession["user"] | null;
  session: BetterAuthSession["session"] | null;
  apiKey?: { id?: string; [key: string]: unknown } | null;
  oauthToken?: { clientId: string; scope: string; sub?: string; exp?: number } | null;
  requestId: string;
  headers: Headers;
}
```

**The per-request Awilix `scope` is deliberately NOT on this type.** The adapter
(`createGolfApp`'s `extendContext`) injects it at runtime, but handlers reach the
resolved service graph through one accessor — never `context.scope` directly:

```ts
// the ONLY way handlers get services — resolves per-request from the cradle
const { roundService } = getCradle(context);
```

`getCradle`/`bindScope` accept a `ScopedContext` (`GolfApiContext & { scope? }`)
— the single seam type, used by ~3 functions; handlers only ever name
`GolfApiContext`.

> **Why scope is off the public context (a real constraint, not style).** The
> oRPC router type is published as `@bokendell/golf-client`'s `AppRouter`
> (`apps/api/dist/orpc.d.ts`). If `scope: AwilixContainer<AppCradle>` were on the
> context, that type would drag `awilix` **and** the whole `golf-composition` DI
> graph into the client's `.d.ts` — neither is a client dependency — and the
> tsdown dts bundler would have to inline composition's `typeof resolvers` cradle
> (rolldown-plugin-dts#219). Scope is request infrastructure, not API contract,
> so it stays off the type and rides the runtime object only. **Review flag:** a
> handler reading `context.scope` directly, or `scope` re-added to
> `GolfApiContext`, is wrong — use `getCradle(context)`.

---

## Procedure types

Procedures come from `createBaseOrpc` in `@bokendell/api/orpc`:

```typescript
// packages/api/orpc.ts (shared base)
import { createBaseOrpc } from "@bokendell/api/orpc";

export const {
  router,
  middleware,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} = createBaseOrpc();
```

Hive extends the base with machine and scoped procedures:

```typescript
// apps/api/src/packages/api/orpc.ts
export const machineProcedure = publicProcedure.use(/* requires API key or OAuth token */);
export const callerProcedure = publicProcedure.use(/* requires admin session, API key, or OAuth token */);
export function scopedProcedure(requiredScopes: HiveScope | HiveScope[]) { /* callerProcedure + scope check */ }
```

| Procedure | Auth check | Use for |
|-----------|-----------|---------|
| `publicProcedure` | None | Health checks, public endpoints |
| `protectedProcedure` | `ctx.user && ctx.session && !user.isAnonymous` | Logged-in user endpoints |
| `adminProcedure` | `protectedProcedure` + `user.role === "admin"` | Admin dashboard, internal ops |
| `machineProcedure` | API key or OAuth 2.1 access token | Service-to-service calls (Discord, CLI, MCP) |
| `callerProcedure` | Admin session, API key, or OAuth token | Any authenticated caller |
| `scopedProcedure(scopes)` | `callerProcedure` + `requireAnyScope()` | Domain routes with fine-grained authorization |

**Golf (oRPC)** has its own tier set in `apps/api/src/packages/api/procedures/`:
`publicProcedure`, `protectedProcedure`, `sessionProcedure([scopes])` (session
only), `apiProcedure([scopes])` (any credential), `adminProcedure` (role gate via
the audited `AccessPolicy`), and `adminAreaProcedure(area)` (role + `admin:<area>`
/ `admin:all`). The scope tiers **stamp `{ scopes, authTier }` onto route meta**
— the single source the OpenAPI generator reads for per-operation `security`, and
the derivation point for `visibility:"internal"`. A scope gate at the route is
only half the check — enforce the object-level rule in the service with a
**Policy**. See **`auth-and-scopes.md`** for the full Principal/scope/policy model.

---

## oRPC route pattern (contract-first)

Golf splits every feature in two: a **contract** that is pure schema, and a
**router** that implements it. This is the canonical pattern — copy it.

### 1. The contract — pure input/output/route, no middleware, no context

```typescript
// apps/api/src/packages/{domain}/{domain}.contract.ts
import { createListResponseSchema, paginationQuerySchema } from "@bokendell/core";
import { Scopes } from "@bokendell/golf-domains/context";
import { OPENAPI_TAGS } from "../api/openapi-tags";
import { apiContract, protectSecurity, sessionContract } from "../api/procedures/contract-tiers";

// Scopes live HERE and the router imports them, so the tier gate can't drift
// from the security the contract documents.
export const ROUNDS_READ_SCOPES = [Scopes.RoundsRead] as const;
export const ROUNDS_WRITE_SCOPES = [Scopes.RoundsWrite] as const;

const writeSession = sessionContract(ROUNDS_WRITE_SCOPES);
const readSession = sessionContract(ROUNDS_READ_SCOPES);
const liveApi = apiContract(ROUNDS_READ_SCOPES); // machine/caller credential tier

export const roundsContract = {
  create: writeSession
    .route({
      method: "POST",
      path: "/rounds",
      tags: [OPENAPI_TAGS.ROUNDS],
      summary: "Create a new round",
      spec: protectSecurity,
    })
    .input(createRoundRequestSchema)
    .output(roundDetailResponseSchema),

  getById: readSession
    .route({
      method: "GET",
      path: "/rounds/{id}",
      tags: [OPENAPI_TAGS.ROUNDS],
      summary: "Get round details",
      spec: protectSecurity,
    })
    .input(roundIdParamSchema)
    .output(roundDetailResponseSchema),

  invites: readSession
    .route({ method: "GET", path: "/rounds/invites", tags: [OPENAPI_TAGS.ROUNDS], spec: protectSecurity })
    .input(paginationQuerySchema.optional())
    .output(createListResponseSchema(inviteResponseSchema)),
};
```

`.route()` carries the real REST method + path — that IS the OpenAPI entry. There is
no separate `.meta({ openapi })` step.

### 2. The router — `implement(contract)`, tier middleware, handlers

```typescript
// apps/api/src/packages/{domain}/{domain}.orpc.router.ts
import { toRoundDetailResponse } from "@bokendell/golf-domains/rounds";
import { implement } from "@orpc/server";
import { getCradle, idempotencyMiddleware, listHandler } from "../api/orpc";
import type { GolfApiContext } from "../api/procedures/base";
import { apiTierMw, sessionTierMw } from "../api/procedures/tier-middleware";
import { ROUNDS_READ_SCOPES, ROUNDS_WRITE_SCOPES, roundsContract } from "./rounds.contract";

const base = implement(roundsContract).$context<GolfApiContext>();
const writeSession = base.use(sessionTierMw(ROUNDS_WRITE_SCOPES));
const readSession = base.use(sessionTierMw(ROUNDS_READ_SCOPES));
// Idempotency composes at the IMPLEMENTER level, above the handler
const writeSessionIdem = writeSession.use(idempotencyMiddleware);

export const roundsRouter = {
  create: writeSessionIdem.create.handler(async ({ input, context }) => {
    const { roundService } = getCradle(context);
    const round = await roundService.createRound(context.caller, input, context.user.id);
    return toRoundDetailResponse(round);
  }),

  getById: readSession.getById.handler(async ({ input, context }) => {
    const { roundService } = getCradle(context);
    return toRoundDetailResponse(await roundService.getById(input.id, context.user.id));
  }),
};
```

**Rules:**

- The contract imports NO middleware and NO request context. That is what lets the
  client type against it without dragging the deep `GolfApiContext` chains into the
  browser bundle.
- Scopes are declared once in the contract and imported by the router. Never spell a
  scope array twice.
- Always `.input()` and `.output()` — never skip the output schema.
- Handlers destructure `{ input, context }`. Resolve services with `getCradle(context)`
  — never import a service instance directly.
- `context.user.id` is non-null inside a session tier; `context.caller` is the
  principal for machine/API-tier routes.
- Map domain objects to responses with the `to{Entity}Response` helpers exported from
  `@bokendell/golf-domains/{domain}` — routers never hand-build a response object.
- List endpoints return the standard envelope via `createListResponseSchema(...)` →
  `{ data, total, limit, offset }`, built with `listHandler`.

---

## Error handling

### oRPC error architecture (golf)

Golf uses oRPC. The error stack has three layers:

**1. App-tier AppError bridge (required per app)**

Every procedure base gets a `try/catch` middleware that converts `AppError` subclasses thrown by domain services into typed `ORPCError`:

```typescript
// apps/api/src/packages/api/procedures/base.ts
import { mapStatusToOrpcCode } from "@bokendell/api/orpc";

function appErrorBridgeFn(cause: unknown, joinedPath: string): never {
    if (cause instanceof AppError || isAppErrorLike(cause)) {
        throw new ORPCError(mapStatusToOrpcCode(cause.statusCode), {
            status: cause.statusCode,
            message: cause.message,
            data: { errorCode: cause.errorCode, details: cause.details ?? null, zodError: null, path: joinedPath },
        });
    }
    throw cause;
}

export const publicBase = _bases.publicBase.use(async ({ next, path }) => {
    try { return await next(); }
    catch (cause) { appErrorBridgeFn(cause, path.join(".")); }
});
// protectedBase and internalBase get the same wrapper
```

`mapStatusToOrpcCode` is exported from `@bokendell/api/orpc`. The bridge belongs at the app tier — NOT in the domain, not in Awilix, not in core. See `ddd.md` for the decision tree.

**2. Typed procedure errors via `.errors()`**

Procedures with their own typed failure modes declare them via `.errors()`. Clients guard with `isDefinedError()` and discriminate by `.code`:

```typescript
// Declare on the procedure builder
export const aiSessionProcedure = protectedProcedure.errors({
    INSUFFICIENT_CREDITS: { status: 402, data: insufficientCreditsSchema },
    GUARDRAIL_BLOCKED:    { status: 400, data: z.object({ reason: z.string() }) },
});

// Throw in the handler
if (!hasCredits) {
    throw new ORPCError("INSUFFICIENT_CREDITS", { data: { creditsGranted: 100, creditsAvailable: 0, periodEnd: "..." } });
}

// Client-side discrimination
if (isDefinedError(err)) {
    if (err.code === "INSUFFICIENT_CREDITS") { /* typed data */ }
    if (err.code === "GUARDRAIL_BLOCKED")    { /* typed data */ }
}
```

No string maps, no registration side effects. Adding a new error: declare it in `.errors()`, add the bridge throw, add a client branch.

**3. INPUT_VALIDATION_FAILED (standard Zod validation code)**

oRPC's default Zod validation failure is `BAD_REQUEST` (400). Core's `createBaseOrpc` intercepts it and re-emits as `INPUT_VALIDATION_FAILED` (422) with flattened field errors:

```json
{
  "code": "INPUT_VALIDATION_FAILED",
  "status": 422,
  "data": {
    "formErrors": [],
    "fieldErrors": { "email": ["Invalid email"] }
  }
}
```

This is declared in `BASE_ERRORS` on every procedure via `createBaseOrpc`. Clients check `err.code === "INPUT_VALIDATION_FAILED"` and read `err.data.fieldErrors` for per-field detail.

---

### AppError → ORPCError mapping (hive / portfolio / swarm)

Apps still using oRPC catch `AppError` in a global middleware:

```typescript
// packages/api/orpc.ts
const errorHandling = t.middleware(async ({ next }) => {
  const result = await next();
  if (result.ok) return result;

  const error = result.error;
  const appError = error.cause instanceof AppError ? error.cause : null;

  if (error.code === "INTERNAL_SERVER_ERROR" && appError) {
    throw new ORPCError({
      code: mapStatusToOrpcCode(appError.statusCode),
      message: appError.message,
      cause: error.cause,
    });
  }

  if (error.code === "INTERNAL_SERVER_ERROR") {
    Sentry.captureException(error.cause ?? error);
  }

  throw error;
});

function mapStatusToOrpcCode(statusCode: number): ORPCErrorCode {
  const map: Record<number, ORPCErrorCode> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "UNPROCESSABLE_CONTENT",
  };
  return map[statusCode] ?? "INTERNAL_SERVER_ERROR";
}
```

### Error response format

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Round with id 'abc' not found",
    "data": {
      "errorCode": "NOT_FOUND",
      "details": { "resource": "Round", "id": "abc" },
      "zodError": null
    }
  }
}
```

### In oRPC routes (hive / portfolio / swarm)

```typescript
// Throw ORPCError directly in routes when needed
if (!result) {
  throw new ORPCError({ code: "NOT_FOUND", message: "Run not found" });
}

// For domain business logic errors — throw AppError in the service,
// let the middleware handle the mapping. Don't manually catch in routes.
```

---

## Auth in Hono REST routes

For non-oRPC routes (SSE, webhooks), apply `requireAuth` middleware directly:

```typescript
import { requireAuth, requireAdmin } from "@bokendell/{app}-domains/auth";

const chatRouter = new Hono<{ Variables: AppContextVariables }>();

chatRouter.use("*", requireAuth);       // protectedProcedure equivalent
// or
chatRouter.use("*", requireAdmin);      // adminProcedure equivalent

chatRouter.post("/", async (c) => {
  const userId = requireUserId(c);      // throws if missing
  // ...
});
```

---

## SSE / streaming routes

```typescript
// packages/{domain}/{domain}.sse.router.ts
import { createUIMessageStreamResponse } from "ai";
import { Hono } from "hono";
import { requireAuth } from "@bokendell/{app}-domains/auth";
import { aiRateLimiter } from "./ai.rate-limit";

export const aiStreamRouter = new Hono<{ Variables: AppContextVariables }>();

aiStreamRouter.use("*", requireAuth);
aiStreamRouter.use("*", aiRateLimiter);  // optional: per-route rate limiting

aiStreamRouter.post("/", async (c) => {
  const userId = requireUserId(c);
  const body = await c.req.json<{ messages: unknown[]; threadId?: string }>();

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: "messages array is required" }, 400);
  }

  const stream = await aiService.streamChat({
    threadId: body.threadId ?? crypto.randomUUID(),
    userId,
    body,
  });

  return createUIMessageStreamResponse({ stream });
});
```

Register in the router **before** the catch-all oRPC handler:

```typescript
// packages/api/v1/router.ts
routerV1.route("/api/v1/ai/chat/stream", aiStreamRouter);
routerV1.route("/api/v1/ai/transcribe", aiTranscribeRouter);
routerV1.all("/api/v1/*", orpcHandler); // oRPC catch-all last
```

---

## Webhook routes

```typescript
// packages/{domain}/{domain}.webhook.router.ts
export function create{Domain}WebhookRouter(deps: { secret: string | undefined }) {
  const app = new Hono();

  app.post("/", async (c) => {
    if (!deps.secret) {
      return c.json({ error: "Webhook secret not configured" }, 503);
    }

    const rawBody = await c.req.text();
    const signature = c.req.header("x-signature") ?? "";

    if (!verifyHmacSha256Signature({ secret: deps.secret, rawBody, signature })) {
      return c.json({ error: "Invalid signature" }, 401);
    }

    const payload = JSON.parse(rawBody) as unknown;

    // Freshness check (optional but recommended)
    if (!isFreshTimestamp(getTimestamp(payload))) {
      return c.json({ error: "Stale webhook timestamp" }, 401);
    }

    const result = await deps.service.handleWebhook(payload);
    return c.json(result, 200);
  });

  return app;
}
```

**Rules:**
- Always verify HMAC signature before processing
- Check timestamp freshness to prevent replay attacks
- Return 200 even for ignored events — never 4xx a valid but irrelevant webhook
- Parse raw body as text first for signature verification, then JSON parse

---

## Service factories (composition root)

**Phase 6 (2026-04-30): per-domain `*.service-factory.ts` files were collapsed into a single Awilix-wired `container.ts` per app.** The previous `lib/services/` pattern is gone; services now live in the composition package and resolve via the cradle.

```typescript
// packages/composition/src/container.ts
import { InjectionMode, asFunction, createContainer } from "awilix";
import { createRoundRepository, createRoundService } from "@bokendell/{app}-domains/rounds";
import { db } from "@bokendell/{app}-db";

export const container = createContainer<AppCradle>({ injectionMode: InjectionMode.PROXY });

container.register({
  roundRepository: asFunction(() => createRoundRepository({ db })).singleton(),
  // Awilix PROXY mode auto-resolves deps by name from the cradle. courseService
  // gets injected because the parameter destructure {courseService} in
  // createRoundService's signature matches a registered key.
  roundService: asFunction(({ roundRepository, courseService }) =>
    createRoundService({ roundRepository, courseService })
  ).singleton(),
  // ...
});
```

Route files reach the cradle via the request scope:

```typescript
// {domain}.orpc.router.ts
.query(async ({ ctx }) => {
  const { roundService } = ctx.scope.cradle;   // sync — services already constructed
  return roundService.getById(input.id, ctx.user.id);
});
```

Or, for plain Hono routes:

```typescript
chatRouter.post("/", async (c) => {
  const { aiService } = c.var.scope.cradle;
  // ...
});
```

**Rules:**
- Never `new RoundService(...)` or call a `create...Service` factory in a route handler. Always go through the cradle.
- Tests substitute services via `container.createScope().register({ roundService: asValue(mock) })` — never `vi.mock` of the composition barrel (it doesn't reach the cradle).
- See `docs/context/patterns/di.md` for the full Awilix patterns including transactions and request-scoped overrides.

---

## Pagination

Use the shared `paginationQuerySchema` for list endpoints:

```typescript
// Shared schema (from @bokendell/api or local)
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// In oRPC route
.input(paginationQuerySchema.optional())
.output(roundListResponseSchema)
.query(async ({ input }) => {
  const results = await service.list(input ?? { limit: 20, offset: 0 });
  return toRoundListResponse(results);
})
```

Response format for lists:

```typescript
export const roundListResponseSchema = z.object({
  data: z.array(roundResponseSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});
```

---

## OpenAPI tags

Centralize all tags in one file per app:

```typescript
// packages/api/openapi-tags.ts
export const OPENAPI_TAGS = {
  HEALTH: "health",
  ROUNDS: "rounds",
  COURSES: "courses",
  USERS: "users",
  AI: "ai",
  // ...
} as const;
```

Use the constant in all route `.meta()` — never hardcode tag strings.

---

## Config

Each app has a Zod env schema. Extend the base schema from `@bokendell/api`:

```typescript
// lib/config.ts
import { baseEnvSchema } from "@bokendell/api/config";

const envSchema = baseEnvSchema.extend({
  // App-specific env vars
  GOLFBERT_API_TOKEN: z.string().optional(),
  ABLY_API_KEY: z.string().min(1),
  APP_SCHEME: z.string(),
  APPLE_TEAM_ID: z.string(),
  APPLE_BUNDLE_IDS: z.string().transform((s) => s.split(",").map((id) => id.trim())),

  // Observability (optional)
  SENTRY_DSN: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;
```

`baseEnvSchema` provides: `NODE_ENV`, `PORT`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.

---

## Special-purpose Hono routes

For routes that don't fit oRPC (Apple AASA, OG images, shareable preview pages):

```typescript
// packages/well-known/well-known.router.ts
export const wellKnownRouter = new Hono();

wellKnownRouter.get("/apple-app-site-association", (c) => {
  c.header("Content-Type", "application/json");
  c.header("Cache-Control", "public, max-age=86400");
  return c.json({ applinks: { ... } });
});
```

```typescript
// packages/share/share.router.ts — OG preview HTML pages
export const shareRouter = new Hono();

shareRouter.get("/round/:id", async (c) => {
  const id = c.req.param("id");
  c.header("Cache-Control", "public, max-age=300");
  return c.html(ogPage({ title: "You're invited to a round", ... }).html);
});
```

Register before the oRPC catch-all:

```typescript
// packages/api/router.ts
router.route("/.well-known", wellKnownRouter);
router.route("/share", shareRouter);
router.route("/og", ogRouter);
router.route("/", routerV1); // oRPC lives here
```

---

## CORS (mobile apps)

Apps with React Native clients need custom CORS to handle:
- Null/undefined `Origin` header (React Native sends none)
- Mobile app scheme (`golf://`)
- Expo dev client (`exp://`)
- Local IPs in development (`192.168.x.x`)

```typescript
// lib/middleware/cors.ts
export const mobileCorsConfig = {
  origin: (origin: string) => {
    const allowed = [
      `https://${config.DOMAIN}`,
      `${config.APP_SCHEME}://`,
    ];
    if (!origin) return allowed[0]; // React Native: allow, return first origin
    if (allowed.includes(origin)) return origin;
    if (config.NODE_ENV === "development") {
      if (origin.startsWith("exp://") || origin.startsWith("http://192.168.")) return origin;
    }
    return null;
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "expo-origin", "Cookie"],
  exposeHeaders: ["Content-Length", "Set-Cookie"],
  maxAge: 600,
  credentials: true,
};
```

Web-only apps can use a simple origin array instead.

---

## Repo structure (golf is canonical)

Each app is its own repo in the sibling-clone workspace — there is no `apps/golf/`
prefix. Inside the repo:

```
golf/
├── apps/
│   ├── api/src/
│   │   ├── lib/{auth,context,middleware}/
│   │   └── packages/
│   │       ├── api/                          # the oRPC kernel
│   │       │   ├── contract.ts               # apiContractV1 — every contract merged
│   │       │   ├── orpc.ts                   # getCradle, listHandler, idempotency barrel
│   │       │   ├── idempotency.ts
│   │       │   ├── list-handler.ts
│   │       │   ├── openapi-meta.ts
│   │       │   ├── openapi-tags.ts           # OPENAPI_TAGS constant
│   │       │   ├── procedures/
│   │       │   │   ├── base.ts               # GolfApiContext + os.$context<GolfApiContext>()
│   │       │   │   ├── contract-tiers.ts     # sessionContract() / apiContract()
│   │       │   │   ├── tier-middleware.ts    # sessionTierMw() / apiTierMw()
│   │       │   │   ├── ratelimiters.ts
│   │       │   │   ├── route-security.ts
│   │       │   │   └── scoped.ts
│   │       │   ├── root/orpc.router.ts       # mounted at "/" — permalinks, no version
│   │       │   └── v1/orpc.router.ts         # mounted at "/api/v1"
│   │       └── {domain}/                     # ~45 feature packages
│   │           ├── {domain}.contract.ts
│   │           ├── {domain}.orpc.router.ts
│   │           ├── {domain}.orpc.router.test.ts
│   │           ├── {domain}.orpc.router.utils.ts
│   │           └── {domain}.admin.contract.ts + .admin.orpc.router.ts   # if it has an admin surface
│   ├── admin/      # Refine admin
│   ├── design/     # design studio
│   ├── inngest/    # async jobs + crons
│   ├── marketing/  # marketing site
│   ├── mobile/     # Expo
│   └── workers/    # standalone Hono worker server (src/server.ts)
└── packages/
    ├── client/       # oRPC client + the canonical `q` query builders
    ├── composition/  # Awilix container, env, app factory
    ├── domains/      # all business logic (DDD)
    ├── config/ db/ e2e/ emails/ performance/ public-assets/ render/ surfaces/ tokens/ ui/
```

### Two mounted surfaces, plus root

`createGolfApp` serves the **REST** surface at `/api/v1` (paths come from each
contract's `.route({ method, path })`) and the **RPC** surface at `/api/rpc`. The
version is a route prefix on the version's router, so `{ v1, v2 }` serve at
`/api/v1/...` and `/api/v2/...`.

`root/orpc.router.ts` mounts on a **second** `OpenAPIHandler` at prefix `/` with no
version — OG images, share redirects, `.well-known`. These are permalinks that
crawlers, email proxies, and OS deep-link handlers embed in long-lived places;
versioning them would break cached links.

### packages/composition — the composition root

```
packages/composition/src/
├── app.ts                # createGolfApp(opts) — mounts the handlers, CORS, middleware
├── container.ts          # AppCradle, container, runInScope(), withTransaction(), warmGolfCradle()
├── functions.ts          # createGolfFunctions() — the Inngest registry
├── env.ts                # zod-validated env (+ env-infisical / env-required / env-test-defaults)
├── openapi-contract.ts   # the published contract shape
└── hono.d.ts
```

### packages/domains — one directory per domain

```
packages/domains/src/packages/{domain}/
├── domain/          # pure logic — entities, guards, constants, types, utils. No I/O.
├── application/     # services: orchestration + transactions
├── infrastructure/  # repositories, renderers, vendor adapters
├── presentation/    # response schemas + to{Entity}Response mappers
├── integration/     # cross-domain wiring
├── client.ts        # BROWSER-SAFE public surface
├── internal.ts      # SERVER-ONLY surface
└── index.ts         # barrel
```

The `client.ts` / `internal.ts` split is load-bearing, not cosmetic. Anything a
browser bundle can import goes in `client.ts`; anything that reaches for
`node:async_hooks`, the DB, or a vendor SDK stays behind `internal.ts`. Importing a
server-only subpath from the admin or studio bundle is how you break the build.

---

## AI execution

All AI calls flow through `aiService` (`packages/domains/src/packages/ai/application/ai.service.ts`):

- `aiService.generate({...})` — one-shot generations
- `aiService.stream({...})` — streaming chat
- `aiService.transcribe({...})` — voice STT
- `aiService.threads.{ensure, injectEvent, patchContextFlag}` — memory writes
- `aiService.models.resolveByRole(role)` — read-only role lookup

Required fields on every call: `userId`, `feature`, `modelRole`, `agentId`, `idempotencyBase`. Agents come from the typed `AGENT_IDS` const.

Banned outside the AI module: `import { Agent }` and `import { createTool }` from `@mastra/core/*` (Biome lint enforces). Use `createMeteredAgent` and `createMeteredTool` instead.

Context propagation: `aiService` enters `runWithAiContext` (AsyncLocalStorage) so the metering output processor wired on every agent reads userId/feature/etc and writes `ai_usage_events` automatically.

Spec: `docs/superpowers/specs/2026-04-25-ai-service-unification-design.md`

---

## Composition lazy-load (test + cold-start optimization)

**Status (2026-05-07): applied to all three apps via `scripts/lazify-container.mjs`.** Most of what's below is the architecture and how to maintain it; the original "future work" framing is preserved for the per-oRPC-router refactor that's still optional.

### Current state — what's already lazy

- Every `asFunction(...)` factory in `packages/{golf,hive,portfolio}/composition/src/container.ts` lazy-requires its service module via `require(...)` inside the factory body. The module + its transitive deps only load when the cradle key is first accessed.
- `setGolfInngestScopeFactory` (and hive/portfolio equivalents) is wrapped in a `wireXxxInngestScope()` function called from `createXxxFunctions()` — only Inngest-running surfaces (workers) pay for the events module.
- Logger init in each app's `app.ts` uses `createLazyAppLogger(...)` from `@bokendell/observability/log` — pino + sentry + otel transports only initialize on first log call.
- `warmGolfCradle()` / `warmHiveCradle()` / `warmPortfolioCradle()` are exported from each container; production `server.ts` calls them when `NODE_ENV === "production"` to flip the lazy graph into "all warm" mode before serving requests. Tests/dev stay lazy.
- Vitest config in `@bokendell/testing` uses `pool: "threads"` with `isolate: false` by default — modules cache across files in the same worker. Set `VITEST_ISOLATE=1` to opt out.
- Architecture rule `no-eager-service-imports` (in `packages/domains/src/packages/check/.../no-eager-service-imports-rule.ts`) flags any new static value import in a `container.ts` that would re-introduce eager loading. Run via `pnpm swarm check arch`.
- Smoke benchmarks in `packages/{golf,hive,portfolio}/composition/__bench__/composition-load.bench.ts` track regression of the cold container load time.

> ⚠ **REVERSED 2026-05-13.** Lazy `require()` inside `asFunction` bodies + `warmCradle()` on production boot caused `MODULE_NOT_FOUND` crash loops because tsup left the lazy requires as runtime calls and Node can't resolve `.ts` subpath exports at runtime. All four containers now use top-level `import { … } from "@bokendell/<app>-domains/<sub>"` statements. The `no-eager-service-imports` arch rule + `scripts/lazify-container.mjs` codemod were removed. Sections below are kept for historical context; do not follow them.

### Maintaining: the lazify codemod

Don't hand-edit container.ts to lazify a new import. Add the static `import { createXService } from "@bokendell/X-domains/Y"` normally, then re-run:

```bash
node scripts/lazify-container.mjs packages/composition/src/container.ts \
  '^@bokendell/(golf-domains|analytics|emails|events|redis|realtime|storage|push-notifications)'
```

The script (idempotent; safe to re-run) finds every named import whose symbols are referenced ONLY inside `asFunction(...)` factories, inlines a `require(...)` inside each factory body, and removes the static import. Symbols referenced in `asValue(...)` or at module top-level are left alone — they need their values eagerly.

The `no-eager-service-imports` arch rule fails CI if you forget to run the codemod after adding a new import.

### Pre-existing "future work" — per-oRPC-router lazy chunks

Each app's v1 oRPC router still statically imports ~30 sub-routers. Worth doing for cold-start if a deploy target uses serverless-with-scale-to-zero; not material for always-on Fly machines.

The pattern matches the swarm-cli optimizations in `docs/context/patterns/cli.md`. Two refactors compound; do them in order.

### A. Per-service lazy modules in composition packages

**The bottleneck:** importing `@bokendell/golf-composition/container` evaluates 93 service factories at module load. Most are unused for any given test or first request. With Awilix `.singleton()` resolvers, services are **constructed** lazily on cradle access — but the underlying *modules* (better-auth, drizzle, AWS SDK, mastra, etc.) load eagerly because the static `import` statements at the top of `container.ts` resolve them.

**The shape:**

```typescript
// packages/composition/src/container.ts — AFTER
import { InjectionMode, asFunction, createContainer } from "awilix";
// All service-factory imports become dynamic — no static `import { createRoundService }`.

container.register({
  roundService: asFunction(async () => {
    // Module loads only when this factory runs (i.e. first cradle access).
    const { createRoundService, createRoundRepository } = await import("@bokendell/golf-domains/rounds");
    const { db } = await import("@bokendell/golf-db");
    return createRoundService({
      roundRepository: createRoundRepository({ db }),
      courseService: container.cradle.courseService,
    });
  }).singleton(),
  // ... 92 more
});
```

The cradle return type changes from `RoundService` to `Promise<RoundService>`, and consumers add an `await`:

```typescript
// BEFORE
const { roundService } = ctx.scope.cradle;
const round = await roundService.getById(id);

// AFTER
const roundService = await ctx.scope.cradle.roundService;
const round = await roundService.getById(id);
```

A codemod across the ~200 router files in golf+hive+portfolio is the bulk of the work.

**Pre-warm in production.** Add a `composition.warm()` that resolves every cradle key in parallel; production deploys call it on boot to keep "everything ready before first request" semantics:

```typescript
// packages/composition/src/container.ts
export async function warmCradle(): Promise<void> {
  await Promise.all(Object.keys(container.registrations).map((k) => container.cradle[k]));
}
```

```typescript
// apps/api/src/server.ts
await warmCradle();   // optional — production: yes; tests: skip
startHonoServer({ /* ... */ });
```

This flips A from "lazy on first request" to "explicit eager but parallel" in one call. Tests stay lazy (huge speedup); production stays warm.

**Effect:**
- Test files that touch one router load ~5 service modules instead of all 93. Easily 5–10× faster test suite per app.
- `turbo dev` first-request latency: 16s → 1–2s + per-request lazy fill.
- Steady-state production: identical (services already warm).
- CLI `swarm admin create --app=golf`: ~16s → ~3–5s (only `usersService` chain loads).

### B. Per-oRPC-router lazy chunks

**The bottleneck:** the v1 oRPC router statically imports ~30 sub-routers. oRPC walks all of them at server build time to construct its dispatch table. This adds to cold-start; per-request is unaffected (dispatch is already a hashmap).

**The shape** (only worth doing if you also do A or if the v1-router build time is profiled as a meaningful cold-start cost):

```typescript
// apps/api/src/packages/api/v1/orpc.router.ts — AFTER
import { router } from "../orpc";

const ORPC_TOPIC_LOADERS = {
  ai:        () => import("../../ai").then(m => m.aiRouter),
  courses:   () => import("../../courses").then(m => m.coursesRouter),
  rounds:    () => import("../../rounds").then(m => m.roundsRouter),
  // ... 30 entries
} as const;

export async function buildOrpcRouterV1() {
  const entries = await Promise.all(
    Object.entries(ORPC_TOPIC_LOADERS).map(async ([id, load]) => [id, await load()] as const),
  );
  return router(Object.fromEntries(entries));
}
```

```typescript
// apps/api/src/app.ts — AFTER
const orpcRouter = await buildOrpcRouterV1();
export const app = createApiApp({ orpcRouter, /* ... */ });
```

Each topic becomes its own chunk. Combined with A, only the topic + services hit by the current request actually load.

This is roughly the same shape as the swarm-cli per-topic split, just adapted for the API's single oRPC tree (no `firstPositional`-based slimming — the API needs the full tree to dispatch any request, but loads the chunks in parallel rather than statically).

### What about plain Hono routes?

Don't bother. Hono's per-request work is already a trie lookup against the registered route table — there's no eager evaluation of route handler *bodies*. Lazy-loading SSE / webhook / OG handlers would only save boot time, and they're a much smaller part of the graph than the oRPC subtree. Skip it.

### Shared schema-only barrels for CLI consumers

**Background:** when the CLI uses an app's domain (e.g. `swarm admin create` reaches into `golf-domains` for `createAdmin`), it shouldn't drag the whole barrel — services + better-auth + everything. The swarm-domains pattern of `<group>/cli` schema-only sub-paths solves this:

```jsonc
// packages/domains/package.json
{
  "exports": {
    "./users": "./src/packages/users/index.ts",            // full barrel — pulls drizzle, better-auth
    "./users/cli": "./src/packages/users/cli.ts"           // NEW — schemas + types only
  }
}
```

```typescript
// packages/domains/src/packages/users/cli.ts
export * from "./presentation/schemas/users.input.schema";
export * from "./presentation/schemas/users.output.schema";
```

**Do it on demand**, only for groups the CLI imports schemas from. Most domain consumers (the API itself, mobile clients) want the full barrel.

### Skinny mode for tests

Once services are lazy (refactor A), add a `services` filter to `createApiApp`:

```typescript
// Test:
const app = createGolfApp({
  // Only register these oRPC routers — others get a 404 at /api/v1/<other>/*
  services: ["users", "auth"],
  orpcRouter: pick(orpcRouterV1, ["users", "auth"]),
  /* ... */
});
```

Each test file declares which subgraph it needs. With per-service lazy + skinny mode, a router test loads ~5 modules instead of 1500. Combined effect: 10× faster test suite.

### Recommended order for the apps

1. swarm-cli: A + B (template; in progress).
2. `golf-composition` (biggest, 93 services): A only — codemod handler call sites for the await.
3. `hive-composition` + `portfolio-composition`: apply the codemod from step 2.
4. `createGolfApp` / `createHiveApp` / `createPortfolioApp` skinny-mode for tests.
5. `apps/api` per-oRPC-router lazy: only if cold-start is still painful.
6. Add `<group>/cli` schema barrels in domains packages on-demand, when the CLI reaches in.

Roughly a week of focused work for steps 2–4. The biggest user-visible win is integration-test runtime; production behavior is essentially unchanged.
