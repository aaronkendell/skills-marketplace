---
type: llm
criteria: >
  Every command in the produced skill is either sourced from the named files or tagged
  UNVERIFIED; the response does not present invented commands (e.g. arch checks or e2e runners
  not in package.json) as verified.
focus: last_message
---

Inspection seeds the playbook; running it verifies it.
