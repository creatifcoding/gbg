# Effect Testing Patterns with @effect/vitest

> **Source**: `.edin/EFFECT_TESTING_PATTERNS.md`
> **Last consolidated**: 2026-02-09

## Overview

Comprehensive guide to testing Effect-based code using `@effect/vitest`, covering test function variants, service testing, layer composition, stream testing, TestClock usage, and 5 mocking patterns.

---

## Basic Setup

### Installation

```bash
bun add -d @effect/vitest
```

### Import Structure

```typescript
import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer, Context } from 'effect'
```

**CRITICAL**: Always import test functions from `@effect/vitest`, NOT from `vitest` directly.

### Assertion Helpers

```typescript
import {
  assertTrue,
  assertFalse,
  strictEqual,
  deepStrictEqual,
  assertLeft,
  assertRight,
  assertInstanceOf,
} from '@effect/vitest/utils'
```

---

## Test Function Variants

| Function | Use Case |
|----------|----------|
| `it.effect` | Standard Effect test (auto-provides context) |
| `it.scoped` | Scoped resources (auto-releases on test end) |
| `it.live` | Live services (no TestContext) |
| `it.layer` | Test with specific layer |
| `it.skip` | Skip test |
| `it.only` | Run only this test |

---

## Using it.effect()

### Basic Pattern

```typescript
describe('My Effect tests', () => {
  it.effect('should run an Effect and assert the result', () =>
    Effect.gen(function* () {
      const result = yield* Effect.succeed('Hello, World!')
      strictEqual(result, 'Hello, World!')
    })
  )
})
```

### Testing Failures

Use `Effect.flip` to move errors into the success channel:

```typescript
it.effect('should handle errors in Effect', () =>
  Effect.gen(function* () {
    const errorEffect = Effect.fail('An error occurred')
    const error = yield* Effect.flip(errorEffect)
    strictEqual(error, 'An error occurred')
  })
)
```

### Testing with Exit

```typescript
import { Exit } from 'effect'

it.effect('handles defects', () =>
  Effect.gen(function* () {
    const error = new Error('boom')
    const result = yield* Effect.exit(Effect.die(error))
    deepStrictEqual(result, Exit.die(error))
  })
)
```

---

## Providing Layers and Services

### Effect.provide

```typescript
it.effect('correctly wires dependencies', () =>
  Effect.gen(function* () {
    const users = yield* UserService
    const result = yield* users.getAll
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        UserService.Default,
        Database.Default
      )
    )
  )
)
```

### Effect.provideService (Inline)

```typescript
it.effect('provides service inline', () =>
  Effect.gen(function* () {
    const config = yield* ConfigService
    strictEqual(config.apiUrl, 'https://test.api')
  }).pipe(
    Effect.provideService(ConfigService, {
      apiUrl: 'https://test.api',
      timeout: 5000,
    })
  )
)
```

### Layer Composition

```typescript
const DatabaseLayer = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([{ id: 1, name: 'Test' }])
})

const TestLayer = Layer.mergeAll(
  DatabaseLayer,
  UserService.Default.pipe(Layer.provide(DatabaseLayer))
)

it.effect('uses composed layers', () =>
  Effect.gen(function* () {
    const users = yield* UserService
    const result = yield* users.getAll
  }).pipe(Effect.provide(TestLayer))
)
```

### it.scoped for Scoped Effects

```typescript
it.scoped('manages scoped resources', () =>
  Effect.gen(function* () {
    const resource = yield* Effect.acquireRelease(
      Effect.sync(() => ({ id: 'resource-1' })),
      (res) => Effect.log(`Releasing ${res.id}`)
    )
    // Auto-cleanup on test completion
  })
)
```

---

## Testing Streams

### Basic Stream Testing

```typescript
import { Stream, Chunk } from 'effect'

it.effect('fromChunk creates stream', () =>
  Effect.gen(function* () {
    const chunk = Chunk.fromIterable([1, 2, 3, 4, 5])
    const stream = Stream.fromChunk(chunk)
    const result = yield* Stream.runCollect(stream)
    deepStrictEqual(Array.from(result), [1, 2, 3, 4, 5])
  })
)
```

### Async Stream Testing

```typescript
it.effect('async stream emits values', () =>
  Effect.gen(function* () {
    const array = [1, 2, 3, 4, 5]
    const result = yield* pipe(
      Stream.async<number>((emit) => {
        array.forEach((n) => {
          emit(Effect.succeed(Chunk.of(n)))
        })
      }),
      Stream.take(array.length),
      Stream.runCollect
    )
    deepStrictEqual(Array.from(result), array)
  })
)
```

