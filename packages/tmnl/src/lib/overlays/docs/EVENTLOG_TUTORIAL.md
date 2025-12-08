# EventLog Ecosystem — Architectural Tutorial

**Author**: Val
**Status**: Reference Document
**Date**: 2025-12-03

---

## Executive Summary

Effect's `@effect/experimental` EventLog is an **event-sourced state management system** with:

- **Schema-backed events** — Full encode/decode, validation, MsgPack serialization
- **Journal persistence** — Memory or IndexedDB storage
- **Conflict detection** — CRDT-style concurrent write handling
- **Reactive queries** — Auto-invalidating streams tied to event writes
- **Remote sync** — Encrypted WebSocket synchronization
- **Compaction** — Event log compression for storage efficiency

It is **not** a simple pub/sub system. It's a complete event-sourcing framework where:

1. Events are the **source of truth**
2. State is **derived** by replaying events through handlers
3. Persistence is **automatic** via the journal
4. Reactivity is **built-in** via invalidation keys

---

## Part 1: Core Concepts

### 1.1 The Event Sourcing Model

Traditional state management:
```
User Action → Mutate State → (maybe) Persist
```

Event sourcing:
```
User Action → Write Event → Journal Persists → Handler Updates State
                                ↑
                        (Replay on startup)
```

**Key insight**: The event log IS the database. State is just a cached projection.

### 1.2 Why Event Sourcing?

| Benefit | Description |
|---------|-------------|
| **Audit trail** | Every change is recorded with timestamp |
| **Time travel** | Replay to any point in history |
| **Debugging** | Reproduce bugs by replaying event sequence |
| **Undo/Redo** | Events are reversible operations |
| **Sync** | Events are the sync primitive, not state |
| **Conflict resolution** | Concurrent events are explicitly handled |

### 1.3 The Effect EventLog Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Layer                            │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  EventLog.makeClient(schema)                                     ││
│  │  write("UserCreated", { id: "u1", name: "Alice" })              ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EventLog Service                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │
│  │   write()   │  │  Registry   │  │     Reactivity.invalidate   │ │
│  │             │──▶│  (handlers) │──▶│     (notify subscribers)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  EventJournal.write({ event, primaryKey, payload, effect })     ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EventJournal                                 │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Persistence Layer (Memory / IndexedDB)                         ││
│  │                                                                  ││
│  │  Entry { id: UUID v7, event: string, primaryKey, payload }      ││
│  │  Entry { id: UUID v7, event: string, primaryKey, payload }      ││
│  │  Entry { id: UUID v7, event: string, primaryKey, payload }      ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  PubSub<Entry> (changes stream for remote sync)                 ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EventLogRemote (Optional)                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  WebSocket ←→ EventLogServer                                    ││
│  │  Encrypted sync via AES-GCM                                     ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Building Blocks

### 2.1 Event — The Atomic Unit

An `Event` defines a single domain event with Schema-backed types:

```typescript
import { Event } from "@effect/experimental"
import { Schema } from "effect"

const UserCreated = Event.make({
  // Unique tag for this event type (discriminator)
  tag: "UserCreated",

  // Function to extract primary key from payload
  // Used for conflict detection and compaction
  primaryKey: (payload) => payload.id,

  // Schema for the event payload (required)
  payload: Schema.Struct({
    id: Schema.String,
    name: Schema.NonEmptyString,
    email: Schema.String,
    createdAt: Schema.DateFromNumber,
  }),

  // Schema for successful handler result (optional, defaults to Void)
  success: Schema.Struct({
    userId: Schema.String,
  }),

  // Schema for handler errors (optional, defaults to Never)
  error: Schema.String,
})
```

**Key properties of Event.make():**

| Property | Type | Purpose |
|----------|------|---------|
| `tag` | `string` | Discriminator for pattern matching |
| `primaryKey` | `(payload) => string` | Entity identity for conflict detection |
| `payload` | `Schema` | Event data, MsgPack serialized |
| `success` | `Schema` | Handler return type |
| `error` | `Schema` | Handler failure type |

### 2.2 EventGroup — Domain Aggregation

An `EventGroup` collects related events into a domain module:

