# Auth, Scopes, and Caller Context

Every backend app (golf, portfolio, hive) gates tRPC procedures through the same set of building blocks. This doc shows how to pick the right procedure builder, define scopes, and pass a `CallerContext` into services. Examples are golf-flavored; the pattern is identical in hive and portfolio.

---

## The shared foundation

The generic types and helpers live in `@bokendell/api`:

- `@bokendell/api/trpc` — `createBaseTrpc()` returns the base procedure builders (`publicProcedure`, `protectedProcedure`, `adminProcedure`, `internalProcedure`).
- `@bokendell/api/caller` — generic `CallerContext<TScope>` plus helpers (`getCallerIdentifier`, `getCallerUserId`, `requireCallerUserId`, `hasAnyScope`, `requireAnyScope`).

Each app builds two thin layers on top:

1. **Domain context** (`packages/{app}/domains/src/lib/context/`)
   - `scopes.ts` — `Scopes` registry + `AppScope` union + `ALL_SCOPES`/`USER_SCOPES`/`ADMIN_SCOPES`/`SYSTEM_SCOPES` presets.
   - `caller-context.ts` — re-exports `CallerContext` parameterized on `AppScope` plus `createXCallerContext(...)` factories.
2. **API procedure layer** (`apps/{app}/api/src/packages/api/trpc.ts`)
   - Adds `scopeBinding` (per-request Awilix scope into AsyncLocalStorage), `machineProcedure`, `callerProcedure`, `scopedProcedure(scopes)`.
   - `apps/{app}/api/src/lib/auth/caller-context.ts` — `createCallerFromContext(ctx)` parses the request's auth signals (session / API key / OAuth token) into a `CallerContext`.

---

## Procedure builders — when to use which

| Builder | Auth required | Use for |
|---|---|---|
| `publicProcedure` | None | Health checks, anonymous reads, share pages |
| `protectedProcedure` | Session OR API key | Standard authenticated user actions |
| `adminProcedure` | Session with `role: "admin"` | Admin dashboard endpoints, dev-tools, ops |
| `callerProcedure` | Session OR API key OR OAuth token | Endpoints that accept any caller type and switch on `CallerContext` downstream |
| `machineProcedure` | API key OR OAuth token (no session) | Webhooks, service-to-service, automation |
| `scopedProcedure([Scopes.X, ...])` | Caller must hold ≥1 listed scope | Capability gating — admin auto-grants all, API keys carry their granted subset |
| `sessionScopedProcedure([Scopes.X, ...])` | Browser session AND ≥1 listed scope | Interactive-only capability gates — password change, account deletion, anything that should reject API keys |
| `internalProcedure` | Shared `Authorization: Bearer <secret>` | App-to-app calls inside the cluster |

Rule of thumb:

- **CRUD that operates on "my X"** → `scopedProcedure([Scopes.x.read])` / `[Scopes.x.write]`. Inside, call `createCallerFromContext(ctx)` and pass into the service.
- **Strictly admin** → `scopedProcedure([Scopes.admin.all])` (preferred over raw `adminProcedure` — same gate today, ready for finer-grained admin scopes later).
- **Public** → `publicProcedure`, no caller, no scopes.
- **Webhook from Inngest, Vault, Linear, etc.** → `internalProcedure` (shared secret) OR a Hono REST route + signature verification.

---

## Examples (golf)

> Every authenticated procedure auto-attaches `ctx.caller: CallerContext` via
> the `withCaller` middleware in `trpc.ts`. Routers read it directly — no
> `createCallerFromContext(ctx)` boilerplate.

### A scoped read endpoint
```ts
// apps/golf/api/src/packages/rounds/rounds.trpc.router.ts
import { Scopes } from "@bokendell/golf-domains/context";
import { router, scopedProcedure } from "../api/trpc";

export const roundsRouter = router({
  listMyRounds: scopedProcedure([Scopes.rounds.read])
    .input(z.object({ limit: z.number().int().positive().max(100).default(20) }))
    .query(({ ctx, input }) =>
      ctx.scope.cradle.roundService.listForCaller(ctx.caller, input),
    ),
});
```

### A scoped write endpoint
```ts
createRound: scopedProcedure([Scopes.rounds.write])
  .input(createRoundInputSchema)
  .mutation(({ ctx, input }) =>
    ctx.scope.cradle.roundService.create(ctx.caller, input),
  ),
```

### Admin-only endpoint
```ts
resetSeedData: adminProcedure
  .input(z.void())
  .mutation(({ ctx }) =>
    // ctx.caller.type === "admin", ctx.caller.scopes === ALL_SCOPES
    ctx.scope.cradle.seedService.resetSeedData(ctx.caller),
  ),
```

