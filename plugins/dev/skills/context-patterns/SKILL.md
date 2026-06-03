---
name: context-patterns
description: >
  Auto-loads the correct docs/context/patterns/ files based on what's being worked on.
  Triggers when working on golf, portfolio, or hive apps — during planning, development,
  testing, or code review. Ensures DDD, API, frontend, mobile, and testing patterns are
  always in context. Use proactively whenever implementing, reviewing, or planning features.
user-invocable: false
---

# Context Patterns Loader

Automatically determines which pattern docs to load based on the work being done.

## Pattern Files

Located at `docs/context/patterns/` in the project root:

| File | Load When |
|------|-----------|
| `ddd.md` | Any backend domain work (services, repositories, entities, mappers) |
| `api.md` | Any API endpoint work (tRPC routes, Hono routes, OpenAPI) |
| `testing.md` | Always — every feature needs tests |
| `frontend.md` | Web frontend work (Next.js, React, Tailwind, shadcn) |
| `mobile.md` | Mobile work (Expo, React Native, Zustand, RHF) |
| `design.md` | Design app work (`apps/<app>/design/` Next.js studio — lib/, packages/, surface groups, sketches, providers) |
| `design-studio.md` | Annotation system + element IDs in the design app |
| `design-workflow.md` | Per-flow workflow: decisions.md, sketches, promotion to kit |
| `per-app-ui.md` | Per-app UI package (`@bokendell/<app>-ui`) — token contract |

## Detection Rules

Determine which patterns to load based on files being touched:

- `packages/*/domains/` → `ddd.md` + `testing.md`
- `apps/*/api/` → `api.md` + `ddd.md` + `testing.md`
- `apps/*/app/` or `apps/*/admin/` → `frontend.md` + `testing.md`
- `apps/*/mobile/` → `mobile.md` + `testing.md`
- `apps/*/design/` → `design.md` + `design-studio.md` + `design-workflow.md` + `frontend.md` + `per-app-ui.md` + `testing.md`
- `packages/*/ui/` → `per-app-ui.md` (per-app UI package token contract)
- `packages/*/db/` → `ddd.md` + `testing.md`
- `packages/*/client/` → `api.md` + `testing.md`

When in doubt, load all patterns. The cost of having extra context is much lower than the cost of missing a pattern violation.

## How to Load

Read each relevant pattern file with the Read tool. Pass the content to subagents, code reviewers, and implementation agents as part of their prompt context.

## App-Specific Context

In addition to patterns, load the condensed app context:
- `docs/context/apps/golf.md` — Golf app overview
- `docs/context/apps/portfolio.md` — Portfolio app overview
- `docs/context/apps/hive.md` — Hive app overview

These provide quick orientation on architecture, tech stack, and domain structure for each app.
