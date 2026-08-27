---
name: skill-watch-promote
description: >
  Use when the user asks to apply recurring skill-watch learnings, rewrite skills from
  telemetry, auto-improve skills, or promote missed standards into the skills marketplace
  working tree.
---

# Skill Watch Promote

Apply durable lessons from `.skill-watch/events.jsonl` into source skills.

## Default Behavior

Run the deterministic hook promotion first:

```bash
SKILL_WATCH_MARKETPLACE_ROOT=~/repos/bokendell/skills-marketplace \
  pnpm dlx tsx ~/repos/bokendell/skills-marketplace/plugins/skill-watch/hooks/skill-watch.ts stop
```

Then inspect `git diff` in the marketplace. If the generated learning block is too generic,
replace it with precise instruction text in the owning skill.

## Promote to the hardest layer that can hold it

**The default target for a recurring deviation is a hard rule, not more prose.**

Enforcement layers, hardest to softest:

| Layer | Why it holds | Where |
|---|---|---|
| Codebase convention | Agents copy the pattern that already exists | The code itself |
| CI / arch rule | Hard failure; cannot be forgotten | `swarm check arch` rule, CI workflow |
| Compiler / types | Same, at edit time | Types, zod schemas |
| Skill / rule prose | Soft — an agent can read it and still not do it | `SKILL.md`, `references/patterns/*.md` |

Prose is the layer of last resort. A `SKILL.md` paragraph is a request; an arch rule is a
gate. If the same deviation keeps recurring, adding a *third* paragraph about it is
evidence that prose is not the right layer for that lesson.

### The triage test

For each recurring deviation, ask in order and stop at the first yes:

1. **Can a linter/AST check detect it from the source alone?** → write a `swarm check arch`
   rule. This is the common case for structural drift (wrong file location, banned import,
   missing co-located test, raw fetch to own backend).
2. **Can a type or schema make it unrepresentable?** → change the type. Best outcome; the
   deviation stops existing rather than being caught.
3. **Can an existing convention absorb it** — a shape agents already copy? → fix the
   canonical example so the copied pattern is correct.
4. **Only if all three are no** → write prose, in the owning skill, in specific
   imperative language naming the failure.

Record the answer either way. A deviation triaged to prose should say *why* it could not be
mechanized ("depends on intent, not structure"), so the next reviewer does not re-litigate it.

### Writing the arch rule

Rules live in the `swarm` repo:
`packages/domains/src/packages/check/infrastructure/arch/semantic/<name>-rule.ts`, with a
sibling `<name>-rule.test.ts`, registered in that directory's `index.ts`. Per-repo opt-in
config goes in `rule-config.ts` and the consuming repo's `bokendell.config.json#archCheck`.
Read `no-raw-backend-fetch-rule.ts` first — it is the reference implementation, and its
doc-comment shows the expected voice: what is banned, why, the known limitation, and the
per-line escape hatch with a required reason.

New rules should ship **opt-in per repo** and start as a warning if the existing violation
count is non-zero — a rule that fails a repo's whole CI on day one gets disabled, and then
you have no rule.

### The standing signal

Aaron runs `dev:review` constantly (~1000 invocations). A finding that shows up in review
for the **third** time is by definition an arch-rule candidate: the soft layer has now
failed to hold it twice. Treat "I have left this comment before" as the trigger, not a
count in a log file.

## Where Fixes Usually Belong

| Drift | Owning place |
|---|---|
| Missed DDD/API/mobile/frontend standard | `plugins/dev/skills/review/SKILL.md` or `references/patterns/*.md` |
| Missing static architecture rule | project `swarm check arch` rule, plus `dev:review` guidance |
| Wrong design/studio routing | `plugins/dev/skills/design/SKILL.md` |
| Golf-specific studio detail | `plugins/dev/skills/golf-design-studio/SKILL.md` as app pack |
| Build workflow miss | `plugins/dev/skills/dev-build/SKILL.md` |
| Shipping/PR miss | `plugins/dev/skills/dev-ship/SKILL.md` |

## Review Gate

After edits:

```bash
pnpm dlx tsx --test plugins/skill-watch/hooks/skill-watch-core.test.ts
```

Also run any affected plugin/skill validation if the edit changed manifests or hook scripts.
