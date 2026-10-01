<!-- source: https://effect.website/docs/v4/error-management/retrying/ · fetched 2026-10-01 -->

# Retrying

Retrying is appropriate for transient failures such as temporary network or service unavailability. It is not a substitute for handling permanent errors, and defects or interruptions are never retried.

## retry

`Effect.retry` reruns an Effect after a typed failure. The source Effect is always evaluated once before the retry policy is applied.

**Example** (Retrying a Fixed Number of Times)

```ts
import { Data, Effect } from "effect"

class TemporaryError extends Data.TaggedError("TemporaryError")<{
  readonly attempt: number
}> {}

let attempts = 0
const request = Effect.suspend(() => {
  attempts++
  return attempts < 3
    ? Effect.fail(new TemporaryError({ attempt: attempts }))
    : Effect.succeed("ok")
})

const program = request.pipe(Effect.retry({ times: 5 }))

Effect.runSync(program) // => "ok"
attempts // => 3
```

`times` is the number of retries after the initial attempt. Therefore `{ times: 5 }` allows at most six executions of the source Effect.

### Retrying Selected Errors

The options object can combine:

- `while`: retry while the predicate is true;
- `until`: stop retrying when the predicate is true;
- `times`: limit the number of retries;
- `schedule`: control timing and additional stopping conditions.

Predicates may return either a boolean or an Effect.

**Example** (Retrying Only Transient Errors)

```ts
import { Data, Effect, Exit } from "effect"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly retryable: boolean
}> {}

let attempts = 0
const request = Effect.failSync(() => {
  attempts++
  return new RequestError({ retryable: attempts < 2 })
})

const program = request.pipe(
  Effect.retry({
    times: 5,
    while: (error) => error.retryable,
  }),
)

Effect.runSyncExit(program) // => Exit.fail(new RequestError({ retryable: false }))
attempts // => 2
```

### Using a Schedule

A [`Schedule`](/docs/v4/scheduling/using-schedules/) can define delays, backoff, jitter, and retry limits. `Schedule.recurs(3)`, for example, permits three retries after the initial attempt.

```ts
import { Effect, Schedule } from "effect"

let attempts = 0
const request = Effect.suspend(() => {
  attempts++
  return attempts < 2 ? Effect.fail("temporary") : Effect.succeed("ok")
})

const program = request.pipe(Effect.retry(Schedule.recurs(3)))

Effect.runSync(program) // => "ok"
```

Use [`Effect.repeat`](/docs/v4/scheduling/using-schedules/#repeat-after-success) instead when repetition depends on successful values rather than errors.

## retryOrElse

`Effect.retryOrElse` uses a Schedule and runs a fallback Effect when the schedule is exhausted. The fallback receives the final error and the schedule's output.

**Example** (Falling Back After Retries)

```ts
import { Effect, Schedule } from "effect"

let attempts = 0
const request = Effect.failSync(() => {
  attempts++
  return "unavailable"
})

const program = Effect.retryOrElse(
  request,
  Schedule.recurs(2),
  (error, retries) => Effect.succeed(`${error} after ${retries} retries`),
)

Effect.runSync(program) // => "unavailable after 2 retries"
attempts // => 3
```
