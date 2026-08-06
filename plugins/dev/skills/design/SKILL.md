---
name: design
description: >
  Unified design orchestrator for all apps (golf, portfolio, hive). Use when building UI
  components, designing screens, creating mocks, reviewing design compliance, updating design
  tokens, exploring color palettes or typography, implementing animations/motion, or doing any
  visual/frontend work. Also use when the user mentions "design system", "make it look better",
  "fix the UI", "design review", "polish this", "update the theme", or references any app's
  visual style. Also use when the user says design studio, golf design studio, studio sketch,
  flow sketch, primitive library, or app-specific design studio. Triggers proactively on ANY
  frontend/mobile file changes to ensure design compliance. This skill replaces golf-ui and is
  the primary studio router for every app, including golf.
disable-model-invocation: false
---

# Design Orchestrator

You manage all design work across three apps: **golf** (Fairway), **portfolio**, and **hive**. Instead of the user needing to know which of 5+ design skills to invoke, you detect context and pull in the right references automatically. This is also the cross-app replacement for the old direct `golf-design-studio` entrypoint.

## How This Skill Works

This skill is a thin orchestrator. It:
1. Detects which app and platform (web/mobile) from the files being touched
2. Reads the repo's root `DESIGN.md` when present (below), then fills gaps from `references/apps/<app>.md`
3. Invokes **external design skills** under the hood for specialized work (see below)
4. Applies motion, anti-pattern, and quality principles consistently

The heavy lifting comes from installed skills — this skill coordinates them and adds your project-specific standards.

### `DESIGN.md` is the token source of record

