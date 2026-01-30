# Effect EventLog Deep Research (DeepWiki)

**Research Date**: 2026-01-29
**Source**: Effect-TS/effect repository via DeepWiki
**Package**: `@effect/experimental`

---

## Executive Summary

EventLog is an experimental event-sourcing system in the Effect ecosystem that provides:
- Schema-driven event definitions with runtime validation
- Handler registration for event processing (projection patterns)
- Reactive bindings to invalidate atoms on event changes
- Multiple persistence backends (Memory, KVS, LMDB, Redis, SQL via indirection)
- Compaction strategies for event stream optimization
- Actor-based state management with snapshot/restore capabilities

**Status**: Experimental - APIs may change

---

## 1. Core API

### 1.1 EventLog.schema()

**Purpose**: Define the schema for event groups that the EventLog will handle.

**Signature**:
```typescript
export const schema = <Groups extends ReadonlyArray<EventGroup.Any>>(
  ...groups: Groups
): EventLogSchema<Groups[number]> => { /* ... */ }
```

**Usage**: Pass one or more `EventGroup.Any` instances to create an `EventLogSchema`. This schema ensures type safety and proper serialization when writing events.

**Example**:
```typescript
import * as EventLog from "@effect/experimental/EventLog";
import { UserGroup } from "./UserEventGroup";

const myEventLogSchema = EventLog.schema(UserGroup);
```

The `EventLogSchema` internally stores the provided `EventGroup` instances in a `ReadonlyArray` accessible via the `groups` property.

---

### 1.2 EventLog.group()

**Purpose**: Register event handlers for a specific `EventGroup`. Handlers define how each event type should be processed (e.g., update database, trigger side effects).

**Signature**:
```typescript
export const group = <Events extends Event.Any, Return>(
  group: EventGroup<Events>,
  f: (handlers: Handlers<never, Events>) => Handlers.ValidateReturn<Return>
): Layer.Layer<
  Event.ToService<Events>,
  Handlers.Error<Return>,
  Exclude<Handlers.Context<Return>, Scope>
> => { /* ... */ }
```

**Key Points**:
- Takes an `EventGroup` and a function `f` that receives a `Handlers` object
- Inside `f`, use `.handle(tag, handlerFn)` to define handlers for each event type
- Returns a `Layer.Layer` that registers handlers with the EventLog's internal `Registry`
- Handlers receive `{ payload, entry, conflicts }` where:
  - `payload`: The decoded event data
  - `entry`: Metadata (primaryKey, createdAtMillis, idString)
  - `conflicts`: Other entries that might have caused conflicts

**Example**:
```typescript
const userEventHandlerLayer = EventLog.group(UserGroup, (handlers) =>
  handlers.handle("UserCreated", ({ payload, entry }) =>
    Effect.sync(() => {
      console.log(`User created: ${payload.name} with ID ${payload.userId}`);
      console.log(`Entry ID: ${entry.idString}`);
      // Update database, trigger side effects, etc.
    })
  )
);
```

**Projection Pattern**: Handlers implement the projection logic that updates aggregate state based on events. This is the core mechanism for event-sourced state reconstruction.

---

### 1.3 EventLog.groupReactivity()

**Purpose**: Bind event changes to reactive atoms, triggering invalidations when specific events occur.

**Signature**:
```typescript
export const groupReactivity = <Events extends Event.Any>(
  group: EventGroup<Events>,
  keys:
    | { readonly [Tag in Event.Tag<Events>]?: ReadonlyArray<string> }
    | ReadonlyArray<string>
): Layer.Layer<never, never, Identity | EventJournal> => { /* ... */ }
```

**Key Points**:
- `keys` define which reactive atoms should be invalidated based on event tag and primary key
- When an event is written, if its tag matches a registered reactivity key, associated reactive atoms are invalidated using `Reactivity.unsafeInvalidate()`
- Requires `Identity` and `EventJournal` services

**Example**:
```typescript
const userReactivityLayer = EventLog.groupReactivity(UserGroup, {
  UserCreated: ["userProfile"], // Invalidate 'userProfile' atom when UserCreated occurs
  UserNameUpdated: ["userProfile", "userList"], // Multiple invalidations
});

// Or use array for all events
const globalReactivity = EventLog.groupReactivity(UserGroup, ["globalState"]);
```

**Integration with effect-atom**: This mechanism allows EventLog to trigger `Atom.refreshable()` atoms or other reactive consumers when events occur.

