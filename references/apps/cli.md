# CLI — Agent Context

**Status:** Active | **Linear:** MISC | **Stack:** TypeScript, custom CLI framework, Infisical, Turbo

## What it does
Monorepo developer CLI invoked as `pnpm swarm`. Centralizes all dev tooling: database management, secrets, Neon branches, R2 storage, auth schema generation, audio transcription, Docker orchestration, Vercel deployments, Inngest job management, and local environment setup. The cockpit command launches a full tmux/iTerm development environment.

## Key file locations
- CLI package: `packages/shared/cli/src/`
- Commands: `packages/shared/cli/src/commands/`
- Shared libs: `packages/shared/cli/src/lib/` (console, env, filesystem, infisical, orchestration, prompts, subprocess, tui, turbo)
- Scaffolding templates: `packages/shared/cli/src/packages/create/`

## Command groups

| Group | Commands | What it does |
|-------|----------|-------------|
| `auth` | `generate` | Regenerate Better Auth schema |
| `cicd` | `setup`, `status` | CI/CD pipeline management |
| `cockpit` | `index`, `setup` | Launch tmux/iTerm dev environment |
| `create` | `index` | Scaffold new workspace (db-package, expo-mobile, hono-api, nextjs-app, playwright-e2e, refine-admin) |
| `db` | `migrate create/rollback/run/status`, `reset`, `seed` | Database migration management |
| `dev` | `index`, `cleanup` | Start development environment |
| `docker` | `up`, `down`, `status` | Docker Compose orchestration |
| `doctor` | — | System diagnostics (deps, env, ports) |
| `domains` | `caddyfile`, `clean`, `setup`, `status` | Local domain + SSL management |
| `graph` | — | Visualize workspace dependency graph |
| `inngest` | `dev`, `list`, `runs`, `trigger` | Inngest background job management |
| `neon` | `branches`, `connection-string`, `create-branch`, `create-database`, `databases` | Neon PostgreSQL branch management |
| `r2` | `create-bucket`, `sync` | Cloudflare R2 bucket management |
| `secrets` | `check`, `clean`, `list`, `pull` | Infisical secret management |
| `transcribe` | — | Audio transcription (Whisper) |
| `vercel` | `create`, `link`, `env pull`, `env push` | Vercel project + env management |

## Patterns used
- Custom CLI framework (not oclif) with typed command definitions
- Infisical for secrets (pull → local `.env` files)
- Turbo executor for multi-workspace commands
- Interactive TUI menus for discovery
- Subprocess execution with streaming output

## Where to go for more
- Source: `packages/shared/cli/src/`
