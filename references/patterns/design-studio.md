# Design Studio + Annotation Pattern

> Cross-app pattern for the per-app design surfaces (`apps/<app>/design/`). Owned by `@bokendell/design`. Applies identically to golf, portfolio, hive, and any future app.

> Studios consume `@bokendell/<app>-ui/tokens.css` for brand chrome. Per-app UI packages follow the contract in [`per-app-ui.md`](./per-app-ui.md) — colors/radii/typography reskin freely, but `--spacing-N` numerically is reserved for Tailwind's standard scale. Brand-bigger spacings use semantic names (`--spacing-xl/2xl/3xl/page/section`).

## Why this exists

Claude does ~all the design work. The bottleneck is **identifying which element the user is pointing at**. Visual editors (paper.design, Codux) solve this with WYSIWYG canvases but lose the typed-primitive + HARD-RULES discipline. Storybook solves it for components but not for full flows. We need a surface that:

- Renders real `@bokendell/<app>-ui` primitives (no abstraction layer)
- Has stable, copyable IDs on every section + artboard
- Lets the user comment on elements with screenshots + drawings
- Surfaces those comments to Claude **without manual paste**, **without infra**, **without a DB**
- Works the same on every app

This pattern is the answer.

## Status

| Layer | Built | Tracker |
|---|---|---|
| Studio framework (`@bokendell/design` + per-app `apps/<app>/design/`) | ✅ Done — golf shipped | `apps/golf/design/ROADMAP.md` |
| Element-ID convention (`data-dc-slot` / `data-dc-section`, `<ArtboardIdBadge />`) | ✅ Done | — |
| In-house annotation overlay (`AnnotationOverlay` + pick / draw + Cmd+.) | ✅ Done | — |
| Auth-gated swarm-api persistence (annotations endpoint) | ✅ Done | — |
| Pin display + comment bubble threads | ✅ Done | — |
| CLAUDE.md discovery convention | ✅ Done | — |

The framework + annotation system are live in production.

## The single-loop model

Both local dev and deployed previews write to the **same swarm-api annotations endpoint**. There is no separate "pull from third-party" step — the studio writes directly, signed-in.

```
ANY ENVIRONMENT (local dev, vercel preview, vercel production)
  Studio mounted with `createStudioApp({ auth })`
  → Cmd+. (or chrome toolbar) → AnnotationOverlay
  → screenshot + strokes + note → POST /api/v1/annotations
  → swarm-api persists thread + replies
  → AnnotationPins render on every viewer's canvas in display mode
  → CommentBubble surfaces inline; the user can resolve or reply

Claude consumes via `swarm design comments pull --app <app>` (writes .annotations/ md files
+ screenshots) and the user `git add`s what they want tracked.
```

## How a comment flows (live, all environments)

1. User hits `Cmd+.` in studio (or clicks the Comment tool in the bottom toolbar)
2. `AnnotationOverlay` activates — cursor becomes element picker, hover highlights elements with their handle: `sg-skins-light > Bar (3rd of 12)`
3. Click element → highlight locks, composer + transparent drawing canvas appear nearby (powered by `useAnnotationDrawing` + `DrawingCanvas` + `DrawingToolbar`)
4. User types note, optionally draws (pen / arrow / box)
5. `Cmd+Enter`:
   - `html2canvas` captures a snug box around the highlighted element
   - Drawing layer is composited on top
   - `annotationsClient.create(...)` POSTs `{ app, flow, artboard, anchor, note, strokes, screenshot }` to swarm-api
6. `swarm-api` persists the thread to its annotations table. The pin and any new replies stream back to every studio session via the realtime channel.
7. Other studio viewers see a new `<AnnotationPins>` marker on the canvas; clicking it opens the `<CommentBubble>` thread inline.
8. Claude pulls on demand: `pnpm swarm design comments pull --app <app>` writes `apps/<app>/design/flows/<flow>/.annotations/<timestamp>-<artboard>.md` + screenshots. User `git add`s what they want to track. No auto-commit per project rules.

There is **no Vercel Toolbar dependency**, no `vitePluginAnnotate`, no separate "local vs deployed" write paths. One overlay writes to one backend in every environment.

## File format (after `swarm design comments pull`)

The system-of-record is the swarm-api annotations table. `swarm design comments pull` projects it down to one `.md` per thread under `apps/<app>/design/flows/<flow>/.annotations/` so Claude can read with its standard tools.

```
.annotations/2026-05-11T14-02-sg-skins.md
```