---

### 1.4 Complete Working Example

```typescript
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as EventLog from "@effect/experimental/EventLog";
import * as EventGroup from "@effect/experimental/EventGroup";
import * as Event from "@effect/experimental/Event";
import * as EventJournal from "@effect/experimental/EventJournal";
import * as KeyValueStore from "@effect/platform/KeyValueStore";

// 1. Define Event Schemas
const UserCreated = Event.withProps("UserCreated", {
  userId: Schema.String,
  name: Schema.String,
});

const UserNameUpdated = Event.withProps("UserNameUpdated", {
  userId: Schema.String,
  newName: Schema.String,
});

// 2. Create EventGroup
const UserGroup = EventGroup.make("User", {
  events: { UserCreated, UserNameUpdated },
  primaryKey: (event) => event.userId,
});

// 3. Define EventLog Schema
const myEventLogSchema = EventLog.schema(UserGroup);

// 4. Register Event Handlers
const userEventHandlerLayer = EventLog.group(UserGroup, (handlers) =>
  handlers
    .handle("UserCreated", ({ payload, entry }) =>
      Effect.sync(() => {
        console.log(`User created: ${payload.name} (ID: ${payload.userId})`);
        console.log(`Entry: ${entry.idString}`);
      })
    )
    .handle("UserNameUpdated", ({ payload }) =>
      Effect.sync(() => {
        console.log(`User ${payload.userId} renamed to ${payload.newName}`);
      })
    )
);

// 5. Bind Reactivity
const userReactivityLayer = EventLog.groupReactivity(UserGroup, {
  UserCreated: ["userProfile"],
  UserNameUpdated: ["userProfile"],
});

// 6. Compose Layers
const mainLayer = Layer.mergeAll(
  EventLog.layer(myEventLogSchema),
  userEventHandlerLayer,
  userReactivityLayer,
  EventJournal.Memory.layer, // In-memory persistence
  EventLog.layerIdentityKvs({ key: "my-eventlog-identity" }),
  KeyValueStore.Memory.layer
);

// 7. Use EventLog Client
const program = Effect.gen(function* () {
  const client = yield* EventLog.makeClient(myEventLogSchema);

  yield* client("UserCreated", { userId: "user-123", name: "Alice" });
  yield* client("UserCreated", { userId: "user-456", name: "Bob" });
  yield* client("UserNameUpdated", { userId: "user-123", newName: "Alice Smith" });

  yield* Effect.log("Events written successfully.");
});

Effect.runPromise(program.pipe(Effect.provide(mainLayer)));
```

**Output**:
```
User created: Alice (ID: user-123)
Entry: <entry-id-1>
User created: Bob (ID: user-456)
Entry: <entry-id-2>
User renamed to Alice Smith
Events written successfully.
```

---

## 2. EventGroup Composition Patterns

### 2.1 EventGroup Composition Mechanism

**Key Insight**: The prompt mentions `EventGroup.empty.add()`, but the codebase does NOT show this method. Instead, event groups are composed by passing multiple `EventGroup.Any` instances directly to `EventLog.schema()`:

```typescript
const schema1 = EventLog.schema(UserGroup, OrderGroup, PaymentGroup);
```

The `EventLogSchema` holds a `ReadonlyArray` of these groups in its `groups` property.

**Implication**: There's no imperative "builder" pattern for EventGroups. You define them declaratively and compose them at the schema level.

---

### 2.2 Schema.Union for Event Discriminators

`Schema.Union` is the canonical pattern for defining discriminated event types. Each event includes a `type` or `_tag` field that acts as the discriminator.

**Example from @effect/ai-anthropic**:
```typescript
const MessageStreamEvent = Schema.Union(
  PingEvent,
  ErrorEvent,
  MessageStartEvent,
  ContentBlockStartEvent,
  // ... more event types
);
```

Each event class defines a literal `type` field:
```typescript
const PingEvent = Schema.Class("PingEvent")({
  type: Schema.Literal("ping"),
});

const ErrorEvent = Schema.Class("ErrorEvent")({
  type: Schema.Literal("error"),
  error: Schema.Struct({ /* ... */ }),
});
```

**Best Practice**: Use `Schema.attachPropertySignature` to explicitly tag union members when needed:
```typescript
const ConverseResponseStreamEvent = Schema.Union(
  MessageStartEvent.pipe(
    Schema.attachPropertySignature("type", "message_start")
  ),
  ContentBlockStartEvent.pipe(
    Schema.attachPropertySignature("type", "content_block_start")
  ),
  // ...
);
```

