# Effect Error Handling Patterns

> **Source**: `.edin/EFFECT_ERROR_HANDLING.md`
> **Last consolidated**: 2026-02-09

## Overview

Effect's error model distinguishes between three categories:
- **Expected errors** (`E` channel) -- Recoverable, typed, handled via `catchTag`/`catchAll`
- **Defects** (`Cause.Die`) -- Unexpected, unrecoverable, handled via `catchAllDefect`
- **Interruptions** (`Cause.Interrupt`) -- Fiber cancellation

This document covers tap functions (observability), catch functions (recovery), error transformation, workflow-specific retry, exhaustive matching, and composable error handler patterns.

---

## Pattern 1: Activity.retry (Workflow-Specific)

`Activity.retry` from `@effect/workflow` provides `CurrentAttempt` tracking. Use it inside workflows; use `Effect.retry` elsewhere.

| Aspect | `Activity.retry` | `Effect.retry` |
|--------|------------------|----------------|
| Provides `CurrentAttempt` | Yes (auto-incremented) | No |
| Workflow-aware | Yes (durable execution) | No |
| Options | `{ times: N }` (no schedule) | Full `Schedule` support |

```typescript
import { Activity } from '@effect/workflow'

yield* Activity.make({
  name: "SendEmail",
  error: SendEmailError,
  execute: Effect.gen(function* () {
    const attempt = yield* Activity.CurrentAttempt  // 1, 2, 3...
    yield* Effect.logInfo(`Attempt ${attempt}`)
    // ... activity logic
  })
}).pipe(
  Activity.retry({ times: 5 })  // Retry up to 5 times
)
```

**Anti-Pattern**: Using `Effect.retry` inside workflow activities -- it won't provide `CurrentAttempt`.

---

## Pattern 2: Tap Functions (Observability Without Recovery)

All tap functions **preserve the original error type** -- they observe but don't transform.

### Decision Tree

```
Need to observe failure?
|
+-- Only expected errors (E)?
|   +-- All errors -> Effect.tapError
|   +-- Specific tag -> Effect.tapErrorTag
|
+-- Defects only?
|   +-- Effect.tapDefect
|
+-- Everything (errors, defects, interrupts)?
    +-- Effect.tapErrorCause
```

### Effect.tapError

Execute side effect on expected error, re-propagate error.

```typescript
import { Effect, Console } from "effect"

const task: Effect.Effect<number, string> = Effect.fail("NetworkError")

const withLogging = Effect.tapError(task, (error) =>
  Console.log(`expected error: ${error}`)
)
// Type: Effect<number, string, never> -- error type PRESERVED
```

### Effect.tapErrorTag

Observe specific tagged error without affecting others.

```typescript
class NetworkError {
  readonly _tag = "NetworkError"
  constructor(readonly statusCode: number) {}
}

class ValidationError {
  readonly _tag = "ValidationError"
  constructor(readonly field: string) {}
}

const task: Effect.Effect<number, NetworkError | ValidationError> =
  Effect.fail(new NetworkError(504))

const withTaggedLogging = Effect.tapErrorTag(task, "NetworkError", (error) =>
  Console.log(`Network error: ${error.statusCode}`)
)
// Only fires for NetworkError, ignores ValidationError
// Type: Effect<number, NetworkError | ValidationError, never> -- PRESERVED
```

### Effect.tapErrorCause

Inspect full `Cause` (includes defects, interruptions).

```typescript
const withCauseLogging = Effect.tapErrorCause(task, (cause) =>
  Console.log(`error cause: ${cause}`)
)
```

### Effect.tapDefect

Observe defects (unexpected failures) specifically.

```typescript
const withDefectLogging = Effect.tapDefect(task, (defect) =>
  Console.log(`Defect occurred: ${defect}`)
)
```

---

## Pattern 3: Catch Functions (Recovery)

### Decision Tree

