# Dependency Injection — Awilix Container Pattern

Every backend app (golf, portfolio, hive) uses [Awilix](https://github.com/jeffijoe/awilix) for service composition. Single composition file (`container.ts`) per app, ports + adapters in shared packages, services consumed from a per-request container scope.

> Full migration history + decisions: `docs/architecture/di-refactor-plan.md`

---

## TL;DR

- **One container per app** at `packages/{app}/composition/src/container.ts` — registers every service via `asFunction(...).singleton()`.
- **Domain code never imports vendor SDKs.** Shared packages (`@bokendell/realtime`, `@bokendell/events`, `@bokendell/redis`, etc.) own the ports + adapters.
- **Routers consume services from `ctx.scope.cradle.serviceName`** — per-request Awilix child scope on tRPC ctx.
- **Tests substitute services via `scope.register({ X: asValue(mock as any) })`** — not `vi.mock` of the composition barrel.

---

## File layout

```
packages/{app}/composition/src/
├── container.ts          # SINGLE source of truth — Awilix registrations
├── functions.ts          # Inngest function wiring (resolves from container.cradle)
├── app.ts                # createXApp() — wires HTTP app, injects scope into tRPC ctx
├── env.ts                # zod-validated env config
└── services/
    └── index.ts          # Optional back-compat re-export barrel (golf + portfolio still have one; hive deleted theirs)
```

The `*.service-factory.ts` files that used to live in `services/` are gone. All construction happens inline in `container.ts` as `asFunction` registrations.

---

## Building a container

```typescript
// packages/{app}/composition/src/container.ts
import { asFunction, asValue, createContainer, type InferCradleFromResolvers } from "awilix";
import { db } from "@bokendell/{app}-db";
import { config } from "./env";
import { createCacheOrFallback } from "@bokendell/redis";
import * as Sentry from "@sentry/node";
// ... imports for create*Service, repo factories, hooks

const resolvers = {
  // Values
  db: asValue(db),
  config: asValue(config),

  // Adapters with conditional/Sentry-hooked construction
  cache: asFunction(() =>
    createCacheOrFallback({
      onFallback: (error) => {
        console.error("[{app}-composition] Redis unavailable — using NoOpCache", error);
        Sentry.captureMessage("[{app}] Cache fallback: Redis unavailable, using NoOpCache", {
          level: "error",
          extra: { error: String(error) },
        });
      },
    }),
  ).singleton(),

  // Repositories — auto-resolve `db` via cradle (PROXY mode)
  someRepository: asFunction(({ db }) => createSomeRepository({ db })).singleton(),

  // Services — auto-resolve their deps via cradle
  someService: asFunction(({ someRepository, otherService }) =>
    createSomeService({ someRepository, otherService }),
  ).singleton(),
} as const;

/**
 * Awilix infers the cradle type from the resolvers object — no manual interface.
 */
export type AppCradle = InferCradleFromResolvers<typeof resolvers>;

export const container = createContainer<AppCradle>().register(resolvers);
```

### Critical pitfalls (learned during migration)

1. **Don't annotate `asFunction` factory params with `: AppCradle`.** It triggers a TS recursion stack overflow because `AppCradle` is derived from the same resolvers object. Leave them as inferred `any` — public consumers still get the typed `AppCradle` via `InferCradleFromResolvers`.

2. **`db.transaction(tx => ...)` loses inference when `db` comes through the cradle** (cradle params are inferred as `any`). Inside any resolver that needs typed transaction support, import `db` directly from `@bokendell/{app}-db` rather than destructuring from cradle. Document with a comment.

3. **Conditional adapters need their conditional inside the `asFunction` body.** Env-gated clients (golfbertClient, R2 vs unavailable storage, NoOp threadInjector when SKIP_AI_INNGEST) all stay env-conditional — just inside the resolver, not at module load.

4. **Lazy/circular factories**: if a service needs to resolve another service lazily to break a module cycle, accept `cradle: any` and expose loaders that read from cradle. Example from portfolio:
   ```typescript
   aiToolActionService: asFunction((cradle: any) =>
     createAiToolActionService({
       loadContactService: async () => cradle.contactService,
     }),
   ).singleton(),
   ```

5. **No eager back-compat exports at the bottom.** `export const X = container.cradle.X` at module scope forces eager resolution of every service when the container is imported. This breaks tests that mock domain barrels (e.g. `vi.mock("@bokendell/{app}-domains/ai")`). Hive removed all its eager exports for this reason. Golf + portfolio still have them but no test currently mocks the AI domain — clean up if/when needed.

---

## Wiring tRPC ctx

Each app's tRPC ctx gains a `scope: AwilixContainer<AppCradle>` field. Created per-request, inherited from root container.

```typescript
// apps/{app}/api/src/packages/api/trpc.ts
import type { AppCradle } from "@bokendell/{app}-composition/container";
import type { AwilixContainer } from "awilix";

export interface TRPCContext {
  user: BetterAuthSession["user"] | null;
  session: BetterAuthSession["session"] | null;
  requestId: string;
  headers: Headers;
  scope: AwilixContainer<AppCradle>;  // ← per-request Awilix child container
}
```

Then wire `extendContext` in the app builder:

```typescript
// packages/{app}/composition/src/app.ts
import { container } from "./container";

return createApiApp({
  // ... rest of config
  extendContext: () => ({ scope: container.createScope() }),
});
```

For OpenAPI fetch handlers (golf has one), wire scope in the manual `createContext`:

```typescript
// apps/{app}/api/src/packages/api/v1/router.ts
import { container } from "@bokendell/{app}-composition/container";

routerV1.all("/api/v1/*", async (c) =>
  createOpenApiFetchHandler({
    // ... rest
    createContext: () => ({
      // ... rest
      scope: container.createScope(),
    }),
    req: c.req.raw,
  }),
);
```

### Hive variant: `getCradle(ctx)` helper

Hive uses the shared `createBaseTrpc()` from `@bokendell/api/trpc`, which has its own typed BaseApiContext. Rather than redefining the whole tRPC instance per-app, hive uses a `getCradle(ctx)` accessor:

```typescript
// apps/hive/api/src/packages/api/trpc.ts
import type { AppCradle } from "@bokendell/hive-composition/container";

export function getCradle(ctx: any): AppCradle {
  return ctx.scope.cradle;
}
```

Procedures call `getCradle(ctx).serviceName` (or destructure). The `any` param dodges TS middleware narrowing that strips fields after `protectedProcedure.use(...)`.

---

## Consuming services in routers

Inside each procedure, destructure services from `ctx.scope.cradle`:

```typescript
// Golf / portfolio pattern
.mutation(async ({ input, ctx }) => {
  const { roundService, sideBetService } = ctx.scope.cradle;
  await assertRoundMember(roundService, input.roundId, ctx.user.id);
  return await sideBetService.createSideBet(input);
})

// Hive pattern (uses helper)
.mutation(async ({ input, ctx }) => {
  const { contactService } = getCradle(ctx);
  return await contactService.create(input);
})
```

### Helpers that close over services

If a router has a module-level helper that needs services, refactor it to take services as parameters rather than closing over module-scope imports:

```typescript
// Before
async function assertRoundMember(roundId: string, userId: string) {
  try { await roundService.getRoundById(roundId, userId); }
  catch { throw new TRPCError({ code: "FORBIDDEN", message: "..." }); }
}

// After
import type { RoundService } from "@bokendell/golf-domains/rounds";

async function assertRoundMember(roundService: RoundService, roundId: string, userId: string) {
  try { await roundService.getRoundById(roundId, userId); }
  catch { throw new TRPCError({ code: "FORBIDDEN", message: "..." }); }
}

// Caller (inside procedure):
const { roundService } = ctx.scope.cradle;
await assertRoundMember(roundService, input.roundId, ctx.user.id);
```

### Procedures without `ctx`

Procedures previously typed as `({ input }) => ...` need widening to `({ input, ctx }) => ...` to access scope.

---

## Transactions (Awilix-native, golf only today)

Services that need atomic multi-write operations use a `withTransaction` helper exported from the composition. **The service decides what's atomic; routes don't wrap themselves.**

### Why service-level (not route-level)

- **Read queries don't need transactions** — burning a connection for nothing
- **Long-running routes shouldn't hold transactions** — AI streams + uploads + external APIs cause lock contention
- **Some routes intentionally do non-atomic work** — sending emails / publishing events shouldn't roll back
- **Transactions are aggregate consistency boundaries** — that's a SERVICE concern (service knows the invariants), not a ROUTE concern

### How it works

```
HTTP request
  ↓
tRPC base middleware: runInScope(ctx.scope, () => next())
                         ↑
                         AsyncLocalStorage binds the scope as "current"
  ↓
Procedure calls service.someMutation(input)
  ↓
Service calls withTransaction(async (txScope) => { ... })
                ↑
                getCurrentScope() reads ALS, opens db.transaction,
                child scope re-resolves .scoped() repos with tx db
  ↓
Inside the callback: txScope.cradle.{roundRepository,scoringService} are tx-bound
```

### Adding a new transactional service

1. **Mark its repos `.scoped()`** in container.ts (so child scopes re-resolve them):
   ```typescript
   myRepo: asFunction(({ db }) => createMyRepo({ db })).scoped(),
   ```

2. **If the service depends on tx-scoped repos AND will be used inside `withTransaction`'s `txScope.cradle`, mark the service `.scoped()` too.** Otherwise the singleton gets root repos and tx isolation silently breaks.

3. **Use `withTransaction(fn)` from inside service code** (not from routes):
   ```typescript
   import { withTransaction } from "@bokendell/golf-composition/container";
   
   async someMutation(input) {
     return await withTransaction(async (txScope) => {
       const { myRepo, otherService } = txScope.cradle;
       await myRepo.update(...);
       await otherService.doStuff(...);
     });
   }
   ```

   But — this is a circular import (domains can't import composition). Pattern used in golf today: pass `runInTransaction` as a service dep with the same shape, have container.ts wire it to `withTransaction`. See `roundService` registration in `packages/golf/composition/src/container.ts` for the template.

### Transactions outside HTTP requests (Inngest functions, scripts)

Inngest function handlers don't bind a scope automatically (Inngest middleware doesn't expose a clean handler-wrapping hook — would require `AsyncLocalStorage.enterWith` with rebind caveats per function execution). When you add an Inngest function that needs to call a service method using `withTransaction`, wrap the handler body explicitly:

```typescript
// In your Inngest function definition
import { container, runInScope } from "@bokendell/golf-composition/container";

return inngest.createFunction(
  { id: "my-function" },
  { event: "..." },
  async (ctx) => {
    return runInScope(container, async () => {
      // Now any service called inside can use withTransaction
      await someService.doTransactionalThing();
    });
  },
);
```

For scripts and ad-hoc bootstraps:
```typescript
import { container, runInScope } from "@bokendell/golf-composition/container";

await runInScope(container, async () => {
  await someService.someMethod(); // can call withTransaction internally
});
```

**Today none of golf's 19 Inngest functions need this** — none call transactional service methods. Add the wrapper if/when one does. The pattern is the same across portfolio + hive (just import from their respective `@bokendell/{app}-composition/container`).

### Pitfall: `withTransaction` throws if no scope is bound

If you see `[golf-composition] No scope bound — getCurrentScope/withTransaction called outside a request context`, you called the helper outside `runInScope`. Either:
- The tRPC middleware isn't wrapping requests (broken setup)
- You're calling from an Inngest function / script without `runInScope(container, ...)`
- You're calling from a Hono module-load helper that runs before any request

### Status across apps

- **Golf** ✅ — `withTransaction` + `runInScope` + ALS implemented. tRPC middleware binds scope per request. roundService uses Awilix-native runInTransaction.
- **Portfolio** — no transactional services today, helper not implemented (add when needed; copy from golf)
- **Hive** — no transactional services today, helper not implemented (add when needed; copy from golf)

---

## Inngest functions

Inngest function executions aren't request-scoped. Resolve from the root container:

```typescript
// packages/{app}/composition/src/functions.ts
import { container } from "./container";

export function create{App}Functions() {
  const {
    aiService,
    roundService,
    // ... all services this app's functions need
  } = container.cradle;

  // Build functions with these deps as before
  const someFunction = createSomeFunction({ aiService, roundService });
  // ...

  return [someFunction, ...];
}
```

---

## Tests

### Boundary mock pattern (the new way)

Use `scope.register({ X: asValue(mock as any) })` instead of `vi.mock` of the composition barrel:

```typescript
import type { AppCradle } from "@bokendell/{app}-composition/container";
import { asValue, createContainer } from "awilix";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { someRouter } from "./some.trpc.router";

// Define mocks directly — not in vi.mock factory
const someService = {
  doThing: vi.fn(),
  otherThing: vi.fn(),
};

function makeCtx(overrides: Partial<TRPCContext> = {}): TRPCContext {
  const scope = createContainer<AppCradle>().register({
    // biome-ignore lint/suspicious/noExplicitAny: test-only mock substitution
    someService: asValue(someService as any),
  });
  return {
    user: { id: "user-1", email: "test@example.com", role: "user" } as never,
    session: { id: "session-id" } as TRPCContext["session"],
    requestId: "req-id",
    headers: new Headers(),
    scope,
    ...overrides,
  };
}

describe("someRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does the thing", async () => {
    someService.doThing.mockResolvedValue(/* ... */);
    const caller = someRouter.createCaller(makeCtx());
    await caller.doThing({ ... });
    expect(someService.doThing).toHaveBeenCalledWith(/* ... */);
  });
});
```

### Hive variant

Hive's vitest config sets `OPENAPI_GENERATE: "true"` so importing `container.ts` skips the boot-time DB lookup in `system-user.ts`. Production has the user; tests don't need it.

### Why not vi.mock?

Once routers consume from `ctx.scope.cradle`, `vi.mock("@bokendell/{app}-composition/services")` has no effect — the routers don't import from the barrel anymore. They read from the per-request scope. Substituting at the scope level is cleaner anyway: it's per-test, scoped, and leaves the rest of the cradle (real or mocked) intact.

---

## When to add a new service to the container

1. Pick a name (must match what callers will destructure as).
2. Decide singleton vs scoped (default: `.singleton()` — switch to `.scoped()` only when you have per-request transaction semantics that need fresh instances).
3. Add the registration:
   ```typescript
   newService: asFunction(({ db, someOtherService }) =>
     createNewService({ db, someOtherService }),
   ).singleton(),
   ```
4. PROXY mode auto-resolves the destructured params from cradle by name.
5. Type-check: `pnpm turbo check-types --filter='@bokendell/{app}-composition'`.

If you accidentally typo the dep name in destructure (e.g. `someOhterService`), TypeScript won't catch it (cradle params are `any`), but Awilix will throw at first resolution with `AwilixResolutionError: Could not resolve 'someOhterService'`. Add the service to a route + run a quick smoke test to catch.

---

## Shared ports + adapters

Domain code never imports a vendor SDK directly. Use the shared port:

| Concern | Shared package | Port | Adapters available |
|---|---|---|---|
| Cache | `@bokendell/redis` | `Cache` | `createRedisCache`, `createNoOpCache`, `createCacheOrFallback` (with onFallback hook) |
| Email | `@bokendell/emails` | `EmailService` | `createResendEmailService` (with onSendFailure hook), `createNoOpEmailService` |
| Push notifications | `@bokendell/push-notifications` | `PushNotificationService` | `createExpoPushService` (with onSendFailure hook), `createNoOpPushService` |
| Realtime | `@bokendell/realtime` | `RealtimePublisher` | `createPusherRealtimePublisher` (with onError hook), `createNoOpRealtimePublisher` |
| Event bus | `@bokendell/events` | `EventBus` | `createInngestEventBus` (with onPublishFailure hook), `createNoOpEventBus` |
| Analytics | `@bokendell/analytics/node` | `AnalyticsAdapter` | `createPostHogAdapter` (with onError hook), `createNoOpAnalyticsAdapter` |
| Storage | `@bokendell/storage` | `StorageGateway` | `createR2StorageGateway`, `createUnavailableStorageGateway` |

### Pattern: intentional NoOp vs incident fallback

Each port has a NoOp impl (silent — for tests/intentional disable) AND a fallback variant where the caller wires a Sentry hook so unintentional degradation is visible:

- **NoOp** (e.g. `createNoOpCache`) — used in tests, e2e, or when something is intentionally off. Stays silent.
- **Fallback** (e.g. `createCacheOrFallback({ onFallback })`) — used in composition. If the real provider fails, falls back to NoOp AND fires the hook so Sentry/logs catch it.

Composition uses fallback for production. Tests use NoOp. This separation prevents alerting noise from intentional NoOp use while making real degradation visible.

---

## When NOT to use Awilix container

- **CLI tools** (`apps/cli/`) — no runtime composition needed; module imports are fine.
- **One-off scripts** that import a single service from composition — use the back-compat barrel (golf + portfolio) or import the container directly (hive).
- **Inngest function bodies themselves** (`packages/{app}/domains/.../infrastructure/inngest/*.function.ts`) — these take their service deps as factory args; composition wires them up. Inside the function body, use the deps directly. No cradle access.
- **Error conversion** — `AppError` → `ORPCError` (or `TRPCError`) bridging is NOT Awilix's concern. The container registers services and lets them throw `AppError` subclasses freely. Error conversion happens in **procedure middleware** (golf: `appErrorBridgeFn` in `procedures/base.ts`; hive/portfolio: tRPC's global `errorHandling` middleware). Never add error-shape logic to an `asFunction` resolver.

