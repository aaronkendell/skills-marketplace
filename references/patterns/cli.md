# Swarm CLI Patterns

The swarm CLI (`apps/swarm/cli`) is a **presentation + orchestration layer** over `@bokendell/swarm-domains` services. It owns interactive prompts, output formatting, and command wiring; it does not own business logic — every action goes through a domain service via the cradle.

It is built on **trpc-cli** (commands defined as a tRPC router), **clack/prompts** (interactive Q&A), **loglayer** (structured logging), and **Awilix** (DI). It is paired with the Swarm desktop app (`apps/swarm/desktop`), which consumes the same router schema live and runs commands by spawning the CLI as a subprocess.

This document describes how the CLI is structured, the per-command pattern, what lives in domains vs CLI, and how schemas + tests are organized.

**Performance budget** (these are enforced by the architecture below — keep them when adding commands):

| Path | Target | Why |
|---|---|---|
| `swarm --version` | < 200ms | Hot health-check; never load the router. |
| `swarm <…> --help` | < 200ms | Reads pre-baked manifest; never boot trpc-cli. |
| Real command (no I/O) | < 1.5s | Loads only the matched topic + accessed services. |
| Real command (with I/O) | < 200ms framework + I/O | Network/DB dominates after framework. |

---

## Mental model

| Concern | Lives in |
|---|---|
| Business logic / state mutation / IO | `packages/swarm/domains/src/packages/<domain>/` (services, repos, adapters, entities) |
| Input / output Zod schemas + DTOs | `packages/swarm/domains/src/packages/<domain>/presentation/` |
| tRPC router (which commands exist) | `apps/swarm/cli/src/packages/<domain>/<domain>.router.ts` |
| Interactive prompts (clack) | `apps/swarm/cli/src/packages/<domain>/prompts/` |
| Output formatting (intro/note/outro/spinner) | `apps/swarm/cli/src/packages/<domain>/formatters/` |
| Per-command orchestration | `apps/swarm/cli/src/packages/<domain>/handlers/` |
| Static configs / mappings | `apps/swarm/cli/src/packages/<domain>/constants.ts` |
| CLI-only types | `apps/swarm/cli/src/packages/<domain>/types.ts` |

The split mirrors `docs/context/patterns/frontend.md` — handlers play the role frontend `containers/` play (orchestrators), formatters are like `screens/` (presentation), prompts are reusable interactive components, and the router declares the surface the way a route page does.

---

## Three packages, one product

```
packages/swarm/
├── domains/        # @bokendell/swarm-domains — services, schemas, entities (DDD)
└── composition/    # @bokendell/swarm-composition — Awilix container wiring services together

apps/swarm/
├── cli/            # @bokendell/swarm-cli — trpc-cli router + handlers + prompts + formatters
└── desktop/        # @bokendell/swarm — Tauri app that spawns the CLI for command execution
```

Desktop and CLI both consume `@bokendell/swarm-domains` types and schemas. Desktop additionally reads the live command schema from `swarm internal schema --json` to render its command browser.

---

## Build pipeline & startup architecture

The CLI runs from **compiled JS in `dist/`**, not tsx-on-demand. `tsx` was 50–180s on `--version` because every invocation paid full transpile + module evaluation. Compiled mode + a few lazy boundaries gets the same command sub-second.

### Layout

```
apps/swarm/cli/
├── bin/run.js              # Node entry — stale-check, build if dirty, help-manifest fast path, then dynamic-import dist/main.js
├── tsup.config.ts          # ESM bundle, splitting on, noExternal: [@bokendell/*], onSuccess builds the help manifest
├── src/
│   ├── main.ts             # --version short-circuit + dynamic main load
│   ├── router.ts           # Topic registry — currently static, see "future work" below for per-topic split
│   ├── packages/trpc.ts    # createContext + cradleMiddleware (deferred composition import)
│   ├── lib/logger.ts       # Lazy-init shim — real LogLayer materializes on first method call
│   └── internal/
│       ├── introspect.ts   # Walks cliRouter → SwarmSchema (consumed by desktop + build-manifest)
│       └── build-manifest.ts # tsup entry: writes dist/help.json without going through trpc-cli
└── dist/                   # gitignored
    ├── main.js             # the bundle entry
    ├── help.json           # pre-baked SwarmSchema for the --help fast path
    ├── .last-build         # cached newest-src mtime so bin/run.js stale-check is O(1)
    └── *.js / *.js.map     # split chunks per dynamic-import boundary
```

### What runs when you invoke `swarm`