When a repo has a root `DESIGN.md`, read it FIRST and prefer its values over any
token table in this skill or in an app pack. It follows the
[DESIGN.md spec](https://github.com/google-labs-code/design.md): YAML
frontmatter carrying `colors`, `typography`, `rounded`, `spacing` (and
optionally `components`), then up to eight markdown sections in a fixed order.

It outranks the app packs for one reason: in golf it is **generated** from
`packages/tokens/src/theme-source.ts` and diffed by `tokens:check` in CI, so it
cannot disagree with the tokens the app actually ships. The tables in
`references/apps/<app>.md` are hand-maintained and can lag — treat them as
context and fallback, not as truth, wherever DESIGN.md covers the same ground.

**Never hand-edit a generated `DESIGN.md`.** Its Overview says so and the CI
diff rejects it. Change `theme-source.ts`, then run
`pnpm --filter @bokendell/golf-tokens tokens:gen`.

Two things it deliberately does not carry — do not read absence as permission:

- **Components.** golf lists the section in `omitted` because the spec allows
  only 8 component sub-tokens (`backgroundColor`, `textColor`, `typography`,
  `rounded`, `padding`, `size`, `height`, `width`) and golf's components carry
  shadow, motion, glass and focus-ring state that none of those express.
  Component truth stays in golf-ui and the flow sketches.
- **Dark values.** The frontmatter carries the LIGHT palette only — the spec has
  a single palette. Both modes are tabulated under `## Colors` in the body, so
  read that table before assuming a token is theme-independent.

Its `## Do's and Don'ts` is derived from `packages/ui/HARD-RULES.md`, which
remains the enforced source and carries the rationale and accepted alternative
for each rule. Read HARD-RULES when a rule needs interpreting, not just obeying.

## Required external design skills (check before invoking)

This orchestrator delegates the actual taste/craft/finishing/heuristics/HTML-prototyping work to upstream resources. Before any design work, verify they are installed. The canonical reference (sources, roles, exact install commands) is at:

→ `~/repos/bokendell/skills-marketplace/references/design-stack.md` (or in the cache at `~/.claude/plugins/cache/bokendell-skills/references/design-stack.md`)

**Quick install summary:**

| Skill | Install command |
|---|---|
| `/taste:design-taste-frontend` (v2; v1 fallback `/taste:design-taste-frontend-v1`) | `/plugin install taste@bokendell-skills` (Leonxlnx/taste-skill, sourced live). NOTE the invocable name is the SKILL.md `name:` (`design-taste-frontend`), NOT the folder `taste-skill`. The marketplace `skills` array must list each skill DIRECTORY — pointing at the bare `./skills` container registers zero skills. |
| `/impeccable:impeccable` | `/plugin marketplace add pbakaus/impeccable` + `/plugin install impeccable@impeccable` |
| `/emil-design-eng` + `/apple-design` (+ on-demand `/improve-animations`, `/review-animations`, `/animation-vocabulary`) | `npx skills add emilkowalski/skill` — installs all 5 as skills.sh universal skills (`.agents/skills/`, symlinked for Claude Code, tracked in `skills-lock.json`). `emil-design-eng` = Emil Kowalski's polish/component/motion philosophy; `apple-design` = Apple fluid-motion + materials + typography. The two are the always-load craft floor for app UI; the animation trio is motion-work-only. |
| `/ui-ux-pro-max` | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` + `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| `/huashu-design` | `git clone https://github.com/alchaincyf/huashu-design ~/.claude/skills/huashu-design` *(upstream isn't a plugin — installs as user-scope skill; `git pull` to update)* |

**Verification:** quickly check each is present —
```bash
ls ~/.claude/plugins/cache/bokendell-skills/taste/*/skills/ 2>/dev/null
ls ~/.claude/plugins/cache/impeccable/impeccable/*/         2>/dev/null
ls ~/.claude/plugins/cache/ui-ux-pro-max-skill/*/*/         2>/dev/null
ls ~/.claude/skills/huashu-design/SKILL.md                  2>/dev/null
ls ~/.claude/skills/{emil-design-eng,apple-design}/SKILL.md 2>/dev/null   # Emil (skills.sh)
```

If any is missing, **stop and surface the install command to the user** rather than degrading silently.

## App Detection

Detect the app from file paths or user mention:

| Signal | App |
|--------|-----|
| `apps/golf/`, `packages/golf/`, "fairway", "golf" | **golf** |
| `apps/portfolio/`, `packages/portfolio/`, "portfolio" | **portfolio** |
| `apps/hive/`, `packages/hive/`, "hive", "agents" | **hive** |
| `packages/shared/ui/` | **shared** (load all app tokens for comparison) |

Detect platform:

| Signal | Platform |
|--------|----------|
| `apps/*/mobile/`, `.tsx` in mobile paths, "mobile", "native", "expo" | **mobile** (React Native) |
| `apps/*/app/`, `apps/*/admin/`, "web", "admin", "dashboard", "next" | **web** (Next.js) |

**If the app is ambiguous** (shared packages, no path signal, new surface): ASK which app before composing — the apps share one workflow but different tokens, and guessing the wrong pack poisons everything downstream. Each app's pack lives at `references/apps/<app>.md`; the pack also names where that app's **living design law** (flow `decisions.md` files) and **fidelity anchors** live.

## Studio Router

When the prompt mentions "design studio", "studio sketch", "flow", "primitive", "kit", or
`swarm design`, stay in this `design` skill and load the detected app's studio pack:

| App | Studio pack |
|---|---|
| golf | `plugins/dev/skills/golf-design-studio/SKILL.md` as the golf app pack |
| portfolio | `references/apps/portfolio.md` plus app-local `apps/design` docs if present |
| hive | `references/apps/hive.md` plus app-local `apps/design` docs if present |

`golf-design-studio` remains available as a compatibility alias because people remember that name,
but it should delegate here. New app-specific studio behavior belongs either in this router or in an
app pack, not in a new per-app top-level skill.

If the app cannot be inferred from path or product words, ask one short question before composing.

## Ground Truth Protocol (do this before composing ANY visual)

Skills carry principles; the project's achieved taste lives in its **shipped screens** and its
**accumulated decision law**. Both are mandatory inputs:

1. **Shipped-app screenshots.** Read the newest set from the app's screenshot folder (golf:
   `docs/design/app-screens/`, see the app pack; tracked in GOLF-462). If the folder is
   missing, stale (>2 weeks or the user says the UI changed), or doesn't cover the surface
   you're designing — ASK the user for 3–5 current screenshots before producing anything.
   Never compose from memory of older mocks; the live app outranks every prior design artifact.
2. **The decision law.** Read the relevant flow's `decisions.md` (append-only, newest-first)
   before composing. Locked rounds are LAW — design inside them, never re-litigate silently.
3. **Fidelity anchors.** Open your work by declaring which shipped artifacts you're matching
   ("anchoring on: Resume Slip, score chips, hole-hero card"). When a brief is vague, ask
   *"which existing screen should this feel like?"* — a named artifact beats any adjective.
4. **Self-verify before delivering.** After building any sketch/board, screenshot it yourself
   with Playwright at phone width (~400px) against the local studio or `file://`, LOOK at it,
   and fix what's broken (floating elements, missing assets, contrast) before the user sees it.
   For web surfaces, prefer driving the running dev server; if the workspace isn't up, ask the
   user to start it rather than skipping verification.
5. **Correction protocol.** When the user says output looks "basic / generic / AI-slop":
   do not iterate adjectives. Ask for (or propose) a concrete in-app artifact as the new
   anchor, then rebuild around that metaphor.

## The Exploration Program (multi-round method for big surfaces)

For any surface bigger than one component (a chat system, a new tab, a redesign), do NOT
one-shot full screens. Run the program:

1. **Order the decisions by dependency** — shell/container first, then the typography/turn
   system, then component families, then composites, then states, then satellite surfaces.
   Publish the order as a board so the user sees what locks when.
2. **Per round: 3–4 GENUINELY different directions** — vary register/material/density, not
   shades of one idea. Same content rendered in every direction so comparison is honest.
   Light AND dark for every variant. Flag your pick with one-line reasoning; honest cons on
   every option (including the pick).
3. **The user picks or mixes; picks become law** — append the lock to the flow's
   `decisions.md` immediately, then design the next round *inside* the locked constraints.
   Constraints compound; that's where the taste comes from.
4. **Go piece by piece** — when a round is still too big (a header, a composer), explode it
   into pieces and explore each piece's variants separately.
5. **Artifacts, not spec-cards.** Records/data render as crafted artifacts native to the
   brand's material world; conversational text stays plain typography. Never default to
   uniform rounded-rect "AI dashboard" cards.

## Studio sketch conventions (the deliverable format)

- Boards are **self-contained HTML** in the flow's `sketches/` dir, importing the studio's
  `shared.css` for real tokens. Register every board in the flow's `sketches.ts` manifest
  and run the design app's `check-types` after.
- Boards must be **interactive where the decision is about behavior**: scroll demos, replay
  buttons, working inputs, tappable state machines. Motion IS spec — show it, don't describe it.
- Every variant in **light + dark**. Respect `prefers-reduced-motion` in every animation.
- Version per decision: new numbered file per iteration, never overwrite history; the flow's
  `decisions.md` records what each round locked.

## Drift protocol (when this skill disagrees with reality)

When repo reality contradicts this skill or an app pack (paths, commands, tokens, components):
1. **Log it** the moment you notice: append to the app's drift file (golf:
   `apps/design/.skill-drift.md`) with date + what's wrong + what reality is.
