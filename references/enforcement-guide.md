# Coding Standards Enforcement Guide

Reference for what standards are enforced, how, and what tooling gaps remain.

---

## What Is Running

### `pnpm check:architecture` (dep-cruiser + ts-morph)

**Script:** `scripts/check-architecture/`
**Config:** `.dependency-cruiser.ts`
**Run:** `pnpm check:architecture` (all files) or `pnpm check:architecture --changed` (git diff only)
**JSON output:** `pnpm check:architecture --json`

| Rule | Tool | Severity |
|------|------|----------|
| API routes must not import from `infrastructure/persistence/` | dep-cruiser | error |
| API routes must not import from DB packages | dep-cruiser | error |
| Application layer must not import from DB packages | dep-cruiser | error |
| Presentation layer must not import from `infrastructure/persistence/` | dep-cruiser | error |
| Cross-domain imports must go through domain `index.ts` | ts-morph (custom) | error |
| Screen files must not import hooks | dep-cruiser | warn |
| Screen files must not import mutations/queries | dep-cruiser | warn |
| No circular dependencies | dep-cruiser | error |
| Service files must use factory function pattern (`export function create*`) | ts-morph | error |
| Screen files must not call React hooks directly | ts-morph | warn |
| Zod schemas in mobile/admin must use `.nullable()` not `.optional()` | ts-morph | warn |

**Integrated into:**
- CI: `quality-checks.yml` — `architecture-check` job (composite action at `.github/actions/quality/architecture-check/`) runs on every PR
- Local: `planner:implement` Phase 4 (reviewer) and Phase 5 (verification)
- Lefthook: pre-push hook runs `pnpm check:architecture --changed` before every push

### `swarm check arch` (swarm base rules + golf `review-architecture-rules.mjs`)

**Script:** `scripts/review-architecture-rules.mjs` (TS-AST walker), merged with swarm's base arch result by `scripts/swarm-check-arch-wrapper.mjs`
**Run:** `swarm check arch` (all files, untracked included) · `swarm check arch --affected` (git diff + untracked) · `swarm check arch --json`
**Also:** `pnpm check:architecture` → `./swarm check arch`; `pnpm check:architecture:changed` → `--affected`

| Rule id | Catches | Severity |
|---------|---------|----------|
| `review-container-not-orchestrator` | `containers/` file that only does presentational work (local state / form hook / `forwardRef`, no data/store/identity/domain hook) — a dumb component relocated to dodge purity | error |
| `review-component-not-dumb` | `components/`/`screens/` file importing a data/query/mutation/identity or store hook (local UI hooks allowed) | error |
| `review-no-inline-types` | Inline `interface`/`type` (recurses into function/component bodies) | error |
| `review-no-inline-constants` / `review-no-inline-utils` | Meaningful inline config/data / reusable helpers | error |
| `review-one-component-per-file` | >1 top-level component in a `.tsx` | error |
| `review-domain-layer-boundary` / `review-domain-no-cross-domain-internals` | DDD layer direction + cross-domain reach-through (domains `infrastructure/` now in scope) | error |
| `review-client-no-repository-or-db` / `review-router-no-direct-repository-or-db` / `review-composition-no-domain-internals` | Client/router/composition reaching past facades into repo/db/domain internals | error |
| `ui-no-classname-prop-on-golf-component` / `ui-no-style-prop-on-golf-component` | `className`/`style` on a golf-ui component (inside `packages/ui`), no exceptions — props for layout; spacing between elements via parent `Stack gap`/Box wrapper; brand one-offs moved into the leaf. className is legal only on the raw `div`/`View` inside a leaf primitive | error |
| `ui-no-direct-*` (`expo-haptics`, `react-native-reanimated`, gesture, worklets, safe-area, `expo-*`, RN `Pressable`) | golf-ui components importing platform libs directly instead of the shared adapters | error |

**Integrated into:**
- Lefthook: pre-push runs `swarm check arch --affected`
- The `review` skill runs it as a static pre-pass before hand-review
- The scan includes **untracked files** so mid-refactor / newly-added files aren't silently skipped

The folder-role rules encode the `frontend.md` contract (Container = orchestrator, Screen = pure presentation, Components = dumb) so a file's folder is a real contract, not a place to hide.

### Biome

**Run:** `pnpm check` (lint + format), `pnpm check:fix`
**Lefthook:** pre-commit runs `pnpm check:fix` on staged files

| Rule | Notes |
|------|-------|
| No unused imports | Auto-fixable |
| No unused variables | Auto-fixable |
| No explicit `any` | Warn (not error) |
| Tab indentation, 100-char line width | Auto-fixable |
| Exhaustive dependencies (React hooks) | Warn |
| Recommended lint rules | Mix of warn/error |

### Knip — Dead Code Detection

**Run:** `pnpm knip`
**Config:** `knip.json`

| Rule | Notes |
|------|-------|
| Unused exports in packages | Error |
| Unused dependencies in `package.json` | Error |
| Unlisted dependencies | Error |

**Workspaces configured:** root scripts, portfolio/api, portfolio/app, goals/api, goals/mobile, agents/api, portfolio/domains, goals/domains, agents/domains.

### ESLint + `eslint-plugin-boundaries` — DDD Layer Rules in Editor

**Run:** `pnpm lint:boundaries`
**Config:** `eslint.config.mjs`

Enforces DDD import direction rules with real-time editor feedback (red squiggles on save).

| Rule | Severity |
|------|----------|
| `domain` layer has no internal imports | error |
| `application` → `domain` only | error |
| `infrastructure` → `domain`, `application` | error |
| `presentation` → `domain`, `application` only (not `infrastructure`) | error |

