---
name: golf-design-studio
description: >
  Use this skill for ANY design work in the golf product — design studio
  (`apps/design/`), the primitive library (`packages/ui/` = `@bokendell/golf-ui`),
  or the mobile / admin / marketing app frontends. It bundles `/design`,
  `/impeccable`, `/taste-skill`, `/ui-ux-pro-max:ui-ux-pro-max`, and
  `/huashu-design`, then layers in the Tobacco / Warm-Black brand context,
  the current primitive catalog, the studio workflow, and the hard rules.
  Triggers when the user mentions: design app, design studio, primitives,
  mocks, flows, kits, "redesign a screen", "build a primitive",
  "migrate to golf-ui", or invokes `swarm design *` commands. Use it
  INSTEAD of the generic /design skill whenever the work is in a golf repo.
---

# Golf Design Studio — Skill

You are operating inside the Tobacco / Warm-Black design system. The studio is the canvas where designs are explored; `@bokendell/golf-ui` is the canonical source for every styled component; the mobile app is the primary consumer.

## Repo layout

Golf is the standalone product repo. All paths below assume the cwd is the repo root (or a worktree under `~/.superset/worktrees/<uuid>/...`).

| | Path | Notes |
|---|---|---|
| Design studio | `apps/design/` | Next.js 15 App Router |
| Primitive lib | `packages/ui/` | Published as `@bokendell/golf-ui` |
| Mobile app | `apps/mobile/` | Expo + RN |
| Admin app | `apps/admin/` | Next.js + Refine |
| Shared framework | `@bokendell/design` (from registry) | Source in `aaronkendell/core` |
| Shared shadcn host | `@bokendell/ui` (from registry) | Source in `aaronkendell/core` |
| `swarm` flag | usually omit `--app` (auto-detected from `bokendell.config.json`); pass `--app golf` if it errors | — |

The design app's architecture is documented in [`references/patterns/design.md`](../../../references/patterns/design.md) — surface groups (mobile/admin/marketing/kits), domain packages with `containers/screens/hooks/stores` + `flows/<flow>/{meta,decisions,sections,sketches}`, sketches collocation + server-scan + route handler, providers chain, env validation. **Read that pattern before composing any new structure in the design app.**

## On invocation, ALWAYS do these in order

1. **Load the five base skills** via the Skill tool, in this order. These are not optional — even a "quick" design ask should load them so the variant defaults and anti-slop directives are active:
   - `/dev:design` — orchestrator workflow (mock-first decisions, app/platform detection, persistent tunnels)
   - `/impeccable:impeccable` — anti-AI-slop directives (auto-reads `packages/ui/.impeccable.md`)
   - `/taste:taste-skill` — high-agency frontend rules (typography bans, motion principles, layout diversification)
   - `/ui-ux-pro-max:ui-ux-pro-max` — palette/font/component recommendation (mainly at the *exploration* phase; not every iteration)
   - `/huashu-design` — HTML-native prototype + 5-dimension review + 20 design philosophies (use for hi-fi mocks, slide-style flows, motion stories)

   You can fire all five Skill calls in a single message — they're independent.

2. **Read the system docs.** In this exact order:
   - `apps/design/README.md` — workflow + structure + sync model
   - `apps/design/docs/SETUP-CHECKLIST.md` — local-dev bring-up
   - `packages/ui/HARD-RULES.md` — the 29 non-negotiables
   - `packages/ui/DESIGN-SYSTEM.md` — token spec, material tiers, motion
   - `packages/ui/SIZING.md` — typed prop cheat sheet for every primitive
   - `packages/ui/VOICE.md` — copy rules ("bookkeeper meets editorial"; the explicit banned-phrase list)
   - `packages/ui/.impeccable.md` — brand voice + design context
   - `packages/ui/SCAFFOLD-NOTES.md` — what's shipped, what's planned
   - `references/patterns/design.md` — design app architecture (lib/, packages/, surface groups, sketches, providers)

3. **Read at least one reference screen + flow before composing JSX.** This is the step the agent gets wrong most often: respecting tokens but ignoring the signature compositions. Open `apps/design/src/packages/mobile/round/screens/in-round-screen.tsx` plus `apps/design/src/packages/mobile/round/flows/in-round/sections/01-round.tsx`. Skim how `<PageHeader italicTail>`, `<Card variant="solid">`, ledger-hairline list rows, and `<DesignCanvas>/<DCSection>/<DCArtboard>` + `<Frame theme="light">` are composed. Match that vocabulary — don't reinvent it.

