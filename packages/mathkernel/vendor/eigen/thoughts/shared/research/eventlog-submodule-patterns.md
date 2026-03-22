# EventLog Submodule Patterns

**Generated:** 2026-01-29
**Source:** `../../submodules/effect/packages/experimental/src/`
**References:** AMS v2 integration at `src/lib/ams/v2/base/`

---

## Summary

EventLog is Effect's event sourcing system from `@effect/experimental`. It provides:

- **Event-driven architecture** with schema-based events
- **Event groups** to organize domain events
- **Handlers** that process events and update read models
- **Compaction** to snapshot event streams
- **Reactivity** for cache invalidation
- **Remote sync** with encryption support
- **SQL/Memory journals** for persistence

The AMS v2 codebase demonstrates canonical usage patterns.

---

## Core Architecture

```
EventGroup (domain events)
    ↓
EventLog.schema(...groups)
    ↓
EventLog Layer
    ├─ EventLog.group(handlers)          ← Process events
    ├─ EventLog.groupCompaction(fold)    ← Snapshot events
    └─ EventLog.groupReactivity(keys)    ← Invalidate caches
    ↓
EventJournal (persistence)
    ├─ makeMemory
    └─ SQL-backed (custom)
```

---

## 1. Event Definition

**Location:** `submodules/effect/packages/experimental/src/Event.ts`

### Event Interface

```typescript
interface Event<
  Tag extends string,
  Payload extends Schema.Schema.Any = typeof Schema.Void,
  Success extends Schema.Schema.Any = typeof Schema.Void,
  Error extends Schema.Schema.All = typeof Schema.Never
> {
  readonly tag: Tag
  readonly primaryKey: (payload: Schema.Schema.Type<Payload>) => string
  readonly payload: Payload
  readonly payloadMsgPack: MsgPack.schema<Payload>
  readonly success: Success
  readonly error: Error
}
```

**Key aspects:**
- **Tag** - Event discriminator (e.g., `"AssetCreated"`)
- **PrimaryKey** - Aggregation key (e.g., `assetId`)
- **Payload** - Effect Schema for event data
- **Success/Error** - Handler return types
- **MsgPack encoding** - Binary serialization for journal

### Event Constructor

```typescript
// From: submodules/effect/packages/experimental/src/Event.ts:242-261
export const make = <Tag extends string, Payload extends Schema.Schema.Any>(options: {
  readonly tag: Tag
  readonly primaryKey: (payload: Schema.Schema.Type<Payload>) => string
  readonly payload?: Payload
  readonly success?: Success
  readonly error?: Error
}): Event<Tag, Payload, Success, Error>
```

**AMS v2 Usage:**
```typescript
// File: src/lib/ams/v2/base/events/asset.ts:230-270
export const AssetEvents = EventGroup.empty
  .add({
    tag: 'AssetCreated',
    payload: AssetCreatedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  .add({
    tag: 'AssetUpdated',
    payload: AssetUpdatedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  // ... more events
```

**Pattern:** Use Schema.Class for payloads to get runtime validation + type inference.

---

## 2. EventGroup

**Location:** `submodules/effect/packages/experimental/src/EventGroup.ts`

### EventGroup Interface

```typescript
// From: EventGroup.ts:39-67
interface EventGroup<out Events extends Event.Any = never> {
  readonly events: Record.ReadonlyRecord<string, Events>
  
  add<Tag, Payload, Success, Error>(options: {
    readonly tag: Tag
    readonly primaryKey: (payload: Schema.Schema.Type<Payload>) => string
    readonly payload?: Payload
    readonly success?: Success
    readonly error?: Error
  }): EventGroup<Events | Event<Tag, Payload, Success, Error>>
  
  addError<Error extends Schema.Schema.Any>(
    error: Error
  ): EventGroup<Event.AddError<Events, Error>>
}
```

**Key methods:**
- **add()** - Builder pattern for events
- **addError()** - Add error schema to all events in group

### Canonical Pattern

