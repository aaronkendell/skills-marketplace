---
name: open-branch
description: >
  Start a piece of work — branch (in a worktree by default), Linear moved to In Progress, plan
  file seeded for medium+ bands. Use when beginning a ticket or a named one-off. No ticket
  required; a slug is enough.
argument-hint: "<LINEAR-ID | slug> [--no-worktree] [--from=<base>]"
---

# open-branch

## 1 · Name it

```
bokendell/<linear-id-lowercase>-<kebab-title>     # ticketed:  bokendell/golf-123-score-editing
bokendell/<kebab-slug>                           # one-off:   bokendell/fix-keypad-blur
```

Lowercase, hyphens, ≤ 50 chars at a word boundary. The Linear ID (if any) is what `commit-change`
and `open-pr` derive the issue from — get it into the branch name.

## 2 · Protect the tree

`git status --porcelain`. Dirty? Prefer a WIP commit on the current branch. If you must stash,
`git stash push -u -m "<unique-tag>"` and record the SHA — the stash stack is shared across
worktrees and other sessions pop it.

## 3 · Create

Worktree by default via `use-worktree create <name>` (branches from `origin/main` after a fetch —
check the repo's default branch, it differs). `--no-worktree` branches in place; **say which
happened**, a session that thinks it's in a worktree and isn't tests the wrong code.

## 4 · Linear

Ticketed work: `get_issue`, then move to **In Progress** by matching the status *name*. If it's
already past In Progress, say so and ask before moving it backward. One-offs: skip, and say so.

## 5 · Seed the plan file (medium+ only)

`docs/planning/<initiative>/<ID>-plan.md` from the marketplace plan template — status `draft`,
`## Gate` all unchecked. This is the state file: any session, local or cloud, reads it and knows
where the work stands. Low band gets no file.

## Report

Branch, worktree path (or "in place"), Linear transition (or "no ticket"), plan file path.
