# Conventions

Naming, structure, and code conventions across all apps. Agents must follow these — do not deviate.

## Non-negotiable rules

- **No `any` types.** Ever. If you're tempted, use `unknown` + type narrowing or define the type.
- **No `biome-ignore` comments.** Extremely rare exceptions only — if you feel you need one, you almost certainly don't.
- **No ESLint, no Prettier.** Biome only.
- **No NextAuth, no Supabase.** Better Auth + Neon only.

## Tooling

| Tool | Purpose |
|------|---------|
| Biome | Linting + formatting (replaces ESLint + Prettier) |
| pnpm | Package manager |
| Turbo | Build system + task orchestration |
| Vitest | Unit + integration testing |
| Playwright | E2E testing |
| Drizzle Kit | Database migrations (`pnpm db:push`) |
| Infisical | Secret management (pull secrets, never commit) |

## TypeScript

- Strict mode enabled everywhere
- `noExplicitAny`: warn (treat as error — fix it)
- Path alias: `@/` maps to each app's `src/` directory
- Workspace imports: `@bokendell/{package-name}`
- Export types explicitly: `export type { Foo }` not `export { type Foo }` in barrel files

## File naming

- TypeScript files: `kebab-case.ts`
- React components: `kebab-case.tsx`
- Test files: `{name}.test.ts` — co-located next to source
- Domain files: `{entity}.{layer}.ts` (e.g. `area.service.ts`, `area.repository.ts`)
- Schema files: `{entity}.request.schema.ts`, `{entity}.response.schema.ts`
- Mapper files: `{entity}.mapper.ts`, `{entity}-dto.mapper.ts`

## Import order (Biome enforces)

1. Node built-ins (`node:fs`, `node:path`)
2. External packages
3. Internal workspace packages (`@bokendell/`)
4. Relative imports (`./`, `../`)

## Git conventions

### Branch naming
```
{username}/{linear-id}-{brief-title}
# Examples:
bokendell/agents-5-add-discord-reporting
bokendell/golf-123-fix-scoring-calculation
```

### Commits
Conventional commit style — not strictly enforced but strongly preferred:
```
feat: add Discord thread reporting for agent runs
fix: correct Monarch API endpoint post-Jan-2026 change
chore: update pnpm lockfile
docs: add vault write policy documentation
refactor: extract scoring engine to separate domain
test: add integration tests for area repository
```

### PRs
- Standard PRs for all work
- Graphite stacked PRs used occasionally by swarm agents for dependent changes
- PR titles follow the same conventional commit style as commits

## Environment variables

### Rules
- All env vars: `UPPER_SNAKE_CASE`
- Every app has its own `.env` file (never committed)
- Every app has a `.env.example` showing all required variables with dummy values
- Every app has a Zod config schema that validates env at startup — fail fast, no silent missing vars
- Secrets come from Infisical — pull down locally, never commit

### Config schema pattern
```typescript
// apps/{app}/api/src/lib/config.ts
import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  LINEAR_API_KEY: z.string().startsWith("lin_api_"),
});

export const config = configSchema.parse(process.env);
export type Config = typeof config;
```

### Standard variable names
| Variable | Used for |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Better Auth signing secret |
| `BETTER_AUTH_URL` | App base URL for auth callbacks |
| `LINEAR_API_KEY` | Linear API access |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `CLOUDFLARE_R2_*` | R2 storage credentials |
| `INFISICAL_*` | Infisical client credentials |

## DDD naming

| Thing | Pattern | Example |
|-------|---------|---------|
| Entity type | `{Entity}` | `Area` |
| Entity factory | `create{Entity}()` | `createArea()` |
| Entity updater | `update{Entity}()` | `updateArea()` |
| Service factory | `create{Entity}Service()` | `createAreaService()` |
| Service type | `{Entity}Service` | `AreaService` |
| Repository factory | `create{Entity}Repository()` | `createAreaRepository()` |
| Repository type | `{Entity}Repository` | `AreaRepository` |
| ORM mapper | `{entity}.mapper.ts` | `area.mapper.ts` |
| DTO mapper | `{entity}-dto.mapper.ts` | `area-dto.mapper.ts` |
| Request schema | `{entity}.request.schema.ts` | `area.request.schema.ts` |
| Response schema | `{entity}.response.schema.ts` | `area.response.schema.ts` |

See `patterns/ddd.md` for full DDD architecture reference.

## API conventions (Hono)

- Framework: Hono + `@hono/zod-openapi`
- All routes OpenAPI-documented with Zod schemas
- Response format: `{ data: T }` for success
- Error format handled by global error handler (see `patterns/api.md`)
- Route files: `{domain}.routes.ts`
- Scalar UI auto-generated at `/reference`

See `patterns/api.md` for full API patterns reference.

## Database conventions

- ORM: Drizzle ORM
- DB: Neon Serverless PostgreSQL (HTTP driver — no WebSockets)
- Schema files: `packages/{app}/db/src/models/`
- Migrations: `pnpm db:push` via Drizzle Kit
- IDs: CUID2 — `createId()` from `@paralleldrive/cuid2`
- All tables have: `createdAt`, `updatedAt` (auto-managed)
- Column names: `camelCase` in TypeScript, `snake_case` in DB

## Testing conventions

- No `any` in test files either
- Test file next to source: `area.service.test.ts` lives in same folder as `area.service.ts`
- Don't test framework behavior — test your logic
- Integration tests are skipped in CI without `TEST_DB=true`

See `patterns/testing.md` for full testing reference.

## Mobile conventions (Expo)

- Forms: React Hook Form + Zod — always `.nullable()` not `.optional()`
- State: React Query for server state, Zustand for UI-only state
- Haptic feedback on all user interactions
- Form schemas local to each package, never shared

See `patterns/mobile.md` for full mobile architecture reference.
