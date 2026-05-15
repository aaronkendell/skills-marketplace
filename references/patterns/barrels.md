# Barrels

How `index.ts` re-export files are used in this monorepo. Source of truth for the `no-nested-barrels` arch rule.

## TL;DR

- **One barrel per workspace package.** `packages/<scope>/<pkg>/src/index.ts` is the public API. Gated by `exports` in `package.json`.
- **No nested barrels inside an app or package.** Don't create `containers/index.ts`, `hooks/index.ts`, `utils/index.ts`, `components/index.ts`, etc. — they buy nothing and cost compile time.
- **`types.ts` and `constants.ts` are NOT barrels.** They're leaf modules with real content. Keep them at the root of any feature folder.
- **Direct sibling imports.** `from "../round.service"`, not `from ".."`.
- **Inngest registries are exempt** — `inngest/index.ts` is a framework requirement.

## Why

Big nested barrel chains create real performance and tooling cost:

| Where | Cost |
|---|---|
| `tsc` cold check | Up to 30–100% slower because every `import { X } from "barrel"` forces the entire barrel chain to be type-checked, even for one symbol |
| VS Code "Go to definition" | 1–3s per jump through a re-export chain |
| Vite / Next dev server startup | Pre-bundling barrels adds 0.5–2s |
| HMR | An edit anywhere in the barrel's tree invalidates the barrel module → cascade re-evaluations |
| Tree-shaking | Risk of bundling unused code if any file in the chain has top-level side effects or accidental cycles |
| Tools (knip, dep-cruiser, madge) | False positives — can't tell which re-exports are actually consumed |
| Refactor blast radius | Renaming a file forces cascading edits up the barrel chain |

The package boundary barrel still earns its keep:

- **Public API is explicit** — anyone reading `src/index.ts` sees the surface in 30 seconds
- **Refactoring stays internal** — rename a file inside the package without touching consumers
- **`exports` enforces it** — consumers can't deep-import private modules

That payoff disappears for **internal** barrels, where the consumer is just another file in the same package.

## The pattern

### Allowed barrel locations

The arch rule (`apps/swarm/cli/src/packages/check/arch/semantic/no-nested-barrels-rule.ts`) accepts:

```
packages/<scope>/<pkg>/src/index.ts            ← package boundary
packages/<scope>/e2e/<pkg>/src/index.ts        ← e2e sub-package boundary
apps/<app>/<part>/src/index.ts                  ← app entrypoint barrel (rare)
**/inngest/index.ts                             ← Inngest function registry (framework expects it)
```

Anything else that's a pure re-export file (only `export { X } from "..."` lines) is flagged.

### Forbidden patterns

```ts
// apps/golf/admin/src/packages/users/components/index.ts  ❌
export { UserCard } from "./user-card";
export { UserList } from "./user-list";
```

```ts
// apps/golf/mobile/src/packages/round/hooks/index.ts  ❌
export { useRound } from "./use-round";
export { useShots } from "./use-shots";
```

Replace with direct sibling imports:

```ts
// consumer file
import { UserCard } from "../components/user-card";   // ✓
import { useRound } from "../hooks/use-round";         // ✓
```

### `types.ts` and `constants.ts` are leaf modules, not barrels

These contain actual content (type aliases, exported constants), not just re-exports. Keep them at the root of each feature folder:

```
packages/golf-domains/src/packages/round/
  types.ts          ← cross-cutting types for the round feature  ✓
  constants.ts      ← shared values used by 2+ siblings  ✓
  application/round.service.ts
  domain/round.entity.ts
  infrastructure/persistence/round.repository.ts
```

Rule of thumb:

- A type used by **2+ siblings** → lift to the parent's `types.ts`
- A type used by only **one sibling** → inline it next to its only consumer
- A type that's the canonical shape of an entity → live next to the entity (`round.entity.ts` exports `Round`)

If `types.ts` becomes a kitchen sink with 60+ unrelated types, split it by sub-feature instead of leaving it as a giant barrel-with-extra-steps.

## How to add a new public API

When you need to expose something from a workspace package:

1. Implement the symbol in its leaf file (e.g., `packages/shared/storage/src/r2/r2-client.ts`)
2. Add it explicitly to `packages/shared/storage/src/index.ts`:

```ts
export { R2Client } from "./r2/r2-client";
export type { R2Config } from "./r2/r2-client";
```

3. Make sure `package.json#exports` points at `./src/index.ts`:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing/index.ts"
  }
}
```

4. Consumers import from the package name only:

```ts
import { R2Client } from "@bokendell/storage";  // ✓
import { R2Client } from "@bokendell/storage/src/r2/r2-client";  // ❌ blocked by exports
```

## Migration history

The Apr-May 2026 sweep removed ~350 nested barrels using `scripts/sweep-barrels.mjs` and `scripts/fix-broken-barrel-imports.mjs`. The arch rule was added afterward to keep new barrels from creeping back in.

Before/after counts of `index.ts` files in `apps/` + `packages/`:

| Folder | Before | After |
|---|---|---|
| `containers/` | 75 | 0 |
| `pages/` | 44 | 0 |
| `screens/` | 25 | 0 |
| `stores/` | 18 | 5 |
| `utils/` | 57 | ~18 |
| `hooks/` | 67 | ~16 |
| `components/` | 129 | ~17 |
| Total `index.ts` | 1091 | 740 |

The remaining ~700 are mostly package boundary barrels (`packages/X/Y/src/index.ts`), feature-root barrels, and Inngest registries — all allowed by the rule.

## Running the rule

```bash
swarm check arch              # runs all semantic rules including no-nested-barrels
swarm check arch --json       # machine-readable output
```

The `no-nested-barrels` rule fires at `severity: warn` so it won't break CI yet. Promote to `error` once the long tail of allowed-by-judgment barrels (feature-root barrels) has been triaged.
