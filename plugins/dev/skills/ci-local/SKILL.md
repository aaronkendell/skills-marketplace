---
name: ci-local
description: Run every CI check on your own machine before pushing, so GitHub Actions minutes are spent confirming rather than discovering. Use when a PR is about to be opened, when CI just failed on something a local run would have caught, or when deciding which workflows should be allowed to run on a draft PR.
---

# Running CI locally

**The goal is that CI never tells you something you could have learned in ninety seconds.**
GitHub Actions bills private-repo minutes; your laptop does not. Every check below runs
locally, and the affected-only variants make that fast enough to do before every push.

## The order that matches CI

Run these in sequence. Each is cheap and each catches a different class of failure, so
stopping at the first red saves the rest.

```bash
pnpm check                      # biome — format + lint, whole repo, ~seconds
pnpm check:types:affected       # tsgo, only what changed
pnpm check:lint:affected        # biome, only what changed
pnpm check:architecture:changed # arch rules on changed files
pnpm swarm check lockfile       # lockfile drift — a classic CI-only failure
pnpm build                      # turbo, cached
pnpm test                       # vitest
```

**`pnpm swarm check all --affected` runs the whole affected set in one command.** Reach for
that when you want one answer rather than seven.

### The ones people forget, and that only fail in CI

| Check | Why it only bites in CI |
|---|---|
| `pnpm swarm check lockfile` | CI installs `--frozen-lockfile`; your laptop already has `node_modules` and will happily continue with a stale lockfile |
| `pnpm check:catalog` | Catalog drift is invisible until a fresh resolve |
| `pnpm check:secrets` | Reads the Infisical descriptors; a missing required key passes locally because your `.env.workspace` has it |
| `pnpm check:architecture` | Import-boundary rules; easy to violate in an editor that auto-imports |
| `pnpm lint:boundaries` | Separate eslint config, not covered by biome |

## Let lefthook do it for you

lefthook is installed in every repo. If a check is worth running before a push, put it in
`lefthook.yml` under `pre-push` rather than remembering it:

```yaml
pre-push:
  parallel: true
  commands:
    types:
      run: pnpm check:types:affected
    lint:
      run: pnpm check:lint:affected
    lockfile:
      run: pnpm swarm check lockfile
```

Keep `pre-commit` fast — formatting and lint on staged files only. Anything that takes more
than a few seconds belongs in `pre-push`, where the wait is expected.

**`--no-verify` exists and the workspace convention is to use it on commits.** That is
deliberate: hooks that block a commit get bypassed and then ignored. Pre-*push* is the
right gate, because that is the moment before minutes get spent.

## Don't let draft PRs burn minutes

**Draft status does not skip workflows by itself.** A draft PR fires `pull_request` events
exactly like a ready one, and this is the single biggest source of wasted minutes when
agents open PRs on exploratory work.

Add the guard explicitly:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  test:
    if: github.event.pull_request.draft == false
```

Both halves matter. `ready_for_review` in `types` makes the run fire the moment the draft is
promoted; the `if` keeps it from running before then. Without the first, marking a PR ready
does not trigger anything and you have to push an empty commit.

## Also worth having

**Concurrency groups**, so three pushes to a branch do not run three full pipelines:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Path filters**, so a docs-only change does not run the test matrix:

```yaml
on:
  pull_request:
    paths: ['apps/**', 'packages/**', '!**/*.md']
```

## Checking the state of a repo

Before recommending any of this, look at what is already there — several repos have most of
it:

```bash
ls .github/workflows/ | wc -l
grep -l 'paths:'        .github/workflows/*.yml | wc -l   # path filters
grep -l 'concurrency:'  .github/workflows/*.yml | wc -l   # concurrency groups
grep -l 'draft =='      .github/workflows/*.yml | wc -l   # draft guards
```

As of 2026-08-29 in golf: 22 workflows, path filters on most, **concurrency on 2 of 22**
(though the org's reusable workflows carry 24 of their own), and **draft guards on 0 of 22**.
The draft guard is the gap worth closing first, because it is the one an agent's workflow
trips constantly.

## On self-hosting runners

**Usually not worth it, and less so since January 2026.** GitHub cut hosted-runner prices by
up to 39%, and the proposed per-minute charge for self-hosted runners was shelved. Self-hosting
starts paying off past roughly 1,500 Linux minutes a month, and below that you are trading
money for OS patching, runner-token rotation and disk-fill monitoring.

Self-host when you need something hosted runners cannot give you: GPUs, exotic
architectures, jobs over six hours, or access to a private network. Not to save money at
small scale.

**Never run untrusted fork PRs on a self-hosted runner** — a malicious PR can modify the
workflow that runs on your hardware.

## Related

- `dev:verification` — proving a change actually works
- `dev:review` — reviewing against the pattern docs
- `dev:dev-ship` — the ship step, which assumes these checks already passed
