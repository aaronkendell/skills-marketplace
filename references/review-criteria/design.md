# Design App Review Criteria (Next.js studio)

> Full reference: `references/patterns/design.md`
>
> Apply to: `apps/<app>/design/**` — golf, hive, portfolio, any per-app studio.
> Frontend container/screen/hook/store rules from `frontend.md` apply too — this doc
> only covers the design-app-specific structural rules on top.

## Top-level layout

- [ ] BLOCKING: No top-level Vite files (`main.tsx`, `index.html`, `vite.config.ts`) at `apps/<app>/design/` root
- [ ] BLOCKING: No `@bokendell/vite*` or `vite-plugin-*` deps in `package.json` — only `@vitejs/plugin-react` allowed (and only as devDep for vitest's JSX transform)
- [ ] BLOCKING: `package.json` includes `next` (catalog) and uses `next dev` / `next build` in scripts (no `vite dev` / `vite build`)
- [ ] IMPORTANT: Loose docs live under `apps/<app>/design/docs/`, not at the package root
- [ ] IMPORTANT: Brand assets live under `apps/<app>/design/public/brand/` with a `README.md` documenting the promotion ladder

## Package structure

- [ ] BLOCKING: `src/` contains only `app/`, `lib/`, `packages/`, and (optional) `types/` — no other top-level dirs
- [ ] BLOCKING: `src/packages/site/` exists and exports `RootLayoutContainer`, `DiscoveryContainer`, `PageStructuredData`
- [ ] BLOCKING: Surface groups are `mobile/`, `admin/`, `marketing/`, `kits/`, `shared/` — no `-flow` suffix anywhere
- [ ] BLOCKING: Each domain holds `containers/`, `screens/`, `flows/<flow>/`, plus optional `hooks/`, `stores/`, `components/`, `utils/`, `types.ts`, `constants.ts`
- [ ] BLOCKING: `flows/<flow>/` contains ONLY per-flow artifacts: `meta.ts`, `decisions.md`, `README.md`, `sections/`, `sketches/` (and optionally `legacy-main.tsx.bak` during migration)
- [ ] BLOCKING: Screens + containers live at DOMAIN level (`<domain>/screens/`, `<domain>/containers/`), NOT inside `flows/<flow>/`
- [ ] IMPORTANT: Each domain has an `index.ts` barrel exporting only its containers + flow metas

## Route files (`app/`)

- [ ] BLOCKING: Route files are thin (≤ 15 lines) — import container + meta, return `<PageStructuredData /> + <Container />`
- [ ] BLOCKING: Route file lives at `app/(surface)/<surface>/<domain>/<flow>/page.tsx` (the `(surface)` group keeps URLs clean)
- [ ] BLOCKING: `export const metadata: Metadata = <flow>PageMeta.metadata;` declared at top of route file
- [ ] BLOCKING: Sketches scanned via `await scanFlowSketches(surface, domain, flow)` in the route (server component), passed to the container as `sketches` prop
- [ ] IMPORTANT: Route imports come from `@packages/<surface>/<domain>` barrel for the container; from `@packages/<surface>/<domain>/flows/<flow>/meta` for the page meta

## lib/ vs packages/

- [ ] BLOCKING: `src/lib/` holds only TRULY shared, app-only stuff: providers, env, studio.css, studio-frame, nav-config, auth wiring, cross-package types/constants
- [ ] BLOCKING: Anything used by 2+ feature areas goes in `lib/` — anything used by ONE domain goes inside that domain
- [ ] BLOCKING: `lib/core/` is the local stash for future `@bokendell/design` modules (shell, layouts, routing, page-meta, sketches, errors) — promoted into the core package once stable
- [ ] IMPORTANT: No `_`-prefixed folders under `src/lib/`. Underscore prefix means actually-excluded; use plain names (`core/`, not `_core/`)

## Sketches

- [ ] BLOCKING: Sketches collocated at `packages/<surface>/<domain>/flows/<flow>/sketches/*.html` (note: `sketches/` plural, not `sketch/`)
- [ ] BLOCKING: Sketches discovered via `scanFlowSketches()` from `@lib/core/sketches/server` (server-only — uses `node:fs/promises`)
- [ ] BLOCKING: Sketches served by a single route handler at `app/sketches/[...path]/route.ts` returning `text/html` with path-traversal guard
- [ ] BLOCKING: `<SketchIndex>` rendered as a `<DCArtboard>` inside the flow's `<DesignCanvas>` — not as a separate page
- [ ] BLOCKING: `scanFlowSketches` lives in `@lib/core/sketches/server`, `<SketchIndex>` lives in `@lib/core/sketches` — the barrel split prevents `node:fs` leaking into the client bundle

## Discovery registry

- [ ] BLOCKING: `src/packages/site/discovery/registry.ts` imports each domain's `meta.ts` directly (`@packages/<surface>/<domain>/meta`), NOT the package barrel
- [ ] BLOCKING: Registry returns `Array<SurfaceDefinition>` typed via `defineSurface(...)` from `@lib/core`
- [ ] IMPORTANT: Registry test (`registry.test.ts`) verifies at least one surface exists and the expected domain is registered

## Providers

- [ ] BLOCKING: `src/lib/providers/root-providers.tsx` wraps the tree in `QueryClientProvider` + `SwarmOrpcProvider` (from `@bokendell/swarm-client/orpc`) + `TooltipProvider` (from `@bokendell/ui`)
- [ ] BLOCKING: Swarm-api URL read from `process.env.NEXT_PUBLIC_SWARM_API_URL` (with sensible fallback), NOT hardcoded in containers
- [ ] IMPORTANT: `RootProviders` is a `"use client"` component mounted by `RootLayoutContainer`

## Env validation

- [ ] BLOCKING: Env keys use `NEXT_PUBLIC_*` prefix — no `VITE_*` keys, no Vite-era `import.meta.env`
- [ ] BLOCKING: `src/lib/env.ts` validates via zod schema in `src/lib/env-schemas.ts`, throws at module-load time on bad config
- [ ] BLOCKING: `src/lib/env-infisical.ts` lists the same `NEXT_PUBLIC_*` keys in its `optional`/`required` arrays (parity with the zod schema)
- [ ] IMPORTANT: Consumers read `env.NEXT_PUBLIC_*` — never `process.env.NEXT_PUBLIC_*` directly

## tsconfig

- [ ] BLOCKING: Extends `@bokendell/tsconfig/next.json`
- [ ] BLOCKING: Path aliases include `@/*`, `@lib/*`, `@packages/*`, and `@<app>-ui` + `@<app>-ui/*`
- [ ] BLOCKING: `include` scopes to `src/**/*` + Next.js boilerplate — does NOT include Vite-era `main.tsx`, `flows/`, `kits/`, `lib/`
- [ ] BLOCKING: Compiler types do NOT include `vite/client`

## studio.css

- [ ] BLOCKING: Imports `@bokendell/<app>-ui/tokens.css` + `fonts.css` (THE source of brand tokens)
- [ ] BLOCKING: `@source` paths point at the new layout (`../../../../packages/ui/src/**/*.{ts,tsx}` etc.) — not Vite-era `../flows/**`, `../kits/**`, `../main.tsx`
- [ ] IMPORTANT: Only studio-only chrome lives here (`.no-scrollbar`, `.ios-host`) — no brand decisions duplicated from tokens.css

## Auth surface vs auth plumbing

- [ ] BLOCKING: Auth providers + session wiring live in `src/lib/auth/`
- [ ] BLOCKING: Auth FLOW design explorations live in `src/packages/mobile/auth/` (sign-in screens, onboarding mocks) — never the other way around

## Anti-patterns (instant reject)

- [ ] BLOCKING: No `import.meta.glob(...)` anywhere — Vite-only
- [ ] BLOCKING: No `import.meta.env` — Vite-only
- [ ] BLOCKING: No `createStudioApp(...)` or `studio.mount(...)` calls — that was the Vite mount pattern; Next.js uses route files
- [ ] BLOCKING: No top-level `flows/` or `kits/` directories at `apps/<app>/design/` root — they live under `src/packages/`
- [ ] BLOCKING: No deep cross-flow relative imports past 3 levels (`from "../../../../<x>"`) — promote to `@packages/...` alias
- [ ] BLOCKING: No `next.config.ts` imports of files that use `import.meta.env` — that breaks Next.js boot
- [ ] IMPORTANT: No `WebStudioFrame` / `StudioFrame` redeclared inline in screens — import from `@lib/studio-frame`

## Migration in progress (allowed temporarily)

These are allowed during the Vite → Next.js migration and removed by the end of Plan 3 / Plan 4 / Plan 5:

- [ ] OK during migration: `legacy-main.tsx.bak` files preserved in `flows/<flow>/` (frozen Vite content awaiting port)
- [ ] OK during migration: `src/lib/core/*` (eventually promotes to `@bokendell/design`)
- [ ] OK during migration: placeholder screens that render "Coming soon" + sketch index only

Once a flow's content is fully ported, `legacy-main.tsx.bak` MUST be deleted.