2. **Feed Skill Watch**: also let `skill-watch` record the deviation. If it is structural
   drift, update the source skill at `~/repos/bokendell/skills-marketplace` in the same session
   (leave changes uncommitted for review) — or explicitly offer if mid-task.
3. **Never silently work around drift** — that's how the next session inherits the bug.

## Mock-First Decisions (THE META-RULE)

**When you need the user to decide between options, build a visual comparison instead of asking a text question.** This applies to this skill and to any skill that delegates decisions through it (`dev-research`, `dev-plan`, `superpowers:brainstorming`, the built-in brainstorming flow inside this skill, etc.).

The rule, in order of preference:

1. **UI decisions → HTML mock showcase with options side-by-side.** Generate a self-contained HTML file with each option as a fully-styled variant using the real app tokens (OKLch colors, actual fonts via Google Fonts CDN, realistic scenario content — actual course names, player names, score values from the domain). Annotate each option with Pro/Con trade-offs so the user can compare quickly. Never describe a layout in prose when you can show it.

2. **Backend / architecture / data-flow decisions → Mermaid diagram.** Draw the options as flowcharts, sequence diagrams, ERDs, or state diagrams. Inline them in the message or in an HTML file that renders Mermaid via the CDN. Show the trade-offs visually — which nodes differ, which arrows flip, which tables appear in Option A but not Option B.

3. **Decision-tree / branching options → comparison table.** Multi-axis choices (e.g. "which game types × which players × which scoring mode") should be rendered as a matrix with checkmarks/X's, not a prose list.

4. **Only fall back to plain text questions when the decision is truly abstract** — tone of voice, naming, yes/no confirms, priority ordering. Never for layout, color, component choice, data flow, schema shape, or flow ordering.

### How to apply it