```
1. Node starts                          ~140ms (Node baseline)
2. bin/run.js
   ├─ stale-check vs dist/.last-build   ~10–50ms (O(1) when fresh)
   ├─ if argv == --version → echo + exit  (sub-200ms total)
   ├─ if argv ends in --help/-h         → read dist/help.json + print  (sub-200ms total)
   └─ else: dynamic-import dist/main.js
3. main.js (the CLI bundle)
   ├─ Promise.all([trpc-cli, ./router, ./packages/trpc])    ~700–1100ms
   ├─ createCli({ router, context: createContext(...) })    ~10ms
   └─ cli.run({ argv })                                     dispatches to trpc-cli
4. trpc-cli walks topic to procedure
5. cradleMiddleware fires
   └─ first await: import("@bokendell/swarm-composition")   ~1500–2000ms (ONLY when a real command runs)
6. Procedure body runs                                      handler-specific work
```

### The four lazy boundaries that keep this fast

1. **`bin/run.js` runs from `dist/`** (not `tsx`). One Node process, no transpile, no spawnSync double-process. Falls back to tsx via `SWARM_FORCE_TSX=1` for dev.
2. **`main.ts` short-circuits `--version`** before importing the router or trpc-cli at all. Pure echo + exit.
3. **`bin/run.js` short-circuits `--help` / `-h`** by reading `dist/help.json` and printing — never boots the CLI. Falls through to live trpc-cli help if the manifest is missing or the path doesn't resolve.
4. **`trpc.ts` imports `@bokendell/swarm-composition` dynamically inside `cradleMiddleware`**, not at module top level. `--help`/`--version` never load composition; real commands load it once before the procedure body runs. `getCradle(ctx)` stays synchronous — middleware has already populated `ctx.scope`.
5. **`lib/logger.ts` is a lazy shim.** Calling a method materializes the real LogLayer (pino + sentry + otel + transports) on first use. Help paths never pay the ~400ms init.

### `bin/run.js` escape hatches

| Env var | Effect |
|---|---|
| `SWARM_FORCE_TSX=1` | Skip dist entirely, run via tsx (always-fresh; useful when editing the CLI itself) |
| `SWARM_SKIP_BUILD=1` | Skip the stale check; assume `dist/` is fresh (CI hot loop) |
| `SWARM_SKIP_STALE=1` | Alias for `SWARM_SKIP_BUILD` |

### Dev loop options

```bash
# Default: edit + run. bin/run.js auto-rebuilds when src changes.
pnpm swarm <cmd>

# Editing the CLI itself? Run continuous build in a tmux pane.
pnpm --dir apps/swarm/cli dev

# One-off: bypass dist entirely (slower per run, no build needed).
SWARM_FORCE_TSX=1 pnpm swarm <cmd>

# Explicit build (tsup writes dist/main.js + dist/help.json + dist/.last-build).
pnpm --dir apps/swarm/cli build
```

### The help manifest

