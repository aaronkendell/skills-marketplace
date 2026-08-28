# Design App Pattern (Next.js + packages)

> Cross-app pattern for the per-app design studios at `apps/design/`.
> Owned by `@bokendell/design`. Applies identically to golf, hive, portfolio,
> and any future app — swap `@bokendell/<app>-ui` and the per-app `site`
> package, the rest stays the same.

> The **architecture** lives here. The **annotation system + element IDs**
> live in [`design-studio.md`](./design-studio.md). The **per-flow workflow
> conventions** (decisions.md, README, sketches, promotion) live in
> [`design-workflow.md`](./design-workflow.md).

> Studios consume `@bokendell/<app>-ui/tokens.css` + `fonts.css` for brand
> chrome. Per-app UI packages follow the contract in
> [`per-app-ui.md`](./per-app-ui.md).

---

## Mental model

**Three layers, plug-and-play across apps:**

```
@bokendell/design                          ← framework (brand-agnostic)
  canvas / devices / hooks / annotations
  shell / layouts / routing / page-meta / sketches

apps/design/src/lib/core/            ← local stash for framework modules
  (during development; promoted into @bokendell/design once stable)

apps/design/src/lib/                 ← truly app-specific shared
  providers/ auth/ studio.css env*.ts ...

apps/design/src/packages/            ← feature/surface packages
  site/     ← studio shell, discovery, layouts, errors (golf-skinned)
  mobile/   ← surface group: 1 dir per product domain
  admin/    ← surface group
  marketing/ ← surface group
  kits/     ← system-reference (tokens, library, comparison, motion)
  shared/   ← cross-surface (game definitions, etc.)
```

The studio is a pure consumer: `studio.css` imports `@bokendell/<app>-ui/tokens.css` + `fonts.css`. No brand-specific code lives in `@bokendell/design`.

---

## Top-level layout

```
apps/design/
├── next.config.ts, tailwind.config.ts, postcss.config.mjs
├── package.json                 # Next.js 15 App Router; @bokendell/<app>-ui workspace dep
├── tsconfig.json                # extends @bokendell/tsconfig/next.json + path aliases
├── vercel.json                  # static-app deploy
├── next-env.d.ts                # auto-generated
├── docs/                        # loose project docs (handoffs, specs)
├── public/
│   └── brand/                   # studio-only mocks / WIP brand assets
└── src/
    ├── app/                     # thin routes only
    │   ├── layout.tsx           # imports providers + RootLayout from site
    │   ├── page.tsx             # <DiscoveryContainer />
    │   ├── globals.css          # re-imports lib/studio.css
    │   ├── (surface)/           # route group — does NOT appear in URLs
    │   │   ├── mobile/[domain]/[flow]/page.tsx
    │   │   ├── admin/[domain]/[flow]/page.tsx
    │   │   ├── marketing/[domain]/[flow]/page.tsx
    │   │   └── kits/kits/[flow]/page.tsx
    │   └── sketches/[...path]/route.ts   # serves HTML sketches from packages/
    │
    ├── lib/                     # truly shared, app-only
    │   ├── core/                # local stash for future @bokendell/design modules
    │   ├── providers/           # RootProviders (Query + oRPC + Tooltip)
    │   ├── auth/                # better-auth wiring (when needed)
    │   ├── studio.css           # imports @<app>-ui/tokens.css + fonts.css
    │   ├── studio-frame.tsx     # StudioFrame helper (ios-host + IOSDevice wrapper)
    │   ├── nav-config.tsx       # nav layout shared by flow sections
    │   ├── env.ts               # zod-validated NEXT_PUBLIC_* env
    │   ├── env-schemas.ts
    │   ├── env-infisical.ts     # Infisical descriptor (parity-checked in CI)
    │   ├── types.ts             # cross-package types (rare)
    │   └── constants.ts         # cross-package constants (rare)
    │
    ├── packages/
    │   ├── site/                # studio shell, golf-skinned
    │   ├── mobile/<domain>/     # one per product domain
    │   ├── admin/<domain>/
    │   ├── marketing/<domain>/
    │   ├── kits/<kit>/
    │   └── shared/games/        # cross-surface escape hatch
    │
    └── types/ambient.d.ts       # `declare module "*.css"` etc.
```

