---
name: review
description: Review files against the project's pattern docs (DDD service/repo, Hono+tRPC API, Awilix DI, testing layers, frontend container/component split, mobile, design app, design studio annotations, CLI, barrels, container-images, AI/Mastra, remote tunnels, etc.) and fix violations so the code follows the patterns exactly. Use this skill whenever the user says "review", "check against patterns", "make this follow the patterns", "review this PR", "fix pattern violations", "audit this against our conventions", "is this DDD-compliant", "does this match the api.md pattern", "review my changes", or invokes a `/review` style command — even if they don't name a specific pattern doc. Trigger when the conversation mentions specific files to audit OR when the user describes a code-quality / convention-compliance pass with no specific framework named (the skill maps file globs → pattern docs automatically). Use this *instead* of the patterns-reviewer agent for fast, on-demand, interactive review (the agent is for batch/background review during the build phase).
version: 1.0.0
author: bokendell
---

# Review

Audit code against the project's pattern documentation and fix violations. The patterns describe how this codebase actually wants to be written — DDD service/repository structure, Hono+tRPC routing, Awilix DI, testing layers with Testcontainers, mobile + frontend container/component splits, design studio framework, barrels, container images, AI/Mastra wiring, remote dev tunnels, and more. Drift from these patterns shows up as inconsistencies the team has to chase later; catching it at the moment of authorship is cheap.

This skill is the **lightweight, on-demand** half of the review system. The `patterns-reviewer` agent in this plugin handles batch review during automated build phases — use this skill when the user is at the keyboard asking for a quick pass.

`skill-watch` runs in the background and should learn from this skill. When review finds a repeated
standard violation that should have been caught earlier, prefer one of:

- Add a static architecture rule to the repo's `swarm check arch` configuration.
- Add or tighten a glob in `references/glob-map.md`.
- Update the owning pattern doc in `references/patterns/`.
- Let `skill-watch` promote recurring review misses into this skill after threshold.

## Static pre-pass: run `swarm check arch` first

Before hand-reviewing, run the repo's static architecture checker — it now catches a large slice of what used to be manual, so you only spend judgment on what a rule can't see:

```bash
swarm check arch            # all files (untracked included)
swarm check arch --affected # git diff + untracked only
swarm check arch --json     # machine-readable, for triage
```

Golf wires this through `pnpm check:architecture` (→ `./swarm check arch`), and lefthook runs `swarm check arch --affected` pre-push. Treat its output as the first review pass, then manually review the rest.

Rules it enforces statically (error severity unless noted) — cite the rule id when you fix a hit:

| Rule id | What it catches |
|---|---|
| `review-container-not-orchestrator` | A file in `containers/` that only does presentational work (local state / form hook / `forwardRef`, no data/store/identity/domain hook) — a dumb component relocated into `containers/` to dodge purity. Move it to `components/`; a real container fetches and passes props down. |
| `review-component-not-dumb` | A file in `components/` or `screens/` importing a data/query/mutation/identity or store hook. Lift data to a container/hook and pass props. (Local UI hooks — animation, layout, disclosure — are allowed.) |
| `review-no-inline-types` | `interface`/`type` declared inline (recurses into function/component bodies, not just top level). Move to a `*.types.ts` / `types/` module. |
| `review-no-inline-constants` / `review-no-inline-utils` | Meaningful inline config/data or reusable helpers. Move to `constants.ts` / `utils`, `services`, `mappers`. |
| `review-one-component-per-file` | More than one top-level component in a `.tsx`. |
| `review-domain-layer-boundary` / `review-domain-no-cross-domain-internals` | DDD layer direction + cross-domain reach-through. |
| `ui-no-classname-prop-on-golf-component` / `ui-no-style-prop-on-golf-component` | `className`/`style` passed to a golf-ui component (inside `packages/ui`). No exceptions: use props for spacing/sizing/layout; put spacing BETWEEN elements on the parent (`Stack gap` / Box wrapper), not a margin on the child; move one-off brand styling INTO the leaf that renders the raw element. className is only legal on the raw `div`/`View` inside a leaf primitive. |
| `ui-no-direct-*` | Direct `expo-*` / `react-native-*` imports in golf-ui components that should route through the shared adapters. |

The folder-role rules (`review-container-not-orchestrator`, `review-component-not-dumb`) encode the `frontend.md` contract — **Container = orchestrator, Screen = pure presentation, Components = dumb** — so a file's folder is a real contract, not a place to hide. When you find a repeated miss the checker *doesn't* catch, prefer adding a rule to `swarm check arch` over re-catching it by hand each time.

## When this skill fires vs. when the agent runs

| Surface | Triggered by | Mode |
|---|---|---|
| **This skill** | User asks "review …", "make this follow the patterns", invokes `/review`, names specific files, or asks for a quality pass before committing | Conversational, interactive, applies fixes immediately |
| **`patterns-reviewer` agent** | `dev build` phase or anywhere `Agent({ subagent_type: "dev:patterns-reviewer" })` is called | Background, structured findings JSON, returns severity-grouped report |

