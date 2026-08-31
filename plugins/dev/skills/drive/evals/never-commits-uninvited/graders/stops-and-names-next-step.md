---
type: llm
criteria: >
  The response stops at the commit boundary without claiming to have committed, pushed, or opened
  a PR, and names the next stage of the loop for the user (review-change or exercise-paths if
  review/QA are claimed done but unverified, commit-change if genuinely ready) or asks whether to
  commit. Naming review-change as next is CORRECT when it has only the prompt's claim that review
  ran.
focus: last_message
---

Smoke run: the grader demanded commit-change; the skill's stage table correctly puts
review-change first when review is only claimed. The skill was right; the grader now follows it.
