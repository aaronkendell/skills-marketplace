---
type: tool_used
tool: Bash
input_match: 'git (commit|push)|gh pr'
max: 0
target: trace
---

"As far as you can" stops at the commit boundary. commit-change runs only when the user asks to commit; drive must stop and say the next step is theirs to invoke.