```typescript
// From: src/lib/ams/v2/base/events/asset.ts:38-63
export class AssetCreatedPayload extends Schema.Class<AssetCreatedPayload>(
  'AssetCreatedPayload'
)({
  assetId: AssetId,
  siteId: SiteId,
  sectorId: Schema.optional(SectorId),
  kind: AssetKind,
  label: AssetLabel,
  status: AssetStatus,
  createdBy: IdentityId,
  createdAt: CreatedAt,
}) {}

export const AssetEvents = EventGroup.empty
  .add({
    tag: 'AssetCreated',
    payload: AssetCreatedPayload,
    primaryKey: (payload) => payload.assetId,
  })
```

**Best practice:**
1. Schema.Class for payload (not raw Schema.Struct)
2. Branded types for IDs (AssetId, SiteId)
3. primaryKey extracts aggregate root ID

---

## 3. EventLog Schema

**Location:** `submodules/effect/packages/experimental/src/EventLog.ts:62-69`

### Schema Constructor

```typescript
// From: EventLog.ts:62-69
export const schema = <Groups extends ReadonlyArray<EventGroup.Any>>(
  ...groups: Groups
): EventLogSchema<Groups[number]>
```

**AMS v2 Usage:**
```typescript
// File: src/lib/ams/v2/base/events/schema.ts:22
export const AmsEventLogSchema = EventLog.schema(AssetEvents)
```

**Pattern:** Pass multiple EventGroups to combine domains.

```typescript
// Example: Multi-domain schema
export const AppEventLogSchema = EventLog.schema(
  AssetEvents,
  OrderEvents,
  InventoryEvents
)
```

---

## 4. Event Handlers

**Location:** `submodules/effect/packages/experimental/src/EventLog.ts:242-259`

### Handler Layer

```typescript
// From: EventLog.ts:242-259
export const group = <Events extends Event.Any, Return>(
  group: EventGroup<Events>,
  f: (handlers: Handlers<never, Events>) => Handlers.ValidateReturn<Return>
): Layer.Layer<
  Event.ToService<Events>,
  Handlers.Error<Return>,
  Exclude<Handlers.Context<Return>, Scope>
>
```

**Handler signature:**
```typescript
handle<Tag extends Events["tag"]>(
  name: Tag,
  handler: (options: {
    readonly payload: Event.PayloadWithTag<Events, Tag>
    readonly entry: Entry
    readonly conflicts: Array<{ entry: Entry; payload: any }>
  }) => Effect.Effect<Success, Error, R>
): Handlers<R, ExcludeTag<Events, Tag>>
```

**Key parameters:**
- **payload** - Decoded event payload
- **entry** - Journal entry (id, timestamp, primaryKey)
- **conflicts** - Conflicting entries (for CRDT resolution)

### AMS v2 Handler Pattern

```typescript
// File: src/lib/ams/v2/base/handlers/event-handlers.ts:25-87
export const AssetEventHandlers = EventLog.group(AssetEvents, (handlers) =>
  Effect.gen(function* () {
    const state = yield* AssetState

    return handlers
      .handle('AssetCreated', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(`[EventLog] Asset created: ${payload.assetId}`)
          // Side effects: notifications, indexing, etc.
          return void 0
        })
      )
      .handle('AssetUpdated', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(`[EventLog] Asset updated: ${payload.assetId}`)
          return void 0
        })
      )
      // ... all events must be handled
  })
)
```

**Critical:** All events in the group MUST have handlers. TypeScript enforces exhaustiveness.

### Overlay System Handler Pattern

```typescript
// File: src/lib/overlays/events/handlers.ts:24-41
export const ContainerHandlersLive = EventLog.group(ContainerEvents, (handlers) =>
  handlers
    .handle("ContainerCreated", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.createContainer(payload.containerId)
      })
    )
    .handle("ContainerDestroyed", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        const hub = yield* PortHub
        yield* hub.destroyContainerPorts(payload.containerId)
        yield* registry.destroyContainer(payload.containerId)
      })
    )
)
```

**Pattern:** Handlers call service methods to update read models (Refs, atoms).

---

## 5. Event Compaction

**Location:** `submodules/effect/packages/experimental/src/EventLog.ts:265-347`

### Compaction Layer

