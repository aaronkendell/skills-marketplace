---
name: open-pr
description: >
  Open a DRAFT pull request from the current branch so GitHub Actions do not run yet. Body from
  the plan file, review notes and exercise-paths output — never from memory. Undrafts (`--ready`) and merges only on an explicit ask, each a separate yes.
argument-hint: "[--ready] [--stack-on=<branch>]"
---

# open-pr

Draft by default. Actions bill minutes; the local gate already ran; CI should run once, when you
undraft. `--ready` only when the user explicitly wants Actions now.

⚠️ Draft only saves Actions where the repo's PR workflows carry the `draft == false` guard
(`dev:ci-local` / `dev:gha-cost` prescribe it). **golf has no such guard today** — a draft PR
creates the Neon branch and an EAS preview immediately (see golf's `ci-gate` skill). Until the
guard lands, say so when opening the PR rather than implying nothing ran.

## Context

```bash
git log origin/main..HEAD --oneline
git diff origin/main...HEAD --stat
```

Read the plan file: notes, `## Deviations`, `## Review notes`, `## Gate`. Reconstructing them
from the diff loses the reasoning.

## Body

```
## Summary
<two or three sentences — the shape, not the file list>

## Plan
docs/planning/<x>/<ID>-plan.md · deviations: <none | listed with reasons>

## Review
<level> · <n> findings, <n> addressed · declined: <listed with reasons | none>
Sole reviewer — no automated or human review on this PR.

## How it was verified
<the exercise-paths block, verbatim: counts, ✓/✗/→, handed device items>

## Docs
<owning docs updated per docs/MAP.md ownership, or why none needed>

## Linear
GOLF-123
```

If `exercise-paths` hasn't run, say so in that section — not "tested locally".

## Create

```bash
gh pr create --draft --assignee @me --title "GOLF-123 — <headline>" --body "$(cat <<'BODY'
...
BODY
)"
```

Title: `<LINEAR-ID> — <headline>` or `<type>: <headline>` for one-offs. Linear → **In Review**
(match by status name). Don't post a PR-link comment on Linear — GitHub integration already links
from the branch. Stacked: `--base <parent>` and say so in the first line.

Record the PR number in the plan file's `links:`.

## Undraft and merge — each on its own explicit yes

Gate first (plan file `## Gate`: local gate · review · qa · docs). Any box unticked → name it and
the command that clears it; stop. Then, on ask:

```bash
gh pr ready <pr>                      # Actions run now — the only time for this branch
gh pr checks <pr> --watch             # red: read it; flaky → re-run once; real → back to implement
gh pr merge <pr> --squash --delete-branch   # second explicit yes; check the target — golf promotes qa → stage → main
```

After: Linear → Done by status name · distill-on-ship if a planning project closed (`dev:docs`) ·
`use-worktree prune` · `close-out` if the loop deviated.