### Stream with Cleanup

```typescript
it.effect('async - with cleanup', () =>
  Effect.gen(function* () {
    const ref = yield* Ref.make(false)
    const latch = yield* Deferred.make<void>()

    const fiber = yield* pipe(
      Stream.async<void>((emit) => {
        emit.chunk(Chunk.of(void 0))
        return Ref.set(ref, true) // Cleanup action
      }),
      Stream.tap(() => Deferred.succeed(latch, void 0)),
      Stream.runDrain,
      Effect.fork
    )

    yield* Deferred.await(latch)
    yield* Fiber.interrupt(fiber)

    const cleanedUp = yield* Ref.get(ref)
    assertTrue(cleanedUp)
  })
)
```

### Testing Long-Running Streams

```typescript
it.effect('handles infinite stream', () =>
  Effect.gen(function* () {
    const ref = yield* Ref.make(0)

    const fiber = yield* pipe(
      Stream.fromEffect(Ref.update(ref, (n) => n + 1)),
      Stream.repeat(Schedule.spaced('100 millis')),
      Stream.runDrain,
      Effect.fork
    )

    yield* TestClock.adjust('500 millis')
    yield* Fiber.interrupt(fiber)

    const count = yield* Ref.get(ref)
    assertTrue(count >= 5)
  })
)
```

---

## Testing with TestClock

**CRITICAL**: Always provide `TestContext.TestContext` when using `TestClock`.

### Basic TestClock Usage

```typescript
import { TestClock, TestContext } from 'effect'

it.effect('simulates time passage', () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.sleep('5 minutes').pipe(
      Effect.timeoutTo({
        duration: '1 minute',
        onSuccess: Option.some,
        onTimeout: () => Option.none<void>(),
      }),
      Effect.fork
    )

    yield* TestClock.adjust('1 minute')

    const result = yield* Fiber.join(fiber)
    assertTrue(Option.isNone(result))
  }).pipe(Effect.provide(TestContext.TestContext))
)
```

### Testing Recurring Effects

```typescript
it.effect('tests recurring effects', () =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded()

    yield* Queue.offer(queue, undefined).pipe(
      Effect.delay('60 minutes'),
      Effect.forever,
      Effect.fork
    )

    const beforeAdjust = yield* Queue.poll(queue).pipe(
      Effect.andThen(Option.isNone)
    )
    yield* TestClock.adjust('60 minutes')
    const afterAdjust = yield* Queue.take(queue).pipe(Effect.as(true))
    const noExtra = yield* Queue.poll(queue).pipe(Effect.andThen(Option.isNone))

    assertTrue(beforeAdjust && afterAdjust && noExtra)
  }).pipe(Effect.provide(TestContext.TestContext))
)
```

---

## Mocking Services

### Pattern 1: Layer.succeed for Simple Mocks

```typescript
const MockDatabase = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([{ id: 1, name: 'Mock User' }]),
})

it.effect('uses mock database', () =>
  Effect.gen(function* () {
    const db = yield* Database
    const result = yield* db.query('SELECT * FROM users')
    deepStrictEqual(result, [{ id: 1, name: 'Mock User' }])
  }).pipe(Effect.provide(MockDatabase))
)
```

### Pattern 2: Layer.effect for Stateful Mocks

```typescript
const MockDatabaseWithState = Layer.effect(
  Database,
  Effect.gen(function* () {
    const callLog = yield* Ref.make<string[]>([])
    return {
      query: (sql: string) =>
        Effect.gen(function* () {
          yield* Ref.update(callLog, (log) => [...log, sql])
          return [{ id: 1 }]
        }),
      getCallLog: () => Ref.get(callLog),
    } as const
  })
)
```

### Pattern 3: FileSystem.layerNoop for Platform Mocks

```typescript
import { FileSystem } from '@effect/platform'

const MockFileSystem = FileSystem.layerNoop({
  readFileString: () => Effect.succeed('mocked content'),
  exists: (path) => Effect.succeed(path === '/some/path'),
  writeFile: (path, data) => Effect.void,
})
```

### Pattern 4: Test-Specific Service Implementations

```typescript
class Logger extends Effect.Service<Logger>()('Logger', {
  accessors: true,
  effect: Effect.succeed({
    info: (message: string) => Effect.log(`INFO: ${message}`),
  }),
}) {
  static Test = Layer.succeed(this, {
    info: () => Effect.void,
  })
}

it.effect('uses test logger', () =>
  Effect.gen(function* () {
    yield* Logger.info('This will not log')
  }).pipe(Effect.provide(Logger.Test))
)
```

