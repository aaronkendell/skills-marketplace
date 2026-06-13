---
name: docs
description: >
  The bokendell docs contract: where docs live, how to find the right one cheaply, when to
  update them, and how to distill planning docs on ship. Use when the user says "update the
  docs", "where does this doc go", "archive this project", "distill", "docs map", mentions
  MAP.md, or whenever creating/restructuring documentation in any bokendell repo. Also use
  when the docs-freshness hook reports stale owning docs. Spec lives at
  docs/planning/docs-context-layer/design.md in the golf repo.
---

# bokendell docs contract v1

One structure for every repo. Organized by **lifespan**: durable docs must stay true and are
guarded by the freshness hook; working docs are expected to go stale and get archived.

```
docs/
├── MAP.md            # retrieval contract — the ONLY doc loaded by default (~1k tokens)
├── product/          # WHAT (durable): prd.md, roadmap.md, business.md, features/<x>.md (as-built)
├── architecture/     # HOW (durable): overview.md + per-area docs (api.md, realtime.md, db.md…)
├── decisions/        # WHY (durable): ADR-lite, NNNN-slug.md, append-only
├── design/           # design-system docs (durable) — only apps with UI
├── runbooks/         # ops (durable)
├── planning/         # WORKING: active projects only — <project>/{README.md,design.md,issues/,mocks/}
├── research/         # WORKING: spikes, investigations
└── archive/          # shipped planning + dead artifacts — NEVER read unless explicitly asked
```

Empty dirs are dropped (library repos have no `product/`). Dirs are never renamed.

## Retrieval rules

1. Before non-trivial work, read `docs/MAP.md` (cheap, ~1k tokens). Nothing else by default.
2. Load only the docs MAP.md's task table names for your task. Grep `docs/` for anything else.
3. Treat `status: stale` docs as hints, not truth. Never read `archive/` unless asked.
4. Cross-repo patterns (DDD, API, testing…) are NOT here — they live in the skills-marketplace
   pattern docs (see the review/context-patterns skills).

## Write-back rules

1. Touched code matching an ownership-table glob → update the owning doc in the same change
   and bump its `verified:` date. (The Stop hook reminds you if you forget.)
2. New durable doc → add it to MAP.md's registry; new code area → add an ownership row.
3. Ownership rows MUST keep the machine format — one backticked glob cell + one backticked
   repo-root-relative doc cell: `` | `apps/api/**` | `docs/architecture/api.md` | ``
4. Doc frontmatter is exactly two keys: `status: current|stale|superseded` and `verified: YYYY-MM-DD`.
5. Decisions are append-only. Superseding decision links the one it replaces; old one gets
   `status: superseded`.

## Linear linkage

Repo = canon, Linear = tracker. Planning project README frontmatter carries `linear: <project-url>`;
the Linear project description's first line links to the GitHub folder. Issues link to their
`planning/<project>/issues/<KEY>.md`. No content mirroring, ever.

## Distill-on-ship (mandatory when a planning project completes)

1. Update or create the as-built `product/features/<x>.md` (template: feature-spec.md).
2. Extract 0–2 `decisions/NNNN-slug.md` entries (template: adr.md). Next NNNN = highest + 1.
3. Update MAP.md: registry rows + ownership rows for any new code areas.
4. `git mv docs/planning/<project> docs/archive/<year>/<project>`.
5. Close the loop in Linear (project done, link to the as-built spec).

## Adopting the contract in a repo (migration)

1. Copy `templates/MAP.md` to `docs/MAP.md`; fill the task table + ownership table honestly.
2. `git mv` existing docs into the contract dirs; archive don't delete.
3. Frontmatter every durable doc; anything unverified gets `status: stale` — honesty over polish.
4. Add a "Docs" pointer in the repo CLAUDE.md: "Before non-trivial work, consult `docs/MAP.md`."

Templates live in `templates/` next to this skill: MAP.md, adr.md, feature-spec.md,
planning-readme.md, runbook.md.
