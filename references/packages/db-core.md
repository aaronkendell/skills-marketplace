# @bokendell/db-core

Location: `packages/shared/db-core/`

## What it exports
Database abstractions and Neon driver setup shared across all apps.

- `createDb(connectionString)` — creates a Drizzle + Neon HTTP driver instance
- `type Database` — typed database instance
- Base Drizzle utilities re-exported for convenience (`eq`, `and`, `or`, `desc`, etc.)

## How to use
```typescript
import { createDb } from "@bokendell/db-core";

const db = createDb(process.env.DATABASE_URL);
```

## Dependencies
- `drizzle-orm`
- `@neondatabase/serverless` (Neon HTTP driver)

## Notes
- Each app's `db` package wraps this with its own schema
- Do not put app-specific schema or queries here
- Connection pooling is handled by Neon's serverless driver automatically
