---
name: skill-watch-review
description: >
  Use when reviewing recent skill-watch logs, missed skill activations, hook output,
  recurring deviations, or whether standards should be added to dev/review/design skills.
---

# Skill Watch Review

Review `.skill-watch/events.jsonl` and turn noisy hook telemetry into specific, useful actions.

## Workflow

1. Locate the marketplace root:
   - Prefer `SKILL_WATCH_MARKETPLACE_ROOT`.
   - Otherwise use `~/repos/bokendell/skills-marketplace`.
2. Read `.skill-watch/events.jsonl`.
3. Group by `skill + key`.
   - `type: "deviation"` — something went wrong that no rule caught. These are the
     new-rule candidates.
   - `type: "signal"` with key `arch-violation:<rule>` — an EXISTING arch rule fired.
     Opposite meaning: the mechanism worked and the code drifted past it anyway. The
     action is to fix the code, escalate the rule `warn` -> `error`, or fix the canonical
     example agents keep copying. Never "write more prose about it" — the rule exists.
   - `arch-check-used` is a positive signal (the check ran). Not a finding; ignore it.
4. Separate:
   - recurring skill defects,
   - one-off tool failures,
   - standards that belong in `dev:review`,
   - standards that belong in `swarm check arch`,
   - design/studio routing fixes that belong in `dev:design`.
5. Recommend a target, running the triage test in `skill-watch-promote` — hardest layer
   that can hold the lesson wins:
   - a `swarm check arch` rule (default for anything structurally detectable),
   - a type/schema change that makes the deviation unrepresentable,
   - a fix to the canonical example agents copy,
   - update a `SKILL.md` (last resort — say why it could not be mechanized),
   - ignore as noise.

## Output Shape

Use a compact table. `Mechanizable?` is the important column — it is the difference between
a lesson that holds and a paragraph nobody reads.

| Skill | Signal | Count | Mechanizable? | Recommendation |
|---|---:|---:|---|---|

Anything with a count of 3+ and `Mechanizable? yes` is an arch-rule candidate, not a
docs edit. Say so explicitly in the recommendation.

Do not dump raw logs unless the user asks.
