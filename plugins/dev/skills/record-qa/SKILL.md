---
name: record-qa
description: >
  Write exercise-paths results where they persist — the plan file's Gate, the PR body's "How it
  was verified", a Linear comment, and for area passes docs/qa/<area>.md. Reporting only; runs
  nothing.
argument-hint: "[LINEAR-ID | slug] [--to=plan,pr,linear,qa-doc]"
---

# record-qa

Runs nothing. No results yet → say so and point at `exercise-paths`.

## Where it goes

| Target | Shape |
|---|---|
| plan file `## Gate` | `qa` checked only when every target is ✓ or explicitly accepted as a gap; device items listed until the user confirms |
| PR body `## How it was verified` | the exercise-paths block verbatim — counts, ✓/✗, handed items. Never rewritten into "tested locally" |
| Linear comment | first line is the count; open items below. On re-QA, edit the same comment |
| `docs/qa/<area>.md` (area passes) | update the "exists today" and lane tables; `[x]` `[ ]` `[~]` `[!]` — keep it honest, stale coverage claims are worse than gaps |

## Format

```
QA — GOLF-123

6 of 8 targets exercised · 1 device · 1 unreachable

✓ api      in-round-permissions.contract 6/6
✓ realtime second client converges < 1s
✗ ui       score-entry-path.yml — sim not booted
→ device   keypad blur hoist

Open: QA-1 four-device tee order — run-order.md
Cleanup: seed round ${SEED_ROUND} restored; e2e phone account removed
```

Scenarios cite the acceptance criterion they cover. Regression checks name what could break
*silently* (the flag-off path, the sibling feature on the same job). A reader of the first line
who stops there must not be misled.
