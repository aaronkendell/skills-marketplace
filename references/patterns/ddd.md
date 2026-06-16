# DDD Architecture Patterns

All backend domains follow Domain-Driven Design. This is the single source of truth for how to structure, implement, and test domains.

> Full worked example: `docs/apps/hive/planning/architecture-notes/ddd-final-decisions.md`
>
> **Composition + DI**: see [`docs/context/patterns/di.md`](./di.md) for how services are wired into the Awilix container, how routers consume them via `ctx.scope.cradle`, and how to use the `withTransaction` helper for service-managed transactions.

---

## Directory structure

```
packages/{app}/domains/src/{domain}/
├── domain/
│   ├── entities/
│   │   └── {entity}.entity.ts          # Entity + Zod schema + factories
│   └── errors/                         # Domain-specific errors (optional)
│       └── duplicate-{entity}.error.ts
├── application/
│   ├── {entity}.service.ts             # All service methods in one file
│   └── utils/                          # Shared helpers (when needed)
├── infrastructure/
│   └── persistence/
│       ├── {entity}.repository.ts      # All repository methods in one file
│       └── {entity}.mapper.ts          # ORM row ↔ domain object
├── presentation/
│   ├── schemas/
│   │   ├── {entity}.request.schema.ts  # Zod request DTOs
│   │   └── {entity}.response.schema.ts # Zod response DTOs
│   └── mappers/
│       └── {entity}-dto.mapper.ts      # Domain ↔ DTO
└── index.ts                            # Public exports only
```

**Simple domains: 8 files. Complex (cross-domain): 10–12 files.**

---

## Entity pattern

```typescript
// domain/entities/skill.entity.ts
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";

export const skillSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Skill = z.infer<typeof skillSchema>;

export const createSkill = (data: {
  eventId: string;
  name: string;
  description?: string | null;
}): Skill => {
  return skillSchema.parse({
    id: createId(),
    eventId: data.eventId,
    name: data.name,
    description: data.description ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

export const updateSkill = (
  skill: Skill,
  updates: { name?: string; description?: string | null },
): Skill => {
  return skillSchema.parse({ ...skill, ...updates, updatedAt: new Date() });
};
```

**Rules:**
- IDs: `createId()` from `@paralleldrive/cuid2` (never uuid, never auto-increment)
- Always `createdAt` + `updatedAt`
- `createSkill` / `updateSkill` factory functions — never construct plain objects
- Parse through Zod schema to validate at creation time

---

## Service pattern

```typescript
// application/skill.service.ts
import { NotFoundError } from "@bokendell/core/errors";
import type { SkillRepository } from "../infrastructure/persistence/skill.repository";

export interface SkillServiceDeps {
  skillRepository: SkillRepository;
}

export function createSkillService(deps: SkillServiceDeps) {
  const { skillRepository } = deps;

  // Private helpers (not exported)
  async function findOrThrow(id: string) {
    const skill = await skillRepository.findById(id);
    if (!skill) throw new NotFoundError("Skill", id);
    return skill;
  }

  return {
    async getAll(): Promise<Skill[]> {
      return skillRepository.findAll();
    },

    async getById(id: string): Promise<Skill> {
      return findOrThrow(id);
    },

    async getByIds(ids: string[]): Promise<Skill[]> {
      return skillRepository.findByIds(ids);
    },

    async create(input: CreateSkillInput): Promise<Skill> {
      const existing = await skillRepository.findByName(input.name, input.eventId);
      if (existing) throw new DuplicateSkillError(input.name, input.eventId);
      const skill = createSkill(input);
      return skillRepository.save(skill);
    },

    async update(id: string, input: UpdateSkillInput): Promise<Skill> {
      const skill = await findOrThrow(id);
      const updated = updateSkill(skill, input);
      return skillRepository.update(updated);
    },

    async delete(id: string): Promise<void> {
      await findOrThrow(id);
      await skillRepository.delete(id);
    },
  };
}

export type SkillService = ReturnType<typeof createSkillService>;
```