- Before asking any clarifying question, ask yourself: "could I show this instead of saying it?" If yes, build the mock.
- Generating a mock is cheaper than spending 3 turns clarifying a misunderstanding. Assume text will be misread.
- Use the existing golf/portfolio/hive token files so mocks look like the real app, not a generic preview. Inline the tokens as CSS custom properties at the top of the HTML file (see [references/apps/](references/apps/) for the token values).
- Realistic scenario data: actual course names (Torrey Pines, Pebble Beach), real game types (Nassau, Skins), realistic player names and scores. Never "User A / User B / Player 1".
- Each option gets a Pro/Con block. The user should be able to pick in <30s per comparison.
- **Verify physical space before including elements.** For Dynamic Island / Lock Screen / native widget mocks, calculate the actual point budget: Dynamic Island Compact base = 126pt wide, camera cutout ~24pt, ~22pt padding → ~40pt per side slot. DM Mono at 16pt ≈ 9px/char. If a string overflows the slot, drop the unit or shorten the token, don't inflate the mock's dimensions to make it fit. Include a fit-verification note in the mock showing the math.

### Mock versioning + single persistent tunnel

**File naming — version-per-decision, stored as history:**

- Every decision point gets a numbered file: `docs/planning/<initiative>/mocks/NN-<question-slug>.html`
- Every **iteration on the same decision** (user gives feedback, you refine) gets its own numbered file too: `NN-<question-slug>-v2.html`, `NN-<question-slug>-v3.html`, or just increments the NN prefix if the iteration is substantial enough to feel like a new decision. Never silently overwrite a previous iteration — the file history IS the decision log.
- Example real history:
  - `mocks/01-compact-state.html` — first comparison, 3 variants
  - `mocks/02-variant-a-refined.html` — refinement on the picked variant
  - `mocks/03-refined-decluttered.html` — response to "too cluttered" feedback
- The user should be able to scroll through the folder later and reconstruct why a choice was made, in order.

**Also maintain a `current.html` pointer** in the same folder — always a copy of the newest iteration. This is what the persistent tunnel serves.

**Single persistent tunnel per initiative (not per mock):**

The user only ever looks at one mock at a time. Don't spin up a new tunnel for each iteration — that leaves orphans, burns cache, and forces the user to track multiple URLs. Instead:

1. On the **first** mock of an initiative, generate the numbered file AND copy it to `current.html` in the same folder.
2. Start ONE tunnel serving `current.html`:
   ```bash
   bash .claude/skills/remote-preview/scripts/host.sh \
     docs/planning/<initiative>/mocks/current.html \
     <initiative-slug>-mock
   ```
