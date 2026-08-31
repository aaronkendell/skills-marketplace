---
name: draft-approach
description: >
  Grill the requirement, load constraints, write the technical notes with receipts, and lock a
  plan into the branch's plan file. Use for any medium/high-band work before implementing.
  Refuses to lock while an open question remains.
argument-hint: "<LINEAR-ID | slug> [--grill=light|hard] [--options=N]"
---

# draft-approach

The stage to be strict about. A plan locked over an unexamined assumption costs more than the
time saved by not asking.

## 1 · Find the design doc first

Check the Linear issue for a link, then `docs/planning/<initiative>/design.md`, then ask once:
*"Is there a spec or design doc for this?"* Record `inputs.asked: true` in the plan file so no
later session re-asks. A design doc is the authority — extend it, never re-derive it or quietly
diverge; a needed departure is a question **before** the lock.

## 2 · Load constraints

`consult-knowledge <area>`. Cite by path in the plan. If nothing governs the topic, say the design
is unconstrained by recorded policy — don't invent rules.

## 3 · Grill (asking, not answering on the user's behalf)

Hard by default above `low`. Work through: is the ticket asking for the right thing · what it
doesn't say (missing acceptance = a question, not a gap to fill) · does it reproduce at all · edges
(empty, huge, concurrent, already-exists, denied, partially-migrated) · failure and recovery ·
contradictions with a decision · **explicit out-of-scope**.

Ask the real questions in one batch. Stop and wait. **An assumption recorded as a fact is the
failure this step exists to prevent** — a plan that quietly resolves every ambiguity reads as
confident and is a set of guesses. Implementation-preference questions ("X or Y?") while the
problem is still undefined are the failure wearing the costume of the fix.

Structured decisions get a diagram or a mock, not prose — see `dev:design` "mock-first".

## 4 · Technical notes with receipts — the primary output

One named approach, where **every claim about existing code names the file/function and states
what was verified**:

> Extend `RoundService.recordHoleScore` (packages/domains/.../round.service.ts:212) — it already
> publishes AND appends (verified: both calls present). The `skipHole` path does not append —
> verified by grep of `appendRoundEvent` callers — so step 2 adds that.

Superseded approaches are one line naming what they replace. `--options=N` for a genuinely open
decision only: a table with a **"what it forecloses"** row.

## 5 · Keep in mind — accepted risks, out loud

Risks accepted explicitly, out-of-scope named. Stating it converts a review finding into a decision.

## 6 · Steps, sized

Numbered, each independently committable, each leaving the tree green, each naming its test lane
from the repo's `testing` skill. Size is not a gate — if the work is clearly several PRs, say so
here and let the user pick the split.

## 7 · Write and lock — conditionally

Write to `docs/planning/<initiative>/<ID>-plan.md` (marketplace `references/templates/plan.md`):
notes, risks, steps, `## Gate` unchecked, `## Deviations` empty.

**Open questions outstanding → `status: draft`, and stop.** On the user's approval →
`status: locked`. The implementer works from the locked plan; changes go to `## Deviations` with a
reason, which surfaces in the PR body.

## Skip it entirely when

`drive` banded it `low`. Say so and hand back rather than performing ceremony.
