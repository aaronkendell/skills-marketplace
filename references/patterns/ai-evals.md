# AI Evals & Live Scoring

How the eval harness, live scorers, and observability fit together. One pattern doc covering: how to run evals, how to view results in production, how to add a new suite or wire a new app, and when/how to build a custom admin view.

**Status:** Wired for `golf-assistant` today. Generic enough to extend to hive/portfolio agents.

---

## TL;DR — where do I look?

| I want to… | Look at |
|---|---|
| Browse live scorer results, filter by user/intent | **Langfuse → Scores tab** (auto-populated by Mastra) |
| Browse a specific bad turn end-to-end | **Langfuse trace** (click through from Scores) |
| Inspect a dataset eval run locally | `pnpm swarm evals run golf:golf-assistant` |
| See score history in dev with per-trace inspection | `pnpm mastra:dev` → **Studio Evaluate tab** |
| Page on regression | Grafana alert on `mastra_scorers` |
| Custom dashboard / cross-cuts Langfuse can't do | Build the admin page (see [§ Admin page later](#admin-page-when-langfuse-isnt-enough)) |

---

## Architecture in one paragraph

Three scorers live in `packages/domains/src/packages/ai/evals/scorers/`. The agent (`golf-assistant.ts`) wires the **`relevancy`** scorer at 5% sampling on production traffic via Mastra's `agent.scorers` config. Mastra runs the scorer asynchronously after every sampled generation, writes the result to its `mastra_scorers` Postgres table, AND calls each registered observability exporter's `addScoreToTrace()` — including the Langfuse exporter wired in `mastra.client.ts`. So **scorer results flow to two places automatically: the `mastra_scorers` table and Langfuse as native trace scores**. No glue code is needed.

The other two scorers (`tool-selection`, `intent-recognition`) are dataset-only — they need ground truth (`expectedTrajectory` / `expectedIntent`) that doesn't exist on live traffic. They run via `swarm evals run`.

---

## Live scorer wiring

### What's attached today

In `packages/domains/src/packages/ai/infrastructure/mastra/agents/golf-assistant.ts`:

```ts
scorers: {
  relevancy: {
    scorer: createGolfRelevancyScorer(),
    sampling: { type: "ratio", rate: GOLF_RELEVANCY_LIVE_SAMPLING_RATE }, // 0.05
  },
},
```

Five percent of every chat turn through `golf-assistant` is graded by Haiku for whether the response actually addressed the question. At ~50 chats/day current volume that's ~2-3 judge calls/day on Haiku — fractions of a cent.

### Sampling modes

Mastra's `sampling` config supports several shapes (`@mastra/core/agent`):

```ts
// Random N%
sampling: { type: "ratio", rate: 0.05 }

// Every turn (free deterministic scorers should use this)
sampling: { type: "ratio", rate: 1.0 }

// First N turns then stop
sampling: { type: "first", count: 100 }

// Conditional — only run when predicate is true
sampling: { type: "function", fn: ({ requestContext }) => requestContext.get("voiceMode") === true }
```

A useful pattern: bump sampling to 100% temporarily (deploy → wait one day → back to 5%) when you want a high-resolution snapshot during a model swap or prompt change.

### Adding a live scorer

1. Build the scorer in `evals/scorers/<name>.scorer.ts`. If it needs ground truth, it can't run live — it stays dataset-only.
2. Attach it in the agent's `scorers` config with the desired sampling.
3. Pick the rate based on cost + signal: deterministic scorers (`tool-selection`, custom regex matchers) → `1.0`; LLM-graded scorers → `0.05` baseline.

### Why `tool-selection` isn't live

Comment at `golf-assistant.ts:344-352` documents this. Mastra's `createTrajectoryScorerCode` requires a per-call `expectedTrajectory`; live traffic has none, and the preprocess step crashes on `expected.steps.map`. There's a `createGolfToolSelectionScorerLive()` variant that drops the comparison step and runs accuracy-only — wire it in if you want every-turn live tool-selection drift detection. It's exported but currently not attached.

---

## Reading scorer results

### 1. Langfuse (recommended for triage)

Native Langfuse "Scores" feature. Each scorer result lands as a typed score on the parent trace, inheriting all the trace metadata the `langfuse-trace-tagger` processor stamps:

- `userId`, `sessionId`, `agentId`, `feature`, `source`, `roundId`, `messageType` — all filterable
- Tags: `feature:round_chat`, `agent:golf-assistant`, `source:user_request`, etc.

Useful queries:

```
# UI: filter recipe for "show me low-relevancy chats from the last 24h"
Trace filter: scorer:answer-relevancy < 0.7
Time range:   Last 24 hours
Tags:         agent:golf-assistant
```

Click any low-scoring trace → full prompt, all tool calls, the assistant's response, the judge's reasoning. This is the **primary triage surface**. No code, no admin page needed.

### 2. Mastra Studio (dev-only)

```bash
pnpm mastra:dev
```

