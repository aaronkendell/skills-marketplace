# Testing Patterns

Every piece of logic that can be isolated must have a test. No inline business logic in routes, components, or stores that bypasses testability. This applies equally to backend domains, API routes, frontend components, Zustand stores, and Inngest functions.

---

## Test types and locations

| Type | Location | Tools | When to use |
|------|----------|-------|-------------|
| Entity unit | `domain/entities/*.entity.test.ts` | Vitest | Validation rules, factory functions, Zod schema |
| Service unit | `application/*.service.test.ts` | Vitest + vi.fn() | Business logic with mocked repository |
| Repository integration | `infrastructure/persistence/*.repository.test.ts` | Vitest + Testcontainers | All repository methods against real DB |
| Service integration | `integration/*.service.integration.test.ts` | Vitest + Testcontainers | Full domain flow with real DB |
| oRPC route | `*.orpc.router.test.ts` | Vitest + `createCaller` | HTTP layer with mocked service |
| Inngest function | `infrastructure/inngest/*.test.ts` | Vitest + `InngestTestEngine` | Async job handlers |
| Domain logic | `domain/**/*.test.ts` | Vitest | Pure calculators, helpers, algorithms |
| Zustand store | `stores/*.store.test.ts` | Vitest | State shape, mutations, reset |
| E2E API | `packages/{app}/e2e/api/tests/**/*.spec.ts` | Playwright | Full API contract flows |
| E2E UI | `packages/{app}/e2e/(admin\|mobile\|app)/tests/**/*.spec.ts` | Playwright | User journeys, navigation, forms |
| Performance | `packages/{app}/performance/packages/**/*.check.js` | K6 | Load, latency thresholds |

---

## Running tests

Tests are split into two **vitest projects** defined centrally in
`@bokendell/testing/vitest`:

- **unit** — picks up every `*.test.ts` file EXCEPT `*.integration.test.ts`.
  No `globalSetup`, no DB, full file parallelism. Fast.
- **integration** — picks up ONLY `*.integration.test.ts`. Boots
  testcontainers via `globalSetup`, runs files serially within a package
  (`fileParallelism: false`). Requires Docker.

```bash
# Run a single project (filename suffix decides which)
pnpm swarm test --type=unit
pnpm swarm test --type=integration

# Run BOTH projects (default)
pnpm swarm test

# CI / pre-push: limit to packages affected by the diff
pnpm swarm test --affected --type=unit
pnpm swarm test --affected --type=integration

# One package, one project
turbo test --filter='@bokendell/golf-domains' -- --project=unit

# E2E
pnpm e2e
pnpm e2e:ui   # interactive

# Performance (K6)
K6_DEPLOYMENT_URL=http://localhost:3000 pnpm test:smoke
K6_ENV=production pnpm test:smoke
```

**No `TEST_DB=true` env var anywhere** — the project filter replaces it.
The integration `globalSetup` lives on the integration project entry, so
it only fires when that project actually runs. Unit runs never start a
testcontainer.

To author an integration test: name the file `*.integration.test.ts`.
The vitest project filter routes it. No `describe.skipIf(...)` boilerplate.

---

## Entity unit tests

Test validation rules, factory functions, and Zod schema enforcement.

```typescript
// domain/entities/area.entity.test.ts
import { describe, expect, it } from "vitest";
import { createArea, updateArea } from "./area.entity";

// Helper to build valid inputs with optional overrides
const createValidInput = (overrides = {}) => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  userId: "550e8400-e29b-41d4-a716-446655440001",
  name: "Health",
  order: 0,
  isDefault: true,
  ...overrides,
});

describe("area.entity", () => {
  describe("createArea", () => {
    it("creates a valid area with required fields", () => {
      const area = createArea(createValidInput());
      expect(area.name).toBe("Health");
    });

    it("rejects empty name", () => {
      expect(() => createArea(createValidInput({ name: "" }))).toThrow();
    });

    it("rejects name over 100 characters", () => {
      expect(() => createArea(createValidInput({ name: "a".repeat(101) }))).toThrow();
    });
  });

  describe("updateArea", () => {
    it("updates name and bumps updatedAt", () => {
      const area = createArea(createValidInput());
      const updated = updateArea(area, { name: "Wellness" });
      expect(updated.name).toBe("Wellness");
      expect(updated.updatedAt > area.updatedAt).toBe(true);
    });

    it("does not mutate original", () => {
      const area = createArea(createValidInput());
      updateArea(area, { name: "Wellness" });
      expect(area.name).toBe("Health");
    });
  });
});
```

