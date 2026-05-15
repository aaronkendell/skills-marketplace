# CI Costs & Runner Strategy

> Living doc for GitHub Actions minute economics in this monorepo. Updated
> after the 2026-05-12 budget exhaustion incident.

## Background

GitHub-hosted runners on a personal Pro plan: 3,000 free Linux minutes/mo,
then $0.008/min for 2-core Linux. Spending cap kicks in at the configured
budget; jobs after the cap fail in 3-10 seconds with **0 steps recorded**
(GitHub refuses to allocate a runner). This is the failure signature to
recognize — it isn't a code or workflow bug, it's a billing limit.

```
{ "conclusion": "failure", "duration_s": 4, "steps": 0 }
```

When you see this across every job in a workflow simultaneously, check
billing first before debugging the code.

## Where the minutes were going (pre-2026-05-12)

Top cost drivers in priority order:

### 1. Vercel `vercel.deployment.ready` fan-out (~50% of spend)

Vercel posts a `repository_dispatch` event for **every preview AND every
production deploy across every Vercel project** (golf-design, golf-admin,
portfolio-app, portfolio-admin, etc.). Both `deploy-migrations.yml` and
`deployment-checks.yml` triggered on this without filtering, so every
preview deploy fired:

- 1 `Migration Matrix` job → Setup monorepo (3-5 min cold / ~30s warm) +
  matrix build, then downstream skipped for `environment == "preview"`
- 1 `Deployment Checks` workflow with 3 jobs (health-check / smoke / e2e),
  each running Setup monorepo before any check could decide it's a no-op

In a 90-minute observation window: **12 dispatches → 24 workflow runs →
~150 minutes of runner time**, mostly Setup monorepo work for jobs that
ultimately didn't do anything.

**Fix applied (2026-05-12)**: job-level `if:` filters short-circuit
preview dispatches before any runner work starts. `deploy-migrations.yml`
also got a `paths:` filter on the `push:` trigger so docs / asset commits
don't fire migration runs.

### 2. Setup monorepo cold-cache hits (~20% of spend)

`Setup monorepo` action: pnpm install + Node setup + dep restore. The
cache key is `hashFiles('**/pnpm-lock.yaml')`; any lockfile change
invalidates the cache, producing a cold install (3-5 min) instead of warm
(30-90s). The `restore-keys:` fallback warms the store partially but
doesn't eliminate the cold cost.

**This compounds with (1)** — every workflow that runs `Setup monorepo` on
every Vercel dispatch is paying the install cost when it shouldn't fire at
all.

### 3. Per-PR full-matrix runs (~20% of spend)

`quality-checks.yml` runs on every PR to `stage`: lint + types + tests +
arch + deprecations + openapi. Already has `concurrency.cancel-in-progress`
so force-pushes don't pile up — good. Each clean run is ~10-15 min.

### 4. Mobile / production matrix deploys (~10% of spend)

`deploy-fly.yml` (reusable) runs an 8-app matrix on every push to main
that touches `apps/**` or `packages/**`. Each app deploy is 5-15 min
(Docker build + flyctl). Today: 8 apps × ~10 min = ~80 min per
production deploy. Already has change-gate (`enable-change-gate: true`)
so most apps short-circuit when their change-paths didn't match.

## Workflows + their cost shape

| Workflow | Triggers | Cost per fire | Frequency driver |
|---|---|---|---|
| `deployment-checks.yml` | Vercel dispatch | ~5 min/job × 3 jobs = ~15 min | Every Vercel deploy (PR push × N projects) |
| `deploy-migrations.yml` | Vercel dispatch + push to stage/main | ~5 min (matrix) + ~5 min/db (deploy) | Every Vercel deploy + every release |
| `quality-checks.yml` | PR to stage | ~10-15 min | Every PR commit |
| `deploy-production.yml` → `deploy-fly.yml` | Push to main | ~10 min/app × N changed | Every merge to main |
| `deploy-stage.yml` → `deploy-fly.yml` | Push to stage | ~10 min/app × N changed | Every merge to stage |
| `mobile-stage.yml` / `mobile-production.yml` | Push to stage/main | ~15-25 min | Every release |
| `mobile-e2e.yml` | PR + nightly | ~30 min | Per PR + per night |
| `neon-branches.yml` | PR events | ~5 min/job (3 jobs) | Every PR open/sync/close |
| `quality-checks.yml` PR | PR to stage | ~10-15 min | Per PR commit |
| `evals.yml` | Scheduled + manual | ~10 min | Daily / on-demand |
| `Renovate` | Cron | ~3 min | Hourly |