Studio's **Evaluate tab** reads `mastra_scorers` directly. Shows per-trace inspection + score distributions + filter by source (`LIVE` vs `LOCAL`). Better than Langfuse for inspecting a specific trace's reasoning text in isolation; worse for cross-trace aggregation. Also dev-only — not a tool you'd ask a non-engineer to use.

### 3. SQL on `mastra_scorers`

For ad-hoc analysis or future dashboards. Schema (Mastra-managed):

```
id           uuid
runId        text         -- the agent.generate run that produced this score
scorerId     text         -- e.g. 'answer-relevancy', 'golf-tool-selection'
score        numeric      -- 0.0–1.0 by convention
reason       text         -- judge's one-line explanation (LLM scorers)
source       text         -- 'LIVE' (production traffic) | 'LOCAL' (dataset eval)
metadata     jsonb        -- whatever the scorer attached
createdAt    timestamptz
```

Useful starter queries:

```sql
-- 24h relevancy distribution by hour
select date_trunc('hour', created_at) as hour,
       percentile_cont(0.5) within group (order by score) as p50,
       percentile_cont(0.95) within group (order by score) as p95,
       count(*) as n
from mastra_scorers
where scorer_id = 'answer-relevancy' and source = 'LIVE'
  and created_at > now() - interval '24 hours'
group by hour
order by hour;

-- Recent low-score turns (drill-down list)
select id, run_id, score, reason, metadata, created_at
from mastra_scorers
where scorer_id = 'answer-relevancy' and source = 'LIVE' and score < 0.7
order by created_at desc
limit 50;

-- Dataset eval history per scorer (last 90 days)
select scorer_id, date(created_at) as day, avg(score) as avg_score, count(*) as n
from mastra_scorers
where source = 'LOCAL' and created_at > now() - interval '90 days'
group by scorer_id, day
order by day, scorer_id;
```

---

## The CLI: `swarm evals`

Source: `apps/cli/src/packages/evals/`, `apps/cli/src/commands/evals/`.

```bash
# Run a suite (default model + judge — resolved via DB role assignments)
swarm evals run golf:golf-assistant
swarm evals run golf-assistant                                 # bare name OK if unambiguous

# Pin a specific model (validated against ai_models)
swarm evals run golf-assistant --model anthropic/claude-sonnet-4-6

# Resolve via role assignment (tracks production routing)
swarm evals run golf-assistant --role conversational
swarm evals run golf-assistant --judge-role fast

# List all registered suites
swarm evals list
```

**No env vars except `DATABASE_URL`** (already in the validated zod env schema). All run-time choices are CLI flags. The CLI loads the app's Awilix cradle to get `aiModelResolver` (DB role lookups) and `usageService.validateModel` (catches typos against `ai_models`, returns live pricing for the cost report).

`pnpm test:evals` (in the package script) just calls `pnpm swarm evals run golf:golf-assistant` — kept for muscle memory.

---

## CICD: `.github/workflows/evals.yml`

Generic across apps. Triggers on:

1. **Pull request** — when paths under `packages/domains/src/packages/ai/**` change (per-app glob in the `paths` filter).
2. **Nightly cron** at 09:00 UTC against the default branch.
3. **`workflow_dispatch`** with optional `suite` / `model` / `role` / `environment` overrides.

Adding a new app's eval is one matrix entry:

```yaml
matrix:
  include:
    - app: golf
      suite: golf-assistant
      infisical-path: /apps/api
    # New entry:
    - app: hive
      suite: chat-classifier
      infisical-path: /apps/api
```

Plus the path glob in the `pull_request.paths` list. No new GitHub secrets — Infisical loads `DATABASE_URL` and `ANTHROPIC_API_KEY` from the per-app secret path. The reusable composite action lives at `.github/actions/testing/run-evals/`.

### Secrets

The only GH-stored secrets the eval needs are the ones already used by every other workflow:

- `INFISICAL_CLIENT_ID`
- `INFISICAL_CLIENT_SECRET`

Everything else loads at run time from each app's Infisical path. The eval defaults to `env-slug: stage` so PR runs read pricing/role data from the stage DB without touching prod connection budget.

---

## Adding evals for a new app

1. **Build the suite** under `packages/domains/src/packages/ai/evals/` following golf's structure (`types.ts`, `runner/`, `suites/`, `fixtures/`, `scorers/`). The runner code in golf is generic enough to copy verbatim — only fixtures + scorers are app-specific.
2. **Add `aiModelResolver` + `usageService.validateModel`** to the app's Awilix cradle if they don't exist yet (golf already has both; portfolio + hive currently don't have `validateModel` — adding it is a small lift to each app's `usage.service.ts`).
3. **Wire a CLI adapter** in `apps/cli/src/packages/evals/cradle-for.ts` — one case statement per app.
4. **Re-export suites** from the app's `<app>-domains/ai/evals` barrel so the CLI registry picks them up.
5. **Add a workflow matrix entry** + path filter in `.github/workflows/evals.yml`.

**Long-term:** if a third app onboards, the `runner/`, `types.ts`, and `utils/` files in `golf-domains/evals` should move to a shared `@bokendell/eval-core` package. Premature for two apps.

