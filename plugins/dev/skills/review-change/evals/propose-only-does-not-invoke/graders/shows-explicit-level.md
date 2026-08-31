---
type: regex
pattern: "/code-review[^\n]*(low|medium|high|xhigh|max)"
match: contains
target: last_message
---

The proposal must be a concrete invocation with an explicit level. /code-review reuses the last typed level otherwise — silently.
