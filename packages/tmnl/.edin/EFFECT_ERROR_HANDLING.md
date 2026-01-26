# Effect Error Handling Patterns — Research Document

**Date**: 2026-01-24
**Status**: Priority 1 COMPLETE (DeepWiki Verified)
**Applies To**: `@effect/effect`, `@effect/workflow`

---

## Executive Summary

This document catalogs verified error handling patterns for Effect-TS. Each pattern has been validated against DeepWiki and includes:
- Exact API signature
- When to use vs alternatives
- Type preservation characteristics
- Composability patterns

**Core Principle**: Effect's error model distinguishes between:
- **Expected errors** (`E` channel) - Recoverable, typed, handled via `catchTag`/`catchAll`
- **Defects** (`Cause.Die`) - Unexpected, unrecoverable, handled via `catchAllDefect`
- **Interruptions** (`Cause.Interrupt`) - Fiber cancellation

---

## Pattern 1: Activity.retry (Workflow-Specific)

### DeepWiki Verification: ✓ VERIFIED

**Source**: `@effect/workflow/Activity`

### Signature

```typescript
export const retry: {
  <E, O extends Omit<Effect.Retry.Options<E>, "schedule">>(
    options: O
  ): <A, R>(self: Effect.Effect<A, E, R>) => Effect.Retry.Return<R, E, A, O>
}
```

### Key Difference from Effect.retry

| Aspect | `Activity.retry` | `Effect.retry` |
|--------|------------------|----------------|
| Provides `CurrentAttempt` | ✓ Auto-incremented | ✗ Must track manually |
| Workflow-aware | ✓ Integrates with durable execution | ✗ Plain retry |
| Options | `{ times: N }` (no schedule) | Full `Schedule` support |

### Canonical Usage

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

### When to Use

- **Use `Activity.retry`**: Inside `@effect/workflow` when you need attempt tracking
- **Use `Effect.retry`**: Outside workflows, or when you need custom `Schedule`

### Anti-Pattern

```typescript
// ❌ WRONG - Effect.retry inside workflow activity
Activity.make({ ... }).pipe(
  Effect.retry({ times: 5 })  // Won't provide CurrentAttempt!
)
```

---

## Pattern 2: Tap Functions (Observability Without Recovery)

### DeepWiki Verification: ✓ VERIFIED

**Key Characteristic**: All tap functions **preserve the original error type** — they observe but don't transform.

### 2.1 Effect.tapError

**Purpose**: Execute side effect on expected error (`E`), re-propagate error.

```typescript
import { Effect, Console } from "effect"

const task: Effect.Effect<number, string> = Effect.fail("NetworkError")

const withLogging = Effect.tapError(task, (error) =>
  Console.log(`expected error: ${error}`)
)
// Type: Effect<number, string, never> — error type PRESERVED
```

**When to Use**: Logging recoverable errors, metrics, alerting.

### 2.2 Effect.tapErrorCause

**Purpose**: Inspect full `Cause` (includes defects, interruptions).

```typescript
import { Effect, Console } from "effect"

const task = Effect.dieMessage("Something went wrong")

const withCauseLogging = Effect.tapErrorCause(task, (cause) =>
  Console.log(`error cause: ${cause}`)
)
// Logs: RuntimeException: Something went wrong
```

**When to Use**: Debugging, inspecting defects, full failure context.

### 2.3 Effect.tapErrorTag

**Purpose**: Observe specific tagged error without affecting others.

```typescript
import { Effect, Console } from "effect"

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
// Type: Effect<number, NetworkError | ValidationError, never> — PRESERVED
```

**When to Use**: Selective logging, metrics per error type.

### 2.4 Effect.tapDefect

**Purpose**: Observe defects (unexpected failures) specifically.

```typescript
const withDefectLogging = Effect.tapDefect(task, (defect) =>
  Console.log(`Defect occurred: ${defect}`)
)
```

**When to Use**: Monitoring for unexpected failures, crash reporting.