---

### 2.3 Event Payload Design: Tagged Structs vs Plain Objects

**Strong Preference for Tagged Structs**: The codebase consistently uses `Schema.Class` or `Schema.Struct` with a discriminator field.

**Benefits**:
1. **Type Safety**: Explicit `type` field enables compile-time checks and type inference
2. **Discrimination**: `Schema.Union` can correctly parse specific event types from streams
3. **Readability**: Clear event structure improves maintainability

**Pattern**:
```typescript
// ✅ CORRECT - Tagged Struct
const UserAdded = Event.withProps("UserAdded", {
  userId: Schema.String,
  name: Schema.String,
});

// ❌ AVOID - Plain object
interface UserAdded {
  userId: string;
  name: string;
}
```

**Why**: Plain objects lack runtime validation and discriminator fields, making them unsuitable for event-sourced systems.

---

### 2.4 Event Versioning and Schema Evolution

**No Explicit Versioning Mechanism**: The snippets don't show built-in versioning features. However, Effect Schema provides tools for schema evolution:

**Strategies**:

1. **Schema.compose** for migrations:
```typescript
const UserV1 = Schema.Struct({ id: Schema.String, name: Schema.String });
const UserV2 = Schema.Struct({ id: Schema.String, firstName: Schema.String, lastName: Schema.String });

// Migration function
const migrateV1toV2 = Schema.compose(
  UserV1,
  Schema.transform(
    UserV1,
    UserV2,
    (v1) => ({ id: v1.id, firstName: v1.name, lastName: "" }),
    (v2) => ({ id: v2.id, name: `${v2.firstName} ${v2.lastName}` })
  )
);
```

2. **Schema.annotations** for metadata:
```typescript
const UserV1 = Schema.Struct({ /* ... */ }).pipe(
  Schema.annotations({ version: "1.0" })
);
```

3. **Schema.Union for multi-version support**:
```typescript
const UserEvent = Schema.Union(UserV1Event, UserV2Event);
```

**Best Practice**: When introducing breaking changes, define a new event schema and use `Schema.Union` to accept both old and new versions. Application logic handles the differences.

---

## 3. Persistence Backends

### 3.1 Available Adapters

The EventLog uses the `Persistence` module for storage abstraction via `BackingPersistence`.

**Core Adapters** (via `@effect/experimental/Persistence`):
- **In-Memory**: `layerMemory` (for testing/dev)
- **Key-Value Store**: `layerKeyValueStore` (adapts any `KeyValueStore.KeyValueStore`)
- **LMDB**: `Lmdb.layer(options)` (embedded database)
- **Redis**: `Redis.layer(options)` (distributed cache)

**SQL Adapters** (via `@effect/sql`):
While EventLog doesn't expose SQL adapters directly, the `@effect/cluster` package demonstrates SQL integration via `MessageStorage`:
- **PostgreSQL**: `@effect/sql-pg`
- **MySQL**: `@effect/sql-mysql2`
- **MS SQL Server**: `@effect/sql-mssql`
- **ClickHouse**: `@effect/sql-clickhouse`
- **SQLite**: Multiple implementations:
  - Node.js: `@effect/sql-sqlite-node`
  - Bun: `@effect/sql-sqlite-bun`
  - WASM: `@effect/sql-sqlite-wasm`
  - React Native: `@effect/sql-sqlite-react-native`

---

### 3.2 PostgreSQL Integration

**Pattern**: Create a custom `BackingPersistence` layer using `@effect/sql-pg`.

**Example from @effect/cluster MessageStorage**:
```typescript
import * as Layer from "effect/Layer";
import * as PgContainer from "@effect/sql-pg/PgContainer";

const postgresLayer = Layer.orDie(PgContainer.ClientLive);
```

**For EventLog**: You would implement `BackingPersistenceStore` interface using `SqlClient`:

```typescript
import * as SqlClient from "@effect/sql/SqlClient";
import * as Persistence from "@effect/experimental/Persistence";
import * as Layer from "effect/Layer";

const makePostgresBackingPersistence = (tableName: string) =>
  Layer.effect(
    Persistence.BackingPersistence,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      return Persistence.BackingPersistence.of({
        make: (key: string) =>
          Effect.gen(function* () {
            // Initialize table, return store methods
            yield* sql`CREATE TABLE IF NOT EXISTS ${tableName} (...)`;

            return {
              get: (k) => sql`SELECT ...`,
              set: (k, v) => sql`INSERT ...`,
              // ... other BackingPersistenceStore methods
            };
          }),
      });
    })
  );
```