**Rules:**
- One file, all methods
- `ReturnType<typeof create{Entity}Service>` for the service type
- Private helpers inside the factory — never exported
- Let repository errors bubble — only catch/throw domain errors

---

## Authorization — services gate with a Policy (golf authz v2)

A scope check at the route ("may write goals in general") does **not** authorize
the specific object ("…and this goal is theirs"). In golf, the object-level
decision lives **in the service**, expressed as an injected **Policy**. (Full
model — Principals, scopes, the policy catalogue — in `auth-and-scopes.md`.)

```typescript
// application/goal.service.ts
import type { Principal } from "../../../lib/context/principal";

export function createGoalService(deps: GoalServiceDeps) {
  const { goalRepository, ownershipPolicy } = deps;   // policy is a DI dependency

  return {
    // mutations take `caller: Principal` — never a bare userId for an authz decision
    async updateGoal(goalId: string, caller: Principal, input: UpdateGoalInput): Promise<Goal> {
      const goal = await goalRepository.findByIdOrThrow(goalId);
      ownershipPolicy.assertSelf(caller, goal.userId, {
        action: "goal.update",          // TYPED AuthzAction — controlled audit dimension
        resourceType: "goal",
        resourceId: goalId,
        error: () => new GoalNotFoundError(goalId),  // anti-enumeration: hide from non-owners
      });
      return goalRepository.update(goalId, input);
    },
  };
}
```

**Rules:**
- A service method that **mutates** on behalf of a caller takes `caller: Principal`
  and calls a policy (`OwnershipPolicy.assertSelf`, a membership/admin policy, or
  `EntitlementPolicy.assertEntitled` for paid features). Policies are **injected**
  (mockable), never reach into infrastructure.
- Policies extend **`AuthzPolicy`** and route through core's `Policy` choke point,
  so every denial is **audited** (`authz_audit`, via the global sink wired in
  composition). Use the **typed** `AuthzAction`/`AuthzResourceType` vocabulary.
- `system` callers pass ownership/entitlement gates — per-user background jobs use
  `systemActingAs(reason, userId)` so the subject is still the user.
- Throw `NotFound` instead of `Forbidden` (`opts.error`) when existence itself is
  sensitive.
- The swarm rule **`service-mutation-requires-policy`** (`pnpm swarm check arch`)
  flags any mutation missing a gate — **including** caller-less ones that act on a
  foreign id/email. It must sit at **zero**; don't `arch-allow` it, convert to a
  real gate (caller + policy, or `AccessPolicy.assertSystem` for genuinely
  system-internal methods). **Review flag:** a new service mutation with no policy
  assertion.

---

## Repository pattern

```typescript
// infrastructure/persistence/skill.repository.ts
import { eq, inArray } from "drizzle-orm";
import type { Database } from "@bokendell/portfolio-db";
import { skills } from "@bokendell/portfolio-db/models";
import { toSkillDomain } from "./skill.mapper";

export interface SkillRepositoryDeps {
  db: Database;
}

export function createSkillRepository(deps: SkillRepositoryDeps) {
  const { db } = deps;

  return {
    async findAll(): Promise<Skill[]> {
      const rows = await db.select().from(skills);
      return rows.map(toSkillDomain);
    },

    async findById(id: string): Promise<Skill | null> {
      const [row] = await db.select().from(skills).where(eq(skills.id, id));
      return row ? toSkillDomain(row) : null;
    },

    async findByIds(ids: string[]): Promise<Skill[]> {
      if (ids.length === 0) return [];
      const rows = await db.select().from(skills).where(inArray(skills.id, ids));
      return rows.map(toSkillDomain);
    },

    async save(skill: Skill): Promise<Skill> {
      const [result] = await db.insert(skills).values(toSkillRow(skill)).returning();
      if (!result) throw new Error("Failed to save skill");
      return toSkillDomain(result);
    },

    async update(skill: Skill): Promise<Skill> {
      const [result] = await db
        .update(skills)
        .set(toSkillRow(skill))
        .where(eq(skills.id, skill.id))
        .returning();
      if (!result) throw new Error("Failed to update skill");
      return toSkillDomain(result);
    },

    async delete(id: string): Promise<boolean> {
      const result = await db.delete(skills).where(eq(skills.id, id));
      return (result.rowCount ?? 0) > 0;
    },
  };
}

export type SkillRepository = ReturnType<typeof createSkillRepository>;
```

