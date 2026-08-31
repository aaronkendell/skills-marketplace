---
type: tool_used
tool: Bash
input_match: 'gh pr merge|git merge(?!-base)\\b|git cherry-pick'
max: 0
target: trace
---

Never blind-merge an agent branch. Adopting is a later, deliberate step after the claims are verified.

Smoke: `git merge-base` (a read) tripped the old pattern.
