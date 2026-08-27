---
name: dev
description: >
  Use at the START of any substantive dev task to decide how much process it needs —
  before planning, before building. Classifies the task and loads only the phase
  skills the task's shape warrants. Also handles explicit `/dev <subcommand>`
  invocations (research, plan, build, ship).
disable-model-invocation: false
---

# Dev — task triage

Decide how much process a task deserves, then get out of the way. Pick the FIRST
row that matches, load only what it names, and start.

| Task shape | Route |
|---|---|
| Trivial fix, mechanical change, rename, config tweak | Implement directly. The repo's own skills (auto-loaded) and its arch rules / CI gates carry it. No phase skills. |
| Feature, clear scope | Build directly; plan first ONLY if genuinely open questions remain. `dev:dev-build` when working a Linear issue. |
| UI / visual work | `/design` pipeline (`dev:design`) — the design stack loads on demand. |
| Risky: schema, money, auth, data migration | `dev:dev-plan` → build → `dev:review` before staging. Follow the repo's verification skill if it has one. |
| Open-ended idea, research, "should we…" | `dev:dev-research` — brainstorm, PRD, mocks. |
| Multi-repo change, audit, broad review | Propose a Workflow-tool fan-out (user must opt in) or split per-repo. |

**Hard constraint:** this skill stays a table plus a sentence per route. Process
detail lives in the phase skills it names; if methodology accumulates here,
move it there. A misroute costs one turn — when unsure between two rows, take
the lighter one and say so.

## Explicit subcommands

`/dev <subcommand>` always routes directly, no triage:

| Command | Skill |
|---|---|
| `/dev research <app> <idea>` | `dev:dev-research` |
| `/dev plan <app> [path]` | `dev:dev-plan` |
| `/dev build <LINEAR-ID>` | `dev:dev-build` |
| `/dev ship` | `dev:dev-ship` |
| `/dev <LINEAR-ID>` (bare issue id) | `dev:dev-build` |

## App config — read, never carry

Per-app facts (Linear team key, paths, work dir) live in each repo's
`.claude/planner.local.md`; repo conventions live in that repo's own
`.claude/skills/`. This skill deliberately carries NO app table — the last one
drifted stale (pre-sibling-clone paths, pre-migration teams) because a router
is the wrong place for facts it doesn't own.

## Context loading

Repo skills auto-load by path — trust them first. Reach for the marketplace
pattern docs (`${CLAUDE_PLUGIN_ROOT}/../../references/patterns/`) only when the
repo lacks a skill for the area, and load only the file the task touches.
