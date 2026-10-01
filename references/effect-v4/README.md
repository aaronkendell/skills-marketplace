# Effect v4 reference (pinned)

A local, version-pinned copy of the Effect v4 documentation, so agents read the docs that match
the code instead of guessing from training data or fetching the live site.

| | |
|---|---|
| Source | https://effect.website/docs/v4/ (each page's source markdown, served at `<page>.md`) |
| Fetched | 2026-10-01 |
| Effect version | 4.0.0 (website guides track the latest v4; `ai-docs/` is from the `effect@4.0.0` tarball) |
| Pages | 110 (`pages.txt`) |

## Layout

- `docs/<section>/<page>.md` — the website guides. Each starts with a `source:` comment carrying its URL and fetch date.
- `ai-docs/` — the AI docs bundled in the `effect` npm package (`ai-docs/src/**`, 76 files by topic: runnable `.ts` examples + `index.md` per topic), plus the package's `AGENTS.md` and `CLAUDE.md`. **This is the authoritative, version-matched source**; prefer it over the website guides when they disagree.
- `pages.txt` — the page list `refresh.sh` fetches. Add a line to track a new page.
- `refresh.sh` — re-fetches every page (or the ones named: `./refresh.sh caching/cache`). It uses the site's `<page>.md` endpoint and falls back to `convert.py` (HTML article -> markdown, needs `uv`) when a page has no markdown source (`api`, `guides`).

Any repo with `effect` installed carries the same AI docs for **its** installed version at
`node_modules/effect/ai-docs/src/**` (plus `node_modules/effect/AGENTS.md`). Golf, for example,
pins `effect@4.0.0-rc.118`, so its `node_modules` copy is the rc's docs; read that one when
working on golf code before the bump to 4.0.0.

## Refreshing

```bash
./refresh.sh                       # all pages in pages.txt
./refresh.sh scheduling/cron       # one page
```

For the AI docs: `npm pack effect@<version>`, untar, and replace `ai-docs/` with the package's
`ai-docs/src`, `ai-docs/README.md`, `AGENTS.md`, `CLAUDE.md`. Update the version row above.
To find pages the site added, crawl the sidebar links of any page under `/docs/v4/` and diff
against `pages.txt`.

## Ecosystem packages (from https://effect.website/docs/v4/api)

Status in golf as of 2026-10-01 (`golf/.worktrees/effect`, `effect@4.0.0-rc.118`):

| Package | What | Golf uses it? | Should it? |
|---|---|---|---|
| `@effect/vitest` | `it.effect`, `layer()`, TestClock wiring for vitest | Yes (pinned rc.118, used across Effect tests) | Yes — keep; the standard for Effect tests |
| `@effect/platform-node` (`-shared`) | Node runtime, FileSystem/Path/Terminal, `NodeRuntime.runMain` | `platform-node-shared` only, in `packages/composition/src/effect` | Yes where Effect code touches fs/process; see the conformance audit |
| `@effect/opentelemetry` | Effect tracer/metrics/logger -> OTel SDK | No — golf wires OTel itself (`@opentelemetry/*`, `@bokendell/observability`) | Bridge, see audit (Effect spans must reach the same exporter) |
| `@effect/sql-pg` | Effect-native Postgres client + `SqlResolver` batching | No — Drizzle on Neon | No for now: workspace rule is Neon + Drizzle; revisit only if Drizzle-in-Effect wrapping becomes the bottleneck |
| `@effect/ai-anthropic` / `ai-openai` / `ai-openrouter` | Effect AI SDK providers | No — Mastra + Vercel AI SDK | No: workspace rule is Mastra + AI SDK |
| `@effect/atom-react` | Effect-backed reactive state for React | No — TanStack Query + React state | No: client state is out of Effect scope in golf |
| `@effect/openapi-generator` | OpenAPI -> Effect Schema types, HttpApi clients | No | Only if golf wraps a third-party OpenAPI-described API in Effect; golf's own OpenAPI comes from oRPC |
| Effect LSP (`@effect/language-service`, tsgo build `@effect/tsgo`) | Editor + CLI diagnostics for Effect anti-patterns | Yes — `@effect/tsgo` 0.46.1, `tsconfig.effect.json`, `check:effect` + lefthook `effect-diagnostics` | Yes — keep; the cheapest drift guard |

Also on the API page: platform-browser/bun/deno, the other `sql-*` drivers, `ai-openai-compat`,
`ai-typesafe`, `atom-solid`/`atom-vue`, `docgen`, `doctest` — none relevant to golf today.

## Page index

**(top level)**

