# KORI — Koota-Oriented Reactive Integration

Effect-TS wrapper integrating ECS patterns with typed errors, reactive streams, and scoped lifecycle management.

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Traits** | Schema-validated data containers (like ECS components) |
| **Entities** | Unique identifiers with attached traits |
| **World** | Container managing all entities and their data |
| **Streams** | Reactive query subscriptions with backpressure |
| **Errors** | Tagged error hierarchy for exhaustive matching |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              KORI Services                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  KoriWorld   │  │  KoriMerge   │  │KoriQueryStream│  │  KoriActor   │   │
│  │              │  │              │  │              │  │              │   │
│  │ spawn()      │  │ merge()      │  │ subscribe()  │  │ spawn()      │   │
│  │ destroy()    │  │ strategies   │  │ Stream<Event>│  │ bind()       │   │
│  │ queryAll()   │  │              │  │              │  │ unbind()     │   │
│  │ addTrait()   │  │              │  │              │  │              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                  │                  │                  │         │
│         └──────────────────┴──────────────────┴──────────────────┘         │
│                                    │                                        │
│                          ┌─────────▼─────────┐                             │
│                          │   KoriBatchQueue  │                             │
│                          │ (mutation buffer) │                             │
│                          └───────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Services

### KoriWorld

The core ECS container. Manages entity lifecycle and trait storage.

```typescript
import { KoriWorld, KoriWorldLive, Effect, Scope } from '@/lib/kori'

const program = Effect.gen(function* () {
  const world = yield* KoriWorld

  // Spawn entity (scoped — auto-cleanup on scope close)
  const entity = yield* world.spawn([
    { id: "Position2D", data: { _tag: "Position2D", x: 0, y: 0 } },
    { id: "Health", data: { _tag: "Health", current: 100, max: 100 } },
  ])

  // Query entities with Health trait
  const healthyEntities = yield* world.queryWith("Health")

  // Update trait
  yield* world.setTrait(entity.id, "Health", {
    _tag: "Health",
    current: 50,
    max: 100,
  })

  // Destroy entity
  yield* world.destroy(entity.id)
}).pipe(
  Effect.scoped,
  Effect.provide(KoriWorldLive)
)
```

**Key Operations:**

| Method | Description | Error Types |
|--------|-------------|-------------|
| `spawn(traits?)` | Create entity with optional traits | Requires `Scope.Scope` |
| `get(entityId)` | Get entity by ID | `EntityNotFound`, `EntityDestroyed` |
| `destroy(entityId)` | Mark entity as destroyed | `EntityNotFound` |
| `queryAll()` | Get all non-destroyed entities | - |
| `queryWith(traitId)` | Get entities with trait | - |
| `queryWithout(traitId)` | Get entities without trait | - |
| `addTrait(entityId, traitId, data)` | Attach trait to entity | `TraitAlreadyAttached` |
| `removeTrait(entityId, traitId)` | Remove trait from entity | `TraitMissing` |
| `getTrait(entityId, traitId)` | Get trait data | `TraitMissing` |
| `setTrait(entityId, traitId, data)` | Update trait data | `TraitMissing` |
| `lock(reason)` | Lock world for modifications | - |
| `unlock()` | Unlock world | - |
| `dispose()` | Dispose world and all entities | - |

### KoriMerge

Trait data merging strategies for conflict resolution.

```typescript
import { KoriMerge, KoriMergeLive, sumMerger, maxMerger } from '@/lib/kori'

const program = Effect.gen(function* () {
  const merge = yield* KoriMerge

  // Configure merger for Health trait
  yield* merge.configure("Health", {
    strategy: "custom",
    merger: (existing, incoming) => ({
      ...incoming,
      current: Math.min(existing.current + incoming.current, incoming.max),
    }),
  })

  // Merge trait data
  const result = yield* merge.merge("Health", existingData, incomingData)
}).pipe(Effect.provide(KoriMergeLive))
```

**Built-in Mergers:**

| Merger | Description |
|--------|-------------|
| `sumMerger` | Add numeric values |
| `maxMerger` | Take maximum value |
| `minMerger` | Take minimum value |
| `concatMerger` | Concatenate arrays |
| `composeMergers(...fns)` | Chain multiple mergers |

### KoriQueryStream

Reactive query subscriptions with automatic updates.