**Note:** This gives the same DDD boundary rules as dep-cruiser, but inline in the editor via ESLint.
Also includes `@typescript-eslint/no-deprecated` to catch deprecated API usage on save.

### Lefthook — Git Hooks

**Config:** `lefthook.yml`
**Installed:** `pnpm prepare` (runs `lefthook install`) or `pnpm exec lefthook install`

| Hook | Commands |
|------|----------|
| pre-commit | biome check+fix (staged files), type-check (affected), OpenAPI sync |
| pre-push | tests (affected), type-check (affected), deprecation check, biome, **arch check**, OpenAPI check, Expo doctor |

---

## Rules vs Tools — Full Reference

Tools: **dep-cruiser** (DC), **ts-morph** (TS), **Biome** (B), **Knip** (K), **Lefthook** (LH), **ESLint/boundaries** (EB), **Coverage** (COV), **Manual** (M)

Legend: ✅ implemented · 🟡 possible, not implemented · ❌ not possible

### DDD Layer Rules

| Rule | DC | TS | B | K | LH | EB | COV | M |
|------|----|----|---|---|----|----|----|---|
| API → persistence import blocked | ✅ | ❌ | ❌ | ❌ | ✅ | 🟡 | ❌ | ❌ |
| API → DB package import blocked | ✅ | ❌ | ❌ | ❌ | ✅ | 🟡 | ❌ | ❌ |
| Application → DB package import blocked | ✅ | ❌ | ❌ | ❌ | ✅ | 🟡 | ❌ | ❌ |
| Presentation → persistence import blocked | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Cross-domain imports via index.ts only | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| No circular dependencies | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Services use factory function pattern | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | 🟡 |
| Repositories use factory function pattern | ❌ | 🟡 | ❌ | ❌ | 🟡 | ❌ | ❌ | 🟡 |
| Repository returns null (not throw) for not-found | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Service throws (not returns null) for not-found | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Domain entities are plain value objects | ❌ | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Domain index.ts re-exports all public types | ❌ | ❌ | ❌ | ✅ | 🟡 | ❌ | ❌ | 🟡 |

### API / Route Rules

| Rule | DC | TS | B | K | LH | EB | COV | M |
|------|----|----|---|---|----|----|----|---|
| Route handlers delegate to services (thin handlers) | ❌ | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Zod schemas for all request/response | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| OpenAPI via `@hono/zod-openapi` (not manual) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| No raw SQL in route handlers | ❌ | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Error classes (NotFoundError, etc.) not plain `Error` | ❌ | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Response format `{ data: T }` for success | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Mobile / Screen Rules

| Rule | DC | TS | B | K | LH | EB | COV | M |
|------|----|----|---|---|----|----|----|---|
| Screens must not import hooks | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Screens must not import mutations/queries | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Form hooks live in `hooks/forms/` (not inline) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| UI stores in `stores/` (Zustand only) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Use `.nullable()` not `.optional()` in RHF schemas | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Haptic feedback on user interactions | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| No API calls in store files | ❌ | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Container calls one domain hook | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Testing Rules

| Rule | DC | TS | B | K | LH | EB | COV | M |
|------|----|----|---|---|----|----|----|---|
| Test files co-located with implementation | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Unit tests mock all external deps | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Integration tests use Testcontainers (not sqlite) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| API route tests use `testClient` from hono/testing | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| No `any` in test files | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Test descriptions are behavior-focused | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Minimum line coverage threshold | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | 🟡 |

### Import / Module Rules

| Rule | DC | TS | B | K | LH | EB | COV | M |
|------|----|----|---|---|----|----|----|---|
| Workspace deps use `workspace:*` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Shared versions via catalog in `pnpm-workspace.yaml` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| No cross-workspace internal path imports | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| No dead exports in shared packages | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| No unused dependencies in `package.json` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| No unlisted dependencies | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| No deprecated API usage | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |

### Code Quality Rules

| Rule | DC | TS | B | K | LH | EB | COV | M |
|------|----|----|---|---|----|----|----|---|
| No explicit `any` | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| No unused imports | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| No unused variables | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Tab indentation | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| 100-char line width | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Exhaustive hook dependencies | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| No console.log in non-debug code | ❌ | ❌ | 🟡 | ❌ | 🟡 | ❌ | ❌ | ✅ |

### Security Rules

| Rule | DC | TS | B | K | LH | EB | COV | M |
|------|----|----|---|---|----|----|----|---|
| No hardcoded secrets | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ | ✅ |
| Input validation at system boundaries | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Auth checks before business logic | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| No sensitive data in error messages | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| No `.env` in git | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ | ✅ |

---

## Tool Status

| Tool | Status | Run command |
|------|--------|-------------|
| dep-cruiser | ✅ Running | `pnpm check:architecture` |
| ts-morph (semantic) | ✅ Running | `pnpm check:architecture` |
| Biome | ✅ Running | `pnpm check` / `pnpm check:fix` |
| Lefthook | ✅ Installed | auto-runs on commit/push |
| Knip | ✅ Installed | `pnpm knip` |
| ESLint + boundaries | ✅ Installed | `pnpm lint:boundaries` |

---

## What Cannot Be Automated

Some rules require human judgment in code review:

- **Repository returns null, service throws** — requires understanding business intent
- **Thin route handlers** — style and scope judgment
- **Haptic feedback on all interactions** — requires UX review
- **Test descriptions are behavior-focused** — language/intent judgment
- **Form hooks not inline** — requires reading full component tree
- **Auth before business logic** — requires security context
- **No sensitive data in errors** — requires knowledge of what counts as sensitive
- **Workspace version catalog compliance** — requires reading `pnpm-workspace.yaml`

These are covered by the checklists in `docs/context/review-criteria/`.
