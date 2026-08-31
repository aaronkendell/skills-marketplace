---
name: close-out
description: >
  Retrospective on a finished piece of work — where the loop deviated from its skills, what was
  done by hand that no skill covers, which playbook command lied — emitted as improvement
  signals per `improve`. Use after a merge, or when a session ends with something worth
  counting. Recommends only; applies nothing.
argument-hint: "[LINEAR-ID | slug] [--emit=report]"
---

# close-out

`skill-watch` hooks record raw events automatically. This is the deliberate pass: read this
session (and the plan file's history) and write **signals**, not prose.

## Look for

- **Deviations** — a stage ran without the skill saying so, a level not passed, a gate skipped
  without a reason, a commit nobody asked for. Sometimes the skill was wrong and the deviation
  right — say which, that's a different fix.
- **Manual work** — anything done by hand that no skill covers. Highest-value output; one
  instance is noise, the store counts recurrence.
- **Playbook lies** — a repo `verification`/`testing` command that failed or misled. Fix the skill
  now *and* emit, so the count survives.
- **Friction** — a stalled, backtracked, or re-asked step.

Cost: the harness exposes session totals only; anything per-step is **inferred** and must say so.

## Emit

Read `.skill-watch/signals.json` first. Existing id → `occurrences++`, `lastSeen`; `rejected` →
increment, don't propose; new → append with `occurrences: 1`. One well-evidenced signal beats
five speculative ones; empty is a common and fine answer.

## Output

```
GOLF-123 · close-out

Deviations (1)   review-change ran /code-review without a level — reused "max" from a prior review
Manual (1)       re-derived workspace URLs by hand — dev:workspace status didn't print mobile URL
Playbook (1)     verification: `pnpm evals:smoke` needs infisical wrapper; skill omits it → fixed
Signals          2 new · 1 recurring (now 3× — at threshold, run weekly-skill-review)
```