```typescript
// From: EventLog.ts:265-276
export const groupCompaction = <Events extends Event.Any, R>(
  group: EventGroup<Events>,
  effect: (options: {
    readonly primaryKey: string
    readonly entries: Array<Entry>
    readonly events: Array<Event.TaggedPayload<Events>>
    readonly write: <Tag extends Event.Tag<Events>>(
      tag: Tag,
      payload: Event.PayloadWithTag<Events, Tag>
    ) => Effect.Effect<void>
  }) => Effect.Effect<void, never, R>
): Layer.Layer<never, never, Identity | EventJournal | R | Event.Context<Events>>
```

**Purpose:** Fold multiple events into a snapshot to reduce storage.

### AMS v2 Compaction Pattern

```typescript
// File: src/lib/ams/v2/base/handlers/compaction.ts:29-141
export const AssetCompaction = EventLog.groupCompaction(
  AssetEvents,
  ({ primaryKey, events, write }) =>
    Effect.gen(function* () {
      // Fold events into current state
      let currentState = { version: 0, deleted: false }

      for (const event of events) {
        switch (event._tag) {
          case 'AssetCreated': {
            const payload = event.payload as AssetCreatedPayload
            currentState = {
              ...currentState,
              siteId: payload.siteId,
              kind: payload.kind,
              label: payload.label,
              // ... full state
              version: 1,
            }
            break
          }
          case 'AssetUpdated': {
            const payload = event.payload as AssetUpdatedPayload
            currentState = {
              ...currentState,
              label: payload.newLabel ?? currentState.label,
              version: payload.version,
            }
            break
          }
          // ... other events
        }
      }

      // Write snapshot
      if (currentState.deleted && currentState.hardDelete) {
        yield* write('AssetDeleted', { /* snapshot */ })
      } else if (currentState.siteId && currentState.kind) {
        yield* write('AssetCreated', { /* full state snapshot */ })
      }

      yield* Effect.log(`[Compaction] Compacted ${events.length} events`)
    })
)
```

**Strategy:**
1. Fold all events for a primaryKey into state
2. Write a single snapshot event (usually `Created` with current state)
3. Delete original events (implicit - journal handles this)

**When to compact:**
- Periodically (cron job)
- When event count exceeds threshold
- Before remote sync

---

## 6. Reactivity (Cache Invalidation)

**Location:** `submodules/effect/packages/experimental/src/EventLog.ts:353-373`

### Reactivity Layer

```typescript
// From: EventLog.ts:353-358
export const groupReactivity = <Events extends Event.Any>(
  group: EventGroup<Events>,
  keys:
    | { readonly [Tag in Event.Tag<Events>]?: ReadonlyArray<string> }
    | ReadonlyArray<string>
): Layer.Layer<never, never, Identity | EventJournal>
```

**Purpose:** Invalidate cache keys when events are processed.

### AMS v2 Reactivity Pattern

```typescript
// File: src/lib/ams/v2/base/handlers/reactivity.ts:20-91
export const AMS_CACHE_KEYS = {
  ASSETS_LIST: 'ams:assets:list',
  ASSETS_BY_SITE: 'ams:assets:by-site',
  ASSET_PROPERTIES: 'ams:assets:properties',
  SEARCH_INDEX: 'ams:search:index',
} as const

export const AssetReactivity = EventLog.groupReactivity(AssetEvents, {
  AssetCreated: [
    AMS_CACHE_KEYS.ASSETS_LIST,
    AMS_CACHE_KEYS.ASSETS_BY_SITE,
    AMS_CACHE_KEYS.SEARCH_INDEX,
  ],
  AssetUpdated: [
    AMS_CACHE_KEYS.ASSETS_LIST,
    AMS_CACHE_KEYS.SEARCH_INDEX,
  ],
  PropertyChanged: [
    AMS_CACHE_KEYS.ASSET_PROPERTIES,
    AMS_CACHE_KEYS.SEARCH_INDEX,
  ],
})
```

**Mechanism:**
- Handler reads `reactivityKeys[entry.event]`
- For each key, calls `reactivity.unsafeInvalidate({ [key]: [entry.primaryKey] })`
- Cached queries for that key are invalidated

**Pattern:** Define cache keys as constants, map events to keys.

---

## 7. EventJournal (Persistence)