```typescript
import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"

// Start with empty group
const UserEvents = EventGroup.empty
  // Add events via fluent API
  .add({
    tag: "UserCreated",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({
      id: Schema.String,
      name: Schema.NonEmptyString,
      email: Schema.String,
    }),
  })
  .add({
    tag: "UserUpdated",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({
      id: Schema.String,
      name: Schema.optional(Schema.NonEmptyString),
      email: Schema.optional(Schema.String),
    }),
  })
  .add({
    tag: "UserDeleted",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({
      id: Schema.String,
      deletedAt: Schema.DateFromNumber,
    }),
  })
  // Add common error type to all events
  .addError(Schema.Struct({
    code: Schema.String,
    message: Schema.String,
  }))
```

**Why group events?**

1. **Domain boundaries** — One group per aggregate/domain
2. **Handler registration** — `EventLog.group()` operates on groups
3. **Reactivity scoping** — `groupReactivity()` binds invalidation keys
4. **Type inference** — TypeScript infers union of all event types

### 2.3 EventLogSchema — Application Schema

Combine multiple groups into an application schema:

```typescript
import { EventLog } from "@effect/experimental"

// Combine all domain groups
const AppSchema = EventLog.schema(
  UserEvents,
  OrderEvents,
  InventoryEvents,
  NotificationEvents,
)

// The schema is used for:
// 1. Type-safe event writing
// 2. Handler registration validation
// 3. Remote sync protocol
```

### 2.4 Entry — The Journal Record

Each event write creates an `Entry` in the journal:

```typescript
class Entry {
  // UUID v7 — time-ordered, globally unique
  readonly id: EntryId  // Uint8Array (16 bytes)

  // Event tag (e.g., "UserCreated")
  readonly event: string

  // Primary key for conflict detection
  readonly primaryKey: string

  // MsgPack-encoded payload
  readonly payload: Uint8Array

  // Derived properties
  get idString(): string        // UUID as string
  get createdAtMillis(): number // Timestamp from UUID v7
  get createdAt(): DateTime.Utc // Effect DateTime
}
```

**UUID v7 is critical**: It provides:
- **Time ordering** — Entries sort chronologically by ID
- **Global uniqueness** — No coordination needed across clients
- **Conflict detection** — Compare IDs to find concurrent writes

### 2.5 EventJournal — Persistence Layer

The journal persists entries and provides change streams:

```typescript
class EventJournal {
  // Read all entries
  readonly entries: Effect<ReadonlyArray<Entry>, EventJournalError>

  // Write with pre-commit effect (handler execution)
  readonly write: <A, E, R>(options: {
    readonly event: string
    readonly primaryKey: string
    readonly payload: Uint8Array
    readonly effect: (entry: Entry) => Effect<A, E, R>
  }) => Effect<A, EventJournalError | E, R>

  // Write from remote source (with conflict detection)
  readonly writeFromRemote: (options: {
    readonly remoteId: RemoteId
    readonly entries: ReadonlyArray<RemoteEntry>
    readonly effect: (options: {
      readonly entry: Entry
      readonly conflicts: ReadonlyArray<Entry>  // ← CRDT-style
    }) => Effect<void>
  }) => Effect<void>

  // Change stream for sync
  readonly changes: Effect<Queue.Dequeue<Entry>, never, Scope>

  // Cleanup
  readonly destroy: Effect<void>
}
```

**Two implementations provided:**

| Implementation | Use Case |
|----------------|----------|
| `layerMemory` | Development, testing |
| `layerIndexedDb()` | Browser production |

---

## Part 3: Handler Registration

### 3.1 The EventLog.group() Pattern

Handlers are registered as Effect Layers using `EventLog.group()`:

```typescript
import { EventLog } from "@effect/experimental"
import * as Effect from "effect/Effect"

// Handler layer for UserEvents
const UserHandlersLive: Layer.Layer<
  Event.ToService<EventGroup.Events<typeof UserEvents>>,  // Provides handler tags
  never,                                                    // No construction errors
  UserRepository                                            // Requires UserRepository
> = EventLog.group(UserEvents, (handlers) =>
  handlers
    .handle("UserCreated", ({ payload, entry, conflicts }) =>
      Effect.gen(function* () {
        const repo = yield* UserRepository

        // Check for conflicts (concurrent creates with same ID)
        if (conflicts.length > 0) {
          yield* Effect.logWarning("Concurrent user creation detected")
          // Decide resolution strategy:
          // - Last-write-wins (do nothing, this is latest)
          // - First-write-wins (skip if exists)
          // - Merge (combine properties)
        }

        yield* repo.create({
          id: payload.id,
          name: payload.name,
          email: payload.email,
          createdAt: entry.createdAt,
        })

        // Return success value (matches `success` schema)
        return { userId: payload.id }
      })
    )
    .handle("UserUpdated", ({ payload, entry, conflicts }) =>
      Effect.gen(function* () {
        const repo = yield* UserRepository

        // For updates, conflicts mean concurrent edits
        // You might want to merge changes
        yield* repo.update(payload.id, {
          name: payload.name,
          email: payload.email,
          updatedAt: entry.createdAt,
        })
      })
    )
    .handle("UserDeleted", ({ payload }) =>
      Effect.gen(function* () {
        const repo = yield* UserRepository
        yield* repo.delete(payload.id)
      })
    )
)
```

### 3.2 Handler Context

Each handler receives:

```typescript
interface HandlerContext<Tag extends string> {
  // The decoded event payload
  readonly payload: Event.PayloadWithTag<Events, Tag>

  // The journal entry (has timestamp, ID, etc.)
  readonly entry: Entry

  // Concurrent entries with same primaryKey that arrived
  // between this entry's creation and processing
  readonly conflicts: Array<{
    readonly entry: Entry
    readonly payload: Event.PayloadWithTag<Events, Tag>
  }>
}
```

### 3.3 Conflict Detection

Conflicts occur when:
1. Multiple clients write events with the same `primaryKey`
2. Events arrive out of order due to network latency
3. Offline clients sync after reconnection

```typescript
// Example: Last-write-wins with logging
.handle("DocumentUpdated", ({ payload, entry, conflicts }) =>
  Effect.gen(function* () {
    if (conflicts.length > 0) {
      // Log all conflicting versions
      for (const conflict of conflicts) {
        yield* Effect.logInfo(`Conflict: ${conflict.entry.idString}`)
      }
      // This handler runs for the "winning" entry (latest by ID)
    }

    yield* DocumentRepo.update(payload.id, payload.content)
  })
)
```

---

## Part 4: Writing Events

### 4.1 EventLog.makeClient()

Create a typed event writer:

```typescript
import { EventLog } from "@effect/experimental"
import * as Effect from "effect/Effect"

const program = Effect.gen(function* () {
  // Get typed write function
  const write = yield* EventLog.makeClient(AppSchema)

  // Write events (type-safe!)
  const result = yield* write("UserCreated", {
    id: "user-123",
    name: "Alice",
    email: "alice@example.com",
  })
  // result: { userId: string } (from success schema)

  // TypeScript enforces:
  // - Valid event tag
  // - Correct payload shape
  // - Return type matches success schema
})
```

### 4.2 Direct EventLog.write()

Lower-level API with schema parameter:

```typescript
const program = Effect.gen(function* () {
  const log = yield* EventLog

  yield* log.write({
    schema: AppSchema,
    event: "UserCreated",
    payload: {
      id: "user-123",
      name: "Alice",
      email: "alice@example.com",
    },
  })
})
```

### 4.3 Write Flow

```
write("UserCreated", payload)
         │
         ▼
┌─────────────────────────────┐
│ 1. Find handler in Registry │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 2. Encode payload (MsgPack) │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 3. Journal.write({         │
│      event,                 │
│      primaryKey,            │
│      payload,               │
│      effect: handler        │  ← Handler runs here
│    })                       │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 4. On success: persist entry│
│    On failure: rollback     │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 5. Invalidate reactivity    │
│    keys for this event      │
└─────────────────────────────┘
```

---

## Part 5: Reactivity

### 5.1 The Reactivity Service

Reactivity provides automatic query re-execution when data changes:

