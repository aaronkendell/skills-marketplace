---
name: "record-knowledge: Something the code already says is not recorded"
tags: [guardrail, knowledge]
runs: 2
max_turns: 4
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob]
---

Run `record-knowledge "fixed the null check in formatHoleScore so it returns '—' for missing scores"`.
