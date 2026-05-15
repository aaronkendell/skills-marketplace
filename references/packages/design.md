# @bokendell/design — Agent Context

> Location: `packages/shared/design/`
>
> Brand-agnostic studio framework. Every app's design surface (`apps/<app>/design/`) consumes this package. Per-app brand tokens + primitives live elsewhere (`@bokendell/<app>-ui`); this package owns the *frame around the primitives*.

## Internal layout — `lib/` + `packages/`

Mirrors the broader monorepo's `packages/<app>/domains/src/packages/<domain>/` convention. Each named feature is its own folder with an `index.ts` barrel; cross-feature utilities sit under `src/lib/`. **No top-level flat files** — if a thing is exported it lives under a feature package.

```
packages/shared/design/src/
├── index.ts                         convenience re-export of every feature
├── lib/                             cross-feature utilities (currently empty)
└── packages/
    ├── annotations/                 picker overlay · drawing surface · saver · pins · comment bubbles
    │   ├── api/annotations-client.ts
    │   ├── components/{annotation-overlay, annotation-saver, annotation-pins, comment-bubble, drawing-canvas, drawing-toolbar}.tsx
    │   ├── hooks/{use-annotation-drawing, use-annotations}.ts
    │   ├── lib/anchor-resolver.ts
    │   ├── types.ts
    │   └── index.ts
    ├── auth/                        DesignAuthProvider · StudioAuthGate · pendingAnnotation queue
    │   ├── context.ts · studio-auth-gate.tsx · pending.ts
    │   └── index.ts
    ├── canvas/                      DesignCanvas · DCSection · DCArtboard · DCEditable · DCFocusOverlay · DCHotspot · DCPostIt · id-badges
    │   ├── components/{design-canvas, viewport, section, artboard, editable, focus-overlay, hotspot, postit, id-badge}.tsx
    │   ├── lib/{styles, export}.ts
    │   ├── ctx.ts · types.ts · index.ts
    ├── chrome/                      DesignToolbar · StudioNav · UserMenu (floating studio chrome)
    ├── devices/                     IOSDevice · WebFrame + iOS sub-primitives
    ├── hooks/                       useUrlValue · useArtboardState · useUrlTheme
    ├── kit/                         Section · Row · PreviewFrame
    ├── mount/                       createStudioApp · mountStudio (one-call entry helper)
    └── studio-root/                 discoverEntries · groupEntries (turns meta.json glob into typed entries)
```

## Subpath exports

Use subpath imports (tree-shakeable, intent-explicit). Top-level barrel exists as a convenience but prefer the subpaths.

```ts
import { DesignCanvas, DCSection, DCArtboard, DCPostIt, DCHotspot, ArtboardIdBadge, SectionIdBadge } from "@bokendell/design/canvas";
import { IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard, WebFrame } from "@bokendell/design/devices";
import { useUrlValue, useArtboardState, useUrlTheme, type StudioTheme } from "@bokendell/design/hooks";
import { createStudioApp, mountStudio } from "@bokendell/design/mount";
import { Section, Row, PreviewFrame, type SectionMeta, type SectionModule, type PreviewPlatform } from "@bokendell/design/kit";
import { discoverEntries, groupEntries, type StudioEntry, type StudioEntryMeta, type StudioGroup, type Category } from "@bokendell/design/studio-root";
import { AnnotationPins, CommentBubble, useAnnotations, useAnnotationDrawing, type DrawingTool } from "@bokendell/design/annotations";
import { DesignToolbar, StudioNav, UserMenu } from "@bokendell/design/chrome";
import { DesignAuthProvider, StudioAuthGate, useDesignAuth, type DesignAuthClient } from "@bokendell/design/auth";
```

### What each subpath gives you

