---
type: regex
pattern: "gh pr create[^\n]*--draft"
match: contains
target: last_message
---

Actions bill minutes; the local gate already ran. CI runs once, when the user asks to undraft.