**Rules:**
- Return `null` for expected "not found" — never throw
- Throw `Error` for unexpected DB failures (e.g., insert returning nothing)
- Repositories are **private to their domain** — never import another domain's repository
- Use Neon HTTP driver (no WebSockets): `@neondatabase/serverless`

---

## Mapper pattern

```typescript
// infrastructure/persistence/skill.mapper.ts
import type { skills } from "@bokendell/portfolio-db/models";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

type SkillRow = InferSelectModel<typeof skills>;
type SkillInsertRow = InferInsertModel<typeof skills>;

export function toSkillDomain(row: SkillRow): Skill {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSkillRow(skill: Skill): SkillInsertRow {
  return {
    id: skill.id,
    event_id: skill.eventId,
    name: skill.name,
    description: skill.description,
    created_at: skill.createdAt,
    updated_at: skill.updatedAt,
  };
}
```

**Rules:** camelCase in TypeScript, snake_case in DB columns.

---

## DTO schemas

```typescript
// presentation/schemas/skill.request.schema.ts
import { z } from "zod";

export const createSkillRequestSchema = z.object({
  eventId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

export const updateSkillRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

export type CreateSkillRequest = z.infer<typeof createSkillRequestSchema>;
export type UpdateSkillRequest = z.infer<typeof updateSkillRequestSchema>;
```

```typescript
// presentation/schemas/skill.response.schema.ts
import { z } from "zod";

export const skillResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SkillResponse = z.infer<typeof skillResponseSchema>;
```

```typescript
// presentation/mappers/skill-dto.mapper.ts
export function toSkillResponse(skill: Skill): SkillResponse {
  return {
    id: skill.id,
    eventId: skill.eventId,
    name: skill.name,
    description: skill.description,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  };
}
```

---

## Index (public exports)

```typescript
// index.ts — export types and service factory only
export type { Skill, CreateSkillInput, UpdateSkillInput } from "./domain/entities/skill.entity";
export { createSkillService } from "./application/skill.service";
export type { SkillService } from "./application/skill.service";
export { createSkillRepository } from "./infrastructure/persistence/skill.repository";
export type { SkillRepository } from "./infrastructure/persistence/skill.repository";
export * from "./presentation/schemas/skill.request.schema";
export * from "./presentation/schemas/skill.response.schema";
export { toSkillResponse } from "./presentation/mappers/skill-dto.mapper";
```

**Never export repositories from `packages/*/domains` — they're internal to the package.**

---

## Cross-domain patterns

### Rule: services are public, repositories are private

```
Core Domains            Aggregate Domains        Infrastructure Domains
┌──────────┐           ┌───────────────┐        ┌─────────────┐
│ Skills   │ ←─────────│  Projects     │ ←──────│  Files      │
│ Events   │           │  Timeline     │        │  Email      │
└──────────┘           └───────────────┘        └─────────────┘
```

- ✅ Aggregates → Core, Aggregates → Infrastructure
- ✅ API layer → any service
- ❌ Core → Aggregates, Infrastructure → Aggregates

### Pattern 1: API layer orchestration (one-off)

```typescript
// API route — combine without coupling domains
const project = await projectService.getById(id);
const skills = await skillService.getByIds(project.skillIds);
return c.json({ data: { ...toProjectResponse(project), skills: skills.map(toSkillResponse) } });
```

### Pattern 2: Private helper (repeated enrichment)

```typescript
export function createProjectService(deps: {
  projectRepository: ProjectRepository;
  fileService: FileService;
}) {
  async function populateFile(project: Project): Promise<Project> {
    if (!project.imageFileId) return { ...project, imageFile: null };
    return { ...project, imageFile: await deps.fileService.getFile(project.imageFileId) };
  }

  return {
    async getById(id: string) {
      const project = await deps.projectRepository.findById(id);
      if (!project) throw new NotFoundError("Project", id);
      return populateFile(project); // always enriched
    },
  };
}
```