| Subpath | Exports | What it does |
|---|---|---|
| `/canvas` | `DesignCanvas` · `DCSection` · `DCArtboard` · `DCEditable` · `DCFocusOverlay` · `DCPostIt` · `DCHotspot` · `ArtboardIdBadge` · `SectionIdBadge` | Figma-style pan/zoom canvas. Sections hold artboards; artboards are reorderable / deletable / inline-editable / focus-modable. `DCHotspot` wraps an element to make it click-through to another artboard. Id-badges surface stable copyable IDs in annotate mode. |
| `/devices` | `IOSDevice` (+ status bar / nav bar / glass pill / list / list row / keyboard) · `WebFrame` | Phone + faux browser chrome for mocks. Theme-aware via `data-theme` attribute. |
| `/hooks` | `useUrlValue` · `useArtboardState` · `useUrlTheme` · `StudioTheme` | URL-backed state hooks. `useArtboardState` namespaces state per-artboard. `useUrlTheme` syncs `?theme=` to `<html data-theme>`. |
| `/mount` | `createStudioApp` · `mountStudio` | `createRoot` + render boilerplate. `createStudioApp({ app, brand, entries })` is the high-level helper every per-app studio's `main.tsx` uses. Wraps in `DesignAuthProvider` + `StudioAuthGate` + global `TooltipProvider` when auth is wired. |
| `/kit` | `Section` · `Row` · `PreviewFrame` (+ types) | Filterable section wrapper + label/example row layout + mobile/web toggle for primitive showcases. |
| `/studio-root` | `discoverEntries` · `groupEntries` | Turn a `meta.json` glob result into sorted, grouped studio-root entries (reference vs surface vs flow). |
| `/annotations` | `AnnotationOverlay` · `AnnotationSaver` · `AnnotationPins` · `CommentBubble` · `DrawingCanvas` · `DrawingToolbar` · `useAnnotationDrawing` · `useAnnotations` · `annotationsClient` · stroke + thread types | In-house annotation system. Picker walks up to nearest `data-dc-slot` / `data-dc-section`, captures screenshot + drawing strokes, persists through `swarm-api`. Pins render on the canvas in display mode. |
| `/chrome` | `DesignToolbar` · `StudioNav` · `UserMenu` | Floating studio chrome — bottom-center tool palette, top-left page picker (Popover + Command), top-right account menu (DropdownMenu). |
| `/auth` | `DesignAuthProvider` · `StudioAuthGate` · `useDesignAuth` · `pendingAnnotation` queue · types | Better-Auth client glue. Gates the whole studio behind a signed-in session when the studio is mounted with auth. |

## API access — never hand-roll fetch

Every swarm-api call goes through `@bokendell/swarm-client` (tRPC). `createStudioApp` wires the providers for you — inside any component under the studio, `useTRPC()` returns the typed proxy:

```tsx
import { useTRPC } from "@bokendell/swarm-client/trpc";
import { useQuery } from "@tanstack/react-query";

function Comments({ flow }: { flow: string }) {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.annotations.list.queryOptions({ app: "golf", flow }));
  // data is fully typed off swarm-api's AppRouter
}
```

Types come from the same package — no duplicate DTOs:

```ts
import type { AnnotationResponse, AnnotationStatus } from "@bokendell/swarm-client";
```

**Never write `fetch("/api/v1/...")` inside the design package or a consuming studio.** If a swarm-api route is missing for what you need, add the tRPC procedure in `apps/swarm/api/...` and re-export the schemas from `@bokendell/swarm-domains/<topic>/client` → `@bokendell/swarm-client`. See `context/packages/swarm-client.md`.

## Primitive policy — no reinventing

Every interactive surface is built on `@bokendell/ui` primitives (shadcn host):

| Surface | Primitive |
|---|---|
| Tool buttons, account avatar, id-badge, comment actions | `Button` (+ `Tooltip`) |
| Page picker | `Popover` + `Command` (cmdk-backed search / keyboard nav / highlight) |
| Account dropdown | `DropdownMenu` (outside-click + Esc + focus return handled by Radix) |
| Avatar fallback initials | `Avatar` / `AvatarFallback` |
| Comment thread scroller | `ScrollArea` |
| Comment composer | `Textarea` |
| Drawing toolbar separator | `Separator` |
| Shortcut keys | `Kbd` |
| Auth gate inputs | `Input` · `Label` · `Form` |
| Toast notifications | `toast` (Sonner) — also mounted by `@bokendell/ui` `Toaster` |
| Hover / press hints | `Tooltip` (mount inside the global `TooltipProvider` `mountStudio` installs) |

**Never re-implement outside-click, Esc handling, focus return, or aria wiring.** If a primitive in `@bokendell/ui` covers it, use it via `asChild` / Slot. If a primitive is missing, add it to `@bokendell/ui` first (shadcn install), then consume it here.

`mountStudio` installs a single `TooltipProvider` at the root with `delayDuration={250}` — every `Tooltip` in the framework reads from it.

## How a new app consumes this

1. Create `apps/<app>/design/` with this shape:

```
apps/<app>/design/
├── package.json              "name": "@bokendell/<app>-design"
├── biome.json                extends ../../../biome.json
├── tsconfig.json             extends @bokendell/tsconfig/browser.json
├── vite.config.ts            multi-page entries via tinyglobby
├── vercel.json               buildCommand: pnpm build
├── globals.d.ts              vite/client + .css module shim
├── index.html
├── main.tsx                  studio root — uses createStudioApp
├── lib/
│   └── studio.css            imports @bokendell/<app>-ui/tokens.css + fonts.css
├── flows/<slug>/
│   ├── index.html
│   ├── main.tsx              uses DesignCanvas + DCSection + DCArtboard
│   ├── meta.json             {title, subtitle, category, order, status}
│   ├── README.md             current state + what's being decided
│   └── decisions.md          append-only log
└── kits/<slug>/
    ├── index.html
    ├── main.tsx
    └── meta.json
```