### Public endpoint (no caller)
```ts
checkAvailability: publicProcedure
  .input(z.object({ courseId: z.string() }))
  .query(({ ctx, input }) =>
    ctx.scope.cradle.courseService.checkPublicAvailability(input.courseId),
  ),
```

### Background job / Inngest function (no HTTP context)
```ts
// packages/golf/domains/src/packages/seed/infrastructure/inngest/seed-dev-data.function.ts
import { createSystemCallerContext } from "../../../../lib/context/caller-context";

inngest.createFunction(
  { id: FUNCTION_IDS.SEED_DEV_DATA },
  { event: EVENT_NAMES.GOLF.SEED_DEV_DATA },
  async ({ event, step }) => {
    const caller = createSystemCallerContext("seed-dev-data");
    await step.run("run-dev-seed", () => seedService.runSeed(caller));
  },
);
```

---

## Building a CallerContext

You almost never construct `CallerContext` by hand. Use what's already there:

| Where you are | How |
|---|---|
| Inside a tRPC procedure | **`ctx.caller` is already attached** by `withCaller` middleware on every authenticated builder. Just read it. |
| Inside an Inngest function or cron | `createSystemCallerContext("descriptive-reason")` |
| Inside a CLI command running an admin action | `createSystemCallerContext("bk-<command-name>")` (system caller has all scopes) |
| Inside a script seeding data | Same — `createSystemCallerContext("seed-<purpose>")` |
| Inside a `publicProcedure` that needs to know the caller when present | Manual `createCallerFromContext(ctx)` from `apps/golf/api/src/lib/auth/caller-context.ts` after a null check on `ctx.user`/`ctx.apiKey`/`ctx.oauthToken` (public routes don't auto-attach because there's no auth signal guaranteed) |

The factory you pick determines the variant (`user` / `admin` / `apiKey` / `oauthClient` / `system`) and the granted scopes:

| Caller variant | How produced | Scopes granted |
|---|---|---|
| `user` | Session, role !== "admin" | `USER_SCOPES` (read/write own data) |
| `admin` | Session, role === "admin" | `ALL_SCOPES` |
| `apiKey` | Better Auth API key (referenceId / userId) | Whatever the key was provisioned with |
| `oauthClient` | OAuth 2.1 access token | Parsed from token's `scope` claim |
| `system` | `createSystemCallerContext(reason)` | `ALL_SCOPES` (trusted internal) |

---

## Inside a service

Services that act on behalf of a caller take `caller: CallerContext` as the first argument:

```ts
// packages/golf/domains/src/packages/rounds/application/round.service.ts
import type { CallerContext } from "../../../lib/context/caller-context";
import { requireCallerUserId, requireAnyScope } from "../../../lib/context/caller-context";
import { Scopes } from "../../../lib/context/scopes";

export function createRoundService(deps: ...) {
  return {
    async listForCaller(caller: CallerContext, input: ListRoundsInput) {
      // Defense in depth — the procedure already gated on Scopes.rounds.read,
      // but services that are also called from Inngest / CLI revalidate.
      requireAnyScope(caller, [Scopes.rounds.read]);
      const userId = requireCallerUserId(caller);  // throws if system / oauthClient w/o sub
      return deps.roundRepository.listByOwner(userId, input);
    },
  };
}
```

Two small helpers do most of the work:

- **`requireCallerUserId(caller)`** — returns the user id, throws `ForbiddenError` if there's no associated user (system callers, OAuth without `actingForUserId`).
- **`requireAnyScope(caller, [...])`** — throws `ForbiddenError` unless the caller holds at least one of the listed scopes.

Both are typed and import-shape-identical across golf / hive / portfolio.

---

## Hono REST routes — same pattern, different builder

Hono routes get a parallel middleware bundle via `createHonoAuth()` from
`@bokendell/api/hono-auth`. Each app instantiates one bundle in
`apps/<app>/api/src/lib/middleware/hono-auth.ts`:

```ts
import { createHonoAuth } from "@bokendell/api/hono-auth";
import { type GolfScope, requireAnyScope } from "@bokendell/golf-domains/context";
import { createCallerFromContext } from "../auth/caller-context";

export const honoAuth = createHonoAuth<CallerContext, GolfScope>({
  buildCaller: (vars) => createCallerFromContext(vars),
  requireAnyScope,
});
```

Routers consume the bundle. Authenticated middlewares attach
`c.var.caller: CallerContext` — the same convention `withCaller` uses on
the tRPC side.