4. **Acknowledge with one line.** "Studio loaded. v0.X — N primitives shipped. {rolling-flow-list}." Then wait for the user's actual ask. *Exception:* if the user already stated the ask in the same turn that invoked the skill, skip the wait and proceed to step 6 of *When the user invokes you with a vague ask* (multi-variant exploration).

## Multi-variant exploration is the DEFAULT

> Every clarifying question that could be answered with a picture must be answered with **2–4 picture variants** instead. Treat asking a text question about layout/color/copy/component shape as a smell — generate the alternatives, let the user pick.

This is the meta-rule that overrides "ask first." It's also why the five base skills are loaded up-front — they all reinforce the same default.

**The variant protocol:**

1. Default to **3 variants** spanning by-the-book → considered → adventurous. Drop to 2 if the decision space is genuinely binary; go to 4 only when the user explicitly asks for more or the decision has clearly independent axes (e.g. layout × density).
2. **Use the real Tobacco tokens** in every variant — never a generic preview. Inline `tokens.css` values as CSS custom properties at the top of the HTML; load fonts via the package's `fonts.css` or Google Fonts CDN (Bricolage Grotesque, Geist, Geist Mono, Source Serif 4).
3. **Realistic content** — actual hole numbers, player names ("Dev", "Tom", "Aaron"), real money values, courses you've actually played. Never "User A / Player 1 / $X.XX".
4. **Annotate each variant** with a 2-line Pro/Con block so the user can pick in <30s.
5. **Save numbered files** under `apps/design/flows/<flow-slug>/sketch/NN-<question>.html` (for sketches) or `mocks/NN-<question>.html` if the flow doesn't exist yet — never overwrite a past iteration; the numbered history IS the decision log.
6. **One persistent tunnel per initiative.** First mock: `cp NN-foo.html current.html` and start the tunnel on `current.html`. Every later iteration: write the new numbered file, `cp` it onto `current.html`, tell the user to refresh the same URL. Tear down with `stop.sh` at end of decision session.
7. **Before sharing**, ask how to review: open locally / tunnel / both / skip — never silently `open` or tunnel.
8. **For TSX-canvas decisions** (composing existing primitives), put the variants directly in `main.tsx` as side-by-side `<DCArtboard>` children inside one `<DCSection>` titled with the decision question, then refine in place.

**Two exceptions** where plain text is fine: tone-of-voice / naming / priority-ordering questions, and yes/no confirms after you've already shown variants. For anything visual or structural, show, don't ask.

## Self-improvement: skill-drift tracking

This skill will go out of date. Repo shapes shift, primitives ship, commands rename. When that happens, **don't quietly work around it — log it so we update the skill.**

**During a session, log a drift entry whenever you notice:**

- A path the skill references doesn't exist (file moved/renamed/split)
- A command the skill teaches errors out, has different flags, or has been replaced
- A primitive listed as "planned" is now shipped (or vice-versa)
- A signature composition the skill claims is canonical no longer matches the current flow code
- The user corrects a fact the skill stated (`"actually that's at X now"`)

**Where to log:** append to `apps/design/.skill-drift.md` (create if missing). One entry per discrepancy:

```markdown
## YYYY-MM-DD · <short title>

- **Skill said:** <what the skill claimed>
- **Actual:** <what's true now>
- **Where:** <SKILL.md section or file path>
- **Suggested fix:** <one-line edit to the skill>
```

**At end of session**, if `.skill-drift.md` has any new entries this turn:

1. Surface them in the wrap-up message as a "Skill drift" subsection.
2. Offer: *"Want me to update the skill at `~/repos/bokendell/skills-marketplace/plugins/dev/skills/golf-design-studio/SKILL.md` to incorporate these? (Y/n)"*
3. If yes: edit the source SKILL.md, mention that the plugin cache regenerates next reload.
4. If the user says "no" or "later", leave the entries; the next session will see them and re-prompt.

This keeps the skill an accurate map of the territory instead of an aging artifact. Treat it like updating tests after a refactor — same discipline.

## What you must know before doing any work

### The principle (one sentence)

> **Every styled element comes from `@bokendell/golf-ui`. Raw `<View>` / `<div>` / `<ScrollView>` / `<FlatList>` are fine because they're behavioral primitives with no visual identity. The instant a component has a brand decision baked in (color, radius, shadow, type voice), it lives in golf-ui and nowhere else — including the studio mocks.**

### The system at a glance

