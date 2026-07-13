---
name: rn-makeitanimated
description: Reference "Make It Animated" (github.com/make-it-animated/rn-makeitanimated) — a licensed, paid React Native micro-interaction cookbook cloning ~97 real-app animations — for its Loader/KeyframeView architecture pattern and its Reanimated best-practice rules, when building or porting mobile animated UI (icons, screens, gestures) in any bokendell app. Activates on "port this animation", "make it animated", "reanimated pattern", "mobile micro-interaction", or when hand-translating a Motion.dev/CSS keyframe recipe onto React Native.
metadata:
  tags: reanimated, react-native, animation, keyframes, mobile, motion-stack
---

# rn-makeitanimated · reference skill

> Tier 1 leaf of the `motion-stack` decision tree — load this when porting or designing an in-app mobile animation, not for branded assets (Rive) or video (Remotion/Higgsfield).

## What this actually is (read before assuming it's an icon library)

**It is NOT a component library or icon pack.** It's a paid, private Expo showcase app that
recreates ~97 real micro-interactions from 40 named apps (X, Gmail, Instagram, Linear, Slack,
Perplexity, Apple Wallet, Discord, Shopify, Raycast, and more), consumed by copy-pasting source
folders — no CLI, no npm package, no registry. You (the bokendell org) hold a paid license to
your own clone at `~/repos/bokendell/rn-makeitanimated` (branch `public`).

**Licensing — read this before writing any sync/distribution tooling:**
- You are a **paying customer using your own licensed clone** — reading it, learning its
  patterns, and reimplementing your OWN versions in bokendell apps is exactly what the license
  is for.
- **Do not** redistribute its source, publish a fork, push it to a shared/public remote, or
  build tooling that pulls it into a location other repos/people can reach without their own
  license. `scripts/sync.sh` only updates *your own* existing licensed checkout — it never
  grants access to someone who doesn't have it.
- If in doubt about a specific reuse ("can I ship code adapted from their X component"),
  ask the user — this is a licensing call, not a technical one.

## Setup — keep your local clone current

```bash
bash .claude/skills/rn-makeitanimated/scripts/sync.sh
# or a custom path:
bash .claude/skills/rn-makeitanimated/scripts/sync.sh ~/somewhere/else
```

Clones (if missing) or `git pull`s the `public` branch. Verify with:
```bash
ls ~/repos/bokendell/rn-makeitanimated/.git 2>/dev/null && echo "present"
```
If missing entirely and the user doesn't have their own license/access, stop and ask — don't
attempt to clone a repo you can't read.

## The architecture worth reusing: `Loader` / `KeyframeView`

This is the single most valuable pattern in the repo — found at
`src/shared/components/loader/` in the licensed clone. It's a generic keyframe-timeline
primitive that maps almost directly onto a Motion.dev/CSS `variants` object, which is the
format most animated-icon sources (AnimateIcons, lucide-animated) ship their recipes in.

**Shape:**
- A root `Loader` ticks a shared `progress` value 0→1 over a `duration` (supports `reverse`
  auto-ping-pong, `numberOfReps`, `repeatDelay`, `initialDelay`, custom `easing`).
- Each child `Loader.KeyframeView` takes a `keyframes: Record<number, StyleSnapshot>` map
  (keys 0–1 or 0–100, auto-normalized) and linearly interpolates between them — colors via
  `interpolateColor`, transforms parsed from the snapshot values.
- **Controlled/uncontrolled contract**, consistent across every component in the repo:
  - `isSelected` (or another boolean) triggers play/reset like a checkbox — uncontrolled default
  - `progress: SharedValue<number>` — pass your own shared value to drive it externally; the
    moment you pass this, internal auto-play disables
  - `onProgress: SharedValue<number>` — mirrors internal progress back out on the UI thread so
    other animations can derive from it
  - Compound-component pattern: `<Root><Root.Label/><Root.Line/></Root>` via `Object.assign`

**Why this beats hand-writing `useAnimatedProps` per icon** (which is what we did for our own
`bell-ring` port in `packages/ui/src/lab/`): a Motion.dev `variants` object like
```js
{ rotate: [0, 7, -18, 14, -9, 5, -2, 0], transition: { times: [...], duration } }
```
is structurally a keyframe map already. A `KeyframeView`-style primitive lets you paste that
shape almost unchanged instead of manually deriving `withSequence(withTiming(...))` chains by
hand for every new icon.

**Golf's own engine already adopted this shape** (`packages/ui/src/lab/animated-icon-sequence/`,
2026-07): `useAnimationProgress()` gives one shared 0-100 timeline per icon instance (`play()`
runs the whole thing once, `reset()` returns to idle), and `useKeyframeSnapshot(progress,
keyframes)` reads a `KeyframeMap` (`Record<number, Record<string, number>>`, knot position →
property values) and returns the interpolated snapshot for the current progress — one call per
animated element, however many properties that element needs. A per-element "delay" is expressed
by starting that element's first real knot partway into the shared 0-100 range rather than a
separate delay parameter — interpolation clamps flat before the first knot and after the last.
`bell-ring-icon.native.tsx` is the reference consumer: one `useAnimationProgress` + four
`useKeyframeSnapshot` calls (bell rotation, clapper, two sound waves) replaced what used to be
six separate per-property hook+play pairs.

