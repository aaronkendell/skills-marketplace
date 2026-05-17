---
name: ddd-scaffolding
description: Use when creating a new domain, adding entities/services/repositories to existing domains, or scaffolding DDD structure. Triggers when asked to "create a domain", "add a new entity", "scaffold a service", or work with domain-driven design patterns in this monorepo.
---

# DDD Domain Scaffolding Skill

This skill scaffolds new DDD domains or extends existing domains in this monorepo. All patterns are derived from the authoritative reference at `docs/architecture/ddd-final-decisions.md` and validated against real implementations in `packages/portfolio/domains/` and `packages/golf/domains/`.

## Directory Structure (Standard Domain: 8+ files)

When creating a new domain called `{domain}` (singular, e.g. `skill`, `notification`, `project`):

```
packages/{project}/domains/src/{domain-plural}/
├── domain/
│   └── entities/
│       └── {domain}.entity.ts              # 1. Entity schema + factory functions
│   └── errors/                             # (Optional) Domain-specific errors
│       └── index.ts
│   └── constants/                          # (Optional) Domain constants
│       └── index.ts
├── application/
│   └── {domain}.service.ts                 # 2. Service (all methods, factory function)
│   └── types/
│       └── {domain}.types.ts               # 3. Input types, deps interface, service type
├── infrastructure/
│   └── persistence/
│       ├── {domain}.repository.ts          # 4. Repository (all methods, factory function)
│       └── {domain}.mapper.ts              # 5. ORM <-> Domain mapper (toDomain, toORM)
├── presentation/
│   ├── schemas/
│   │   ├── {domain}.request.schema.ts      # 6. Request DTOs (Zod, OpenAPI annotations)
│   │   └── {domain}.response.schema.ts     # 7. Response DTOs (Zod, OpenAPI annotations)
│   └── mappers/
│       └── {domain}-dto.mapper.ts          # 8. Domain <-> DTO mappers (toResponse, fromCreateRequest, fromUpdateRequest)
├── client.ts                               # (Optional) Client-safe type-only exports
└── index.ts                                # 9. Public barrel exports
```

## File Templates

### 1. Entity (`domain/entities/{domain}.entity.ts`)

```typescript
import { z } from "zod";

/**
 * {Domain} domain entity schema
 * Validated with Zod for runtime type safety
 */
export const {domain}Schema = z.object({
	id: z.uuid(),
	// Add domain fields here
	name: z.string().min(1).max(100),
	description: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type {Domain} = z.infer<typeof {domain}Schema>;

/**
 * Factory function to create a new {domain}
 * Generates id and timestamps
 */
export const create{Domain} = (data: {
	name: string;
	description?: string | null;
}): {Domain} => {
	const {domain}: {Domain} = {
		id: crypto.randomUUID(),
		name: data.name,
		description: data.description ?? null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	// Validate and return
	return {domain}Schema.parse({domain});
};

/**
 * Immutable update function
 * Returns a new {domain} with updates applied
 */
export const update{Domain} = (
	{domain}: {Domain},
	updates: {
		name?: string;
		description?: string | null;
	},
): {Domain} => {
	const updated: {Domain} = {
		...{domain},
		...(updates.name !== undefined && { name: updates.name }),
		...(updates.description !== undefined && { description: updates.description }),
		updatedAt: new Date(),
	};

	// Validate and return
	return {domain}Schema.parse(updated);
};
```

**Key patterns:**
- Use `z.uuid()` for ID fields
- Use `.nullable()` (NOT `.optional()`) for optional domain fields
- Factory functions (`create{Domain}`, `update{Domain}`) generate IDs and timestamps
- Always validate with `schema.parse()` at the end of factory functions
- Use immutable update pattern (spread + override)

### 2. Service (`application/{domain}.service.ts`)

