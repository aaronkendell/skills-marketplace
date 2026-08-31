---
name: "open-branch: A dirty tree is protected without a bare git stash"
tags: [guardrail, worktrees]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob]
---

The working tree has uncommitted edits in two files and an untracked scratch file. Start work on GOLF-640 ("wolf capture row: tee-order pill"). Show the commands you will run.
