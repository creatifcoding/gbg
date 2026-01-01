# Effect Error Handling

## Triggers
- `[EFFECT:ERROR:DEFINE]` - Creating custom tagged errors
- `[EFFECT:ERROR:HANDLE]` - Catching and handling errors
- `[EFFECT:ERROR:RECOVER]` - Recovery strategies, retry, fallback

---

## Core Principle

> **"If a function can fail, name the failure."**

Errors are first-class values in Effect's type signature: `Effect<A, E, R>`
- `A` = Success type
- `E` = Error type (typed, exhaustive)
- `R` = Requirements (dependencies)

---

## [EFFECT:ERROR:DEFINE] — Defining Tagged Errors

### Data.TaggedError Pattern

```typescript
import { Data, Effect } from "effect"

// Simple error
class NotFound extends Data.TaggedError("NotFound")<{
  readonly resource: string
  readonly id: string
}> {}

// Error with cause
class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: string
  readonly cause: unknown
}> {}

// Validation error with multiple issues
class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly errors: ReadonlyArray<{ field: string; message: string }>
}> {}
```

### Usage in Effects

```typescript
const getUser = (id: string): Effect.Effect<User, NotFound | DatabaseError> =>
  Effect.gen(function* () {
    const result = yield* db.query(`SELECT * FROM users WHERE id = ?`, [id])

    if (!result) {
      return yield* new NotFound({ resource: "User", id })
    }

    return result
  })
```

### Anti-Pattern: Untyped Exceptions

```typescript
// ❌ BAD: Throws untyped exception
const getUser = (id: string) => {
  const user = db.findUser(id)
  if (!user) throw new Error("User not found")
  return user
}

// ✅ GOOD: Returns typed error in Effect
const getUser = (id: string): Effect.Effect<User, NotFound> =>
  Effect.gen(function* () {
    const user = yield* db.findUser(id)
    if (!user) return yield* new NotFound({ resource: "User", id })
    return user
  })
```

---

## [EFFECT:ERROR:HANDLE] — Handling Errors

### Effect.catchTag — Discriminated Handling

```typescript
const handled = getUser("123").pipe(
  Effect.catchTag("NotFound", (error) =>
    Effect.succeed({ fallback: true, id: error.id })
  )
)
// Effect<User | { fallback: true; id: string }, DatabaseError>
```

### Effect.catchTags — Multiple Tags

```typescript
const handled = getUser("123").pipe(
  Effect.catchTags({
    NotFound: (e) => Effect.succeed(defaultUser),
    DatabaseError: (e) => Effect.fail(new ServiceUnavailable({}))
  })
)
```

### Effect.catchAll — Catch Everything

```typescript
const handled = getUser("123").pipe(
  Effect.catchAll((error) => {
    console.error("Error:", error._tag)
    return Effect.succeed(defaultUser)
  })
)
// Effect<User, never> — error channel is now empty
```

### Effect.tapError — Side Effects on Error

```typescript
const withLogging = getUser("123").pipe(
  Effect.tapError((error) =>
    Effect.log(`Failed to get user: ${error._tag}`)
  )
)
// Error still propagates, but logs first
```

### Pattern: Error Transformation

```typescript
class UserFacingError extends Data.TaggedError("UserFacingError")<{
  readonly message: string
  readonly code: number
}> {}

const apiHandler = getUser(id).pipe(
  Effect.catchTag("NotFound", (e) =>
    Effect.fail(new UserFacingError({
      message: `User ${e.id} not found`,
      code: 404
    }))
  ),
  Effect.catchTag("DatabaseError", (e) =>
    Effect.fail(new UserFacingError({
      message: "Service temporarily unavailable",
      code: 503
    }))
  )
)
```

---

## [EFFECT:ERROR:RECOVER] — Recovery Strategies

### Effect.retry with Schedule

```typescript
import { Schedule } from "effect"

// Exponential backoff, 3 attempts
const withRetry = fetchData.pipe(
  Effect.retry(
    Schedule.exponential("100 millis").pipe(
      Schedule.compose(Schedule.recurs(3))
    )
  )
)

// Retry only specific errors
const selectiveRetry = fetchData.pipe(
  Effect.retry({
    schedule: Schedule.recurs(3),
    while: (error) => error._tag === "NetworkError"
  })
)
```

### Effect.orElse — Fallback Effect

```typescript
const withFallback = primarySource.pipe(
  Effect.orElse(() => fallbackSource)
)
```

### Effect.orElseSucceed — Fallback Value

```typescript
const withDefault = getConfig("feature_flag").pipe(
  Effect.orElseSucceed(() => false)
)
```

### Effect.option — Convert Error to None

```typescript
const maybeUser = getUser(id).pipe(Effect.option)
// Effect<Option<User>, never>
```

### Effect.either — Capture in Either

```typescript
const result = getUser(id).pipe(Effect.either)
// Effect<Either<Error, User>, never>

Effect.gen(function* () {
  const either = yield* result
  if (Either.isLeft(either)) {
    console.log("Failed:", either.left)
  } else {
    console.log("Success:", either.right)
  }
})
```

### Pattern: Circuit Breaker with Retry

```typescript
const resilient = fetchData.pipe(
  // Retry with exponential backoff
  Effect.retry(
    Schedule.exponential("100 millis").pipe(
      Schedule.jittered,
      Schedule.compose(Schedule.recurs(5))
    )
  ),
  // Timeout per attempt
  Effect.timeout("5 seconds"),
  // Ultimate fallback
  Effect.orElseSucceed(() => cachedData)
)
```

---

## Anti-Patterns Summary

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| `throw new Error(msg)` | Untyped, uncatchable | `Data.TaggedError` |
| `catch (e: any)` | Swallows all errors | `Effect.catchTag` |
| Silent failures | Errors disappear | `Effect.tapError` |
| Retry without backoff | Thundering herd | `Schedule.exponential` |
| `try/catch` in Effect | Breaks composition | `Effect.catchAll` |

---

## Quick Reference

```typescript
// Define
class MyError extends Data.TaggedError("MyError")<{ info: string }> {}

// Fail
yield* new MyError({ info: "details" })
// or
Effect.fail(new MyError({ info: "details" }))

// Handle
.pipe(Effect.catchTag("MyError", (e) => Effect.succeed(fallback)))

// Retry
.pipe(Effect.retry(Schedule.recurs(3)))

// Fallback
.pipe(Effect.orElseSucceed(() => defaultValue))
```