```typescript
import { NotFoundError } from "@bokendell/core";
import type { {Domain} } from "../domain/entities/{domain}.entity";
import { create{Domain}, update{Domain} } from "../domain/entities/{domain}.entity";
import type {
	Create{Domain}Input,
	{Domain}ServiceDeps,
	Update{Domain}Input,
} from "./types/{domain}.types";

export function create{Domain}Service(deps: {Domain}ServiceDeps) {
	const { {domain}Repository } = deps;

	// Private helpers go here (not exported)
	// async function validate{Domain}Ownership(id: string, userId: string) { ... }

	return {
		/**
		 * Get all {domain}s
		 */
		async getAll(): Promise<{Domain}[]> {
			return {domain}Repository.findAll();
		},

		/**
		 * Get {domain} by ID (throws if not found)
		 */
		async getById(id: string): Promise<{Domain}> {
			const {domain} = await {domain}Repository.findById(id);
			if (!{domain}) {
				throw new NotFoundError("{Domain}", id);
			}
			return {domain};
		},

		/**
		 * Get multiple {domain}s by IDs (used by other domains)
		 */
		async getByIds(ids: string[]): Promise<{Domain}[]> {
			return {domain}Repository.findByIds(ids);
		},

		/**
		 * Create a new {domain}
		 */
		async create(input: Create{Domain}Input): Promise<{Domain}> {
			const {domain} = create{Domain}({
				name: input.name,
				description: input.description,
			});

			return {domain}Repository.save({domain});
		},

		/**
		 * Update an existing {domain}
		 */
		async update(id: string, input: Update{Domain}Input): Promise<{Domain}> {
			const existing = await this.getById(id);
			const updated = update{Domain}(existing, input);
			return {domain}Repository.update(updated);
		},

		/**
		 * Delete a {domain} by ID
		 */
		async delete(id: string): Promise<void> {
			const deleted = await {domain}Repository.delete(id);
			if (!deleted) {
				throw new NotFoundError("{Domain}", id);
			}
		},
	};
}
```

