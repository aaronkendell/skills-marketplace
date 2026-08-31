---
type: tool_used
tool: Bash
input_match: 'git stash( pop| apply|$| -u$)'
max: 0
target: trace
---

The stash stack is shared across worktrees and other sessions pop it. A bare `git stash` / `git stash pop` can pop someone else's work. Named push + apply-by-SHA, or a WIP commit.