### Tap Function Decision Tree

```
Need to observe failure?
│
├─ Only expected errors (E)?
│  ├─ All errors → Effect.tapError
│  └─ Specific tag → Effect.tapErrorTag
│
├─ Defects only?
│  └─ Effect.tapDefect
│
└─ Everything (errors, defects, interrupts)?
   └─ Effect.tapErrorCause
```

---

## Pattern 3: Catch Functions (Recovery)

### DeepWiki Verification: ✓ VERIFIED

### 3.1 Effect.catchTag

**Purpose**: Handle single specific error tag, remove from error type.

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

### 3.2 Effect.catchTags

**Purpose**: Handle multiple tags in one block.

```typescript
const fullyRecovered = program.pipe(
  Effect.catchTags({
    HttpError: (_http) => Effect.succeed("Recovered from HttpError"),
    ValidationError: (_val) => Effect.succeed("Recovered from ValidationError")
  })
)
// Type: Effect<string, never, never>
// All errors handled → error type is `never`
```

### 3.3 Effect.catchAll

**Purpose**: Handle all expected errors with fallback.

```typescript
const fallback = program.pipe(
  Effect.catchAll((error) =>
    Effect.succeed(`Recovered from ${error._tag}`)
  )
)
// Type: Effect<string, never, never>
```

**Warning**: Loses granular error information. Prefer `catchTags` for type safety.

### 3.4 Effect.catchAllDefect

**Purpose**: Recover from defects (unexpected failures).

```typescript
const withDefectRecovery = program.pipe(
  Effect.catchAllDefect((defect) =>
    Effect.succeed(`Recovered from defect: ${defect}`)
  )
)
```

**When to Use**: Application boundaries, plugin systems, controlled recovery.

**Anti-Pattern**: Using `catchAllDefect` everywhere — defects should usually crash.

### Catch Function Decision Tree

```
Need to recover from failure?
│
├─ Specific expected error?
│  ├─ Single tag → Effect.catchTag
│  └─ Multiple tags → Effect.catchTags (PREFERRED)
│
├─ All expected errors?
│  └─ Effect.catchAll (loses granularity)
│
├─ Specific defects?
│  └─ Effect.catchSomeDefect
│
└─ All defects?
   └─ Effect.catchAllDefect (use sparingly)
```

---

## Pattern 4: Effect.mapError (Type-Safe Transformation)

### DeepWiki Verification: ✓ VERIFIED

**Purpose**: Transform error type without recovery.

### Signature

```typescript
mapError<A, E, R, E2>(
  self: Effect<A, E, R>,
  f: (e: E) => E2
): Effect<A, E2, R>
```

### Key Difference from catchAll

| Aspect | `mapError` | `catchAll` |
|--------|------------|------------|
| Recovers? | ✗ No | ✓ Yes |
| Changes success? | ✗ No | ✓ Possibly |
| Use case | Type adaptation | Error recovery |

### Canonical Usage

```typescript
import { Effect } from "effect"

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

### When to Use

- Adapting error types at layer boundaries
- Converting internal errors to API errors
- Preserving failure semantics while changing type

### Anti-Pattern

```typescript
// ❌ WRONG - Using mapError to "handle" errors
program.pipe(
  Effect.mapError(() => new GenericError())  // Loses information!
)

// ✓ RIGHT - Transform with context preservation
program.pipe(
  Effect.mapError((e) => new ApiError({ cause: e, code: 500 }))
)
```

---

## Pattern 5: Match.tagsExhaustive (Exhaustive Handling)

### DeepWiki Verification: ✓ VERIFIED

**Purpose**: Compile-time enforcement that all error tags are handled.

### Canonical Usage

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
    // Missing case → TypeScript compile error!
  })
)(error)
```

### When to Use

- Error handling outside Effect pipeline
- Ensuring all error variants are addressed
- Building error-to-message mappers

### Relationship to Effect.catchTags

