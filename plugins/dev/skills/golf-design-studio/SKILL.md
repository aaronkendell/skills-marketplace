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

## Repo layout — DETECT BEFORE READING ANYTHING

Golf code lives in **two possible repo shapes**. The skill's path references below default to **Shape A** (this is the workspace you're almost always in). If `apps/design/` exists at the cwd root, you're in Shape A; otherwise check Shape B.

| | Shape A · standalone `golf` repo (default) | Shape B · `core` meta-repo |
|---|---|---|
| Design studio | `apps/design/` | `apps/golf/design/` |
| Primitive lib | `packages/ui/` (pkg name: `@bokendell/golf-ui`) | `packages/golf/ui/` |
| Mobile app | `apps/mobile/` | `apps/golf/mobile/` |
| Admin app | `apps/admin/` | `apps/golf/admin/` |
| Shared framework | `@bokendell/design` (from registry) | `packages/shared/design/` (source) |
| Shared shadcn host | `@bokendell/ui` (from registry) | `packages/shared/ui/` (source) |
| `swarm` flag | usually omit `--app` (auto-detected from `bokendell.config.json`); pass `--app golf` if it errors | always pass `--app golf` |
| Repo root marker | `bokendell.config.json` with `"app": "golf"` | top-level `apps/` with multiple products |

**Detection one-liner** to run before reading docs:
```bash
test -d apps/design && echo "Shape A" || (test -d apps/golf/design && echo "Shape B" || echo "Unknown — ask user")
```

If the cwd is a swarm worktree (`~/.superset/worktrees/<uuid>/...`), it's the same shape as the underlying repo — the worktree path doesn't change package layout.

**Throughout this doc, paths are written for Shape A.** When you're in Shape B, mentally prefix `apps/golf/` and `packages/golf/`. If you spot any other divergence between the skill and reality, log it (see *Skill-drift tracking* at the bottom).

## On invocation, ALWAYS do these in order

1. **Detect the repo shape** (one-liner above). Pick the path set you'll use throughout the session.

2. **Load the five base skills** via the Skill tool, in this order. These are not optional — even a "quick" design ask should load them so the variant defaults and anti-slop directives are active:
   - `/dev:design` — orchestrator workflow (mock-first decisions, app/platform detection, persistent tunnels)
   - `/impeccable:impeccable` — anti-AI-slop directives (auto-reads `packages/ui/.impeccable.md` in Shape A)
   - `/taste:taste-skill` — high-agency frontend rules (typography bans, motion principles, layout diversification)
   - `/ui-ux-pro-max:ui-ux-pro-max` — palette/font/component recommendation (mainly at the *exploration* phase; not every iteration)
   - `/huashu-design` — HTML-native prototype + 5-dimension review + 20 design philosophies (use for hi-fi mocks, slide-style flows, motion stories)

   You can fire all five Skill calls in a single message — they're independent.

3. **Read the system docs.** In this exact order (Shape A paths shown):
   - `apps/design/README.md` — workflow + structure + sync model
   - `packages/ui/HARD-RULES.md` — the 29 non-negotiables
   - `packages/ui/DESIGN-SYSTEM.md` — token spec, material tiers, motion
   - `packages/ui/SIZING.md` — typed prop cheat sheet for every primitive
   - `packages/ui/VOICE.md` — copy rules ("bookkeeper meets editorial"; the explicit banned-phrase list)
   - `packages/ui/.impeccable.md` — brand voice + design context
   - `packages/ui/SCAFFOLD-NOTES.md` — what's shipped, what's planned

4. **Read at least one reference flow before composing JSX.** This is the step the agent gets wrong most often: respecting tokens but ignoring the signature compositions. The legacy `flows/round/` has been **split into `flows/in-round/`, `flows/pre-round/`, `flows/post-round/`** — open the one nearest to your task plus `flows/shell/main.tsx`. Skim how `<PageHeader italicTail>`, `<Card variant="solid">`, and ledger-hairline list rows are composed. Match that vocabulary — don't reinvent it.

5. **Acknowledge with one line.** "Studio loaded. v0.X — N primitives shipped. {rolling-flow-list}." Then wait for the user's actual ask. *Exception:* if the user already stated the ask in the same turn that invoked the skill, skip the wait and proceed to step 6 of *When the user invokes you with a vague ask* (multi-variant exploration).

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