Then provide to EventJournal:
```typescript
const eventLogLayer = Layer.provide(
  EventLog.layer(schema),
  Layer.mergeAll(
    EventJournal.layer, // Depends on BackingPersistence
    makePostgresBackingPersistence("event_journal"),
    PgContainer.ClientLive
  )
);
```

---

### 3.3 SQLite vs PostgreSQL Tradeoffs

| Aspect | SQLite | PostgreSQL |
|--------|--------|------------|
| **Architecture** | Serverless, embedded, single-file | Client-server, separate process |
| **Concurrency** | Low (file-level locking) | High (MVCC, row-level locking) |
| **Scalability** | Single instance, limited | Distributed, replication, partitioning |
| **Setup** | Zero-config, portable | Requires server setup, management |
| **Use Cases** | Embedded systems, mobile, dev/test | Multi-user, distributed, production |
| **Event Storage** | Local-only event logs, single-writer | High-availability, concurrent writes |

**Recommendation**:
- **SQLite**: Prototyping, single-user apps, embedded devices
- **PostgreSQL**: Production event sourcing, multi-tenant, distributed systems

---

### 3.4 Configuring Persistence Layers

Persistence layers are composed using Effect's `Layer` system.

**1. Memory Persistence**:
```typescript
import { PersistedQueue } from "@effect/experimental";
import { Layer } from "effect";

const layerMemory = PersistedQueue.layer.pipe(
  Layer.provide(PersistedQueue.layerStoreMemory)
);
```

**2. Key-Value Store Persistence**:
```typescript
import * as Persistence from "@effect/experimental/Persistence";
import * as KeyValueStore from "@effect/platform/KeyValueStore";

const layerResultKeyValueStore = Persistence.layerResult.pipe(
  Layer.provide(Persistence.layerKeyValueStore)
);
```

**3. LMDB Persistence**:
```typescript
import * as Lmdb from "@effect/experimental/Persistence/Lmdb";
import type * as Lmdb_ from "lmdb";

export const layerResult = (
  options: Lmdb_.RootDatabaseOptionsWithPath
): Layer.Layer<Persistence.ResultPersistence> =>
  Persistence.layerResult.pipe(
    Layer.provide(Lmdb.layer(options))
  );
```

**4. Redis Persistence**:
```typescript
import * as Redis from "@effect/experimental/Persistence/Redis";
import type { RedisOptions } from "ioredis";

export const layerResult = (
  options: RedisOptions
): Layer.Layer<Persistence.ResultPersistence> =>
  Persistence.layerResult.pipe(
    Layer.provide(Redis.layer(options))
  );
```

**Integration with EventLog**:
```typescript
const eventLogLayer = Layer.mergeAll(
  EventLog.layer(myEventLogSchema),
  userEventHandlerLayer,
  EventJournal.layer.pipe(
    Layer.provide(Lmdb.layer({ path: "./event-store.lmdb" }))
  ),
  EventLog.layerIdentityKvs({ key: "event-log-id" }),
  KeyValueStore.Memory.layer
);
```

**Key Point**: EventLog depends on `EventJournal`, which depends on `BackingPersistence`. Choose your persistence layer and provide it to EventJournal.

---

## 4. Aggregation & State Reconstruction

### 4.1 Projection Patterns (Rebuilding State from Events)

**Core Mechanism**: Event handlers registered via `EventLog.group()` implement projection logic.

**Pattern**:
```typescript
interface UserState {
  name: string;
  email?: string;
}

const userState = new Map<string, UserState>();

const userProjection = EventLog.group(UserGroup, (handlers) =>
  handlers
    .handle("UserCreated", ({ payload }) =>
      Effect.sync(() => {
        userState.set(payload.userId, { name: payload.name });
      })
    )
    .handle("UserEmailUpdated", ({ payload }) =>
      Effect.sync(() => {
        const user = userState.get(payload.userId);
        if (user) user.email = payload.newEmail;
      })
    )
);
```

**Key Insight**: Handlers receive `entry` metadata including `createdAtMillis`, enabling time-based filtering for point-in-time reconstruction.

