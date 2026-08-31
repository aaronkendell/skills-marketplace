---
name: "draft-approach: A plan with unresolved questions stays draft"
tags: [guardrail, planning]
runs: 2
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob, Write]
---

GOLF-701: "Spectators should be able to react to a live hole score." Acceptance criteria say only that. Nothing in the repo or docs says whether reactions persist, whether the scorer is notified, or whether spectators need an account.
 Run `draft-approach GOLF-701` and write the plan file.