- **System name:** Tobacco / Warm-Black
- **Light:** H2 — bone cream paper · tobacco ink · electric signal amber
- **Dark:** β' Warm Black — tobacco-tinted near-black (chroma 0.008) · warm off-white · same amber accent
- **Throughline:** `oklch(_ 0.20 50)` accent in BOTH modes; only lightness shifts
- **Material tiers:** Paper (~70% solid) · Glass (~20% over real content) · Editorial (~10%, Source Serif italic for Wrapped only)
- **Type stack:** Bricolage Grotesque (display) · Geist (body) · Geist Mono (data — money is the protagonist) · Source Serif 4 italic (editorial)

### The golf-ui primitive catalog (current state)

Always check `packages/ui/SCAFFOLD-NOTES.md` for the live list. The shape:

| Tier | Primitives |
|---|---|
| **v0.1 shipped** | `Button` · `Text` · `Badge` · `Glass` · `PillInput` |
| **v0.2 layout** | `Box` · `Stack` · `Spacer` · `Divider` · `Card` · `Sheet` · `IconButton` · `Avatar` |
| **v0.2 domain** | `ScoreDisplay` · `RelativeScore` · `MoneyDisplay` · `GameBadge` · `PlayerChip` · `PlayerAvatarStack` · `ScoreStepper` · `LiveIndicator` · `HoleHeader` · `SectionHeader` |
| **v0.3 shell (shipped)** | `CaddyAvatar` · `TabBar` · `PageHeader` · `HeaderActions` · `RoundBar` |
| **v0.3+ planned** | `BottomSheet` · `Toast` · `Sticky` · `ChipRow` · `SegmentedToggle` · `NumberStepper` · `HoleHero` · `HoleStrip` · `GameSlipRow` · `GameStrip` · `StandingsRow` · `Scorecard` · `CaddyBubble` · `WrappedCard` · `ReceiptCard` · `ChatBubble` |

When you find yourself writing the same className combination twice in a flow, **stop and add it as a primitive.** That's the discipline that keeps the system honest.

### The studio loop (Next.js)

```
1. Edit primitive in packages/ui/src/components/<Name>/<Name>.web.tsx
2. Next.js dev server (Turbopack) rebuilds the touched route in <2s
3. Verify in the library kit (auto-surfaces every primitive via its sections/<Name>.tsx)
4. Run pnpm --filter @bokendell/golf-ui studio:lint (must be 0 errors)
5. When promoting a flow's artboard to a kit:
   - Pull the JSX out of the flow's screen.tsx into kits/<kit>/screens/<kit>-screen.tsx
   - Identify any new className combos used >once → become new primitives
   - Implement those primitives in golf-ui first, refactor the kit after
```

The studio is `Next.js 15 App Router + Tailwind v4` (see [`patterns/design.md`](../../../references/patterns/design.md) for the full architecture). Each flow has a route file at `src/app/(surface)/<surface>/<domain>/<flow>/page.tsx` that's 8 lines — imports the container + per-flow PageMeta, scans sketches, renders. The discovery root (`/`) is fed by `src/packages/site/discovery/registry.ts` which explicitly imports each domain's `meta.ts`. **Adding a flow** means: scaffold the flow folder under `packages/<surface>/<domain>/flows/<slug>/`, add it to the domain meta, write a route file. No glob magic.

### Mental model: flows are the workshop, kits are the showroom

| | Flow | Kit |
|---|---|---|
| Purpose | Exploration — many variants, accumulating history | Canonical truth — one version, edited in place |
| className combinations not exposed by a primitive | Allowed (workshop) | **BANNED** (HARD-RULES rule 25) |
| Required files | `meta.ts` · `decisions.md` · `README.md` · `sections/` · `sketches/` (+ domain-level `containers/`, `screens/`) | `meta.ts` · `screens/<kit>-screen.tsx` · `containers/<kit>-container.tsx` |

**Promotion** = picking a winning variant in a flow, adding any repeated className combo as a new primitive in `@bokendell/golf-ui`, then refactoring the kit to consume only primitives. The flow stays as institutional memory.

### Kit categories

- `reference` — documentation of the system (`kits/tokens/`, `kits/library/`, `kits/comparison/`, `kits/motion/`).
- `surface` — canonical "this is what the app looks like now" (future: surface kits as needed).

### Current inventory

Surface groups under `apps/design/src/packages/`:

```
mobile/   — round (4 flows) · home · auth (2) · social (2) · profile (2) ·
            share (6) · paywalls · search · notifications · widgets (2) ·
            states · transitions · shell · brand
admin/    — admin
marketing/— marketing
kits/     — tokens · library · comparison · motion
shared/   — games
```