### Path aliases (`tsconfig.json`)

```jsonc
{
  "extends": "@bokendell/tsconfig/next.json",
  "compilerOptions": {
    "paths": {
      "@/*":          ["./src/*"],
      "@lib/*":       ["./src/lib/*"],
      "@providers/*": ["./src/lib/providers/*"],
      "@packages/*":  ["./src/packages/*"],
      "@<app>-ui":    ["../../packages/ui/src/index.ts"],
      "@<app>-ui/*":  ["../../packages/ui/src/*"],
      "@shared/games":   ["./src/packages/shared/games/index.ts"],
      "@shared/games/*": ["./src/packages/shared/games/*"]
    }
  }
}
```

---

## Surface groups + domains

Top-level structure under `src/packages/` is **surface-first, domain-nested**, mirroring the actual product split:

```
src/packages/
├── site/                ← the studio app itself
├── mobile/              ← surface group, mirrors apps/mobile
│   ├── round/           ← multi-flow domain (pre-round, in-round, post-round, live-activity)
│   ├── home/            ← single-flow domain
│   ├── auth/            ← auth + onboarding flows
│   └── ...              ← (typically 10-15 domains)
├── admin/<domain>/      ← surface for admin web (1-N domains)
├── marketing/<domain>/  ← surface for marketing site
├── kits/                ← system-reference (tokens / library / comparison / motion)
└── shared/games/        ← cross-surface utilities
```

**Domain grouping rules:**
- Each surface group has many domains.
- Each domain holds **all related flows** (e.g. `round` holds pre/in/post-round + live-activity).
- Domain slug uses kebab-case product nouns. Avoid the `-flow` suffix anywhere.
- Single-flow domains are fine (`home`, `paywalls`); don't manufacture multi-flow grouping where it isn't natural.

---

## Domain package anatomy

Every domain follows the same shape — **identical to frontend.md** with one addition: `flows/<flow>/` for per-flow artifacts.

```
src/packages/mobile/round/
├── index.ts                   ← public barrel
├── meta.ts                    ← domain definition (imports flow metas)
├── README.md                  ← what this domain holds
├── types.ts                   ← ALL types for this domain
├── constants.ts               ← ALL constants for this domain
│
├── containers/                ← orchestrators (one per flow)
│   ├── pre-round-container.tsx
│   ├── in-round-container.tsx
│   ├── post-round-container.tsx
│   └── live-activity-container.tsx
│
├── screens/                   ← pure presentation
│   ├── pre-round-screen.tsx
│   └── in-round-screen.tsx
│
├── layouts/                   ← layout components (pure presentation)
│   └── round-canvas-layout.tsx
│
├── components/                ← domain-internal reusable bits
├── hooks/                     ← domain hooks (compose store + queries)
│   ├── use-round-canvas.ts
│   └── forms/                 ← RHF form hooks (separate from domain hooks)
│
├── stores/                    ← Zustand UI-only state
│   └── round-ui-store.ts      ← persisted via localStorage
│
├── schemas/                   ← local zod schemas (NOT shared)
├── utils/                     ← standalone pure functions (all tested)
│
└── flows/                     ← per-flow artifacts
    ├── pre-round/
    │   ├── meta.ts            ← per-flow PageMeta + status/category/order
    │   ├── decisions.md       ← append-only timeline
    │   ├── README.md          ← what's being decided, what won
    │   ├── sections/          ← TSX artboard groups (consumed by the screen)
    │   ├── sketches/          ← raw HTML scratch (collocated)
    │   └── legacy-main.tsx.bak ← (during migration) frozen pre-Next.js content
    ├── in-round/
    └── ...
```

### Layer responsibilities

```
Route file (server component, 8 lines)
  ├── reads inRoundPageMeta from flows/in-round/meta
  ├── calls scanFlowSketches() if the flow has a sketches dir
  └── renders <PageStructuredData /> + <InRoundContainer sketches={...} />

Container (client, "use client")
  ├── calls useInRound() domain hook → composes store + queries
  ├── handles guards (auth, etc.)
  └── renders <InRoundScreen {...state}>

Screen (pure presentation, "use client" if it uses canvas hooks)
  └── renders <DesignCanvas> with <DCSection> + <DCArtboard> children
        ├── <SketchIndex sketches={sketches} /> (one artboard, if sketches exist)
        └── one <DCArtboard> per section TSX file
```

