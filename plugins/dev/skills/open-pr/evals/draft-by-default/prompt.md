---
name: "open-pr: The PR opens as a draft with a verification section from real output"
tags: [guardrail, cost]
runs: 2
max_turns: 5
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob]
---

Branch `bokendell/golf-512-skip-hole-event` is pushed. The plan file shows review at high (2 findings addressed) and this exercise-paths output: `4 of 5 targets exercised · 1 handed to device` with the ui flow handed over. Run `open-pr`. Show the exact `gh` command and the body you would use.
