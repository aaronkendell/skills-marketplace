# File glob → pattern doc map

Mapping rules. Match in order from top to bottom; a single file can match multiple rules, and you should load every matched pattern. Globs use standard shell semantics (`**` = any depth, `*` = single segment).

| Glob | Pattern doc(s) to load | Why |
|---|---|---|
| `**/packages/*/domains/src/**/*.ts` | `ddd.md`, `auth-and-scopes.md` (when `Principal`/`caller`/`Policy`/`assertSelf`/`scopes`/`requireScope`/`systemPrincipal`/`Entitlement` appears) | Service/repository structure, mapper layer, error model, authz policies + scope enforcement |
| `**/packages/*/domains/src/packages/authz/**/*.ts` | `auth-and-scopes.md`, `ddd.md` | Policy base, AccessPolicy/OwnershipPolicy, audit sink |
| `**/packages/*/domains/src/**/infrastructure/inngest/**/*.ts` | `inngest.md`, `ddd.md` | Inngest functions: thin orchestration, service-method-only (no repos/business logic), flat DTOs + narrow deps at the step serialization boundary, v4 triggers/flow-control |
| `**/packages/*/composition/src/functions.ts` | `inngest.md`, `di.md` | Inngest function wiring from the cradle |
| `**/packages/*/composition/**/*.ts` | `di.md` | Awilix cradle, registration order, transactions |
| `**/packages/*/api/**/*.ts` | `api.md`, `hono-api-anatomy.md` | Shared API package (`@bokendell/api`) — boot perf + router build |
| `**/packages/*/db/**/*.ts` | `ddd.md` | ORM schema + repository layer |
| `**/apps/*/api/**/*.ts` | `api.md`, `hono-api-anatomy.md`, `auth-and-scopes.md` | App-level Hono+oRPC routers, middleware, auth |
| `**/apps/*/api/**/*.openapi.json` | `api.md` | OpenAPI snapshot freshness |
| `**/apps/*/api/scripts/**/*.ts` | `api.md` (sections on `runGenerateOpenApi` / `runGeneratePostman`) | Generator scripts shape |
| `**/apps/*/app/**/*.{ts,tsx}` | `frontend.md`, `per-app-ui.md` | Next.js patterns, container/component split, token use |
| `**/apps/*/admin/**/*.{ts,tsx}` | `frontend.md`, `per-app-ui.md` | Refine admin patterns |
| `**/apps/*/mobile/**/*.{ts,tsx}` | `mobile.md`, `per-app-ui.md` | Expo + RN, hooks/stores/containers |
| `**/apps/*/design/**/*.{ts,tsx}` | `design.md`, `design-studio.md`, `design-workflow.md`, `frontend.md`, `per-app-ui.md` | Next.js design app architecture (lib/, packages/, surface groups, sketches, providers) + annotation system + workflow + container/screen rules |
| `**/apps/*/design/src/app/**/*.{ts,tsx}` | `design.md`, `frontend.md` | Route files (must be thin, server-component data fetching) |
| `**/apps/*/design/src/packages/site/**/*.{ts,tsx}` | `design.md`, `frontend.md` | Site shell, discovery, layouts |
| `**/apps/*/design/src/packages/{mobile,admin,marketing}/**/*.{ts,tsx}` | `design.md`, `frontend.md` | Domain packages (containers, screens, flows) |
| `**/apps/*/design/src/lib/**/*.{ts,tsx}` | `design.md` | App-only shared lib (providers, env, studio.css) |
| `**/apps/*/design/src/app/sketches/**/route.ts` | `design.md` | Sketches route handler |
| `**/apps/*/design/**/flows/**/.annotations/**` | `design-workflow.md` | Annotation pull/sync flow |
| `**/apps/*/design/**/flows/**/decisions.md` | `design-workflow.md` | Per-flow decision logs |
| `**/apps/*/design/**/flows/**/sketches/**` | `design.md`, `design-workflow.md` | Raw HTML sketch collocation |
| `**/apps/*/inngest/**/*.ts` | `di.md` (services from cradle), `ai-evals.md` (if AI), `ai.md` (if Mastra) | Inngest function patterns + service wiring |
| `**/inngest/**/*.ts` | `di.md` | Same as above, generic |
| `**/apps/*/workers/**/*.ts` | `di.md` | Worker process Awilix patterns |
| `**/apps/cli/**/*.ts` | `cli.md` | trpc-cli patterns, topic groups, handlers |
| `**/scripts/**/*.{ts,mjs,js}` | (no pattern) — generic code review | One-off scripts |
| `**/*.test.ts` | `testing.md` | Unit tests — factories, mocks, no real DB |
| `**/*.test.tsx` | `testing.md`, `frontend.md` (component test patterns) | UI component tests |
| `**/*.integration.test.ts` | `testing.md` | Testcontainers, real DB, factories |
| `**/*ai*/**/*.ts` | `ai.md`, `ai-evals.md` | Mastra/AI infra |
| `**/mastra/**/*.ts` | `ai.md`, `ai-evals.md` | Mastra-specific |
| `**/index.ts` | `barrels.md` | Barrel export discipline (when file only re-exports) |
| `**/.cicd.yml` | `container-images.md`, `ci-costs.md` | Per-deploy config + runtime budget |
| `**/Dockerfile` | `container-images.md` | Image build patterns |
| `**/fly.{toml,*.toml}` | `container-images.md` | Fly deploy config |
| `**/.github/workflows/*.{yml,yaml}` | `ci-costs.md` | CI workflow budget |
| `**/.tunnel/**` or files mentioning `*.dev.bokendell.com` | `remote-tunnels.md` | Workspace dev tunnel system |

## Resolution algorithm

For each file path:

1. Normalize: remove leading `./`, resolve symlinks.
2. Iterate rules top-to-bottom. Collect every pattern doc from every matching rule.
3. De-duplicate. The result is the set of patterns to load for this file.
4. If the set is empty, decide:
   - Config / lockfile / README / asset → skip silently.
   - Source code with no match → flag as "no pattern coverage" in the report so the user can decide whether to add a glob rule.

## Adding rules

Edit this file in place. The skill reads it fresh on every invocation. Glob rules should be the most specific that still applies — `apps/*/api/**` is better than `**/api/**` because the former excludes coincidentally-named directories.
