# Container Images & Fly Registry

How container images flow from CI to Fly.io. One pattern doc covering: where images live, the build/push/deploy split, how to onboard a new app, and the rescue path when something breaks.

**Status:** Wired for `golf-api` today. Generic — every Fly app's `.cicd.yml` opts in by adding a `deploy.image:` block.

---

## TL;DR

- **Registry:** `registry.fly.io/<image-name>:<git-sha>` — Fly's own org-scoped registry. No external dependency.
- **Image name:** defaults to the production environment's `app:` field (e.g. `golf-api-production`). Fly only allocates registry slots backed by an existing app, and the production app is always present.
- **Push auth:** `flyctl auth docker` using the existing `FLY_API_TOKEN` secret. Same credential that runs the deploy.
- **Pull auth (Fly machines):** automatic — Fly's machines have implicit org-scoped pull auth to `registry.fly.io`. **No `FLY_REGISTRY_AUTH` secret needed.** No PAT to manage. No cold-start pull failures.
- **Build cache:** `type=gha` — warm runs skip layers across deploy jobs. Cold builds match Fly remote-builder time; warm builds 5-10× faster.
- **Promote stage → prod:** redeploy the existing `:<sha>` tag against the prod fly.toml. No rebuild, byte-identical artifact.

---

## Architecture in one paragraph

Each app's `.cicd.yml` declares a `deploy.image:` block (dockerfile + build-args). The `deploy-fly.yml` workflow loads that block via `load-fly-config`, hands it to `build-and-push-image` (which runs `flyctl auth docker`, builds via `docker/build-push-action@v6` with `type=gha` cache, pushes `:<sha>` + `:latest` to `registry.fly.io/<production-app-name>`), then invokes `fly-deploy` with `--image registry.fly.io/<production-app-name>:<sha>`. Fly pulls the prebuilt artifact instead of running its own build. Apps without a `deploy.image:` block fall through to `fly-deploy`'s legacy `--remote-only` path so nothing breaks during the rollout.

---

## File map

```
.github/
├── actions/
│   └── deployment/
│       ├── build-and-push-image/        # New — builds + pushes to registry.fly.io
│       │   └── action.yml
│       ├── fly-deploy/                  # Updated — accepts `image:` input
│       │   └── action.yml
│       └── load-fly-config/             # Updated — parses deploy.image block
│           └── action.yml
└── workflows/
    └── deploy-fly.yml                   # Wires build-and-push before fly-deploy

apps/
└── golf/
    └── api/
        ├── .cicd.yml                    # `deploy.image:` block
        ├── fly.toml                     # No `[build]` block
        └── fly.stage.toml               # No `[build]` block

infrastructure/docker/api.Dockerfile     # Unchanged — used by build action
```

---

## Onboarding a new Fly app

Two edits per app, no other changes needed:

**1.** Add `deploy.image:` to the app's `.cicd.yml`:

```yaml
deploy:
  platform: fly
  working-directory: apps/<your-app>
  change-paths:
    - apps/<your-app>/**
    - packages/<your-domain>/**
    - infrastructure/docker/**

  image:
    # Pushed to registry.fly.io/<image-name>:<github-sha>.
    # Image name defaults to environments.production.app below — Fly
    # registry slots must back to a real Fly app, and production is the
    # one always present. Override `name:` here if you want a shared
    # image-storage app (e.g. `name: bokendell-images`).
    dockerfile: infrastructure/docker/api.Dockerfile
    context: .                          # Repo root — Dockerfile copies whole pnpm workspace
    build-args:
      APP_DIR: <your>/<app>
      APP_FILTER: "@bokendell/<your-app>"
      APP_SERVICE_NAME: your-app

  environments:
    stage: { app: your-app-stage, config: apps/<...>/fly.stage.toml }
    production: { app: your-app-production, config: apps/<...>/fly.toml }
```

**2.** Drop the `[build]` block from each `fly.toml` for the app (production + stage). The image is now the source of truth — Fly pulls it instead of building locally.

You're done. No new secrets to create. No PAT to issue. The next push to `main` (or stage equivalent) triggers `deploy-fly.yml`, which discovers the app, builds + pushes the image to `registry.fly.io/<production-app>`, and deploys both stage and production from the same artifact.

---

## Secret setup (one-time)

**Nothing new.** The build + push uses the existing `FLY_API_TOKEN` secret already wired into the deploy workflow. That's the entire credential story.

What this replaces (vs the GHCR alternative we considered):
- ❌ No GitHub PAT for `read:packages`
- ❌ No `FLY_REGISTRY_AUTH` secret in Fly
- ❌ No Infisical reference plumbing per app
- ❌ No GHCR retention rules to maintain
- ❌ No cold-start pull credential to debug

---

## How a deploy actually works (under the hood)

When you push to `main`:

