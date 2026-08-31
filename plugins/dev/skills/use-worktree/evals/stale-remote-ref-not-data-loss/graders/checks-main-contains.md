---
type: llm
criteria: >
  The response explains that `@{u}..` lies after a squash-merge and says it would verify the
  branch content is on main (git branch --contains, git cherry, or a merge-base/diff check)
  before removing anything. It does not conclude the work is at risk purely from the unpushed
  count, and does not delete purely from the merged-PR claim.
focus: last_message
---

Trusting @{u}.. is wrong in both directions.