**What to test:** validation boundaries, required vs optional fields, factory function defaults, update immutability.
**What NOT to test:** Zod itself, framework internals.

---

## Service unit tests

Mock the repository, test business logic in isolation.

```typescript
// application/area.service.test.ts
import { ForbiddenError, NotFoundError } from "@bokendell/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AreaRepository } from "../infrastructure/persistence/area.repository";
import { createAreaService } from "./area.service";

// Mock imported modules if needed
vi.mock("@bokendell/goals-db/seed/areas", () => ({
  DEFAULT_AREAS: [{ name: "Health", icon: "heart-pulse", color: "#10B981", sortOrder: 0 }],
}));

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const OTHER_USER_ID = "550e8400-e29b-41d4-a716-446655440002";

describe("AreaService", () => {
  const createMockArea = (overrides: Partial<Area> = {}): Area => ({
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: TEST_USER_ID,
    name: "Health",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // Build typed mock repository
  const createMockRepository = () => {
    const mocks = {
      findAllByUserId: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    return { repository: mocks as unknown as AreaRepository, mocks };
  };

  let mockRepo: ReturnType<typeof createMockRepository>;
  let service: ReturnType<typeof createAreaService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = createMockRepository();
    service = createAreaService({ areaRepository: mockRepo.repository });
  });

  describe("getAreas", () => {
    it("returns all areas for user", async () => {
      const areas = [createMockArea(), createMockArea({ id: "other-id", name: "Career" })];
      mockRepo.mocks.findAllByUserId.mockResolvedValue(areas);

      const result = await service.getAreas(TEST_USER_ID);

      expect(result).toEqual(areas);
      expect(mockRepo.mocks.findAllByUserId).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });

  describe("getAreaById", () => {
    it("throws NotFoundError when area does not exist", async () => {
      mockRepo.mocks.findById.mockResolvedValue(null);
      await expect(service.getAreaById("missing-id", TEST_USER_ID)).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when area belongs to different user", async () => {
      mockRepo.mocks.findById.mockResolvedValue(createMockArea({ userId: OTHER_USER_ID }));
      await expect(service.getAreaById("area-id", TEST_USER_ID)).rejects.toThrow(ForbiddenError);
    });
  });
});
```

**Pattern:** `createMockRepository()` returns typed mocks matching the real `{Entity}Repository` type.

---

## Repository integration tests

Test every repository method against a real PostgreSQL 17 container.

```typescript
// infrastructure/persistence/area.repository.integration.test.ts
//                                            ^^^^^^^^^^^^
// Filename suffix routes this to the vitest `integration` project, which
// boots testcontainers via globalSetup. No `describe.skipIf` boilerplate.
import {
  connectToTestDatabase,
  factories,
  type TestDatabase,
  type TestDatabaseContext,
} from "@bokendell/goals-db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAreaRepository, type AreaRepository } from "./area.repository";

describe("AreaRepository", () => {
  let ctx: TestDatabaseContext;
  let db: TestDatabase;
  let repository: AreaRepository;

  beforeAll(async () => {
    ctx = await connectToTestDatabase();
    db = ctx.db;
    repository = createAreaRepository({ db });
  }, 60_000);

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await ctx.reset(); // TRUNCATE CASCADE
  });

  describe("findAllByUserId", () => {
    it("returns all non-archived areas for user", async () => {
      const user = await factories.user.create(db);
      await factories.area.create(db, { userId: user.id, name: "Health" });
      await factories.area.create(db, { userId: user.id, name: "Career" });

      const result = await repository.findAllByUserId(user.id);

      expect(result).toHaveLength(2);
    });

    it("excludes archived areas", async () => {
      const user = await factories.user.create(db);
      await factories.area.create(db, { userId: user.id, name: "Active" });
      await factories.area.create(db, { userId: user.id, name: "Archived", archivedAt: new Date() });

      const result = await repository.findAllByUserId(user.id);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Active");
    });

    it("does not return areas from other users", async () => {
      const user1 = await factories.user.create(db);
      const user2 = await factories.user.create(db);
      await factories.area.create(db, { userId: user1.id });
      await factories.area.create(db, { userId: user2.id });

      expect(await repository.findAllByUserId(user1.id)).toHaveLength(1);
    });
  });

  describe("findById", () => {
    it("returns null when not found", async () => {
      expect(await repository.findById("non-existent")).toBeNull();
    });
  });
});
```

