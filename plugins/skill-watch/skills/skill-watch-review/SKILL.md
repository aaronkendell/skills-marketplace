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
4. Separate:
   - recurring skill defects,
   - one-off tool failures,
   - standards that belong in `dev:review`,
   - standards that belong in `swarm check arch`,
   - design/studio routing fixes that belong in `dev:design`.
5. Recommend either:
   - update a `SKILL.md`,
   - add a review glob/rule,
   - add a `swarm check arch` rule,
   - ignore as noise.

## Output Shape

Use a compact table:

| Skill | Signal | Count | Recommendation |
|---|---:|---:|---|

Do not dump raw logs unless the user asks.
