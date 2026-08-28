# Per-App UI Package Pattern

> The contract every per-app UI package follows so brand layers, shared
> primitives (shadcn / NativeWind), and the studio framework all coexist
> without fighting. Owned by the cross-app convention; applies identically
> to golf, hive, portfolio, and swarm-desktop. Read this BEFORE creating
> `@bokendell/<app>-ui` for a new app.

## Three-layer architecture

```
Foundation primitives — brand-neutral, Tailwind defaults
├── @bokendell/ui              shadcn host (web)
├── @bokendell/mobile-ui       NativeWind RN host
└── @bokendell/desktop-ui      (future) Tauri host

Brand layer — one per app, wraps foundation + adds tokens
├── @bokendell/golf-ui
├── @bokendell/hive-ui              (future)
├── @bokendell/portfolio-ui         (future)
└── @bokendell/swarm-desktop-ui     (future)

App
├── apps/<app>/{mobile,admin,design,…}
```

The brand layer wraps shadcn / NativeWind primitives with brand chrome
(buttons, cards, stacks, sheets) and exposes a `tokens.css` plus
`fonts.css` that the apps import at root.

## The token contract

Per-app UI packages communicate with the foundation + framework through a
fixed CSS-variable vocabulary in `tokens.css`. Tailwind v4's `@theme` block
generates utility classes from any `--<namespace>-<name>` token, so the
contract is: define what's safe, never override what shadcn assumes.

### MAY define

Visual / non-layout tokens — these reskin freely:

| Namespace | Example | Generated utility |
|---|---|---|
| `--color-*` | `--color-accent: oklch(0.62 0.2 50)` | `bg-accent`, `text-accent`, `border-accent` |
| `--radius-*` | `--radius-md: 14px` | `rounded-md`, `rounded-xl` |
| `--text-*` | `--text-lg: 1rem` | `text-lg` |
| `--font-*` | `--font-body: "Geist"` | `font-body`, `font-sans` |
| `--font-weight-*` | `--font-weight-semibold: 600` | `font-semibold` |
| `--tracking-*` | `--tracking-widest: 0.2em` | `tracking-widest` |
| `--shadow-*` | `--shadow-lg: ...` | `shadow-lg` |
| `--ease-*` | `--ease-out: cubic-bezier(...)` | `ease-out` |

### MUST NOT define

Tokens whose **numeric** form Tailwind hardcodes into utility names that
shadcn primitives (and almost everything else) assume have standard
values. Redefining them breaks every shadcn `Button`, `Input`, `Avatar`,
`Dialog`, etc.

| Namespace | What it controls | Why it's off-limits |
|---|---|---|
| `--spacing-N` (numeric N) | `h-9`, `p-4`, `gap-2`, `size-7`, `m-3`, `top-4`, etc. | shadcn Button's cva uses `h-9` (icon button), `h-8` (size="sm"), `px-4 py-2` (default). Redefine these and every shadcn primitive renders 2–3× too tall. |

### MAY define semantic-name spacing

For brand-specific "bigger than Tailwind ships" spacings — name them
semantically, NOT numerically. Tailwind generates utilities from any
`--spacing-<name>` token, so these add **new** utilities alongside the
standard scale rather than overriding it.

```css
@theme {
  --spacing-xl: 48px;   /* hero / display padding */
  --spacing-2xl: 64px;  /* page edge padding */
  --spacing-3xl: 96px;  /* monumental gap */
  /* …or fully semantic names if the scale doesn't fit: */
  --spacing-card: 16px;
  --spacing-section: 48px;
  --spacing-page: 64px;
}
```

```tsx
<header className="mb-xl">                  {/* 48px — brand spacing */}
<main className="p-page">                   {/* 64px — semantic name */}
<section className="gap-2xl">               {/* 64px */}
<div className="h-9">                       {/* 36px — Tailwind default, never overridden */}
```

### Status colors (signal palette)

Per-app UI packages MAY redefine semantic signal colors if a brand wants
to reskin "success / warning / error" — but most brands inherit the
defaults. The chrome layer (`@bokendell/design`) hardcodes a small
signal palette for things like comment status pills (open / in-progress /
addressed / resolved / wontfix) and reads `--color-accent` for the
"primary attention" status. Don't put status colors under `--color-*` —
they're not brand colors, they're product semantics.

## Per-app `tokens.css` template