**Every repository must have integration tests.** Don't skip methods.

---

## Service integration tests

Combine real repository + real service to verify end-to-end domain behavior.

```typescript
// integration/area.service.integration.test.ts
import {
  connectToTestDatabase,
  factories,
  type TestDatabaseContext,
} from "@bokendell/goals-db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAreaService, type AreaService } from "../application/area.service";
import { createAreaRepository } from "../infrastructure/persistence/area.repository";

describe("AreaService — integration", () => {
  let ctx: TestDatabaseContext;
  let service: AreaService;

  beforeAll(async () => {
    ctx = await connectToTestDatabase();
    const repository = createAreaRepository({ db: ctx.db });
    service = createAreaService({ areaRepository: repository });
  }, 60_000);

  afterAll(() => ctx.cleanup());
  beforeEach(() => ctx.reset());

  it("creates and retrieves an area", async () => {
    const user = await factories.user.create(ctx.db);
    const area = await service.createArea({ name: "Health" }, user.id);

    expect(area.id).toBeDefined();
    const fetched = await service.getAreaById(area.id, user.id);
    expect(fetched.name).toBe("Health");
  });

  it("does not leak data between users", async () => {
    const user1 = await factories.user.create(ctx.db);
    const user2 = await factories.user.create(ctx.db);
    await service.createArea({ name: "User1 Area" }, user1.id);

    const user2Areas = await service.getAreas(user2.id);
    expect(user2Areas).toHaveLength(0);
  });
});
```

---

## oRPC route tests

Use `createCaller` — no HTTP round trip needed.

```typescript
// health.orpc.router.test.ts
import type { HealthService } from "@bokendell/hive-domains/health";
import { describe, expect, it, vi } from "vitest";
import { router } from "../api/orpc";
import { createHealthRouter } from "./health.orpc.router";

// Build typed mock service
function makeMockHealthService(overrides: Partial<HealthService> = {}): HealthService {
  return {
    check: vi.fn().mockResolvedValue({
      status: "healthy",
      timestamp: new Date().toISOString(),
      components: [{ name: "database", status: "healthy", latencyMs: 5 }],
    }),
    ...overrides,
  };
}

// Build typed context
function makeCtx(overrides = {}) {
  return {
    user: { id: "user-1", role: "admin", isAnonymous: false } as never,
    session: { id: "session-1" } as never,
    requestId: "test-123",
    headers: new Headers(),
    ...overrides,
  };
}

describe("healthRouter", () => {
  it("returns healthy when all components are up", async () => {
    const testRouter = router({ health: createHealthRouter(makeMockHealthService()) });
    const caller = testRouter.createCaller(makeCtx());

    const result = await caller.health.ping();

    expect(result.status).toBe("healthy");
  });

  it("returns unhealthy when db is down", async () => {
    const service = makeMockHealthService({
      check: vi.fn().mockResolvedValue({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        components: [{ name: "database", status: "unhealthy", latencyMs: 0, error: "refused" }],
      }),
    });
    const testRouter = router({ health: createHealthRouter(service) });
    const caller = testRouter.createCaller(makeCtx());

    const result = await caller.health.ping();

    expect(result.status).toBe("unhealthy");
  });
});
```

For routes that import services via module-level singletons, use `vi.hoisted` + `vi.mock`:

