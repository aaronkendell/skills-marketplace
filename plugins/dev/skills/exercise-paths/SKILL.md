---
name: exercise-paths
description: >
  Run the map — tests, API calls, jobs, DB reads, Maestro flows — and report hit/miss per target
  with the misses left in the denominator. Hands device-only targets to the user as a checklist.
  The QA stage; wraps `dev:verification` and the repo's verification skill.
argument-hint: "[--only=api,ui] [--map=<path>]"
---

# exercise-paths

Takes the map and runs it for real. Reports what was actually exercised against what was
supposed to be, so gaps are explicit rather than absent.

## Before running

- **Read the map.** None → run `map-paths` first. Don't improvise a target list.
- Commands come from the repo's `verification` skill and `dev:verification`'s lane table.
- Live-stack targets need the worktree's own `swarm workspace` (`use-worktree`). Check
  `workspace status` before trusting a device or e2e result — the index-clash trap serves a
  sibling's bundle.
- Credentials via Infisical / `.env.workspace`, never inlined into a command you will paste.

## Running

For each target: run `reach` exactly · compare to `expect` · record **what happened**, not what should have.

```
✓ api      in-round-permissions.contract — 6/6, 403 typed on invite-only
✓ unit     game-capture capture-inputs — 14 tests, 41 assertions
✓ realtime second client sees hole 7 within 1s via rounds.live
✗ ui       score-entry-path.yml — SKIPPED, sim not booted; target not exercised
→ device   keypad blur hoist — handed to user
```

- **A skipped target is ✗ and stays in the count.** Dropping it is how a gap disappears and the
  report looks complete.
- **Failing ≠ unreachable.** Failing → the change is wrong, stop and fix. Unreachable → the
  environment is incomplete, nobody knows, and the PR must say so. Opposite responses.
- Exact counts, never "tests pass".
- Fixed something? Re-run before reporting green.
- **Never report a target hit unless you ran it and saw the result.** An inferred pass stops
  anyone else from checking.
- AI eval targets: record model + pass rate, not a checkmark; they bill.

## Driving the running app

Where the repo has a `control` skill (golf: bring the app up, navigate, screenshot, read the
console) and a `.claude/feature-map.json`, use them — exercising a UI target means driving the
app, not reading the component. A repo without them gets a `→ handed` device item, and `onboard`
should add them.

## Device targets

You cannot tap a phone. Emit them as a checklist with the workspace URLs and exactly what to look
for; they are `→ handed` in the count, not ✓, until the user reports back. Anything visual you
*can* screenshot on the sim: screenshot it and send it with the claim you're making.

## Cleanup — reported as done

Seeded rows, flipped flags, temp accounts, workspace state: restore and say so. An uncleaned
fixture is the next session's confusing failure, and it will look like a code bug.

## Output

```
6 of 8 targets exercised · 1 handed to device · 1 unreachable
```

Then `record-qa` writes it into the plan file's `## Gate`, the PR body, and Linear.
