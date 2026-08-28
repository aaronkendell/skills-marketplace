# Design Workflow — daily loop for per-app design studios

> One-page guide for working on `apps/design/` (Vite studio) day to day,
> now that the studio + swarm-api + annotation system are wired up. Loaded
> automatically by `/dev:design` and `/context-patterns` skills.

The studio is a **pure frontend**. Annotations + comment threads persist in
swarm-api (Postgres on Neon). One backend, one DB across local + every
deployed studio surface — your local dev studio reads/writes the same data
your cofounder sees on the Vercel preview.

## The default loop (95% case — frontend-only)

Point your local studio at the **deployed swarm-api**. Faster to start (no
second terminal), the same data accumulates, and you only need the local
backend when you're actually changing it.

One-time per worktree — drop this in `apps/design/.env.local`
(gitignored):

```bash
VITE_SWARM_API_URL=https://api.swarm.bokendell.com
```

Then daily:

```bash
cd apps/design
pnpm dev                              # studio on http://localhost:5173/
# OR from repo root:
pnpm --filter @bokendell/<app>-design dev
```

Open `http://localhost:5173/flows/<flow>/` (or `/kits/<kit>/`) for the
flow you're working on. HMR is on; edits to `sections/*.tsx` appear
immediately.

In the studio:

- **Cmd + .** opens the annotation overlay. Pick an element, type a note,
  optionally draw arrows / pen strokes / boxes. Saves to swarm-api.
- **Cmd + K** opens the page picker (Popover + Command palette).
  Type to search every flow / kit; ↑↓ + Enter to navigate.
- **Pins** showing existing threads render on the canvas when a flow has
  any (or always with `?pins=1`).

When you're satisfied:

```bash
git add -A
# (don't auto-commit — user commits)
git push   # branch push → Vercel preview deploy
```

Vercel posts the preview URL on the PR; share that URL with your
cofounder for review. Their comments land in the same swarm-api annotations
table you see locally.

## Claude Code skills — order of use

Each phase of the loop has a skill that should be in your muscle memory:

| Phase | Skill | What it does |
|---|---|---|
| Sitting down to design anything | `/dev:design` | Auto-loads `references/apps/<app>.md`, the per-app token contract, the relevant flow's `decisions.md`. **Run this first** every session |
| Direction-finding for a new look | `/impeccable:shape` | Discovery interview → design brief BEFORE any code |
| Building / iterating | `/impeccable:craft` | Full shape-then-build flow when you don't know the direction yet |
| Style explorations | `/ui-ux-pro-max plan <style>`, `/taste-skill`, `/redesign-skill` | Generate alternative directions |
| Multi-agent taste pass | `/design-review` | Parallel `/taste-skill` + `/impeccable:impeccable` + `/ui-ux-pro-max` over a flow bundle, summarizes deltas |
| HARD-RULES + visual audit | `/design-verify` | Playwright screenshots → read decisions.md → audit against per-app rules → P0–P3 finding list |
| What's outstanding on a flow? | `/design-comments list --app <app> --flow <flow>` | Lists open annotation threads from swarm-api |
| Implement one feedback item | `/design-address <annotation-id>` | Reads the annotation + screenshot + strokes, fixes the code, marks the thread `addressed` |
| Calmer / more refined feel | `/impeccable:quieter`, `/impeccable:distill` |
| Add polish + micro-interactions | `/impeccable:delight`, `/impeccable:animate`, `/impeccable:polish` |
| Pre-merge sweep | `/impeccable:audit` → `/impeccable:polish` → `/design-verify` |

**The opinionated default flow** when starting a new flow / surface from scratch:

```
/dev:design                       (load context)
/impeccable:shape                 (design brief)
<edit + iterate, Cmd+. as you go>
/design-verify                    (HARD-RULES + decisions check)
/design-review                    (taste pass)
/impeccable:polish                (final polish)
git push
```

**Iteration loop on an existing flow**:

```
/dev:design
/design-comments list --flow <flow>
/design-address <id>              (per open thread)
/design-verify --flow <flow>      (sweep before push)
git push
```

## When to run swarm-api locally (the 5% case)

If you're touching anything API-side, two-terminal mode:

```bash
# Terminal 1 — swarm-api on :3500
pnpm --filter @bokendell/swarm-api dev

# Terminal 2 — studio pointing at local API
VITE_SWARM_API_URL=http://localhost:3500 pnpm --filter @bokendell/<app>-design dev
```

You need a local swarm-api when changing:

- `packages/domains/**` — entities, schemas, services
- `apps/api/**` — oRPC routers, middleware, openapi
- `packages/composition/**` — DI wiring
- `packages/api-db/**` — DB schema

For destructive DB experiments or per-PR Neon branches, use the workspace
tunnel system: `pnpm swarm workspace create <name> --project swarm-api ...`
(see `docs/context/patterns/remote-tunnels.md`). Overkill for everyday
design work but the right tool when you need real isolation.

## Adding a new flow / kit

```bash
pnpm swarm design new-flow active-round --app golf
# Scaffolds:
#   apps/design/flows/active-round/
#     ├── index.html
#     ├── main.tsx          ← uses createStudioApp + DesignCanvas
#     ├── meta.json
#     ├── decisions.md      ← append-only log of design decisions
#     └── README.md         ← current state + what's being decided
```

Open `http://localhost:5173/flows/active-round/` once Vite picks up the
new entry (Vite's globbed entries auto-reload).

## When a flow gets messy / a primitive emerges

If you find yourself writing the same `className` combo more than once in
a flow, that's a missing primitive. Move it to
`packages/ui/src/components/<Name>/` (per the per-app-ui pattern).
The studio's flows can only consume primitives, not invent them — that's
the HARD-RULES 25 split.

## Anti-patterns — what NOT to do

- **No local fetches against `/api/v1/*`** — every swarm-api call goes
  through `useSwarmOrpc()` (auto-wired by `createStudioApp`). Types come from
  `@bokendell/swarm-client`. See `docs/context/packages/swarm-client.md`.
- **No `.env` files for runtime secrets** — `.env.local` only carries
  client-side build-time config (the `VITE_*` URL). Backend secrets live in
  Infisical at `/apps/api`; the workspace dev tunnel injects them.
- **No emoji in code or UI** — Lucide icons inside components, plain text
  in copy / logs (the `no-emoji` arch rule enforces this).
- **No auto-commit by skills** — Claude stages with `git add`; you commit.
- **No third-party comment toolbars** — annotations are in-house via
  `@bokendell/design/annotations`. Vercel Toolbar was removed.

## See also

- `docs/context/packages/design.md` — `@bokendell/design` framework surface
- `docs/context/packages/swarm-client.md` — oRPC client + types
- `docs/context/patterns/design-studio.md` — full annotation flow
- `docs/context/patterns/per-app-ui.md` — token contract
- `apps/design/README.md` — per-studio specifics (Vercel deploy etc.)
