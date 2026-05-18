# External design-stack skills

The `dev` plugin's design orchestrators (`/design`, `/design-review`, `/design-verify`, `/golf-design-studio`, `/design-comments`) are thin coordinators. The actual *taste*, *anti-slop*, *UI heuristics*, and *HTML-prototyping* work lives in four external resources, each sourced from its upstream repo so you get updates automatically.

## The four resources

| Skill | Role | Source | How to install |
|---|---|---|---|
| `/taste-skill` | Senior UI/UX engineer voice. Typography bans, motion principles, layout diversification. Includes `redesign`, `soft`, `minimalist`, `brutalist`, `stitch`, `output` sub-skills, plus `image-to-code`, `imagegen-frontend-{web,mobile}`, `brandkit`, `gpt-tasteskill`. | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `/plugin install taste@bokendell-skills` (sourced live from upstream via this marketplace) |
| `/impeccable:impeccable` | Agency-grade finisher. 21 commands (`/polish`, `/distill`, `/audit`, `/typeset`, `/overdrive`, …) + curated anti-patterns. Catches micro-issues, off-tokens, weak edges. | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `/plugin marketplace add pbakaus/impeccable` then `/plugin install impeccable@impeccable` |
| `/ui-ux-pro-max` | UI/UX intelligence — 67 styles, 96 palettes, 57 font pairings, 25 chart types, 13 stacks (React, Next.js, Vue, Svelte, SwiftUI, RN, Flutter, Tailwind, shadcn/ui). Heuristics + accessibility + color-system review. | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| `/huashu-design` | HTML-native design skill. High-fidelity prototypes, slides, animations, 20 design philosophies, 5-dimension review, MP4 export. Agent-agnostic. | [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design) | `git clone https://github.com/alchaincyf/huashu-design ~/.claude/skills/huashu-design` *(upstream has `SKILL.md` at root with no plugin layout, so it installs as a personal user-scope skill rather than a marketplace plugin — `git pull` to update)* |

## Check installation before invoking design skills

Before any design orchestrator runs, verify all four are reachable. The fastest checks:

```bash
# Plugin-scope skills (taste, impeccable, ui-ux-pro-max)
ls ~/.claude/plugins/cache/bokendell-skills/taste/*/skills/ 2>/dev/null
ls ~/.claude/plugins/cache/impeccable/impeccable/*/             2>/dev/null
ls ~/.claude/plugins/cache/ui-ux-pro-max-skill/*/*/             2>/dev/null

# User-scope skill (huashu-design)
ls ~/.claude/skills/huashu-design/SKILL.md 2>/dev/null
```

If any is missing, surface the install command from the table above to the user **before** proceeding. Do not silently degrade — the orchestrators assume all four are loaded.

## How the orchestrators compose them

| Orchestrator | What each external skill contributes |
|---|---|
| `/design` | Loads only what context demands. Defers exploration to `/ui-ux-pro-max`, taste enforcement to `/taste-skill`, finishing to `/impeccable`, HTML mocks to `/huashu-design`. |
| `/design-review` | Spawns **four parallel sub-agents** — one per skill — each producing annotations tagged with its author. Orchestrator dedupes findings. |
| `/design-verify` | Independent: captures screenshots + DOM + computed styles, then audits against HARD-RULES. Doesn't invoke the four skills directly, but its evidence bundle feeds `/design-review`. |
| `/golf-design-studio` | Loads all four base skills + Tobacco / Warm-Black brand context + the studio workflow. The most opinionated wrapper. |
| `/design-comments` | Address feedback inbox. Pulls whichever skill matches the comment's author tag. |

## Why upstream-sourced, not vendored

- **Auto-updates**: marketplaces with `autoUpdate: true` pull new commits on Claude Code startup. Vendor copies would freeze at clone-time.
- **One canonical source**: if upstream evolves a skill, your design pipeline picks it up automatically.
- **Less to maintain in bokendell-skills**: this marketplace only owns the *orchestration* (the `/design-*` and `/golf-design-studio` skills). Taste, anti-slop heuristics, UI catalog, HTML prototyping — those are upstream specialties.

The marketplace registrations live in `~/.claude/settings.json` under `extraKnownMarketplaces` (user scope). The `huashu-design` user-scope clone is just a directory at `~/.claude/skills/huashu-design/` that you `git pull` periodically.