```typescript
import { Reactivity } from "@effect/experimental"

// The service interface
interface Reactivity.Service {
  // Invalidate keys (triggers re-queries)
  invalidate: (keys: Keys) => Effect<void>
  unsafeInvalidate: (keys: Keys) => void

  // Execute effect, invalidate keys after
  mutation: <A, E, R>(keys: Keys, effect: Effect<A, E, R>) => Effect<A, E, R>

  // Reactive query — re-runs on invalidation
  query: <A, E, R>(keys: Keys, effect: Effect<A, E, R>) =>
    Effect<Mailbox.ReadonlyMailbox<A, E>, never, R | Scope>

  // Stream version of query
  stream: <A, E, R>(keys: Keys, effect: Effect<A, E, R>) =>
    Stream<A, E, Exclude<R, Scope>>

  // Register custom handler
  unsafeRegister: (keys: Keys, handler: () => void) => () => void
}

// Keys can be:
type Keys =
  | ReadonlyArray<unknown>                           // Simple keys
  | ReadonlyRecord<string, ReadonlyArray<unknown>>   // Namespaced keys
```

### 5.2 Binding Events to Reactivity Keys

Use `EventLog.groupReactivity()` to auto-invalidate on writes:

```typescript
import { EventLog } from "@effect/experimental"

// Simple: all events invalidate same keys
const UserReactivitySimple = EventLog.groupReactivity(
  UserEvents,
  ["users"]  // All user events invalidate "users" key
)

// Advanced: per-event key mapping
const UserReactivityAdvanced = EventLog.groupReactivity(
  UserEvents,
  {
    UserCreated: ["users", "user-count"],
    UserUpdated: ["users"],
    UserDeleted: ["users", "user-count"],
  }
)
```

### 5.3 Reactive Queries

```typescript
import { Reactivity } from "@effect/experimental"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

// As a Mailbox (pull-based)
const usersMailbox = Effect.gen(function* () {
  const mailbox = yield* Reactivity.query(
    ["users"],
    UserRepository.findAll()
  )

  // Each time "users" is invalidated, query re-runs
  // New result appears in mailbox
  const users = yield* mailbox.take
  return users
})

// As a Stream (push-based)
const usersStream: Stream.Stream<User[], never, UserRepository | Reactivity> =
  Reactivity.stream(
    ["users"],
    UserRepository.findAll()
  )

// With specific entity tracking
const userByIdStream = (id: string) =>
  Reactivity.stream(
    { users: [id] },  // Invalidates on changes to this specific user
    UserRepository.findById(id)
  )
```

### 5.4 Manual Invalidation

```typescript
// Via Effect
yield* Reactivity.invalidate(["users"])

// Via mutation helper (invalidates after effect completes)
yield* Reactivity.mutation(
  ["users"],
  UserRepository.deleteAll()
)

// Unsafe (synchronous, for integration with non-Effect code)
reactivity.unsafeInvalidate(["users"])
```

---

## Part 6: Persistence

### 6.1 Memory Journal (Development)

```typescript
import { EventJournal } from "@effect/experimental"
import * as Layer from "effect/Layer"

// In-memory, non-persistent
const JournalLive = EventJournal.layerMemory

// Use for:
// - Unit tests
// - Development
// - Demos
```

### 6.2 IndexedDB Journal (Browser Production)

```typescript
import { EventJournal } from "@effect/experimental"

// Persistent browser storage
const JournalLive = EventJournal.layerIndexedDb({
  database: "my-app-events"  // IndexedDB database name
})

// Creates IndexedDB with:
// - "entries" object store (keyPath: "id")
// - "remotes" object store (for sync tracking)
// - "remoteEntryId" object store (for sync cursors)
```

### 6.3 Startup Replay

On application startup, persisted events are replayed:

```typescript
// Pseudocode of what happens internally
const startup = Effect.gen(function* () {
  const journal = yield* EventJournal
  const registry = yield* Registry
  const handlers = yield* registry.handlers

  // Read all persisted entries
  const entries = yield* journal.entries

  // Replay through handlers (rebuilds state)
  for (const entry of entries) {
    const handler = handlers[entry.event]
    if (handler) {
      const payload = yield* decode(entry.payload)
      yield* handler.handler({ payload, entry, conflicts: [] })
    }
  }
})
```

**Note**: Conflict detection only applies to remote sync, not replay.

---

## Part 7: Remote Sync

### 7.1 Architecture