```
Need to recover from failure?
|
+-- Specific expected error?
|   +-- Single tag -> Effect.catchTag
|   +-- Multiple tags -> Effect.catchTags (PREFERRED)
|
+-- All expected errors?
|   +-- Effect.catchAll (loses granularity)
|
+-- Specific defects?
|   +-- Effect.catchSomeDefect
|
+-- All defects?
    +-- Effect.catchAllDefect (use sparingly)
```

### Effect.catchTag

Handle single specific error tag, **remove from error type**.

```typescript
import { Effect, Random } from "effect"

class HttpError { readonly _tag = "HttpError" }
class ValidationError { readonly _tag = "ValidationError" }

const program: Effect.Effect<string, HttpError | ValidationError> =
  Effect.gen(function* () {
    if ((yield* Random.next) < 0.5) yield* Effect.fail(new HttpError())
    if ((yield* Random.next) < 0.5) yield* Effect.fail(new ValidationError())
    return "result"
  })

const recovered = program.pipe(
  Effect.catchTag("HttpError", (_http) =>
    Effect.succeed("Recovered from HttpError")
  )
)
// Type: Effect<string, ValidationError, never>
// HttpError REMOVED from error type
```

### Effect.catchTags

Handle multiple tags in one block. **Preferred** for multi-error handling.

```typescript
const fullyRecovered = program.pipe(
  Effect.catchTags({
    HttpError: (_http) => Effect.succeed("Recovered from HttpError"),
    ValidationError: (_val) => Effect.succeed("Recovered from ValidationError")
  })
)
// Type: Effect<string, never, never>
// All errors handled -> error type is `never`
```

### Effect.catchAll

Handle all expected errors with fallback. **Warning**: Loses granular error information.

```typescript
const fallback = program.pipe(
  Effect.catchAll((error) =>
    Effect.succeed(`Recovered from ${error._tag}`)
  )
)
```

### Effect.catchAllDefect

Recover from defects. Use **only at application boundaries**.

```typescript
const withDefectRecovery = program.pipe(
  Effect.catchAllDefect((defect) =>
    Effect.succeed(`Recovered from defect: ${defect}`)
  )
)
```

---

## Pattern 4: Effect.mapError (Type-Safe Transformation)

Transform error type **without recovery**. The effect still fails, but with a different error type.

| Aspect | `mapError` | `catchAll` |
|--------|------------|------------|
| Recovers? | No | Yes |
| Changes success? | No | Possibly |
| Use case | Type adaptation | Error recovery |

```typescript
class DatabaseError {
  readonly _tag = "DatabaseError"
  constructor(readonly detail: string) {}
}

class ApplicationError {
  readonly _tag = "ApplicationError"
  constructor(readonly reason: string) {}
}

const dbOperation: Effect.Effect<Data, DatabaseError> =
  Effect.fail(new DatabaseError("Connection refused"))

const withAppError = dbOperation.pipe(
  Effect.mapError((e) => new ApplicationError(`DB issue: ${e.detail}`))
)
// Type: Effect<Data, ApplicationError, never>
// Error TRANSFORMED, not recovered
```

**When to use**: Adapting error types at layer boundaries, converting internal errors to API errors.

**Anti-Pattern**: `mapError(() => new GenericError())` -- loses context. Preserve cause in new error.

---

## Pattern 5: Match.tagsExhaustive (Exhaustive Handling)

Compile-time enforcement that all error tags are handled, outside Effect pipelines.

```typescript
import { Match, pipe } from "effect"

type MyError =
  | { _tag: "ErrorA"; a: string }
  | { _tag: "ErrorB"; b: number }
  | { _tag: "ErrorC"; c: boolean }

const handleError = (error: MyError) => pipe(
  Match.type<MyError>(),
  Match.tagsExhaustive({
    ErrorA: (e) => `Handled ErrorA: ${e.a}`,
    ErrorB: (e) => `Handled ErrorB: ${e.b}`,
    ErrorC: (e) => `Handled ErrorC: ${e.c}`
    // Missing case -> TypeScript compile error!
  })
)(error)
```

