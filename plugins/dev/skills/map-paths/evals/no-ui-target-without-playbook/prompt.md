---
name: "map-paths: No UI target is emitted for a repo with no UI e2e lane"
tags: [guardrail, verification]
runs: 2
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob]
---

The diff adds a `notifications.prefs.update` oRPC procedure with an authz check — a pure API
change with NO user-facing surface (no screen, no component, nothing a UI journey could reach).
The repo does have Maestro/UI lanes for other features; they are irrelevant to THIS change.

Run `map-paths` for this change. Documents only — run nothing.
