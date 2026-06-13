# Hive (Agents) — Design Reference

> **Aesthetic:** "Command Center — Linear meets Datadog"
> **Tone:** Developer tooling, data-dense, utilitarian, precise. A personal OS for managing your life with the same rigor you'd manage infrastructure.
> **Inspiration:** Linear (clean navigation, minimal chrome), Datadog (data density), Raycast (command palette)

## Full Design Docs

For complete specifications, read these files from the codebase:
- `docs/design/design-system.md` — Complete token reference (colors, typography, spacing, shadows, components)
- `docs/design/showcase.html` — Visual showcase (browser-viewable)

## Token Implementation Files

| File | Role |
|------|------|
| `apps/hive/app/src/lib/theme.ts` | Source of truth — TypeScript constants |
| `apps/hive/app/src/app/globals.css` | CSS custom properties for Tailwind |

## Quick Token Reference

### Design Knobs
- Density variance: 6/10 (information-dense)
- Motion variance: 3/10 (minimal, functional)
- Design variance: 2/10 (data-focused, consistent)

### Color Principle: Neutral Chrome + Area Colors
System UI uses neutral gray/white only. The 8 life areas bring all color.

### Surface Scale (Dark)
- `--background`: `#07070a` (app background)
- `--surface`: `#0a0a0e` (sidebar, topbar, panels)
- `--card`: `#0e0e12` (cards, rows, list items)
- `--elevated`: `#141418` (modals, popovers)
- `--overlay`: `#18181c` (command palette, dialogs)

### Text Scale
- `--foreground`: `#e4e4e7` (primary text, zinc-200)
- `--muted`: `#71717a` (secondary text, zinc-500)
- `--faint`: `#52525b` (tertiary, timestamps, zinc-600)

### Borders
- `--border`: `rgba(255,255,255,0.06)`
- `--border-hover`: `rgba(255,255,255,0.12)`

### Area Colors (8 fixed)
| Area | Token | Value |
|------|-------|-------|
| Family | `--area-family` | `#f59e0b` |
| Spiritual | `--area-spiritual` | `#a78bfa` |
| Health | `--area-health` | `#ef4444` |
| Finance | `--area-finance` | `#22c55e` |
| Work | `--area-work` | `#3b82f6` |
| Projects | `--area-projects` | `#06b6d4` |
| Social | `--area-social` | `#ec4899` |
| Hobbies | `--area-hobbies` | `#84cc16` |

### Semantic/Status Colors
- `--success`: `#22c55e` (completed, healthy)
- `--error`: `#f87171` (failed, broken)
- `--warning`: `#fb923c` (attention needed)
- `--info`: `#60a5fa` (informational)
- `--running`: `#22c55e` (agent executing, pulsing dot)
- `--idle`: `#52525b` (scheduled, not active)

### Typography (Two-Voice)
| Role | Font | Weight | Usage |
|------|------|--------|-------|
| UI | Geist | 400-700 | Navigation, headings, body, buttons |
| Data | Geist Mono | 400-500 | Scores, stats, timestamps, tags, badges, agent IDs |

Key sizes: Page Title=24px/700, Section=16px/600, Card Title=14px/500, Body=13px/400, Label/Tag=9-10px/500 uppercase

### Spacing
Built on 2px grid. Tight — optimized for data density.
- Card padding: 12px (`lg`)
- Section gaps: 16px (`xl`)
- Page spacing: 24-32px

### Border Radius (Tight)
- Badges/tags: 4px
- Buttons/inputs: 6px
- Cards: 8px
- Modals: 12px

### Buttons (Neutral Chrome)
- Primary: white bg, dark text
- Secondary: card bg, foreground text, border
- Ghost: transparent, muted text
- Destructive: 12% red bg, error text

### Icons
- Library: Lucide React
- Stroke: 1.5px
- Sizes: 14px inline, 16px sidebar, 18px buttons

## Current Implementation

| File | Role |
|------|------|
| `apps/hive/app/` | Next.js dashboard (Tailwind v4 + shadcn) |
| `packages/shared/ui/` | Shared shadcn components |

## Dashboard Patterns
- Sidebar: 240px (collapsible to 52px icon rail)
- Two nav groups: Areas (color dots) + System (Lucide icons)
- Content padding: 24px
- Card gap: 8-10px between list items
- Status: dot (7px) + semantic color + pulse animation for running
- Agent rows: name + area tag + timestamp
- Monospace everywhere for data
