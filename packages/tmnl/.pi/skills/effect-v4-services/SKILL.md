---
name: effect-v4-services
description: Effect v4 Service patterns — Context.Service, Layer composition, ManagedRuntime, dependency injection, and service testing with @effect/vitest.
---

# Effect v4 ServiceMap.Service — Canonical Reference

> Source of truth: `submodules/effect-smol/packages/effect/src/ServiceMap.ts`
> Migration guide: `submodules/effect-smol/MIGRATION.md`

## Import

```ts
import { ServiceMap, Effect, Layer } from "effect"
```

## Defining Services

### Function-style (simple, no class)

```ts
const Database = ServiceMap.Service<{
  query: (sql: string) => Effect.Effect<Array<unknown>>
}>("myapp/Database")

// Usage
const program = Effect.gen(function*() {
  const db = yield* Database
  return yield* db.query("SELECT * FROM users")
})
```

### Class-style (with make)

```ts
class Database extends ServiceMap.Service<Database, {
  readonly query: (sql: string) => Effect.Effect<Array<unknown>, DatabaseError>
}>()(
  "myapp/db/Database"
) {}

// Create layer
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function*() {
    const query = Effect.fn("Database.query")(function*(sql: string) {
      yield* Effect.log("Executing:", sql)
      return [{ id: 1, name: "Alice" }]
    })
    return Database.of({ query })
  })
)
```

### Class-style with inline make

```ts
class Database extends ServiceMap.Service<Database, {
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

// When make is defined, layer can be created from it:
static readonly layer = Layer.effect(Database, Database.make).pipe(
  Layer.provide(ConnectionPool.layer)
)
```

## Key Differences from v3

| v3 | v4 |
|---|---|
| `class Foo extends Context.Tag("Foo")<Foo, Shape>() {}` | `class Foo extends ServiceMap.Service<Foo, Shape>()("Foo") {}` |
| `class Foo extends Effect.Service<Foo>()("Foo", { ... })` | `class Foo extends ServiceMap.Service<Foo, Shape>()("Foo", { make: ... }) {}` |
| Auto-generated `.Default` layer | No auto `.Default`. Define `.layer` manually. |
| `Effect.Service` with `scoped` + `dependencies` | `ServiceMap.Service` with `make`. Use `Layer.provide` for deps. |
| `Context.Tag` as marker | `ServiceMap.Service` IS the tag/key |
| `Runtime<R>` type | REMOVED. Use `ServiceMap<R>` |
| `Effect.provideService(Tag, impl)` | `Effect.provide(Layer.succeed(Tag)(impl))` or `Effect.provide(Tag.serviceMap(impl))` |

## Creating Layers

```ts
// Effectful construction
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

// Dynamic (choose at runtime)
const layer = Layer.unwrap(
  Effect.gen(function*() {
    const config = yield* Config.boolean("USE_MOCK")
    return config ? Database.layerMock : Database.layerLive
  })
)
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
// yield* in Effect.gen
const program = Effect.gen(function*() {
  const db = yield* Database
  const cache = yield* Cache
  // ...
})

// .use() method
Database.use((db) => db.query("SELECT 1"))

// .useSync() method
Database.useSync((db) => db.someValue)

// Provide and run
Effect.runPromise(
  program.pipe(Effect.provide(AppLayer))
)

// Effect.runSyncWith for synchronous execution with services
const result = Effect.runSyncWith(services)(program)

// Effect.runForkWith for forking with services
const fiber = Effect.runForkWith(services)(program)
```

## ServiceMap Data Structure

```ts
// Create
const map = ServiceMap.make(Database, dbImpl)

// Combine
const combined = ServiceMap.merge(map1, map2)

// Access
const db = ServiceMap.get(map, Database)

// Check
ServiceMap.isServiceMap(value)
ServiceMap.isKey(Database)  // true
```

## ManagedRuntime (still exists in v4)

```ts
import { ManagedRuntime } from "effect"

const runtime = ManagedRuntime.make(AppLayer)
await runtime.runPromise(program)
await runtime.dispose()
```

## Service Naming Convention

Use package + path for uniqueness:
```ts
"@tmnl/stx/StxFactory"
"@tmnl/stx/FermionRegistry"
"myapp/db/Database"
```

## Layer Naming Convention

```ts
// v3: .Default, .Live, .Test
// v4: .layer, .layerTest, .layerDev

class Database extends ServiceMap.Service<...>()("Database") {
  static readonly layer = Layer.effect(this, this.make)
  static readonly layerTest = Layer.succeed(this)({ ... })
}
```