```ts
import { honoAuth } from "@/lib/middleware/hono-auth";

// Public — no auth
publicRouter.get("/", (c) => c.text("hello"));

// Protected — requires session, attaches c.var.caller
authedRouter.use("*", ...honoAuth.protectedHono);

// Admin
adminRouter.use("*", ...honoAuth.adminHono);

// Per-route scope gate
router.post(
  "/rounds",
  ...honoAuth.scopedHono([Scopes.rounds.write]),
  async (c) => {
    return container.cradle.roundService.create(c.var.caller, await c.req.json());
  },
);

// Session-only (rejects API keys) — interactive routes
router.delete(
  "/account",
  ...honoAuth.sessionScopedHono([Scopes.users.write]),
  async (c) => container.cradle.userService.delete(c.var.caller),
);

// Webhook / service-to-service — Authorization: Bearer <internalSecret>
webhookRouter.use("*", ...honoAuth.internalHono);
```

| tRPC | Hono equivalent | Auth signal |
|---|---|---|
| `publicProcedure` | `...honoAuth.publicHono` | none |
| `protectedProcedure` | `...honoAuth.protectedHono` | session |
| `adminProcedure` | `...honoAuth.adminHono` | session + admin role |
| `callerProcedure` | `...honoAuth.callerHono` | session OR machine cred |
| `machineProcedure` | `...honoAuth.machineHono` | machine cred (rejects session) |
| `scopedProcedure([X])` | `...honoAuth.scopedHono([X])` | any auth + scope check |
| `sessionScopedProcedure([X])` | `...honoAuth.sessionScopedHono([X])` | session + scope check |
| `internalProcedure` | `...honoAuth.internalHono` | shared secret |

All authenticated bundles set `c.var.caller`. Don't call
`createCallerFromContext` inline in a Hono handler — the middleware did it
already. (Public routes don't get a caller for the same reason as on the
tRPC side: no auth signal guaranteed.)

---

## Where do scopes come from?

Scopes attach to the **caller**, not the user record. The caller is constructed per request from whatever auth signal succeeded:

| Caller variant | Scope source |
|---|---|
| `user` (browser session, role !== "admin") | `USER_SCOPES` preset from `scopes.ts` |
| `admin` (browser session, role === "admin") | `ALL_SCOPES` preset (admin gets everything) |
| `apiKey` (Better Auth API key) | Stored in the API key's `metadata.scopes` field — set when the key was minted |
| `oauthClient` (OAuth 2.1 access token) | Parsed from the token's `scope` claim |
| `system` (Inngest, cron, CLI) | `SYSTEM_SCOPES` preset (full access — internal callers are trusted) |

**Important**: this is fixed-presets-by-role today. There's no "this user has extra scopes X, Y" granted via DB. To add per-user customization later you'd:
1. Add a `scopes` (or `extra_scopes`) column to the user table
2. Read it in `apps/<app>/api/src/lib/auth/caller-context.ts`'s `createCallerFromContext` and merge with the role preset
3. Same scope check at the procedure boundary continues to work

For now the dimensions are clean: **role grants a preset; API keys/OAuth carry a subset**. If you find yourself wanting to per-user-override, lift to the DB before adding ad-hoc logic.

---

## Adding a new scope

1. Add the literal to `Scopes` in `packages/golf/domains/src/lib/context/scopes.ts`.
2. Decide if it belongs in `USER_SCOPES` (auto-granted to any user session) or only `ADMIN_SCOPES`.
3. Use it via `scopedProcedure([Scopes.<group>.<action>])` at the router boundary.
4. Optionally `requireAnyScope(caller, [...])` inside the service for defense in depth.

That's the whole loop — no separate "permissions DB" or runtime registration.

---

## Common mistakes

- **Building a `CallerContext` literal by hand.** Use the factories. The literal can drift from the variant shape and miss the `scopes` field.
- **Calling `createCallerFromContext(ctx)` inside a router.** The `withCaller` middleware already did it — read `ctx.caller`. (The check-architecture rule `auth-procedure-uses-caller` flags this.)
- **Calling a service that needs a caller from an Inngest function without one.** Use `createSystemCallerContext("inngest:<function-id>")`.
- **Using `protectedProcedure` when you mean `scopedProcedure([Scopes.x])`.** `protectedProcedure` only checks "is there a user." If you want capability gating, name the scope.
- **Reaching into the cradle at module load.** Routers should resolve services per-request: `const { roundService } = ctx.scope.cradle;` inside the handler, not at the top of the file. Tests substitute services on a child scope; module-level reads make that fragile. (The check-architecture rule `no-module-level-cradle-read` flags this.)
- **Skipping `ctx.caller` and passing `ctx.user.id` to a service that takes `CallerContext`.** Type-check usually catches this; if it doesn't, the service loses access to scopes / variant info.

---

## Cross-app consistency

Hive and portfolio look almost identical — same procedure builders, same caller-context factories, same scope-check helpers. The only differences:

- **Hive** has `requireScope(caller, scope)` (single-scope gate) in addition to `requireAnyScope`.
- **Portfolio** has `featureFlagProcedure(flag)` + `mvpFeatureProcedure` for feature-flag gating layered on top.

When you copy a pattern between apps, the imports change but the shape doesn't.
