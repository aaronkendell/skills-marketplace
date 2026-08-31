---
name: dev
description: >
  Compatibility entry point. `/dev`, `/dev build`, `/dev <LINEAR-ID>` route to `drive`;
  `/dev research` → `dev-research`; `/dev plan` → `dev-plan`; `/dev ship` → `commit-change`,
  `open-pr`. Use at the start of any substantive dev task.
disable-model-invocation: true
---

# dev → drive

| Typed | Now |
|---|---|
| `/dev`, `/dev build <ID>`, `/dev <ID>` | `drive` |
| `/dev research <app> <idea>` | `dev-research` |
| `/dev plan <app> [path]` | `dev-plan` |
| `/dev ship` | `commit-change` → `open-pr` (draft) |

Load `drive` and follow it. Per-repo facts live in each repo's `.claude/skills/` — this router
carries none.
