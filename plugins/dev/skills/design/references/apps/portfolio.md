# Portfolio — Design Reference

> **Aesthetic:** "Warm Machine — precise, alive, opinionated"
> **Tone:** A running system, not a brochure. The page feels alive — blinking cursors, pulsing dots, real data. Warm surfaces, one rust accent, zero decoration.
> **Inspiration:** Vercel (shadow-as-border, void spacing), Stripe (typography weight, blue-tinted shadows)

## Full Design Docs

For complete specifications, read these files from the codebase:
- `docs/apps/portfolio/design/design-system.md` — Complete token reference (colors, typography, spacing, shadows, motion)
- `docs/apps/portfolio/design/showcase-*.html` — Seven visual mockups (homepage, project-detail, projects-list, experience, blog, playground, global-overlays)
- `docs/apps/portfolio/design/token-parity-audit.md` — Mockup vs. shipped parity report

## Token Implementation Files

| File | Role |
|------|------|
| `apps/portfolio/app/src/lib/theme.ts` | Source of truth — TypeScript constants |
| `apps/portfolio/app/src/app/globals.css` | CSS custom properties for Tailwind |

## Quick Token Reference

### Design Knobs
- Design variance: 4/10 (restrained but opinionated)
- Motion intensity: 5/10 (alive, not cinematic)
- Visual density: 4/10 (airy with dense data sections)

### Color Principle: Warm Surfaces + One Rust Accent
Surfaces have a barely perceptible warm tint (hue 40, chroma 0.008). Rust accent ONLY on interactive elements.

### Accent
- `--rust`: `oklch(0.62 0.14 42)` — links, terminal prompt, hover arrows, CTAs, availability dot
- `--rust-bg`: `oklch(0.62 0.14 42 / 0.08)` — subtle accent backgrounds

### Surface Scale (Dark, OKLCH)
- `--background`: `oklch(0.12 0.008 40)` (app background)
- `--surface`: `oklch(0.14 0.008 40)` (nav bar, elevated panels)
- `--card`: `oklch(0.10 0.006 40)` (cards, terminal, code blocks)
- `--elevated`: `oklch(0.16 0.008 40)` (modals, overlays)

### Text Scale (boosted for WCAG AA)
- `--foreground`: `oklch(0.92 0.008 40)` (primary text, headings)
- `--muted`: `oklch(0.66 0.008 40)` (body text, descriptions)
- `--faint`: `oklch(0.52 0.008 40)` (tertiary, timestamps)
- `--dim`: `oklch(0.40 0.008 40)` (labels, section headers)
- `--border`: `oklch(0.24 0.008 40)` (always via `inset box-shadow`)

### Typography (Two-Voice)
| Role | Font | Weight | Usage |
|------|------|--------|-------|
| UI | Manrope | 300-700 | Everything readable — headings, body, nav, labels, buttons |
| Data | JetBrains Mono | 400-500 | Stats, code, terminal, timestamps, tags, section labels |

No display/serif font — this is a tool, not a magazine. Manrope at weight 300 carries hero titles; weight 600 carries section headings. All numbers go in JetBrains Mono.

### Shadow Tokens
- `--shadow-border`: inset border on every surface
- `--shadow-modal`: contact modal, Cmd+K
- `--shadow-panel`: AI chat side panel
- `--shadow-bubble`: floating AI chat bubble
- `--ring-rust`: focus ring on rust CTA / active timeline dot

### Motion
- Scroll-triggered reveals (stagger 50ms)
- Spring physics on hover: `cubic-bezier(0.32, 0.72, 0, 1)`
- Blinking cursor, pulsing availability dot
- NO decorative animation — motion communicates state

### Signature Interactive Elements
- Terminal with working commands
- AI chat panel
- Easter egg games
- Real GitHub/LeetCode data from API

## Current Implementation

| File | Role |
|------|------|
| `apps/portfolio/app/` | Next.js 16 frontend (Tailwind v4 + shadcn) |
| `apps/portfolio/admin/` | Refine admin dashboard |
| `packages/shared/ui/` | Shared shadcn components |
