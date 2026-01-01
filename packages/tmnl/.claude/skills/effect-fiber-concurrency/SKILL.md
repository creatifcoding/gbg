# Effect Fiber Concurrency

## Triggers
- `[EFFECT:FIBER:SPAWN]` - Forking background tasks
- `[EFFECT:FIBER:JOIN]` - Awaiting fiber completion
- `[EFFECT:FIBER:INTERRUPT]` - Cancellation and interruption

---

## Core Concept

Fibers are lightweight virtual threads managed by Effect runtime. They enable structured concurrency — child fibers are tied to parent scope.

```typescript
Effect<A, E, R>  →  fork  →  Fiber<A, E>
```

---

## [EFFECT:FIBER:SPAWN] — Forking Fibers

### Effect.fork — Standard Fork

```typescript
import { Effect, Fiber } from "effect"

const program = Effect.gen(function* () {
  // Fork a background task
  const fiber = yield* Effect.fork(longRunningTask)

  // Continue immediately, fiber runs concurrently
  yield* doOtherWork()

  // Later, get result
  const result = yield* Fiber.join(fiber)
  return result
})
```

### Effect.forkDaemon — Survives Parent

```typescript
const program = Effect.gen(function* () {
  // This fiber continues even if parent completes
  yield* Effect.forkDaemon(backgroundSync)

  // Parent can exit, daemon keeps running
  return "done"
})
```

### Effect.forkScoped — Tied to Scope

```typescript
const program = Effect.scoped(
  Effect.gen(function* () {
    // Fiber will be interrupted when scope closes
    const fiber = yield* Effect.forkScoped(periodicTask)

    yield* doWork()
    // Scope closes here, fiber interrupted automatically
  })
)
```

### Effect.forkAll — Fork Multiple

```typescript
const tasks = [task1, task2, task3]

const fibers = yield* Effect.forkAll(tasks)
// Array of fibers, all running concurrently
```

### Parallel Execution Patterns

```typescript
// Run all, collect results
const results = yield* Effect.all(tasks, { concurrency: "unbounded" })

// Run with limited concurrency
const results = yield* Effect.all(tasks, { concurrency: 5 })

// Race — first to complete wins
const winner = yield* Effect.race(task1, task2)

// Race with collection
const fastest = yield* Effect.raceAll(tasks)
```

---

## [EFFECT:FIBER:JOIN] — Awaiting Fibers

### Fiber.join — Wait for Result

```typescript
const fiber = yield* Effect.fork(computeResult)

// ... do other work ...

// Wait and get result (or error)
const result = yield* Fiber.join(fiber)
```

### Fiber.await — Get Exit Status

```typescript
const fiber = yield* Effect.fork(task)

const exit = yield* Fiber.await(fiber)
// Exit<A, E> — either Success<A> or Failure<E>

if (Exit.isSuccess(exit)) {
  console.log("Result:", exit.value)
} else {
  console.log("Failed:", exit.cause)
}
```

### Fiber.poll — Non-blocking Check

```typescript
const fiber = yield* Effect.fork(task)

// Check without blocking
const status = yield* Fiber.poll(fiber)
// Option<Exit<A, E>> — None if still running
```

### Join with Timeout

```typescript
const result = yield* Fiber.join(fiber).pipe(
  Effect.timeout("5 seconds"),
  Effect.orElseSucceed(() => "timed out")
)
```

---

## [EFFECT:FIBER:INTERRUPT] — Cancellation

### Fiber.interrupt — Cancel a Fiber

```typescript
const fiber = yield* Effect.fork(longTask)

// Cancel it
yield* Fiber.interrupt(fiber)
```

### Fiber.interruptFork — Fire-and-forget Interrupt

```typescript
// Don't wait for interruption to complete
yield* Fiber.interruptFork(fiber)
```

### Interruptibility Regions

```typescript
// Make a region interruptible
const interruptible = Effect.interruptible(task)

// Make a region uninterruptible (critical section)
const critical = Effect.uninterruptible(criticalSection)

// Check if currently interruptible
const status = yield* Effect.checkInterruptible((isInterruptible) =>
  isInterruptible
    ? Effect.log("Can be interrupted")
    : Effect.log("Protected region")
)
```

### Pattern: Graceful Shutdown

```typescript
const gracefulShutdown = Effect.gen(function* () {
  const fiber = yield* Effect.fork(server)

  // Wait for shutdown signal
  yield* waitForSignal

  // Gracefully interrupt
  yield* Fiber.interrupt(fiber)

  // Cleanup
  yield* cleanup()
})
```

### Pattern: Timeout with Cleanup

```typescript
const withTimeout = Effect.gen(function* () {
  const fiber = yield* Effect.fork(task)

  const result = yield* Fiber.join(fiber).pipe(
    Effect.timeout("10 seconds")
  )

  if (Option.isNone(result)) {
    // Timed out — interrupt and cleanup
    yield* Fiber.interrupt(fiber)
    return yield* Effect.fail(new TimeoutError({}))
  }

  return result.value
})
```

---

## Structured Concurrency Patterns

### Worker Pool

```typescript
const workerPool = <A, E, R>(
  tasks: Effect.Effect<A, E, R>[],
  concurrency: number
): Effect.Effect<A[], E, R> =>
  Effect.all(tasks, { concurrency })
```

### Producer-Consumer with Queue

```typescript
import { Queue } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<Task>(100)

  // Producer
  const producer = Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        const task = yield* getNextTask()
        yield* Queue.offer(queue, task)
      })
    )
  )

  // Consumer pool
  const consumers = yield* Effect.forkAll(
    Array.from({ length: 5 }, () =>
      Effect.forever(
        Effect.gen(function* () {
          const task = yield* Queue.take(queue)
          yield* processTask(task)
        })
      )
    )
  )

  // ...
})
```

### Supervised Restart

```typescript
const supervised = Effect.gen(function* () {
  yield* Effect.forever(
    task.pipe(
      Effect.catchAll((error) =>
        Effect.log(`Task failed: ${error}, restarting...`)
      )
    )
  )
})
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Unjoined forks | Ghost fibers, leaks | Always join or use `forkScoped` |
| `forkDaemon` for short tasks | Orphan fibers | Use `fork` or `forkScoped` |
| Blocking in fiber | Starves other fibers | Use Effect primitives |
| Manual interrupt without wait | Race conditions | Use `Fiber.interrupt` (waits) |
| Infinite loop without yield | Fiber starvation | Add `Effect.yieldNow()` |

---

## Quick Reference

```typescript
// Fork
const fiber = yield* Effect.fork(task)

// Fork daemon (outlives parent)
yield* Effect.forkDaemon(background)

// Fork scoped (dies with scope)
yield* Effect.forkScoped(scoped)

// Join (wait for result)
const result = yield* Fiber.join(fiber)

// Interrupt (cancel)
yield* Fiber.interrupt(fiber)

// Parallel execution
yield* Effect.all([a, b, c], { concurrency: "unbounded" })

// Race
yield* Effect.race(fast, slow)
```
