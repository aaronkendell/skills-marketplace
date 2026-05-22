---
name: higgsfield-cli
description: Generate AI cinematic video via the Higgsfield CLI from Claude Code shell commands. Multi-model aggregator over Kling 3.0, Veo 3.1, Runway Gen-4, Seedance 2.0 — no upstream Claude skill exists, so this is the bokendell reference. Activates when generating marketing video, course flyovers, hero loops, mood pieces, or any cinematic content that doesn't need to be programmatically composited.
metadata:
  tags: higgsfield, ai-video, marketing, cinematic, claude-cli
---

# Higgsfield CLI · the bokendell reference

> Tier 4 of the motion stack. For marketing hero loops and cinematic content. No upstream Claude skill exists for Higgsfield, so this skill stands alone.
>
> See the `motion-stack` skill in this plugin for the four-tier overview.

## When to use

- Marketing video (landing page hero, social ads, content calendar batches)
- Cinematic course flyovers / mood pieces for golf marketing
- Background loops for Wrapped cover cards
- AI b-roll for case-study / app promo content

**Don't use for:** per-user generated video (use Remotion), in-app animation (use Reanimated / Rive), talking-head content (out of scope).

## Setup

```bash
npm install -g @higgsfield/cli
higgsfield auth login                     # opens browser, sets local credential
higgsfield auth status
higgsfield models list
```

Required account: **Higgsfield Creator** plan (~$29/mo as of May 2026). API key also accepted via env var — store in Infisical at `/infrastructure/higgsfield`:

```bash
infisical run --path=/infrastructure/higgsfield -- higgsfield generate ...
```

**Don't use Sora.** OpenAI is discontinuing the Sora API on Sept 24, 2026.

## Core commands

```bash
# Text-to-video
higgsfield generate \
  --prompt "Sunrise over Pebble Beach 18th green, slow drone push-in, anamorphic, 35mm grain, golden hour" \
  --model cinematic-v1 \
  --duration 5 \
  --aspect 16:9 \
  --output ./assets/marketing/pebble-hero.mp4

# Image-to-video
higgsfield generate --input ./still.jpg --prompt "Slow pan left to right" --model kling-3.0 --output ./out.mp4

# Async
higgsfield generate ... --async              # returns { jobId }
higgsfield jobs status --id job_abc123

higgsfield models list                       # kling-3.0, veo-3.1, seedance-2.0, runway-gen-4, ...
higgsfield generate ... --dry-run            # cost estimate before running
```

## Model selection

| Model | Best for | Cost tier |
|---|---|---|
| `veo-3.1` | 4K marketing with synchronized audio in single pass | premium |
| `runway-gen-4` | Branded marketing with reference image / character consistency | mid |
| `kling-3.0` | Cost-efficient general-purpose | lower |
| `seedance-2.0` | Open-weights, fastest, lowest quality | lowest |
| `cinematic-v1` (Higgsfield Cinema Studio) | Multi-axis camera control, lens / focal length, anamorphic looks | mid+ |

Default to `kling-3.0` for iteration; switch to `veo-3.1` or `runway-gen-4` for the final cut. Always `--dry-run` first.

## Multi-axis camera (the Higgsfield differentiator)

Stack up to 3 simultaneous moves:

```bash
higgsfield generate \
  --prompt "Golfer on the 18th tee" \
  --camera "dolly-in, pan-right, slow-tilt-up" \
  --lens "anamorphic 50mm" \
  --film-grain "35mm" \
  --duration 5
```

Available motions: horizontal pan, tilt, dolly, zoom, FPV drone, crash zoom.

## Where outputs live in the bokendell monorepo

| Use case | Path |
|---|---|
| Cross-app marketing hero | `core/packages/shared/public-assets/marketing/hero/*.mp4` |
| Per-app marketing | `<app>/apps/marketing/public/video/*.mp4` |
| Wrapped cover-card backgrounds | `<app>/apps/design/flows/share-wrapped/assets/bg/*.mp4` |
| Golf course detail pages | `golf/apps/api/public/courses/<slug>/hero.mp4` |

Commit MP4s (Git LFS for >10MB). Generation isn't deterministic — once you have a take, commit it.

## Bridging to Remotion

Common pattern:

1. **Higgsfield generates the cinematic background** (5-second loop of dawn over Pebble)
2. **Remotion overlays user data** (Wrapped stats, motion typography, brand chrome)
3. **One MP4** combines both

The Remotion composition imports the Higgsfield-generated MP4 as a `<Video>` and stacks brand layers on top. Load the Remotion skill (`remotion-dev/skills`, see `motion-stack` skill for install) when authoring the composition.

## Claude Code batch workflow

Pattern: read a JSON / CSV content calendar → loop rows → invoke `higgsfield generate` per row → poll completion → save outputs by content ID. Higgsfield's CLI design specifically supports this — Claude Code constructs commands natively without an MCP layer.

```ts
// scripts/generate-marketing-batch.ts
import { execSync } from "node:child_process";
import calendar from "./content-calendar.json";

for (const item of calendar) {
  execSync(
    `higgsfield generate --prompt "${item.prompt}" --model ${item.model} ` +
    `--duration ${item.duration} --aspect ${item.aspect} --output ./out/${item.id}.mp4`,
    { stdio: "inherit" },
  );
}
```

## Cost discipline

Each generation costs $0.10–$1.00 per second of video depending on model. Budget for a typical app: 5–10 hero loops/yr, ~5s each → **~$50–200/yr per app** in generation cost.

## Sources

- [Higgsfield — Cinematic AI video](https://higgsfield.site/)
- [Higgsfield CLI + Claude Code automation (MindStudio)](https://www.mindstudio.ai/blog/higgsfield-cli-claude-code-content-automation)
- [Higgsfield API docs (Apidog)](https://apidog.com/blog/higgsfield-api/)
- [Higgsfield Python SDK](https://github.com/higgsfield-ai/higgsfield-client)
- [Sora discontinuation note (DigitalApplied)](https://www.digitalapplied.com/blog/after-sora-best-ai-video-generators-2026-runway-kling-veo)
