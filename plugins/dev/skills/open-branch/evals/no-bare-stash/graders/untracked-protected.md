---
type: llm
criteria: >
  The response either makes a WIP commit or uses `git stash push -u -m <tag>` (with the -u
  flag and a message) and describes restoring by SHA/tag, not by `pop`. It must mention the
  untracked file being protected.
focus: last_message
---

Untracked files are the ones that vanish silently.
