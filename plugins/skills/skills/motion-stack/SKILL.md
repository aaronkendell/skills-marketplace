---
name: motion-stack
description: The bokendell motion + video stack — which official + community Claude skills to load and which CLIs to use for in-app animations, branded assets (Rive), per-user video (Remotion), and AI cinematic content (Higgsfield). Activates whenever the conversation involves animation, motion design, video creation, marketing assets, Wrapped recaps, or cross-platform animated UI.
metadata:
  tags: motion, animation, video, reanimated, rive, remotion, higgsfield, cross-platform
---

# The motion stack · orchestrator

> Thin pointer skill. Don't reimplement what upstream already documents. This skill tells Claude **which official skills to load** and **which CLIs to run** for each motion need across golf, portfolio, hive, and shared UI packages.

## The decision tree

```
Is this an in-app gesture, transition, sheet rise, or press state?
└── react-native-reanimated 4.x — already a peer dep in every bokendell Expo app.
    Same code runs RN + web at 120fps via JSI. No special skill to load — use the lib directly.

Is this a branded animation (Caddy bloom, mascot, reveal moment, state machine)?
└── Rive .riv files. LOAD: `rive-interactive` from the claude-design-skillstack marketplace.

Is this a per-user MP4 export (Wrapped, anniversary recap, generated marketing reel)?
└── Remotion. LOAD: `remotion` from the official remotion-dev/skills.

Is this AI-generated cinematic content (course flyovers, hero loops, mood pieces)?
└── Higgsfield CLI. No upstream skill — see the `higgsfield-cli` skill in this same plugin.

Is this Lottie-format playback (existing After Effects exports)?
└── LOAD: `lottie-animations` from claude-design-skillstack. Prefer Rive for NEW authoring.

Is this scroll-driven web motion (landing pages, portfolio)?
└── LOAD: `gsap-scrolltrigger` OR `motion-framer` from claude-design-skillstack.
```

## Preflight · prompt the user if anything's missing

Before doing motion work, **silently check what's available and prompt the user only if something's missing.** Don't run the install commands without explicit approval — these touch global state.

```
1. For Remotion work:
   - Check: `ls ~/.agents/skills/remotion-best-practices` (or the project's .agents/skills/)
   - If missing: ask user to run `npx skills add remotion-dev/skills`

2. For Rive / Lottie / Motion-Framer work:
   - Check user's ~/.claude/settings.json for the `claude-design-skillstack` marketplace
     under `extraKnownMarketplaces` and the plugin under `enabledPlugins`
   - If missing: ask user to run
     `/plugin marketplace add freshtechbro/claudedesignskills`
     then `/plugin install rive-interactive@claude-design-skillstack` (etc.)

3. For Higgsfield AI cinematic work:
   - Check: `which higgsfield` (CLI) and `echo $HF_API_KEY` (env)
   - If CLI missing: ask user to run `npm install -g @higgsfield/cli`
   - If env missing: ask user to add HF_API_KEY + HF_SECRET to Infisical
     at /infrastructure/higgsfield (or shell env directly), then wrap with
     `infisical run --path=/infrastructure/higgsfield -- <command>`
   - The higgsfield-mcp server is also enabled via mcp-pack (user-scope) —
     if Claude Code has the `higgsfield` MCP tools available, use those
     INSTEAD of shelling out to the CLI

4. For Rive runtime in golf/portfolio/hive apps:
   - Check: package.json has `@rive-app/react-native` (RN) or `@rive-app/canvas` (web)
   - If missing: ask user to confirm before running `pnpm add @rive-app/react-native`
     (or the web variant). Native install requires `cd ios && pod install` after.

5. For the Motion primitive in @bokendell/design:
   - Check: `ls core/packages/shared/design/src/packages/motion/` exists
   - If missing: this is the cross-app promotion candidate. Refer to the
     "Core primitives needed" section below; flag it as a drift entry and
     ask the user before scaffolding the new core module.
```

The user has accounts for Rive and Higgsfield as of 2026-05-21. Remotion commercial license sign-up happens when scaffolding the first wrapped-render project.

## One-time setup (per machine)

### 1 · Install the official Remotion skills

