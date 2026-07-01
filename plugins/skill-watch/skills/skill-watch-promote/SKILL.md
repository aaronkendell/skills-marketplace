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
