# Golf — Design Reference (Tobacco / Warm-Black era)

> **System:** Tobacco / Warm-Black. Light = bone-cream paper + tobacco ink + one electric
> amber signal. Dark = tobacco-tinted warm near-black (NEVER inverted cream), same amber a
> step brighter. Voice: "bookkeeper meets editorial" — a smart sports columnist who knows
> your handicap.
> **NOT:** the old "Modern Country Club Meets Glass" (gold/sage/Instrument Serif/Outfit/
> DM Mono) — that system is DEAD; if you see it referenced anywhere, that doc is stale.

## Ground truth (read in this order)

1. **Shipped screenshots:** `docs/design/app-screens/` (convention per GOLF-462; if absent,
   ask the user for current shots — home, in-round, score sheet, onboarding).
2. **Living law:** the relevant flow's `decisions.md` —
   - chat/Caddy system: `apps/design/src/packages/mobile/social/flows/chat/decisions.md`
     (rounds locked: shell, markdown set, event cast, …) + `ROADMAP.md`
   - brand/character: `apps/design/src/packages/mobile/brand/flows/brand-directions/decisions.md`
   - in-round: `apps/design/src/packages/mobile/round/flows/in-round/decisions.md`
3. **System docs:** `packages/ui/HARD-RULES.md`, `packages/ui/DESIGN-SYSTEM.md`,
   `packages/ui/VOICE.md`, `packages/ui/SIZING.md`, `packages/ui/MOTION.md`.
4. **Data/product context for AI surfaces:** `docs/decisions/0009-round-events.md` +
   `docs/planning/chat-events/design.md` (round-events model, pushed=event/replied=chat).

## Repo shape (Next-era — the Vite studio is gone)

| What | Where |
|---|---|
| Design studio | `apps/design/` — **Next.js App Router** |
| Flows | `apps/design/src/packages/<surface>/<domain>/flows/<flow>/` (meta.ts via `defineFlow`, README, decisions.md, sections/, sketches/) |
| Sketches | `flows/<flow>/sketches/*.html`, registered in the flow's `sketches.ts` (`defineSketches`), rendered by `<SketchIndex>`; served at `/sketches/<surface>/<domain>/<flow>/<file>` (route also serves svg/png assets in the dir) |
| Primitives | `packages/ui/` = `@bokendell/golf-ui` (web `.web.tsx` + native `.native.tsx`) |
| Mobile app | `apps/mobile/` · admin `apps/admin/` |
| Docs | `docs/design/`, `docs/planning/<initiative>/` (NOT `docs/apps/golf/...`) |
| Verify | `pnpm --filter @bokendell/golf-design check-types` after touching the studio |

## Tokens — read `DESIGN.md`, never take values from here

**Canonical: `DESIGN.md` at the golf repo root.** It is generated from
`packages/tokens/src/theme-source.ts` and diffed by `tokens:check` in CI, so it
cannot disagree with what ships. Read its frontmatter for `colors` /
`typography` / `rounded` / `spacing`, and its `## Colors` table for dark values
(the frontmatter carries the light palette only).

This section used to restate the palette. Every value had drifted: `bg` was
listed as `oklch(0.962 0.012 85)` against a shipped `oklch(0.956 0.013 87)`,
`ink` as `0.28 0.022 60` against `0.239 0.013 72`, and the accent as
`0.62 0.20 50` against `0.62 0.138 39` — a chroma error big enough to see. A
hand-maintained copy of generated values always ends this way, so the list is
deleted rather than corrected. What follows is *character*, not values.

- **Character:** warm cream paper in light, warm near-black in dark — never a
  cold console grey. One burnt-orange accent carries every primary action.
- **Money:** U+2212 minus (not a hyphen), tabular numerals. Up/down/flat are
  semantic tokens, never raw green/red.
- **Type — four voices:** Bricolage Grotesque (display) · Geist (body) ·
  Geist Mono (data/money) · Source Serif 4 italic (editorial/advice).
- **OKLch always** (HARD-RULES #14) — it keeps lightness perceptually even when
  a hue shifts between themes, which is what lets one token read on both
  surfaces.

## Fidelity anchors (match THESE shipped artifacts, not old mocks)

- **PairPill** — adjacent chrome actions merged into one glass capsule, multiple touch
  targets, NO dividers (the bell·ellipsis pill on the round screen)
- **Hole-hero card** — mono eyebrow + display numeral + PAR/YDS/HCP stats right
- **Score chips** — number + relative-to-par sublabel (2/−2 … 4/par …), dark-fill selection
- **Resume Slip** — receipt artifact: dashed internal rules, zigzag tear, rotated stamp
  ("IN PROGRESS"/"INKED"), serif-italic flavor lines
- **Segmented pill** (Scorecard|Standings) · **brick pill CTAs** · serif-italic flavor lines
  ("hole 2 of 18 · 1 players")
- **The character** — faceless capped golf ball (big slouchy cap, no eyes EVER); one ball
  per surface acting; flag glyph as its letterhead inline

## Hard laws distilled (full law in decisions.md files + HARD-RULES.md)

- **Material doctrine:** paper is still · glass is alive (floating chrome only, blooms on
  scroll-under) · editorial is earned (bookends only)
- **Speech is typography, record is artifacts** — Caddy replies are bare streamed markdown
  (no bubble/eyebrow); eyebrows belong exclusively to record components (events, slips,
  insights). Pushed = event, replied = chat.
- **Dotted = awaiting writing · solid = ruled record** (blanks/signature vs tables/rules)
- **Pencil → ink** = proposed → committed (also offline queue semantics); corrections are
  strike-through rewrites; **INITIAL TO INK** signature commit, stamp, tear
- Motion tokens: `--ease-out cubic-bezier(0.16,1,0.3,1)` · ink 400ms · odometer 550ms
  (+40ms/digit, direction = sign, live changes only — never on mount) · rig blends 240ms
  interruptible · carry line = the ONLY "working" indicator (no spinners ever; rolling ball
  = container fetch, cap-tip = thinking)
- No emoji, no `#000`/`#fff`, no border-left accents, no gradient text, no bounce easing.
  Banned fonts incl. Inter, Instrument Serif, Outfit, DM Mono, Space Grotesk, Fraunces.

## Process notes

- Use the **Exploration Program** (rounds → 3–4 directions → user locks → decisions.md)
  for anything bigger than a component; boards interactive, light + dark, self-verified
  via Playwright before delivery.
- Drift: log to `apps/design/.skill-drift.md` AND fix this pack/skill at
  `~/repos/bokendell/skills-marketplace` when structural (see SKILL.md drift protocol).
- `swarm design lint --app golf` currently scans dead Vite paths (no-op) — pending
  swarm-cli fix; don't trust a green there.
