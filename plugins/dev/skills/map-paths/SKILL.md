---
name: map-paths
description: >
  Enumerate every reachable path a change touches — unit, integration, API contract, authz both
  directions, realtime, jobs, DB, UI journey, device-only — and what already covers each.
  Documents only; runs nothing. Use before exercise-paths; the split is what keeps gaps visible.
argument-hint: "[LINEAR-ID | slug] [--include=api,db,...]"
---

# map-paths

Works out **what could be tested** and **what already is**. Produces a map. Runs nothing.

The split from `exercise-paths` is deliberate: one pass enumerates, another runs against that
list. A single pass doing both quietly narrows the list to what it already knows how to run.

## Read first

- the repo's `testing` skill (lanes and how each is run) and `verification` skill ("changed X →
  run Y") — **if missing, stop and offer `onboard`**
- the QA area doc for this surface (`docs/qa/<area>.md`) — its lane tables are the seed
- the diff, the plan's acceptance criteria, `consult-knowledge` for semantics

Every concrete command in the map comes from those files, not from this skill.

## Target classes — say how it's reached, or why it doesn't apply

| Class | Means |
|---|---|
| `unit` | co-located vitest, filtered to touched code — **exact counts** |
| `integration` | Testcontainers: repos, transactions, what a write leaves alone |
| `api` | contract spec against the live workspace: envelope, typed errors |
| `authz` | same call as the wrong principal → denial. **Both directions or it isn't verified** |
| `realtime` | publish AND durable append observed on a second client / via `rounds.live` |
| `job` | Inngest function triggered out of band; its run record and log line |
| `db` | direct read of the owning tables, including the join the feature depends on |
| `eval` | AI prompt/tool changes: `evals:smoke`, the turn-router corpus |
| `ui` | Maestro journey on an isolated sim — only if the repo has mobile/web e2e. Where the repo has a **feature map** (`.claude/feature-map.json`: feature → nav path → selectors → owning files), take the reach from it instead of guessing |
| `device` | what only eyes/hands catch: blur, haptics, glass, multi-device convergence |
| `arch` | `swarm check arch` on changed files |

"Doesn't apply" is an answer; silence is not. Never emit a class the repo can't run.

Fixtures as named variables (`${QA_PHONE}`, `${SEED_ROUND}`), never literal ids.

## Output — into the plan file (or `docs/qa/passes/` for an area pass)

```yaml
targets:
  - class: api
    what: rounds.live for an invite-only round as a non-member
    reach: "pnpm --filter @bokendell/golf-e2e-api e2e:with-secrets -- in-round-permissions"
    expect: "403 typed error, not 500"
    covered_by: [contract spec]
  - class: device
    what: keypad blur hoist on score commit
    reach: "phone, in-round-qa workspace"
    expect: "keyboard dismisses before the sheet closes"
    covered_by: []
not_reachable:
  - what: four-device tee-order convergence
    why: "needs 4 signed-in devices; run-order.md item"
```

A target with no `expect` isn't testable, it's a hope — work out the expectation or move it to
`not_reachable` with a reason. Unit/lint/types are recorded under `covered_by`, not listed as
targets — the gate already runs them. A one-line diff with one unit target says so plainly.