```typescript
import { KoriQueryStream, KoriQueryStreamLive } from '@/lib/kori'

const program = Effect.gen(function* () {
  const stream = yield* KoriQueryStream

  // Subscribe to entities with Health trait
  const subscription = yield* stream.subscribe({
    filter: { with: ["Health"] },
    bufferSize: 100,
  })

  // Consume events
  yield* subscription.stream.pipe(
    Stream.runForEach((event) => {
      switch (event.type) {
        case "added": console.log("Entity added:", event.entity)
        case "updated": console.log("Entity updated:", event.entity)
        case "removed": console.log("Entity removed:", event.entityId)
      }
    })
  )
}).pipe(Effect.provide(KoriQueryStreamLive))
```

### KoriBatchQueue

Batched mutation queue with configurable flush behavior.

```typescript
import { KoriBatchQueue, KoriBatchQueueLive } from '@/lib/kori'

const program = Effect.gen(function* () {
  const queue = yield* KoriBatchQueue

  // Enqueue mutations
  yield* queue.enqueue({ type: "addTrait", entityId, traitId, data })
  yield* queue.enqueue({ type: "setTrait", entityId, traitId, data })

  // Flush all pending mutations
  const result = yield* queue.flush()
  console.log(`Applied ${result.applied} mutations in ${result.durationMs}ms`)
}).pipe(Effect.provide(KoriBatchQueueLive))
```

### KoriActor

XState actor integration for entity behavior.

```typescript
import { KoriActor, KoriActorLive } from '@/lib/kori'

const program = Effect.gen(function* () {
  const actor = yield* KoriActor

  // Spawn actor bound to entity
  const managed = yield* actor.spawn(entityId, {
    machine: myStateMachine,
    context: { entityId },
  })

  // Listen to actor events
  yield* managed.events.pipe(
    Stream.runForEach((event) => {
      console.log("Actor state:", event.state)
    })
  )

  // Send event to actor
  yield* managed.send({ type: "ATTACK" })
}).pipe(Effect.provide(KoriActorLive))
```

## Error Hierarchy

All KORI errors extend `Data.TaggedError` for exhaustive pattern matching:

```typescript
import { Effect, pipe } from 'effect'
import { EntityNotFound, TraitMissing, type KoriError } from '@/lib/kori'

pipe(
  someKoriEffect,
  Effect.catchTag("EntityNotFound", (e) =>
    Effect.succeed(createDefaultEntity(e.entityId))
  ),
  Effect.catchTag("TraitMissing", (e) =>
    Effect.fail(new ApplicationError(`Missing: ${e.traitId}`))
  )
)
```

**Error Categories:**

| Category | Errors |
|----------|--------|
| Entity | `EntityNotFound`, `EntityAlreadyExists`, `EntityDestroyed` |
| Trait | `TraitMissing`, `TraitAlreadyAttached`, `TraitValidationFailed` |
| Query | `QueryEmpty`, `QueryMultipleResults` |
| World | `WorldDisposed`, `WorldLocked` |
| Schema | `SchemaValidationError`, `SchemaTransformError` |
| Stream | `BackpressureExceeded`, `SubscriptionFailed` |
| Actor | `ActorSpawnFailed`, `NodeExecutionFailed`, `GraphCycleDetected` |

## Traits (Schema-Validated Components)

Traits are defined using Effect Schema:

```typescript
import { defineTrait, registerTrait } from '@/lib/kori'
import { Schema } from 'effect'

// Define a trait
const Inventory = defineTrait({
  id: "Inventory",
  schema: Schema.Struct({
    _tag: Schema.Literal("Inventory"),
    items: Schema.Array(Schema.String),
    capacity: Schema.Number,
  }),
  meta: {
    category: "gameplay",
    description: "Entity inventory storage",
  },
})

// Register for runtime validation
registerTrait(Inventory)
```

**Built-in Traits:**

| Trait | Fields |
|-------|--------|
| `Position2D` | `x: number, y: number` |
| `Position3D` | `x: number, y: number, z: number` |
| `Velocity2D` | `dx: number, dy: number` |
| `Velocity3D` | `dx: number, dy: number, dz: number` |
| `Health` | `current: number, max: number` |
| `Name` | `value: string` |
| `Lifetime` | `ttl: number, elapsed: number` |
| `ParentOf` | `childIds: string[]` |
| `ChildOf` | `parentId: string` |

**Tag Traits (markers):**

| Trait | Purpose |
|-------|---------|
| `IsPlayer` | Mark entity as player |
| `IsEnemy` | Mark entity as enemy |
| `IsActive` | Mark entity as active |
| `IsDestroyed` | Mark entity as destroyed |

## Critical Pattern: Persistent Scope for Entity Lifetime

**The Problem:**

