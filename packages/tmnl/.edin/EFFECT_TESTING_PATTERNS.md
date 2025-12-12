# Effect Testing Patterns with @effect/vitest

**EPOCH-0003: Canonical Effect Testing Patterns**

Comprehensive guide to testing Effect-based code using `@effect/vitest`, covering basic patterns, service testing, layer composition, stream testing, and mocking strategies.

---

## Table of Contents

1. [Basic Setup](#basic-setup)
2. [Using it.effect()](#using-iteffect)
3. [Providing Layers and Services](#providing-layers-and-services)
4. [Testing Streams](#testing-streams)
5. [Testing with TestClock](#testing-with-testclock)
6. [Mocking Services](#mocking-services)
7. [Test Organization](#test-organization)
8. [Project-Specific Patterns](#project-specific-patterns)
9. [Anti-Patterns](#anti-patterns)

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

`@effect/vitest` provides specialized assertion utilities:

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

## Using it.effect()

### Basic Pattern

The `it.effect()` function allows tests to return an Effect instead of a Promise:

```typescript
import { describe, it } from '@effect/vitest'
import { strictEqual } from '@effect/vitest/utils'
import { Effect } from 'effect'

describe('My Effect tests', () => {
  it.effect('should run an Effect and assert the result', () =>
    Effect.gen(function* () {
      const result = yield* Effect.succeed('Hello, World!')
      strictEqual(result, 'Hello, World!')
    })
  )
})
```

**Key differences from `it()`:**

- Returns `Effect<void>` instead of `Promise<void>`
- Automatic error handling (failures become test failures)
- No need for `Effect.runPromise()` wrapper

### Testing Failures

Use `Effect.flip` to move errors into the success channel:

```typescript
it.effect('should handle errors in Effect', () =>
  Effect.gen(function* () {
    const errorEffect = Effect.fail('An error occurred')

    // Flip error channel to success channel
    const error = yield* Effect.flip(errorEffect)

    strictEqual(error, 'An error occurred')
  })
)
```

### Testing with Exit

For more complex error testing, use `Effect.exit`:

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

### Service Definition

```typescript
import { Context, Effect, Layer } from 'effect'

class Database extends Context.Tag('Database')<
  Database,
  { readonly query: (sql: string) => Effect.Effect<unknown[]> }
>() {}

class UserService extends Effect.Service<UserService>()('UserService', {
  dependencies: [Database.Default],
  scoped: Effect.gen(function* () {
    const db = yield* Database

    const getAll = db.query('SELECT * FROM users')

    return { getAll } as const
  }),
}) {}
```

### Providing Services with Effect.provide

```typescript
it.effect('correctly wires dependencies', () =>
  Effect.gen(function* () {
    const users = yield* UserService
    const result = yield* users.getAll

    // Assertions...
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

### Providing Single Service with Effect.provideService

For simple cases without layers:

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

Compose multiple layers with dependencies:

```typescript
// Layer composition for tests
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
    // Assertions...
  }).pipe(Effect.provide(TestLayer))
)
```

### it.scoped for Scoped Effects

Use `it.scoped` when testing scoped resources:

```typescript
it.scoped('manages scoped resources', () =>
  Effect.gen(function* () {
    const resource = yield* Effect.acquireRelease(
      Effect.sync(() => ({ id: 'resource-1' })),
      (res) => Effect.log(`Releasing ${res.id}`)
    )

    // Use resource...
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

### Testing Stream Errors

```typescript
it.effect('handles stream errors', () =>
  Effect.gen(function* () {
    const error = new Error('Stream error')
    const result = yield* pipe(
      Stream.async<number>((emit) => {
        emit.fromEffect(Effect.fail(error))
        return Effect.void
      }),
      Stream.runCollect,
      Effect.exit
    )

    deepStrictEqual(result, Exit.fail(error))
  })
)
```

### Testing Long-Running Streams

Use `Fiber.fork` and `Fiber.interrupt` for long-running streams:

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

### Basic TestClock Usage

`TestClock` allows testing time-dependent code without waiting:

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

    // Advance time by 1 minute
    yield* TestClock.adjust('1 minute')

    const result = yield* Fiber.join(fiber)
    assertTrue(Option.isNone(result)) // Timed out
  }).pipe(Effect.provide(TestContext.TestContext))
)
```

**CRITICAL**: Always provide `TestContext.TestContext` when using `TestClock`.

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

    // No effect before recurrence period
    const beforeAdjust = yield* Queue.poll(queue).pipe(
      Effect.andThen(Option.isNone)
    )

    // Advance time
    yield* TestClock.adjust('60 minutes')

    // Effect should have occurred
    const afterAdjust = yield* Queue.take(queue).pipe(Effect.as(true))

    // Only one occurrence
    const noExtra = yield* Queue.poll(queue).pipe(Effect.andThen(Option.isNone))

    assertTrue(beforeAdjust && afterAdjust && noExtra)
  }).pipe(Effect.provide(TestContext.TestContext))
)
```

### Testing Deferred with TestClock

```typescript
it.effect('simulates delayed execution', () =>
  Effect.gen(function* () {
    const deferred = yield* Deferred.make<number, void>()

    yield* Effect.all(
      [Effect.sleep('10 seconds'), Deferred.succeed(deferred, 1)],
      { concurrency: 'unbounded' }
    ).pipe(Effect.fork)

    yield* TestClock.adjust('10 seconds')

    const value = yield* Deferred.await(deferred)
    strictEqual(value, 1)
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

Canonical pattern from `@effect/platform`:

```typescript
import { FileSystem } from '@effect/platform'

const MockFileSystem = FileSystem.layerNoop({
  readFileString: () => Effect.succeed('mocked content'),
  exists: (path) => Effect.succeed(path === '/some/path'),
  writeFile: (path, data) => Effect.void,
})

it.effect('mocks file system', () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const exists = yield* fs.exists('/some/path')
    assertTrue(exists)

    const content = yield* fs.readFileString('/some/path')
    strictEqual(content, 'mocked content')
  }).pipe(Effect.provide(MockFileSystem))
)
```

### Pattern 4: Test-Specific Service Implementations

```typescript
class Logger extends Effect.Service<Logger>()('Logger', {
  accessors: true,
  effect: Effect.succeed({
    info: (message: string) => Effect.log(`INFO: ${message}`),
  }),
}) {
  // Test layer with no-op logger
  static Test = Layer.succeed(this, {
    info: () => Effect.void,
  })
}

it.effect('uses test logger', () =>
  Effect.gen(function* () {
    yield* Logger.info('This will not log')
    // Test assertions...
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

### Pattern 1: Shared Test Layers

Extract common test layers into separate files:

```typescript
// __tests__/test-layers.ts
export const SqliteTestLayer = Layer.succeed(
  SqlClient.SqlClient,
  SqlClient.make({
    // SQLite in-memory config
  })
)

export const RepositoriesLayer = AllRepositoriesLive.pipe(
  Layer.provide(SqliteTestLayer)
)

export const TestLayer = AssetStateSQLLayer.pipe(
  Layer.provide(RepositoriesLayer),
  Layer.provide(SqliteTestLayer),
  Layer.provideMerge(RepositoriesLayer)
)
```

**Key Pattern**: `Layer.provideMerge` exports both provider and consumer outputs.

### Pattern 2: Test Helper Functions

Create reusable test helpers:

```typescript
// __tests__/helpers.ts
export const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)))

// Usage in tests
test('creates asset', async () => {
  await runTest(
    Effect.gen(function* () {
      const state = yield* AssetState
      const asset = yield* state.create({ /* ... */ })
      expect(asset.id).toMatch(/^asset-/)
    })
  )
})
```

### Pattern 3: Test Fixtures

Define shared test data:

```typescript
// __tests__/fixtures.ts
export const testSiteId = 'site-test-001' as SiteId
export const testUserId = 'user-test-001' as IdentityId

export const createTestSite = Effect.gen(function* () {
  const siteRepo = yield* SiteRepository
  yield* siteRepo.insert(
    SiteModel.insert.make({
      id: testSiteId,
      bfoClass: 'site',
      name: 'Test Site',
    })
  )
})
```

### Pattern 4: describe/it Structure

```typescript
describe('AssetState', () => {
  describe('Commands', () => {
    it.effect('create: creates asset in database', () => /* ... */)
    it.effect('update: updates asset in database', () => /* ... */)
    it.effect('update: rejects version conflict', () => /* ... */)
  })

  describe('Queries', () => {
    it.effect('findById: returns asset when exists', () => /* ... */)
    it.effect('findById: returns None when not found', () => /* ... */)
  })
})
```

---

## Project-Specific Patterns

### Bun Test Integration (TMNL-Specific)

For tests that must use `bun:test` (e.g., SQLite integration):

```typescript
import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'

const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)))

test('creates asset in database', async () => {
  await runTest(
    Effect.gen(function* () {
      const state = yield* AssetState
      const asset = yield* state.create({ /* ... */ })
      expect(asset.id).toMatch(/^asset-/)
    })
  )
})
```

**When to use `bun:test` vs `@effect/vitest`:**

- **Use `@effect/vitest`**: Service logic, Effect pipelines, stream processing
- **Use `bun:test`**: SQLite integration tests, native Bun APIs, performance-critical tests

### EventLog Testing

```typescript
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'

describe('Asset Event Payloads', () => {
  it('AssetCreatedPayload creates valid payload', () => {
    const payload = new AssetCreatedPayload({
      assetId: testAssetId,
      siteId: testSiteId,
      kind: testKind,
      label: testLabel,
      status: 'available',
      createdBy: testIdentity,
      createdAt: testNow,
    })

    expect(payload.assetId).toBe(testAssetId)
    expect(payload._tag).toBe('AssetCreated')
  })
})
```

### Testing with Schema Validation

```typescript
import { Schema } from 'effect'

it.effect('validates against schema', () =>
  Effect.gen(function* () {
    const result = yield* Schema.decodeUnknown(AssetSchema)({
      id: 'asset-001',
      siteId: 'site-001',
      kind: 'EQUIPMENT',
      label: 'Test Asset',
    })

    expect(result.id).toBe('asset-001')
  })
)
```

---

## Anti-Patterns

### DON'T: Use regular `it()` for Effect tests

```typescript
// WRONG - loses Effect error handling
it('test', async () => {
  const result = await Effect.runPromise(myEffect)
  expect(result).toBe(42)
})

// CORRECT - use it.effect()
it.effect('test', () =>
  Effect.gen(function* () {
    const result = yield* myEffect
    strictEqual(result, 42)
  })
)
```

### DON'T: Mix `vitest` and `@effect/vitest` imports

```typescript
// WRONG
import { it } from 'vitest'
import { Effect } from 'effect'

// CORRECT
import { it } from '@effect/vitest'
import { Effect } from 'effect'
```

### DON'T: Forget to provide layers

```typescript
// WRONG - will fail with missing context error
it.effect('test', () =>
  Effect.gen(function* () {
    const db = yield* Database
    // Error: Service not found
  })
)

// CORRECT
it.effect('test', () =>
  Effect.gen(function* () {
    const db = yield* Database
    // Works
  }).pipe(Effect.provide(Database.Default))
)
```

### DON'T: Test actual time delays

```typescript
// WRONG - slow tests
it.effect('waits 10 seconds', () =>
  Effect.gen(function* () {
    yield* Effect.sleep('10 seconds') // Actually waits 10s!
    // ...
  })
)

// CORRECT - use TestClock
it.effect('waits 10 seconds', () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.sleep('10 seconds').pipe(Effect.fork)
    yield* TestClock.adjust('10 seconds')
    yield* Fiber.join(fiber)
    // Instant test
  }).pipe(Effect.provide(TestContext.TestContext))
)
```

### DON'T: Ignore stream backpressure

```typescript
// WRONG - may cause race conditions
it.effect('processes stream', () =>
  Effect.gen(function* () {
    const result = yield* Stream.fromIterable(largeArray).pipe(
      Stream.map(process),
      Stream.runCollect
    )
    // May exhaust memory
  })
)

// CORRECT - use bounded buffers
it.effect('processes stream', () =>
  Effect.gen(function* () {
    const result = yield* Stream.fromIterable(largeArray).pipe(
      Stream.buffer({ capacity: 16 }),
      Stream.map(process),
      Stream.runCollect
    )
  })
)
```

---

## Quick Reference

### Test Function Variants

| Function      | Use Case                                      |
| ------------- | --------------------------------------------- |
| `it.effect`   | Standard Effect test (auto-provides context)  |
| `it.scoped`   | Scoped resources (auto-releases on test end)  |
| `it.live`     | Live services (no TestContext)                |
| `it.layer`    | Test with specific layer                      |
| `it.skip`     | Skip test                                     |
| `it.only`     | Run only this test                            |

### Assertion Functions

| Function            | Use Case                         |
| ------------------- | -------------------------------- |
| `strictEqual`       | Primitive equality (`===`)       |
| `deepStrictEqual`   | Deep object/array equality       |
| `assertTrue`        | Assert value is `true`           |
| `assertFalse`       | Assert value is `false`          |
| `assertLeft`        | Assert Either is Left            |
| `assertRight`       | Assert Either is Right           |
| `assertInstanceOf`  | Assert instance type             |

### Layer Composition

| Function              | Use Case                                      |
| --------------------- | --------------------------------------------- |
| `Layer.succeed`       | Create layer from value                       |
| `Layer.effect`        | Create layer from Effect                      |
| `Layer.mergeAll`      | Merge multiple layers (parallel)              |
| `Layer.provide`       | Provide dependencies to layer                 |
| `Layer.provideMerge`  | Provide deps + export both layers             |

---

## Resources

- **Effect Docs (MCP)**: Use `effect_docs_search` tool for authoritative docs
- **Submodule Tests**: `/submodules/effect/packages/*/test/*.test.ts`
- **Official Guide**: Effect website → Testing section
- **@effect/vitest README**: Package documentation

---

**VERSION**: 1.0.0
**LAST UPDATED**: 2025-12-12
**AUTHOR**: Val (TMNL AG-Grid Integration Architect)