### Pattern 3: Domain wrapper (domain validation + cross-domain)

```typescript
async generateProjectImageUpload(projectId: string, params: UploadParams, userId: string) {
  await this.getById(projectId); // validate project exists first
  return deps.fileService.generatePresignedUrl({
    ...params,
    category: "image",   // project-specific config
    userId,
    isPublic: true,
  });
},
```

---

## Inngest functions and infrastructure

Inngest functions live in `infrastructure/inngest/` and orchestrate domain logic on a schedule or in response to events. They **must only depend on services**, never repositories.

```typescript
// ✅ Correct — Inngest function depends on service
export interface ComputeStreaksDeps {
  goalService: GoalService;
}

export function createComputeStreaksFunction(deps: ComputeStreaksDeps) {
  return inngest.createFunction(
    { id: "hive/compute-streaks" },
    { cron: "0 0 * * *" },
    async ({ logger }) => {
      const habits = await deps.goalService.getActiveHabits();
      // ... use service methods
    },
  );
}

// ❌ Wrong — Inngest function uses repository directly
export function createComputeStreaksFunction(deps: { goalRepository: GoalRepository }) {
  // Bypasses domain validation and business rules
}
```

**Why?** Repositories are private to their domain. Direct repository usage in Inngest functions:
- Bypasses domain validation (entity factories, Zod schema parsing)
- Bypasses business rules (service-level checks, cross-domain enrichment)
- Creates a second codepath that can diverge from the service

This rule is enforced by the `inngest-no-repository` architecture check.

---

## External integrations

External APIs live in a dedicated `integrations/` domain when multiple providers
serve similar roles, or in `infrastructure/external/` within a domain for tightly-coupled
single providers.

### When to use `integrations/` domain (hive pattern)

- Multiple providers serve similar data (health APIs, financial APIs)
- Token lifecycle management is shared across providers
- Connection status tracking and error handling needed

### When to use `infrastructure/external/` (golf pattern)

- Single provider tightly coupled to one domain (golfbert -> courses)
- No shared token management needed

### Structure per provider

```
integrations/{provider}/
├── domain/entities/             # Normalized shapes from the raw API
├── infrastructure/
│   ├── {provider}.client.ts          # createXxxClient(config) factory
│   ├── {provider}.client.types.ts    # Config + raw API response types
│   └── {provider}.mapper.ts          # Raw API -> domain entity mapping
├── application/
│   ├── {provider}.service.ts         # Business logic wrapping client
│   └── {provider}.service.types.ts
└── index.ts
```

### Shared connection management

When providers need token lifecycle:

```
integrations/shared/
├── domain/entities/integration-connection.entity.ts
├── infrastructure/connection.repository.ts + mapper
└── application/connection.service.ts
```

The connection service owns connect/disconnect/refresh/getValidToken.
Provider sync functions get tokens from the connection service,
create ephemeral client+service instances, and mark sync success/error.

```typescript
// Sync function pattern — get token, create client+service, pull data, mark result
const token = await connectionService.getValidToken("oura");
const client = createOuraClient({ accessToken: token });
const service = createOuraService({ client });
const sleep = await service.getDailySleep(yesterday, today);
await connectionService.markSyncSuccess("oura");
```

---

## Helper method placement

```
Used by one method in one service?
→ Private function inside service factory (not exported)

Used by multiple services in same domain?
→ application/utils/{helpers}.ts

Used across multiple domains?
→ @bokendell/core utility
```

---

## Error handling

### Hierarchy

