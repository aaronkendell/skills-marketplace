---
name: skill-watch
description: >
  Use when the user asks to monitor, improve, rewrite, debug, or evaluate agent skills,
  Claude Code hooks, Codex hooks, skill drift, missed skill activation, recurring workflow
  mistakes, or standards enforcement across dev/review/design/build skills. Also active
  through hooks to record expected skills, validation gaps, and recurring deviations.
---

# Skill Watch

Skill Watch is the self-improvement loop for this marketplace. It watches how the agent uses
skills, records drift, and promotes recurring lessons into the source skills under
`~/repos/bokendell/skills-marketplace`.

## Operating Model

The hook loop is intentionally split:

| Stage | Hook | Job |
|---|---|---|
| Prompt | `UserPromptSubmit` | Classify expected skills and suggest validation commands. |
| Tool | `PostToolUse` | Record command failures, architecture checks, and standards signals. |
| Stop | `Stop` | Apply recurring, thresholded learnings into the marketplace working tree. |

The hook writes records to `.skill-watch/events.jsonl` in the marketplace checkout. Those logs are
working data, not product source. The rewritten `SKILL.md` files are the reviewable output.

## Promotion Rules

Promote only durable lessons:

- Three similar deviations for the same skill/key.
- Or one explicit user correction that says the skill is wrong/outdated.
- Or a deterministic structural mismatch: path moved, command renamed, checker changed, or shipped primitive status changed.

Do not promote one-off taste preferences, temporary tool outages, or repo-specific guesses without evidence.

## Standards It Must Know

Skill Watch should prefer existing repo standards over generic advice:

- DDD/API/frontend/mobile/design rules live in `references/patterns/`.
- Fast review should use `dev:review` and its `references/glob-map.md`.
- Architecture checks should prefer `pnpm swarm check arch` when `swarm` is available.
- Formatting/linting should use Biome, not ESLint/Prettier.
- Package commands should use `pnpm`, not npm.
- Design/studio work should route through `dev:design`; `golf-design-studio` is now a golf app-pack/legacy alias, not the primary orchestrator.

## When You Notice Drift Manually

If the user corrects a skill, or you discover a missing architecture rule:

1. Add or inspect the relevant event in `.skill-watch/events.jsonl`.
2. Decide which skill owns the fix.
3. Edit that source `SKILL.md` in this marketplace checkout.
4. Run the hook tests and any relevant plugin validation.
5. Leave changes uncommitted for the user to review unless asked to commit.

## External Skills

Use Ponytail as an overbuild/debt signal, not as the owner of bokendell standards. Skill Watch can
learn from Ponytail findings, but DDD/API/mobile/design guidance belongs in this marketplace.

Use the pskoett-style pattern as architecture: log evidence, group recurring deviations, promote
only when thresholded, and keep the working-tree rewrite reviewable.

For the full external-tooling posture — Ponytail (debt signal), SkillSpector (skill/MCP security
gate for third-party skills we install), and Loopy (ideas to mine) — see
[`references/external-tooling.md`](../../references/external-tooling.md).
