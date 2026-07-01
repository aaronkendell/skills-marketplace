# Skill Watch Learning Loop

The loop is observe -> classify -> group -> promote -> verify.

## Observe

Hooks collect small JSONL events. They must not block normal work unless the event is clearly a
hard policy violation handled by another hook.

## Classify

Classify by expected skill and stable recurrence key. Good keys are small:

- `missed-arch-check`
- `wrong-design-router`
- `stale-pattern-doc`
- `missing-biome-validation`

## Group

Promote only after recurrence. The default threshold is three matching deviations.

## Promote

Edits are written to the local skills marketplace working tree. The user reviews and commits.

## Verify

Run hook tests and the relevant skill/plugin validation before claiming the skill has improved.