When the user asks for a "new flow":
1. Pick a domain (existing or new under the right surface group).
2. `mkdir -p apps/design/src/packages/<surface>/<domain>/flows/<slug>/{sections,sketches}`
3. Write `flows/<slug>/meta.ts` using `defineFlow(...)` from `@lib/core`.
4. Add the flow to the domain's `<domain>/meta.ts`.
5. Add a domain-level `containers/<slug>-container.tsx` + `screens/<slug>-screen.tsx`.
6. Add the route file at `src/app/(surface)/<surface>/<domain>/<slug>/page.tsx`.
7. Append a row to `<domain>/index.ts`.

### meta.ts — required for every flow

```ts
import { defineFlow } from "@lib/core";

export const inRoundFlow = defineFlow({
  slug: "in-round",
  meta: { metadata: { title: "In-round", description: "..." } },
  status: "shipped",
  category: "rolling",
  order: 100,
  subtitle: "Live-round canvas — picked direction + edge states.",
});

export const inRoundPageMeta = inRoundFlow.meta;
```

Drives the discovery page's listing. Without registration in the domain meta + site registry, the flow won't surface on `/`.

### decisions.md — append-only log per flow

Newest entry on top, `## YYYY-MM-DD · short title` headers. The README captures **current state**; decisions.md captures **the path**. Never edit a past entry — supersede with a new dated one.

### URL state for shareable views

`@bokendell/design/hooks` exposes:
- `useUrlTheme()` — `[theme, setTheme]` reading `?theme=light|dark` — wired into the StudioHeader's ThemeToggle
- `useArtboardState(namespace, key, default)` — namespaced (use when two artboards on one canvas need state)

