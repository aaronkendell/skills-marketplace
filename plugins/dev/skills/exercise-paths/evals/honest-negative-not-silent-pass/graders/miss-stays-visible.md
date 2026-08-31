---
type: regex
pattern: "✗|SKIPPED|not exercised|unreachable"
match: contains
target: last_message
---

The missed target stays in the list, marked, rather than being omitted.
