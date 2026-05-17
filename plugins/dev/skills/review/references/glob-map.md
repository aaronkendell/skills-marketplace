# File glob → pattern doc map

Mapping rules. Match in order from top to bottom; a single file can match multiple rules, and you should load every matched pattern. Globs use standard shell semantics (`**` = any depth, `*` = single segment).

| Glob | Pattern doc(s) to load | Why |
|---|---|---|
| `**/packages/*/domains/src/**/*.ts` | `ddd.md`, `auth-and-scopes.md` (when `scopes`/`requireScope` appears) | Service/repository structure, mapper layer, error model, scope enforcement |
| `**/packages/*/composition/**/*.ts` | `di.md` | Awilix cradle, registration order, transactions |
| `**/packages/*/api/**/*.ts` | `api.md`, `hono-api-anatomy.md` | Shared API package (`@bokendell/api`) — boot perf + router build |
| `**/packages/*/db/**/*.ts` | `ddd.md` | ORM schema + repository layer |
| `**/apps/*/api/**/*.ts` | `api.md`, `hono-api-anatomy.md`, `auth-and-scopes.md` | App-level Hono+tRPC routers, middleware, auth |
| `**/apps/*/api/**/*.openapi.json` | `api.md` | OpenAPI snapshot freshness |
| `**/apps/*/api/scripts/**/*.ts` | `api.md` (sections on `runGenerateOpenApi` / `runGeneratePostman`) | Generator scripts shape |
| `**/apps/*/app/**/*.{ts,tsx}` | `frontend.md`, `per-app-ui.md` | Next.js patterns, container/component split, token use |
| `**/apps/*/admin/**/*.{ts,tsx}` | `frontend.md`, `per-app-ui.md` | Refine admin patterns |
| `**/apps/*/mobile/**/*.{ts,tsx}` | `mobile.md`, `per-app-ui.md` | Expo + RN, hooks/stores/containers |
| `**/apps/*/design/**/*.{ts,tsx}` | `design-studio.md`, `design-workflow.md`, `per-app-ui.md` | Vite design studio framework |
| `**/apps/*/design/flows/**/.annotations/**` | `design-workflow.md` | Annotation pull/sync flow |
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
