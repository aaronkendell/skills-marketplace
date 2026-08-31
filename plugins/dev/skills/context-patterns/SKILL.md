---
name: context-patterns
description: >
  Auto-loads the correct pattern docs based on what's being worked on. Triggers when working
  on golf, portfolio, or hive apps — during planning, development, testing, or code review.
  Ensures DDD, API, frontend, mobile, and testing patterns are always in context. Use
  proactively whenever implementing, reviewing, or planning features.
user-invocable: false
---

# Context Patterns Loader

Automatically determines which pattern docs to load based on the work being done.

## Where pattern docs live

Pattern docs are part of the skills-marketplace, NOT the consumer repo:

1. Preferred: `~/.claude/plugins/marketplaces/bokendell-skills/references/patterns/` (the marketplace clone Claude Code keeps for every registered marketplace — present wherever the plugin is, including cloud sessions; `${CLAUDE_PLUGIN_ROOT}/../../` does NOT reach it from the versioned cache) (plugin lives at `marketplace/plugins/dev`)
2. If `CLAUDE_PLUGIN_ROOT` is unset: search upward from cwd for a directory containing both
   `references/patterns/` and `.claude-plugin/marketplace.json` (the marketplace repo has both)
3. Last resort: `~/repos/bokendell/skills-marketplace/references/patterns/`

## App context

Before patterns, read the repo's `docs/MAP.md` (if present) — it's the retrieval contract and
points at the app overview (`docs/architecture/overview.md`). Load only what MAP.md's task
table names for the current task.

## Detection rules (files touched → pattern docs)

- `packages/*/domains/**` or `packages/*-domains/**` → `ddd.md` + `testing.md`
- `apps/*/api/**` or `apps/api/**` → `api.md` + `ddd.md` + `testing.md`
- `apps/*/app/**` or `apps/*/admin/**` or `apps/admin/**` → `frontend.md` + `testing.md`
- `apps/*/mobile/**` or `apps/mobile/**` → `mobile.md` + `testing.md`
- `packages/*/db/**` or `packages/db/**` → `ddd.md` + `testing.md`
- `apps/design/**` or `packages/*-ui/**` → `per-app-ui.md` + `design-studio.md`

When in doubt, load `ddd.md`, `api.md`, `testing.md` — extra context is cheaper than a missed
pattern violation.

## How to load

Read each relevant pattern file with the Read tool. Pass the content to subagents, code
reviewers, and implementation agents as part of their prompt context.
