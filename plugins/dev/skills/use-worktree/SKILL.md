---
name: use-worktree
description: >
  Create, list, and prune git worktrees under `<repo>/.worktrees/<name>`, and bind a swarm
  workspace (own Neon branch + tunnels) to one when the work needs a live stack. Owns the
  protocol; the repo's `dev:workspace` and `verification` skills own the commands.
argument-hint: "create <name> | list | prune"
---

# use-worktree

Stack binding here is **parallel**: every worktree can own a `swarm workspace` with its own DB
branch and tunnel URLs, so there is no global lock and no registry — `git worktree list` plus
`pnpm swarm workspace status` is the truth.

## create

```bash
git fetch origin
git worktree add .worktrees/<name> -b bokendell/<name> origin/main
cd .worktrees/<name> && pnpm install --prefer-offline
```

Bootstrap is not optional: a fresh worktree is missing everything gitignored and the failures
are confusing, not loud (a missing `.env.workspace` falls through to *another* workspace's env).
Build deps the repo's `verification` skill names (`golf-api` contract dist, tokens) before trusting
any typecheck.

## Binding a live stack

Only when a target genuinely needs the running app (API e2e, Maestro, SSE). Then, from the
worktree root, **one** `pnpm swarm workspace dev` invocation listing every app you need — a
second invocation replaces the first. Details and URLs: `dev:workspace`.

## Traps (each has cost a session)

- **Index clash** — every new golf workspace may allocate port 3110; the simulator then loads a
  *sibling* worktree's bundle through the tunnel. Set `EXPO_PACKAGER_PROXY_URL` to `127.0.0.1`
  and check `workspace status` before believing a device run.
- **`swarm db migrate` resolves to the workspace of the *main* checkout** — run migrations from
  main, not the worktree.
- **Never kill cloudflared** — one connector serves every workspace; killing it is a 1033 for all.
- **Shared stash stack** — never bare `git stash` / `pop`.
- **Sibling sessions' typecheck errors** show up in yours — filter output to your paths.

## prune

Safe only when: no uncommitted work, no unpushed commits, *and* the branch content is on main
(`git branch --contains` / `git cherry` — after a squash-merge `@{u}..` lies in both directions).
A branch with no upstream at all: ask. `pnpm swarm workspace stop` first; `destroy` only on
explicit ask (it deletes the Neon branch).
