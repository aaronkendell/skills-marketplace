---
name: dev
description: >
  Use when the user invokes dev workflows with `/dev <subcommand> <args...>` where subcommand
  is one of research, plan, build, or ship. Also triggers when the user says "start development",
  "implement this feature", "ship it", "create a plan", or describes wanting to go through
  the full SDLC. Routes to the correct phase skill.
disable-model-invocation: true
---

# Dev — SDLC Router

Routes `/dev <subcommand>` to the correct phase skill.

## Subcommands

| Command | Phase | Skill | Description |
|---------|-------|-------|-------------|
| `/dev research <app> <idea>` | 1 | `dev:dev-research` | Research, brainstorm, PRD, mocks |
| `/dev plan <app> [path]` | 2 | `dev:dev-plan` | Break into projects/issues, sync to Linear |
| `/dev build <LINEAR-ID>` | 3 | `dev:dev-build` | Branch, TDD, test, review, stage |
| `/dev ship` | 4 | `dev:dev-ship` | Commit, push, PR, Linear update, merge |

## Supported Apps

| App | Linear Team | API Server | Admin | Mobile |
|-----|-------------|------------|-------|--------|
| `golf` | GOLF | `apps/golf/api` | `apps/golf/admin` | `apps/golf/mobile` |
| `portfolio` | PORT | `apps/portfolio/api` | `apps/portfolio/admin` | `apps/portfolio/app` |
| `hive` | AGENTS | `apps/hive/api` | `apps/hive/admin` | — |

## Routing

Parse `$ARGUMENTS`:
1. Extract the **subcommand** (first word): `research`, `plan`, `build`, or `ship`
2. Extract the **remaining args** (everything after the subcommand)
3. Invoke the corresponding skill via the Skill tool:
   - `dev:dev-research` with remaining args
   - `dev:dev-plan` with remaining args
   - `dev:dev-build` with remaining args
   - `dev:dev-ship` with remaining args

If no subcommand is given, ask the user which phase they want to run.

If the user just says `/dev` with a Linear issue ID (e.g., `/dev GOLF-123`), default to `/dev build GOLF-123`.

## Context Loading

Every phase MUST load the relevant context patterns before starting work. Read the marketplace pattern docs (resolve via the context-patterns skill: `${CLAUDE_PLUGIN_ROOT}/../../references/patterns/`) based on what's being worked on:
- Backend: `ddd.md`, `testing.md`, `api.md`
- Frontend/Web: `frontend.md`, `testing.md`
- Mobile: `mobile.md`, `testing.md`
- Always: `testing.md`

## App Config

Read `.claude/planner.local.md` for per-app Linear team keys and paths. The YAML frontmatter maps app names to team keys:

```yaml
apps:
  golf:
    teamKey: GOLF
    workPath: docs/planning
  portfolio:
    teamKey: PORT
    workPath: docs/planning
  hive:
    teamKey: AGENTS
    workPath: docs/planning
```