## Optimization principles

1. **Filter at the trigger or job-level `if:`** — don't let runners start
   when the job can't do useful work. Cheaper than gating later in steps.
2. **`paths:` on push triggers** — docs-only / config commits should never
   fire deploy / migration workflows. Configure aggressively.
3. **`concurrency.cancel-in-progress: true` on PR workflows** — force-pushes
   should cancel the prior run. Already correct on `quality-checks.yml`;
   not always on dispatch-triggered workflows.
4. **NEVER `cancel-in-progress` on deploy/migration workflows** — killing
   an in-flight prod deploy mid-run is worse than a few duplicates.
5. **Reuse warmed pnpm-store** — every workflow that calls Setup monorepo
   shares the same cache key. As long as the lockfile doesn't change,
   subsequent installs are fast. Lockfile-bumping PRs cost more by
   definition.
6. **Use a faster runner for the heavy workflows** — see "Runner provider
   strategy" below.

## Runner provider strategy

Don't switch wholesale. Switch per-workflow based on cost shape.

| Provider | Best for | Setup | Ballpark |
|---|---|---|---|
| **GitHub-hosted** (default) | Small / low-frequency workflows | `runs-on: ubuntu-latest` | $0.008/min Linux 2-core (Pro plan); 3,000 free mins/mo |
| **Blacksmith** | Setup-monorepo-heavy workflows, Docker-heavy deploys | `runs-on: blacksmith-2vcpu-ubuntu-2204` (install their GitHub App, swap `runs-on`) | ~50% cheaper per-min, ~2× faster cold cache (NVMe). Free tier available. Confirm current pricing at `blacksmith.sh/pricing` before signing up |
| **BuildJet** | Similar profile to Blacksmith | Same swap pattern | Similar pricing |
| **Depot** | Docker layer caching across runs | Drop-in Docker build action + their runners | Best for `infrastructure/docker/api.Dockerfile` heavy deploys |
| **Namespace.so** | Sandbox-per-run, fast cold starts | Drop-in runner swap | Newer, smaller community |
| **Self-hosted (Fly / Hetzner)** | High-volume orgs willing to pay ops cost | Register runner, rotate tokens, secure secret access | Free per-min, ops burden = real |

**Default recommendation for a solo founder**: keep small workflows on
GH-hosted, route the heavy ones (Setup monorepo cold installs, Docker
builds) to Blacksmith. Try one workflow first, measure, expand.

Don't self-host runners as a solo dev — token rotation + security
boundary + runner registration + auto-scaling = days of work for ~$10-30
saved per month.

## When to bump your spending cap

Default cap: $2 (or whatever the user chose). When it's hit, every job
dies in <10s with 0 steps. To prevent surprise outages:

1. Set the cap higher than your realistic monthly spend (e.g. $50)
   so you don't get blocked by spikes.
2. Set up GitHub spending alerts at 50% / 75% / 90% of the cap.
3. Watch the `Actions` tab → `Usage` section weekly until you have a
   stable per-month number.

## Incident replay — 2026-05-12

- ~01:12 UTC: cap hit mid-`Deploy Migrations` run.
- All subsequent jobs (Deploy Production × 8 apps, recurring Vercel-dispatch
  Migration Matrix, Mobile Stage Deploy, Neon PR Branch Automation) failed
  in 3-13s with 0 steps.
- swarm-api never received a Fly deploy (Sentry releases empty).
- portfolio-api + hive-api production machines stuck in a crash-loop on
  stale code (errors firing every 3 min).
- Fix: this doc + the dispatch filters in `deploy-migrations.yml` +
  `deployment-checks.yml`. Cap bump + retry push to trigger the deferred
  prod deploy.

## See also

- `.github/workflows/deploy-migrations.yml` — the Vercel dispatch filter pattern
- `.github/workflows/deployment-checks.yml` — same filter, 3 jobs
- `.github/actions/setup/monorepo/action.yml` — the cache definition
- `docs/context/patterns/design-workflow.md` — daily flow that drives PR volume