### The studio loop (Vite-native)

```
1. Edit primitive in packages/ui/src/components/<Name>/<Name>.web.tsx
2. Vite HMR pushes the change to the browser in <100ms (no rebuild step)
3. Verify in any flow that uses it (the library kit auto-surfaces it)
4. Run pnpm --filter @bokendell/golf-ui studio:lint (must be 0 errors)
5. When promoting a flow's artboard to a kit:
   - Copy main.tsx contents to kits/<surface>/main.tsx
   - Identify any new className combos used >once → become new primitives
   - Implement those primitives in golf-ui first, refactor the kit after
```

The studio is `Vite v8 + @vitejs/plugin-react + @tailwindcss/vite`. Each flow / kit is a multi-page Vite entry — `<folder>/index.html` references `<folder>/main.tsx`. Vite auto-discovers entries; the studio root auto-discovers `meta.json` files via `import.meta.glob`. **No config edit needed** when a new flow or kit lands.

### Mental model: flows are the workshop, kits are the showroom

| | Flow | Kit |
|---|---|---|
| Purpose | Exploration — many variants, accumulating history | Canonical truth — one version, edited in place |
| className combinations not exposed by a primitive | Allowed (workshop) | **BANNED** (HARD-RULES rule 25) |
| Required files | `index.html` · `main.tsx` · `meta.json` · `README.md` · `decisions.md` | `index.html` · `main.tsx` · `meta.json` |

**Promotion** = picking a winning variant in a flow, adding any repeated className combo as a new primitive in `@bokendell/golf-ui`, then refactoring the kit to consume only primitives. The flow stays as institutional memory.

### Kit categories

- `reference` — documentation of the system (`kits/tokens/`, `kits/library/`, `kits/comparison/`, `kits/motion/`).
- `surface` — canonical "this is what the app looks like now" (future: `kits/mobile/`, `kits/admin/`, `kits/marketing/`).

### Current inventory (Shape A)

The current `apps/design/flows/` set:

```
admin · auth · chat · friends · home · in-round · live-activity · marketing ·
notifications · onboarding · post-round · pre-round · profile · search ·
share-{invite,join-code,link-text,og-cards,receipt,wrapped} · shell · states ·
stats · transitions · widgets · widgets-lock-screen
```

Kits:

```
apps/design/kits/
├── tokens/          # reference — every token from @bokendell/golf-ui/tokens, runtime
├── library/         # reference — every primitive · sections/<Name>.tsx (glob) · PreviewFrame mobile/web toggle
├── comparison/      # reference — primitive vs. bundle preview iframe
└── motion/          # reference — motion catalog
```

When the user asks for a "new flow," scaffold via:
```bash
pnpm swarm design new-flow --slug <slug> --app golf
# scaffolds index.html · main.tsx · meta.json · README.md · decisions.md
```

### meta.json — required for every flow + kit

```json
{ "title": "...", "subtitle": "...", "category": "reference|surface|rolling|decision", "order": N, "status": "shipped|in-flight|archived" }
```

Drives the studio root's listing. Without it, the page won't surface on `/`.

### decisions.md — append-only log per flow

Newest entry on top, `## YYYY-MM-DD · short title` headers. The README captures **current state**; decisions.md captures **the path**. Never edit a past entry — supersede with a new dated one.

### URL state for shareable views

`apps/design/lib/url-state.ts` (or `src/lib/`) exposes:
- `useUrlTheme()` — `?theme=light|dark` (already wired into every studio entry)
- `useUrlValue(key, default)` — single param
- `useArtboardState(namespace, key, default)` — namespaced (use when two artboards on one canvas need state)