2. Minimal `vite.config.ts` — no Vercel-toolbar gate, no `VERCEL_ENV` define:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { globSync } from "tinyglobby";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const entries = globSync(["index.html", "flows/**/index.html", "kits/**/index.html"], {
  cwd: HERE, absolute: true,
});
const input = Object.fromEntries(
  entries.map((e) => [e.slice(HERE.length + 1).replace(/\.html$/, "") || "index", e]),
);

export default defineConfig({
  root: HERE,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@<app>-ui": resolve(HERE, "../../../packages/<app>/ui/src/index.ts") } },
  build: { outDir: "dist", emptyOutDir: true, rollupOptions: { input } },
});
```

3. Top-level `main.tsx` (studio root) — `createStudioApp` handles auth + chrome + entries:

```tsx
import "./lib/studio.css";
import { createStudioApp } from "@bokendell/design/mount";
import type { StudioEntryMeta } from "@bokendell/design/studio-root";
import { authClient } from "./lib/auth-client";

const metaModules = import.meta.glob<StudioEntryMeta>("./{flows,kits}/*/meta.json", {
  eager: true, import: "default",
});

createStudioApp({
  app: "<app>",
  brand: "<App> Design",
  entries: metaModules,
  auth: { authClient, swarmApiUrl: import.meta.env.VITE_SWARM_API_URL },
});
```

4. Each flow `main.tsx`:

```tsx
import "../../lib/studio.css";
import { DesignCanvas, DCSection, DCArtboard } from "@bokendell/design/canvas";
import { IOSDevice } from "@bokendell/design/devices";
import { mountStudio } from "@bokendell/design/mount";
import { MySection } from "./sections/00-entry";

function App() {
  return (
    <DesignCanvas>
      <DCSection id="entry" title="00 · Entry">
        <DCArtboard id="entry-default" label="Default" width={402} height={874}>
          <IOSDevice width={402} height={874}>
            <MySection />
          </IOSDevice>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

mountStudio(<App />);
```

## Conventions

- **Primitives stay in `@bokendell/<app>-ui`**. Never move brand primitives into this package. This package owns chrome (canvas, frames, kit, mount), not brand.
- **No brand-specific values here**. Styling reads from per-app CSS custom properties (`--color-ink`, `--color-bg-elev`, `--color-accent`, `--color-hairline`) which resolve through the consuming app's tokens.css. No hex colors, no font names, no app-specific assets.
- **One component per file**. The drawing system splits into `hooks/use-annotation-drawing.ts` (state), `components/drawing-canvas.tsx` (SVG paint), and `components/drawing-toolbar.tsx` (palette). Don't co-locate; the next reviewer should be able to land in one file and read top-to-bottom.
- **`DC*` prefix for canvas primitives** — `DCSection`, `DCArtboard`, `DCHotspot`, `DCEditable`, `DCPostIt`. Anything that's a marker / wrapper inside `<DesignCanvas>` carries the prefix.
- **No DB, no MCP, no infra in the framework itself.** Annotation persistence rides on the existing `swarm-api` — no extra service.
- **No Vercel Toolbar.** The studio ships its own picker overlay via `@bokendell/design/annotations`. The toolbar dep was removed; don't re-add it.

## Adding a new device frame

Sibling of `IOSDevice` and `WebFrame`. Drop a new `<name>.tsx` under `src/packages/devices/`, export from `src/packages/devices/index.ts`, document its props. If it makes sense in `<PreviewFrame>`, extend `preview-frame.tsx` to add a third toggle option (the URL state already supports arbitrary strings).

## Adding a new canvas primitive

Drop a `<name>.tsx` under `src/packages/canvas/components/`, export from `src/packages/canvas/index.ts`. Prefix the export with `DC` to match the rest. Use the existing `DCHotspot` pattern — dispatch a custom DOM event on `document`, let `DesignCanvas` listen for it. Keeps the canvas's internal `DCCtx` private.

## Adding a new feature package

Create `src/packages/<name>/` with at minimum:

```
src/packages/<name>/
├── components/  (optional — UI under this feature)
├── hooks/       (optional — React hooks)
├── lib/         (optional — pure utilities, no React)
├── api/         (optional — HTTP / service clients)
└── index.ts     barrel — re-export the public surface
```

Then add a subpath to `package.json` `"exports"` and re-export from `src/index.ts`. Don't add files under a feature that won't be exported from its `index.ts` — leave private helpers there as unexported.

## See also

- `context/packages/swarm-client.md` — tRPC client used by every swarm-api call inside studios.
- `context/patterns/design-studio.md` — the studio + annotation pattern in full.
- `context/patterns/per-app-ui.md` — token contract per app + how brand layers compose with this framework.
- `apps/golf/design/ROADMAP.md` — current status, suggested task order, parallelization map.
- `apps/golf/design/README.md` — workshop / showroom mental model + daily workflow.