```typescript
// courses.orpc.router.test.ts
const { getHoleMaps, ensureHoleMapCached } = vi.hoisted(() => ({
  getHoleMaps: vi.fn(),
  ensureHoleMapCached: vi.fn(),
}));

vi.mock("../../lib/services", () => ({
  courseService: { getHoleMaps, ensureHoleMapCached },
}));

import { coursesRouter } from "./courses.orpc.router";

describe("courses.getHoleMaps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches hole maps without cache when no lat/lng", async () => {
    getHoleMaps.mockResolvedValue({ courseId: "c1", holes: [] });
    const caller = coursesRouter.createCaller(makeCtx());
    const result = await caller.getHoleMaps({ courseId: "c1" });
    expect(result.courseId).toBe("c1");
    expect(ensureHoleMapCached).not.toHaveBeenCalled();
  });
});
```

**Every oRPC route must have tests.** Test both happy paths and error cases.

### Golf oRPC router tests

Golf routers are oRPC. Invoke handlers with `call()` from `@orpc/server`; the
context is a **`ScopedContext`** — `GolfApiContext` plus the runtime-injected
Awilix `scope` (a test container where you register mocked services, since
handlers resolve via `getCradle(context)`):

```typescript
import { call } from "@orpc/server";
import { asValue, createContainer } from "awilix";
import { AccessPolicy } from "@bokendell/golf-domains/authz";
import type { ScopedContext } from "../api/orpc";

function makeCtx(overrides: Partial<ScopedContext> = {}): ScopedContext {
  const scope = createContainer({ injectionMode: "PROXY" });
  scope.register({
    goalService: asValue(mockGoalService),
    // Admin/area tiers gate via AccessPolicy resolved from the cradle —
    // register the real (no-dep) policy or those procedures throw
    // "Could not resolve 'accessPolicy'".
    accessPolicy: asValue(new AccessPolicy()),
  });
  return { user: null, session: null, requestId: "t", headers: new Headers(),
           scope: scope as never, ...overrides } as ScopedContext;
}

it("rejects non-admin", async () => {
  const ping = adminProcedure.handler(() => "pong");
  await expect(
    call(ping, undefined, { context: makeCtx({ user: { id: "u", role: "user" } as never }) }),
  ).rejects.toThrow(/admin/i);
});
```

Golf-specific gotchas (and review flags):
- **Register `accessPolicy`** in the test scope for any `adminProcedure` /
  `adminAreaProcedure` test — the audited gate resolves it from the cradle.
- Services receive a **`Principal`** as the caller arg — assert on it
  (`expect(svc.fn).toHaveBeenCalledWith(expect.objectContaining({ kind: "admin" }), input)`),
  and remember the caller now carries `scopes`, so exact-match assertions on the
  caller object must include it.
- `security` in generated OpenAPI is an **OR-list** (order non-semantic); assert
  membership, not array order.

---

## Inngest function tests

```typescript
// infrastructure/inngest/notification-dispatch.test.ts
import { InngestTestEngine } from "@inngest/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockEvents, castResult } from "../../../../lib/inngest/testing";
import { createNotificationDispatchFunctions } from "./notification-dispatch";

describe("sendRoundInviteNotification", () => {
  const mockNotificationService = {
    sendInApp: vi.fn(),
    sendPushOnly: vi.fn(),
  };
  const mockPreferenceService = {
    shouldDeliver: vi.fn().mockResolvedValue(true),
  };

  let functions: ReturnType<typeof createNotificationDispatchFunctions>;

  beforeEach(() => {
    vi.clearAllMocks();
    functions = createNotificationDispatchFunctions({
      notificationService: mockNotificationService as never,
      notificationPreferenceService: mockPreferenceService as never,
    });
  });

  it("sends in-app and push when preferences allow", async () => {
    const t = new InngestTestEngine({ function: functions.sendRoundInviteNotification });
    const { result } = await t.execute({ events: [mockEvents.roundPlayerInvited()] });

    expect(mockNotificationService.sendInApp).toHaveBeenCalledWith(
      expect.objectContaining({ type: "round_invite" }),
    );
    expect(castResult<{ sent: { inApp: boolean; push: boolean } }>(result)).toEqual({
      sent: { inApp: true, push: true },
    });
  });

  it("skips push when preference disabled", async () => {
    mockPreferenceService.shouldDeliver.mockImplementation(
      async (_userId: string, _type: string, channel: string) => channel !== "push",
    );
    const t = new InngestTestEngine({ function: functions.sendRoundInviteNotification });
    await t.execute({ events: [mockEvents.roundPlayerInvited()] });
    expect(mockNotificationService.sendPushOnly).not.toHaveBeenCalled();
  });
});
```

