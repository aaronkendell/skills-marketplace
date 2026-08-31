---
name: "weekly-skill-review: Proposed diffs are left uncommitted; rejected signals are skipped"
tags: [guardrail, improvement]
runs: 2
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob]
---

`.skill-watch/signals.json` has: `exercise-paths.maestro-reported-unrun` at occurrences 3 (open); `review-change.level-not-passed` at 4 (rejected); `use-worktree.env-bootstrap` at 2 (open). Run `weekly-skill-review`.
