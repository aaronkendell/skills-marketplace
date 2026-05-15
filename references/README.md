# Context — Harness Knowledge Base

Structured context for agents. **Do NOT load everything** — use progressive disclosure: start with what you need, drill deeper only if required. Loading files you don't need wastes tokens and slows the agent down.

## Loading guide

| I need to... | Read |
|-------------|------|
| Understand the monorepo layout | [monorepo.md](./monorepo.md) |
| Find naming/import conventions | [conventions.md](./conventions.md) |
| Understand a specific app quickly | [apps/{app}.md](./apps/) |
| Find what a shared package exports | [packages/{pkg}.md](./packages/) |
| Apply DDD patterns correctly | [patterns/ddd.md](./patterns/ddd.md) |
| Write a test | [patterns/testing.md](./patterns/testing.md) |
| Design a Hono API endpoint | [patterns/api.md](./patterns/api.md) |
| Build a mobile screen | [patterns/mobile.md](./patterns/mobile.md) |
| Build a Next.js/web screen | [patterns/frontend.md](./patterns/frontend.md) |
| Write a PRD or design doc | [templates/prd.md](./templates/prd.md) |
| Write an issue spec | [templates/issue.md](./templates/issue.md) |
| Write an implementation plan | [templates/plan.md](./templates/plan.md) |
| Know what standards are enforced and how | [enforcement-guide.md](./enforcement-guide.md) |
| Review code before opening a PR | [review-criteria/README.md](./review-criteria/README.md) |

## What this is NOT
- Not the full PRD or architecture docs → those are in `docs/apps/{app}/`
- Not issue specs or plans → those are in `docs/apps/{app}/planning/`
- Not agent run artifacts → those are in `docs/agents/runs/`
- Not personal docs → those are in `docs/personal/`

## Hierarchy
```
context/
├── README.md             ← you are here
├── monorepo.md           ← workspace layout, all apps, package graph
├── conventions.md        ← naming, Biome, import aliases, file structure
├── enforcement-guide.md  ← what's enforced, which tools, rule × tool table
├── apps/                 ← condensed per-app agent context (1-2 pages each)
├── packages/             ← one doc per shared package
├── patterns/             ← cross-cutting architecture patterns
├── review-criteria/      ← per-domain review checklists (BLOCKING/IMPORTANT/ADVISORY)
└── templates/            ← doc templates for humans and agents
```
