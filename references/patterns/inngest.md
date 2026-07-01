# Inngest Functions — Orchestration Pattern (golf/hive/portfolio)

Inngest functions are the **infrastructure/orchestration** layer for durable background work
(`packages/{app}/domains/src/packages/{domain}/infrastructure/inngest/*.function.ts`). They run
in connect-mode workers and coordinate steps — they are NOT where business logic lives.

> SDK: **v4** (`inngest@^4`). v4 makes a boundary explicit that v3 hid — read "The serialization
> boundary" below; it's the source of most surprises.

---

## TL;DR

- **A function is a thin orchestrator.** Each `step.run` calls **one application-service method**. No more.
- **No direct repository access.** Functions depend on **services**, never `*Repository`. (Repos are an application-layer concern; see `ddd.md`.)
- **No business logic in the function.** Eligibility filtering, aggregation, stat math, prompt-building, score computation → push into a purpose-built **service method**. The function only sequences steps, branches, and builds event payloads.
- **Service methods that feed `step.run` return flat, plain DTOs** (read-models) — never rich domain entities. The DTO is the contract at the serialization boundary.
- **Declare dependencies as narrow interfaces (ISP)** with the DTO return type the job needs — NOT the full `XService` type. This is both correct design and a hard requirement for v4 typing (below).
- **Triggers live in the options object** as typed `EVENTS.X` objects: `createFunction({ id, triggers: [EVENTS.X] }, handler)`.
- **Fail soft.** Return a `{ skipped, reason }` object for "nothing to do"; only throw for genuinely retriable failures.

---

## The function shape

```ts
// infrastructure/inngest/ai-caddy-fanout.function.ts  — GOOD

// 1. Declare ONLY the flat read-model this job consumes (ISP + serialization-safe).
interface FanoutRoundSummary {
  round: { startingHole: number; totalHoles: number };
  players: { id: string; userId: string | null; inviteStatus: InviteStatus }[];
}

export interface AiCaddyFanoutDeps {
  // narrow slice, NOT `roundService: RoundService`
  roundService: { getRoundSummaryForBackground: (id: string) => Promise<FanoutRoundSummary | null> };
  entitlementService: Pick<EntitlementService, "isEntitled">;
}

export function createAiCaddyFanoutFunction(deps: AiCaddyFanoutDeps) {
  return inngest.createFunction(
    { id: FUNCTION_IDS.AI_CADDY_FANOUT, retries: 2, triggers: [EVENTS.ROUND_STARTED] },
    async ({ event, step, logger }) => {
      const { roundId } = event.data;

      // each step.run = ONE service call; the service owns the logic + returns a DTO
      const summary = await step.run("get-round", () => deps.roundService.getRoundSummaryForBackground(roundId));
      if (!summary) return { skipped: true, reason: "round-not-found" };

      const targets = await step.run("eligible-targets", () =>
        deps.entitlementService.filterEntitledPlayers(summary.players)); // logic in service

      if (!targets.length) return { skipped: true, reason: "no-eligible-players" };

      // orchestration glue (building event payloads) is fine in the function
      await step.sendEvent("emit", targets.map((p) => EVENTS.CADDY_GENERATE.create({
        roundId, holeNumber: summary.round.startingHole, roundPlayerId: p.id, userId: p.userId,
      })));
      return { count: targets.length };
    },
  );
}
```

```ts
// BAD — rich entities pulled into infra, logic in the function, full service type
export interface Deps { roundService: RoundService; }          // ← whole ~50-method type
const data = await step.run("get", () => roundService.getRoundSummaryForBackground(roundId));
const accepted = data.players.filter((p) => p.inviteStatus === "accepted" && p.userId); // ← business logic in infra
const scores = accepted.map((p) => ({ ...computeStats(p) }));   // ← domain math in infra
```

---

## The serialization boundary (why DTOs, not entities)

`step.run`'s return value is **persisted to Inngest as JSON and replayed** on the next step. This was
always true (v3 too); v3 just **lied about the types**. v4 tells the truth via a static `Jsonify<T>`
on every step output:

- `Date` → `string`, `Map`/`Set` → gone, class instances → plain data. If code did
  `result.createdAt.getTime()` after a `step.run`, it was **already a latent runtime bug** — v4 now
  surfaces it at compile time.
- **Rich domain entities collapse to `{}`** when they cross the boundary, for two reasons:
  1. **`z.infer` of a `.refine()`'d schema** (ZodEffects) under Zod 4 is too complex for `Jsonify` to
     introspect. (Golf's convention is plain-type entities anyway — see `ddd.md` — but this is a
     secondary cause.)
  2. **The real one:** resolving a method's return type *through the full `XService` type* (a
     `ReturnType<typeof createXService>` with ~50 methods) blows TS's instantiation-depth ceiling, and
     `Jsonify` silently degrades the result to `{}`. Symptom: `Property 'foo' does not exist on type '{}'`
     after a `step.run`, while sibling functions that narrowed their dep type compile fine.

**The fix for both is the same:** the function declares a **narrow dep interface returning a flat DTO**
(see the GOOD example). The rich service is structurally assignable to it; `Jsonify` only sees the small
plain DTO; depth limit never hit. This is also plain ISP — depend on what you use.

> Do NOT "fix" this with a `PreserveOutputTypes`/identity `stepOutputTransform` (suppressing Jsonify) —
> that's a backwards-compat dodge that re-hides the serialization boundary and the latent bugs.

---

## Triggers (v4)

```ts
// events.ts — one typed EventType per event, reusing the data shape
export const EVENTS = {
  ROUND_STARTED: eventType(EVENT_NAMES.GOLF.ROUND_STARTED, { schema: staticSchema<{ roundId: string }>() }),
  // …one per event
} as const;
```

- Event trigger: `triggers: [EVENTS.X]` → `event.data` is typed from the schema.
- Cron: `triggers: [{ cron: "*/15 * * * *" }]`.
- System event: `triggers: [{ event: "inngest/function.failed" }]`.
- Typed sends: `inngest.send(EVENTS.X.create({ … }))`; bare `{ name, data }` still works (untyped).
- `staticSchema<T>()` is type-only (no runtime validation) and **wants a `type`, not an `interface`**.

---

## Flow control

- **Global model cap:** every model-calling function shares one account-scoped concurrency key, so a
  spike queues instead of stampeding the provider / OOMing workers. Compose with a per-entity limit.
- **`debounce`** (keyed per entity) to coalesce rapid re-fires (e.g. score edits re-firing `hole.completed`).
- **`singleton: { mode: "skip" }`** on long crons so they can't overlap themselves.
- **`NonRetriableError`** for deterministic failures (bad input, entitlement denied) so retries aren't wasted.
- Prefer **fail-soft returns** (`return { skipped, reason }`) over throwing for "nothing to do".

---

## Checklist (what `review` enforces)

- [ ] Function takes **services**, not `*Repository`.
- [ ] Dep types are **narrow slices returning DTOs**, not full `XService` / rich entities.
- [ ] Every `step.run` body is **one service call** (no `.filter/.map/.reduce`/domain math in the function).
- [ ] Service methods feeding steps return **flat plain DTOs**, not `z.infer` entities.
- [ ] Triggers in the options object as `EVENTS.X` / `{ cron }`.
- [ ] Model-calling functions have the global concurrency cap; crons have `singleton`.
- [ ] No `as`-casts or output-transform hacks to paper over Jsonify — fix the boundary instead.