**Location:** `submodules/effect/packages/experimental/src/EventJournal.ts`

### Journal Interface

```typescript
// From: EventJournal.ts:19-81
export class EventJournal extends Context.Tag("@effect/experimental/EventJournal")<
  EventJournal,
  {
    readonly entries: Effect.Effect<ReadonlyArray<Entry>, EventJournalError>
    
    readonly write: <A, E, R>(options: {
      readonly event: string
      readonly primaryKey: string
      readonly payload: Uint8Array
      readonly effect: (entry: Entry) => Effect.Effect<A, E, R>
    }) => Effect.Effect<A, EventJournalError | E, R>
    
    readonly writeFromRemote: (options: {
      readonly remoteId: RemoteId
      readonly entries: ReadonlyArray<RemoteEntry>
      readonly compact?: (uncommitted) => Effect.Effect<Brackets>
      readonly effect: (options) => Effect.Effect<void>
    }) => Effect.Effect<void, EventJournalError>
    
    readonly changes: Effect.Effect<Queue.Dequeue<Entry>, never, Scope>
    readonly destroy: Effect.Effect<void, EventJournalError>
  }
>() {}
```

### Entry Schema

```typescript
// From: EventJournal.ts:175-216
export class Entry extends Schema.Class<Entry>("Entry")({
  id: EntryId,                    // UUID v7 (timestamp-sortable)
  event: Schema.String,           // Event tag (e.g., "AssetCreated")
  primaryKey: Schema.String,      // Aggregate root ID
  payload: Schema.Uint8ArrayFromSelf  // MsgPack-encoded payload
}) {
  get idString(): string
  get createdAtMillis(): number
  get createdAt(): DateTime.Utc
}
```

**Key fields:**
- **id** - UUID v7 (embeds timestamp, sortable)
- **event** - Event tag for handler dispatch
- **primaryKey** - Aggregate root for conflict resolution
- **payload** - Binary MsgPack data

### Memory Journal

```typescript
// From: EventJournal.ts:231-282
export const makeMemory: Effect.Effect<typeof EventJournal.Service> =
  Effect.gen(function*() {
    const journal: Array<Entry> = []
    const byId = new Map<string, Entry>()
    const remotes = new Map<string, { sequence: number; missing: Array<Entry> }>()
    const pubsub = yield* PubSub.unbounded<Entry>()
    
    return EventJournal.of({
      entries: Effect.sync(() => journal.slice()),
      write({ effect, event, payload, primaryKey }) {
        return Effect.acquireUseRelease(
          Effect.sync(() => new Entry({ id: makeEntryId(), event, primaryKey, payload })),
          effect,
          (entry, exit) => {
            if (exit._tag === "Failure") return Effect.void
            journal.push(entry)
            byId.set(entry.idString, entry)
            return pubsub.publish(entry)
          }
        )
      },
      // ... writeFromRemote, changes, etc.
    })
  })
```

**Usage:**
```typescript
import * as EventJournal from '@effect/experimental/EventJournal'

const TestLayer = EventJournal.makeMemory.pipe(Layer.effect(EventJournal.EventJournal))
```

---

## 8. EventLog Layer Composition

**Location:** `submodules/effect/packages/experimental/src/EventLog.ts:723-735`

### Layer Factory

```typescript
// From: EventLog.ts:731-735
export const layer = <Groups extends EventGroup.Any>(
  _schema: EventLogSchema<Groups>
): Layer.Layer<
  EventLog,
  never,
  EventGroup.ToService<Groups> | EventJournal | Identity
>
```

### Full Layer Stack

```typescript
// Canonical pattern from AMS v2 tests
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { AmsEventLogSchema } from './events/schema'
import { AssetEventHandlers } from './handlers/event-handlers'
import { AssetCompaction } from './handlers/compaction'
import { AssetReactivity } from './handlers/reactivity'

const TestLayer = Layer.mergeAll(
  AssetEventHandlers,
  AssetCompaction,
  AssetReactivity
).pipe(
  Layer.provide(EventLog.layer(AmsEventLogSchema)),
  Layer.provide(EventJournal.makeMemory.pipe(Layer.effect(EventJournal.EventJournal))),
  Layer.provide(EventLog.Identity.makeRandom().pipe(Layer.succeed(EventLog.Identity)))
)
```