Pasting a URL = sharing the view. Zero backend; no localStorage (cofounder won't see edits made on your laptop).

### Mounting + Vercel Toolbar

Every entry calls `mountStudio(<App />)` from `lib/mount.tsx`. This auto-mounts the Vercel Toolbar (Figma-style commenting) on preview deploys and skips it everywhere else. Never call `createRoot` directly in studio entries.

### Tokens + fonts come from the package, not the studio

`apps/design/lib/studio.css` imports `@bokendell/golf-ui/tokens.css` and `@bokendell/golf-ui/fonts.css`. The `.ttf` files live in `packages/ui/src/tokens/fonts/`. The studio has **zero** brand assets of its own.

### Sync with Claude Design

```bash
# pull a bundle they sent us:
pnpm swarm design unpack <bundle.tar.gz> --app golf --slug <slug>
# → archives slim tarball, extracts to claude-design/latest/ (THROWAWAY — never reference from flows)

# push a flow back to them:
pnpm --filter @bokendell/golf-design pack             # vite singlefile build
pnpm swarm design pack --flow <name> --app golf       # produces a tar.gz at apps/design/.out/
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

### The `00-sketch-index.tsx` artboard

Every flow's `main.tsx` gets a "00 · Sketch index" DCSection with **one iPhone-shaped artboard per round** (`v1`, `v2`, …). Auto-discovery via Vite glob in main.tsx:

```ts
const mods = import.meta.glob("./sketch/*.html");
```

The artboard component lives at `flows/<slug>/sections/00-sketch-index.tsx`. Paywalls and in-round both implement it. **Vite globs evaluate at build time** — adding a new sketch file requires a dev-server restart to appear in the index (HMR alone won't update the glob).

**Promotion candidate (drift entry):** the per-flow `<SketchIndex>` should be promoted to `@bokendell/design` as a framework chrome component so every flow gets it for free.

## Known scaffolding issues (workarounds)

These are CLI / framework bugs to know about. Don't get burned by them.

### `swarm design new-flow --app golf` writes to wrong path in standalone repos

**Bug:** the CLI hardcodes `apps/<app>/design/flows/` even in this standalone repo where flows live at `apps/design/flows/`. Running `pnpm swarm design new-flow --slug paywalls --app golf` in Shape A creates an unwanted `apps/golf/` directory.

**Workaround:** scaffold manually by copying from an existing flow:

```bash
mkdir -p apps/design/flows/<slug>/{sections,sketch}
cp apps/design/flows/onboarding/{meta.json,index.html,README.md,decisions.md} \
   apps/design/flows/<slug>/
cp apps/design/flows/onboarding/sketch/_shared.css \
   apps/design/flows/<slug>/sketch/
# then edit meta.json title / subtitle / order, and start main.tsx from in-round/main.tsx as a template
```

### Date prefix on flow slugs is noisy

The CLI auto-prepends `YYYY-MM-DD-` to scaffolded flow slugs. **The existing flows in the repo don't use it** (`onboarding`, `chat`, `in-round`, `pre-round`, etc.). After scaffolding, rename away the prefix:

```bash
mv apps/design/flows/2026-05-20-paywalls apps/design/flows/paywalls
```

(Or just don't use the CLI — manual scaffold above.)

### Tailwind v4 `@source` globs in `apps/design/lib/studio.css` use Shape A paths

Standalone repos (Shape A) need these paths:

```css
@source "../../../packages/ui/src/**/*.{ts,tsx}";
@source "../../../node_modules/@bokendell/design/src/**/*.{ts,tsx}";
@source "../../../node_modules/@bokendell/ui/src/**/*.{ts,tsx}";
```

The original CLI scaffold writes Shape B paths (`packages/golf/ui`, etc.) which silently break Tailwind class generation in standalone repos — chrome (StudioNav, UserMenu, DesignToolbar) renders unstyled and invisible. Verify these paths exist before assuming Tailwind is working.

## Animation stack — when to reach for what

Tobacco uses a four-tier stack. Different tool per tier; none try to be all four. Load the **`motion-stack`** skill (sibling in the marketplace) for the full decision tree; the short version:

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

For dense lists (recents-as-ledger, scoreboard, settle-up), drop the cards entirely and use `<button>` rows with `border-b border-rule last:border-b-0` — the paper-invoice metaphor. See the `LedgerRow` pattern in `apps/design/flows/pre-round/sections/` or `apps/design/flows/in-round/sections/`.

### 3. Shell → wrap full-frame screens in a Screen primitive

`flows/shell/main.tsx` and `flows/in-round/sections/_shell.tsx` show the pattern. New per-app sub-flows (onboarding, auth, settings) should each have a sibling Screen primitive (`<OnboardingScreen header footer>`, etc.) rather than inlining a sticky CTA + gradient + safe-area in every screen. The Screen primitive owns the dynamic-island spacer + safe-area + chrome slot.

### 4. Auth / brand buttons → `<Button>` with monochrome glyphs

Apple/Google/etc. auth buttons should reuse the `<Button>` primitive (`primary` for the recommended path, `secondary` for the rest). Logos go in `<span className="text-ink">` as **monochrome SVG** — never the full-color brand logo (Google's red-yellow-green-blue G, Apple's literal black on pure white). The amber accent appears **once or twice per screen**, not on every CTA.

### 5. Numbers → Geist Mono with `tabular-nums`

Anything that can change — money, scores, distances, step counters (`01 / 05`), timers — uses `font-data` (Geist Mono) with `tabular-nums`. Money uses `<MoneyDisplay amount showSign>` so the U+2212 minus and the up/down/flat tone are guaranteed. Hyphen-minus on a negative dollar is a smell.

### 6. Copy → check `VOICE.md` before writing UI strings

No `Let's get started!`, no `Awesome!`, no `Powered by AI`, no emoji, no exclamation marks. The Caddy talks like a smart sports columnist who knows your handicap. Sentence case for UI, all-caps only for ≤11px Geist Mono eyebrows / chips.

### 7. Read a current flow before you write the kit

`apps/design/flows/in-round/sections/*.tsx`, `pre-round/sections/*.tsx`, and `shell/main.tsx` are the canonical vocabulary references. If the JSX you're about to write doesn't look like that file, you're inventing — go re-read it.

### 8. Use `sketch/` for pre-system exploration, not `main.tsx`

Every flow has a `sketch/` subfolder for **pure-HTML scratch work**: aesthetic vocabularies that don't have primitives yet, editorial moments, marketing-y artifacts, or unmodified Claude Design bundle drops. Sketches `@import` `_shared.css` which pulls in `@bokendell/golf-ui/tokens.css` + `fonts.css` + `utilities.css`, so the `.t-display-lg` / `.tone-up` / `.bg-bg-elev` classes resolve to real OKLch tokens and real brand fonts.

```bash
cp sketch/_template.html sketch/01-my-idea.html
# open at http://127.0.0.1:5173/flows/<flow>/sketch/01-my-idea.html
```

**Rules:**
- Sketches are evidence, not source. They never promote to a kit directly — port to TSX in `main.tsx` if kept, then link the sketch from `decisions.md`.
- HARD-RULES 18–24 still apply (no `border-left` stripes, no gradient text, no emoji, no `#000`/`#fff`).
- Don't put a sketch's inline `<style>` block past ~30 lines without asking yourself: is this a missing primitive?

**`main.tsx` (TSX canvas)** is for compositions of existing primitives — the path that promotes cleanly. **`sketch/` (HTML)** is for inventing the shapes the system doesn't have yet. Most flows live mostly in `main.tsx`; use sketches when you genuinely need freedom.

## DCSection / DCArtboard rules — the things that bite

These cost an iteration loop each time they fire. Internalize them:

- **`DCSection` reads only DIRECT `DCArtboard` children.** Walks `React.Children.toArray(children)` and filters via `isDCArtboard`. A wrapper component (`<Row>`, `<Group>`) flattens to one non-artboard element and gets filtered out — section renders the title but zero artboards. Always **inline** the artboards as direct children, or use a helper that returns `Array<DCArtboardElement>` and spread it.
- **React Fast Refresh requires every top-level statement in an entry file to be a component or a hook.** Bare expressions (`void Foo;`, `console.log(...)`, `const x = computed();`) break the "consistent components" check and force a cold module reload on every edit (you'll see `Could not Fast Refresh ("true" export is incompatible)` in the dev log). Delete bare expressions — comment out the import or use the value inside a component.

## Mandatory checks before claiming work is done

Run all of these. Do not assume; verify.

```bash
pnpm --filter @bokendell/golf-design build            # vite build — must succeed
pnpm swarm design lint --app golf                     # 0 errors required, warnings noted
pnpm --filter @bokendell/golf-design check-types      # tsgo must pass
pnpm --filter @bokendell/golf-ui check-types          # tsgo must pass
pnpm --filter @bokendell/golf-design test             # vitest must pass
```

If you wrote a new primitive, also verify:
- It has `Name.variants.ts` + `Name.web.tsx` + `Name.native.tsx` + `index.ts`
- The component is exported from `src/index.ts`
- A JSDoc with at least one `@example` is present
- The primitive has its own section file at `apps/design/kits/library/sections/<Name>.tsx` (auto-discovered by the library kit — `meta` export + default component)

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
