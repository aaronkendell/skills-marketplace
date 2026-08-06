---
name: app-scaffold
description: >
  Stand up a NEW app repo from project-template — config, catalog, design pack, generated
  DESIGN.md, CI wiring — and hand off to app-provision for vendors. Use when the user says
  "new app", "scaffold an app", "create the <name> repo", "bootstrap <name>", or asks what a new
  app needs. Covers the repo side only; app-provision covers Cloudflare/Infisical/Neon/Fly/etc.
---

# App scaffold (repo side)

Two skills, split by blast radius:

| | Skill |
|---|---|
| Repo: files, config, catalog, design pack, CI | **this one** |
| Vendors: Cloudflare, Infisical, Neon, Fly, Sentry, … | `dev:app-provision` |

Run this first — provisioning needs the app name and Infisical project decided.

The long-form prose version lives at `core/CONTRIBUTING.md` ("Adding a new app"). Where the two
disagree, THIS file wins: CONTRIBUTING still documents `bokendell.config.json` and predates the
design-pack and DESIGN.md conventions.

## The steps

### 1. Repo from template

```bash
gh repo create bokendell/<app> --template bokendell/project-template --private
cd ~/repos/bokendell && git clone git@github.com:bokendell/<app>.git && cd <app>
```

Rename the `apps/_app/` + `packages/_app/` placeholders, delete what the app doesn't need, and
search/replace `_app` → `<app>` across package names and tsconfig paths.

### 2. `bokendell.config.ts` at the repo root — TypeScript, not JSON

Typed via `defineProject`; swarm loads it through jiti. Import the project config with a
RELATIVE path, not the package subpath — jiti's `require.resolve` can't follow a `.ts` subpath
export.

**`infisical.projectId` is MANDATORY.** Omit it and the Infisical SDK falls back to core's
hardcoded project — which is golf's — so the new app silently reads golf's secrets. It
typechecks, it lints, it boots. `swarm check config` is the only thing that catches it, and the
observability repo shipped for months with exactly this bug. Set the real UUID (not the slug):

```ts
infisical: {
  projectId: "<uuid from the Infisical project>",   // NOT the slug
  defaultPath: "/apps/api",
  secretPaths: { db: "/packages/db", api: "/apps/api" },
},
```

The **slug cannot be a GitHub secret** either — a secret's value is masked out of workflow
outputs, so a slug like `swarm` masks every `swarm-*` app name and silently empties deploy
matrices. Keep it a repo *variable*. See `references/patterns/infisical.md`.

### 3. `packages/config/src/project.config.ts`

Declare `dev_tunnel` explicitly — `{ id, dns: "wildcard" }`. Falling back to the shared default
writes per-hostname DNS that teardown never reaps. `swarm check config` flags this too.

Set `dev_tunnel_domain` / `dev_tunnel_suffix` to the app's own dev zone rather than inheriting.

### 4. Catalog, not per-package versions

All `@bokendell/*` deps come from the `pnpm-workspace.yaml` catalog (`catalog:`), never pinned
per package and never `workspace:*` across repos. Keep the catalog strict — a drift guard exists
for a reason.

### 5. Design: the pack lives HERE, not in the marketplace

Create `.claude/skills/design/SKILL.md` in the repo. Project skills auto-load, so it is in
context whenever anyone works on this app.

```
.claude/skills/design/SKILL.md   brand character, primitives, studio workflow, repo law
DESIGN.md                         tokens — GENERATED, see below
packages/ui/HARD-RULES.md         the enforced rules, as `### <n>. <RULE>` headings
```

Do **not** create an `<app>-design-studio` skill in the marketplace. That scales linearly with
apps and puts app truth where it drifts: golf's marketplace pack had *every* OKLch value wrong
against the shipped tokens before it was deleted (`bg` listed `0.962 0.012 85` against a shipped
`0.956 0.013 87`; the accent off by 0.06 chroma). The generic method stays in `dev:design`; only
app truth belongs in the repo.

Write HARD-RULES.md with numbered `### <n>. <RULE>` headings — that shape is machine-parsed to
derive DESIGN.md's Do's and Don'ts.

### 6. `DESIGN.md` — generate it, never hand-write it

If the app has `packages/tokens/src/theme-source.ts`, emit `DESIGN.md` from it (the
[DESIGN.md spec](https://github.com/google-labs-code/design.md)) so DESIGN.md-aware tools and
agents read tokens that provably match what ships. golf's implementation is the reference:
`packages/tokens/scripts/design-md.ts`.

A hand-written DESIGN.md is a second source of truth for the same values and drifts the moment
`theme-source.ts` changes — silently, because nothing reads it back.

Wire the drift guard, or the generator is decorative:

- `turbo.json` → add a `"tokens:check": {}` task
- `package.json` (tokens) → `tokens:check` ends in `git diff --exit-code -- ../../DESIGN.md <other generated files>`
- `lefthook.yml` → a `tokens` job in the parallel check group, globbed on
  `packages/tokens/{src,scripts}/**/*.ts` **and** `packages/ui/HARD-RULES.md`

golf had `tokens:check` for months with nothing invoking it. A guard nothing runs is not a guard.

### 7. `.cicd.yml` per deployable

`project-slug` must be **this app's** Infisical project. The template ships `projects`, and both
golf and keepings shipped that placeholder into their mobile configs — it resolves to the wrong
project and fails at deploy time, not at review time.

### 8. Fly config, if the app has workers

A connect-mode worker (Inngest connect, or anything holding an outbound socket) needs:

```toml
[http_service]
  auto_stop_machines = "off"     # never stop a connect worker
  auto_start_machines = true
[[restart]]                       # ARRAY of tables — `[restart]` fails the deploy
  policy = "always"
```

Do **not** set `min_machines_running` here: Fly applies it only when `auto_stop_machines` is
`"stop"` or `"suspend"`, so with `"off"` it is inert. It reads like a floor and enforces nothing —
that is how a stage worker sat stopped for a day with zero connected sessions and no alert (a
stopped machine runs no health check). `[[restart]] policy = "always"` is the actual guarantee.

Run `flyctl config validate --config <path> --app <app>` before pushing any fly.toml.

Machine COUNT is not in the repo — it lives in Fly (`flyctl scale count N`) and drifts silently.
Set it deliberately and re-check it; Inngest Hobby caps connected workers at 3 per org.

### 9. Install, verify, commit

```bash
pnpm install
pnpm check && pnpm check-types && pnpm test
./swarm check config          # catches the silent config bugs above
git add -A && git commit -m "feat: initial <app> scaffold"
```

### 10. Hand off

Run `dev:app-provision` for vendors, then wire deploys. Add the app to core's registry only if
`swarm <cmd> --app <app>` needs to work from core.

## What to check before calling it done

- [ ] `swarm check config` exits 0 (projectId + dev_tunnel both set)
- [ ] `.claude/skills/design/SKILL.md` exists and auto-loads
- [ ] `DESIGN.md` generated, and `tokens:check` fails when a token changes without regenerating
- [ ] no `project-slug: projects` left in any `.cicd.yml`
- [ ] `flyctl config validate` passes for every fly.toml
- [ ] catalog has no per-package version overrides
