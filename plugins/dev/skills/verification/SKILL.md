---
name: verification
description: >
  The verification loop for any app change — pick the cheapest check that would
  catch this change breaking, run it, and LOOK at the result. Triggers when the
  user says "verify this", "prove it works", "run the verification loop", after
  any non-trivial change, and ALWAYS before declaring a feature done.
---

# Verify — the loop, not the vibe

An unverified change is a guess. Every change gets the cheapest loop that would
actually catch it breaking. "It compiles" is not a lane.

**The exact commands are per-repo.** Read the repo's own `verification` skill for its
"I changed X → run Y" table; this skill is the reasoning around it. If a repo has no
verification skill, its `package.json` scripts and lefthook config are the next best
source, and writing that skill is worth doing while the knowledge is fresh.

## Pick the lane (cheapest that bites)

| The change is… | Lane |
|---|---|
| Pure logic (utils, math, reducers) | co-located unit test |
| Service + DB (repos, transactions, async jobs) | integration test (Testcontainers) |
| Wire contract (authz, typed errors, response shape) | API e2e against a LIVE workspace, not a mock |
| A user journey (taps, sheets, deep links, funnels) | UI flow on an isolated device/sim |
| Layout, material, copy — anything eyes judge | run it, screenshot it, LOOK at it |
| Cross-cutting invariants | the arch rules — `swarm check arch --affected` |

Static floor for EVERY batch: typecheck (affected filters) + `biome check` + the arch
rules. These take seconds; there is no excuse to skip them.

A bug a human found earns a regression test in the cheapest lane that would have
caught it. If no lane would have, that is the finding.

## Order

Deterministic gates first (free, instant), tests second, device/real-request pass
last. Hooks and CI run the equivalent — `--no-verify` on commits is fine, but then
YOU are the gate, so run them by hand.

Several checks print warnings on a passing run. Where a command reports structured
output, grep for the success marker (`{"ok": true}`), never for the absence of output.

## Traps that make checks lie

These are repo-independent and cost real debugging loops:

- **Stale dist builds are the #1 phantom failure.** Contract and router types are
  dist-only exports, so a "missing" endpoint or procedure client-side is usually a
  build that didn't run. Rebuild the package the consumer types against before
  believing the error.
- **Another agent's in-flight errors.** Worktrees are shared — filter typecheck
  output to YOUR paths before concluding you broke something.
- **Formatting a file that doesn't parse can corrupt it.** Typecheck first, format
  second.
- **Integration tests need Docker up.** A hang at startup is usually Testcontainers
  pulling an image, not a deadlock.
- **Two databases.** Scripts resolving env through Infisical and migrations resolving
  to a workspace branch are not always the same database. "Column does not exist"
  right after "migrations are up to date" means you checked one and wrote the other.
- **Don't edit source while a long sweep runs.** A watch rebuild rotates dist chunk
  names and lazy dynamic imports crash mid-run with `ERR_MODULE_NOT_FOUND` — the
  results are then invalid, not merely noisy.

## Look at it

For anything visual the loop is not complete until you have LOOKED — inspect the tree
for the truth of the structure, screenshot for the truth of the pixels, compare
against the repo's design law. Then send the screenshot to the user *with the claim
you are making about it*.

## Done means

State what ran and what it proved, plainly: "flow X green end to end, types 22/22,
arch clean, screenshot attached" — or the failure output, unhedged. If a check was
skipped, say which and why. Staged, never committed unless asked.
