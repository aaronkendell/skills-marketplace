---
name: static-stack
description: The bokendell static-asset stack — which MCPs and skills to use for generating brand assets (SVG vectors, raster textures, icons, stock photos) and for visual design review, all inside Claude Code. Sibling to motion-stack. Activates whenever the conversation involves icons, logos, brand marks, illustrations, textures, App Store screenshots, OG / share images, or visual design audits.
metadata:
  tags: design, static, svg, image, brand, icons, recraft, nano-banana, iconify, unsplash, playwright
---

# The static-asset stack · orchestrator

> Thin pointer skill. Sibling to [[motion-stack]]. Where motion-stack handles things that move, this skill handles things that stand still — and the visual-review loop that audits them.

## The decision tree

```
Is this a vector asset (logo, icon, brand mark, illustration)?
└── Use the `recraft` MCP (Recraft V3) — purpose-built for brand-quality SVG.
    Auto-binds Tobacco / brand palette via prompt; output goes to apps/design/assets/icons/ or assets/marks/.

Is this a raster texture, hero image, illustration, or painterly background?
└── Use the `nano-banana` MCP (Gemini 3.1 Flash Image, codename Nano-Banana 2).
    Strong with text + brand consistency at $0.04–$0.15/image. Output → apps/design/assets/textures/.

Is this looking up an existing icon (Lucide / Material / Phosphor / Heroicons / Tabler / 150+ sets)?
└── Use the `iconify` MCP. No API key. Searches all icon sets at once, returns SVG inline.
    Prefer this over hand-grepping lucide-react.

Is this stock photography (rare — only when brand-generated assets won't do)?
└── Use the `unsplash` MCP (cevatkerim's — attribution baked in).
    Free tier 50 req/hr. Output → apps/design/assets/stock/ with README.md attribution.

Is this packaging your brand identity (Tobacco palette, fonts, voice) as a reusable Claude skill?
└── Follow Anthropic's `brand-guidelines` skill pattern. One skill per brand.
    Reference: https://claude.com/resources/use-cases/package-your-brand-guidelines-in-a-skill

Is this auditing color contrast, APCA, palette harmony, OKLch math?
└── LOAD: `meodai/skill.color-expert`. Audits + suggests palette adjustments.

Is this visual design review (screenshot every flow, audit against guidelines)?
└── Use the `playwright` MCP via the [[design-review]] skill (in the dev plugin).
    The design-review skill orchestrates Playwright to capture iPhone + desktop shots
    of every apps/design/flows/<name>/ and grades them against the anti-pattern checklist.

Is this design ↔ code with Figma?
└── LOAD: official Figma MCP (Feb 2026, OAuth-based). Auto-installs the Figma plugin's skill.
    Setup: https://help.figma.com/hc/en-us/articles/39888612464151

Is this design ↔ code with Penpot (open-source)?
└── LOAD: `penpot/penpot-mcp`. Local or self-hosted. Bidirectional design↔code.

Is this an App Store / Play Store launch asset?
└── LOAD: `ParthJadhav/app-store-screenshots` skill. Multi-resolution + device frame.

Is this a dynamic OG / Twitter / social-share card image?
└── No new tool — use `@vercel/og` (Satori) directly inside the relevant Next.js app.
    apps/admin or any portfolio site can ship dynamic OG with one route file.
```

## Preflight · check what's installed, prompt the user only if missing

Run these checks silently before doing static-asset work. **Don't install anything without explicit user approval** — these add MCPs at user scope, which touches global state.