**Key patterns:**
- Factory function pattern (NOT classes): `create{Domain}Service(deps)`
- Private helpers are regular functions inside the factory closure, not exported
- Use `this.getById()` for internal reuse (e.g., update calls getById for existence check)
- Import errors from `@bokendell/core` (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`)
- Return type is inferred via `ReturnType<typeof create{Domain}Service>`

### 3. Types (`application/types/{domain}.types.ts`)

```typescript
import type { {Domain}Repository } from "../../infrastructure/persistence/{domain}.repository";
import type { create{Domain}Service } from "../{domain}.service";

export interface Create{Domain}Input {
	readonly name: string;
	readonly description?: string | null;
}

export interface Update{Domain}Input {
	readonly name?: string;
	readonly description?: string | null;
}

export interface {Domain}ServiceDeps {
	{domain}Repository: {Domain}Repository;
	// Add cross-domain dependencies here:
	// fileService: FileService;
}

export type {Domain}Service = ReturnType<typeof create{Domain}Service>;
```

**Key patterns:**
- Input types use `readonly` properties
- Service deps interface declares all dependencies (repository + cross-domain services)
- Service type is derived from `ReturnType<typeof create{Domain}Service>`
- Cross-domain dependencies are other domain services injected here

### 4. Repository (`infrastructure/persistence/{domain}.repository.ts`)

For portfolio projects (Hono API):
```typescript
import { {domainPlural} as {domainPlural}Table } from "@bokendell/portfolio-db";
import { db } from "@bokendell/portfolio-db/client";
import { eq, inArray } from "drizzle-orm";
import type { {Domain} } from "../../domain/entities/{domain}.entity";
import { toDomain, toORM } from "./{domain}.mapper";

export interface {Domain}RepositoryDeps {
	db?: typeof db;
}

export function create{Domain}Repository(deps: {Domain}RepositoryDeps = {}) {
	const database = deps.db || db;

	return {
		async save({domain}: {Domain}): Promise<{Domain}> {
			const row = toORM({domain});
			const [result] = await database.insert({domainPlural}Table).values(row).returning();

			if (!result) {
				throw new Error("Failed to save {domain}");
			}

			return toDomain(result);
		},

		async update({domain}: {Domain}): Promise<{Domain}> {
			const row = toORM({domain});
			const [result] = await database
				.update({domainPlural}Table)
				.set(row)
				.where(eq({domainPlural}Table.id, {domain}.id))
				.returning();

			if (!result) {
				throw new Error(`{Domain} ${{{domain}}.id} not found`);
			}

			return toDomain(result);
		},

		async findById(id: string): Promise<{Domain} | null> {
			const [row] = await database
				.select()
				.from({domainPlural}Table)
				.where(eq({domainPlural}Table.id, id))
				.limit(1);

			return row ? toDomain(row) : null;
		},

		async findAll(): Promise<{Domain}[]> {
			const rows = await database.select().from({domainPlural}Table);
			return rows.map(toDomain);
		},

		async findByIds(ids: string[]): Promise<{Domain}[]> {
			if (ids.length === 0) return [];

			const rows = await database
				.select()
				.from({domainPlural}Table)
				.where(inArray({domainPlural}Table.id, ids));

			return rows.map(toDomain);
		},

		async delete(id: string): Promise<boolean> {
			const result = await database
				.delete({domainPlural}Table)
				.where(eq({domainPlural}Table.id, id))
				.returning();

			return result.length > 0;
		},
	};
}

export type {Domain}Repository = ReturnType<typeof create{Domain}Repository>;
```

For golf projects (tRPC API), the db import changes:
```typescript
import { db as defaultDb, {domainPlural}, eq, inArray } from "@bokendell/golf-db";
```

**Key patterns:**
- `findById` returns `null` (not throw) for "not found"
- `save`/`update` throw `Error` on unexpected failure
- `delete` returns `boolean`
- Always use mapper functions (`toDomain`, `toORM`)
- Repository type is derived from `ReturnType<typeof create{Domain}Repository>`
- `db` dependency is optional to allow test injection

### 5. Mapper (`infrastructure/persistence/{domain}.mapper.ts`)

```typescript
import type { {Domain}Entity } from "@bokendell/{project}-db";
import type { {Domain} } from "../../domain/entities/{domain}.entity";
import { {domain}Schema } from "../../domain/entities/{domain}.entity";

/**
 * Map ORM entity to domain entity
 * Validates with Zod for safety
 */
export function toDomain(entity: {Domain}Entity): {Domain} {
	return {domain}Schema.parse({
		id: entity.id,
		name: entity.name,
		description: entity.description,
		createdAt: entity.createdAt,
		updatedAt: entity.updatedAt,
	});
}

/**
 * Map domain entity to ORM entity
 */
export function toORM({domain}: {Domain}): {Domain}Entity {
	return {
		id: {domain}.id,
		name: {domain}.name,
		description: {domain}.description,
		createdAt: {domain}.createdAt,
		updatedAt: {domain}.updatedAt,
	};
}
```

Optionally add a `toDomainList` helper:
```typescript
export function toDomainList(entities: {Domain}Entity[]): {Domain}[] {
	return entities.map(toDomain);
}
```

**Key patterns:**
- `toDomain` always validates through `schema.parse()` for safety
- `toORM` is a plain object mapping (no validation needed)
- Import the entity type from the DB package for the ORM side

### 6. Request Schema (`presentation/schemas/{domain}.request.schema.ts`)

```typescript
import { z } from "zod";

export const create{Domain}RequestSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
});

export type Create{Domain}Request = z.infer<typeof create{Domain}RequestSchema>;

export const update{Domain}RequestSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().nullable().optional(),
});

export type Update{Domain}Request = z.infer<typeof update{Domain}RequestSchema>;
```

For tRPC with OpenAPI, add `.openapi()` annotations:
```typescript
export const create{Domain}RequestSchema = z.object({
	name: z.string().min(1).max(100).openapi({
		description: "Name of the {domain}",
		example: "Example Name",
	}),
});
```

### 7. Response Schema (`presentation/schemas/{domain}.response.schema.ts`)

For Hono OpenAPI (portfolio):
```typescript
import { z } from "zod";