Pasting a URL = sharing the view. Zero backend; no localStorage (cofounder won't see edits made on your laptop).

### Mounting + providers

`src/app/layout.tsx` mounts `RootLayoutContainer` from `@packages/site`. That wraps the tree in `RootLayout → RootProviders (Query + swarm-api tRPC + Tooltip) → StudioShell (header + theme toggle)`. The Cmd+. annotation overlay is auto-mounted by `<DesignCanvas>`. Never call `createRoot` directly.

### Tokens + fonts come from the package, not the studio

`apps/design/src/lib/studio.css` imports `@bokendell/golf-ui/tokens.css` and `@bokendell/golf-ui/fonts.css`. The `.ttf` files live in `packages/ui/src/tokens/fonts/`. The studio has **zero** brand assets of its own.

### Sync with Claude Design

```bash
# pull a bundle they sent us:
pnpm swarm design unpack <bundle.tar.gz> --app golf --slug <slug>
# → archives slim tarball, extracts to claude-design/latest/ (THROWAWAY — never reference from flows)

# push a flow back to them: produces a tar.gz at apps/design/.out/
pnpm swarm design pack --flow <name> --app golf
```

`claude-design/latest/` gets overwritten on every unpack. If a flow needs material from a bundle, **copy** it into the flow folder at creation time (HARD-RULES rule 28).

## Sketch infrastructure (per-flow scratch + auto-discovery)

**Sketches are pure-HTML scratch files in `flows/<slug>/sketch/`** that explore design vocabulary before TSX commitment. The convention is load-bearing — paywalls and in-round both follow it; new flows should too.

### File naming convention

```
sketch/<NN>-<short-slug>.html        e.g. 01-feature-gate-tiles.html
```

The `NN` prefix (`^(\d{2})-`) maps to a round number → `v{N}` group key. Each round is one design question; variants of that question share the prefix. Files in a round list alphabetically (usually matches creation order). Sketches without the prefix group as `"misc"`.

### `_shared.css` — the only CSS source

Every sketch starts with:
```html
<link rel="stylesheet" href="./_shared.css">
```

`_shared.css` is three lines:
```css
@import "@bokendell/golf-ui/tokens.css";
@import "@bokendell/golf-ui/fonts.css";
@import "@bokendell/golf-ui/utilities.css";
```

plus a body reset. **Don't add per-flow CSS to `_shared.css`** — it's load-bearing across the whole sketch directory. Sketch-specific styles go inline in each HTML's `<style>` block.

### Utility classes available in sketches

From `utilities.css`:
- **Type:** `.t-display-xl|lg|md`, `.t-heading-lg|md|sm`, `.t-body-lg|md|sm`, `.t-caption`, `.t-label`, `.t-eyebrow`, `.t-data-lg|md|sm`, `.t-editorial`
- **Tones:** `.tone-up|down|flat|accent|ink|soft|mute`
- **Surfaces:** `.bg-bg`, `.bg-bg-elev`, `.bg-bg-deep`, `.bg-accent`, `.bg-accent-tint`

Reach for `var(--color-*)` directly only when you need a custom composition.

### Phone-frame CSS recipe (canonical)

Sketches can't import `<IOSDevice>` from `@bokendell/design`, so the phone shape is hand-rolled:

```css
.phone {
  position: relative; width: 402px; height: 874px;
  background: var(--color-bg); color: var(--color-ink);
  border-radius: 44px; overflow: hidden;
  font-family: var(--font-body), system-ui, sans-serif;
  border: 1px solid var(--color-rule);
  box-shadow: 0 30px 80px -20px rgba(0,0,0,0.25);
}
.phone .island {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  width: 124px; height: 36px;
  background: oklch(0.05 0 0); border-radius: var(--radius-pill); z-index: 10;
}
```

### Sketch index — `<SketchIndex>` artboard

Every flow with HTML sketches gets a "00 · Sketches" `<DCSection>` with one artboard rendering `<SketchIndex sketches={sketches} title="..." />`. The `sketches` array is server-scanned by the route file:

```tsx
// app/(surface)/mobile/round/in-round/page.tsx
import { scanFlowSketches } from "@lib/core/sketches/server";

const sketches = await scanFlowSketches("mobile", "round", "in-round");
// → returns Array<{ href, label, group, file }> from disk
```

The screen consumes the array:

```tsx
// packages/mobile/round/screens/in-round-screen.tsx
<DCSection id="00-sketches" title="Sketch index">
  <DCArtboard id="sketches">
    <Frame theme="light">
      <SketchIndex sketches={sketches} title="In-round sketches" />
    </Frame>
  </DCArtboard>
</DCSection>
```

Sketches are served raw by a single route handler at `src/app/sketches/[...path]/route.ts` — URL `/sketches/<surface>/<domain>/<flow>/<file>.html`. Adding a new sketch file is visible immediately (filesystem scan runs per request in dev; no glob to invalidate).

Rich custom indexes (e.g. in-round's per-round `ROUND_META` decoration) live at `flows/<flow>/sections/sketch-index.tsx` and wrap or replace the default `<SketchIndex>`.

## Known scaffolding gaps

### `swarm design new-flow --app golf` predates the new structure

**State:** the existing CLI scaffolds the legacy Vite layout (`apps/<app>/design/flows/<slug>/{index.html,main.tsx,meta.json}`). It doesn't write the Next.js structure (`packages/<surface>/<domain>/flows/<slug>/`).

**Workaround:** scaffold manually by copying from an existing flow:

```bash
DOMAIN=apps/design/src/packages/mobile/<domain>
mkdir -p $DOMAIN/flows/<slug>/{sections,sketches}
# copy README.md template, write a meta.ts using defineFlow(...), add it to $DOMAIN/meta.ts
# add domain-level containers/<slug>-container.tsx + screens/<slug>-screen.tsx
# add the route file at apps/design/src/app/(surface)/mobile/<domain>/<slug>/page.tsx
```

See [`patterns/design.md`](../../../references/patterns/design.md) for the full template.

## Asset stacks — when to reach for what

Tobacco has two parallel stacks: **motion** (things that move) and **static** (things that stand still). Both are thin-orchestrator skills in the same marketplace.

- Load **`motion-stack`** when the request involves animation, gestures, video, or Wrapped MP4 exports.
- Load **`static-stack`** when the request involves icons, brand marks, illustrations, textures, stock photos, App Store screenshots, or OG share images. The static-stack skill points at the Recraft / Nano-Banana / Iconify / Unsplash MCPs bundled in `mcp-pack` v1.2.0+.

### Animation stack — short version

Tobacco uses a four-tier motion stack. Different tool per tier; none try to be all four. The short version:

| Tier | Tool | For |
|---|---|---|
| 1 · In-app motion | `react-native-reanimated 4.x` | sheet rises, gestures, press states, transitions. Same code RN + web at 120fps via JSI |
| 2 · Branded animations | **Rive** (`.riv` files in `packages/ui/src/assets/`) | Caddy stipple bloom, Wrapped reveal, TabBar active morph, success checkmark — load the **`rive`** skill when authoring |
| 3 · Per-user video | **Remotion** + the `remotion-best-practices` skill | Wrapped MP4 exports, anniversary recaps, marketing reels. Scaffold a sibling `apps/wrapped-render/` Remotion project that consumes the same primitives |
| 4 · Marketing cinematic | **Higgsfield CLI** — load the **`higgsfield-cli`** skill | Course flyovers, hero loops, mood pieces. Multi-model aggregator over Kling 3.0 / Veo 3.1 / Runway / Seedance |

Plus `huashu-design` for HTML→MP4 sketches during exploration (already loaded).

**Why this matters now:** the current `CaddyAvatar` primitive uses inline CSS `@keyframes caddy-bloom` plus a separate Reanimated worklet for native. That's two implementations of one brand animation. Promotion candidate: re-author as `caddy-bloom.riv` → consumed via `<RiveAsset name="caddy-bloom">` on both platforms. Same file, identical 60fps result, ~5KB on disk.

Same pattern applies to:
- `<LiveIndicator>` pulse → `live-indicator.riv`
- Wrapped Dec-28 reveal moment → `wrapped-reveal.riv`
- TabBar active capsule morph → `tabbar-active-morph.riv`
- Score-up / score-down deltas → `score-up.riv` / `score-down.riv`

**Account requirements** (one-time setup, see the `motion-stack` skill for full details):
- Rive (free hobby tier) for authoring `.riv` files at rive.app
- Remotion commercial license (~$25/mo solo, $99+/mo team) for product use
- Higgsfield Creator plan (~$29/mo) for CLI / API access — marketing only

### Static-asset stack — short version

Tobacco uses a five-tool static stack via `mcp-pack` v1.2.0+. See **`static-stack`** for the full tree.

| Tool | For | Account / cost |
|---|---|---|
| **Recraft V3** (MCP) | Vector SVG — brand icons, marks, illustrations | Free 50 credits → $10/mo Starter |
| **Nano-Banana 2** (MCP, Gemini Flash Image) | Raster textures, hero images, painterly grain | ~$0.04–$0.15/img; Gemini API key |
| **Iconify** (MCP) | Search 150+ icon collections (Lucide, Phosphor, Material, Tabler…) | Free, no key |
| **Unsplash** (MCP) | Stock photo with attribution baked in | Free 50 req/hr |
| **Playwright** (MCP) | Visual design review — see [[design-review]] | Free OSS |

**Token-aware prompts:** when calling Recraft or Nano-Banana, always pass the Tobacco palette in OKLch directly — don't trust the model's notion of "warm" or "earthy".

### End of every flow iteration — run `/design-review`

After landing a flow edit, run `/design-review <flow-slug>` (the dev plugin skill). It composes `/design-verify` (Playwright-driven screenshot + DOM + computed-styles capture) with 4 parallel taste agents (`taste-skill`, `impeccable`, `ui-ux-pro-max`, `huashu-design`) and posts annotations attributed by author. Don't ship a flow without this pass — it's how the studio catches drift before it goes to code review.

## Signature compositions — the vocabulary that makes Tobacco *feel* Tobacco

These are NOT rules you can leave to taste. If your JSX doesn't use these patterns, it isn't speaking the system, even if it uses the tokens.

### 1. Titles → `<PageHeader eyebrow title italicTail>`

The Source Serif italic tail is THE signature move. Reach for it on any screen with a meaningful title:

```tsx
<PageHeader
  eyebrow="STEP 01 · YOU"
  title="A name"
  italicTail=" your group knows."
/>
```

Renders as **Eyebrow** / **Display** *italic tail* sharing a line — Bricolage for the display, Source Serif italic in `--ink-soft` for the tail. Flat `<Text scale="heading-lg">` titles are an instant tell that the agent didn't read the round flow. Use `PageHeader` even for utility screens; drop `italicTail` only when the screen genuinely doesn't earn it (errors, settings, system messages).

### 2. List rows → `<Card variant="solid" padding="3">` or hairline-divided ledger

For tappable list rows (courses, players, payment apps, recents) use a `<Card>` with `cursor-pointer hover:border-ink-soft transition-colors`. Selected state is `border-ink` or a trailing check, NOT a tinted background or a 2px accent border. The "boxy AI-dashboard selected state" (`border-2 border-accent bg-accent/[0.04]`) is a tell.

For dense lists (recents-as-ledger, scoreboard, settle-up), drop the cards entirely and use `<button>` rows with `border-b border-rule last:border-b-0` — the paper-invoice metaphor. See the `LedgerRow` pattern in `apps/design/src/packages/mobile/round/flows/pre-round/sections/` or `apps/design/src/packages/mobile/round/flows/in-round/sections/`.

### 3. Shell → wrap full-frame screens in a Screen primitive

`packages/mobile/shell/screens/shell-screen.tsx` and `packages/mobile/round/flows/in-round/sections/_shell.tsx` show the pattern. New per-app sub-flows (onboarding, auth, settings) should each have a sibling Screen primitive (`<OnboardingScreen header footer>`, etc.) rather than inlining a sticky CTA + gradient + safe-area in every screen. The Screen primitive owns the dynamic-island spacer + safe-area + chrome slot.

### 4. Auth / brand buttons → `<Button>` with monochrome glyphs

Apple/Google/etc. auth buttons should reuse the `<Button>` primitive (`primary` for the recommended path, `secondary` for the rest). Logos go in `<span className="text-ink">` as **monochrome SVG** — never the full-color brand logo (Google's red-yellow-green-blue G, Apple's literal black on pure white). The amber accent appears **once or twice per screen**, not on every CTA.

### 5. Numbers → Geist Mono with `tabular-nums`

Anything that can change — money, scores, distances, step counters (`01 / 05`), timers — uses `font-data` (Geist Mono) with `tabular-nums`. Money uses `<MoneyDisplay amount showSign>` so the U+2212 minus and the up/down/flat tone are guaranteed. Hyphen-minus on a negative dollar is a smell.

### 6. Copy → check `VOICE.md` before writing UI strings

No `Let's get started!`, no `Awesome!`, no `Powered by AI`, no emoji, no exclamation marks. The Caddy talks like a smart sports columnist who knows your handicap. Sentence case for UI, all-caps only for ≤11px Geist Mono eyebrows / chips.

### 7. Read a current flow before you write the kit

`apps/design/src/packages/mobile/round/flows/in-round/sections/*.tsx`, `pre-round/sections/*.tsx`, and `packages/mobile/shell/screens/shell-screen.tsx` are the canonical vocabulary references. If the JSX you're about to write doesn't look like that file, you're inventing — go re-read it.

### 8. Use `sketches/` for pre-system exploration, not the screen

Every flow has a `sketches/` subfolder under `flows/<flow>/sketches/` for **pure-HTML scratch work**: aesthetic vocabularies that don't have primitives yet, editorial moments, marketing-y artifacts, or unmodified Claude Design bundle drops. Sketches `@import` `_shared.css` which pulls in `@bokendell/golf-ui/tokens.css` + `fonts.css` + `utilities.css`, so the `.t-display-lg` / `.tone-up` / `.bg-bg-elev` classes resolve to real OKLch tokens and real brand fonts.

```bash
cp packages/mobile/<domain>/flows/<flow>/sketches/_shared.css packages/mobile/<domain>/flows/<flow>/sketches/01-my-idea.html
# open at http://127.0.0.1:5173/sketches/mobile/<domain>/<flow>/01-my-idea.html
```

**Rules:**
- Sketches are evidence, not source. They never promote to a kit directly — port to TSX section files in `sections/` if kept, then link the sketch from `decisions.md`.
- HARD-RULES 18–24 still apply (no `border-left` stripes, no gradient text, no emoji, no `#000`/`#fff`).
- Don't put a sketch's inline `<style>` block past ~30 lines without asking yourself: is this a missing primitive?

**`sections/*.tsx`** is for compositions of existing primitives — the path that promotes cleanly. **`sketches/` (HTML)** is for inventing the shapes the system doesn't have yet. Most flows live mostly in TSX sections; use sketches when you genuinely need freedom.

## DCSection / DCArtboard rules — the things that bite

These cost an iteration loop each time they fire. Internalize them:

- **`DCSection` reads only DIRECT `DCArtboard` children.** Walks `React.Children.toArray(children)` and filters via `isDCArtboard`. A wrapper component (`<Row>`, `<Group>`) flattens to one non-artboard element and gets filtered out — section renders the title but zero artboards. Always **inline** the artboards as direct children, or use a helper that returns `Array<DCArtboardElement>` and spread it.
- **React Fast Refresh requires every top-level statement in an entry file to be a component or a hook.** Bare expressions (`void Foo;`, `console.log(...)`, `const x = computed();`) break the "consistent components" check and force a cold module reload on every edit (you'll see `Could not Fast Refresh ("true" export is incompatible)` in the dev log). Delete bare expressions — comment out the import or use the value inside a component.

## Mandatory checks before claiming work is done

Run all of these. Do not assume; verify.

```bash
pnpm --filter @bokendell/golf-design build            # next build — must succeed
pnpm swarm design lint --app golf                     # 0 errors required, warnings noted
pnpm --filter @bokendell/golf-design check-types      # tsgo must pass
pnpm --filter @bokendell/golf-ui check-types          # tsgo must pass
pnpm --filter @bokendell/golf-design test             # vitest must pass
```

If you wrote a new primitive, also verify:
- It has `Name.variants.ts` + `Name.web.tsx` + `Name.native.tsx` + `index.ts`
- The component is exported from `src/index.ts`
- A JSDoc with at least one `@example` is present
- The primitive has its own section file at `apps/design/src/packages/kits/library/sections/<Name>.tsx` (auto-discovered by the library kit — `meta` export + default component)

If you wrote in a kit, also verify:
- No className combination is used >1 time without being a primitive variant. If you see one, extract a primitive FIRST, then land the kit edit (HARD-RULES rule 25).

## Anti-patterns — instant reject if you see these in studio JSX or golf-ui code

(Mirrors `HARD-RULES.md` rules 18–24 + rule 30 for branded animations.)

1. `border-left:` greater than 1px — the #1 AI tell, banned outright
2. Banned className tokens: `bg-blue-500`, `text-gray-700`, etc. (anything not in our token surface)
3. Pure `#000` or `#fff` — always tint
4. Banned font families — Inter, Roboto, Arial, Crimson, Playfair Display, Cormorant, **Syne** (instant AI tell), DM Sans/Serif, Outfit, Plus Jakarta Sans, Instrument Sans/Serif, Newsreader, Fraunces, Lora, IBM Plex, Space Mono, Space Grotesk
5. Glass over solid color (Glass needs real content underneath)
6. Gradient text (`background-clip: text` + gradient) — solid text only
7. Bounce / elastic easing — use `--ease-out` or `--ease-spring`
8. Emoji characters in product UI — Lucide icons or brand SVGs only
9. Raw `style={{ color: '...' }}` with literal hex — use tokens via className
10. Animating `width` / `height` / `top` / `left` / `padding` / `margin` — only `transform` and `opacity`
11. **Reimplementing branded animations per-platform** (CSS keyframes + Reanimated worklet for the same animation) — author one `.riv` and consume via `<RiveAsset>` everywhere. See the Animation stack section above and the `rive` skill for the migration pattern. Caddy bloom is the canonical example.

## When the user invokes you with a vague ask

If they say "let's design X" or "make this look better," DO THIS in order:

1. Confirm the app context is golf (this skill). If it's portfolio or hive, hand off to `/dev:design` instead.
2. Confirm the platform: mobile (default) or admin (Next.js) or marketing (future).
3. Detect whether this is exploration (no existing artifact yet → start in the design studio) or refinement (existing screen → review against current rules and propose changes).
4. **For exploration: generate 2–4 variants FIRST, then ask which direction to deepen.** See *Multi-variant exploration is the default* above — that's the protocol. Don't ask "what mood are you going for?" — make three different moods and let the user point.
5. For refinement: read the existing screen, lint it, show diff vs the rules, propose specific changes (and if the change is non-trivial, still present 2 variants of the change).

## When you're done

End with:
- The **lint exit code** (must be 0 for completed work)
- The **set of files touched**
- Any **new primitives added** (and whether they're exported from `src/index.ts`)
- Any **TODOs identified** for follow-up Linear tickets
- Any **skill-drift entries logged** in `apps/design/.skill-drift.md` this session (and offer to apply them to the source SKILL.md)
- **Never auto-commit.** Only `git add` per the user's standing rule.

## Reference files (load on demand)

- `packages/ui/SIZING.md` — **typed enum cheat sheet for every primitive** — read this BEFORE composing screens
- `packages/ui/HARD-RULES.md` — the 29 rules
- `packages/ui/DESIGN-SYSTEM.md` — token + material spec
- `packages/ui/MOTION.md` — motion + spring tokens
- `packages/ui/CONTRIBUTING.md` — how to add a primitive
- `packages/ui/.impeccable.md` — brand voice + design context (auto-loaded by /impeccable)
- `packages/ui/docs/migration-from-mobile-ui.md` — the migration ladder
- `apps/mobile/src/lib/components/` — existing components to match API for one-import swaps

## Lint commands

```bash
pnpm --filter @bokendell/golf-ui studio:lint            # design-lint over studio flows + kits
pnpm --filter @bokendell/golf-ui studio:app-arch-lint   # arch rule over apps/{mobile,admin,marketing}/src
```

`studio:app-arch-lint` enforces HARD-RULES across app code: bans raw colors, banned className tokens (`bg-blue-500` etc.), arbitrary `[Npx]` in className, `react-native` imports of styled elements, direct `mobile-ui` imports from screens, `StyleSheet.create` with visual values. Honors `// HARD-RULES exception: <reason>` comments.