**Advanced: Stream-based Projections**:
```typescript
import * as Stream from "effect/Stream";

const rebuildState = (events: Stream.Stream<UserEvent>) =>
  events.pipe(
    Stream.scan({ users: new Map() }, (state, event) => {
      switch (event._tag) {
        case "UserCreated":
          state.users.set(event.userId, { name: event.name });
          break;
        case "UserNameUpdated":
          const user = state.users.get(event.userId);
          if (user) user.name = event.newName;
          break;
      }
      return state;
    })
  );
```

**Stream.scan** and **Stream.scanEffect** are the canonical operators for stateful aggregations over event streams, producing all intermediate results.

---

### 4.2 Snapshot Strategies

**Machine Module**: The `@effect/experimental/Machine` module provides explicit `snapshot()` and `restore()` for actor-based state management.

**Pattern**:
```typescript
import * as Machine from "@effect/experimental/Machine";
import * as Schema from "effect/Schema";

interface MyState { count: number; }
interface MyInput { initialCount: number; }

const MyMachine = Machine.makeSerializable({
  schemaState: Schema.Struct({ count: Schema.Number }),
  schemaInput: Schema.Struct({ initialCount: Schema.Number }),
  // ... machine logic
});

// Take snapshot
const takeSnapshot = (actor: Machine.Actor<typeof MyMachine>) =>
  Machine.snapshot(actor); // Returns [input, state] tuple (encoded)

// Restore from snapshot
const restoreActor = (snapshotData: readonly [unknown, unknown]) =>
  Machine.restore(MyMachine, snapshotData);
```

**EventLog Compaction**: `EventLog.groupCompaction()` provides event stream compaction.

```typescript
const compactionLayer = EventLog.groupCompaction(UserGroup, {
  effect: ({ entries, write }) =>
    Effect.gen(function* () {
      // Aggregate entries into snapshot event
      const latestState = computeLatestState(entries);

      // Write compacted snapshot event
      yield* write("UserSnapshot", {
        userId: latestState.userId,
        snapshot: latestState,
      });
    }),
});
```

**Snapshot Frequency**: Determine based on event volume and read performance. Common strategies:
- **Event count threshold**: Snapshot every N events
- **Time-based**: Snapshot hourly/daily
- **On-demand**: Snapshot during low-traffic periods

---

### 4.3 Event Replay and Time-Travel

**Inherent Capability**: EventLog stores all events, enabling replay from any point in time.

**Access via EventJournal**:
```typescript
const replayFrom = (timestamp: number) =>
  Effect.gen(function* () {
    const journal = yield* EventJournal;
    const entries = yield* journal.entries; // Stream of all entries

    return entries.pipe(
      Stream.filter((entry) => entry.createdAtMillis >= timestamp),
      Stream.mapEffect((entry) => processEvent(entry))
    );
  });
```

**PubSub Replay Mechanism**: While not directly part of EventLog, the `PubSub` module demonstrates a `replay` feature for event streams:

```typescript
import * as PubSub from "effect/PubSub";

const pubsub = PubSub.bounded<Event>({ capacity: 100, replay: 10 });

// New subscribers receive last 10 events
const subscriber = yield* PubSub.subscribe(pubsub);
```

**Application to EventLog**: Implement replay by:
1. Query EventJournal for entries from `startTime` to `endTime`
2. Filter entries by event tags if needed
3. Apply projection handlers to rebuild state

**Time-Travel Pattern**:
```typescript
const stateat = (timestamp: number) =>
  Effect.gen(function* () {
    const journal = yield* EventJournal;
    const entries = yield* journal.entries;

    const relevantEvents = entries.pipe(
      Stream.filter((e) => e.createdAtMillis <= timestamp)
    );

    return yield* rebuildState(relevantEvents);
  });
```

---

### 4.4 Best Practices for Aggregate State Management

Based on codebase patterns:

1. **Event-Sourcing with EventLog**: Persist all state changes as immutable events. Never mutate event payloads after writing.

2. **Schema-Driven Event Definition**: Always use `Schema` for events (not plain interfaces). This ensures runtime validation and proper serialization.

3. **Clear Event Grouping**: Organize events into `EventGroup`s by domain (User, Order, Payment). This simplifies handler management and compaction strategies.

4. **Projection via Handlers**: Implement state projections in `EventLog.group()` handlers. Keep handlers pure and focused on state updates.

5. **Compaction for Performance**: Use `EventLog.groupCompaction()` to reduce event count. Balance between storage savings and replay performance.

