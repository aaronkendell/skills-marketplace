---
name: consult-knowledge
description: >
  Surface what already governs a piece of work before designing it — the repo's docs map,
  decision records, product journeys, and the memories that apply. Use at plan time (there is no
  file yet for auto-loading to anchor on) and at review time to load the rubric. Reads only.
argument-hint: "<topic | path> [--for-review]"
---

# consult-knowledge

Repo skills auto-load on file paths. Planning has no file yet, so this is the step that loads
the rules by hand.

## Sources, in weight order

| Source | Read as |
|---|---|
| `docs/MAP.md` task table → the named docs | **binding** — architecture, contracts, the "why" |
| `docs/decisions/*.md` | **binding on intent** — a settled choice; superseded, never re-argued in a review |
| `<repo>/.claude/skills/*` for the area | binding conventions and traps |
| `docs/product/journeys/*`, `docs/product/features/*` | the behaviour being changed |
| `references/patterns/*.md` (marketplace) | only where the repo has no skill for the area |
| auto-memory (`MEMORY.md` pointers) | advisory; verify anything it names still exists |
| `docs/planning/<project>/` | active work — may be stale; check `status:` |

## Output — cite, don't summarise

```yaml
binding:
  - docs/architecture/api.md: "contract-first; schemas come from the domain, not the router"
  - docs/decisions/0009-round-events.md: "round state is an append-only event log + projection"
conventions:
  - .claude/skills/realtime-events: "publish AND durable-append; one alone is silent"
open:
  - "nothing records how spectators are rate-limited — genuinely unspecified"
```

**Unspecified is a result**, not a failure. Never fill a gap with "best practice" — a fabricated
constraint sitting among real citations acquires their authority.

## `--for-review`

The rubric for `review-change`: a finding cites a doc, a decision, a repo skill, an arch rule,
or a reproducible defect — or it's an opinion and is dropped. Decisions also do the inverse job:
check one before flagging a deliberate choice as a mistake.

## Boundaries

Reads only; `record-knowledge` writes. Don't re-load what a hook already surfaced this session.