---

## Adding a new dataset prompt

1. Edit `packages/domains/src/packages/ai/evals/datasets/golf-assistant.json`.
2. Add an item with the schema declared by `golfAssistantItemSchema` (validated at load time).
3. Run `swarm evals run golf:golf-assistant` locally to confirm the new prompt scores at expected level.
4. Open the PR — the GH workflow re-runs the suite against the changed dataset.

Dataset items are graded against per-prompt **`expectedIntent`** (one of 5 buckets) and **`expectedTrajectory.steps`** (the tool calls the agent should make). Get those right and the scorers will rate the agent fairly.

---

## Alerting

For "page me when something regresses," prefer Grafana over admin-page polling. Two relevant series on `mastra_scorers`:

```sql
-- Live relevancy 24h p50 (alert when < 0.7)
select percentile_cont(0.5) within group (order by score)
from mastra_scorers
where scorer_id = 'answer-relevancy' and source = 'LIVE'
  and created_at > now() - interval '24 hours';

-- Most recent dataset eval — overall pass/fail signal
select scorer_id, score, created_at
from mastra_scorers
where source = 'LOCAL'
order by created_at desc
limit 5;
```

Wire those as Grafana panels with threshold alerts. The Grafana MCP can build the dashboard from these queries directly.

---

## Admin page (when Langfuse isn't enough)

**Don't build this until you've used Langfuse for a few weeks and noted what's missing.** The right time is when you find yourself doing one of these regularly and Langfuse can't:

- Joining `mastra_scorers` × `ai_usage_events` × dataset eval results in one view (cost + quality + regression timeline)
- Sharing screenshots in product/stakeholder reviews where Langfuse's UI is too engineering-flavored
- Showing live + dataset trends side-by-side per intent bucket
- Filtering by app-domain concepts Langfuse doesn't know about (e.g. `roundId` joined to a real round)

When the time comes, mirror the existing dashboard pattern in `apps/admin/src/packages/dashboard/`:

```
apps/admin/src/packages/ai-quality/
├── containers/ai-quality-container.tsx
├── components/
│   ├── score-trend-chart.tsx        # line: relevancy p50/p95 by day, last 30d
│   ├── recent-low-scoring-table.tsx # last 50 turns where score < 0.7, link to Langfuse
│   └── eval-suite-history.tsx       # bar: most recent suite runs (LOCAL) per scorer
├── hooks/use-ai-quality.ts
├── pages/ai-quality-page.tsx
└── constants.ts
```

Three queries (the SQL in [§ Reading scorer results](#3-sql-on-mastra_scorers)). Each row in the recent-low-scoring table links out to Langfuse for the full trace — admin owns the "what regressed" view, Langfuse owns the "why" view. No duplication.

---

## File map

```
packages/domains/src/packages/ai/evals/
├── types.ts                       # EvalSuite contract
├── constants.ts                   # DEFAULT_JUDGE_ROLE
├── datasets/golf-assistant.json
├── fixtures/                      # Stub services for the agent under eval
├── scorers/                       # tool-selection / intent-recognition / relevancy
├── utils/                         # stats, trajectory extraction
├── runner/                        # Generic; takes EvalRunContext from cradle
│   ├── load-dataset.ts
│   ├── resolve-model.ts           # Priority: --model > --role > suite literal > suite role
│   ├── run-suite.ts
│   ├── score-item.ts
│   ├── summarize.ts
│   ├── thresholds.ts
│   └── reporter.ts                # Cost via calculateCostMicros + ai_model_pricing
├── suites/golf-assistant.suite.ts # The only app-specific definition file
├── run-evals.ts                   # Deprecated shim → swarm evals run
└── index.ts

apps/cli/src/packages/evals/
├── cradle-for.ts                  # Per-app: cradle → EvalRunContext adapter
├── registry.ts                    # All suites, namespaced as <app>:<name>
└── index.ts                       # runEvalsCommand / listEvalsCommand

apps/cli/src/commands/evals/
├── run.ts                         # swarm evals run
└── list.ts                        # swarm evals list

.github/
├── actions/testing/run-evals/     # Composite action — generic across apps
└── workflows/evals.yml            # Orchestrator — matrix-driven
```

---

## Things to watch for

- **Don't pin literal model strings in suite `defaults`.** Use `defaults.agent.role: "conversational"` so when DB role assignments swap models, the eval automatically tests the new one. Pinning is for locked benchmark runs only.
- **Cost is real.** Reported via `calculateCostMicros` against live `ai_model_pricing` rows — same calculator the metering layer uses. If a run shows unexpected cost, the model + token usage is honest, not a stale constant.
- **Scorer code IS production code.** A bug in a scorer wedges the live attachment too. Keep the deterministic scorers small and well-tested; LLM-graded scorers should always have try/catch around the judge call.
- **`source = 'LIVE'` rows accumulate.** Add a TTL / partition strategy when row count gets large — `mastra_scorers` is append-only and not auto-pruned. (Not urgent at 5% sampling and ~50 chats/day; would matter at higher volume.)