```bash
npx skills add remotion-dev/skills
```

Installs to `~/.claude/skills/`. Auto-activates when Claude detects Remotion code in context. 117k weekly installs as of May 2026, maintained by the Remotion team. **No account needed for installation.** Commercial license required to USE Remotion in a product (see Accounts below).

### 2 · Add the claude-design-skillstack marketplace

In Claude Code:

```
/plugin marketplace add freshtechbro/claudedesignskills
```

This adds 22 individual plugins + 5 bundles covering 3D, animation, motion, scroll, components. Most relevant to bokendell:

| Plugin | Use for |
|---|---|
| `rive-interactive` | Authoring + integrating Rive `.riv` files (RN + web) |
| `lottie-animations` | Lottie playback (legacy AE exports) |
| `motion-framer` | Framer Motion on web; declarative animations |
| `react-spring-physics` | Spring physics on web |
| `gsap-scrolltrigger` | Scroll-driven motion on web |
| `react-three-fiber` | 3D content if we ever need it |

Install only what you'll use:

```
/plugin install rive-interactive@claude-design-skillstack
/plugin install lottie-animations@claude-design-skillstack
/plugin install motion-framer@claude-design-skillstack
```

### 3 · Higgsfield CLI (when ready for marketing video)

See the `higgsfield-cli` skill in this same plugin. Requires Higgsfield Creator account.

## Bokendell-specific conventions

The upstream skills handle the LIBRARY. This section adds the bokendell-system layer.

### Branded `.riv` files live in the shared assets dir

Author `.riv` files in the Rive editor (rive.app) and commit them to:

- **Cross-app brand marks** → `core/packages/shared/design/src/packages/motion/assets/*.riv`
- **golf brand** → `golf/packages/ui/src/assets/*.riv`
- **portfolio brand** → `portfolio/packages/ui/src/assets/*.riv`
- **hive brand** → `hive/packages/ui/src/assets/*.riv`

Naming: `<surface>-<state>.riv` (e.g. `caddy-bloom-idle.riv`, `wrapped-reveal.riv`).

### Use the `<RiveAsset>` primitive from `@bokendell/design/motion`

**(Promotion candidate — see Core primitives below if not yet shipped.)** The primitive picks the correct runtime (`@rive-app/react-native` on RN, `@rive-app/canvas` on web), respects `prefers-reduced-motion`, and binds bokendell color tokens to the Rive file's color slots at runtime so the same `.riv` recolors for light / dark mode.

```tsx
<RiveAsset name="caddy-bloom" size="lg" stateMachine="main" />
```

### Remotion compositions consume the same primitives

A Remotion project at `<app>/apps/<x>-render/` imports `@bokendell/<x>-ui` primitives directly — `<MoneyDisplay>`, `<Slip>`, `<CaddyAvatar>` all work inside Remotion compositions because Remotion IS just React.

```
golf/apps/wrapped-render/                  ← Remotion project, renders Wrapped MP4s
├── src/Wrapped.tsx                        ← imports @bokendell/golf-ui
├── remotion.config.ts
└── package.json
```

Render: `cd apps/wrapped-render && pnpm remotion render` → MP4 + 9:16 crop + GIF outputs.

### Higgsfield outputs go in public assets

```
core/packages/shared/public-assets/marketing/hero/*.mp4   ← cross-app hero loops
golf/apps/marketing/public/video/courses/*.mp4            ← per-app
```

Commit MP4s (Git LFS for files >10MB). Generation isn't deterministic; commit once you have a take you like.

## Hard rules (HARD-RULES rule 30 across all apps)

1. **Branded animations live in `.riv` files**, not as per-platform CSS keyframes + Reanimated worklets. One source of truth per animation.
2. **Animate only `transform` and `opacity`.** No `width`, `height`, `top`, `left`, `padding`, `margin`.
3. **Per-user generated video renders via Remotion.** No headless-browser screenshots, no canvas hacks.
4. **Marketing cinematic uses Higgsfield**, not bespoke drone footage.
5. **Respect `prefers-reduced-motion`.** Every motion primitive should check the media query; Rive autoplay should pause.
6. **No Sora.** OpenAI API discontinued Sept 24, 2026.