`Effect.catchTags` achieves similar exhaustiveness **when all tags are handled** — the error type becomes `never`.

---

## Pattern 6: Composable Error Handlers

### DeepWiki Verification: ✓ VERIFIED

**Core Insight**: Error handlers are just functions that return `Effect`. They can be defined separately, tested in isolation, and composed.

### 6.1 Reusable Handler Functions

```typescript
import { Effect } from "effect"

class HttpError { readonly _tag = "HttpError" }
class ValidationError { readonly _tag = "ValidationError" }

// Define handlers as separate, testable functions
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

### 6.2 Handler Composition Pattern

```typescript
// Create a reusable error handling pipeline
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

### 6.3 Testing Handlers in Isolation

```typescript
import { it, expect } from '@effect/vitest'

it.effect('handleHttpError recovers correctly', () =>
  Effect.gen(function* () {
    const result = yield* handleHttpError(new HttpError())
    expect(result).toBe("Recovered from HTTP: HttpError")
  })
)
```

### 6.4 Sandbox Pattern for Full Cause Handling

```typescript
import { Effect, Console, Cause } from "effect"

const task = Effect.fail(new Error("Oh uh!")).pipe(Effect.as("result"))

// Sandbox exposes full Cause
const sandboxed = Effect.sandbox(task)

// Handle different Cause variants
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

When composing error handling in a pipeline, follow this order:

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
│
├─ Need observability?
│  └─ Add tapError/tapErrorCause FIRST
│
├─ Transient failures?
│  └─ Add retry AFTER tap (so retries are logged)
│
├─ Recoverable errors?
│  └─ Add catchTag/catchTags for specific cases
│
├─ Need type adaptation?
│  └─ Add mapError at LAYER BOUNDARIES
│
└─ At application edge?
   └─ Consider catchAllDefect for crash safety
```

---

## IIoT Application: AlarmLifecycleWorkflow

### Error Union (Rich Types Preserved)

```typescript
export const AlarmLifecycleError = Schema.Union(
  // Domain errors
  RpcAlarmNotFoundError,
  RpcAlarmAlreadyAcknowledgedError,
  RpcAlarmAlreadyClearedError,
  // Infrastructure errors
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

## Verification Checklist

| Pattern | DeepWiki Verified | Applied To |
|---------|-------------------|------------|
| Activity.retry | ✓ | AlarmLifecycleWorkflow activities |
| Effect.tapError | ✓ | Activity observability |
| Effect.tapErrorCause | ✓ | Debugging, full cause logging |
| Effect.tapErrorTag | ✓ | Selective error metrics |
| Effect.catchTag | ✓ | Granular error recovery |
| Effect.catchTags | ✓ | Multi-error handling |
| Effect.mapError | ✓ | Layer boundary adaptation |
| Match.tagsExhaustive | ✓ | Exhaustive error matchers |
| Composable handlers | ✓ | Reusable error handling functions |
| Effect.sandbox | ✓ | Full Cause handling |

---

## Anti-Patterns Summary

| Anti-Pattern | Why Bad | Correct Pattern |
|--------------|---------|-----------------|
| Flattening all errors to one type | Loses rich type info | Use `AlarmLifecycleError` union |
| `catchAll` everywhere | Loses granularity | Use `catchTags` |
| `catchAllDefect` everywhere | Defects should crash | Use at boundaries only |
| `Effect.retry` in workflows | No `CurrentAttempt` | Use `Activity.retry` |
| `mapError(() => generic)` | Loses context | Preserve cause in new error |
| Tap after retry | Logs only final attempt | Tap before retry |

---

## Quick Reference Card

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
Effect.mapError(e => newError)         // E → E2
Effect.mapErrorCause(c => newCause)    // Cause → Cause

// WORKFLOW-SPECIFIC
Activity.retry({ times: N })           // With CurrentAttempt
Activity.CurrentAttempt                // Access attempt number

// EXHAUSTIVE
Match.tagsExhaustive({ ... })          // Compile-time check
```
