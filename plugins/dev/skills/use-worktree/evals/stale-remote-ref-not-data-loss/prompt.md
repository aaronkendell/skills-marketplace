---
name: "use-worktree: An unpushed-commits count after a squash-merge is checked against main before pruning"
tags: [guardrail, worktrees]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob]
---

`.worktrees/golf-488` is on branch `bokendell/golf-488-share-og`. `git log @{u}..` shows 3 commits. The PR for it was squash-merged to main yesterday and the remote branch was deleted. Run `use-worktree prune`.
