# @bokendell/core

Location: `packages/shared/core/`

## What it exports
Core utilities shared across all apps and packages.

- `createId()` — CUID2 ID generation (re-exported from `@paralleldrive/cuid2`)
- `env` — type-safe environment variable access
- Common type guards (`isString`, `isNonNull`, etc.)
- Date utilities (formatting, timezone helpers)
- Error base classes (`AppError`, `NotFoundError`, `ValidationError`)

## How to use
```typescript
import { createId, NotFoundError } from "@bokendell/core";

const id = createId(); // "cuid2abc123..."

throw new NotFoundError("Area", id);
```

## Dependencies
- `@paralleldrive/cuid2`
- `zod` (for env validation)

## Notes
- Minimal dependencies — safe to import from any package
- Error classes are used throughout DDD service layer
- `createId()` is the canonical way to generate IDs across all apps (never use `uuid` or `nanoid`)