```
┌─────────────────┐          WebSocket           ┌─────────────────┐
│     Client A    │◄─────────────────────────────▶│   EventLog      │
│   EventLog +    │                               │    Server       │
│   Journal       │                               │                 │
└─────────────────┘                               └─────────────────┘
         │                                                 ▲
         │                                                 │
         │              ┌─────────────────┐               │
         │              │     Client B    │               │
         └──────────────│   EventLog +    │───────────────┘
                        │   Journal       │
                        └─────────────────┘
```

### 7.2 Client Setup

```typescript
import { EventLog, EventLogRemote, EventJournal, Identity } from "@effect/experimental"
import * as Layer from "effect/Layer"

const AppLive = Layer.mergeAll(
  // Local persistence
  EventJournal.layerIndexedDb({ database: "my-app" }),

  // Identity (for encryption)
  EventLog.layerIdentityKvs({ key: "user-identity" }),

  // EventLog service
  EventLog.layer(AppSchema),

  // Handlers
  UserHandlersLive,

  // WebSocket sync (connects automatically)
  EventLogRemote.layerWebSocketBrowser("wss://api.example.com/events"),
)
```

### 7.3 Server Setup

```typescript
import { EventLogServer } from "@effect/experimental"
import * as HttpServer from "@effect/platform/HttpServer"

// Create WebSocket handler
const wsHandler = yield* EventLogServer.makeHandlerHttp

// Use in HTTP router
const router = HttpRouter.empty.pipe(
  HttpRouter.get("/events", wsHandler)
)

// Server needs Storage implementation
const ServerLive = Layer.mergeAll(
  EventLogServer.layerStorageMemory,  // Or custom persistence
  // ... other server layers
)
```

### 7.4 Sync Protocol

The protocol uses MsgPack-encoded messages:

**Client → Server:**
- `WriteEntries` — Send encrypted entries
- `RequestChanges` — Subscribe to changes from sequence N
- `StopChanges` — Unsubscribe
- `Ping` — Keep-alive

**Server → Client:**
- `Hello` — Connection established, here's remote ID
- `Ack` — Entries received, here are sequence numbers
- `Changes` — New entries from other clients
- `Pong` — Keep-alive response

### 7.5 Encryption

All payloads are encrypted with AES-GCM:

```typescript
import { EventLogEncryption } from "@effect/experimental"

// Uses Web Crypto API
const EncryptionLive = EventLogEncryption.layerSubtle

// Each Identity has:
// - publicKey: string (for identification)
// - privateKey: Redacted<Uint8Array> (32-byte AES key)

// Entries are encrypted per-client, server cannot read payloads
```

---

## Part 8: Compaction

### 8.1 The Problem

Event logs grow forever. For long-running applications:
- Storage grows unbounded
- Replay time increases
- Old events may be irrelevant

### 8.2 Compaction Strategy

`EventLog.groupCompaction()` defines how to compress events:

```typescript
import { EventLog } from "@effect/experimental"

const CounterCompaction = EventLog.groupCompaction(
  CounterEvents,
  ({ primaryKey, entries, events, write }) =>
    Effect.gen(function* () {
      // `events` is array of { _tag, payload } for this primaryKey
      // Sum all increments/decrements into single value
      let total = 0
      for (const event of events) {
        if (event._tag === "Incremented") total += event.payload.amount
        if (event._tag === "Decremented") total -= event.payload.amount
      }

      // Write single compacted event
      yield* write("CounterSet", { value: total })
    })
)
```

### 8.3 When Compaction Runs

Compaction runs during remote sync when:
1. Entries arrive from server
2. Multiple entries share a `primaryKey`
3. A compactor is registered for those event types

---

## Part 9: Layer Composition

### 9.1 Complete Application Layer

```typescript
import { EventLog, EventJournal, EventLogRemote, Reactivity } from "@effect/experimental"
import * as Layer from "effect/Layer"

// Domain handler layers
const DomainHandlers = Layer.mergeAll(
  UserHandlersLive,
  OrderHandlersLive,
  InventoryHandlersLive,
)

// Reactivity bindings
const ReactivityBindings = Layer.mergeAll(
  EventLog.groupReactivity(UserEvents, ["users"]),
  EventLog.groupReactivity(OrderEvents, ["orders"]),
)

// Full application layer
const AppLive = Layer.mergeAll(
  // Persistence
  EventJournal.layerIndexedDb({ database: "my-app" }),

  // Identity
  EventLog.layerIdentityKvs({ key: "identity" }),

  // Core EventLog
  EventLog.layer(AppSchema),

  // Reactivity
  Reactivity.layer,

  // Handlers
  DomainHandlers,

  // Reactivity bindings
  ReactivityBindings,

  // Optional: Remote sync
  EventLogRemote.layerWebSocketBrowser("wss://api.example.com/events"),
)

// Run program
Effect.runPromise(
  program.pipe(Effect.provide(AppLive))
)
```

