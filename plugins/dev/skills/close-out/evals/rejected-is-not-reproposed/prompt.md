---
name: "close-out: A rejected signal is incremented, never proposed again"
tags: [guardrail, improvement]
runs: 2
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob]
---

This session ran review-change twice without passing a level to /code-review. `.skill-watch/signals.json` already contains:
 ```json
 {"id":"close-out.review-change.level-not-passed","status":"rejected","occurrences":4,"reason":"user prefers the sticky level","recommendedChange":"always pass the level"}
 ```
 Run `close-out`.