1. `deploy-stage.yml` (or `deploy-production.yml`) calls `deploy-fly.yml` with `environment: stage`.
2. `deploy-fly.yml`'s `discover` job scans every `apps/*/.cicd.yml` with `deploy.platform: fly` + a matching environment block.
3. The `deploy` job runs in matrix per app:
   - `load-fly-config` parses the `.cicd.yml` (including the `deploy.image:` block; `image_name` defaults to the production app name).
   - `build-and-push-image` (when `image_enabled == true`) runs `flyctl auth docker` to materialize a short-lived registry token, builds the Docker image via `docker/build-push-action@v6` with `type=gha` cache, pushes both `registry.fly.io/<image-name>:<sha>` and `:latest`, outputs the immutable `:<sha>` ref.
   - `fly-deploy` runs `flyctl deploy --image registry.fly.io/<image-name>:<sha> --config <fly.toml> --app <app-name>`. Fly pulls the prebuilt image from its own registry instead of building.
   - Sentry release notification + Inngest sync run as before.

When a Fly machine cold-starts (auto-scale wake-up, OOM restart, region migration):

1. Fly looks at the machine config's `image:` field (set by the last `flyctl deploy --image`).
2. Pulls from `registry.fly.io` — Fly's hosts have implicit org-scoped read access to their own registry. **No external credential needed.**
3. Image starts. No way for this step to fail on a registry-auth basis.

---

## Promoting stage → production

The point of all of this — same artifact, no rebuild:

```bash
# Find the sha that's currently running on stage
SHA=$(flyctl status --app your-app-stage --json | jq -r '.ImageDetails.tag')

# Deploy that exact image to production
flyctl deploy \
  --config apps/your-app/fly.toml \
  --app your-app-production \
  --image registry.fly.io/your-app-production:$SHA
```

For automated promotion via workflow, the production `deploy-production.yml` can call `deploy-fly.yml` with the same `github.sha` that built stage — `build-and-push-image` is idempotent (the `:<sha>` tag already exists, push is a no-op).

---

## Rescue paths

**Build fails / Fly registry rejects the push.** Drop the `deploy.image:` block from the app's `.cicd.yml` (or comment it out). `fly-deploy` falls back to its `--remote-only` path automatically — Fly builds in-place from the dockerfile referenced in `fly.toml`. Re-add the block when the issue resolves. (Note: when you do this, the `[build]` block needs to come back in `fly.toml` too — keep the rescue path documented in each fly.toml's header.)

**Fly can't pull the image.** Should not happen with `registry.fly.io` (auth is implicit). If it does, check:
```bash
flyctl logs --app your-app | grep -i "pull\|auth"
flyctl image show --app your-app    # confirms what the machine is trying to pull
```
Most likely cause: the image was pushed to a different org's registry (`FLY_API_TOKEN` was for a different org during the push). Verify with `flyctl orgs list` and `flyctl auth whoami`.

**Need to test a Dockerfile change locally before pushing.** Build locally without pushing:
```bash
docker buildx build \
  --file infrastructure/docker/api.Dockerfile \
  --build-arg APP_DIR=golf/api \
  --build-arg APP_FILTER=@bokendell/golf-api \
  --build-arg APP_SERVICE_NAME=golf-api \
  --build-arg RELEASE_SHA=$(git rev-parse HEAD) \
  -t golf-api:local .
```
Or pull the latest pushed image and shell in:
```bash
flyctl auth docker     # one-time per session
docker pull registry.fly.io/golf-api-production:latest
docker run --rm -it --entrypoint sh registry.fly.io/golf-api-production:latest
```

---

## Cost & limits

Fly's registry storage is bundled into the org's Fly billing — no separate per-GB line item published as of mid-2026. Practical concern: there's no UI to browse images and no automatic garbage collection. Old image tags accumulate forever unless pruned manually. To list what's there:

```bash
flyctl releases --app golf-api-production --image
```

Tags only become visible to Fly via `releases` if they were actually deployed. Tags pushed-but-never-deployed exist in the registry but aren't listed. Acceptable for ~10 images at low push frequency; if you ever push hundreds per day, consider periodic pruning via the Machines API or Fly's GraphQL.

---

## Build-once-deploy-many: what's safe to bake

The image is byte-identical across environments. That's only safe because nothing env-specific is in the artifact:

| Baked into image | Read at runtime |
|---|---|
| `RELEASE_SHA` (same git SHA across envs) | `DATABASE_URL` |
| `OTEL_SERVICE_NAME` / `APP_SERVICE_NAME` (per-app, not per-env) | `SENTRY_DSN` |
| `NODE_ENV=production` (Node optimization flag, **not** deploy env) | `SENTRY_ENVIRONMENT` / `APP_ENV` (deploy env discriminator) |
| OTel auto-instrumentation config (same everywhere) | `OTEL_EXPORTER_OTLP_ENDPOINT` + headers |
| The bundled `dist/server.js` | Anything with a per-env value |