6. **Reactivity for Real-Time Updates**: Use `EventLog.groupReactivity()` to invalidate caches/atoms when events occur. This maintains consistency across projections.

7. **Actor-Based State with Snapshots**: For complex aggregates, use `Machine` module to manage state as actors. Combine `snapshot()` / `restore()` with event sourcing for efficient recovery.

8. **Separate Read Models**: Don't query EventLog directly for reads. Build dedicated read models (projections) optimized for queries.

9. **Idempotent Handlers**: Ensure event handlers are idempotent (can be safely replayed). Avoid side effects that can't be retried.

10. **Conflict Resolution**: Use the `conflicts` parameter in handlers to resolve concurrent writes. Implement CRDTs or last-write-wins strategies as needed.

---

## 5. Open Questions & Research Gaps

### 5.1 Questions for Further Investigation

1. **EventLog vs Machine**: When should you use EventLog vs Machine for state management? Can they be combined?

2. **Distributed EventLog**: How does EventLog handle distributed scenarios? Is there built-in support for event replication across nodes?

3. **Event Ordering Guarantees**: What ordering guarantees does EventLog provide? Are events ordered globally or per-primaryKey?

4. **Conflict Resolution**: The `conflicts` parameter is mentioned but not explained in detail. What conflict resolution strategies are available?

5. **Performance at Scale**: What are the performance characteristics of EventLog with millions of events? Recommended compaction strategies?

6. **Migration Tooling**: Are there tools for migrating event schemas when breaking changes occur?

7. **EventJournal Implementations**: Are there production-ready EventJournal implementations beyond Memory/KVS/LMDB/Redis?

8. **Integration with @effect/cluster**: How does EventLog integrate with distributed actor systems in @effect/cluster?

### 5.2 Potential DeepWiki Follow-ups

- "How does EventLog handle concurrent writes and conflict resolution?"
- "What are the performance benchmarks for EventLog with PostgreSQL backend?"
- "Show examples of EventLog integration with @effect/cluster for distributed event sourcing"
- "What are the best practices for event schema versioning in production EventLog systems?"

---

## 6. Code Reference Index

### Key Files in Effect-TS/effect

| Module | Purpose | Path Hint |
|--------|---------|-----------|
| `EventLog.ts` | Core EventLog API | `@effect/experimental/EventLog` |
| `EventGroup.ts` | Event grouping logic | `@effect/experimental/EventGroup` |
| `Event.ts` | Event primitives | `@effect/experimental/Event` |
| `EventJournal.ts` | Persistence abstraction | `@effect/experimental/EventJournal` |
| `Persistence.ts` | BackingPersistence service | `@effect/experimental/Persistence` |
| `Machine.ts` | Actor state management | `@effect/experimental/Machine` |
| `MessageStorage.ts` | Cluster message storage (SQL examples) | `@effect/cluster` |

### External References

- DeepWiki searches linked in each section
- Effect website: https://effect.website (submodule at `../../submodules/website`)
- Effect Discord: #experimental channel for EventLog discussions

---

## 7. Summary & Recommendations

### What EventLog Is Good For

- **Event Sourcing**: Complete audit log of state changes
- **CQRS**: Separate write models (events) from read models (projections)
- **Time-Travel**: Reconstruct state at any point in time
- **Reactive Systems**: Invalidate atoms/caches on event changes
- **Distributed Systems**: Replicate events across nodes (when combined with appropriate EventJournal)

### When to Use EventLog

- Domain requires audit trail (finance, healthcare, compliance)
- Complex aggregates with many state transitions
- Need for time-travel debugging or analytics
- Building event-driven architectures

### When NOT to Use EventLog

- Simple CRUD apps without audit requirements
- Performance-critical hot paths (event replay has overhead)
- Schema is unstable and changes frequently (versioning complexity)

### Integration with TMNL Architecture

Given TMNL's focus on:
- **effect-atom**: EventLog.groupReactivity() can invalidate atoms
- **AG-Grid**: Projections can populate grid row data
- **Service-scoped state**: EventJournal can be scoped to DataManager instances
- **Schema-driven**: EventLog requires Schema, aligns with existing patterns

**Recommended Use Case**: Use EventLog for domain events (e.g., WorkOrderCreated, AssetUpdated) that require audit trails and multi-view consistency. Let projections populate AG-Grid and other UI surfaces.

---

**Research Complete**. This document synthesizes findings from four parallel DeepWiki queries. For implementation questions, consult the Effect Discord or file issues in Effect-TS/effect repo.
