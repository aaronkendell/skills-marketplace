---
name: drive
description: >
  Drive a piece of work from wherever it is to shipped. Takes a Linear issue, a rough idea, a
  doc path, or nothing. Detects the stage the work is at, sets the ceremony band, and does the
  next thing. The main entry point — `/drive` (and `/dev`) route here. One-off fixes need no
  ticket; the branch slug is the key.
argument-hint: "<LINEAR-ID | \"idea\" | doc path> [--from=<stage>] [--band=low|medium|high] [--dry-run]"
---

# drive

The one you type. Everything below is a stage it takes, or a primitive you call directly when
you want just that piece. Solo setup, hardcoded on purpose: **Linear** is the tracker, **GitHub**
is the forge, PRs open as **drafts** so Actions don't run until you undraft, there are **no
teammates, no chat, no automated reviewers** — `review-change` is the only review and the local
gate (`dev:ci-local`) stands in for CI until the PR is undrafted. No ship-check, no announcement —
you are the only audience.

## 1 · What you were handed

| Input | Route |
|---|---|
| Linear ID (`GOLF-123`) | fetch it; detect the stage below |
| A rough idea / bug report | shape it in one paragraph (what, why, done-when); band it; a Linear issue only if it's medium+ |
| A doc path (`docs/planning/<x>/design.md`) | `dev:dev-plan` to break it into issues, then drive the first |
| Nothing | infer from the branch slug; if on main, ask |
| A branch a cloud agent produced | `review-change --agent-branch` → `exercise-paths` → commit/PR stages (see §5) |

## 2 · Detect the stage

Read, in order: the plan file (`docs/planning/**/<slug>-plan.md`, its `## Gate`), git (branch,
staged, unpushed), Linear, `gh pr view`. Say what you detected before acting — a wrong detection
is cheap to correct now and expensive to discover at PR time.

| Found | Next |
|---|---|
| no branch | `open-branch` |
| branch, band medium+, no locked plan | `draft-approach` |
| plan locked / band low | **implement** (§4) |
| changes staged, review not run | `review-change` |
| review clean, QA not run | `map-paths` → `exercise-paths` → `record-qa` |
| QA done, uncommitted | `commit-change` (only when the user asks to commit) |
| committed, no PR | `open-pr` (draft) |
| draft PR, gate green | `open-pr --ready` on ask → CI → merge on ask |

`--from=<stage>` overrides.

## 3 · Band — how much ceremony

| Band | Looks like | Gets |
|---|---|---|
| `low` | one-off fix, obvious cause, one module, no ambiguity | no plan file, no ticket; implement → `review-change low` → gate → ship |
| `medium` | scoped feature, clear acceptance | light `draft-approach`, review `high`, QA from the map |
| `high` | schema / auth / money / multi-module / ambiguous | hard grill, review `xhigh`, full path map, `/security-review` where it touches auth |

Over-planning small work is how people stop planning large work. If it's `low`, say so and move.
Tokens are not the constraint here; skipped verification is. Never trade the QA stage for speed.

## 4 · Implement

No separate skill — the repo's own skills carry it (they auto-load by path). Rules:

- Read the repo's `testing` skill before writing a test; pick the cheapest lane that bites.
- Work the plan's steps in order; each leaves the tree green. A change to the plan goes into the
  plan file's `## Deviations` with a reason, not silently inline.
- **Stage, never commit.** Committing is `commit-change`, and only when asked.
- Static floor after every batch: typecheck (affected) + biome + arch rules. Seconds; no excuse.
- Every claim about existing code is verified by reading it. "Probably handled in X" is a TODO.

## 5 · Cloud sessions

Cloud agents (Claude Code cloud, Cursor) run the same stages on a fresh checkout. What carries:
skills (marketplace + the repo's `.claude/skills/`) and **anything committed on the branch** —
the plan file, its Gate, the QA map. What does not: local hooks, worktree registries, your
memory. So state lives on the branch, and the gate is a step the agent runs, not a hook.

Split that works: the agent runs plan → implement → review → gate; you run
`review-change --agent-branch` (verify every claim, rerun anything reported green), the device
half of `exercise-paths`, and the undraft/merge.

## Fan-out

Most stages are one thread. When a stage is genuinely wide (review across many files, a
competitive scan, an audit over N skills), apply `references/fan-out.md`'s fake-edge test and
*propose* a Workflow with a rough agent count — a skill never launches a fleet on its own.
Saved workflows live in the repo's `.claude/workflows/` (golf: `arch-debt`, `feature-map-refresh`,
`skill-audit`).

## What it never does

- Commit, push, undraft, or merge without an explicit ask in the current turn.
- Report a check it did not run. Skipped is reported as ✗ in the denominator, never omitted.
- Lock a plan over an open question.
- Invent a repo playbook. If the repo has no `verification` skill, stop and offer `onboard`.
