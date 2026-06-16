# Auth, Principals, Scopes, and Policies (Authz v2)

How golf decides **who is calling** and **what they may do**. The model is two
distinct layers that are never merged:

- **Scope = a GRANT** — a coarse capability the credential carries (`rounds:write`,
  `admin:billing`). Lives on the `Principal`, checked at the **route** boundary.
- **Action = an OPERATION on an object** — "update *this* goal", "read *that*
  round". Enforced inside the **service** by a **Policy** against the actual
  object's owner/membership, and **audited**.

A scope says "this caller is allowed to write goals in general." A policy says
"…and this goal is theirs." You need both; one is not a substitute for the other.

> **App scope.** This is golf's current standard (authz v2). Hive and portfolio
> still run the older `CallerContext` + `scopedProcedure` model documented in
> their own trees; the shape below is where they're headed. When you touch
> golf, use this. When you touch hive/portfolio, match what's there.

---

## The `Principal` — who is calling

Every authenticated entry point resolves a **`Principal`** (from
`@bokendell/core`) and threads it explicitly into services. It is a flat
OAuth/OIDC projection — never a hand-built literal.

```ts
interface Principal {
  subject: { id: string; type: "human" | "machine" };  // WHO the action is for
  kind: "user" | "admin" | "system" | "apiKey" | "oauth" | "service" | "agent";
  actor?: { subject; kind; scopes };  // present on DELEGATION (RFC 8693)
  scopes: readonly GolfScope[];        // the GRANTS this caller holds
  amr?: string[];                      // auth method: ["session"] | ["apikey"] | ["oauth"]
  claims: Record<string, unknown>;     // role, reason, keyId, comp, actingAs…
}
```

Build it with a factory from `packages/domains/src/lib/context/principal.ts` —
never by hand (a literal drifts from the variant shape and drops `scopes`):

| Factory | `kind` | subject | scopes | Use for |
|---|---|---|---|---|
| `userPrincipal(userId, extraScopes?)` | `user` | the user | `USER_SCOPES` + opt-in extras | regular session |
| `adminPrincipal(userId, grantedAdminScopes?)` | `admin` | the user | `USER_SCOPES` + `admin:<area>`(s); `admin:all` ⇒ every scope | admin session |
| `apiKeyPrincipal(keyId, ownerUserId, scopes)` | `apiKey` | the owner | the key's provisioned subset | Better Auth API key |
| `oauthClientPrincipal(clientId, scopes, {actingForUserId?})` | `oauth` | user (delegated) or client | token's `scope` claim | OAuth 2.1 client |
| `systemPrincipal(reason)` | `system` | `system:<reason>` | `SYSTEM_SCOPES` (all) | **aggregate** background jobs (no single user) |
| `systemActingAs(reason, userId)` | `system` | **the user**, `actor` = system | `SYSTEM_SCOPES` | **per-user** background jobs (delegation) |

### `systemPrincipal` vs `systemActingAs` — the important one

Background work (Inngest / cron / worker) must thread a `Principal` through the
**same** service path as a request — never a back door that takes a bare
`userId`.

