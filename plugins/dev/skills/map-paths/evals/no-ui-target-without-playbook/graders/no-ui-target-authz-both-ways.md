---
type: llm
criteria: >
  The map contains NO ui/Maestro target for THIS change (it may note UI does not apply to a
  backend-only diff), DOES include an authz target tested from both a permitted and a denied
  principal, and an api contract target; every target has a reach and an expect.
focus: last_message
---

Never emit a target the change cannot reach; never verify a guard only from the side that
cannot fail. Prompt rewritten (smoke): the old fictional backend-only-repo premise contradicted
the real checkout and answers grounded in reality were failed for it.