**Dependency flow:**
```
EventJournal (persistence)
    ↓
Identity (crypto keys)
    ↓
EventLog.layer(schema)
    ↓
Handlers + Compaction + Reactivity
```

---

## 9. Writing Events (Client API)

**Location:** `submodules/effect/packages/experimental/src/EventLog.ts:741-764`

### makeClient

```typescript
// From: EventLog.ts:741-764
export const makeClient = <Groups extends EventGroup.Any>(
  schema: EventLogSchema<Groups>
): Effect.Effect<
  (<Tag extends Event.Tag<EventGroup.Events<Groups>>>(
    event: Tag,
    payload: Event.PayloadWithTag<EventGroup.Events<Groups>, Tag>
  ) => Effect.Effect<Success, Error | EventJournalError>),
  never,
  EventLog
>
```

### Usage Pattern

```typescript
// From AMS v2 tests
it.effect('writes AssetCreated event', () =>
  Effect.gen(function* () {
    const write = yield* EventLog.makeClient(AmsEventLogSchema)
    
    const result = yield* write('AssetCreated', {
      assetId: 'asset-001',
      siteId: 'site-001',
      kind: 'EQUIPMENT',
      label: 'Forklift #1',
      status: 'available',
      createdBy: 'user-001',
      createdAt: DateTime.unsafeNow(),
    })
    
    // Handler runs, returns void
    expect(result).toBe(void 0)
  }).pipe(Effect.provide(TestLayer))
)
```

**Pattern:**
1. `makeClient(schema)` → returns typed write function
2. `write(tag, payload)` → encodes, persists, runs handler
3. Handler effect is awaited before returning

---

## 10. Remote Sync & Encryption

**Locations:**
- `EventLogRemote.ts` - Client protocol
- `EventLogServer.ts` - Server handlers
- `EventLogEncryption.ts` - AES-GCM encryption

### Remote Protocol

```typescript
// From: EventLogRemote.ts:25-32
export interface EventLogRemote {
  readonly id: RemoteId
  readonly changes: (
    identity: typeof Identity.Service,
    startSequence: number
  ) => Effect.Effect<Mailbox.ReadonlyMailbox<RemoteEntry>, never, Scope>
  readonly write: (identity, entries) => Effect.Effect<void>
}
```

### WebSocket Client

```typescript
// From: EventLogRemote.ts:428-439
export const fromWebSocket = (url: string, options?: {
  readonly disablePing?: boolean
}): Effect.Effect<void, never, Scope | EventLogEncryption | EventLog | WebSocketConstructor>

// Browser layer
export const layerWebSocketBrowser = (url: string): Layer.Layer<never, never, EventLog>
```

### Encryption Layer

```typescript
// From: EventLogEncryption.ts:65-135
export const makeEncryptionSubtle = (crypto: Crypto): Effect.Effect<EventLogEncryption>

export const layerSubtle: Layer.Layer<EventLogEncryption> =
  Layer.effect(EventLogEncryption, makeEncryptionSubtle(globalThis.crypto))
```

**Flow:**
1. Client encrypts entries with Identity.privateKey (AES-GCM)
2. Server stores encrypted entries with sequence numbers
3. Server sends changes to subscribed clients
4. Client decrypts and processes via handlers

**Security:**
- Each identity has `publicKey` (UUID) + `privateKey` (32 bytes)
- Entries encrypted per-identity
- Server sees only encrypted blobs

---

## 11. Test Patterns

**Location:** `src/lib/ams/v2/base/handlers/__tests__/eventlog.test.ts`

### Vitest Integration

```typescript
import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'

describe('EventLog Tests', () => {
  it.effect('test name', () =>
    Effect.gen(function* () {
      const write = yield* EventLog.makeClient(AmsEventLogSchema)
      
      yield* write('AssetCreated', { /* payload */ })
      
      const journal = yield* EventJournal.EventJournal
      const entries = yield* journal.entries
      
      expect(entries).toHaveLength(1)
      expect(entries[0].event).toBe('AssetCreated')
    }).pipe(Effect.provide(TestLayer))
  )
})
```

