---
name: dev-ship
description: >
  Retired alias. "Ship it" is now three explicit, separately gated steps: `commit-change`
  (local gate then commit), `open-pr` (draft; `--ready` undrafts and merges on explicit asks →
  Linear Done → docs distill).
disable-model-invocation: true
---

Run `commit-change`, then `open-pr`; undraft and merge each wait for their own yes.
