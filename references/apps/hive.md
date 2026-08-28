# Agents — Agent Context

**Status:** Active | **Linear:** AGENTS | **Stack:** Hono + oRPC, Mastra, Inngest, Drizzle, Neon

## What it does
Autonomous agent platform with two planes: **Swarm** (coding agents dispatched to Linear issues in git worktrees) and **Runtime** (Mastra agents for daily life tasks — health, finance, goals, projects). Includes a Discord bot, an Inngest app for async work, and a Next.js web app.

## Key file locations
- API + swarm orchestrator: `apps/api/src/`
- Web app: `apps/app/src/` · Discord bot: `apps/discord/src/`
- Async jobs: `apps/inngest/src/` · Workers: `apps/workers/src/`
- Business logic: `packages/domains/src/packages/`
  - `swarm/` — orchestrator, dispatcher, Linear webhook handler, run tracking
  - `ai/`, `agent-runs/`, `agent-actions/`, `agent-artifacts/` — Mastra agents + run tracking
  - Runtime life domains: `health/`, `nutrition/`, `sleep/`, `training/`, `workouts/`,
    `weight/`, `body/`, `health-markers/`, `financial/`, `investments/`, `goals/`,
    `projects/`, `areas/`, `reviews/`, `journal/`, `career/`, `contacts/`,
    `family-events/`, `lists/`, `inbox/`, `spirituality/`, `integrations/`

## Key packages
- `@bokendell/hive-domains` — all agent business logic (DDD)

## Patterns used
- Full DDD
- Mastra for AI agent orchestration (tools, memory, workflows)
- Inngest for scheduled Mastra workflows
- oRPC + SSE for streaming agent output to UI
- Linear webhook → swarm dispatch pipeline
- MCPClient (HTTP/SSE transport) for MCP tool access
- Vault write policy: `safe_write` (agent artifacts) / `pr_required` (docs) / `blocked` (CLAUDE.md, source code)

## Where to go for more
- [Full docs](../../apps/hive/)
- [System landscape](../../agents/landscape.md)
- [Vault write policy](../../apps/hive/system/vault-write-policy.md)
- [Current work](../../apps/hive/planning/)