---

## Pattern 6: Composable Error Handlers

Error handlers are just functions that return `Effect`. Define them separately, test in isolation, compose.

### Reusable Handler Functions

```typescript
const handleHttpError = (error: HttpError): Effect.Effect<string> =>
  Effect.succeed(`Recovered from HTTP: ${error._tag}`)

const handleValidationError = (error: ValidationError): Effect.Effect<string> =>
  Effect.succeed(`Recovered from Validation: ${error._tag}`)

// Compose into programs
const program = riskyOperation.pipe(
  Effect.catchTag("HttpError", handleHttpError),
  Effect.catchTag("ValidationError", handleValidationError)
)
```

### Handler Composition Pattern

```typescript
const withStandardErrorHandling = <A, R>(
  effect: Effect.Effect<A, HttpError | ValidationError, R>
) =>
  effect.pipe(
    Effect.catchTags({
      HttpError: handleHttpError,
      ValidationError: handleValidationError
    })
  )

// Apply to multiple effects
const program1 = withStandardErrorHandling(operation1)
const program2 = withStandardErrorHandling(operation2)
```

### Testing Handlers in Isolation

```typescript
import { it, expect } from '@effect/vitest'

it.effect('handleHttpError recovers correctly', () =>
  Effect.gen(function* () {
    const result = yield* handleHttpError(new HttpError())
    expect(result).toBe("Recovered from HTTP: HttpError")
  })
)
```

### Sandbox Pattern for Full Cause Handling

```typescript
import { Effect, Console, Cause } from "effect"

const sandboxed = Effect.sandbox(task)

const withFullHandling = Effect.catchTags(sandboxed, {
  Die: (cause) =>
    Console.log(`Defect: ${cause.defect}`).pipe(
      Effect.as("fallback on defect")
    ),
  Interrupt: (cause) =>
    Console.log(`Interrupted: ${cause.fiberId}`).pipe(
      Effect.as("fallback on interrupt")
    ),
  Fail: (cause) =>
    Console.log(`Failed: ${cause.error}`).pipe(
      Effect.as("fallback on failure")
    )
})
```

---

## Pattern 7: Error Pipeline Composition

### Recommended Order

```typescript
const robustActivity = Activity.make({
  name: "ProcessOrder",
  error: OrderError,
  execute: orderProcessingLogic
}).pipe(
  // 1. Observability first (doesn't change types)
  Effect.tapError((e) => Effect.logWarning(`Order failed: ${e._tag}`)),

  // 2. Retry transient errors
  Activity.retry({ times: 3 }),

  // 3. Handle specific recoverable errors
  Effect.catchTag("TemporaryUnavailable", () =>
    Effect.succeed(fallbackResult)
  ),

  // 4. Transform remaining errors for API layer
  Effect.mapError((e) => new ApiError({ cause: e }))
)
```

### Pipeline Decision Tree

```
Building error pipeline?
|
+-- Need observability?
|   +-- Add tapError/tapErrorCause FIRST
|
+-- Transient failures?
|   +-- Add retry AFTER tap (so retries are logged)
|
+-- Recoverable errors?
|   +-- Add catchTag/catchTags for specific cases
|
+-- Need type adaptation?
|   +-- Add mapError at LAYER BOUNDARIES
|
+-- At application edge?
    +-- Consider catchAllDefect for crash safety
```

---

## IIoT Application: AlarmLifecycleWorkflow

### Error Union (Rich Types Preserved)

```typescript
export const AlarmLifecycleError = Schema.Union(
  RpcAlarmNotFoundError,
  RpcAlarmAlreadyAcknowledgedError,
  RpcAlarmAlreadyClearedError,
  ClusterError.MailboxFull,
  ClusterError.AlreadyProcessingMessage,
  ClusterError.PersistenceError,
)
```

### Activity with Error Pipeline

