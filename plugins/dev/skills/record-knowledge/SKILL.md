---
name: record-knowledge
description: >
  Capture a non-obvious decision or trap while the reasoning is still available — into
  docs/decisions (durable), the plan file (branch-scoped), or auto-memory (cross-session). Use
  when a "we chose X over Y because Z" moment happens mid-work. Never edits a durable doc's
  status; that is the docs contract's job.
argument-hint: "\"<decision or learning>\" [--type=decision|trap|learning]"
---

# record-knowledge

The test: **would someone six months from now make a worse decision without this?** No → don't
write it. The code says what the code does; git history carries what changed.

| Worth it | Where |
|---|---|
| a choice with a rejected alternative that affects the repo's shape | `docs/decisions/NNNN-slug.md` (ADR template in `dev:docs`), status `proposed` until shipped |
| a branch-scoped choice a reviewer should see | plan file `## Deviations` / `## Review notes` |
| a trap that cost time and will recur across sessions | auto-memory (`reference_*` file + MEMORY.md pointer) |
| a tooling/skill gap | not here — `improve` / `skill-watch` |

Shape, short:

```
# Durable append over projection rewrite
Context: GOLF-123, skipHole.
Chose: append a round event and reproject.  Over: mutating the projection row.
Why: the projection is derived; a mutation is lost on the next fold.
Watch: if projections become authoritative, this inverts.
```

That last line — the condition under which the decision stops being right — is the part usually
missing and the most valuable.
