---
name: effect-v4-services
description: Effect v4 Service patterns — Context.Service, Layer composition, ManagedRuntime, dependency injection, and service testing with @effect/vitest.
governed-by: metaskill
---

# Effect v4 Context.Service — Canonical Reference

> up: none
> prereqs: none
> provides: services, layers, dependency-injection, managed-runtime, testing
> children: CHANGELOG.md
> governed-by: metaskill
>
> Source of truth: `submodules/effect-smol/packages/effect/src/Context.ts`
> Migration guide: `submodules/effect-smol/MIGRATION.md`

## Import

```ts
import { Context, Effect, Layer, ManagedRuntime } from "effect"
```

## When to Load

- Defining an Effect service (dependency injection)
- Creating Layers (wiring services)
- Composing layers (provide, merge, provideMerge)
- Running programs with ManagedRuntime
- Testing services with @effect/vitest

## Defining Services

### Class-style (canonical pattern in v4)

```ts
class Database extends Context.Service<Database, {
  readonly query: (sql: string) => Effect.Effect<Array<unknown>, DatabaseError>
}>()(
  "myapp/db/Database"
) {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function*() {
      const query = Effect.fn("Database.query")(function*(sql: string) {
        yield* Effect.log("Executing:", sql)
        return [{ id: 1, name: "Alice" }]
      })
      return Database.of({ query })
    })
  )
}
```

### Class-style with inline make + dependencies

```ts
class Database extends Context.Service<Database, {
  readonly query: (sql: string) => Effect.Effect<Array<unknown>, DatabaseError>
}>()(
  "myapp/db/Database",
  {
    make: Effect.gen(function*() {
      const pool = yield* ConnectionPool
      return {
        query: Effect.fn("Database.query")(function*(sql: string) {
          const conn = yield* pool.acquire()
          return yield* conn.execute(sql)
        })
      }
    })
  }
) {}
```

### Function-style (simple, no class)

```ts
const Database = Context.Service<{
  query: (sql: string) => Effect.Effect<Array<unknown>>
}>("myapp/Database")
```

## Key Differences from v3

| v3 | v4 |
|---|---|
| `class Foo extends Context.Tag("Foo")<Foo, Shape>() {}` | `class Foo extends Context.Service<Foo, Shape>()("Foo") {}` |
| `class Foo extends Effect.Service<Foo>()("Foo", { ... })` | `class Foo extends Context.Service<Foo, Shape>()("Foo", { make: ... }) {}` |
| Auto-generated `.Default` layer | No auto `.Default`. Define `.layer` manually. |
| `Effect.Service` with `scoped` + `dependencies` | `Context.Service` with `make`. Use `Layer.provide` for deps. |
| `Context.Tag` as marker | `Context.Service` IS the tag/key |
| `Runtime<R>` type | REMOVED. Use `Context<R>` directly |
| `Effect.provideService(Tag, impl)` | `Effect.provide(Layer.succeed(Tag)(impl))` |
| `Layer.scoped` | `Layer.effect` (scoped semantics folded in) |
| `Layer.scopedDiscard` | `Layer.effectDiscard` |
| `ServiceMap.*` (beta.23) | `Context.*` (renamed in beta.44) |
| `fiber.services` | `fiber.context` (renamed in beta.44) |

## Creating Layers

```ts
// Effectful construction (replaces Layer.scoped from v3)
const layer = Layer.effect(
  Database,
  Effect.gen(function*() {
    return Database.of({ query: ... })
  })
)

// Synchronous construction
const layer = Layer.sync(Database, () =>
  Database.of({ query: ... })
)

// Simple value
const layer = Layer.succeed(Database)({
  query: (sql) => Effect.succeed([])
})

// Multiple services from one effect (replaces Layer.effectServices)
const layer = Layer.effectContext(
  Effect.gen(function*() {
    const impl = { query: ... }
    return Context.make(Database, impl)
  })
)

// Lazy layer (evaluated once, shared)
const layer = Layer.suspend(() => conditionalLayer)
```

## Composing Layers

```ts
// provide: feeds deps, consumes them
const AppLayer = DatabaseLive.pipe(
  Layer.provide(ConnectionPoolLive)
)

// provideMerge: feeds deps AND keeps them in output
const FullLayer = DatabaseLive.pipe(
  Layer.provideMerge(ConnectionPoolLive)
)

// mergeAll: combine independent layers
const InfraLayer = Layer.mergeAll(
  Database.layer,
  Cache.layer,
  Logger.layer
)
```

## Consuming Services

```ts
// yield* in Effect.gen (most common)
const program = Effect.gen(function*() {
  const db = yield* Database
  const cache = yield* Cache
  return yield* db.query("SELECT 1")
})

// Provide and run
Effect.runPromise(
  program.pipe(Effect.provide(AppLayer))
)

// Effect.runSyncWith for synchronous with services
const result = Effect.runSyncWith(services)(program)

// Effect.runForkWith for forking with services
const fiber = Effect.runForkWith(services)(program)
```

## Context Data Structure

```ts
// Create
const ctx = Context.make(Database, dbImpl)

// Add more services
const ctx2 = Context.add(ctx, Cache, cacheImpl)

// Access (unsafe)
const db = Context.getUnsafe(ctx, Database)

// Merge
const combined = Context.merge(ctx1, ctx2)

// Check
Context.isContext(value)
```

## ManagedRuntime

```ts
import { ManagedRuntime } from "effect"

// Build a runtime from layers (for app edge / extension entry)
const runtime = ManagedRuntime.make(AppLayer)

// Run programs
await runtime.runPromise(program)

// Dispose (runs finalizers)
await runtime.dispose()
```

## Service Naming Convention

Use package + path for uniqueness:
```ts
"@tmnl/stx/StxFactory"
"@tmnl/codemode-metaskill/SkillDiscovery"
"myapp/db/Database"
```

## Testing with @effect/vitest

```ts
import { describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"

describe("Database", () => {
  it.effect("queries successfully", () =>
    Effect.gen(function*() {
      const db = yield* Database
      const rows = yield* db.query("SELECT 1")
      expect(rows).toHaveLength(1)
    }).pipe(
      Effect.provide(Database.layerTest)
    )
  )
})
```