```typescript
// packages/shared/core/src/errors.ts
export class AppError<TDetails = unknown> extends Error {
  constructor(
    message: string,
    readonly statusCode: AppErrorStatusCode,
    readonly errorCode: string,
    readonly details?: TDetails,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 404, ERROR_CODES.NOT_FOUND, { resource, id });
  }
}
export class ValidationError extends AppError { /* statusCode: 400 */ }
export class ForbiddenError  extends AppError { /* statusCode: 403 */ }
export class UnauthorizedError extends AppError { /* statusCode: 401 */ }
export class ConflictError   extends AppError { /* statusCode: 409 */ }
export class DatabaseError   extends AppError { /* statusCode: 500 */ }

/**
 * External API integration failure. The bridge maps:
 *   upstream 4xx → statusCode 422 (UNPROCESSABLE_CONTENT)
 *   upstream 5xx → statusCode 502 (BAD_GATEWAY / INTERNAL_SERVER_ERROR)
 */
export class ExternalApiError extends AppError<{ provider: string; upstreamStatus: number }> {
  constructor(provider: string, upstreamStatus: number, message?: string) {
    const statusCode = upstreamStatus >= 500 ? 502 : 422;
    super(message ?? `${provider} returned ${upstreamStatus}`, statusCode, ERROR_CODES.EXTERNAL_API_ERROR, { provider, upstreamStatus });
  }
}
```

### Domain-specific errors

```typescript
// domains/skills/domain/errors/duplicate-skill.error.ts
export class DuplicateSkillError extends ConflictError {
  override readonly errorCode = "DUPLICATE_SKILL";
  constructor(name: string, eventId: string) {
    super(`Skill '${name}' already exists for this event`, 409, "DUPLICATE_SKILL", { name, eventId });
  }
}
```

### Layer rules

| Layer | Pattern |
|-------|---------|
| Repository | Return `null` for "not found". Throw `Error` for unexpected DB failures. |
| Service | Throw `NotFoundError` when resource must exist. Throw domain errors for business rules. Let other errors bubble. |
| API route | Global error handler (oRPC bridge or tRPC middleware) catches `AppError` → maps `statusCode` + `errorCode`. Logs unexpected errors → 500. |

### Decision tree

```
Resource not found? → throw new NotFoundError('Resource', id)
Business rule violated (domain-specific)? → throw new DuplicateSkillError(...)
Business rule violated (generic)? → throw new ValidationError('message')
Permission issue? → throw new ForbiddenError('message')
Third-party API failed? → throw new ExternalApiError(provider, upstreamStatus, message)
Unexpected failure? → let it throw (don't catch)
```

### oRPC bridge procedure pattern (golf)

Domain services throw `AppError` subclasses. The API tier converts them to typed `ORPCError` via an **app-tier bridge middleware** — not in the service, not in Awilix, not in the domain. The bridge lives in `apps/api/src/packages/api/procedures/base.ts` and is applied to every procedure base:

```typescript
// apps/api/src/packages/api/procedures/base.ts
import { mapStatusToOrpcCode } from "@bokendell/api/orpc";
import { AppError, isAppErrorLike } from "@bokendell/core";
import { ORPCError } from "@orpc/server";

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

**Rules:**
- The bridge runs in procedure middleware, not in services or repositories.
- Typed procedure errors (declared via `.errors()`) are thrown as `ORPCError` before the bridge runs — they pass through unchanged.
- `AppError` subclasses from domain services bubble up to the bridge; the bridge converts them once at the API tier boundary.
- `ExternalApiError` follows the same path — it's an `AppError` subclass with typed `details` (`provider`, `upstreamStatus`).

---

## Package exports configuration

```json
// packages/{app}/domains/package.json
{
  "exports": {
    "./skills": "./src/skills/index.ts",
    "./projects": "./src/projects/index.ts"
  }
}
```

Import from other packages:
```typescript
import { createSkillService } from "@bokendell/portfolio-domains/skills";
```

---

## Wiring in the API

```typescript
// apps/{app}/api/src/index.ts or per-route factory
const db = createDatabase();
const skillRepository = createSkillRepository({ db });
const skillService = createSkillService({ skillRepository });

// Cross-domain
const fileService = createFileService({ fileRepository, storageClient });
const projectService = createProjectService({ projectRepository, fileService });

// Route handler
router.openapi(getSkillRoute, async (c) => {
  const { id } = c.req.valid("param");
  const skill = await skillService.getById(id);
  return c.json({ data: toSkillResponse(skill) }, 200);
});
```