`spawn()` uses `Effect.acquireRelease` which requires a `Scope`. When the scope closes, the entity is marked as destroyed. If you use `Effect.scoped`, the scope closes immediately after the effect completes, destroying the entity.

**The Solution:**

Create a persistent scope that never closes during the testbed/application lifetime:

```typescript
import { Effect, Scope, ManagedRuntime, Layer } from 'effect'
import { KoriWorld, KoriWorldLive } from '@/lib/kori'

// 1. Create a persistent scope (module-level singleton)
let persistentScope: Scope.CloseableScope | null = null

const ensurePersistentScope: Effect.Effect<Scope.CloseableScope> = Effect.suspend(() => {
  if (persistentScope) {
    return Effect.succeed(persistentScope)
  }
  return Effect.map(Scope.make(), (scope) => {
    persistentScope = scope
    return scope
  })
})

// 2. Create ManagedRuntime for the KORI layer
const koriManagedRuntime = ManagedRuntime.make(KoriWorldLive)

// 3. Spawn entities with persistent scope
const spawnWithTraits = (traits) =>
  koriManagedRuntime.runPromise(
    Effect.gen(function* () {
      const scope = yield* ensurePersistentScope
      const world = yield* KoriWorld
      const spawned = yield* world.spawn(traits).pipe(
        Effect.provideService(Scope.Scope, scope)
      )
      return spawned
    })
  )
```

**Why This Works:**

1. `ensurePersistentScope` creates a scope once and caches it
2. The scope is provided to `spawn()` via `Effect.provideService`
3. Entity's release function is registered with persistent scope
4. Since the scope never closes, the entity stays alive
5. `destroy()` still works — it marks `isDestroyed = true` directly

## Testbed Usage (stx Pattern)

The KORI testbed uses the `stx` tri-library pattern (XState + Legend-State + effect-atom):

```typescript
import { koriOps, koriRuntimeAtom } from '@/lib/kori/testbed'

// Operations (return Promises, use singleton runtime)
const entities = await koriOps.queryAll()
const entity = await koriOps.spawnWithTraits([
  { id: "Position2D", data: { _tag: "Position2D", x: 0, y: 0 } },
])
await koriOps.destroy(entity.id)

// For React hooks
import { useAtomValue } from '@effect-atom/atom-react'

function EntityList() {
  // Access via koriRuntimeAtom for React integration
  const result = useAtomValue(koriRuntimeAtom.atom(
    Effect.gen(function* () {
      const world = yield* KoriWorld
      return yield* world.queryAll()
    })
  ))
  // ...
}
```

## File Structure

```
src/lib/kori/
├── index.ts              # Public exports
├── KORI.md               # This documentation
├── errors/
│   └── index.ts          # Tagged error hierarchy
├── schemas/
│   ├── index.ts          # Schema exports
│   └── trait.ts          # Trait definitions
├── services/
│   ├── index.ts          # Service exports
│   ├── world.ts          # KoriWorld service
│   ├── merge.ts          # KoriMerge service
│   ├── stream.ts         # KoriQueryStream + KoriBatchQueue
│   └── actor.ts          # KoriActor service
└── __tests__/
    ├── world.test.ts
    ├── merge.test.ts
    ├── stream.test.ts
    ├── actor.test.ts
    ├── trait.test.ts
    ├── error.test.ts
    └── integration.test.ts
```

## Smoking Gun Test

This test proves the persistent scope fix works:

```typescript
import { koriOps } from './kori-testbed-stx'

describe('KORI Entity Persistence', () => {
  it('should persist entities across spawn/query operations', async () => {
    const initialEntities = await koriOps.queryAll()
    const initialCount = initialEntities.length

    // Spawn an entity
    const spawned = await koriOps.spawnWithTraits([
      { id: "Position2D", data: { _tag: "Position2D", x: 42, y: 42 } },
      { id: "Health", data: { _tag: "Health", current: 100, max: 100 } },
    ])

    expect(spawned.id).toBeDefined()

    // Query should include the spawned entity
    const afterSpawn = await koriOps.queryAll()
    expect(afterSpawn.length).toBe(initialCount + 1)

    // Verify the entity has our traits
    const found = afterSpawn.find(e => e.id === spawned.id)
    expect(found).toBeDefined()
    expect(found?.traits.has("Position2D")).toBe(true)
    expect(found?.traits.has("Health")).toBe(true)
  })
})
```

## Dependencies

- `effect` — Core Effect-TS library
- `@effect/schema` — Schema validation
- `xstate` — State machine integration (for actors)
- `nanoid` — Entity ID generation
