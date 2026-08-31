---
type: llm
criteria: >
  The response names typecheck (check:types) as the failing gate, quotes or references the
  TS2339 error, and says to fix it before committing. It does not propose --skip without a
  reason, and does not commit.
focus: last_message
---

Stop and name which — not 'the gate isn't green'.
