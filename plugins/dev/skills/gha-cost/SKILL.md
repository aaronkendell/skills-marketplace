---
name: gha-cost
description: Stop GitHub Actions from running on work nobody has looked at yet — draft-PR guards, Renovate draft PRs, concurrency groups and path filters. Use when adding or editing a workflow, when Actions spend is too high, when an agent's exploratory PRs are firing full pipelines, or when deciding whether to self-host runners.
---

# Spending Actions minutes only when you mean to

**The rule: CI runs when Aaron says the work is ready, not when a branch happens to move.**
Private-repo minutes are billed. Agents open PRs constantly, Renovate opens more, and each
one previously fired a full pipeline on work nobody had reviewed.

Run the checks locally first — see `dev:ci-local` — then mark the PR ready.

## The draft guard, and the trap in it

**Draft status does not skip workflows.** A draft PR fires `pull_request` events exactly
like a ready one. The guard has to be explicit, and it has **two halves**:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  test:
    if: github.event.pull_request.draft == false
```

Omit `ready_for_review` from `types` and marking a PR ready triggers nothing — you have to
push an empty commit to wake it up. That is the failure people hit and then abandon the
guard over.

### The trap: workflows that also run on push

Most real workflows trigger on **both** `push` and `pull_request`. On a push event
`github.event.pull_request` is null, so `github.event.pull_request.draft == false`
evaluates **false** and the job silently stops running on your main branch.

**For any workflow with more than one trigger, use the compound form:**

```yaml
if: github.event_name != 'pull_request' || github.event.pull_request.draft == false
```

Reads as: not a PR at all → run; a PR → run only when it is ready. **Check the `on:` block
before choosing which form to use.** Getting this wrong disables deploys rather than saving
money, and it fails silently.

### Merging with an existing `if:`

Many jobs already carry a condition. Do not replace it — `&&` onto the front:

```yaml
if: >-
  (github.event_name != 'pull_request' || github.event.pull_request.draft == false) &&
  (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude'))
```

Parenthesise both sides. YAML folding plus GitHub's expression precedence makes unbracketed
`||` and `&&` mixtures genuinely hard to reason about.

## Renovate

**Set it once in the shared preset, not per repo.** Every repo extends
`github>bokendell/.github:renovate-default`:

```json
"prCreation": "immediate",
"draftPR": true
```

With the workflow guard in place, a dependency bump now costs **zero minutes** until it is
marked ready. Renovate is usually the single largest source of unreviewed pipeline runs.

## The other two levers

**Concurrency** — three pushes to a branch should not run three pipelines:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Never put `cancel-in-progress: true` on a deploy workflow. Cancelling a half-finished
deploy is worse than paying for it.

**Path filters** — a docs-only change should not run the test matrix:

```yaml
on:
  pull_request:
    paths: ['apps/**', 'packages/**', '!**/*.md']
```

## Check before you change

Several repos already have most of this. Measure first:

```bash
d=.github/workflows
find "$d" -maxdepth 1 -name '*.yml' | wc -l          # total
grep -rl "pull_request"          "$d" | wc -l        # PR-triggered
grep -rl "draft ==\|ready_for_review" "$d" | wc -l   # already guarded
grep -rl "concurrency:"          "$d" | wc -l
grep -rl "paths:"                "$d" | wc -l
```

**Measured 2026-08-29** — path filters were largely done, concurrency partly, draft guards
nowhere:

| Repo | Workflows | On `pull_request` | Guarded |
|---|---|---|---|
| `.github` | 28 | 7 | 0 |
| golf | 22 | 8 | 0 |
| keepings | 15 | 5 | 0 |
| hive | 14 | 4 | 0 |
| swarm | 14 | 4 | 0 |
| portfolio | 11 | 3 | 0 |
| core | 5 | 2 | 0 |

## Editing these files safely

There is no YAML parser on most of these boxes, and several workflows carry multi-line
`if: |` blocks. **Do not regex a fleet of workflow files.** A broken guard does not error —
it silently stops a deploy, which is the worst possible failure for a change made to save
money.

Work one repo at a time, read each `on:` block to pick the right form, and confirm the run
actually fires on a real PR before moving to the next.

## Self-hosting runners — usually the wrong answer

**Not worth it at small scale, and less so since January 2026.** GitHub cut hosted-runner
prices by up to 39%, and the proposed per-minute charge for self-hosted runners was shelved.
Break-even is roughly **1,500 Linux minutes a month**; below that you are trading money for
OS patching, runner-token rotation and disk-fill monitoring.

Self-host only for something hosted runners cannot do: GPUs, exotic architectures, jobs over
six hours, or private-network access. **Never run untrusted fork PRs on a self-hosted
runner** — a malicious PR can rewrite the workflow that executes on your hardware.

## Related

- `dev:ci-local` — running every check locally so CI confirms rather than discovers
- `dev:verification` — proving a change actually works