3. Hand the user the single stable URL: `https://<random-words>.trycloudflare.com/current.html`. This URL stays the same for the whole initiative.
4. On **every subsequent iteration**, write the new numbered file, then `cp <new>.html current.html` to swap the served content. The user refreshes the same URL and sees the new version.
5. Tear the tunnel down with `stop.sh <initiative-slug>-mock` at the end of the decision session (end of the initiative or when the user says they're done reviewing).
6. **Do not create additional tunnels** for later decisions in the same initiative — keep reusing the same one. If the decision topic changes dramatically, you can write a new numbered file and still copy it to the same `current.html`.

This gives the user: one bookmarkable URL, full version history on disk, no tunnel proliferation, and the ability to scroll back through the numbered files after the fact.

### Sharing the mock with the user

Once the mock is written, **do not silently open it or silently tunnel it**. Ask how they want to review:

> "Mock saved to `<path>`. How do you want to review it?
> 1. **Open locally** in your desktop browser (`open <path>`)
> 2. **Host on a tunnel** so you can view from your phone — uses `remote-preview` skill (I'll reuse the existing initiative tunnel if one's already up, or start a fresh one if not)
> 3. **Both**
> 4. **Skip** — I'll describe it here"

Rules:
- Never silently `open` a file or silently start a tunnel. Always ask first.
- If a persistent tunnel already exists for this initiative (check `bash .claude/skills/remote-preview/scripts/list.sh` for a label matching `<initiative-slug>-mock`), **reuse it** — `cp <new>.html current.html` and tell the user to refresh the existing URL. Do not start a second tunnel.
- If no initiative tunnel exists, start one following the single-persistent-tunnel protocol above.
- At the end of the decision session (user says "we're done with mocks" or the initiative moves to implementation), tear the tunnel down with `stop.sh <label>` unless the user explicitly says to keep it running.
- For mobile-specific questions (Dynamic Island, haptics, iOS glass, touch targets) tunneling is especially useful because the mock renders in mobile Safari at real device width. Offer it more proactively in those cases but still wait for consent.

## What to Load by Context

### Always Load
- This skill's core principles (below)
- App-specific tokens: read [references/apps/<app>.md](references/apps/) for the detected app

### For Design Exploration / Research Phase
Invoke these skills via the Skill tool:
- `taste:design-taste-frontend` — high-agency anti-slop directives (typography bans, color calibration, layout diversification, perpetual micro-interactions). Loads the baseline variance/motion/density knobs and the AI-tells blacklist. Load this FIRST — it establishes the taste floor everything else builds on. (v2 is scoped to landing/portfolio/redesign; for multi-step product/app UI use `taste:design-taste-frontend-v1`.)
- `emil-design-eng` — Emil Kowalski's polish/component/motion craft philosophy: the invisible details that make software feel great. Load alongside taste on every design task.
- `apple-design` — Apple's fluid-motion foundations (springs, gestures, sheets, momentum, interruptible transitions, materials, optical typography, reduced-motion). Required for any app/mobile UI or gesture-driven surface.
- `ui-ux-pro-max` — for palette exploration, font pairing, style direction
- `impeccable` — for bold aesthetic choices and polish sub-commands (animate, polish, bolder, distill, etc.)
- **Motion work only:** `improve-animations` (audit + prioritized plan of the codebase's motion, read-only) and `review-animations` (grade animation code against Emil's craft bar). `animation-vocabulary` is a lookup glossary for naming an effect.
- Reference `docs/design/references/` for inspiration from real sites (Linear, Stripe, Apple, etc.)

### For Component Building
Invoke:
- `shadcn` — when building web components (reads components.json, knows your setup)
- `expo-app-design:building-native-ui` — when building mobile components
Read: `docs/design/component-catalog.md` if it exists

### For Screen Building
Read: `docs/design/screen-patterns.md` if it exists
Follow the Container → Screen → Component pattern (detailed in app tokens reference)

### For Design Review
Apply the anti-pattern checklist (below) + app-specific compliance checks from the tokens reference

## Core Design Principles

These apply to ALL apps, ALL platforms. They define what "good" looks like in this monorepo.

### Anti-Generic (from impeccable + impeccable)

Before writing any visual code, commit to a direction. Generic output is the enemy.

**Banned defaults** (these scream "AI generated"):
- Inter, Roboto, Arial, Space Grotesk as primary fonts
- Purple gradient on white background
- Rounded cards in a grid with subtle shadows
- `bounce` easing on everything
- Side borders on tabs instead of bottom indicators
- Dark mode that's just "invert the colors"

**Instead**: Each app has a defined aesthetic direction in its tokens file. Follow it. If none exists yet, ask the user to define one using ui-ux-pro-max before building.

### Motion & Animation

Motion should feel intentional, not decorative. These principles apply cross-platform:

**Web (CSS + Framer Motion)**:
- Prefer CSS `transition` over `@keyframes` — transitions retarget on interruption
- Spring physics for interactive elements: `transition: all 0.35s cubic-bezier(0.32, 0.72, 0, 1)`
- Stagger children by 50ms delay on page/section loads
- Match motion personality to content: playful=bouncy, professional=crisp, data=minimal

**Mobile (Reanimated + Gesture Handler)**:
- Use `withSpring()` for interactive elements (response: 0.9, damping: 15)
- Use `withTiming()` for non-interactive transitions (duration: 200-350ms)
- Every gesture should have visual feedback within 16ms (one frame)
- Respect `AccessibilityInfo.isReduceMotionEnabled` — always check

**Design Variance Per App**:
- **Golf**: variance=4 (refined elegance), motion=6 (engaging but not playful), density=5 (balanced)
- **Portfolio**: variance=3 (clean professional), motion=4 (subtle and smooth), density=4 (airy)
- **Hive**: variance=2 (data-focused), motion=3 (minimal functional), density=6 (information-dense)

**Animated icons before static ones.** For any tappable icon or state-change cue (like/save,
sync/loading, notifications, menu open/close) across any app, check for an animated version
before defaulting to static — this applies to every new screen/sketch, not just exploration.
Web apps built on `@bokendell/ui` get this via `<DynamicIcon name="..." animated />` (a large
Motion-ported registry, falls back to static automatically when a name isn't ported). For
mobile, load the `motion-stack` and `rn-makeitanimated` skills — the latter documents a reusable
keyframe-timeline pattern for porting a new icon or interaction onto Reanimated.

### Component Architecture

All apps share the same structural patterns:

**Component tiers** (where components live):
1. **Shared** (`packages/shared/ui/`) — cross-app, framework-agnostic-ish (shadcn for web, mobile-ui for native)
2. **App Universal** (`apps/<app>/*/src/lib/components/`) — app-specific, used across domains
3. **Domain** (`apps/<app>/*/src/packages/<domain>/components/`) — single domain only

**Component rules**:
- Always accept `className` prop for overrides
- Use CVA (class-variance-authority) for visual variants
- Pure presentation only — no hooks, no API calls, no stores
- Use design token classNames — never hardcode colors
- Export from barrel `index.ts`

**Screen architecture** (Container → Screen → Component):
- Container: hooks + navigation + state composition
- Screen: pure presentation, receives props only, no hooks
- Component: reusable visual elements

### Typography System

Each app defines its own font stack, but all follow the three-voice principle:

| Voice | Purpose | Example (Golf) |
|-------|---------|----------------|
| **Display** | Titles, hero text, brand moments ONLY | Instrument Serif |
| **Body** | All readable text, labels, navigation | Outfit |
| **Data** | Scores, money, stats, badges, timestamps | DM Mono |

Rules:
- Display font is NEVER used for body text
- Data font is ALWAYS used for numerical data
- Labels/badges are ALWAYS uppercase with letter-spacing

### Shared UI Library

`packages/shared/ui/` contains shadcn components used across web apps. Before building a new component, check if it exists:
- `packages/shared/ui/src/components/` — shadcn primitives
- `packages/shared/ui/src/shadcn/` — shadcn configs
- Run: `ls packages/shared/ui/src/components/` to see what's available

### Tailwind Sharing

All web apps (golf admin, portfolio app/admin, hive app) use Tailwind v4 with nearly identical configs. They share `packages/shared/ui/` for content paths. Design tokens CAN be shared via a common CSS layer, but each app applies its own brand colors on top.

## Anti-Pattern Checklist (for Design Review)

Run this checklist during review. These are the 24 most common "AI slop" and quality issues:

**AI Slop Detectors:**
1. Side borders on tabs (should be bottom indicator)
2. Purple/blue gradient hero on white (use app's actual brand)
3. `animation: bounce` on page load elements
4. Dark glowing shadows on dark backgrounds
5. Generic card grid with equal sizing (vary card sizes)
6. Placeholder-style gray text that ships as final
7. Stock-photo-like hero images
8. "Learn More" as the only CTA text

**Quality Checkers:**
9. Line length >75 characters (80ch max for readability)
10. Body text below 16px on mobile (14px min only for secondary)
11. Touch targets below 44x44px
12. Heading hierarchy skipped (h1 → h3 with no h2)
13. No visible focus indicators for keyboard navigation
14. Color as the only differentiator (needs text/icon too)
15. Missing loading skeleton (spinner instead)
16. Missing empty state (blank screen)
17. Missing error state (silent failure)
18. Cramped padding (<12px in cards)
19. Inconsistent border radius within same view
20. Mixed icon styles (outline + filled in same section)
21. Text truncation without tooltip or expansion
22. Horizontal scroll without visual indicator
23. Modal/sheet without close affordance
24. Form without validation feedback

## Creating or Refining a Design System

When the user says "create the design system for [app]", "refine the golf design", "update the portfolio look", or any variant of establishing/updating an app's visual identity, follow this full workflow. This is the most important flow in this skill — it's how every app gets its design foundation.

### Step 1: Understand the Project

Before exploring any visuals, deeply understand what the app IS:

1. **Read existing docs**: start with `docs/MAP.md` (retrieval contract), then `docs/product/prd.md`, `docs/architecture/overview.md`
2. **Scan the codebase**: What screens exist? What components? What's the current visual state?
3. **Read the current reference file**: [references/apps/<app>.md](references/apps/) — what's already defined?
4. **Interview the user** — ask ONE question at a time (superpowers:brainstorming style):
   - What's the emotional tone? (professional, playful, premium, technical, warm, cold)
   - Who is the target user? (golfers, hiring managers, developers)
   - What 2-3 apps/sites feel like what you want? (reference points)
   - What do you explicitly NOT want? (anti-references)
   - Dark-first or light-first?

### Step 2: Explore Reference Design Systems

Read 2-3 reference design systems from `docs/design/references/` based on what fits the app:

| App Direction | Read These References |
|---------------|---------------------|
| Premium/luxury | `apple/`, `superhuman/`, `framer/` |
| Professional/clean | `stripe/`, `linear.app/`, `vercel/` |
| Data-dense/technical | `linear.app/`, `cursor/`, `sentry/` |
| Bold/playful | `spotify/`, `figma/`, `notion/` |
| Developer tools | `cursor/`, `raycast/`, `vercel/` |

Extract the specific tokens you like from each: their color approach, typography choices, spacing philosophy, component styles. Note what works and why.

**Also — required, but manual (no API to auto-check):** before finalizing a new screen or
flow's motion/interaction design, prompt the user to check live reference sites, don't just
skip it silently. Which one depends on the question:

| Question | Site |
|---|---|
| "How do real premium apps animate X interaction?" | [60fps.design](https://60fps.design/) (video gallery, tagged by interaction type) |
| "What's the exact timing/easing on this gesture?" | [spottedinprod.com](https://www.spottedinprod.com/) (60fps iOS clips w/ frame-by-frame + touch heatmaps) |
| "Show me real screens/flows for this layout pattern" | [refero.design](https://refero.design/) (web+iOS, Figma-exportable, **has an official MCP** — `api.refero.design/mcp`, needs Pro) or [mobbin.com](https://mobbin.com/) (bigger mobile-flow library, **has an official MCP** — `api.mobbin.com/mcp`, needs Pro; install via `claude mcp add mobbin --scope user --transport http https://api.mobbin.com/mcp`) |
| One designer's handcrafted motion taste | [khagwal.com/interactions](https://khagwal.com/interactions/) — narrow, not a searchable library |

If the user has a Refero or Mobbin Pro seat with the MCP installed, query it directly instead of
just pointing at the URL. Otherwise, say "worth checking `<site>` for `<X>`" as an explicit
prompt — don't quietly skip the reference step because it isn't automatable.

### Step 3: Generate Design Direction Options

Invoke `ui-ux-pro-max` via the Skill tool to explore:
- 2-3 style directions that fit the project
- Color palette options (with specific hex/oklch values)
- Typography pairings (display + body + data fonts)
- Component style direction (sharp vs rounded, bordered vs shadow, dense vs airy)

Invoke `impeccable:shape` to run a structured design discovery that produces a design brief.

### Step 4: Build a Visual Showcase

This is the key step — generate an **HTML showcase page** that the user can review in the browser.

Create a standalone HTML file. Save to BOTH locations:
- `/tmp/design-showcase-<app>.html` — for immediate browser preview
- `docs/design/showcase.html` — permanent record in the repo

The showcase must be fully self-contained (inline CSS, inline fonts via Google Fonts CDN, no external JS deps) so it renders correctly from either location.

The showcase should include:

```html
<!-- The showcase should include: -->
1. COLOR PALETTE — all brand colors as swatches with labels and values
   - Primary, secondary, accent colors
   - Surface colors (background, card, elevated) for dark AND light
   - Semantic colors (success, error, warning, info)
   - Score/status colors if applicable

2. TYPOGRAPHY — each font at every size with real example text
   - Display font: headings, hero text
   - Body font: paragraphs, labels, navigation
   - Data font: numbers, stats, code, badges
   - Show the hierarchy: h1 → h6 → body → caption → badge

3. COMPONENT SAMPLES — basic components styled with the tokens
   - Buttons (primary, secondary, ghost, destructive)
   - Cards (default, elevated, glass if applicable)
   - Inputs (text, select, checkbox)
   - Badges and pills
   - Navigation tabs

4. SCREEN MOCK — a representative screen layout
   - Use real content for the app (golf scores, portfolio projects, agent runs)
   - Show both dark and light themes side by side

5. MOTION — describe the animation personality
   - Spring parameters, timing, easing curves
   - What moves, what doesn't
```

**Ask the user how they want to review the showcase — do NOT default to any option:**

> "Showcase saved to `/tmp/design-showcase-<app>.html` and `docs/design/showcase.html`. How do you want to review it?
> 1. **Open locally** in your desktop browser (`open /tmp/design-showcase-<app>.html`) — fastest
> 2. **Host on a tunnel** so you can review from your phone — uses `remote-preview` skill's `host.sh`, takes ~5 seconds, gives you a `*.trycloudflare.com` URL
> 3. **Both**
> 4. **Skip** — just show me the summary here
>
> What works for you?"

Only tunnel when the user explicitly asks for it. If they pick tunnel, run `bash .claude/skills/remote-preview/scripts/host.sh /tmp/design-showcase-<app>.html <app>-showcase`. Tear it down with `stop.sh <label>` at the end of the design review turn unless the user says to leave it up.

Once they've reviewed (via whichever option): "Tell me what you like, what to change, and what to try differently."

### Step 5: Iterate

Based on feedback:
1. Adjust tokens, regenerate the showcase
2. Try different palettes or fonts
3. Compare against reference systems
4. Invoke `impeccable:critique` for a UX evaluation
5. Repeat until the user approves

### Step 6: Save the Design System

Once approved, save three things:

**1. App design doc** at `docs/design/design-system.md`:
- Complete token reference (every color, every font size, every spacing value)
- Both dark and light theme values
- Component style rules
- Motion/animation parameters
- Accessibility requirements

**2. Design showcase** at `docs/design/showcase.html`:
- The final approved HTML showcase (self-contained, openable in any browser)
- This is the visual record of what was decided — always kept in sync with design-system.md
- When tokens change, regenerate this file

**3. Plugin reference file** at `.claude/plugins/dev/skills/design/references/apps/<app>.md`:
- Quick-reference version of the design system
- Points to the full doc for details
- Includes the design variance/motion/density knobs
- Lists key files that implement the tokens

### Standard design directory per app

After running this workflow, every app should have:

```
docs/design/
├── design-system.md           # Complete token reference (source of truth)
├── showcase.html              # Visual showcase (browser-viewable, self-contained)
├── component-catalog.md       # Component specs, tiers, props, variants (if app has components)
├── screen-patterns.md         # Screen wireframes and navigation (if app has screens)
└── interaction-patterns.md    # Animations, haptics, gestures (if mobile app)
```

Not every app needs every file — golf (mobile) needs all 5, portfolio (web) needs 3 (design-system, showcase, component-catalog), hive (web dashboard) needs 3.

### Step 7: Update Implementation

If the app already has code:
1. Update CSS variables / theme files to match new tokens
2. Run `impeccable:normalize` to realign existing components
3. Run `impeccable:audit` to check compliance
4. Take Playwright screenshots of key screens for before/after comparison

## Updating Design Tokens

When the user wants to update an app's design tokens:

1. Read the current token file: `docs/design/design-system.md`
2. Make changes following the existing format
3. Update the implementation files (CSS variables, theme.ts, etc.)
4. Verify both themes work (dark AND light)
5. Run the anti-pattern checklist on affected components

For **inspiration from real sites**, read files in `docs/design/references/`:
```
docs/design/references/
├── linear.app/   — Clean, minimal, professional (good for hive)
├── stripe/       — Data-rich, polished (good for portfolio)
├── apple/        — Premium, spacious (good for golf)
├── vercel/       — Developer-focused, dark mode
├── spotify/      — Bold, playful, dark-first
└── ... (15 design systems total)
```

## When This Skill is Used in the SDLC

| Phase | What design does |
|-------|-----------------|
| `/dev research` | Full design mode — invoke ui-ux-pro-max + impeccable, generate mocks, explore direction |
| `/dev plan` | Validate issue specs reference correct tokens and components |
| `/dev build` | Load app tokens, invoke shadcn/expo-app-design, ensure components follow patterns |
| `/dev build` (review) | Run full anti-pattern checklist + app-specific compliance |

## Reference Files

App-specific tokens and design docs:
- [Golf (Fairway)](references/apps/golf.md) — OKLch colors, glass effects, three-voice typography
- [Portfolio](references/apps/portfolio.md) — Professional, Stripe-inspired clean design
- [Hive](references/apps/hive.md) — Data-dense agent dashboard, Linear-inspired

External design system references for inspiration:
- `docs/design/references/` — 15 real-world design systems from awesome-design-md