- [Getting Started](docs/getting-started.md) — `getting-started`
- [Configuration](docs/configuration.md) — `configuration`
- [Introduction to Runtime](docs/runtime.md) — `runtime`
- [Batching](docs/batching.md) — `batching`
- [Welcome to Effect](docs/onboarding.md) — `onboarding`
- [Getting Started](docs/guides.md) — `guides`
- [API Reference](docs/api.md) — `api`

**error-management**

- [Expected Errors](docs/error-management/expected-errors.md) — `error-management/expected-errors`
- [Unexpected Errors](docs/error-management/unexpected-errors.md) — `error-management/unexpected-errors`
- [Fallback](docs/error-management/fallback.md) — `error-management/fallback`
- [Matching](docs/error-management/matching.md) — `error-management/matching`
- [Retrying](docs/error-management/retrying.md) — `error-management/retrying`
- [Timing Out](docs/error-management/timing-out.md) — `error-management/timing-out`
- [Sandboxing](docs/error-management/sandboxing.md) — `error-management/sandboxing`
- [Error Accumulation](docs/error-management/error-accumulation.md) — `error-management/error-accumulation`
- [Error Channel Operations](docs/error-management/error-channel-operations.md) — `error-management/error-channel-operations`
- [Parallel and Sequential Errors](docs/error-management/parallel-and-sequential-errors.md) — `error-management/parallel-and-sequential-errors`
- [Yieldable Errors](docs/error-management/yieldable-errors.md) — `error-management/yieldable-errors`
- [Two Types of Errors](docs/error-management/two-error-types.md) — `error-management/two-error-types`

**requirements-management**

- [Managing Services](docs/requirements-management/services.md) — `requirements-management/services`
- [Default Services](docs/requirements-management/default-services.md) — `requirements-management/default-services`
- [Managing Layers](docs/requirements-management/layers.md) — `requirements-management/layers`
- [Layer Memoization](docs/requirements-management/layer-memoization.md) — `requirements-management/layer-memoization`

**resource-management**

- [Introduction](docs/resource-management/introduction.md) — `resource-management/introduction`
- [Scope](docs/resource-management/scope.md) — `resource-management/scope`

**observability**

- [Logging](docs/observability/logging.md) — `observability/logging`
- [Metrics in Effect](docs/observability/metrics.md) — `observability/metrics`
- [Tracing in Effect](docs/observability/tracing.md) — `observability/tracing`
- [Tracking Fibers](docs/observability/tracking-fibers.md) — `observability/tracking-fibers`

**scheduling**

- [Using schedules](docs/scheduling/using-schedules.md) — `scheduling/using-schedules`
- [Choosing and combining schedules](docs/scheduling/choosing-and-combining-schedules.md) — `scheduling/choosing-and-combining-schedules`
- [Scheduling work with cron](docs/scheduling/cron.md) — `scheduling/cron`
- [Schedule cookbook](docs/scheduling/cookbook.md) — `scheduling/cookbook`

**state-management**

- [Ref](docs/state-management/ref.md) — `state-management/ref`
- [SynchronizedRef](docs/state-management/synchronizedref.md) — `state-management/synchronizedref`
- [SubscriptionRef](docs/state-management/subscriptionref.md) — `state-management/subscriptionref`

**caching**

- [Caching Effects](docs/caching/caching-effects.md) — `caching/caching-effects`
- [Cache](docs/caching/cache.md) — `caching/cache`

**concurrency**

- [Fibers](docs/concurrency/fibers.md) — `concurrency/fibers`
- [Deferred](docs/concurrency/deferred.md) — `concurrency/deferred`
- [Queue](docs/concurrency/queue.md) — `concurrency/queue`
- [PubSub](docs/concurrency/pubsub.md) — `concurrency/pubsub`
- [Semaphore](docs/concurrency/semaphore.md) — `concurrency/semaphore`
- [Latch](docs/concurrency/latch.md) — `concurrency/latch`
- [Basic Concurrency](docs/concurrency/basic-concurrency.md) — `concurrency/basic-concurrency`

**stream**

- [Introduction to Streams](docs/stream/introduction.md) — `stream/introduction`
- [Creating Streams](docs/stream/creating.md) — `stream/creating`
- [Consuming Streams](docs/stream/consuming-streams.md) — `stream/consuming-streams`
- [Error Handling in Streams](docs/stream/error-handling.md) — `stream/error-handling`
- [Operations](docs/stream/operations.md) — `stream/operations`
- [Resourceful Streams](docs/stream/resourceful-streams.md) — `stream/resourceful-streams`

**sink**

- [Introduction](docs/sink/introduction.md) — `sink/introduction`
- [Creating Sinks](docs/sink/creating.md) — `sink/creating`
- [Sink Operations](docs/sink/operations.md) — `sink/operations`
- [Leftovers](docs/sink/leftovers.md) — `sink/leftovers`