```markdown
---
id: <thread-uuid>
timestamp: 2026-05-11T14:02:33Z
flow: round
artboard: sg-skins-light
element: Bar (3rd of 12)
author: bo@example.com
status: open                 # open | resolved
screenshot: screenshots/2026-05-11T14-02-sg-skins.png
---

dots feel too small at 6px, try 8px

## Replies

- **2026-05-11 14:18 @cofounder** — agreed, also bump the gap to 4px
```

The auto-regenerated `_index.md` Claude reads first:

```markdown
# Annotations — flows/round

## sg-skins-light · Bar (3rd of 12)
- **2026-05-11 14:02 [local]** dots feel too small at 6px, try 8px
  ![](screenshots/2026-05-11T14-02-sg-skins.png)

## sc-greenies-light
- **2026-05-12 09:14 [vercel @cofounder]** legend wraps oddly on narrow widths
  ![](screenshots/2026-05-12T09-14-sc-greenies.png)
```

## Element identification

`<DCArtboard>` stamps `data-dc-slot="<artboardId>"` and `<DCSection>` stamps `data-dc-section="<sectionId>"` automatically — every artboard and section gets a stable, copyable id without per-primitive opt-in.

Every primitive in `@bokendell/<app>-ui` additionally exposes `data-component` on its root in the `.web.tsx`:

```tsx
// packages/golf/ui/src/components/Bar/Bar.web.tsx
<div
  data-component="Bar"
  data-variant={width}
  data-color={color}
  className={cn(...)}
/>
```

The overlay's element picker walks up from the click target finding the nearest:
- `data-component` (the primitive name)
- `data-dc-slot` (the DCArtboard's `id`)
- `data-dc-section` (the DCSection's `id`)

Then computes a stable handle: `<artboard-id> > <component-name> [(<nth> of <total>)]`.

The `<ArtboardIdBadge />` in every artboard corner is the manual fallback — click to copy `sc-greenies-light`, paste in chat, Claude grep-jumps to the file.

## How Claude finds comments

**Convention via CLAUDE.md, not a hook.** The user is not always doing design work; a `UserPromptSubmit` hook would inject design context into unrelated turns.

The CLAUDE.md `Design annotations` section directs Claude to read `apps/<app>/design/flows/<flow>/.annotations/_index.md` when the conversation mentions design comments / flow names / artboard IDs / "check comments". Screenshots in the index are openable via the Read tool.

**Optional later:** a scoped `UserPromptSubmit` hook that only fires when the user has run the studio in the last N minutes (touchstone file). Add only if pull-on-demand creates friction.

## Anti-patterns — what NOT to do

- **No third-party comment toolbars.** The Vercel Toolbar dep was removed once the in-house overlay shipped. Don't re-add it — having two writers fragments the data model.
- **No MCP server.** Read + Grep + Edit tools cover every annotation interaction. An MCP server adds setup cost with no capability gain.
- **No auto-commit of annotations.** User stages with `git add` per project rule.
- **No `UserPromptSubmit` hook by default.** Pull-on-demand via CLAUDE.md convention is the right default. Hook is optional later.
- **No writing from the studio without auth.** Studios mounted via `createStudioApp({ auth })` are gated by `<StudioAuthGate>`. A studio mounted without auth runs in display-only mode — annotation actions are hidden.
- **No abstraction over `@bokendell/<app>-ui` primitives.** Sections render primitives directly. Visual editors that wrap primitives lose typed variants and HARD-RULES discipline.
- **No reinventing primitives in the framework.** `@bokendell/design` chrome is built on shadcn primitives from `@bokendell/ui` (`Button`, `Popover`, `Command`, `DropdownMenu`, `Tooltip`, `Avatar`, `ScrollArea`, …). Adding hand-rolled outside-click / Esc / focus management is a code-smell — use Radix.
- **No hand-rolled fetch against swarm-api.** Every swarm-api call goes through `@bokendell/swarm-client` (tRPC) — `createStudioApp` wires the provider, components use `useTRPC()`. Types come from the same package, so DTOs aren't duplicated. See `context/packages/swarm-client.md`.

## Open questions

- Should `.annotations/` be gitignored or committed? **Current default: committed.** Lets us track design feedback across PRs. Reconsider if size becomes a problem.
- Drawing layer file size — composite vs. separate PNG? **Current default: composite at save time, drop the drawing layer.** Reduces file count. Keep separately only if we need re-editable drawings later.
- Comment resolution — delete or move to `_resolved/`? **TBD.** Delete for v1 (git history is the record).

## See also

- `context/packages/design.md` — current `@bokendell/design` exports + new-app recipe.
- `apps/golf/design/ROADMAP.md` — what's done, what's next, parallelization map.