```typescript
const processAcknowledgment = Activity.make({
  name: `ProcessAcknowledgment-${alarmId}`,
  success: Alarm,
  error: AlarmLifecycleError,
  execute: Effect.gen(function* () {
    const attempt = yield* Activity.CurrentAttempt
    const makeClient = yield* AlarmEntity.client
    const client = makeClient(alarmId)
    return yield* client[AlarmAcknowledgeTag]({
      alarmId,
      acknowledgedBy: params.acknowledgedBy,
    })
  })
}).pipe(
  // 1. Observability
  Effect.tapError((e) =>
    Effect.logWarning(`Ack failed for ${alarmId}: ${e._tag}`)
  ),

  // 2. Retry transient cluster errors
  Activity.retry({ times: 3 }),

  // 3. Specific handling (if needed)
  Effect.catchTag("MailboxFull", () =>
    Effect.fail(new RpcAlarmWorkflowError({
      alarmId,
      message: "Entity mailbox full after retries"
    }))
  )
)
```

---

## Anti-Patterns Summary

| Anti-Pattern | Why Bad | Correct Pattern |
|--------------|---------|-----------------|
| Flattening all errors to one type | Loses rich type info | Use typed error unions |
| `catchAll` everywhere | Loses granularity | Use `catchTags` |
| `catchAllDefect` everywhere | Defects should crash | Use at boundaries only |
| `Effect.retry` in workflows | No `CurrentAttempt` | Use `Activity.retry` |
| `mapError(() => generic)` | Loses context | Preserve cause in new error |
| Tap after retry | Logs only final attempt | Tap before retry |

---

## Agent Quick Reference

### Key Imports

```typescript
import { Effect, Cause, Match, pipe } from 'effect'
import { Activity } from '@effect/workflow'
```

### Minimal Example

```typescript
// Observe, retry, recover, transform
const robust = riskyEffect.pipe(
  Effect.tapError((e) => Effect.logWarning(e._tag)),
  Effect.retry({ times: 3 }),
  Effect.catchTag("Transient", () => Effect.succeed(fallback)),
  Effect.mapError((e) => new ApiError({ cause: e }))
)
```

### Quick Reference Card

```typescript
// OBSERVE (preserves type)
Effect.tapError(e => log(e))           // Expected errors
Effect.tapErrorCause(c => log(c))      // Full cause
Effect.tapErrorTag("Tag", e => log(e)) // Specific tag
Effect.tapDefect(d => log(d))          // Defects only

// RECOVER (removes from type)
Effect.catchTag("Tag", handler)        // Single tag
Effect.catchTags({ A: h1, B: h2 })     // Multiple tags
Effect.catchAll(handler)               // All expected
Effect.catchAllDefect(handler)         // All defects

// TRANSFORM (changes type)
Effect.mapError(e => newError)         // E -> E2
Effect.mapErrorCause(c => newCause)    // Cause -> Cause

// WORKFLOW-SPECIFIC
Activity.retry({ times: N })           // With CurrentAttempt
Activity.CurrentAttempt                // Access attempt number

// EXHAUSTIVE
Match.tagsExhaustive({ ... })          // Compile-time check
```

### Common Pitfalls

- Using `Effect.retry` inside workflows -- loses `CurrentAttempt` tracking, use `Activity.retry`
- `catchAll` instead of `catchTags` -- loses granular error type information
- `catchAllDefect` everywhere -- defects should usually crash; use only at boundaries
- `mapError` that discards context -- always preserve cause/detail in the new error
- Tap functions after retry -- logs only the final attempt, not intermediate failures
- Missing `Effect.sandbox` when you need to handle defects/interrupts alongside expected errors

### Cross-References

- [effect-match.md](./effect-match.md) -- `Match.tagsExhaustive` for pattern matching
- [rpc-entity-workflow.md](./rpc-entity-workflow.md) -- Workflow Activities with retry
- [effect-testing.md](./effect-testing.md) -- testing error paths with `Effect.flip`
- [entities.md](./entities.md) -- Machine error to RPC error mapping
