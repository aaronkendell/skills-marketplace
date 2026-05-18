---
name: golf-design-studio
description: >
  Use this skill for ANY design work in `apps/golf/design/`,
  `packages/golf/ui/`, `packages/shared/design/`, or `apps/golf/mobile/`.
  It bundles `/design`, `/impeccable`, `/taste-skill`, `/ui-ux-pro-max`,
  and `/huashu-design`, then layers in the Tobacco / Warm-Black brand
  context, the current primitive catalog, the studio workflow, and the
  hard rules. Triggers when the user mentions: design app, design studio,
  primitives, mocks, flows, kits, "redesign a screen", "build a primitive",
  "migrate to golf-ui", or invokes `swarm design *` commands. Use it
  INSTEAD of the generic /design skill whenever the work is in the golf
  monorepo.
---

# Golf Design Studio — Skill

You are operating inside the Tobacco / Warm-Black design system. The studio is the canvas where designs are explored; `@bokendell/golf-ui` is the canonical source for every styled component; `apps/golf/mobile` is the consumer.

## On invocation, ALWAYS do these in order

1. **Verify the five base skills are installed**, then load each via the Skill tool, in this order:
   - `/design` — the orchestrator workflow (mock-first decisions, app/platform detection, persistent tunnels) *(this plugin)*
   - `/impeccable` — the anti-AI-slop directives (auto-reads `packages/golf/ui/.impeccable.md`) *(upstream: [pbakaus/impeccable](https://github.com/pbakaus/impeccable))*
   - `/taste-skill` — high-agency frontend rules (typography bans, motion principles, layout diversification) *(upstream: [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill))*
   - `/ui-ux-pro-max` — palette/font/component recommendation (only at the *exploration* phase, not on every iteration) *(upstream: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill))*
   - `/huashu-design` — HTML-native prototype + 5-dimension review + 20 design philosophies (use for hi-fi mocks, slide-style flows, motion stories) *(upstream: [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design))*

   **Install check** — if any external skill is missing, surface the install
   command (full table in `references/design-stack.md`) and stop until the
   user installs it:
   ```bash
   ls ~/.claude/plugins/cache/bokendell-skills/taste/*/skills/ 2>/dev/null  # taste
   ls ~/.claude/plugins/cache/impeccable/impeccable/*/         2>/dev/null  # impeccable
   ls ~/.claude/plugins/cache/ui-ux-pro-max-skill/*/*/         2>/dev/null  # ui-ux-pro-max
   ls ~/.claude/skills/huashu-design/SKILL.md                  2>/dev/null  # huashu-design (user-scope)
   ```

2. **Read the system docs.** In this exact order:
   - `apps/golf/design/README.md` — workflow + structure + sync model
   - `packages/shared/design/README.md` — framework + extension model
   - `packages/golf/ui/HARD-RULES.md` — the 29 non-negotiables
   - `packages/golf/ui/DESIGN-SYSTEM.md` — token spec, material tiers, motion
   - `packages/golf/ui/VOICE.md` — copy rules ("bookkeeper meets editorial"; the explicit banned-phrase list)
   - `packages/golf/ui/.impeccable.md` — brand voice + design context
   - `packages/golf/ui/SCAFFOLD-NOTES.md` — what's shipped, what's planned

3. **Read at least one reference flow before composing JSX.** This is the step the agent gets wrong most often: respecting tokens but ignoring the signature compositions. Open `apps/golf/design/flows/round/sections/00-entry.tsx` AND `_shell.tsx` and skim them. See how `<PageHeader italicTail>`, `<Card variant="solid">`, and ledger-hairline list rows are composed. Match that vocabulary — don't reinvent it.

4. **Acknowledge with one line.** "Studio loaded. v0.X — N primitives shipped. {rolling-flow-list}." Then wait for the user's actual ask.

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

Always check `packages/golf/ui/SCAFFOLD-NOTES.md` for the live list. The shape:

| Tier | Primitives |
|---|---|
| **v0.1 shipped** | `Button` · `Text` · `Badge` · `Glass` · `PillInput` |
| **v0.2 layout** | `Box` · `Stack` · `Spacer` · `Divider` · `Card` · `Sheet` · `IconButton` · `Avatar` |
| **v0.2 domain (GOLF-414)** | `ScoreDisplay` · `RelativeScore` · `MoneyDisplay` · `GameBadge` · `PlayerChip` · `PlayerAvatarStack` · `ScoreStepper` · `LiveIndicator` · `HoleHeader` · `SectionHeader` |
| **v0.3 planned** | `TabBar` · `BottomSheet` · `Toast` · `Sticky` · `ChipRow` · `SegmentedToggle` · `NumberStepper` · `RoundBar` · `HoleHero` · `HoleStrip` · `GameSlipRow` · `GameStrip` · `StandingsRow` · `Scorecard` · `CaddyAvatar` · `CaddyBubble` · `WrappedCard` · `ReceiptCard` · `ChatBubble` |

When you find yourself writing the same className combination twice in a flow, **stop and add it as a primitive.** That's the discipline that keeps the system honest.

### The studio loop (Vite-native)

```
1. Edit primitive in packages/golf/ui/src/components/<Name>/<Name>.web.tsx
2. Vite HMR pushes the change to the browser in <100ms (no rebuild step)
3. Verify in flows/2026-05-12-primitives-test/ + any flow that uses it
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

- `reference` — documentation of the system (`kits/tokens/`, `kits/library/`, `kits/comparison/`).
- `surface` — canonical "this is what the app looks like now" (future: `kits/mobile/`, `kits/admin/`, `kits/marketing/`).

### Current inventory

```
apps/golf/design/
├── kits/
│   ├── tokens/          # reference — every token from @bokendell/golf-ui/tokens, runtime
│   ├── library/         # reference — every primitive · sections/<Name>.tsx (glob) · PreviewFrame mobile/web toggle
│   └── comparison/      # reference — primitive vs. bundle preview iframe
└── flows/
    ├── round/                            # rolling — legacy format, GOLF-415 migration excluded from check-types
    ├── shell/                            # rolling — header chrome + nav morph + Caddy FAB
    └── 2026-05-12-primitives-test/       # proof-of-life: every element is a real GolfUI primitive

packages/shared/design/                   # framework: canvas, devices (IOSDevice + WebFrame), hooks, mount, kit, studio-root
packages/shared/ui/                       # @bokendell/ui — shared shadcn host for web-only primitives (Dialog, Command, ComboBox, DataTable, Form, Calendar, …)
packages/golf/ui/src/web/                 # golf-branded web compositions (currently empty)
```

When the user asks for a "new flow," scaffold via:
```bash
swarm design new-flow <slug> --app golf
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

`design-studio/lib/url-state.ts` exposes:
- `useUrlTheme()` — `?theme=light|dark` (already wired into every studio entry).
- `useUrlValue(key, default)` — single param.
- `useArtboardState(namespace, key, default)` — namespaced (use when two artboards on one canvas need state).

Pasting a URL = sharing the view. Zero backend; no localStorage (cofounder won't see edits made on your laptop).

### Mounting + Vercel Toolbar

Every entry calls `mountStudio(<App />)` from `lib/mount.tsx`. This auto-mounts the Vercel Toolbar (Figma-style commenting) on preview deploys and skips it everywhere else. Never call `createRoot` directly in studio entries.

### Tokens + fonts come from the package, not the studio

`studio.css` imports `@bokendell/golf-ui/tokens.css` and `@bokendell/golf-ui/fonts.css`. The 4 `.ttf` files live in `packages/golf/ui/src/tokens/fonts/`. The studio has **zero** brand assets of its own.

### Sync with Claude Design

```bash
# pull a bundle they sent us:
swarm design unpack <bundle.tar.gz> --app golf --slug <slug>
# → archives slim tarball, extracts to claude-design/latest/ (THROWAWAY — never reference from flows)

# push a flow back to them:
pnpm --filter @bokendell/golf-design pack             # vite singlefile build
swarm design pack --flow <name> --app golf            # produces a tar.gz at apps/golf/design/.out/
```

`claude-design/latest/` gets overwritten on every unpack. If a flow needs material from a bundle, **copy** it into the flow folder at creation time (HARD-RULES rule 28).

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

For dense lists (recents-as-ledger, scoreboard, settle-up), drop the cards entirely and use `<button>` rows with `border-b border-rule last:border-b-0` — the paper-invoice metaphor. See `apps/golf/design/flows/round/sections/00-entry.tsx` `LedgerRow`.

### 3. Shell → wrap full-frame screens in a Screen primitive

The round flow uses `<RoundScreen header chrome>` (`flows/round/sections/_shell.tsx`). New per-app sub-flows (onboarding, auth, settings) get a sibling — extract `<OnboardingScreen header footer>` etc. rather than inlining a sticky CTA + gradient + safe-area in every screen. The Screen primitive owns the dynamic-island spacer + safe-area + chrome slot.

### 4. Auth / brand buttons → `<Button>` with monochrome glyphs

Apple/Google/etc. auth buttons should reuse the `<Button>` primitive (`primary` for the recommended path, `secondary` for the rest). Logos go in `<span className="text-ink">` as **monochrome SVG** — never the full-color brand logo (Google's red-yellow-green-blue G, Apple's literal black on pure white). The amber accent appears **once or twice per screen**, not on every CTA.

### 5. Numbers → Geist Mono with `tabular-nums`

Anything that can change — money, scores, distances, step counters (`01 / 05`), timers — uses `font-data` (Geist Mono) with `tabular-nums`. Money uses `<MoneyDisplay amount showSign>` so the U+2212 minus and the up/down/flat tone are guaranteed. Hyphen-minus on a negative dollar is a smell.

### 6. Copy → check `VOICE.md` before writing UI strings

No `Let's get started!`, no `Awesome!`, no `Powered by AI`, no emoji, no exclamation marks. The Caddy talks like a smart sports columnist who knows your handicap. Sentence case for UI, all-caps only for ≤11px Geist Mono eyebrows / chips.

### 7. Read the round flow before you write the kit

`apps/golf/design/flows/round/sections/*.tsx` is the canonical vocabulary reference. If the JSX you're about to write doesn't look like that file, you're inventing — go re-read it.

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
swarm design lint --app golf                          # 0 errors required, warnings noted
pnpm --filter @bokendell/golf-design check-types      # tsgo must pass
pnpm --filter @bokendell/golf-ui check-types          # tsgo must pass
pnpm --filter @bokendell/design check-types           # tsgo must pass
pnpm --filter @bokendell/golf-design test             # vitest must pass
```

If you wrote a new primitive, also verify:
- It has `Name.variants.ts` + `Name.web.tsx` + `Name.native.tsx` + `index.ts`
- The component is exported from `src/index.ts`
- A JSDoc with at least one `@example` is present
- The primitive has its own section file at `design-studio/kits/library/sections/<Name>.tsx` (auto-discovered by the library kit — `meta` export + default component)
- The primitive renders in `flows/2026-05-12-primitives-test/main.tsx` (add it to the proof-of-life sandbox)

If you wrote in a kit, also verify:
- No className combination is used >1 time without being a primitive variant. If you see one, extract a primitive FIRST, then land the kit edit (HARD-RULES rule 25).

## Anti-patterns — instant reject if you see these in studio JSX or golf-ui code

(Mirrors `HARD-RULES.md` rules 18–24.)

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

## When the user invokes you with a vague ask

If they say "let's design X" or "make this look better," DO THIS in order:

1. Confirm the app context is golf (this skill) — if it's portfolio or hive, hand off to `/design` instead.
2. Confirm the platform: mobile (default) or admin (Next.js) or marketing (future).
3. Detect whether this is exploration (no existing artifact yet → start in design-studio) or refinement (existing screen → review against current rules and propose changes).
4. For exploration: run /design's mock-first decision protocol — generate visual options, never describe in prose.
5. For refinement: read the existing screen, lint it, show diff vs the rules, propose specific changes.

## When you're done

End with:
- The **lint exit code** (must be 0 for completed work)
- The **set of files touched**
- Any **new primitives added** (and whether they're exported from `src/index.ts`)
- Any **TODOs identified** for follow-up Linear tickets
- **Never auto-commit.** Only `git add` per the user's standing rule.

## Reference files (load on demand)

- `packages/golf/ui/SIZING.md` — **typed enum cheat sheet for every primitive** — read this BEFORE composing screens
- `packages/golf/ui/design-studio/README.md` — studio workflow
- `packages/golf/ui/HARD-RULES.md` — the 24 rules
- `packages/golf/ui/DESIGN-SYSTEM.md` — token + material spec
- `packages/golf/ui/CONTRIBUTING.md` — how to add a primitive
- `packages/golf/ui/.impeccable.md` — brand voice + design context (auto-loaded by /impeccable)
- `packages/golf/ui/docs/migration-from-mobile-ui.md` — the migration ladder
- `apps/golf/mobile/src/lib/components/` — existing components to match API for one-import swaps
- `docs/apps/golf/design/` — current published design docs (will be replaced by `vision/` content when migration ships)

## Lint commands

```bash
pnpm --filter @bokendell/golf-ui studio:lint            # design-lint over studio flows + kits
pnpm --filter @bokendell/golf-ui studio:app-arch-lint   # arch rule over apps/golf/{mobile,admin,marketing}/src
```

`studio:app-arch-lint` enforces HARD-RULES across app code: bans raw colors, banned className tokens (`bg-blue-500` etc.), arbitrary `[Npx]` in className, `react-native` imports of styled elements, direct `mobile-ui` imports from screens, `StyleSheet.create` with visual values. Honors `// HARD-RULES exception: <reason>` comments.