---

## Domain logic tests (calculators, pure functions)

```typescript
// domain/calculators/skins.calculator.test.ts
import { describe, expect, it } from "vitest";
import { createSkinsCalculator } from "./skins.calculator";

const calc = createSkinsCalculator();

function makeScores(...strokes: number[]) {
  return strokes.map((s, i) => ({ playerId: `player-${i + 1}`, strokes: s }));
}

describe("skins.calculator", () => {
  it("awards skin to sole lowest scorer", () => {
    const result = calc.calculateHole({ scores: makeScores(3, 4, 5), config: { bet_per_hole: 5 } });
    expect(result.winners).toEqual(["player-1"]);
  });

  it("carries over on tie", () => {
    const result = calc.calculateHole({ scores: makeScores(4, 4, 5), config: { bet_per_hole: 5 } });
    expect(result.winners).toEqual([]);
    expect(result.metadata.carryover_value).toBe(5);
  });

  it("awards accumulated carryover to first winner", () => {
    const previousResults = [
      { holeNumber: 1, winners: [], metadata: { carryover_value: 10 } },
    ];
    const result = calc.calculateHole({
      holeNumber: 2,
      scores: makeScores(3, 4, 5),
      config: { bet_per_hole: 5 },
      previousResults,
    });
    expect(result.metadata.skin_value).toBe(15);
  });
});
```

---

## Zustand store tests

```typescript
// stores/live-activity-store.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { useLiveActivityStore } from "./live-activity-store";

beforeEach(() => {
  useLiveActivityStore.getState().clearActivity();
});

describe("useLiveActivityStore", () => {
  it("initialises with isActive false", () => {
    expect(useLiveActivityStore.getState().isActive).toBe(false);
    expect(useLiveActivityStore.getState().roundId).toBeNull();
  });

  it("setActivity marks active and stores roundId", () => {
    useLiveActivityStore.getState().setActivity("round-abc");
    expect(useLiveActivityStore.getState().isActive).toBe(true);
    expect(useLiveActivityStore.getState().roundId).toBe("round-abc");
  });

  it("clearActivity resets to initial state", () => {
    useLiveActivityStore.getState().setActivity("round-abc");
    useLiveActivityStore.getState().clearActivity();
    expect(useLiveActivityStore.getState().isActive).toBe(false);
  });
});
```

**Rule:** Always reset store state in `beforeEach`. Test initial state, each action, and reset.

---

## Test infrastructure

### createTestDatabase vs connectToTestDatabase

```typescript
import {
  connectToTestDatabase,  // uses shared container from globalSetup (preferred)
  createTestDatabase,     // spins up its own container (slower, for isolated suites)
  factories,
  type TestDatabase,
  type TestDatabaseContext,
} from "@bokendell/{app}-db/testing";
```

- Use `connectToTestDatabase()` in most tests (shared container, faster)
- Use `createTestDatabase()` only when you need complete isolation
- The container is started by the `integration` vitest project's
  `globalSetup` — it only fires when integration tests actually run, so
  unit-only runs never pay the cost.

### Factory API

```typescript
// Single create
const user = await factories.user.create(db);
const user = await factories.user.create(db, { name: "Alice" });

// With relationships
const area = await factories.area.create(db, { userId: user.id });
const area = await factories.area.create(db, { userId: user.id, name: "Health", isDefault: true });

// Bulk create
const users = await factories.user.createMany(db, 5);
const areas = await factories.area.createMany(db, user.id, 3);

// Domain defaults
const areas = await factories.area.createDefaults(db, user.id);
```

Each factory: `create(db, overrides?)`, `createMany(db, ownerId, count, overrides?)`.

---

## E2E tests (Playwright)

### Structure

