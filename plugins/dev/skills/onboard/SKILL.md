---
name: onboard
description: >
  Teach the dev loop how a repo works by writing (or repairing) its playbooks — the repo-local
  skills that drive, map-paths, exercise-paths, commit-change and use-worktree read. Use when
  entering a repo with no `.claude/skills/verification`, or when a primitive says a playbook
  command is missing or wrong.
argument-hint: "[repo path] [--only=verification,testing,access,worktree]"
---

# onboard

The marketplace owns the protocol; each repo declares its implementation. A playbook here is a
**repo-local skill** under `<repo>/.claude/skills/<name>/SKILL.md` — it auto-loads by path in
Claude Code and Cursor alike, which is why it isn't a separate `playbooks/` directory.

## Required playbooks

| Skill | Read by | Carries |
|---|---|---|
| `verification` | `exercise-paths`, `commit-change`, `open-pr` | "changed X → run Y" table, the gate commands (lefthook / `ci-local` equivalents), the traps that make checks lie |
| `testing` | implement, `map-paths` | which lane a change needs, how each lane is run, harness limits |

## Optional (only where the thing exists)

| Skill | When |
|---|---|
| `access` | seeded accounts, how a token is minted, what must be running — names env vars, never values |
| `cross-repo` | consumers of this repo and how to run the far side |
| `worktree` | only if the repo's worktree/stack story differs from `dev:workspace` |
| `control` + `.claude/feature-map.json` | where a UI exists: how an agent brings the app up, navigates, screenshots; the map of feature → nav path → selectors → owning files (golf has both; `feature-map-refresh` workflow keeps the map honest) |
| domain skills (`api-endpoint`, `db-change`, …) | as the repo accumulates them |

Absence is an answer: no `frontend` playbook means `map-paths` emits no UI target.

## Interview, then verify, then write

1. **Inspect** — `package.json` scripts, `lefthook.yml`, `.cicd.yml`, CI workflows, existing
   `.claude/skills/`, `docs/MAP.md`. Propose from what's on disk.
2. **Ask** the user to confirm each command — inspection seeds the questions, it doesn't answer them.
3. **Run every command you are about to record.** A playbook of plausible commands that fail costs
   the next agent a debugging session and then permanent distrust. Anything you could not run is
   tagged inline: `# UNVERIFIED — inferred from lefthook.yml, not run`.
4. Write the skill. End it with a **Traps** section — gotchas, what not to run from a worktree,
   commands that look right and aren't. That section is the point.

## Reuse before writing

golf's `verification` and `testing` skills are the reference shape. Copy the structure, not the
commands. Check `dev:ci-local` and `dev:workspace` first — most repos need four lines pointing at
those plus a Traps block, and that is the ideal outcome.

## Regression

When a verified playbook command later fails, don't work around it: fix the skill in the same
session and let `skill-watch` record the deviation so recurrence gets counted.
