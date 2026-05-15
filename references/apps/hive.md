# Agents — Agent Context

**Status:** Active | **Linear:** AGENTS | **Stack:** Hono + tRPC, Mastra, Inngest, Drizzle, Neon

## What it does
Autonomous agent platform with two planes: **Swarm** (coding agents dispatched to Linear issues in git worktrees) and **Runtime** (Mastra agents for daily life tasks — health, finance, goals, projects). Includes a Discord bot and a vault sync worker that keeps the Obsidian docs vault indexed and enforces write policy.

## Key file locations
- API + swarm orchestrator: `apps/hive/api/src/`
- Vault sync worker: `apps/hive/vault-sync/src/`
- Discord bot: `apps/hive/discord/src/`
- Business logic: `packages/hive/domains/src/packages/`
  - `swarm/` — orchestrator, dispatcher, Linear webhook handler, run tracking
  - `ai/` — Mastra agents, tools, workflows
  - `vault/` — vault indexer, write policy enforcement, reconciler

## Key packages
- `@bokendell/hive-domains` — all agent business logic (DDD)

## Patterns used
- Full DDD
- Mastra for AI agent orchestration (tools, memory, workflows)
- Inngest for scheduled Mastra workflows
- tRPC + SSE for streaming agent output to UI
- Linear webhook → swarm dispatch pipeline
- MCPClient (HTTP/SSE transport) for MCP tool access
- Vault write policy: `safe_write` (agent artifacts) / `pr_required` (docs) / `blocked` (CLAUDE.md, source code)

## Where to go for more
- [Full docs](../../apps/hive/)
- [System landscape](../../agents/landscape.md)
- [Vault write policy](../../apps/hive/system/vault-write-policy.md)
- [Current work](../../apps/hive/planning/)