- **Per-user job** (recompute user X's handicap, refresh their snapshot) →
  `systemActingAs(reason, userId)`. The `subject` **is** the user, so
  `requireSubjectId` and `OwnershipPolicy.assertSelf` resolve to them; the
  `actor` records the platform drove it. Audit rows show `subject=user,
  actor=system:<reason>`.
- **Aggregate / cross-user job** (community benchmarks, pricing sync, digests) →
  `systemPrincipal(reason)`. There's no single subject to act as.

`reason` is constrained to the **`GOLF_SYSTEM_CALLERS`** registry
(`lib/context/system-callers.ts`) — a typo is a compile error, and every system
caller is therefore observable in one place. Add the entry before the call site;
name it `<runtime>:<domain>:<action>` (e.g. `inngest:stats:update-snapshot`).

---

## Scopes — the GRANT dimension

The registry is `packages/domains/src/lib/context/scopes.ts`. One flat
`ALL_SCOPES` tuple is the source of truth; the grouped `Scopes` object is the
ergonomic accessor (`Scopes.rounds.write`). Always use the constant, never a
string literal.

```ts
Scopes.rounds.read        // "rounds:read"     — domain capability
Scopes.admin.billing      // "admin:billing"   — granular admin AREA scope
Scopes.admin.all          // "admin:all"       — super-admin wildcard
```

### Admin = a role boundary + area scopes (not one bit)

`kind: "admin"` is the coarse **"is staff"** boundary. The admin's actual
**powers** are the granular `admin:<area>` scopes (`admin:users`,
`admin:billing`, `admin:ai`, `admin:content`, `admin:infra`, `admin:devTools`),
grantable/revocable per-admin from the admin site.

- `admin:all` is the **wildcard** super-admin and **expands to every scope** in
  `adminPrincipal`, so a super-admin satisfies both per-area gates and any
  domain scope gate.
- Every per-area gate accepts `admin:all` **OR** its specific area, via
  `adminAreaGate(area) === [admin:all, area]`.
- New admins default to `admin:all` (no behaviour change) until per-admin grants
  are assigned.

### Presets

| Preset | Contents |
|---|---|
| `USER_SCOPES` | read-everything-you-own + write-your-own; **no** admin/dev/comp scopes |
| `ADMIN_SCOPES` / `SYSTEM_SCOPES` | `ALL_SCOPES` |

### Entitlement ≠ scope

A subscription/paid feature is **not** a scope. **Every** user gets
`USER_SCOPES` at signup and **never** churns them on subscribe/unsubscribe —
scopes describe *capability shape*, not *billing state*. Paid access is a
separate gate (`EntitlementPolicy`, below). The one bridge is
`billing:comp` — a complimentary grant carried as an opt-in `extraScope`,
surfaced as `claims.comp`, which satisfies an entitlement gate without a
subscription row.

### Adding a scope

1. Add the literal to `ALL_SCOPES` **and** the grouped `Scopes` registry
   (`satisfies` enforces they agree).
2. Decide membership: `USER_SCOPES` (auto-granted) vs admin-only.
3. Gate routes with it (`apiProcedure`/`sessionProcedure([Scopes.x.y])`).
4. Enforce the object-level rule inside the service with a **Policy** (below).

---

## Procedure tiers — the route boundary (oRPC)

Golf serves oRPC (`apps/api/src/packages/api/procedures/`). Pick the tightest
tier; all are built on the typed `GolfApiContext` (see `api.md`).

| Tier | Auth required | Notes |
|---|---|---|
| `publicProcedure` | none | health, anonymous reads |
| `protectedProcedure` | any logged-in user | `context.user` narrowed non-null |
| `sessionProcedure([scopes])` | **session only** + scope | rejects API keys/OAuth — interactive-only (password change, account deletion) |
| `apiProcedure([scopes])` | session **or** API key **or** OAuth + scope | the workhorse; machine-friendly |
| `adminProcedure` | role `admin` | gated via the audited `AccessPolicy.assertAdmin`, attaches `context.caller` |
| `adminAreaProcedure(area)` | role `admin` + (`admin:all` or `admin:<area>`) | `adminProcedure` + `AccessPolicy.assertAdminArea` |

The scope tiers **stamp `{ scopes, authTier }` onto route meta** — that is the
**single source** the OpenAPI generator reads to emit per-operation `security`
(cookie/apiKey OR `oauth2`+scopes). There is no second hand-maintained security
list, and `visibility:"internal"` (excluded from the public spec) is **derived**
from an all-admin scope set so it can't drift from the gate.

```ts
// apps/api/src/packages/billing/billing.admin.orpc.router.ts
import { adminAreaProcedure, getCradle } from "../api/orpc";
import { Scopes } from "@bokendell/golf-domains/context";

export const billingAdminRouter = {
  upsertFixedCost: adminAreaProcedure(Scopes.admin.billing)
    .input(upsertFixedCostInput)
    .handler(({ context, input }) => {
      // role + area gate already passed + audited; caller is on context
      const { billingService } = getCradle(context);
      return billingService.upsertFixedCost(context.caller, input);
    }),
};
```

```ts
// a normal user write — scope at the route, ownership in the service
createGoal: sessionProcedure([Scopes.goals.write])
  .input(createGoalInput)
  .handler(({ context, input }) =>
    getCradle(context).goalService.createGoal(context.caller, input),
  ),
```

Routers resolve services **per-request** via `getCradle(context)` inside the
handler — never at module load (tests swap services on a child scope). `caller`
is attached by the scope/admin tiers; read `context.caller`, don't rebuild it.

---

## Policies — the OPERATION dimension (object-level, audited)

A scope gate at the route is not enough: a caller with `goals:write` must still
only edit **their own** goals. That object-level check lives in the **service**,
expressed as a **Policy**.

All policies extend **`AuthzPolicy`** (`packages/domains/src/packages/authz`),
which wraps core's `Policy.assert` with golf's **typed** vocabulary
(`AuthzAction` / `AuthzResourceType`) so every audit dimension is a controlled
value, not a free string. The base routes every check through the
`assertPermission` choke point, and a global **audit sink** records denials.

| Policy | Question it answers |
|---|---|
| `OwnershipPolicy.assertSelf(caller, ownerId, …)` | is the caller the owning user? (`system` always passes) |
| `RoundParticipationPolicy` | is the caller a player in this round? (membership, not single-owner) |
| `AccessPolicy.assertAdmin / assertAdminArea / assertSystem` | role / area / system-internal gate (used by the procedure tiers) |
| `EntitlementPolicy.assertEntitled(caller, [...])` | does the **account** hold the paid feature? (402, audited) |
| domain-specific (`FriendshipPolicy`, `UserAdminPolicy`, `SettlementPolicy`…) | cross-user authority for that aggregate |

```ts
// packages/domains/src/packages/goals/application/goal.service.ts
async updateGoal(goalId: string, caller: Principal, input: UpdateGoalInput) {
  const goal = await goalRepository.findByIdOrThrow(goalId);
  ownershipPolicy.assertSelf(caller, goal.userId, {
    action: "goal.update",
    resourceType: "goal",
    resourceId: goalId,
    // anti-enumeration: hide existence from non-owners
    error: () => new GoalNotFoundError(goalId),
  });
  return goalRepository.update(goalId, input);
}
```

Key rules:
- **Services take `caller: Principal`** (usually first arg) and call a policy —
  they never receive a bare `userId` for an authorization decision.
- **Denials are audited**: the `Policy` base feeds a global sink wired in
  composition (`setAuthzAuditSink(...)` → `authzAuditService.record`, table
  `authz_audit`). "A non-admin tried an admin route" / "tried a pro feature, not
  entitled" used to be invisible; now every denial is a row.
- **`system` callers pass** ownership/entitlement gates (they act for the
  platform) — which is exactly why per-user jobs use `systemActingAs` so the
  *subject* is still the user where self-checks matter.
- Use `opts.error` to throw `NotFound` instead of `Forbidden` for
  anti-enumeration (don't leak that a resource exists).

### The arch rule that enforces this

The swarm rule **`service-mutation-requires-policy`** (ts-morph) flags any
service mutation that lacks a policy assertion — including the **caller-less
blind spot** (a mutation that takes a foreign id/email or reads auth/headers but
never asserts). It recognizes guard helpers (`validate*` / `ensure*` /
`getOwned(…caller…)` / `requireSubjectId(caller)`). Run
`pnpm swarm check arch`; the rule must sit at **zero** — don't suppress with
`arch-allow`, convert to a real gate (caller + policy, or `assertSystem` for
genuinely system-internal methods).

---

## Entitlement (paid features) — a separate gate

Authorization asks "may this caller touch this object"; **entitlement** asks
"does this account hold the paid feature". Same choke point + audit, different
question.

- The **decision** is the single PDP `entitlementService.isEntitled(...)` (comp
  fast-path + subscription lookup, keyed by the caller's subject).
- The **enforcement point** is `EntitlementPolicy.assertEntitled(caller, [...])`,
  called **inside the domain service** (not at the transport) so the gate moves
  with the capability. Throws `EntitlementRequiredError` (402); the denial is
  audited.
- `comp` is **account state**, resolved from the DB per call — correct for both
  interactive and background callers. See
  `docs/decisions/0009-entitlement-service-enforcement.md`.

---

## Common mistakes

- **Treating a scope as the whole check.** A scope gate at the route does not
  authorize the specific object — add the `OwnershipPolicy`/membership policy in
  the service. (The `service-mutation-requires-policy` rule catches the gap.)
- **Passing a bare `userId` to a service for an authz decision.** Pass the
  `Principal`; the service derives the id via `requireSubjectId(caller)` and the
  policy audits.
- **Background job that takes a `userId` directly.** Use
  `systemActingAs(reason, userId)` (per-user) or `systemPrincipal(reason)`
  (aggregate) so it threads the same gated path. Register the `reason` first.
- **Building a `Principal` literal by hand.** Use the factories.
- **Suppressing the arch rule with `arch-allow`.** Convert to a real gate
  (caller + policy / `assertSystem`).
- **Putting a subscription behind a scope.** Entitlement ≠ scope — every user
  keeps `USER_SCOPES`; gate paid features with `EntitlementPolicy`.
- **Granting `admin:all` when you mean an area.** Use `adminAreaProcedure(area)`
  + the specific `admin:<area>` so the grant is least-privilege and auditable.
- **Rebuilding `caller` inside a handler.** The tier already attached
  `context.caller`.

---

## Cross-app note

Hive and portfolio still use the earlier `CallerContext` + `scopedProcedure`
tRPC model (factories `createXCallerContext`, helpers `requireAnyScope` /
`requireCallerUserId`). The conceptual move is the same — caller threaded
explicitly, scopes at the route, capability checks in the service — but golf is
the first app on the `Principal` + audited-`Policy` shape above. Don't
retrofit golf's vocabulary onto an app that hasn't migrated; match the tree
you're in.