```css
/* packages/ui/src/tokens/tokens.css */

@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme {
  /* Type families ─────────────────────────────────────────── */
  --font-display: "Bricolage Grotesque", system-ui, sans-serif;
  --font-body: "Geist", system-ui, -apple-system, sans-serif;
  --font-data: "Geist Mono", ui-monospace, monospace;
  --font-sans: var(--font-body);

  /* Type scale ────────────────────────────────────────────── */
  --text-2xs: 0.625rem;
  --text-xs: 0.6875rem;
  --text-sm: 0.75rem;
  --text-base: 0.8125rem;
  --text-md: 0.875rem;
  --text-lg: 1rem;
  --text-xl: 1.125rem;
  --text-2xl: 1.5rem;
  --text-3xl: 2rem;
  /* …display sizes as needed */

  /* Type weights, letter-spacing, etc. ────────────────────── */
  --font-weight-regular: 400;
  --font-weight-semibold: 600;
  --tracking-tight: -0.025em;
  --tracking-widest: 0.2em;

  /* Brand spacing — SEMANTIC NAMES ONLY, never numeric ────── */
  --spacing-xl: 48px;
  --spacing-2xl: 64px;
  --spacing-3xl: 96px;

  /* Radius ────────────────────────────────────────────────── */
  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-xl: 28px;
  --radius-pill: 999px;

  /* Elevation ─────────────────────────────────────────────── */
  --shadow-sm: 0 2px 6px -2px oklch(0 0 0 / 0.08);
  --shadow-md: 0 8px 18px -8px oklch(0 0 0 / 0.18);

  /* Motion ────────────────────────────────────────────────── */
  --ease-out: cubic-bezier(0.32, 0.72, 0, 1);

  /* Brand colors ─────────────────────────────────────────── */
  --color-bg: oklch(0.965 0.012 80);
  --color-bg-elev: oklch(0.99 0.008 85);
  --color-bg-deep: oklch(0.93 0.02 75);
  --color-ink: oklch(0.18 0.015 60);
  --color-ink-soft: oklch(0.36 0.018 65);
  --color-ink-mute: oklch(0.55 0.015 70);
  --color-accent: oklch(0.62 0.2 50);
  --color-accent-deep: oklch(0.48 0.185 50);
  --color-accent-tint: oklch(0.62 0.2 50 / 0.16);
  --color-hairline: oklch(0.36 0.018 65 / 0.18);
}

@layer base {
  /* dark-mode overrides via [data-theme="dark"] */
  [data-theme="dark"] {
    --color-bg: oklch(0.1 0.008 60);
    /* …etc */
  }
}
```

## Stack / Spacer / Sheet variant API

Brand primitives that wrap layout utilities expose a typed-enum variant
prop. Per the spacing contract, the enum keys follow the same vocabulary
as the underlying tokens — **numeric for the standard Tailwind scale**,
**semantic for brand-bigger sizes**.

```ts
// packages/ui/src/components/Stack/Stack.variants.ts
gap: {
  "0": "gap-0",
  "1": "gap-1",       // 4px  — Tailwind default
  "2": "gap-2",       // 8px
  "3": "gap-3",       // 12px
  "4": "gap-4",       // 16px
  "5": "gap-5",       // 20px (Tailwind default!)
  "6": "gap-6",       // 24px
  xl: "gap-xl",       // 48px — brand
  "2xl": "gap-2xl",   // 64px
  "3xl": "gap-3xl",   // 96px
}
```

Then:

```tsx
<Stack gap="2">      {/* 8px */}
<Stack gap="xl">     {/* 48px brand value */}
```

## Studio framework chrome (`@bokendell/design`)

The studio framework reads the brand token contract too:

- **Colors** — `bg-[var(--color-accent)]`, `text-[var(--color-ink)]`, etc. Always read from tokens.css.
- **Radius** — `rounded-md` / `rounded-xl`. Maps to brand `--radius-*`.
- **Typography** — `text-xs` / `text-sm`. Maps to brand `--text-*`.
- **Font family** — `font-sans`. Maps to brand `--font-body`.
- **Sizing** — standard Tailwind numeric utilities (`h-8`, `size-7`, `p-3`). Resolves to default Tailwind values, NOT brand-overridden ones (because the contract forbids overriding `--spacing-N` numerically).

Each studio gets the same chrome (toolbar, nav, user menu, comments,
auth gate) and **automatically reskins** based on the host app's
tokens.css — golf renders Tobacco-terracotta, hive will render its
indigo, swarm-desktop will render whatever its tokens define.

## Migration history

`@bokendell/golf-ui` v0 redefined `--spacing-1..9` (4 / 8 / 12 / 16 / 24 /
32 / 48 / 64 / 96 px). Values 1-6 matched Tailwind defaults exactly; 7-9
diverged and silently blew up every shadcn primitive in the design
studio.

The migration:

1. **Tokens:** dropped numeric `--spacing-N` from `packages/ui/src/tokens/tokens.css`; added `--spacing-xl`, `--spacing-2xl`, `--spacing-3xl` semantically named.
2. **Variants:** `Stack`, `Spacer`, `Sheet`, `BottomSheet`, `ScoreStepper` rewired so `gap="7" / size="7"` etc. became `gap="xl" / size="xl"`. Numeric variants 0–6 remain.
3. **Call sites in the design studio:** `mb-7` → `mb-xl`, `p-9` → `p-3xl`, `w-7` → `w-xl`, etc. (~70 sites swept).
4. **Mobile app:** call sites left at the standard Tailwind values they were always silently rendering against. No visible change since most usages (`h-9 w-9` icon containers) were probably accidentally rendering brand-too-big anyway.
5. **Design framework chrome:** dropped the explicit `h-[Npx]` workarounds — shadcn defaults now produce the right sizes.

## Linting (future work)

A swarm CLI check `swarm check tokens --app <app>` should fail if a
per-app UI package's `tokens.css` defines `--spacing-N` numerically.
Catches violations at PR time. The check is straightforward to implement
once another app adopts the contract.

## Related docs

- `docs/context/patterns/design-studio.md` — studio framework consumer of these tokens
- `docs/context/patterns/mobile.md` — mobile app consumer
- `docs/context/patterns/frontend.md` — web app consumer
- `packages/ui/SIZING.md` — typed-enum surface for golf's primitives