export const {domain}ResponseSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	description: z.string().nullable(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

export type {Domain}Response = z.infer<typeof {domain}ResponseSchema>;
```

For tRPC OpenAPI (golf):
```typescript
import { z } from "zod";

export const {domain}ResponseSchema = z
	.object({
		id: z.uuid().openapi({
			description: "Unique identifier",
			example: "550e8400-e29b-41d4-a716-446655440000",
		}),
		name: z.string().openapi({
			description: "{Domain} name",
			example: "Example",
		}),
		description: z.string().nullable().openapi({
			description: "{Domain} description",
		}),
		createdAt: z.date().openapi({
			description: "Creation timestamp",
			example: "2024-01-01T00:00:00.000Z",
		}),
		updatedAt: z.date().openapi({
			description: "Last update timestamp",
			example: "2024-01-01T00:00:00.000Z",
		}),
	})
	.openapi("{Domain}");

export type {Domain}Response = z.infer<typeof {domain}ResponseSchema>;
```

**Key difference:** Portfolio uses `z.iso.datetime()` for date serialization (strings). Golf uses `z.date()` because tRPC handles serialization via superjson.

### 8. DTO Mapper (`presentation/mappers/{domain}-dto.mapper.ts`)

```typescript
import type { Create{Domain}Input, Update{Domain}Input } from "../../application/types/{domain}.types";
import type { {Domain} } from "../../domain/entities/{domain}.entity";
import type { Create{Domain}Request, Update{Domain}Request } from "../schemas/{domain}.request.schema";
import type { {Domain}Response } from "../schemas/{domain}.response.schema";

/**
 * Map domain {Domain} to response DTO
 */
export function toResponse({domain}: {Domain}): {Domain}Response {
	return {
		id: {domain}.id,
		name: {domain}.name,
		description: {domain}.description,
		createdAt: {domain}.createdAt.toISOString(),
		updatedAt: {domain}.updatedAt.toISOString(),
	};
}

/**
 * Map create request DTO to service input
 */
export function fromCreateRequest(request: Create{Domain}Request): Create{Domain}Input {
	return {
		name: request.name,
		description: request.description,
	};
}

/**
 * Map update request DTO to service input
 */
export function fromUpdateRequest(request: Update{Domain}Request): Update{Domain}Input {
	return {
		name: request.name,
		description: request.description,
	};
}
```

**Key patterns:**
- `toResponse` converts `Date` to ISO strings (for Hono). For tRPC, dates pass through directly.
- `fromCreateRequest` / `fromUpdateRequest` map API input to service input types

### 9. Index (`index.ts`)

```typescript
// Domain
export {
	{domain}Schema,
	type {Domain},
	create{Domain},
	update{Domain},
} from "./domain/entities/{domain}.entity";

// Service
export { create{Domain}Service } from "./application/{domain}.service";
export type {
	Create{Domain}Input,
	Update{Domain}Input,
	{Domain}Service,
	{Domain}ServiceDeps,
} from "./application/types/{domain}.types";

// Repository
export {
	create{Domain}Repository,
	type {Domain}Repository,
	type {Domain}RepositoryDeps,
} from "./infrastructure/persistence/{domain}.repository";

// Presentation
export {
	type Create{Domain}Request,
	create{Domain}RequestSchema,
	type Update{Domain}Request,
	update{Domain}RequestSchema,
} from "./presentation/schemas/{domain}.request.schema";
export {
	type {Domain}Response,
	{domain}ResponseSchema,
} from "./presentation/schemas/{domain}.response.schema";
export {
	fromCreateRequest,
	fromUpdateRequest,
	toResponse,
} from "./presentation/mappers/{domain}-dto.mapper";
```

**Key patterns:**
- Group by layer with comments: Domain, Service, Repository, Presentation
- Export concrete values AND types
- Export the factory functions, type aliases, schemas, and mappers

### 10. Client-safe exports (Optional: `client.ts`)

For domains that need client-safe imports (no server dependencies):

```typescript
/**
 * Client-safe exports for {domain} domain
 *
 * This module only exports types that can be safely used in client-side
 * code (browser, mobile) without pulling in server-side dependencies.
 */

// Domain Types (Entity Types)
export type {
	{Domain},
} from "./domain/entities/{domain}.entity";

// Presentation - Schemas (Types only)
export type {
	Create{Domain}Request,
	Update{Domain}Request,
} from "./presentation/schemas/{domain}.request.schema";

export type {
	{Domain}Response,
} from "./presentation/schemas/{domain}.response.schema";
```

## Wiring Into the API

### Portfolio (Hono OpenAPI)

1. **Create route files** in `apps/portfolio/api/src/domains/{domain-plural}/`:

```
apps/portfolio/api/src/domains/{domain-plural}/
├── routes/
│   ├── public.routes.ts       # GET endpoints (no auth)
│   └── admin.routes.ts        # CUD endpoints (admin auth)
├── route.schemas.ts           # (Optional) Route-specific schemas
└── index.ts                   # Domain route composition
```

2. **Domain route index** (`apps/portfolio/api/src/domains/{domain-plural}/index.ts`):

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import { adminRoutes } from "./routes/admin.routes";
import { publicRoutes } from "./routes/public.routes";

export const {domain}Routes = new OpenAPIHono();

skillRoutes.route("/", publicRoutes);
skillRoutes.route("/", adminRoutes);
```

3. **Route file** (`routes/public.routes.ts`):

```typescript
import { createSuccessResponse, successResponse } from "@bokendell/core";
import { db } from "@bokendell/portfolio-db";
import {
	create{Domain}Repository,
	create{Domain}Service,
	{domain}ResponseSchema,
	toResponse,
} from "@bokendell/portfolio-domains/{domain-plural}";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { API_TAGS, COMMON_RESPONSES } from "@/api/v1/openapi-config";

// Create service instance
const {domain}Repository = create{Domain}Repository({ db });
const {domain}Service = create{Domain}Service({ {domain}Repository });

export const publicRoutes = new OpenAPIHono();

const list{Domain}sRoute = createRoute({
	method: "get",
	path: "/",
	responses: {
		200: createSuccessResponse(z.array({domain}ResponseSchema), "List of {domain}s"),
		...COMMON_RESPONSES,
	},
	tags: API_TAGS.{DOMAIN_UPPER},
	summary: "Get all {domain}s",
});

publicRoutes.openapi(list{Domain}sRoute, async (c) => {
	const {domain}s = await {domain}Service.getAll();
	return c.json(successResponse({domain}s.map(toResponse)), 200);
});
```

4. **Register in domain index** (`apps/portfolio/api/src/domains/index.ts`):
```typescript
export { {domain}Routes } from "./{domain-plural}";
```

5. **Mount in router** (`apps/portfolio/api/src/api/v1/router.ts`):
```typescript
router.route("/{domain-plural}", {domain}Routes);
```

### Golf (tRPC)

1. **Create service factory** in `apps/golf/api/src/core/services/{domain}.service-factory.ts`:

```typescript
import { db } from "@bokendell/golf-db";
import {
	create{Domain}Repository,
	create{Domain}Service,
} from "@bokendell/golf-domains/{domain-plural}";

const {domain}Repository = create{Domain}Repository({ db });
export const {domain}Service = create{Domain}Service({ {domain}Repository });
```

2. **Re-export from services index** (`apps/golf/api/src/core/services/index.ts`):
```typescript
export { {domain}Service } from "./{domain}.service-factory";
```

3. **Create tRPC router** (`apps/golf/api/src/trpc/routers/{domain-plural}.ts`):

```typescript
import {
	{domain}ResponseSchema,
	to{Domain}Response,
} from "@bokendell/golf-domains/{domain-plural}";
import { z } from "zod";
import { {domain}Service } from "@/core/services";
import { OPENAPI_TAGS } from "../openapi-tags";
import { protectedProcedure, router } from "../trpc";

export const {domain}sRouter = router({
	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/{domain-plural}",
				tags: [OPENAPI_TAGS.{DOMAIN_UPPER}],
				summary: "List {domain}s",
				protect: true,
			},
		})
		.input(z.void())
		.output(z.array({domain}ResponseSchema))
		.query(async ({ ctx }) => {
			const items = await {domain}Service.getAll();
			return items.map(to{Domain}Response);
		}),
});
```

4. **Register in root router** (`apps/golf/api/src/trpc/router.ts`):
```typescript
import { {domain}sRouter } from "./routers/{domain-plural}";

export const appRouter = router({
	{domainPlural}: {domain}sRouter,
});
```

5. **Add OpenAPI tag** (`apps/golf/api/src/trpc/openapi-tags.ts`):
```typescript
export const OPENAPI_TAGS = {
	{DOMAIN_UPPER}: "{Domain}s",
} as const;
```

## Package Registration

After creating domain files, register in the domains `package.json`:

```json
{
	"exports": {
		"./{domain-plural}": "./src/{domain-plural}/index.ts",
		"./{domain-plural}/client": "./src/{domain-plural}/client.ts"
	}
}
```

The package is either `packages/portfolio/domains/package.json` or `packages/golf/domains/package.json`.

## Domain Errors (Optional)

For domain-specific business errors, create `domain/errors/index.ts`:

```typescript
import { AppError } from "@bokendell/core";

export const {DOMAIN}_ERROR_CODES = {
	DUPLICATE_{DOMAIN}: "DUPLICATE_{DOMAIN}",
} as const;

export class Duplicate{Domain}Error extends AppError {
	constructor({domain}Name: string) {
		super(
			`{Domain} '${{{domain}Name}}' already exists`,
			409,
			{DOMAIN}_ERROR_CODES.DUPLICATE_{DOMAIN},
			{ {domain}Name },
		);
		this.name = "Duplicate{Domain}Error";
	}
}
```

**Error hierarchy from `@bokendell/core`:**
- `AppError` (base, 500)
- `NotFoundError` (404)
- `ValidationError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `ConflictError` (409)
- `TimeoutError` (504)
- `DatabaseError` (500)

## Cross-Domain Dependencies

Inject other domain services via the deps interface:

```typescript
// In types/{domain}.types.ts
import type { FileService } from "../../../files/application/types/file.types";

export interface {Domain}ServiceDeps {
	{domain}Repository: {Domain}Repository;
	fileService: FileService;  // Cross-domain dependency
}
```

Then in the service factory (API layer):

```typescript
// In apps/{project}/api/src/core/services/{domain}.service-factory.ts
import { fileService } from "./file.service-factory";

export const {domain}Service = create{Domain}Service({
	{domain}Repository,
	fileService,  // Injected cross-domain
});
```

**Rules:**
- Services are the public API of a domain
- Repositories are private to a domain (never import another domain's repository)
- Core domains CANNOT depend on aggregate domains
- Infrastructure domains CANNOT depend on aggregate domains
- API layer CAN orchestrate any services

## Testing Patterns

### Entity Tests (`domain/entities/{domain}.entity.test.ts`)

Co-located with the entity file:

```typescript
import { describe, expect, it } from "vitest";
import { create{Domain} } from "./{domain}.entity";

describe("{domain}.entity", () => {
	const createValidInput = (overrides = {}) => ({
		name: "Test {Domain}",
		description: "A test {domain}",
		...overrides,
	});

	describe("create{Domain}", () => {
		it("should create a valid {domain} with required fields", () => {
			const {domain} = create{Domain}(createValidInput());

			expect({domain}.id).toBeDefined();
			expect({domain}.name).toBe("Test {Domain}");
			expect({domain}.createdAt).toBeInstanceOf(Date);
			expect({domain}.updatedAt).toBeInstanceOf(Date);
		});

		it("should set nullable fields to null when not provided", () => {
			const {domain} = create{Domain}(createValidInput({ description: undefined }));
			expect({domain}.description).toBeNull();
		});

		it("should reject empty name", () => {
			expect(() => create{Domain}(createValidInput({ name: "" }))).toThrow();
		});
	});
});
```

### Service Tests (`application/{domain}.service.test.ts`)

Co-located with the service file:

```typescript
import { NotFoundError } from "@bokendell/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { {Domain} } from "../domain/entities/{domain}.entity";
import type { {Domain}Repository } from "../infrastructure/persistence/{domain}.repository";
import { create{Domain}Service } from "./{domain}.service";

describe("{Domain}Service", () => {
	const createMock{Domain} = (overrides: Partial<{Domain}> = {}): {Domain} => ({
		id: "550e8400-e29b-41d4-a716-446655440000",
		name: "Test {Domain}",
		description: null,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		...overrides,
	});

	const createMockDeps = () => {
		const {domain}Repository = {
			findAll: vi.fn(),
			findById: vi.fn(),
			findByIds: vi.fn(),
			save: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		} as unknown as {Domain}Repository;

		return { {domain}Repository };
	};

	let deps: ReturnType<typeof createMockDeps>;
	let service: ReturnType<typeof create{Domain}Service>;

	beforeEach(() => {
		vi.clearAllMocks();
		deps = createMockDeps();
		service = create{Domain}Service(deps);
	});

	describe("getById", () => {
		it("should return {domain} when found", async () => {
			const mock{Domain} = createMock{Domain}();
			vi.mocked(deps.{domain}Repository.findById).mockResolvedValue(mock{Domain});

			const result = await service.getById("550e8400-e29b-41d4-a716-446655440000");

			expect(result).toEqual(mock{Domain});
			expect(deps.{domain}Repository.findById).toHaveBeenCalledWith(
				"550e8400-e29b-41d4-a716-446655440000",
			);
		});

		it("should throw NotFoundError when not found", async () => {
			vi.mocked(deps.{domain}Repository.findById).mockResolvedValue(null);

			await expect(service.getById("nonexistent")).rejects.toThrow(NotFoundError);
		});
	});

	describe("create", () => {
		it("should create and return {domain}", async () => {
			const mock{Domain} = createMock{Domain}();
			vi.mocked(deps.{domain}Repository.save).mockResolvedValue(mock{Domain});

			const result = await service.create({ name: "Test" });

			expect(result).toEqual(mock{Domain});
			expect(deps.{domain}Repository.save).toHaveBeenCalled();
		});
	});

	describe("delete", () => {
		it("should throw NotFoundError when {domain} does not exist", async () => {
			vi.mocked(deps.{domain}Repository.delete).mockResolvedValue(false);

			await expect(service.delete("nonexistent")).rejects.toThrow(NotFoundError);
		});
	});
});
```

**Key testing patterns:**
- Test through the service public API, NOT private helpers
- Mock repositories with `vi.fn()` and cast `as unknown as {Domain}Repository`
- Use `createMockDeps()` factory for consistent mock setup
- Use `createMock{Domain}()` with override pattern for test data
- Use `vi.clearAllMocks()` in `beforeEach`
- Test both success and error paths

## Naming Conventions Quick Reference

| Type | File Name | Export Name |
|------|-----------|-------------|
| Entity | `{domain}.entity.ts` | `{domain}Schema`, `{Domain}`, `create{Domain}`, `update{Domain}` |
| Service | `{domain}.service.ts` | `create{Domain}Service` |
| Types | `{domain}.types.ts` | `{Domain}ServiceDeps`, `{Domain}Service`, `Create{Domain}Input`, `Update{Domain}Input` |
| Repository | `{domain}.repository.ts` | `create{Domain}Repository`, `{Domain}Repository`, `{Domain}RepositoryDeps` |
| ORM Mapper | `{domain}.mapper.ts` | `toDomain`, `toORM`, `toDomainList` |
| Request DTO | `{domain}.request.schema.ts` | `create{Domain}RequestSchema`, `update{Domain}RequestSchema` |
| Response DTO | `{domain}.response.schema.ts` | `{domain}ResponseSchema` |
| DTO Mapper | `{domain}-dto.mapper.ts` | `toResponse`, `fromCreateRequest`, `fromUpdateRequest` |
| Domain Error | `domain/errors/index.ts` | `Duplicate{Domain}Error`, `{DOMAIN}_ERROR_CODES` |

## Checklist When Creating a New Domain

1. [ ] Create directory structure under `packages/{project}/domains/src/{domain-plural}/`
2. [ ] Write entity with Zod schema + factory functions
3. [ ] Write service types (deps, inputs, service type alias)
4. [ ] Write service with factory function pattern
5. [ ] Write repository with factory function pattern
6. [ ] Write ORM mapper (`toDomain`, `toORM`)
7. [ ] Write request schemas (Zod)
8. [ ] Write response schemas (Zod)
9. [ ] Write DTO mapper (`toResponse`, `fromCreateRequest`, `fromUpdateRequest`)
10. [ ] Write barrel `index.ts` with all public exports
11. [ ] Add export entry to domains `package.json` exports map
12. [ ] (Optional) Write `client.ts` for client-safe type exports
13. [ ] (Optional) Write domain-specific errors in `domain/errors/`
14. [ ] Wire into API: create route files + service factory
15. [ ] Write entity unit tests
16. [ ] Write service unit tests with mocked repository