```
packages/{app}/e2e/
├── api/                     # API contract tests (no browser)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── fixtures/    # test context, authenticated users
│   │   │   ├── helpers/     # round-flow, friendship, cleanup-tracker
│   │   │   └── config/
│   │   └── packages/        # domain API calls
│   │       ├── rounds/rounds.api.ts
│   │       └── settlements/settlements.api.ts
│   └── tests/
│       └── contract/
│           └── {domain}/{name}.contract.spec.ts
├── admin/                   # Admin UI E2E
│   └── tests/
└── app/                     # Web app UI E2E (or mobile/)
    └── tests/
```

### API E2E pattern

```typescript
// tests/contract/settlement/settlement.contract.spec.ts
import { expect, test } from "../../../src/index";

test.describe("Settlement contract", () => {
  test("returns correct settlement shape for completed round", async ({ ctx }) => {
    const { creator, member } = ctx.users;

    await establishFreshFriendship(creator, member, ctx.cleanup);
    const setup = await createCoreRoundWithInvite({ creator, member, runLabel: runId("test") });

    await respondToRoundInvite(member.client, setup.round.id, "accepted");
    await updateRoundStatus(creator.client, setup.round.id, "completed");

    const settlement = await getRoundSettlement(creator.client, setup.round.id);

    expect(settlement).toMatchObject({
      roundId: setup.round.id,
      debts: expect.any(Array),
    });
    for (const debt of settlement.debts) {
      expect(debt).toMatchObject({
        amount: expect.any(String),
        status: expect.stringMatching(/^(owed|paid|forgiven)$/),
      });
    }
  });
});
```

### Custom test fixture

```typescript
// src/lib/fixtures/test-context.fixture.ts
export const test = base.extend<{ ctx: TestContext }>({
  ctx: async ({ request }, use) => {
    const cleanup = new CleanupTracker();
    const users = await createTestUsersContext(request);
    await use({ users, cleanup });
    await cleanup.runAll(); // teardown after each test
  },
});
```

**Rules:**
- API E2E tests use `toMatchObject` — test shape, not exact values
- Always clean up created data via `CleanupTracker`
- Use domain helper functions (`createCoreRoundWithInvite`, `establishFreshFriendship`) to avoid repeated setup code
- UI E2E tests should cover critical user journeys, not every button click

---

## Performance tests (K6)

```
packages/{app}/performance/
├── scripts/
│   └── smoke.js             # Entry point
├── lib/
│   ├── client.js            # HTTP client with auth
│   ├── config.js            # THRESHOLDS, ENV
│   └── json.js              # parseJsonBody
└── packages/
    ├── health/health.check.js
    ├── rounds/rounds.check.js
    └── index.js             # runSmokeChecks
```

```javascript
// packages/health/health.check.js
import { check } from "k6";
import { parseJsonBody } from "../../lib/json.js";

export function runHealthCheck(client) {
  const response = client.get("/api/v1/health");
  check(response, {
    "health: status is 200": (res) => res.status === 200,
    "health: body is healthy": (res) => parseJsonBody(res)?.status === "healthy",
    "health: response time < 500ms": (res) => res.timings.duration < 500,
  });
}
```

```javascript
// scripts/smoke.js
export const options = {
  vus: 1,
  duration: "10s",
  thresholds: THRESHOLDS,   // from lib/config.js
  insecureSkipTLSVerify: true,
};

export default function () {
  const client = createSmokeClient();
  runSmokeChecks(client);   // calls all domain checks
  sleep(1);
}
```

**Run:** `K6_DEPLOYMENT_URL=http://localhost:3000 pnpm test:smoke`

---

## What to test (rules)

| Do test | Don't test |
|---------|-----------|
| Business logic in services | Drizzle ORM internals |
| Validation rules in entities | Zod schema parsing itself |
| Repository reads/writes (integration) | Framework routing behavior |
| Error throwing (NotFoundError, ForbiddenError) | That `vi.fn()` returns what you told it to |
| Store state transitions | React rendering internals |
| Calculator edge cases | oRPC protocol behavior |
| Authorization checks (correct user, correct role) | Third-party library behavior |

**The rule:** If there's business logic, there's a test. If there's a branch, test both paths. If there's authorization, test the forbidden case.