**Pattern:**
- Use `@effect/vitest` for Effect-based tests
- `it.effect()` instead of `it()`
- Provide test layer with memory journal

---

## 12. Key Patterns Summary

### Event Definition
```typescript
export class PayloadSchema extends Schema.Class<PayloadSchema>('Name')({
  id: BrandedId,
  field: Schema.String,
}) {}

export const Events = EventGroup.empty
  .add({
    tag: 'EventName',
    payload: PayloadSchema,
    primaryKey: (payload) => payload.id,
  })
```

### Schema
```typescript
export const AppEventLogSchema = EventLog.schema(
  DomainEvents1,
  DomainEvents2
)
```

### Handlers
```typescript
export const HandlersLive = EventLog.group(Events, (handlers) =>
  Effect.gen(function* () {
    const service = yield* MyService
    
    return handlers
      .handle('EventName', ({ payload, entry, conflicts }) =>
        Effect.gen(function* () {
          yield* service.updateReadModel(payload)
          return void 0
        })
      )
  })
)
```

### Compaction
```typescript
export const Compaction = EventLog.groupCompaction(Events, ({ primaryKey, events, write }) =>
  Effect.gen(function* () {
    const snapshot = events.reduce((state, event) => /* fold */, initialState)
    yield* write('SnapshotEvent', snapshot)
  })
)
```

### Reactivity
```typescript
export const Reactivity = EventLog.groupReactivity(Events, {
  EventName: ['cache:key:1', 'cache:key:2'],
})
```

### Layer Composition
```typescript
const AppLayer = Layer.mergeAll(
  HandlersLive,
  Compaction,
  Reactivity
).pipe(
  Layer.provide(EventLog.layer(AppEventLogSchema)),
  Layer.provide(EventJournal.makeMemory.pipe(Layer.effect(EventJournal.EventJournal))),
  Layer.provide(EventLog.Identity.makeRandom().pipe(Layer.succeed(EventLog.Identity)))
)
```

### Client Usage
```typescript
Effect.gen(function* () {
  const write = yield* EventLog.makeClient(AppEventLogSchema)
  
  const result = yield* write('EventName', {
    id: 'id-001',
    field: 'value',
  })
  
  // Handler effect has run, result is handler's return value
})
```

---

## 13. File Structure Reference

### Submodule Files

| File | Purpose | Key Exports |
|------|---------|-------------|
| `Event.ts` | Event type + constructor | `Event.make()`, type helpers |
| `EventGroup.ts` | Event group builder | `EventGroup.empty.add()` |
| `EventLog.ts` | Core EventLog service | `schema()`, `group()`, `groupCompaction()`, `groupReactivity()`, `layer()`, `makeClient()` |
| `EventJournal.ts` | Persistence interface | `EventJournal` tag, `Entry`, `makeMemory` |
| `EventLogRemote.ts` | WebSocket client | `fromWebSocket()`, protocol schemas |
| `EventLogServer.ts` | WebSocket server | `makeHandler()`, `Storage` tag |
| `EventLogEncryption.ts` | AES-GCM encryption | `EventLogEncryption` tag, `layerSubtle` |

### AMS v2 Reference Implementation

| File | Purpose | Lines |
|------|---------|-------|
| `events/schema.ts` | EventLog schema definition | 28 |
| `events/asset.ts` | Asset event group | 276 |
| `handlers/event-handlers.ts` | Event handlers | 88 |
| `handlers/compaction.ts` | Compaction logic | 142 |
| `handlers/reactivity.ts` | Cache invalidation | 92 |
| `handlers/__tests__/eventlog.test.ts` | Test examples | 200+ |

---

## 14. Common Pitfalls

### 1. Incomplete Handlers
```typescript
// ❌ WRONG - Not all events handled
EventLog.group(Events, (handlers) =>
  handlers.handle('Event1', ...) // Missing Event2, Event3
)

// ✅ CORRECT - All events handled (TypeScript enforces)
EventLog.group(Events, (handlers) =>
  handlers
    .handle('Event1', ...)
    .handle('Event2', ...)
    .handle('Event3', ...)
)
```

