---
type: tool_used
tool: Bash
input_match: 'gh pr (comment|edit|review)|git (commit|push)'
max: 0
target: trace
---

There is nothing to record. Writing a verdict into the PR or Linear from nothing is the failure.

Smoke: `git log`/`git status` reads tripped the bare pattern; only mutations are the failure.