## Account requirements

| Tool | Account | Cost | When you need it |
|---|---|---|---|
| Reanimated | none | free | already in every Expo app |
| Rive | rive.app (free hobby OK) | free → $14–$24/seat for team | authoring `.riv` files |
| Remotion | remotion.dev | free non-commercial; **~$25/mo solo / $99+/mo team for commercial** | required for product use (golf, portfolio, hive are commercial) |
| Higgsfield | higgsfield.ai Creator | ~$29/mo | only when generating marketing video |
| Sora / OpenAI Video | — | — | DON'T. API discontinues Sept 24, 2026 |

Order: Rive first (authoring), Remotion next (Wrapped engineering setup), Higgsfield last (marketing).

## Cross-app applicability

The stack is identical across apps. What varies is just the assets:

| App | Branded `.riv` candidates | Remotion compositions | Higgsfield use |
|---|---|---|---|
| **golf** | `caddy-bloom`, `live-indicator`, `score-up/down`, `wrapped-reveal`, `tabbar-active-morph`, `success-checkmark` | Wrapped MP4 (`apps/wrapped-render/`), anniversary moments | Course flyovers (`marketing/hero/<course>.mp4`) |
| **portfolio** | Section reveal animations, portfolio-piece flips | Case-study highlight reels (`apps/case-study-render/`) | Hero loops per section |
| **hive** | Agent status (idle / working / error / success), task-complete checkmark | Demo videos for marketing site | Marketing hero loops |

## Core primitives needed (gap analysis)

The shared `@bokendell/design` package needs a `motion/` module so every app gets the runtime cross-platform without rewriting. Currently MISSING — see drift entry in `golf/apps/design/.skill-drift.md` for the proposal:

```
core/packages/shared/design/src/packages/motion/
├── index.ts
├── RiveAsset.web.tsx              — @rive-app/canvas wrapper
├── RiveAsset.native.tsx           — @rive-app/react-native wrapper
├── useMotionToken.ts              — read --duration-* / --ease-* tokens for Reanimated
├── motionTokens.ts                — TS-exported constants
├── MotionGate.tsx                 — prefers-reduced-motion wrapper
└── README.md
```

Plus thin wrappers in each form-factor UI package:
- `core/packages/shared/ui/src/components/MotionView.tsx` — framer-motion + tokens (web)
- `core/packages/shared/mobile-ui/src/components/MotionView.tsx` — Reanimated + tokens (RN)
- `core/packages/shared/desktop-ui/src/components/MotionView.tsx` — RN-for-macOS variant

Each app's UI package (`@bokendell/golf-ui`, `@bokendell/portfolio-ui`, `@bokendell/hive-ui`) consumes these directly. App-specific motion (e.g. `<CaddyAvatar>` accepting `riveSource`) wraps the core primitive — no per-platform duplication.

## Quick sanity check before any animation work

1. Did you load the right upstream skill? (e.g., `/plugin list` and confirm `rive-interactive` is installed before Rive work)
2. Is the `.riv` file (or Remotion composition / Higgsfield output) committed to the right shared package?
3. Does the consuming code use `<RiveAsset>` / `<MotionView>` from `@bokendell/design/motion`, not a per-platform fork?
4. Are `--ease-*` and `--duration-*` tokens being read (not hardcoded)?

If yes to all four, ship it.

## Sources

- [remotion-dev/skills (official)](https://github.com/remotion-dev/skills) · [Remotion AI docs](https://www.remotion.dev/docs/ai/skills)
- [freshtechbro/claudedesignskills marketplace](https://github.com/freshtechbro/claudedesignskills)
- [Rive — official site](https://rive.app/) · [Rive React Native](https://help.rive.app/runtimes/overview/react-native) · [Rive web](https://help.rive.app/runtimes/overview/react)
- [Reanimated web support](https://docs.swmansion.com/react-native-reanimated/docs/guides/web-support/)
- [Higgsfield CLI + Claude Code automation (MindStudio)](https://www.mindstudio.ai/blog/higgsfield-cli-claude-code-content-automation)
- [Lottie vs Rive (Callstack)](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation)
