<!-- source: https://effect.website/docs/v4/error-management/fallback/ · fetched 2026-10-01 -->

# Fallback

Fallback operators recover from typed failures. Defects and interruptions remain unchanged.

## catch

`Effect.catch` receives the error and returns a fallback Effect. If the source succeeds, the fallback is not evaluated.

**Example** (Recovering with Another Effect)

```ts
import { Effect } from "effect"

const primary = Effect.fail("primary unavailable")

const program = primary.pipe(
  Effect.catch((error) => Effect.succeed(`fallback: ${error}`)),
)

Effect.runSync(program) // => "fallback: primary unavailable"
```

Use `Effect.catchTag`, `Effect.catchIf`, or `Effect.catchFilter` when only part of the error channel should trigger the fallback.

## orElseSucceed

`Effect.orElseSucceed` replaces any typed failure with a lazily evaluated success value and removes the typed error channel.

**Example** (Providing a Default Value)

```ts
import { Effect } from "effect"

const program = Effect.fail("missing").pipe(Effect.orElseSucceed(() => 0))

Effect.runSync(program) // => 0
```

This operator handles every typed error. If only absence or one specific error should use the default, narrow the error first with a selective catch operator.

## firstSuccessOf

`Effect.firstSuccessOf` runs alternatives sequentially and stops at the first success. If every effect fails, it propagates the last error.

**Example** (Trying Prioritized Alternatives)

```ts
import { Effect } from "effect"

const program = Effect.firstSuccessOf([
  Effect.fail("primary unavailable"),
  Effect.succeed("secondary result"),
  Effect.die("not evaluated"),
])

Effect.runSync(program) // => "secondary result"
```

Passing an empty iterable creates a defect with the message `"Received an empty collection of effects"`.