---

## Route file shape (always thin)

```tsx
// app/(surface)/mobile/round/in-round/page.tsx
import { scanFlowSketches } from "@lib/core/sketches/server";
import { InRoundContainer } from "@packages/mobile/round";
import { inRoundPageMeta } from "@packages/mobile/round/flows/in-round/meta";
import { PageStructuredData } from "@packages/site";
import type { Metadata } from "next";

export const metadata: Metadata = inRoundPageMeta.metadata;

export default async function InRoundRoute() {
  const sketches = await scanFlowSketches("mobile", "round", "in-round");
  return (
    <>
      <PageStructuredData meta={inRoundPageMeta} />
      <InRoundContainer sketches={sketches} />
    </>
  );
}
```

**Rules:**
- Route file is ~8 lines. All logic lives in the container.
- `metadata` MUST be a top-level Next.js export (Next can't statically analyze imported values for some segment exports, but `metadata` works).
- Server-side fetches (filesystem scan, server-component data) happen here, passed to the container as props.

---

## Meta files

### Per-flow `meta.ts`

```ts
import { defineFlow } from "@lib/core";

export const inRoundFlow = defineFlow({
  slug: "in-round",
  meta: {
    metadata: {
      title: "In-round",
      description: "Live-round canvas — picked direction + edge states.",
    },
  },
  status: "shipped",        // shipped | in-flight | archived
  category: "rolling",      // reference | surface | rolling | decision
  order: 100,
  subtitle: "Live-round canvas — picked direction + edge states.",
});

export const inRoundPageMeta = inRoundFlow.meta;
```

### Per-domain `meta.ts`

```ts
import type { DomainDefinition } from "@lib/core";
import { inRoundFlow } from "./flows/in-round/meta";
import { preRoundFlow } from "./flows/pre-round/meta";
import { postRoundFlow } from "./flows/post-round/meta";
import { liveActivityFlow } from "./flows/live-activity/meta";

export const roundDomain: DomainDefinition = {
  slug: "round",
  label: "Round",
  flows: [inRoundFlow, preRoundFlow, postRoundFlow, liveActivityFlow],
};
```

### Site discovery registry

```ts
// src/packages/site/discovery/registry.ts
import { defineSurface } from "@lib/core";
// IMPORTANT: import from ./meta (not the barrel) — barrels pull canvas + xyflow
// + CSS into vitest's discovery test and break it.
import { roundDomain } from "@packages/mobile/round/meta";
// ...

const REGISTRY = [
  defineSurface({ slug: "mobile",    label: "Mobile",    domains: [homeDomain, roundDomain, ...] }),
  defineSurface({ slug: "admin",     label: "Admin",     domains: [adminDomain] }),
  defineSurface({ slug: "marketing", label: "Marketing", domains: [marketingDomain] }),
  defineSurface({ slug: "kits",      label: "Kits",      domains: [kitsDomain] }),
];

export function getRegistry() { return REGISTRY; }
```

---

## Sketches — collocated, server-scanned, route-served

Sketches are first-class flow artifacts (raw HTML scratch for pre-system explorations). Three parts:

1. **Collocated** in the flow folder:
   ```
   src/packages/mobile/round/flows/in-round/sketches/
     ├── _shared.css
     ├── 01-canonical-pill-bar.html
     └── 02-glass-morph-picker.html
   ```

2. **Discovered** by a server-only helper:
   ```ts
   // server component / route file
   import { scanFlowSketches } from "@lib/core/sketches/server";
   const sketches = await scanFlowSketches("mobile", "round", "in-round");
   ```
   Returns `Array<{ href, label, group, file }>`. Returns `[]` when no sketches dir exists.

3. **Served raw** by a single route handler at `app/sketches/[...path]/route.ts`:
   - URL: `/sketches/<surface>/<domain>/<flow>/<file>.html`
   - Reads from `src/packages/<surface>/<domain>/flows/<flow>/sketches/<file>` and returns `text/html`
   - 404 on missing file; path-traversal blocked

4. **Surfaced** as a `<DCArtboard>` inside the flow's `<DesignCanvas>`:
   ```tsx
   <DCArtboard id="sketches">
     <Frame theme="light">
       <SketchIndex sketches={sketches} title="In-round sketches" />
     </Frame>
   </DCArtboard>
   ```

**Important: client/server split.** `scanFlowSketches` uses `node:fs/promises` — server-only. Re-exported from `@lib/core/sketches/server`. The `SketchIndex` component is client-safe, re-exported from `@lib/core` (or `@lib/core/sketches`). If the barrel re-exports both, the client bundle pulls `node:fs` and the build fails.

---

## What goes in `lib/core/` vs `@bokendell/design`

`lib/core/` is a **local stash** during development. Each module starts there, gets proven across multiple flows, then promotes into `@bokendell/design` (cross-repo, `aaronkendell/core`) as a brand-agnostic export.

| Module | Purpose | Lives in `lib/core/` until promoted |
|---|---|---|
| `shell/` | `<StudioShell>` headless chrome | Yes |
| `layouts/` | `RootLayout`, `FlowLayout` headless | Yes |
| `routing/` | `defineFlow`, `defineSurface`, types | Yes |
| `page-meta/` | `PageMeta` type, `<PageStructuredData>` | Yes |
| `sketches/` | `SketchEntry` type, `<SketchIndex>`, `scanFlowSketches` | Yes |
| `errors/` | Headless error primitives | Yes (planned) |

Once promoted, consumers swap `import {...} from "@lib/core"` → `from "@bokendell/design"`.

---

## Auth lives in two places (by design)

| Location | Purpose |
|---|---|
| `src/lib/auth/` | Plumbing — providers, session wiring, sign-in/sign-out infrastructure |
| `src/packages/mobile/auth/` | Design **flows** — sign-in screen explorations, onboarding mocks |

Mirrors `apps/admin/` exactly — one is infrastructure, the other is design surface.

---

## Brand assets — promotion ladder

```
apps/design/public/brand/   ← WIP / studio-only mocks / breeding ground
        │
        ▼ when shipped as production code
packages/<app>-ui/src/assets/     ← imported as JS modules (icons, brand marks)
        │
        ▼ when needs CDN delivery (large/static, e.g. hero photos)
packages/public-assets/           ← auto-syncs to Cloudflare S3/CDN
```

`public/brand/README.md` documents the ladder. Promotion is manual per asset.

---

## URL shape (matches the route layout)

| URL                                           | Renders                    |
|-----------------------------------------------|----------------------------|
| `/`                                           | DiscoveryScreen — all surfaces + domains + flows |
| `/mobile/round/in-round`                      | InRoundContainer           |
| `/mobile/home/home`                           | HomeContainer              |
| `/admin/admin/admin`                          | AdminContainer             |
| `/marketing/marketing/marketing`              | MarketingContainer         |
| `/kits/kits/library`                          | LibraryKitContainer        |
| `/sketches/mobile/round/in-round/<file>.html` | Raw HTML sketch            |

The `(surface)` route group keeps the file system tidy but doesn't appear in URLs. Surface and domain BOTH appear (e.g. `/kits/kits/...`) — even when surface === domain — for consistency.

---

## Providers wiring (`src/lib/providers/root-providers.tsx`)

DesignCanvas + annotations transitively require:

- `QueryClientProvider` (React Query) — annotations cache
- `SwarmOrpcProvider` from `@bokendell/swarm-client/orpc` — annotations API
- `TooltipProvider` from `@bokendell/ui` — toolbar tooltips

The site's `RootLayoutContainer` wraps the tree in all three. Without them, any `<DesignCanvas>` throws on first hook call.

```tsx
"use client";
import { SwarmOrpcProvider } from "@bokendell/design/mount";
import { createSwarmClient } from "@bokendell/swarm-client/orpc";
import { TooltipProvider } from "@bokendell/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const SWARM_API_URL = process.env.NEXT_PUBLIC_SWARM_API_URL ?? "http://127.0.0.1:3500";

export function RootProviders({ children }) {
  const [queryClient] = useState(() => new QueryClient({ /* defaults */ }));
  const [{ orpc, queryClient }] = useState(() => createSwarmClient({ url: SWARM_API_URL }));
  return (
    <QueryClientProvider client={queryClient}>
      <SwarmOrpcProvider value={orpc}>
        <TooltipProvider>{children}</TooltipProvider>
      </SwarmOrpcProvider>
    </QueryClientProvider>
  );
}
```

---

## Tests (vitest)

Same setup as other apps in the monorepo. `vitest.config.ts`:

```ts
import { createVitestConfig } from "@bokendell/testing/vitest";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const HERE = resolve(import.meta.dirname);

export default createVitestConfig({
  passWithNoTests: true,
  plugins: [react()],
  alias: {
    "@":         resolve(HERE, "src"),
    "@lib":      resolve(HERE, "src/lib"),
    "@packages": resolve(HERE, "src/packages"),
    "@<app>-ui": resolve(HERE, "../../packages/ui/src/index.ts"),
    "@shared/games": resolve(HERE, "src/packages/shared/games/index.ts"),
  },
});
```

**Watch out for client/server splits in tests:** vitest pulls source files transitively. If a test file imports the discovery registry → which imports the round barrel → which imports the container → which imports canvas → which imports xyflow → which imports CSS, vitest fails on CSS resolution. **Fix at the source**: import data files (meta.ts) from their explicit path, not via the package barrel. Example: `import { roundDomain } from "@packages/mobile/round/meta"` (not `from "@packages/mobile/round"`).

---

## Plug-and-play for new design apps

A new design app (e.g. `apps/design/`) is:

1. Copy the layout of `apps/<existing-app>/design/`.
2. Replace `@<existing-app>-ui` imports with the new app's UI package.
3. Rewrite `packages/site/` to use the new brand chrome (header, theme toggle, discovery card styling).
4. Build out `packages/mobile/` (or whatever surfaces the app has).
5. Once `lib/core/*` is promoted to `@bokendell/design`, the import surface is identical across apps.

Future improvement: a `swarm design new-app <slug>` scaffolder.

---

## Anti-patterns

- **Don't import containers from package barrels in data-only consumers** (registry, meta files, tests). Pull from `./meta` directly. Barrels drag in canvas + xyflow + CSS.
- **Don't put `node:fs` in a client-bundled module.** Server helpers like `scanFlowSketches` live in `lib/core/<module>/server.ts`, never re-exported from a client-safe barrel.
- **Don't validate env with `import.meta.env`.** Use `process.env.NEXT_PUBLIC_*` through a zod-validated `env.ts`. No Vite-era keys.
- **Don't move `meta.json` / `index.html` / Vite `main.tsx` to the new structure.** Replace with `meta.ts` + route `page.tsx` + screen/container. Preserve old `main.tsx` as `legacy-main.tsx.bak` if you haven't ported the content yet.
- **Don't add an `(_)`-prefixed folder under `src/lib/`.** Use plain names — `core/`, not `_core/`. Underscore-prefix is reserved for actual private/excluded directories.
- **Don't put screens or containers in `flows/<flow>/`.** Those go at the domain level (`<domain>/screens/`, `<domain>/containers/`). Only flow-specific artifacts (meta, decisions, sections, sketches) live in the flow folder.
- **Don't reach across surface groups with deep relative imports.** Use `@packages/<surface>/<domain>/flows/<flow>/sections/<file>` aliases. Sections that need to share components should promote the component to a shared package.
- **Don't add Vite-specific deps to `package.json`.** No `vite`, `@tailwindcss/vite`, `vite-plugin-singlefile`. `@vitejs/plugin-react` is ONLY allowed as a vitest devDep for JSX transform.

---

## Cross-references

- [`design-studio.md`](./design-studio.md) — annotation system, element IDs, comment workflow
- [`design-workflow.md`](./design-workflow.md) — per-flow conventions, decisions.md, promotion ladder
- [`frontend.md`](./frontend.md) — container/screen/hook/store contract (identical here)
- [`per-app-ui.md`](./per-app-ui.md) — token contract for per-app UI packages