```
1. For Recraft / Nano-Banana / Iconify / Unsplash / Playwright MCPs:
   - Check: `cat ~/.claude/settings.json | grep -E "(recraft|nano-banana|iconify|unsplash|playwright)"`
     OR test if the MCP tools are available in the current session
   - If missing: confirm the user has `mcp-pack@bokendell-skills` enabled at user scope.
     The mcp-pack plugin (v1.2.0+) bundles all five — enabling the plugin enables them all.
   - Tell the user to `/plugin install mcp-pack@bokendell-skills` if not yet enabled.

2. For API keys (Recraft / Nano-Banana / Unsplash):
   - Check env: `echo $RECRAFT_API_KEY $GEMINI_API_KEY $UNSPLASH_ACCESS_KEY`
   - If missing: ask user to add them to Infisical at:
       /infrastructure/recraft   → RECRAFT_API_KEY
       /infrastructure/gemini    → GEMINI_API_KEY
       /infrastructure/unsplash  → UNSPLASH_ACCESS_KEY
   - Iconify + Playwright need no API key.
   - The MCP servers read env vars at launch — if Claude Code is launched via
     `infisical run --path=/infrastructure/<svc> -- claude`, the MCPs inherit them.
     Otherwise the user wraps individual MCP launches by editing settings.json
     to point at an Infisical-wrapped command.

3. For the color-expert skill:
   - Check: it is in the session's available-skills list (`color-expert`)
   - If missing: `/plugin install color-expert@bokendell-skills` — a pass-through to meodai/skill.color-expert

4. For Figma MCP (only when user mentions Figma):
   - Setup is OAuth-based via the official Figma plugin. Point user to
     https://help.figma.com/hc/en-us/articles/39888612464151

5. For App Store Screenshots:
   - Check: it is in the session's available-skills list (`app-store-screenshots`); install with
     `/plugin install app-store-screenshots@bokendell-skills` — a pass-through to ParthJadhav/app-store-screenshots
     (or however the user installs community skills)
```

## bokendell conventions

### Output paths

When a static asset is generated for golf, prefer these locations so the design studio can index them:

```
apps/design/
├── assets/
│   ├── icons/         # vectors (Recraft, Iconify)  — single-purpose marks
│   ├── marks/         # brand logos / wordmarks      — used in headers / loaders
│   ├── illustrations/ # vector illustrations         — Recraft, hand-tuned
│   ├── textures/      # raster tiles + grain         — nano-banana, seamless tiles
│   ├── stock/         # Unsplash / Pexels            — with adjacent README.md attribution
│   └── store/         # App Store / Play Store      — appshot / app-store-screenshots
├── flows/             # the actual design flows that consume assets
└── .reviews/          # design-review skill output (screenshots + audit reports)
```

For cross-app brand marks (logo on light, logo on dark, glyph), promote to
`core/packages/shared/design/src/packages/marks/` and ship through
`@bokendell/design/marks` like Motion ships through `@bokendell/design/motion`.

### Token-aware prompts

When asking Recraft or Nano-Banana for an asset, include the brand palette explicitly:

> "Vector tee marker icon. Tobacco / Warm-Black palette: burnt sienna `oklch(0.55 0.14 35)`
> on cream paper `oklch(0.95 0.02 80)`. 1px brush stroke, no fill. 24×24 viewport."

Don't trust the model's notion of "warm" or "earthy" — pass exact OKLch.

For raster: include "no text artifacts", "no AI-tells like neon glow / purple gradient /
emoji icons", and constrain seed if doing tile variants.

### Promotion rule (per-app → core)

A static asset starts in `apps/design/assets/`. When the same asset would be needed
in two or more apps (golf + portfolio + hive), promote to
`core/packages/shared/design/src/packages/marks/` (or `glyphs/`, `textures/`) and ship
through a subpath export, same model as `@bokendell/design/motion`.

## Root primitives — what core should ship

Sibling to `Motion`, these are the cross-platform static-asset primitives that would belong
in `@bokendell/design`. None exist yet as of 2026-05-22.

| Primitive | Subpath | Why |
|---|---|---|
| `BrandMark` | `@bokendell/design/marks` | Renders the wordmark/logo with theme-aware variant (light/dark/mono). Auto-binds OKLch tokens. |
| `Icon` | `@bokendell/design/icons` | Token-sized wrapper around Lucide / Phosphor / Iconify. Sizes match `MOTION_SIZE_PX`. |
| `BrandImage` | `@bokendell/design/images` | Next.js Image + expo-image with token-aware tint filters for theme parity. |

Don't ship all three at once — promote as needed when the second app needs the same primitive.

## See also

- [[motion-stack]] — sibling skill for animated assets
- [[design-review]] — Playwright-orchestrated visual audit
- `golf-design-studio` skill — main design workflow that loads this skill on demand
- `mcp-pack` plugin (v1.2.0+) — bundles Recraft / Nano-Banana / Iconify / Unsplash / Playwright