### 9.2 Testing Layer

```typescript
const TestLive = Layer.mergeAll(
  // In-memory journal (no persistence)
  EventJournal.layerMemory,

  // Random identity
  Layer.succeed(Identity, Identity.makeRandom()),

  // Core EventLog
  EventLog.layer(AppSchema),

  // Reactivity
  Reactivity.layer,

  // Handlers with mocked dependencies
  UserHandlersLive.pipe(
    Layer.provide(MockUserRepository),
  ),
)
```

---

## Part 10: Patterns & Best Practices

### 10.1 Event Design

**DO:**
```typescript
// Specific, intention-revealing event names
"UserEmailVerified"
"OrderShipped"
"InventoryReplenished"

// Immutable payloads
payload: Schema.Struct({
  orderId: Schema.String,
  shippedAt: Schema.DateFromNumber,
  trackingNumber: Schema.String,
})
```

**DON'T:**
```typescript
// Generic CRUD names
"UserUpdated"  // What was updated? Why?

// Mutable references
payload: Schema.Struct({
  user: UserSchema,  // Embedding full entity
})
```

### 10.2 PrimaryKey Design

```typescript
// Entity events: use entity ID
primaryKey: (p) => p.userId

// Relationship events: composite key
primaryKey: (p) => `${p.userId}:${p.roleId}`

// Singleton events: constant
primaryKey: () => "settings"
```

### 10.3 Handler Idempotency

Handlers may run multiple times (replay, sync):

```typescript
.handle("UserCreated", ({ payload }) =>
  Effect.gen(function* () {
    const repo = yield* UserRepository

    // Check if already exists (idempotent)
    const existing = yield* repo.findById(payload.id)
    if (Option.isSome(existing)) {
      return { userId: payload.id }  // Already handled
    }

    yield* repo.create(payload)
    return { userId: payload.id }
  })
)
```

### 10.4 Error Handling

```typescript
// Define domain errors in event
.add({
  tag: "OrderPlaced",
  payload: OrderPayload,
  error: Schema.Union(
    Schema.Struct({ _tag: Schema.Literal("InsufficientStock"), productId: Schema.String }),
    Schema.Struct({ _tag: Schema.Literal("InvalidAddress"), reason: Schema.String }),
  ),
})

// Handler can fail with typed error
.handle("OrderPlaced", ({ payload }) =>
  Effect.gen(function* () {
    const stock = yield* InventoryRepo.getStock(payload.productId)
    if (stock < payload.quantity) {
      return yield* Effect.fail({ _tag: "InsufficientStock", productId: payload.productId })
    }
    // ...
  })
)
```

### 10.5 Testing

```typescript
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"

it.effect("UserCreated handler creates user in repository", () =>
  Effect.gen(function* () {
    const write = yield* EventLog.makeClient(AppSchema)

    yield* write("UserCreated", {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
    })

    const repo = yield* UserRepository
    const user = yield* repo.findById("user-1")

    expect(Option.isSome(user)).toBe(true)
    expect(user.value.name).toBe("Test User")
  }).pipe(Effect.provide(TestLive))
)
```

---

## Summary

The EventLog ecosystem provides:

1. **Event** — Schema-backed event definitions
2. **EventGroup** — Domain event collections
3. **EventLog.group()** — Handler registration as Layers
4. **EventLog.makeClient()** — Type-safe event writing
5. **EventJournal** — Persistence (memory or IndexedDB)
6. **Reactivity** — Auto-invalidating queries
7. **EventLogRemote** — Encrypted WebSocket sync
8. **Compaction** — Event log compression

The key mental model:
- **Events are truth** — Not state
- **State is derived** — Via handler replay
- **Persistence is automatic** — Journal handles it
- **Sync is built-in** — Just add WebSocket layer

---

Co-Authored-By: Val <val@maidens.ai>