**No default styling, no theming API in their version.** All props are plain `style`/`className`
— brand color is whatever you pass in, same as building it yourself. If we build our own
`KeyframeView` equivalent, wire it through `@bokendell/golf-ui`'s existing color-token resolution
(same pattern `Icon`'s `tone` prop already uses) rather than copying their bare-props approach.

## Workflow: "here's a Make It Animated URL/app — port it"

This case is *easier* than porting from a web source (AnimateIcons, lucide-animated) — their
source is already React Native/Reanimated, so there's no Motion.dev→Reanimated translation step.

1. **Locate it.** From the app name or URL, find the matching entry in
   `src/shared/lib/constants/animations.ts` in the licensed clone (`{ appName, animationName,
   slug, href }`) — that names the real source directory under `src/apps/(x)/<app>/`.
2. **Read their component.** The hook (`use-*-animation.ts`), the `keyframes`/`progress` shape
   passed to `Loader`/`KeyframeView` (or whatever primitive that screen uses), the styles.
3. **Re-author, don't copy-paste.** Recreate the animation logic as our own component under
   `@bokendell/golf-ui` (or `.../lab` if still experimental), swapped onto our conventions:
   their Tailwind/hex → our `tone`/variant token system, their bare props → our per-concern-folder
   + `.native.tsx` layout, their engine (see the KeyframeView pattern above) → our
   `useAnimationProgress`/`useKeyframeSnapshot` primitives (`packages/ui/src/lab/animated-icon-sequence/`).
   This is an adaptation using your own licensed reference, not redistribution — the correct way
   to reuse a paid pattern-reference product internally.
4. **Land it** in `packages/ui/src/lab/` (icons, small interactions) or promote straight to a
   real `components/` entry if it's screen-level and proven — same promotion path as any other
   lab component.

## Reanimated best practices (ported from their 3 Cursor skills)

Their repo ships these as Cursor-IDE skills (`.cursor/skills/*/SKILL.md`) — framework-level
Reanimated advice, not tied to their app or license, safe to apply directly:

1. **Use `scheduleOnRN`/`scheduleOnUI`** (from `react-native-worklets`) instead of
   `runOnJS`/`runOnUI` (from `react-native-reanimated`) — the newer, Reanimated-4-era API.
   Never add a `"worklet"` directive unless explicitly needed; `scheduleOnUI` infers it.
   Define the scheduled function with `useCallback` outside the worklet and pass the
   reference — never an inline arrow — so it isn't recreated per render.
2. **Under React Compiler, use `sv.get()`/`sv.set()`** instead of direct `.value`
   read/write on shared values — React Compiler's memoization is incompatible with direct
   property mutation on a shared value.
3. **General Reanimated perf discipline**: minimize shared-value reads inside
   `useAnimatedStyle`/`useAnimatedProps` (each read is a dependency), prefer
   `useDerivedValue` over re-deriving inline, animate `transform`/`opacity` only, throttle
   scroll-driven values, memoize style objects that don't depend on animated values.

Golf's own `@bokendell/golf-ui/lab` engine (`packages/ui/src/native/reanimated.native.ts` +
`packages/ui/src/native/worklets.native.ts`) already exists as the shared wrapper — route
through those, not raw `react-native-reanimated`/`react-native-worklets` imports, matching the
convention fixed repo-wide via `moduleSuffixes` (see `packages/ui/tsconfig.json`).

## Where to look for a specific interaction pattern

97 named animations across 40 apps live in `src/shared/lib/constants/animations.ts` in the
licensed clone (each `{ appName, animationName, slug, href }`), with the full implementation
under `src/apps/(x)/<app>/`. Browse in the app itself (`npm run ios`/`android`) or at
makeitanimated.dev. Use this when a user says "make it feel like [app]'s [interaction]" — check
if that app/interaction is in the catalog before designing from scratch.

## See also

- [[motion-stack]] — the tier-1 entry ("in-app gesture/transition/press state") points here for
  mobile pattern reference before hand-rolling
- `dev:design` / `golf-design-studio` — reference this skill when building new golf mobile
  screens/flows that need a signature micro-interaction, not just a static layout

## Sources

- Licensed clone: `~/repos/bokendell/rn-makeitanimated` (branch `public`)
- https://makeitanimated.dev (public marketing site, `/resources` links to the GitHub org)
- Their Cursor AI-workflow scaffold: `docs/AI_WORKFLOW.md` + `.cursor/skills/` in the clone
