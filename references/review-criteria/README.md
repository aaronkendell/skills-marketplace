# Review Criteria

Per-domain checklists used by agents during self-review before opening a PR.

## How to use

1. Identify which domains your changes touch (check changed files)
2. Read the relevant criteria files below
3. Apply each checklist item — fix violations before opening a PR
4. Violations marked BLOCKING must be fixed. IMPORTANT items should be fixed. ADVISORY are noted in PR.

## Files

| File | When to read |
|------|-------------|
| [ddd.md](ddd.md) | Changed any file in `packages/*/domains/src/` |
| [api.md](api.md) | Changed any file in `apps/*/api/src/` |
| [frontend.md](frontend.md) | Changed any file in `apps/*/app/src/` |
| [mobile.md](mobile.md) | Changed any file in `apps/*/mobile/src/` |
| [testing.md](testing.md) | Changed or added test files |
| [security.md](security.md) | Always read this |

## Full pattern references

- `docs/context/patterns/ddd.md` — complete DDD implementation guide
- `docs/context/patterns/api.md` — complete API patterns guide
- `docs/context/patterns/mobile.md` — complete mobile architecture guide
- `docs/context/patterns/frontend.md` — complete frontend architecture guide
- `docs/context/patterns/testing.md` — complete testing guide