`dist/help.json` is a `SwarmSchema` JSON document — same shape produced by `swarm internal schema` for the desktop, but written at build time by `dist/internal/build-manifest.js` (a dedicated tsup entry that imports `introspectRouter` directly, avoiding trpc-cli's response wrapper).

`bin/run.js` consumes it in `tryServeFromHelpManifest()` for any argv ending in `--help`/`-h` (and bare `swarm`). Topics → list of commands; commands → flags + examples. Drops `--help` from ~9s to ~130ms.

If the manifest is missing or stale (e.g. you added a command and didn't rebuild), the fast path returns false and trpc-cli prints its own help — slower but correct.

---

## Per-domain layout

Every domain (in both `swarm-domains` and `swarm-cli`) follows this exact structure. Anything that doesn't fit is a sign the package is doing too much.

### Domain side (`packages/swarm/domains/src/packages/<domain>/`)

Strict DDD per `docs/context/patterns/ddd.md`, with a CLI-flavored presentation layer:

```
packages/swarm/domains/src/packages/<domain>/
├── domain/
│   └── entities/<entity>.entity.ts       # only when the domain has persistent state
├── application/
│   ├── <domain>.service.ts                # service factory + types
│   └── <domain>.service.test.ts
├── infrastructure/                        # only when domain calls SDKs / files / repos
│   ├── persistence/<entity>.repository.ts
│   └── <provider>/<provider>.{adapter,client}.ts
├── presentation/
│   ├── schemas/
│   │   ├── <domain>.input.schema.ts       # Zod input (consumed by router .input())
│   │   └── <domain>.output.schema.ts      # Zod output (DTO shape returned by service)
│   └── mappers/
│       └── <domain>-dto.mapper.ts         # only when entity ≠ DTO (e.g. strip secrets)
├── index.ts                               # full barrel — service + entity + schemas + types
└── cli.ts                                 # AUTO-MAINTAINED schema-only barrel (see below)
```

Test files live next to source: `<file>.test.ts`. Use `vitest` (already configured per package).

### CLI side (`apps/swarm/cli/src/packages/<domain>/`)

```
apps/swarm/cli/src/packages/<domain>/
├── <domain>.router.ts          # thin trpc shell: meta + .input() + delegate to handler
├── handlers/                    # one .handler.ts per command — orchestrates prompts → service → formatter
│   ├── <command>.handler.ts
│   └── <command>.handler.test.ts
├── prompts/                     # interactive prompts wrapping clack/prompts
│   ├── select-<thing>.ts
│   └── select-<thing>.test.ts
├── formatters/                  # output blocks (intro/note/outro/spinner)
│   ├── <command>-result.ts
│   └── <command>-result.test.ts
├── constants.ts                 # static configs (app→preset maps, prefix tables, etc.)
├── types.ts                     # CLI-only types
└── index.ts                     # exports the router
```

---

## The two import paths

`@bokendell/swarm-domains` exposes each domain via two subpaths:

```ts
// 1. Full domain — services, repos, schemas, entities (server-only — pulls in drizzle, pg, etc.)
import { createAuthService } from "@bokendell/swarm-domains/auth";

// 2. CLI-only schema barrel — Zod schemas + types ONLY (browser-safe, fast to import)
import { bootstrapKeyInputSchema } from "@bokendell/swarm-domains/auth/cli";
```

The `<domain>/cli` barrel is **auto-maintained** and lives next to the domain `index.ts`:

```ts
// packages/swarm/domains/src/packages/auth/cli.ts
// Auto-maintained: schema-only barrel for CLI consumption.
// Importing from `@bokendell/swarm-domains/<group>/cli` loads ONLY zod
// input/output schemas + their types — no application/* service code,
// no transitive better-auth / drizzle / etc. Routers should prefer this
// path over `@bokendell/swarm-domains/<group>` to keep startup lean.
export * from "./presentation/schemas/auth.input.schema";
export * from "./presentation/schemas/auth.output.schema";
```

**Rule:** CLI router files import schemas from the `/cli` subpath. CLI handlers (which need `getCradle()` access to the actual service) import service interfaces and result types from the full barrel. Desktop imports from the `/cli` subpath only.

---

## Layer responsibilities

### 1. Router (`<domain>.router.ts`) — thin shell

The router declares what commands exist and what their public input shape is. It never reaches into domain services or runs prompts directly.

```ts
// apps/swarm/cli/src/packages/auth/auth.router.ts
import {
  bootstrapKeyInputSchema,
  generateAuthInputSchema,
  setPasswordInputSchema,
} from "@bokendell/swarm-domains/auth/cli";
import { router, appProcedure, localProcedure } from "../trpc";
// NOTE: handlers are dynamic-imported inside .mutation() bodies — see "Lazy
// handler imports" below. Don't add static `import { fooHandler } from ...`
// at the top; that pulls handler-specific deps (Infisical SDK, Drizzle,
// etc.) into the eager router chunk and slows down every command's startup.

export const authRouter = router({
  "bootstrap-key": appProcedure
    .meta({
      description: "Bootstrap an admin API key directly in the DB",
      examples: ["$ swarm auth bootstrap-key --app golf"],
      display: { icon: "Key", color: "var(--amber)" },
    })
    .input(bootstrapKeyInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { bootstrapKeyHandler } = await import("./handlers/bootstrap-key.handler");
      return bootstrapKeyHandler(input, ctx);
    }),

  "set-password": appProcedure
    .meta({ description: "Set or reset a user's password", display: { icon: "Lock", color: "var(--blue)" } })
    .input(setPasswordInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { setPasswordHandler } = await import("./handlers/set-password.handler");
      return setPasswordHandler(input, ctx);
    }),

  generate: localProcedure
    .meta({ description: "Regenerate Better Auth schema models", display: { icon: "RefreshCw" } })
    .input(generateAuthInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { generateAuthHandler } = await import("./handlers/generate.handler");
      return generateAuthHandler(input, ctx);
    }),
});
```

### Lazy handler imports (mandatory)

`tsup` is configured with `splitting: true`, so each `await import("./handlers/foo.handler")` becomes its own chunk. A `swarm auth bootstrap-key` invocation loads only the bootstrap-key chunk + its deps — not set-password, not generate. tsup's chunk graph confirms it.

Adding a new procedure: copy the pattern verbatim. The 4-line `async ({ input, ctx }) => { const { fn } = await import(...); return fn(input, ctx); }` block is what makes the chunk lazy. Static imports at the top of the router file leak into every command's startup graph.

**Procedure types:**
- `localProcedure` — no Infisical secrets needed (file ops, subprocess wrappers, dev servers).
- `appProcedure` — requires an active Infisical session (or CI machine identity). Wraps `localProcedure` with the `infisicalAuthMiddleware` — fails fast with a `UNAUTHORIZED` tRPC error before any prompts run.

Both extend `baseProcedure`, which has the **`cradleMiddleware`** chained in. Before the procedure body runs, the middleware does:

```ts
const cradleMiddleware = middleware(async ({ ctx, next }) => {
  if (!ctx.scope) ctx.scope = await getCliContainer();   // dynamic import of swarm-composition
  return next();
});
```

This is what lets `getCradle(ctx)` stay synchronous in handler code — by the time the handler body fires, `ctx.scope` is filled. `--help`/`--version` paths never reach a procedure body and never load composition.

**`.meta()` is the desktop schema source.** `description`, `examples`, and `display` flow into the introspected schema that desktop consumes — keep them concise and accurate. Custom desktop UIs can declare themselves via `display.kind: "custom"` + `display.component: "FormName"`; see `apps/swarm/desktop/src/packages/swarm-schema/registry/command-components.ts`.

### 2. Handler (`handlers/<command>.handler.ts`) — orchestration

The handler is what fires when the command runs. It:

1. Validates / fills missing input via prompts.
2. Loads any secrets needed for the operation (`loadSecretsWithSpinner`).
3. Calls a domain service via `getCradle(ctx).<service>`.
4. Hands the result to a formatter.
5. Handles cancellation cleanly.

```ts
// apps/swarm/cli/src/packages/auth/handlers/bootstrap-key.handler.ts
import * as p from "@clack/prompts";
import type { BootstrapKeyInput } from "@bokendell/swarm-domains/auth/cli";
import type { CliContext } from "../../trpc";
import { getCradle } from "../../trpc";
import { intro, spinner } from "../../../lib/console/style";
import { loadSecretsWithSpinner } from "../../../lib/infisical";
import { promptEmail } from "../../../lib/prompts/basic";
import { resolveEnvironment } from "../../../lib/prompts/resolve-environment";
import { BOOTSTRAP_APP_CONFIG } from "../constants";
import { printBootstrapPlan, printBootstrapResult } from "../formatters/bootstrap-result";
import { selectAppPrompt } from "../prompts/select-app";
import { selectPresetPrompt } from "../prompts/select-preset";
import type { AppKey } from "../types";

export async function bootstrapKeyHandler(
  input: BootstrapKeyInput,
  ctx: CliContext,
): Promise<void> {
  intro("Bootstrap API Key");

  const appKey: AppKey = (input.app as AppKey) ?? (await selectAppPrompt(BOOTSTRAP_APP_CONFIG));
  const appCfg = BOOTSTRAP_APP_CONFIG[appKey];
  const environment = await resolveEnvironment(input.env);
  await loadSecretsWithSpinner(environment, appCfg.secretPaths);

  const presetKey = await selectPresetPrompt(appCfg, input.preset);
  const preset = appCfg.presets[presetKey]!;
  const email = input.email ?? (await promptEmail("Owner email for this key:"));

  printBootstrapPlan({ appCfg, environment, preset, email });
  const confirmed = await p.confirm({ message: "Mint the key?", initialValue: true });
  if (p.isCancel(confirmed) || !confirmed) { p.cancel("Cancelled"); process.exit(0); }

  const s = spinner();
  s.start("Bootstrapping API key...");
  const result = await getCradle(ctx).authService.bootstrapKey({
    app: appKey,
    environment,
    email,
    prefix: appCfg.apiKeyPrefix,
    scopes: preset.scopes,
    presetKey,
    databaseUrl: process.env.DATABASE_URL!,
  });
  s.stop("Key created");

  printBootstrapResult({ appCfg, preset, email, result });
}
```

**Rules:**
- Handlers consume `CliContext` (from `../trpc`) and the typed input — never raw argv.
- All side effects go through `getCradle(ctx).<service>`. Never instantiate services directly.
- All output goes through formatters or `ctx.log/warn/error`. **Never `console.*`.** (The `no-console-in-domain-rule` arch check enforces this.)
- Cancellation: clack's `isCancel` + `process.exit(0)`.

### 3. Prompts (`prompts/select-<thing>.ts`) — interactive Q&A

Single-purpose functions that wrap clack and handle cancellation. They take whatever arguments the prompt needs (config map, current value, etc.) and return the selected value.

```ts
// apps/swarm/cli/src/packages/auth/prompts/select-app.ts
import * as p from "@clack/prompts";
import type { AppKey } from "../types";

export async function selectAppPrompt(
  config: Record<string, { label: string }>,
): Promise<AppKey> {
  const selected = await p.select({
    message: "Which app?",
    options: (Object.entries(config) as [AppKey, { label: string }][]).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
  });
  if (p.isCancel(selected)) { p.cancel("Cancelled"); process.exit(0); }
  return selected as AppKey;
}
```

**Cross-domain prompts** (used by 3+ commands) live in `apps/swarm/cli/src/lib/prompts/`. Examples: `resolve-environment.ts`, `basic.ts` (`promptEmail`, `promptPassword`, `promptText`, `promptConfirm`).

### 4. Formatters (`formatters/<command>-result.ts`) — output blocks

Pure functions that take handler-shape inputs and call the console helpers (`intro`, `note`, `outro`, `spinner`). Easy to unit test by mocking `../../../lib/console/style`.

```ts
// apps/swarm/cli/src/packages/auth/formatters/bootstrap-result.ts
import type { BootstrapKeyOutput } from "@bokendell/swarm-domains/auth/cli";
import { note, outro } from "../../../lib/console/style";

export function printBootstrapPlan(args: { appCfg; environment; preset; email }): void {
  note(
    [`App: ${args.appCfg.label}`, `Env: ${args.environment}`, `Preset: ${args.preset.label}`, `Email: ${args.email}`].join("\n"),
    "Plan",
  );
}

export function printBootstrapResult(args: { /* ... */ result: BootstrapKeyOutput }): void {
  note([`User: ${args.email}`, `Key: ${args.result.raw}`].join("\n"), "Bootstrapped");
  outro("Done!");
}
```

### 5. Constants (`constants.ts`) — static maps

Per-app preset definitions, env-var hints, Infisical paths — anything declarative. Keeps handlers focused on flow and easy to scan.

### 6. Types (`types.ts`) — CLI-only types

Domain types come from `@bokendell/swarm-domains/<domain>`. This file holds shapes that are specific to the CLI (e.g. `AppKey`, `BootstrapAppConfig` interfaces — config-map shapes used inside `constants.ts`).

---

## Single-source rule for cross-domain enums

`project`, `environment`, `bucketAccess`, and other enums shared across many commands live **once** in `packages/swarm/domains/src/lib/schemas/common.ts`, derived from `@bokendell/core` constants:

```ts
import { APP_NAMES, ENVIRONMENTS, BUCKET_ACCESS_TYPES } from "@bokendell/core";

const PROJECT_VALUES = Object.values(APP_NAMES) as [...];
export const projectSchema = z.enum(PROJECT_VALUES).describe(...);
export const environmentSchema = z.enum(/* ... */).describe(...);
export const bucketAccessSchema = z.enum(/* ... */).describe(...);
```

Per-domain input schemas import from there:

```ts
// packages/swarm/domains/src/packages/r2/presentation/schemas/r2.input.schema.ts
import { projectSchema, environmentSchema, bucketAccessSchema } from "../../../../lib/schemas/common";

export const r2SyncInputSchema = z.object({
  source: z.string().optional(),
  app: projectSchema.optional(),
  env: environmentSchema.optional(),
  access: bucketAccessSchema.optional(),
});
```

**Never** redeclare `z.enum(["golf", "hive", "portfolio"])` inside a domain. If a new product project gets added to `APP_NAMES`, every command picks it up automatically.

---

## Logger — loglayer everywhere, never `console.*`

The CLI uses `@bokendell/observability` LogLayer. Domain code reaches the logger via the slot pattern (`getLogger()`); the CLI wires the real instance at boot.

```ts
// packages/swarm/domains/src/lib/logger.ts — domain slot
import { createLoggerSlot } from "@bokendell/observability/logger-slot";
import type { ILogLayer } from "loglayer";

const slot = createLoggerSlot("swarm-domains");
export type SystemLogger = ILogLayer;
export const setSystemLogger = slot.setLogger;
export const getLogger = slot.getLogger;
```

```ts
// apps/swarm/cli/src/lib/logger.ts — CLI side (lazy-init shim)
//
// `createAppLogger` pulls pino + sentry + opentelemetry + multiple loglayer
// transports — ~300-400ms of work we don't want on the hot path. The
// exported `logger` is a stable shim object whose methods materialize the
// real LogLayer on first call. attachLoggerBridge (events runtime) still
// works because each shim method is a real own-property function.
import type { ILogLayer } from "loglayer";

let _real: ILogLayer | undefined;
function realLogger(): ILogLayer {
  if (_real) return _real;
  // require() (provided by tsup banner) keeps this synchronous so callers
  // don't need to await. The lazy boundary is the *call*, not module load.
  const obs = require("@bokendell/observability/log");
  const slot = require("@bokendell/swarm-domains/logger");
  _real = obs.createAppLogger({ serviceName: "swarm-cli", /* ... */ });
  slot.setSystemLogger(_real);
  return _real;
}

// One own-property function per ILogLayer method — bridge wrappers replace
// these in place; first call to any of them triggers materialization.
export const logger: ILogLayer = buildShim();
```

**Rules:**
- **No `console.*` anywhere in CLI or domain code.** The `no-console-in-domain-rule` arch check fails CI on it.
- In handlers/prompts/formatters: use `ctx.log/warn/error` (routes through the logger) or `import { logger } from "../../../lib/logger"`.
- In domain services/infra: `import { getLogger } from "../../../lib/logger"; getLogger().withMetadata({...}).info(...)`. Always call `getLogger()` inline at log sites — never cache in module scope.
- For piped output (`--json` flags, schema dumps): use `process.stdout.write(JSON.stringify(...) + "\n")` so the JSON lands on stdout and logger output (stderr) doesn't pollute it.

---

## Schema introspection — desktop reads the router

`swarm internal schema --json` walks `cliRouter._def.procedures` at runtime and emits a `SwarmSchema` JSON document (topics, commands, descriptions, examples, display, flag definitions converted from Zod). Desktop spawns this once at boot via Tauri shell, caches in zustand, and uses it to drive the command browser, palette, and auto-form.

The schema types are defined in `apps/swarm/cli/src/schema-types.ts` (browser-safe; only types) and exposed via the `@bokendell/swarm-cli/schema-types` subpath. The introspection itself lives in `apps/swarm/cli/src/internal/introspect.ts` and `apps/swarm/cli/src/internal/zod-to-flag-def.ts`.

This means:
- The router IS the schema. No hand-maintained command list, no drift.
- Adding a procedure makes it appear in desktop automatically (auto-form fallback).
- For polished UIs, declare `display: { kind: "custom", component: "X" }` and register `X` in desktop's `COMMAND_COMPONENTS` registry.

---

## Tests

Every layer has tests. All next to source as `<file>.test.ts`, using `vitest`.

| Layer | Strategy |
|---|---|
| **Domain service** (`<domain>.service.test.ts`) | Pure helpers: assert returns. External-system methods: integration tests with testcontainers (`*.integration.test.ts`). |
| **Domain mapper** (`<domain>-dto.mapper.test.ts`) | Round-trip entity → DTO; assert internal fields (secrets, devPid) are stripped. |
| **CLI handler** (`<command>.handler.test.ts`) | Stub `getCradle` to return mocked services; assert handler called the right service method + the right formatter. |
| **CLI prompt** (`<prompt>.test.ts`) | Mock `@clack/prompts`; one happy-path test, one cancellation test (assert `process.exit(0)`). |
| **CLI formatter** (`<formatter>.test.ts`) | Mock `lib/console/style`; assert `note`/`outro`/`intro` were called with the right strings. |
| **Schema parity** (`env.spec.ts`) | `diffSchemaAgainstRegistry` from `@bokendell/core/env/parity` to fail CI if `env-schemas.ts` and `env-infisical.ts` drift apart. |

Test conventions:
- `afterEach(() => vi.restoreAllMocks())` so spies don't leak.
- Don't run real subprocesses, network calls, or Infisical — mock at the boundary.
- Don't ship `it.skip`/`it.todo` unless commented why.

---

## Pre-built shared utilities

Anything in `apps/swarm/cli/src/lib/` is fair game for any handler:

| Module | Use for |
|---|---|
| `lib/console/style` | `intro`, `note`, `outro`, `spinner` (clack wrappers) |
| `lib/prompts/basic` | `promptEmail`, `promptPassword`, `promptText`, `promptConfirm`, `promptSelect` |
| `lib/prompts/resolve-environment` | Resolve `--env` arg with confirmation for non-dev |
| `lib/infisical` | `loadSecretsWithSpinner`, `selectEnvironment`, `fetchSecrets` |
| `lib/hive/credentials` | `ensureHiveCredentials()` — auto-load HIVE_API_* + NEON_API_KEY from Infisical |
| `lib/hive/device` | `ensureDeviceRegistered()` |
| `lib/workspace/api-client` | Hive tRPC client wrapper for workspace persistence |
| `lib/monorepo` | `findMonorepoRoot()` |
| `lib/config/env` | Validated `env` object (zod-typed env vars from `apps/swarm/cli/src/lib/config/`) |
| `lib/logger` | `logger` (LogLayer instance) |

When a handler grows a helper that another handler will need, it goes in `lib/` — not duplicated across packages.

---

## What goes where — quick reference

| Question | Answer |
|---|---|
| New CLI command? | Add a procedure to the router, write a `<command>.handler.ts`. Add input schema to `swarm-domains/<domain>/presentation/schemas/`. |
| New stateful concept (workspace, tunnel, run)? | New domain in `swarm-domains` with entity + service + repo + presentation. |
| New interactive prompt for one command? | `apps/swarm/cli/src/packages/<domain>/prompts/<name>.ts`. |
| New interactive prompt for many commands? | `apps/swarm/cli/src/lib/prompts/<name>.ts`. |
| New shared enum? | `packages/swarm/domains/src/lib/schemas/common.ts`, derived from `@bokendell/core` constants. |
| Output formatting? | `apps/swarm/cli/src/packages/<domain>/formatters/<command>-result.ts`. |
| Static config map? | `apps/swarm/cli/src/packages/<domain>/constants.ts`. |
| Need to call an SDK / hit a DB? | Domain service. Never in a CLI handler directly. |
| Need to log diagnostically? | `ctx.log/warn/error` in handlers, `getLogger()` in domain code. **Never `console.*`.** |
| Need to emit JSON for piping? | `process.stdout.write(JSON.stringify(x) + "\n")`. |

---

## Future work — getting real commands sub-1s

Help paths are sub-200ms; real commands are ~3.4s after the optimizations above. Two refactors are queued to close that gap.

### A. Per-service lazy modules in `swarm-domains` + `swarm-composition`

**The bottleneck:** `await import("@bokendell/swarm-composition")` loads all 15 CLI service factories statically. Their transitive deps (better-auth, drizzle, AWS SDK, Octokit, Vercel SDK, Infisical SDK, ts-morph) get bundled into one ~2MB chunk. A `swarm workspace list` pays this even though it only needs `workspaceService`.

**The shape:**

```ts
// packages/swarm/domains/src/index.ts — AFTER
export function createCliDomainFactories(config: CliDomainsConfig) {
  setSystemLogger(config.logger);
  return {
    workspaceService: async () => {
      const { createWorkspaceService } = await import("./packages/workspace/application/workspace.service");
      return createWorkspaceService({ /* deps */ });
    },
    authService: async () => {
      // better-auth ONLY loads when an auth command runs.
      const { createAuthService } = await import("./packages/auth/application/auth.service");
      return createAuthService();
    },
    // ... 13 more
  };
}
```

```ts
// packages/swarm/composition/src/container.ts — AFTER
container.register({
  workspaceService: asFunction(() => factories.workspaceService()).singleton(),
  authService: asFunction(() => factories.authService()).singleton(),
  // ...
});
```

```ts
// trpc.ts — getCradle becomes async
export async function getCradle(ctx: CliContext): Promise<CliCradle> {
  if (!ctx.scope) ctx.scope = await getCliContainer();
  return ctx.scope.cradle;
}
```

```ts
// Handler — one extra await
const { workspaceService } = await getCradle(ctx);
const ws = await workspaceService.getByName(name);
```

**Effect:** composition load drops from ~2.1s to ~300–500ms. Each service module becomes its own chunk; only services touched by the current command load.

### B. Per-topic lazy router chunks

**The bottleneck:** `await import("./router")` statically loads all 22 topic routers + their schemas + their helpers. A `swarm db migrate run` walks every other topic's procedure tree just to set up trpc-cli's parser.

**The shape:**

```ts
// src/router.ts — AFTER
export const TOPIC_LOADERS = {
  workspace: () => import("./packages/workspace/workspace.router").then(m => m.workspaceRouter),
  db:        () => import("./packages/db/db.router").then(m => m.dbRouter),
  auth:      () => import("./packages/auth/auth.router").then(m => m.authRouter),
  // ... 22 entries
} as const;

export async function buildSingleTopicRouter(topic: keyof typeof TOPIC_LOADERS) {
  const subRouter = await TOPIC_LOADERS[topic]();
  return router({ [topic]: subRouter });
}
```

```ts
// src/main.ts — AFTER
const firstPositional = argv.find((a) => !a.startsWith("-"));
const r = await import("./router");
const cliRouter = firstPositional && firstPositional in r.TOPIC_LOADERS
  ? await r.buildSingleTopicRouter(firstPositional as never)
  : await r.buildFullRouter();   // fallback for unknown topics
```

**Effect:** router-chunk load drops from ~1.6s to ~200ms. `--help` paths already bypass this via the manifest, so no regression.

After A + B, real commands should be in the **400–700ms** range. Help paths stay sub-200ms.

### Should `golf-domains` / `hive-domains` / `portfolio-domains` do this too?

**Yes, the same pattern applies — bigger ROI than swarm-cli got.** Concrete numbers from the audit (2026-05-07):

| Composition | Module load | Service count |
|---|---|---|
| `@bokendell/golf-composition/container` | ~16s (tsx, cold) | 93 |
| `@bokendell/hive-composition/container` | ~14s (tsx, cold) | 120 |
| `@bokendell/portfolio-composition/container` | ~13s (tsx, cold) | 70 |
| `@bokendell/golf-composition/app` (full app) | ~20s | n/a |

Where it matters:
- **Integration tests.** A trivial unit test boots in 6s; a router test that touches composition takes 17s. With 416 test files across the three apps, per-test composition load is the dominant cost.
- **`turbo dev` startup.** Wait 16–20s before /api responds.
- **CLI cradle commands.** `swarm admin create --app=golf` loads all 93 golf services even though it only needs `usersService`.
- **Serverless cold starts** (if any deploy target uses them).

What it doesn't matter for: always-on Fly machines serving live traffic — startup is paid once, requests run against pre-constructed services.

The `golf-domains` / `hive-domains` / `portfolio-domains` packages already expose granular sub-paths (47 in golf-domains alone — `<group>/client`, `<group>/server`, `<group>/internal`). **No mandatory new exports** — the composition packages can dynamic-import from existing barrels. Optional: split heavy barrels further if profiling shows a specific service pulling huge transitive graphs.

The router-equivalent for the APIs is **per-tRPC-router lazy load**, not per-Hono-route. See `docs/context/patterns/api.md` for the API-side details.

---

## Critical rules

1. **No `console.*`** anywhere in `apps/swarm/cli/src/` or `packages/swarm/`. Use the logger.
2. **Routers are thin.** No prompts, no service calls, no formatting — only `.meta()`, `.input()`, and `=> handlerFn(input, ctx)`.
3. **Handlers are dynamic-imported.** `.mutation(async ({ input, ctx }) => { const { fn } = await import("./handlers/foo.handler"); return fn(input, ctx); })`. Never `import { fooHandler }` at the top of a router file — it leaks handler-specific deps into every command's startup graph.
4. **All actions go through the cradle.** `getCradle(ctx).<service>.<method>(...)`. Never `new XxxService(...)` in a handler.
5. **Schemas live once.** Cross-domain enums in `lib/schemas/common.ts`; per-command schemas in `presentation/schemas/`. CLI router files import from `@bokendell/swarm-domains/<domain>/cli` (schema-only barrel) — never from the bare `<domain>` barrel (drags service code).
6. **`@bokendell/swarm-composition` is dynamic-imported in `trpc.ts`.** It's the heaviest module in the graph (~2MB chunk). The `cradleMiddleware` in `trpc.ts` is the *only* place that imports it. Don't add static imports of `swarm-composition` anywhere else.
7. **Logger is lazy.** `lib/logger.ts` is a shim that materializes the real LogLayer on first call. Don't `import { createAppLogger }` directly — it pulls pino + sentry + otel transports eagerly.
8. **No hand-maintained command schema for desktop.** The introspection at `swarm internal schema` is the source — extend `display` meta to add UI hints. Same data is pre-baked at build time into `dist/help.json` for the `--help` fast path.
9. **Tests next to source.** `<file>.test.ts`. Mock at boundaries (clack, getCradle, console-style).