**testing**

- [TestClock](docs/testing/testclock.md) — `testing/testclock`

**code-style**

- [Guidelines](docs/code-style/guidelines.md) — `code-style/guidelines`
- [Dual APIs](docs/code-style/dual.md) — `code-style/dual`
- [Branded Types](docs/code-style/branded-types.md) — `code-style/branded-types`
- [Pattern Matching](docs/code-style/pattern-matching.md) — `code-style/pattern-matching`
- [Simplifying Excessive Nesting](docs/code-style/do.md) — `code-style/do`
- [Control Flow Operators](docs/code-style/control-flow.md) — `code-style/control-flow`

**data-types**

- [BigDecimal](docs/data-types/bigdecimal.md) — `data-types/bigdecimal`
- [Cause](docs/data-types/cause.md) — `data-types/cause`
- [Chunk](docs/data-types/chunk.md) — `data-types/chunk`
- [Data](docs/data-types/data.md) — `data-types/data`
- [DateTime](docs/data-types/datetime.md) — `data-types/datetime`
- [Duration](docs/data-types/duration.md) — `data-types/duration`
- [Result](docs/data-types/result.md) — `data-types/result`
- [Exit](docs/data-types/exit.md) — `data-types/exit`
- [HashSet](docs/data-types/hash-set.md) — `data-types/hash-set`
- [Option](docs/data-types/option.md) — `data-types/option`
- [Redacted](docs/data-types/redacted.md) — `data-types/redacted`

**trait**

- [Equal](docs/trait/equal.md) — `trait/equal`
- [Hash](docs/trait/hash.md) — `trait/hash`

**behaviour**

- [Equivalence](docs/behaviour/equivalence.md) — `behaviour/equivalence`
- [Order](docs/behaviour/order.md) — `behaviour/order`

**schema**

- [Introduction to Effect Schema](docs/schema/introduction.md) — `schema/introduction`
- [Getting Started](docs/schema/getting-started.md) — `schema/getting-started`
- [Basic Usage](docs/schema/basic-usage.md) — `schema/basic-usage`
- [Filters](docs/schema/filters.md) — `schema/filters`
- [Advanced Usage](docs/schema/advanced-usage.md) — `schema/advanced-usage`
- [Schema Projections](docs/schema/projections.md) — `schema/projections`
- [Schema Transformations](docs/schema/transformations.md) — `schema/transformations`
- [Schema Annotations](docs/schema/annotations.md) — `schema/annotations`
- [Error Messages](docs/schema/error-messages.md) — `schema/error-messages`
- [Error Formatters](docs/schema/error-formatters.md) — `schema/error-formatters`
- [Class APIs](docs/schema/classes.md) — `schema/classes`
- [Default Constructors](docs/schema/default-constructors.md) — `schema/default-constructors`
- [Effect Data Types](docs/schema/effect-data-types.md) — `schema/effect-data-types`
- [Schema to Standard Schema](docs/schema/standard-schema.md) — `schema/standard-schema`
- [Schema to Arbitrary](docs/schema/arbitrary.md) — `schema/arbitrary`
- [Schema to JSON Schema](docs/schema/json-schema.md) — `schema/json-schema`
- [Schema to Equivalence](docs/schema/equivalence.md) — `schema/equivalence`
- [Schema to Formatter](docs/schema/formatter.md) — `schema/formatter`

**platform**

- [Introduction to Effect Platform](docs/platform/introduction.md) — `platform/introduction`
- [FileSystem](docs/platform/file-system.md) — `platform/file-system`
- [Path](docs/platform/path.md) — `platform/path`
- [PlatformLogger](docs/platform/platformlogger.md) — `platform/platformlogger`
- [Runtime](docs/platform/runtime.md) — `platform/runtime`
- [Terminal](docs/platform/terminal.md) — `platform/terminal`

**getting-started**

- [Why Effect?](docs/getting-started/why-effect.md) — `getting-started/why-effect`
- [Installation](docs/getting-started/installation.md) — `getting-started/installation`
- [Importing Effect](docs/getting-started/importing-effect.md) — `getting-started/importing-effect`
- [The Effect Type](docs/getting-started/the-effect-type.md) — `getting-started/the-effect-type`
- [Creating Effects](docs/getting-started/creating-effects.md) — `getting-started/creating-effects`
- [Running Effects](docs/getting-started/running-effects.md) — `getting-started/running-effects`
- [Using Generators](docs/getting-started/using-generators.md) — `getting-started/using-generators`
- [Building Pipelines](docs/getting-started/building-pipelines.md) — `getting-started/building-pipelines`
- [Devtools](docs/getting-started/devtools.md) — `getting-started/devtools`