---

## Common errors + fixes

| Symptom | Cause | Fix |
|---|---|---|
| `AwilixResolutionError: Could not resolve 'fooService'` | Service name typo in destructure | Check `container.ts` for actual name; or service not registered |
| Tests fail with `ECONNREFUSED localhost:5432` | Importing container in tests triggers DB lookup | Set test env to skip boot-time DB calls (hive uses `OPENAPI_GENERATE`) |
| TS recursion stack overflow when building `AppCradle` | Annotated `asFunction` params with `: AppCradle` | Remove the annotation — params stay inferred `any` |
| `db.transaction(tx => ...)` callback `tx` is `any` | `db` came through cradle (typed as `any`) | Import `db` directly from `@bokendell/{app}-db` inside that resolver |
| `vi.mock("@bokendell/{app}-composition/services")` does nothing | Routers consume from `ctx.scope.cradle`, not barrel | Switch to `scope.register({ X: asValue(mock as any) })` pattern |
| Importing container module crashes in test environment | Eager back-compat exports force resolution | Remove `export const X = container.cradle.X` from container.ts (hive did this; golf + portfolio haven't yet) |

---

## Migration history

This pattern was adopted across all three apps in late April / early May 2026. See `docs/architecture/di-refactor-plan.md` for the full phased migration plan (8 phases), decisions log, and per-phase outcomes.