If the user explicitly asks for "a full background review" or "spawn the patterns reviewer", invoke the agent instead. Otherwise stay in-skill.

## Workflow

### 1. Resolve which files to review

In order of preference:

1. **Explicit file paths** in the user's prompt — use those.
2. **`@`-mentioned files** in the conversation — extract them.
3. **Recently-edited files** the assistant has touched in this session — list them with `Bash` if needed.
4. **`git status --short` + `git diff --name-only HEAD`** for the cwd and any sibling repo under the unified workspace (`bokendell/`) — fall back to the union of staged + unstaged changes.

If the resolution gives zero files, tell the user what you tried and ask which scope they meant (the current repo? a specific dir? a Linear ticket's branch?).

### 2. Locate the pattern docs

Pattern docs ship with this marketplace at:

```
<marketplace-root>/references/patterns/
```

In a Claude Code plugin install, the marketplace root is exposed via the `${CLAUDE_PLUGIN_ROOT}` env var, so prefer:

```
${CLAUDE_PLUGIN_ROOT}/../../references/patterns/      # plugin lives at marketplace/plugins/dev
```

If `CLAUDE_PLUGIN_ROOT` isn't set (running ad-hoc, not as installed plugin), search upward from cwd for a directory containing `references/patterns/` AND `.claude-plugin/marketplace.json`. The bokendell marketplace repo always has both.

If you still can't find the docs, fall back to `~/repos/bokendell/skills-marketplace/references/patterns/` and tell the user you used the fallback.

The 18 canonical pattern files (each loads on demand — don't read them all upfront):

| File | When it applies |
|---|---|
| `ddd.md` | Any `packages/*/domains/src/**` change — service/repository structure, mapper layer, error model |
| `api.md` | `apps/*/api/**` — Hono+tRPC composition, routing, error handling, response shape |
| `hono-api-anatomy.md` | Deeper Hono+tRPC anatomy — startup vs request perf, middleware ordering |
| `auth-and-scopes.md` | API + domains touching auth — Better Auth, scopes, OAuth client creds |
| `frontend.md` | `apps/*/app/**`, `apps/*/admin/**` — Next.js patterns, container/component split |
| `per-app-ui.md` | `apps/*/{app,admin,mobile,design}/**` — per-app UI package, token contract |
| `mobile.md` | `apps/*/mobile/**` + `packages/mobile-ui/**` — Expo, RN, hooks/stores/containers |
| `design.md` | `apps/*/design/**` — Next.js design app architecture (lib/, packages/, surface groups, sketches, providers) |
| `design-studio.md` | `apps/*/design/**` — element IDs + annotation system + comment workflow |
| `design-workflow.md` | Design files, mocks, decisions.md, per-flow workflow conventions |
| `copy.md` (review-criteria only) | ANY diff touching a user-facing string — screens, components, notification/email templates, `packages/ui/**` default labels. Voice, em-dash slop, every-line-pays-rent. The app's own `docs/design/voice-and-copy.md` outranks it. |
| `di.md` | `composition/**`, `apps/*/workers/**` — Awilix patterns, cradle, transactions |
| `testing.md` | `*.test.ts`, `*.test.tsx`, `*.integration.test.ts` — Vitest projects, Testcontainers, factories |
| `cli.md` | `apps/cli/**` — trpc-cli patterns, swarm topic groups |
| `barrels.md` | `**/index.ts` — barrel export discipline |
| `container-images.md` | `Dockerfile`, `fly.toml`, `.cicd.yml` — image build patterns |
| `ci-costs.md` | `.cicd.yml`, `.github/workflows/**` — runtime budget per job |
| `ai.md` | `**/*ai*/**`, `**/mastra/**` — Mastra agents, Vercel AI SDK |
| `ai-evals.md` | `**/evals/**`, AI tools — eval suites + scoring |
| `remote-tunnels.md` | `.tunnel/`, workspace dev scripts, anything mentioning `*.dev.bokendell.com` |

### 3. Map each file → the patterns that apply

For each resolved file path, look it up in `references/glob-map.md` (lives next to this SKILL.md). The map uses glob rules; a single file usually matches 1–3 patterns. Read each matched pattern doc ONCE (cache it in your working memory for the rest of the review) before judging code.

If a file matches zero rules, decide whether it's actually pattern-relevant. README, lockfile, package.json, and config files usually aren't — skip them silently. If the user asked you to review them explicitly, do a generic code-quality pass (clear naming, no dead code, idiomatic TS) and say so.

### 4. Run the review per file

For each file:

1. **Read the file fully.** Don't review snippets in isolation — pattern compliance often depends on what's already in the file (e.g., whether a service is injected vs. instantiated).
2. **Cross-check against the loaded pattern doc(s).** The shorter `references/review-criteria/<domain>.md` checklists give the "what to check" surface; the full `references/patterns/<doc>.md` gives the "how to fix it" detail. Load review-criteria first when available — it's tighter.
3. **Classify findings:**
   - **BLOCKING** — violates a core architectural rule (e.g., tRPC procedure queries DB directly, component uses a store hook). Must be fixed before commit.
   - **IMPORTANT** — meaningful drift from the pattern (missing schema, wrong error mapping, missing test). Should be fixed.
   - **ADVISORY** — minor or stylistic deviation. Note in the report; only fix if cheap.
4. **Fix in place** for BLOCKING + IMPORTANT findings. Use the `Edit` tool with the exact rewrite the pattern doc describes. For ADVISORY findings, mention them in the report but don't touch the file.

### 5. Report back

Use this exact structure so the user can skim:

```markdown
## Review: <N> file(s) against <M> pattern(s)

**Patterns applied:** ddd.md, api.md, testing.md

### <file path>
- ✗ BLOCKING — <one-line description of violation> → fixed: <one-line of what changed>
- ⚠ IMPORTANT — <description> → fixed: <change>
- ℹ ADVISORY — <description> (not fixed; cheap if you want it)

### <next file>
- ✓ No violations found

## Summary
- N files reviewed
- X BLOCKING fixed
- Y IMPORTANT fixed
- Z ADVISORY noted
- W items need your judgment: <list>
```

If a fix requires a decision the user has to make (e.g., "this looks like it should be a service method but I don't know which existing service it belongs to"), don't guess — list it under "needs your judgment" and explain the options.

## Reference files

- `references/glob-map.md` — full file path → pattern doc(s) mapping. Read first to know what's relevant for a given file set.
- `references/example-runs.md` — worked examples showing what a good review looks like for a couple of representative files.

## Worked example

If the user runs:

```
/review apps/api/src/packages/projects/projects.trpc.router.ts
```

1. **Resolve files**: `apps/api/src/packages/projects/projects.trpc.router.ts` (one file).
2. **Map to patterns**: `apps/*/api/**` glob → `api.md` + `hono-api-anatomy.md` + `auth-and-scopes.md`.
3. **Load**: `references/review-criteria/api.md` for the checklist, `references/patterns/api.md` for the full reference. Skip `auth-and-scopes.md` initially unless the file shows auth-related code on a first read.
4. **Read** the router file. Check each item:
   - Has `.input()` / `.output()` schemas? (BLOCKING if no)
   - Uses `protectedProcedure` for auth-required? (BLOCKING if mismatched)
   - Calls service from cradle (not instantiated)? (BLOCKING if instantiated)
   - Maps domain errors to TRPCError correctly? (IMPORTANT)
   - OpenAPI meta tags present? (IMPORTANT)
5. **Fix** the violations in place via `Edit`. If, say, the router instantiates `new ProjectService()` instead of getting it from cradle, rewrite to `ctx.scope.cradle.projectService`.
6. **Report** in the structure above.

## Notes on staying useful

- **Don't lecture.** The user knows the patterns exist. Cite the doc only when explaining a specific fix.
- **Don't widen scope.** If the user asked to review one file, don't open and edit twelve others "while you're there." Stay tight.
- **Don't re-implement features.** This skill fixes pattern violations only. Functional bugs are out of scope unless the user asks.
- **Be terse.** A long review feels like make-work. The structured report above is the format — no preamble, no recap of what each pattern says.

## Big diff? Offer to fan it out — do not just do it

Reviewing one file, or a handful, is a sequence. Do it inline; a fleet is pure overhead.

Review goes **wide** when there are many files AND several independent dimensions
(correctness, patterns, security, tests) that do not need each other's answers. That is
the fake-edge test from `references/fan-out.md`: reviewing file B never reads what the
review of file A returned, so those waits are wasted.

When it is genuinely wide, **say so in one line and let Aaron choose** — a skill never
launches a `Workflow` on its own, because fleets cost real money and the opt-in is his:

> "34 files across 4 domains. Want this fanned out — roughly a dozen agents — or
> should I work through it sequentially?"

If he opts in, the shape is fan out per dimension -> dedupe in code -> **verify each
finding on a fresh context with a different model** -> report survivors. A finding
checked by the agent that produced it has not been checked. Count what came back
against what you dispatched and flag the gap rather than reporting a partial set as
complete. Full guidance: `references/fan-out.md`.

Parallel read-only exploration agents are fine unprompted — they are cheap and bounded.
The opt-in rule is about fleets that judge or write.

## Changing this skill? Run its evals

`evals/` holds fixture files with violations planted on purpose. The number this
skill is judged on is **recall** — what fraction of the planted violations a review
actually finds. Editing this file or the pattern docs it loads can drop recall
without any visible symptom, which is exactly the kind of regression that goes
unnoticed for months.

Run the suite before and after a change to this skill: `evals/README.md` has both
runners. If recall drops, the edit is a regression regardless of how much better
the new wording reads.

Two rules if you add a case: the fixture must stay **blind** (no comment marking the
planted violations — an agent that knows it is being graded reviews differently),
and the judge must be a different model from the one under test.