### Pattern 5: Spy/Verification Mocks

```typescript
it.effect('verifies service calls', () =>
  Effect.gen(function* () {
    const calls = yield* Ref.make<string[]>([])

    const SpyLogger = Layer.succeed(Logger, {
      info: (message: string) =>
        Ref.update(calls, (arr) => [...arr, message]),
    })

    yield* Effect.provide(
      Effect.gen(function* () {
        const logger = yield* Logger
        yield* logger.info('message 1')
        yield* logger.info('message 2')
      }),
      SpyLogger
    )

    const logged = yield* Ref.get(calls)
    deepStrictEqual(logged, ['message 1', 'message 2'])
  })
)
```

---

## Test Organization

### Shared Test Layers

```typescript
// __tests__/test-layers.ts
export const SqliteTestLayer = Layer.succeed(
  SqlClient.SqlClient,
  SqlClient.make({ /* SQLite in-memory config */ })
)

export const TestLayer = AssetStateSQLLayer.pipe(
  Layer.provide(RepositoriesLayer),
  Layer.provide(SqliteTestLayer),
  Layer.provideMerge(RepositoriesLayer)
)
```

### Test Helper Functions

```typescript
export const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)))
```

### describe/it Structure

```typescript
describe('AssetState', () => {
  describe('Commands', () => {
    it.effect('create: creates asset in database', () => /* ... */)
    it.effect('update: rejects version conflict', () => /* ... */)
  })

  describe('Queries', () => {
    it.effect('findById: returns asset when exists', () => /* ... */)
    it.effect('findById: returns None when not found', () => /* ... */)
  })
})
```

---

## TMNL-Specific: PubSub + @effect/vitest Incompatibility

`it.effect()` and `it.scoped()` **TIMEOUT** with `PubSub + Stream.fromPubSub + Effect.fork`.

**Root cause**: Fiber scheduling in `it.effect()` wrapper conflicts with forked PubSub subscribers.

**Solution**: Use plain vitest `it()` + `Effect.runPromise` wrapper for PubSub roundtrip tests:

```typescript
import { it as vitestIt } from 'vitest'

vitestIt('PubSub roundtrip works', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<string>()
      const stream = Stream.fromPubSub(pubsub)
      // ... test logic
    }).pipe(Effect.scoped)
  )
})
```

See: `src/lib/iiot/realtime/__tests__/event-distribution.test.ts` for real usage.

---

## Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Regular `it()` for Effect tests | Use `it.effect()` from `@effect/vitest` |
| Mixing `vitest` and `@effect/vitest` imports | Import ALL test functions from `@effect/vitest` |
| Testing actual time delays | Use `TestClock.adjust()` with `TestContext.TestContext` |
| Missing layer provision | Always `.pipe(Effect.provide(TestLayer))` |
| Ignoring stream backpressure | Use `Stream.buffer({ capacity: 16 })` for large streams |
| PubSub in `it.effect()` | Use plain `it()` + `Effect.runPromise` wrapper |

---

## Agent Quick Reference

### Key Imports

```typescript
import { describe, it, expect } from '@effect/vitest'
import { strictEqual, deepStrictEqual, assertTrue } from '@effect/vitest/utils'
import { Effect, Layer, TestClock, TestContext } from 'effect'
```

### Minimal Example

```typescript
it.effect('tests a service', () =>
  Effect.gen(function* () {
    const svc = yield* MyService
    const result = yield* svc.doThing('input')
    expect(result).toBe('expected')
  }).pipe(Effect.provide(MyService.Default))
)
```

### Common Pitfalls

- Importing `it` from `vitest` instead of `@effect/vitest` -- tests won't handle Effect errors properly
- Forgetting `Effect.provide(TestContext.TestContext)` when using `TestClock` -- test hangs
- Using `it.effect()` with PubSub + Effect.fork -- timeouts (use plain `it()` + `Effect.runPromise`)
- Not using `Effect.flip()` to test error paths -- use `Effect.flip` or `Effect.exit`
- Forgetting `Layer.provideMerge` when test needs both provider and consumer outputs

### Cross-References

- [effect-core.md](./effect-core.md) -- foundational Effect patterns
- [effect-services.md](./effect-services.md) -- service definition and mocking
- [effect-sql.md](./effect-sql.md) -- dual test runner setup for SQLite
