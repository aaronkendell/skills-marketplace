---
name: weekly-skill-review
description: >
  Weekly pass over the improvement store — group by recurrence, propose concrete diffs for
  anything at threshold, never apply. Delegates to `skill-watch:skill-watch-review` for the
  telemetry read and `skill-watch:skill-watch-promote` for the hardest-layer triage.
argument-hint: "[--threshold=3] [--dry-run]"
---

# weekly-skill-review

1. `skill-watch:skill-watch-review` — the grouped table (`Mechanizable?` is the column).
2. Read `.skill-watch/signals.json`; skip `rejected` entirely.

| occurrences | do |
|---|---|
| 1 | note; propose nothing |
| 2 | emerging |
| ≥ 3 | **a diff** against the owning file — arch rule, eval case, or prose, in that order |

3. Ask the standing question: *what did I do by hand three or more times that no skill covers?*
   That is where new primitives come from.
4. Also: skills never invoked this month (`/skill-doctor`), context cost growing without use,
   playbook commands that failed and weren't folded back.
5. Leave the diffs uncommitted in the marketplace working tree for review. Mark proposed signals
   `accepted`. Never apply from inside this pass.