**Things that would force you to rebuild per environment if you did them — don't:**
- Baking secrets into the image
- Baking `NEXT_PUBLIC_*` / `VITE_*` env vars into a client bundle (these APIs are server-only, so this doesn't apply today; relevant if/when you containerize a Next.js/Vite app)
- Statically tree-shaking based on env-specific feature flags
- Per-env API base URLs in client bundles

**`NODE_ENV` gotcha.** The Dockerfile sets `NODE_ENV=production` in BOTH stage and production images. `NODE_ENV` is a Node-library convention (skip dev warnings, enable React production mode), not a deploy-env discriminator. If any domain code uses `process.env.NODE_ENV` to gate stage-vs-prod behavior, that's a bug — use `SENTRY_ENVIRONMENT` or an explicit `APP_ENV` validated by the zod env schema instead.

## Source maps

Not uploaded today (the workflow's Sentry release step has `sourcemaps: ''`). When you turn them on, **build-once is still correct** — source maps are tied to the release SHA, not the deploy environment. The same `dist/server.js.map` works for both stage and production because the bundle is identical.

Recommended flow (if/when you enable):

1. Add `sourcemap: true` to each app's `tsup.config.ts`.
2. Add an "Upload sourcemaps to Sentry" step inside `build-and-push-image` (runs ONCE per artifact, not once per deploy):
   ```bash
   sentry-cli sourcemaps upload \
     --release "$RELEASE_SHA" \
     --org bokendell --project golf-api \
     apps/api/dist/
   ```
3. Strip `*.map` files from the runtime stage of the Dockerfile (Sentry has them — don't ship them in the image where any image puller could read them).
4. Existing per-env Sentry release notification step keeps working as-is. It announces "release X is live in env Y"; Sentry already has the maps for X.

The wrong pattern (do not): upload maps from the per-deploy Sentry step. That uploads the same artifact's maps multiple times across stage and prod deploys — idempotent but wasteful.

---

## Things to watch for

- **`registry.fly.io/<name>` requires `<name>` to match an existing Fly app.** Convention here: use the production app name (`golf-api-production`). Onboarding a brand-new app: create the production Fly app *first* (`flyctl apps create golf-api-production`), then the registry slot becomes available, then the first deploy works.
- **Org boundary matters.** `FLY_API_TOKEN` is org-scoped — a token for org A can't push to org B's registry. The CI token must match the org that owns the apps being deployed.
- **`:<sha>` tags are immutable.** Re-running the same workflow with the same SHA is a push of a (probably) byte-identical image — no problem.
- **`:latest` is convenience, not contract.** Fly never pulls `:latest` — it deploys the explicit `:<sha>`. Don't write code that depends on `:latest` being current.
- **Build cache is keyed per image short name** (`scope=<image-name>`). Two apps that share most layers don't share cache. Acceptable for ~10 images; if you ever extract a base image, point both at the same scope.
- **No vulnerability scanning out of the box.** If you want this, point `trivy image registry.fly.io/<name>:<sha>` from a separate CI job (you'll need `flyctl auth docker` first). Not worth setting up until you have a real reason.
- **No browsable UI.** `flyctl releases --image` is your friend; it shows what's been deployed (not just pushed). The Fly dashboard's "Registry" tab on each app shows the image registry contents.

---

## Why registry.fly.io vs GHCR

GHCR was the obvious "centralized registry" choice but the analysis tipped to Fly:

| | **registry.fly.io (chosen)** | **GHCR** |
|---|---|---|
| Build once, deploy many | ✅ | ✅ |
| `FLY_REGISTRY_AUTH` needed? | ❌ — Fly has implicit auth to itself | ✅ The PAT dance |
| New PAT to create/rotate | ❌ | ✅ |
| Auth in CI | `flyctl auth docker` (FLY_API_TOKEN) | `docker/login-action` + GITHUB_TOKEN |
| Cold-start pull risk | ❌ Zero — same platform | ⚠️ Murky — docs unclear |
| Image UI / browse | ⚠️ `flyctl releases --image` only | ✅ Web UI |
| Retention / GC | ⚠️ Manual | ✅ Configurable |
| Vuln scanning | ❌ | ✅ Free via Dependabot |
| Egress cost | ❌ Intra-Fly | ✅ Free for now |
| Portability if leaving Fly | ❌ Migration needed | ✅ Already external |

For a setup where Fly IS the deploy target and there are no non-Fly consumers of these images, the simplicity wins decisively. The two genuine GHCR-only wins (UI + vuln scanning) are nice-to-haves you can layer on later if needed (Fly supports dual-pushing — push to both registries on the same CI run, GHCR as archive, Fly as runtime).