### 2. Wrong Payload Schema
```typescript
// ❌ WRONG - Raw Schema.Struct
.add({
  tag: 'Event',
  payload: Schema.Struct({ id: Schema.String }),  // No class
})

// ✅ CORRECT - Schema.Class
class EventPayload extends Schema.Class<EventPayload>('EventPayload')({
  id: Schema.String,
}) {}

.add({
  tag: 'Event',
  payload: EventPayload,
})
```

### 3. Missing Layer Dependencies
```typescript
// ❌ WRONG - EventLog layer without journal
Effect.provide(EventLog.layer(schema))

// ✅ CORRECT - Full dependency chain
Layer.provide(EventLog.layer(schema))
  .pipe(Layer.provide(EventJournal.makeMemory.pipe(Layer.effect(EventJournal.EventJournal))))
  .pipe(Layer.provide(EventLog.Identity.makeRandom().pipe(Layer.succeed(EventLog.Identity))))
```

### 4. Compaction Without Write
```typescript
// ❌ WRONG - Folding but not writing snapshot
EventLog.groupCompaction(Events, ({ events }) =>
  Effect.gen(function* () {
    const snapshot = events.reduce(...)
    // Forgot to write!
  })
)

// ✅ CORRECT - Write snapshot event
EventLog.groupCompaction(Events, ({ events, write }) =>
  Effect.gen(function* () {
    const snapshot = events.reduce(...)
    yield* write('SnapshotEvent', snapshot)
  })
)
```

---

## 15. Advanced Patterns

### Multi-Domain Event Sourcing

```typescript
// Combine multiple domains
export const AppEventLogSchema = EventLog.schema(
  AssetEvents,
  OrderEvents,
  InventoryEvents
)

// Each domain has its own handlers
const AppHandlers = Layer.mergeAll(
  AssetHandlersLive,
  OrderHandlersLive,
  InventoryHandlersLive
)
```

### Event Upcasting

```typescript
// Handle schema evolution in handlers
EventLog.group(Events, (handlers) =>
  handlers.handle('EventV1', ({ payload }) =>
    Effect.gen(function* () {
      // Upcast V1 → V2
      const v2Payload = {
        ...payload,
        newField: 'default',
      }
      yield* service.process(v2Payload)
    })
  )
)
```

### Saga Orchestration

```typescript
// Handler triggers side effects
EventLog.group(OrderEvents, (handlers) =>
  handlers.handle('OrderPlaced', ({ payload }) =>
    Effect.gen(function* () {
      const write = yield* EventLog.makeClient(InventoryEventLogSchema)
      
      // Trigger inventory reservation
      yield* write('InventoryReserved', {
        orderId: payload.orderId,
        items: payload.items,
      })
    })
  )
)
```

### Conflict Resolution (CRDT)

```typescript
EventLog.group(Events, (handlers) =>
  handlers.handle('ValueChanged', ({ payload, entry, conflicts }) =>
    Effect.gen(function* () {
      if (conflicts.length > 0) {
        // Last-write-wins (LWW)
        const latest = [entry, ...conflicts].sort(
          (a, b) => b.createdAtMillis - a.createdAtMillis
        )[0]
        
        yield* service.setValue(latest.payload.value)
      } else {
        yield* service.setValue(payload.value)
      }
    })
  )
)
```

---

## Conclusion

EventLog provides a complete event sourcing system with:

- **Type-safe events** via Effect Schema
- **Handler exhaustiveness** via TypeScript
- **Compaction** for storage optimization
- **Reactivity** for cache invalidation
- **Remote sync** with encryption
- **Test support** via @effect/vitest

The AMS v2 implementation demonstrates production-ready patterns for domain modeling, handler composition, and layer management.

**Next steps:**
1. Define domain EventGroups with Schema.Class payloads
2. Implement handlers that update read models
3. Add compaction for long-lived aggregates
4. Configure reactivity for cache invalidation
5. Test with memory journal, deploy with SQL journal

---

**References:**
- Submodule: `/submodules/effect/packages/experimental/src/`
- AMS v2: `/src/lib/ams/v2/base/`
- Tests: `/src/lib/ams/v2/base/handlers/__tests__/`
