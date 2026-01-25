# AVA v2 Enhancement Plan

> Research synthesis from Ralph Loop exploration of Effect patterns, effect-atom, and existing implementation.
> **Updated**: Deep MCP research using deepwiki, effect-docs, exa, nia, and submodule exploration.
> **Session 2 Additions**: Proto schema analysis, @effect/platform Socket, ScopedRef, Effect.Match, Effect.Channel

## Executive Summary

AVA v2 TypeScript client is ~85% complete. This document captures research findings and concrete enhancement recommendations based on deep exploration of:

1. **src-ava Rust codebase** - Identified critical gaps at `view_service.rs:141` (gRPC ChannelData) and `hydration.rs:553` (window SQL)
2. **Effect submodule** - Stream.async, Schedule.exponential, Layer.scoped, FiberMap, FiberSet patterns
3. **effect-atom submodule** - Result type, Atom.pull, Atom.subscribable, RuntimeProto methods
4. **effect-docs** - Deferred, PubSub, Queue backpressure strategies, Effect.Match, Effect.Channel, ScopedRef
5. **@effect/platform** - Socket.makeWebSocket, Socket.toChannel for Effect-native WebSocket handling
6. **Proto definitions** - Complete schema analysis of artifacts.proto, events.proto, execution.proto, hydration.proto
7. **Exa code search** - Stream.async strategy options, StreamFlowControl patterns, Queue.bounded backpressure
8. **Existing TypeScript** - NatsClient, AvaClientV2, atoms/v2, hooks/v2

---

## Critical Rust Backend Gaps (Blocking Data Flow)

### Gap 1: ChannelData gRPC Serialization (view_service.rs:141)

**Location**: `/src-ava/ava-api/src/grpc/view_service.rs:126-146`

```rust
fn to_proto_channel_binding(binding: &ava_runtime::ChannelBinding) 
    -> crate::proto::execution::v1::ChannelBinding {
    crate::proto::execution::v1::ChannelBinding {
        // ... other fields ...
        data: None,  // ❌ TODO: Convert ChannelData - BLOCKS ALL DATA
        data_hash: None,
        metadata: std::collections::HashMap::new(),
    }
}
```

**Impact**: ALL artifact data fails to reach TypeScript. Domain `ChannelData` variants (Inline, Rows, AssetRef, StreamHandle, Error, Pending) never converted to proto format.

**Required Implementation**:
```rust
fn to_proto_channel_data(data: &ava_domain::ChannelData) 
    -> Option<crate::proto::execution::v1::ChannelData> {
    match data {
        ChannelData::Inline(value) => /* serde_json → protobuf Value */,
        ChannelData::Rows(rows) => /* Vec<JSON> → Arrow IPC bytes */,
        ChannelData::AssetRef { uri, ... } => /* direct field mapping */,
        ChannelData::StreamHandle { topic, ... } => /* field mapping */,
        ChannelData::Error { code, ... } => /* wrap in ChannelError */,
        ChannelData::Pending => /* pending message */,
    }
}
```

### Gap 2: Window Function SQL (hydration.rs:553)

**Location**: `/src-ava/ava-runtime/src/v2/hydration.rs:553-556`

```rust
PipelineOperator::Window { partition_by, order_by, function } => {
    // Window functions are complex - skip for now
    // TODO: Implement window function SQL generation
}
```

**Impact**: Analytics queries fail. No ROW_NUMBER, RANK, LAG/LEAD, running aggregates.

---

## Pattern Reference

### 1. Stream.async with Backpressure

**Source**: `/submodules/effect/packages/effect/test/Stream/async.test.ts:89-120`

```typescript
// Current implementation (no backpressure control)
Stream.asyncPush<NatsMessage<A>, Error>((emit) => ...)

// Enhanced (with capacity parameter)
Stream.async<NatsMessage<A>, Error>((emit) => {
  // Async iteration of NATS messages
  ;(async () => {
    for await (const msg of subscription) {
      emit(Effect.succeed(Chunk.of(parseMessage(msg))))
    }
    emit.end()
  })()
  // Return cleanup effect
  return Effect.sync(() => subscription.unsubscribe())
}, 100) // capacity: 100 messages buffer before backpressure kicks in
```

**Key insight**: The `capacity` parameter (2nd arg to Stream.async) controls the internal queue size. When full, the emitter blocks until consumer catches up.

### 2. Schedule.exponential with Jitter

**Source**: `/submodules/effect/packages/effect/test/Schedule.test.ts:147-159`

```typescript
import { Schedule, Duration, pipe } from 'effect'

/**
 * NATS retry schedule:
 * - Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
 * - Jittered: +/- 20% randomness to prevent thundering herd
 * - Max 5 attempts
 * - Total timeout: 30 seconds
 */
export const natsRetrySchedule = pipe(
  Schedule.exponential(Duration.millis(100)),
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(5)),
  Schedule.upTo(Duration.seconds(30))
)

// Usage with Effect.retry
yield* pipe(
  connectToNats(config),
  Effect.retry({
    while: (e) => e._tag === 'NatsConnectionError' && e.retryable,
    schedule: natsRetrySchedule,
  }),
  Effect.tapError((e) => Effect.log(`Connection failed: ${e.message}`))
)
```

**Key insight**: `Schedule.jittered` prevents synchronized retries across clients. `Schedule.intersect` enforces both max attempts AND exponential timing.

### 3. FiberMap for Keyed Subscription Management

**Source**: `/submodules/effect/packages/effect/src/FiberMap.ts`

```typescript
import { FiberMap, Effect, Scope } from 'effect'

// Create scope-bound keyed fiber collection
const subscriptions = yield* FiberMap.make<string>()

// Fork and add by key (replaces previous at key)
yield* FiberMap.run(subscriptions, 'orders.*', listenOrdersEffect)
yield* FiberMap.run(subscriptions, 'users.*', listenUsersEffect)

// Conditional add (only if missing - prevents duplicates)
yield* FiberMap.run(subscriptions, 'subject', effect, { onlyIfMissing: true })

// Remove by key (auto-interrupted)
yield* FiberMap.remove(subscriptions, 'orders.*')

// Clear all (interrupts all fibers)
yield* FiberMap.clear(subscriptions)

// Wait for all to settle
yield* FiberMap.join(subscriptions)

// On scope exit: ALL fibers automatically interrupted
```

**Key insight**: FiberMap replaces manual HashMap<ViewId, Fiber> tracking with automatic lifecycle management. Fibers auto-interrupted when scope closes.

### 4. Result Type (effect-atom)

**Source**: `/submodules/effect-atom/packages/atom/src/Result.ts`

```typescript
type Result<A, E> = Initial<A, E> | Success<A, E> | Failure<A, E>

// All variants have `waiting: boolean` independent of state
interface Success<A, E> {
  _tag: 'Success'
  value: A
  waiting: boolean // Can be loading new data while showing old
  timestamp: number
}

interface Failure<A, E> {
  _tag: 'Failure'
  cause: Cause<E>
  waiting: boolean
  previousSuccess: Option<Success<A, E>> // Graceful degradation
}
```

**Key insight**:
- `waiting` flag is orthogonal to state - a Success can have `waiting: true`
- `previousSuccess` enables showing stale data during transient errors
- Use `Result.matchWithWaiting` for exhaustive handling

```typescript
// In React component
const result = useAtomValue(artifactAtom(viewId))

return Result.matchWithWaiting({
  onWaiting: (r) => <Skeleton prev={Result.value(r)} />,
  onError: (cause, r) => <Error cause={cause} prev={Result.value(r)} />,
  onSuccess: (artifact, r) => <ArtifactView artifact={artifact} loading={r.waiting} />
})(result)
```

### 5. Atom.subscribable for Stream Integration

**Source**: `/submodules/effect-atom/packages/atom/src/Atom.ts:902-926`

```typescript
// Create Subscribable from NATS stream
const createArtifactSubscribable = (viewId: ViewId) =>
  Effect.gen(function* () {
    const client = yield* AvaClientV2
    
    return Subscribable.make({
      get: Effect.option(client.getCurrentArtifact(viewId)),
      changes: client.subscribeArtifact(viewId)
    })
  })

// Artifact atom using Subscribable
export const artifactAtom = Atom.family((viewId: ViewId) =>
  avaV2RuntimeAtom.subscribable(
    (get) => createArtifactSubscribable(viewId)
  )
)
// Type: Atom<Result<ViewArtifact, AvaSubscriptionError>>
```

**Key insight**: `Atom.subscribable` wires NATS streams to atoms with automatic Result handling. `sub.get` runs sync for current value; `sub.changes` Stream auto-wired via `get.setSelf()`.

### 6. Atom.pull for Stream Accumulation

**Source**: `/submodules/effect-atom/packages/atom/test/Atom.test.ts:459-511`

```typescript
// Create pull atom that accumulates stream items
const artifactHistoryAtom = Atom.pull(
  Stream.range(0, 100).pipe(
    Stream.tap(() => Effect.sleep(50))
  ),
  { disableAccumulation: false } // Keep all items
)

// Result type
type PullResult<A, E> = Result<{
  done: boolean
  items: NonEmptyArray<A>
}, E>

// Usage
const registry = Registry.make()
registry.mount(artifactHistoryAtom)

// First access - triggers pull
let result = registry.get(artifactHistoryAtom)
// { done: false, items: [0] }

// Trigger next pull
registry.set(artifactHistoryAtom, void 0)
// { done: false, items: [0, 1] }
```

**Key insight**: `Atom.pull` converts pull-based streams into reactive atoms. Useful for infinite scroll, artifact history.

### 7. Deferred for Connection Coordination

**Source**: `/submodules/effect/packages/effect/src/Deferred.ts` + effect-docs

```typescript
// Create one-time completion signal
const connectionDeferred = yield* Deferred.make<void, NatsConnectionError>()

// Signal completion on success
yield* Deferred.succeed(connectionDeferred, undefined)

// Or signal failure
yield* Deferred.fail(connectionDeferred, new NatsConnectionError(...))

// Wait for completion (suspends fiber)
yield* Deferred.await(connectionDeferred)

// Non-blocking check
const status = yield* Deferred.poll(connectionDeferred)
// Option<Effect<void, NatsConnectionError>>
```

**Key insight**: Deferred is already used correctly in NatsClient for `waitForConnection`. Pattern is production-ready.

### 8. PubSub for Internal Event Broadcasting

**Source**: effect-docs documentId:21

```typescript
import { PubSub, Queue, Effect } from 'effect'

// Create bounded PubSub
const eventPubSub = yield* PubSub.bounded<AvaInternalEvent>(100)

// Publisher side
yield* PubSub.publish(eventPubSub, { _tag: 'Connected' })
yield* PubSub.publish(eventPubSub, { _tag: 'ArtifactReceived', viewId })

// Subscriber side (gets dedicated Queue)
const subscription = yield* PubSub.subscribe(eventPubSub)
const event = yield* Queue.take(subscription)
```

**Key insight**: PubSub broadcasts to ALL subscribers (unlike Queue which is 1:1). Use bounded for backpressure.

### 9. Layer.scoped Resource Management

**Source**: `/submodules/effect/packages/effect/test/Layer.test.ts:48-76`

```typescript
export const NatsClientLive = Layer.scoped(
  NatsClient,
  Effect.gen(function* () {
    const config = yield* NatsConfigTag

    // Acquire resource with retry
    const conn = yield* pipe(
      connectToNats(config),
      Effect.retry(natsRetrySchedule)
    )

    // Register cleanup - runs when scope closes
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => conn.drain()).pipe(
        Effect.tap(() => Effect.log('NATS connection drained')),
        Effect.ignore
      )
    )

    return makeNatsClient(conn, config)
  })
)
```

**Key insight**: `Layer.scoped` + `Effect.addFinalizer` provides automatic cleanup when the scope closes (Provider unmount, test teardown, etc.)

### 10. @effect/platform Socket.makeWebSocket

**Source**: effect-docs documentId:3238

```typescript
import { Socket } from '@effect/platform'
import { Effect, Duration } from 'effect'

/**
 * Effect-native WebSocket client with automatic resource management.
 * Alternative to raw WebSocket for type-safe, scoped connections.
 */
const connectNats = Effect.gen(function* () {
  const socket = yield* Socket.makeWebSocket(
    `ws://localhost:9222`,
    {
      openTimeout: Duration.seconds(10),
      closeCodeIsError: (code) => code !== 1000 && code !== 1001,
    }
  )

  return socket
}).pipe(
  Effect.provide(Socket.layerWebSocketConstructorGlobal)
)

// Convert Socket to Channel for bidirectional streaming
const socketChannel = Socket.toChannel<never>(socket)
// Channel<Chunk<Uint8Array>, Chunk<Uint8Array | string | CloseEvent>, SocketError, never, void>
```

**Key insight**: `Socket.makeWebSocket` returns a `Socket` that can be converted to `Channel` for bidirectional streaming. Handles reconnection, error codes, and timeouts Effect-natively.

### 11. Effect.Match for Discriminated Unions

**Source**: effect-docs documentId:10871

```typescript
import { Match } from 'effect'

// Type-safe pattern matching for AVA event types
const handleViewDelta = Match.type<ViewDelta>().pipe(
  Match.tag('ChannelUpdated', ({ channelId, data }) =>
    Effect.sync(() => console.log(`Channel ${channelId} updated`))
  ),
  Match.tag('ChannelActivated', ({ channelId, role }) =>
    Effect.sync(() => console.log(`Channel ${channelId} activated as ${role}`))
  ),
  Match.tag('ChannelDeactivated', ({ channelId, reason }) =>
    Effect.sync(() => console.log(`Channel ${channelId} deactivated: ${reason}`))
  ),
  Match.tag('ArtifactReplaced', ({ newArtifact }) =>
    Effect.sync(() => console.log(`Artifact replaced: v${newArtifact.version}`))
  ),
  Match.tag('StateChanged', ({ previousState, newState }) =>
    Effect.sync(() => console.log(`State: ${previousState} → ${newState}`))
  ),
  Match.orElse((delta) =>
    Effect.sync(() => console.log(`Unhandled delta: ${delta._tag}`))
  )
)

// Usage
yield* handleViewDelta(delta)
```

**Key insight**: `Match.type<T>()` creates exhaustive pattern matching. `Match.tag()` matches on `_tag` discriminator. `Match.orElse` catches unhandled cases.

### Session 3: Additional Research Findings

#### 17. MutableHashMap for Concurrent Fiber Tracking

**Source**: effect-docs MCP + Sequential Thinking

```typescript
import { MutableHashMap, Option, Fiber, Effect } from 'effect'

/**
 * MutableHashMap is preferred over HashMap for concurrent fiber tracking:
 * - In-place mutations (no structural sharing overhead)
 * - Atomic get/set operations
 * - Direct fiber lifecycle management
 */
const fiberMap = yield* MutableHashMap.make<ViewId, Fiber.RuntimeFiber<void, AvaError>>()

// On subscribe - store fiber by viewId
const fiber = yield* subscriptionStream.pipe(Stream.runDrain, Effect.fork)
yield* MutableHashMap.set(fiberMap, viewId, fiber)

// On unsubscribe - interrupt and remove
const maybeFiber = yield* MutableHashMap.get(fiberMap, viewId)
yield* Option.match(maybeFiber, {
  onNone: () => Effect.void,
  onSome: (fiber) => pipe(
    Fiber.interrupt(fiber),
    Effect.andThen(MutableHashMap.remove(fiberMap, viewId))
  )
})
```

#### 18. Stream.groupedWithin for Telemetry Batching

**Source**: effect-docs documentId:5274

```typescript
import { Stream, Duration } from 'effect'

/**
 * Stream.groupedWithin batches elements by:
 * - chunkSize: max items per batch
 * - duration: max time before emitting partial batch
 *
 * Whichever threshold is hit first triggers emission.
 * Perfect for high-frequency telemetry where:
 * - Small payloads should be batched for efficiency
 * - Latency requirements demand periodic flushes
 */
const batchedTelemetry = telemetryStream.pipe(
  Stream.groupedWithin(100, Duration.millis(500)),
  // Batch of 100 items OR 500ms, whichever first
  Stream.mapEffect((batch) => sendBatch(batch))
)
```

**Key insight**: Use `groupedWithin` for P4.5 (LOW) telemetry batching. Not needed for core artifact streaming.

#### 19. effect-atom Registry Patterns (from Atom.test.ts)

**Source**: `submodules/effect-atom/packages/atom/test/Atom.test.ts`

```typescript
import { Atom, Registry, Result } from '@effect-atom/atom'

// 1. Registry creation and basic ops
const registry = Registry.make()
const counter = Atom.make(0)

expect(registry.get(counter)).toBe(0)
registry.set(counter, 5)
expect(registry.get(counter)).toBe(5)

// 2. keepAlive for persistent atoms (not garbage collected)
const persistentAtom = Atom.make(0).pipe(Atom.keepAlive)

// 3. Subscription pattern
let observedValue = 0
const cancel = registry.subscribe(counter, (value) => {
  observedValue = value
})
registry.set(counter, 10)
expect(observedValue).toBe(10)
cancel()  // Unsubscribe

// 4. Result type checks
const result = registry.get(asyncAtom)
assert(Result.isSuccess(result))   // Has value
assert(Result.isInitial(result))   // Never fetched
assert(Result.isFailure(result))   // Error state

// 5. concurrent: true for parallel Effect operations
const concurrentAtom = Atom.fn<number>({ concurrent: true })(
  (n, ctx) => Effect.delay(Duration.millis(n))
)
```

#### 20. ReconcilerEvent for Event Sourcing (Deferred)

**Source**: `src-ava/proto/ava/events/v1/events.proto`

```protobuf
message ReconcilerEvent {
  string event_id = 1;
  google.protobuf.Timestamp occurred_at = 2;
  ReconcilerEventType event_type = 3;
  string view_id = 4;
  oneof payload {
    ViewCreated view_created = 10;
    ViewUpdated view_updated = 11;
    ViewDeleted view_deleted = 12;
    ChannelBound channel_bound = 13;
    ChannelUnbound channel_unbound = 14;
    HydrationStarted hydration_started = 15;
    HydrationCompleted hydration_completed = 16;
    HydrationFailed hydration_failed = 17;
    DeltaPublished delta_published = 18;
  }
}
```

**Analysis**: This is a full EVENT SOURCING pattern. The reconciler emits events for every state change. However, this is P3.3 (LOW priority) since:
- Client primarily needs ViewArtifact/ViewDelta (already implemented)
- ReconcilerEvents are more for debugging/admin use cases
- Focus remains on P1 (robustness) and P2 (lifecycle)

### 12. Effect.ScopedRef for Connection State

**Source**: effect-docs documentId:9532, deepwiki

```typescript
import { ScopedRef, Effect, Scope } from 'effect'

/**
 * ScopedRef holds a resource that is automatically cleaned up when:
 * 1. The scope closes
 * 2. The value is replaced (old value cleaned up)
 *
 * Perfect for WebSocket connections that may need reconnection.
 */
const connectionRef = yield* ScopedRef.fromAcquire(
  Effect.gen(function* () {
    const conn = yield* connectToNats(config)

    // Finalizer runs when this value is replaced or scope closes
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => conn.drain()).pipe(Effect.ignore)
    )

    return conn
  })
)

// Get current connection
const conn = yield* ScopedRef.get(connectionRef)

// Replace connection (old one auto-drained)
yield* ScopedRef.set(connectionRef,
  Effect.gen(function* () {
    const newConn = yield* connectToNats(newConfig)
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => newConn.drain()).pipe(Effect.ignore)
    )
    return newConn
  })
)
```

**Key insight**: Use `ScopedRef` for connections that may need dynamic replacement. Use `Ref` for simple state, `FiberRef` for fiber-local context.

### 13. Stream.async with Strategy Parameter

**Source**: Exa code search

```typescript
import { Stream, Chunk, Effect } from 'effect'

/**
 * Stream.async supports backpressure strategies:
 * - 'suspend': Block producer until consumer catches up (default)
 * - 'dropping': Drop oldest messages when buffer full
 * - 'sliding': Drop newest messages when buffer full
 */
const natsSubscription = Stream.async<NatsMessage, never>(
  (emit) => {
    const subscription = nats.subscribe('ava.>')

    ;(async () => {
      for await (const msg of subscription) {
        emit(Effect.succeed(Chunk.of(parseMessage(msg))))
      }
      emit.end()
    })()

    return Effect.sync(() => subscription.unsubscribe())
  },
  {
    bufferSize: 100,
    strategy: 'dropping' // Drop oldest when buffer full
  }
)
```

**Key insight**: Strategy parameter controls backpressure behavior. Use `'dropping'` for telemetry streams where freshness matters more than completeness.

### 14. Effect.Channel for Bidirectional Streaming

**Source**: effect-docs documentId:5319

```typescript
import { Channel, Chunk, Effect, pipe } from 'effect'

/**
 * Channel represents bidirectional, pull-based streaming with:
 * - Input: messages sent TO the channel
 * - Output: messages received FROM the channel
 * - Done: completion value
 */
type NatsChannel = Channel.Channel<
  Chunk<NatsMessage>,           // Output (InElem for downstream)
  Chunk<string>,                // Input (OutElem from upstream)
  NatsError,                    // OutErr
  never,                        // InErr
  void,                         // OutDone
  unknown                       // InDone
>

// Create WebSocket channel from Socket
const wsChannel = Socket.makeWebSocketChannel<never>(
  'ws://localhost:9222',
  { closeCodeIsError: (code) => code !== 1000 }
)

// Map messages through the channel
const natsChannel = pipe(
  wsChannel,
  Channel.mapOut((chunk) =>
    Chunk.map(chunk, (bytes) => decodeNatsMessage(bytes))
  ),
  Channel.mapInput((chunk) =>
    Chunk.map(chunk, (msg) => encodeNatsMessage(msg))
  )
)
```

**Key insight**: `Channel` is more powerful than `Stream` for bidirectional protocols like WebSocket. Compose channels for protocol layering.

### 15. Proto Schema Summary (ChannelData Variants)

**Source**: `src-ava/proto/ava/execution/v1/hydration.proto`

```protobuf
// ChannelData - The 6 payload variants TypeScript must handle
message ChannelData {
  oneof data {
    InlineData inline = 1;       // JSON-like value (small payloads)
    RowSet rows = 2;             // Arrow IPC (tabular data)
    AssetRef asset_ref = 3;      // External file reference
    StreamHandle stream_handle = 4; // Live stream subscription
    ChannelError error = 5;      // Channel-specific error
    Pending pending = 6;         // Loading placeholder
  }
}

// StreamHandle includes backpressure config
message StreamHandle {
  string topic = 1;
  optional uint64 cursor = 2;
  optional StreamProtocol protocol = 4;  // GRPC_SERVER_STREAM, WEBSOCKET, SSE
  optional BackpressureConfig backpressure = 5;
}

// BackpressureConfig - matches Effect Queue strategies
message BackpressureConfig {
  uint32 high_water_mark = 1;
  uint32 low_water_mark = 2;
  OverflowStrategy overflow_strategy = 3;  // DROP_OLDEST, DROP_NEWEST, BLOCK, ERROR
}
```

**Key insight**: OverflowStrategy maps directly to Stream.async strategies:
- `DROP_OLDEST` → `'dropping'`
- `DROP_NEWEST` → `'sliding'`
- `BLOCK` → `'suspend'`
- `ERROR` → custom error handling

### 16. ViewDelta Event Types (Proto)

**Source**: `src-ava/proto/ava/artifacts/v1/artifacts.proto`

```protobuf
// ViewDelta - 7 discriminated delta types for incremental updates
message ViewDelta {
  ViewId view_id = 1;
  uint64 sequence = 2;          // For ordering
  Timestamp timestamp = 3;

  oneof delta {
    ChannelUpdated channel_updated = 10;
    ChannelActivated channel_activated = 11;
    ChannelDeactivated channel_deactivated = 12;
    ChannelCleared channel_cleared = 13;
    ArtifactReplaced artifact_replaced = 14;
    StateChanged state_changed = 15;
    MetadataUpdated metadata_updated = 16;
  }
}

// ChannelUpdated includes diff metadata
message ChannelUpdated {
  ChannelId channel_id = 1;
  uint32 row_count = 2;
  optional ChannelData data = 4;
  optional string data_hash = 5;
  bool is_full_refresh = 6;
  repeated RowRange affected_rows = 7;  // For partial updates
}
```

**TypeScript Schema** (to implement):
```typescript
import { Schema } from 'effect'

const ViewDelta = Schema.Union(
  Schema.TaggedStruct('ChannelUpdated', {
    channelId: ChannelId,
    rowCount: Schema.Number,
    data: Schema.optional(ChannelData),
    dataHash: Schema.optional(Schema.String),
    isFullRefresh: Schema.Boolean,
    affectedRows: Schema.Array(RowRange),
  }),
  Schema.TaggedStruct('ChannelActivated', {
    channelId: ChannelId,
    role: ChannelRole,
    schema: Schema.optional(Schema.String),
  }),
  // ... other variants
)
```

---

## Enhancement Implementation Plan

### Phase 1: Robustness (P1 Priority)

#### 1.1 Add Retry Schedule to NatsClient

**File**: `src/lib/ava/services/NatsClient.ts`

```typescript
// Add after imports
import { Schedule, Duration, pipe, Chunk } from 'effect'

export const natsRetrySchedule = pipe(
  Schedule.exponential(Duration.millis(100)),
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(5)),
  Schedule.upTo(Duration.seconds(30))
)

// Update NatsConnectionError
export class NatsConnectionError extends Data.TaggedError('NatsConnectionError')<{
  readonly message: string
  readonly cause?: unknown
  readonly retryable: boolean // NEW
}> {
  static transient(message: string, cause?: unknown) {
    return new NatsConnectionError({ message, cause, retryable: true })
  }
  static permanent(message: string, cause?: unknown) {
    return new NatsConnectionError({ message, cause, retryable: false })
  }
}

// Update connection logic (around line 234)
const nc = yield* pipe(
  Effect.tryPromise({
    try: async () => {
      const conn = await natsModule.connect({
        servers: config.serverUrl,
        timeout: config.timeout,
      })
      return conn as unknown as NatsConnection
    },
    catch: (error) => NatsConnectionError.transient(
      `Failed to connect to NATS at ${config.serverUrl}`,
      error
    ),
  }),
  Effect.retry({
    while: (e) => e.retryable,
    schedule: natsRetrySchedule,
  }),
  Effect.tapError((e) => Effect.log(`NATS connection failed after retries`))
)
```

#### 1.2 Add Backpressure to Subscriptions

**File**: `src/lib/ava/services/NatsClient.ts`

Update `subscribe` method (around line 304):

```typescript
// Add to SubscriptionOptions interface
export interface SubscriptionOptions {
  readonly queue?: string
  readonly max?: number
  readonly bufferCapacity?: number // NEW: default 100
}

// In subscribe method - replace Stream.asyncPush with Stream.async
const BUFFER_CAPACITY = options?.bufferCapacity ?? 100

return Stream.async<NatsMessage<Uint8Array>, NatsSubscriptionError>(
  (emit) => {
    ;(async () => {
      try {
        for await (const msg of sub) {
          emit(Effect.succeed(Chunk.of({
            subject: msg.subject,
            data: msg.data,
            timestamp: Date.now(),
          })))
        }
        emit.end()
      } catch (error) {
        emit.fail(new NatsSubscriptionError({
          subject: fullSubject,
          message: String(error),
          cause: error,
        }))
      }
    })()
    return Effect.sync(() => sub.unsubscribe())
  },
  BUFFER_CAPACITY // Backpressure at 100 messages
)
```

#### 1.3 Wire Traced Operations into AvaClientV2

**File**: `src/lib/ava/services/AvaClientV2.ts`

```typescript
import { avaFn, withAvaSpan } from '../utils/traced'

// Replace method implementations
subscribeArtifact: (viewId: ViewId) => {
  const subject = subjects.artifact(viewId)
  return nats.subscribeJson<unknown>(subject).pipe(
    Stream.mapError(mapNatsError(viewId)),
    Stream.mapEffect((msg) => decodeJson(ViewArtifact, msg.subject)(msg.data)),
    withAvaSpan('artifact', 'stream', { viewId })
  )
},

invalidate: avaFn('subscription', 'invalidate', (viewId: ViewId, reason?: string) =>
  Effect.gen(function* () {
    const nats = yield* NatsClient
    yield* nats.publishJson(subjects.invalidate(viewId), { view_id: viewId, reason, force: false })
  })
),

requestSubscribe: avaFn('subscription', 'requestSubscribe', (viewId: ViewId) =>
  Effect.gen(function* () {
    const nats = yield* NatsClient
    yield* nats.publishJson(subjects.subscribe(viewId), { view_id: viewId })
  })
),
```

### Phase 2: Subscription Management (P2)

#### 2.1 FiberMap for Subject-Keyed Subscriptions

**File**: `src/lib/ava/atoms/v2/index.ts`

```typescript
import { FiberMap, Effect, Scope } from 'effect'

// Replace HashMap-based tracking with FiberMap
const subscriptionMapAtom = Atom.make<FiberMap.FiberMap<string> | null>(null)

// Connect operation creates FiberMap
connect: Atom.fn()((_, ctx) =>
  Effect.gen(function* () {
    const subscriptions = yield* FiberMap.make<string>()
    ctx.set(subscriptionMapAtom, subscriptions)
    // ... existing connection logic
  }).pipe(Effect.scoped)
),

// Subscribe uses FiberMap.run
subscribeView: Atom.fn<ViewId>()((viewId, ctx) =>
  Effect.gen(function* () {
    const client = yield* AvaClientV2
    const subMap = ctx(subscriptionMapAtom)
    if (!subMap) return
    
    yield* FiberMap.run(
      subMap,
      viewId,
      client.subscribeArtifact(viewId).pipe(
        Stream.runForEach((artifact) => 
          Effect.sync(() => ctx.set(artifactAtom(viewId), Result.success(artifact)))
        )
      ),
      { onlyIfMissing: true }
    )
  })
),

// Unsubscribe removes specific fiber
unsubscribeView: Atom.fn<ViewId>()((viewId, ctx) =>
  Effect.gen(function* () {
    const subMap = ctx(subscriptionMapAtom)
    if (!subMap) return
    yield* FiberMap.remove(subMap, viewId)
    ctx.set(artifactAtom(viewId), Result.initial(false))
  })
),

// Unsubscribe all clears entire map
unsubscribeAll: Atom.fn()((_,ctx) =>
  Effect.gen(function* () {
    const subMap = ctx(subscriptionMapAtom)
    if (!subMap) return
    yield* FiberMap.clear(subMap)
  })
),
```

### Phase 3: Atom Integration (P3)

#### 3.1 Atom.subscribable for Artifact Streams

**File**: `src/lib/ava/atoms/v2/index.ts`

```typescript
import { Subscribable } from 'effect'

// Create Subscribable from NATS stream
const createArtifactSubscribable = (viewId: ViewId) =>
  Effect.gen(function* () {
    const client = yield* AvaClientV2
    
    return Subscribable.make({
      get: Effect.succeed(undefined as ViewArtifact | undefined),
      changes: client.subscribeArtifact(viewId)
    })
  })

// Artifact atom using Subscribable
export const artifactAtom = Atom.family((viewId: ViewId) =>
  avaV2RuntimeAtom.subscribable(
    (get) => createArtifactSubscribable(viewId)
  )
)
```

#### 3.2 Result.matchWithWaiting in Hooks

**File**: `src/lib/ava/hooks/v2/index.ts`

```typescript
import { Result } from '@effect-atom/atom'
import { Option } from 'effect'

/**
 * Helper for Result-based rendering with loading states
 */
export function renderArtifactResult<A>(
  result: Result.Result<A, unknown>,
  handlers: {
    loading: (prev?: A) => ReactNode
    error: (cause: unknown, prev?: A) => ReactNode
    success: (value: A, isRefreshing: boolean) => ReactNode
  }
): ReactNode {
  return Result.matchWithWaiting({
    onWaiting: (r) => handlers.loading(
      Result.value(r).pipe(Option.getOrUndefined)
    ),
    onError: (cause, r) => handlers.error(
      cause,
      r.previousSuccess.pipe(
        Option.map(s => s.value),
        Option.getOrUndefined
      )
    ),
    onSuccess: (value, r) => handlers.success(value, r.waiting),
  })(result)
}

/**
 * Hook with Result.matchWithWaiting helper
 */
export function useArtifact(viewId: ViewId) {
  const result = useAtomValue(artifactAtom(viewId))
  
  return {
    artifact: Result.isSuccess(result) ? result.value : undefined,
    isLoading: result.waiting,
    isError: Result.isFailure(result),
    
    match: <R>(handlers: {
      loading: (prev?: ViewArtifact) => R
      error: (cause: unknown, prev?: ViewArtifact) => R
      success: (artifact: ViewArtifact, isRefreshing: boolean) => R
    }): R => Result.matchWithWaiting({
      onWaiting: (r) => handlers.loading(Result.value(r).pipe(Option.getOrUndefined)),
      onError: (cause, r) => handlers.error(cause, r.previousSuccess.pipe(Option.map(s => s.value), Option.getOrUndefined)),
      onSuccess: (value, r) => handlers.success(value, r.waiting),
    })(result)
  }
}
```

#### 3.3 Atom.pull for Artifact History

**File**: `src/lib/ava/atoms/v2/index.ts`

```typescript
/**
 * Artifact history atom - accumulates all artifacts for a view
 * Useful for changelog, diff views, time-travel debugging
 */
export const artifactHistoryAtom = Atom.family((viewId: ViewId) =>
  avaV2RuntimeAtom.pull(
    (get) => {
      const client = get(AvaClientV2)
      return client.subscribeArtifact(viewId)
    },
    { disableAccumulation: false }
  )
)

// Usage in hooks
export function useArtifactHistory(viewId: ViewId) {
  const result = useAtomValue(artifactHistoryAtom(viewId))

  return {
    artifacts: Result.isSuccess(result) ? result.value.items : [],
    isLoading: result.waiting,
    isDone: Result.isSuccess(result) && result.value.done,
    pullMore: () => avaV2Registry.set(artifactHistoryAtom(viewId), undefined),
  }
}
```

---

## Validation Criteria

### Functional Tests

- [ ] Connection retries 5 times with visible exponential delay logs
- [ ] Jitter varies delays ±20% (no synchronized retries in load test)
- [ ] Backpressure blocks emitter when consumer lags (test with slow consumer)
- [ ] FiberMap cleanup interrupts all on scope exit (no orphan fibers)
- [ ] `ava.*` trace spans visible in console output
- [ ] Provider unmount triggers cleanup without orphan subscriptions
- [ ] `Result.matchWithWaiting` renders correct state for each transition
- [ ] `Atom.pull` accumulates items array with each pull

### Integration Tests

```typescript
// File: src/lib/ava/__tests__/ava-v2-integration.test.ts

describe('AVA v2 Integration', () => {
  it.effect('retries connection on transient failure', () =>
    Effect.gen(function* () {
      const attempts = yield* Ref.make(0)

      const failingConnect = yield* pipe(
        Effect.tap(Ref.update(attempts, n => n + 1)),
        Effect.flatMap(() => Effect.fail(
          NatsConnectionError.transient('simulated failure')
        )),
        Effect.retry(natsRetrySchedule)
      ).pipe(Effect.exit)

      const count = yield* Ref.get(attempts)
      expect(count).toBe(5) // Max retries
    })
  )

  it.effect('backpressure blocks emitter', () =>
    Effect.gen(function* () {
      const emittedCount = yield* Ref.make(0)

      const stream = Stream.async<number>((emit) => {
        Array.from({ length: 150 }).forEach((_, i) => {
          Ref.update(emittedCount, n => n + 1).pipe(Effect.runSync)
          emit(Effect.succeed(Chunk.of(i)))
        })
        return Effect.void
      }, 100) // Capacity 100

      // Take only 10
      yield* stream.pipe(Stream.take(10), Stream.runDrain)

      const count = yield* Ref.get(emittedCount)
      // Should have emitted ~110 (100 buffer + ~10 consumed)
      expect(count).toBeLessThan(120)
    })
  )
  
  it.effect('FiberMap interrupts all on clear', () =>
    Effect.gen(function* () {
      const interrupted = yield* Ref.make<string[]>([])
      
      yield* Effect.scoped(
        Effect.gen(function* () {
          const map = yield* FiberMap.make<string>()
          
          yield* FiberMap.run(map, 'a', 
            Effect.never.pipe(
              Effect.onInterrupt(() => 
                Ref.update(interrupted, arr => [...arr, 'a'])
              )
            )
          )
          yield* FiberMap.run(map, 'b',
            Effect.never.pipe(
              Effect.onInterrupt(() =>
                Ref.update(interrupted, arr => [...arr, 'b'])
              )
            )
          )
          
          yield* FiberMap.clear(map)
        })
      )
      
      const result = yield* Ref.get(interrupted)
      expect(result).toContain('a')
      expect(result).toContain('b')
    })
  )
})
```

---

## Enhancement Summary Table

| Phase | Enhancement | File | Priority |
|-------|-------------|------|----------|
| P1.1 | Retry schedule | NatsClient.ts | HIGH |
| P1.2 | Retryable error flag | NatsClient.ts | HIGH |
| P1.3 | Stream.async backpressure | NatsClient.ts | HIGH |
| P1.4 | Tracing integration | AvaClientV2.ts | MEDIUM |
| P2.1 | FiberMap subscriptions | atoms/v2/index.ts | HIGH |
| P2.2 | PubSub events (optional) | atoms/v2/index.ts | LOW |
| P3.1 | Atom.subscribable | atoms/v2/index.ts | MEDIUM |
| P3.2 | Result.matchWithWaiting | hooks/v2/index.ts | MEDIUM |
| P3.3 | Atom.pull history | atoms/v2/index.ts | LOW |

### Phase 4: Advanced Patterns (P4 - Future)

#### 4.1 Effect.Match for Delta Handling

**File**: `src/lib/ava/services/AvaClientV2.ts`

```typescript
import { Match, Effect } from 'effect'

export const handleDelta = Match.type<ViewDelta>().pipe(
  Match.tag('ChannelUpdated', (delta) =>
    Effect.gen(function* () {
      yield* logAvaEvent('channel_updated', { channelId: delta.channelId })
      // Update channel atom
    })
  ),
  Match.tag('ArtifactReplaced', (delta) =>
    Effect.gen(function* () {
      yield* logAvaEvent('artifact_replaced', { version: delta.newArtifact.version })
      // Replace entire artifact
    })
  ),
  Match.orElse((delta) =>
    Effect.logWarning(`Unhandled delta type: ${delta._tag}`)
  )
)
```

#### 4.2 @effect/platform Socket Migration (Optional)

**File**: `src/lib/ava/services/NatsClient.ts`

Consider migrating from raw WebSocket to `@effect/platform/Socket`:

```typescript
import { Socket } from '@effect/platform'

// Alternative connection approach
export const NatsClientPlatformLayer = Layer.scoped(
  NatsClient,
  Effect.gen(function* () {
    const socket = yield* Socket.makeWebSocket(config.serverUrl, {
      openTimeout: Duration.millis(config.timeout),
      closeCodeIsError: (code) => code !== 1000,
    })

    // Convert to Channel for bidirectional communication
    const channel = Socket.toChannel<NatsProtocolError>(socket)

    // ... build client around channel
  }).pipe(
    Effect.provide(Socket.layerWebSocketConstructorGlobal)
  )
)
```

**Trade-offs**:
- ✅ Effect-native, automatic resource management
- ✅ Built-in error codes handling
- ⚠️ May not support NATS-specific protocol extensions
- ⚠️ Requires testing with nats.ws library

#### 4.3 ScopedRef for Reconnectable Connection

**File**: `src/lib/ava/services/NatsClient.ts`

```typescript
import { ScopedRef, Effect } from 'effect'

// ScopedRef enables connection replacement without service restart
export const makeReconnectableClient = Effect.gen(function* () {
  const connectionRef = yield* ScopedRef.fromAcquire(
    connectToNats(config).pipe(
      Effect.tap((conn) =>
        Effect.addFinalizer(() =>
          Effect.promise(() => conn.drain()).pipe(Effect.ignore)
        )
      )
    )
  )

  // Reconnect replaces connection, old one auto-drained
  const reconnect = (newConfig: NatsConfig) =>
    ScopedRef.set(connectionRef,
      connectToNats(newConfig).pipe(
        Effect.tap((conn) =>
          Effect.addFinalizer(() =>
            Effect.promise(() => conn.drain()).pipe(Effect.ignore)
          )
        )
      )
    )

  return {
    get: ScopedRef.get(connectionRef),
    reconnect,
  }
})
```

#### 4.4 ViewDelta Schema Implementation

**File**: `src/lib/ava/schemas/v2/index.ts`

```typescript
import { Schema } from 'effect'

// ChannelData - 6 variants from hydration.proto
export const ChannelData = Schema.Union(
  Schema.TaggedStruct('Inline', {
    value: Schema.Unknown,
    typeHint: Schema.optional(Schema.String),
  }),
  Schema.TaggedStruct('Rows', {
    arrowIpc: Schema.Uint8ArrayFromBase64,
    rowCount: Schema.Number,
    columnCount: Schema.Number,
    codec: Schema.optional(Codec),
    schemaHash: Schema.optional(Schema.String),
  }),
  Schema.TaggedStruct('AssetRef', {
    uri: Schema.String,
    mimeType: Schema.optional(Schema.String),
    etag: Schema.optional(Schema.String),
    contentHash: Schema.optional(Schema.String),
    sizeBytes: Schema.optional(Schema.BigInt),
    filename: Schema.optional(Schema.String),
  }),
  Schema.TaggedStruct('StreamHandle', {
    topic: Schema.String,
    cursor: Schema.optional(Schema.BigInt),
    protocol: Schema.optional(StreamProtocol),
    backpressure: Schema.optional(BackpressureConfig),
  }),
  Schema.TaggedStruct('Error', {
    code: Schema.String,
    message: Schema.String,
    details: Schema.optional(Schema.Unknown),
  }),
  Schema.TaggedStruct('Pending', {
    progress: Schema.optional(Schema.Number),
    status: Schema.optional(Schema.String),
    eta: Schema.optional(Schema.DateFromSelf),
    cancellable: Schema.Boolean,
  }),
)
export type ChannelData = typeof ChannelData.Type

// ViewDelta - 7 variants from artifacts.proto
export const ViewDelta = Schema.Struct({
  viewId: ViewId,
  sequence: Schema.BigInt,
  timestamp: Schema.DateFromSelf,
  delta: Schema.Union(
    Schema.TaggedStruct('ChannelUpdated', {
      channelId: ChannelId,
      rowCount: Schema.Number,
      data: Schema.optional(ChannelData),
      dataHash: Schema.optional(Schema.String),
      isFullRefresh: Schema.Boolean,
      affectedRows: Schema.Array(RowRange),
    }),
    Schema.TaggedStruct('ChannelActivated', {
      channelId: ChannelId,
      role: ChannelRole,
      schema: Schema.optional(Schema.String),
    }),
    Schema.TaggedStruct('ChannelDeactivated', {
      channelId: ChannelId,
      reason: DeactivationReason,
    }),
    Schema.TaggedStruct('ChannelCleared', {
      channelId: ChannelId,
      reason: Schema.String,
    }),
    Schema.TaggedStruct('ArtifactReplaced', {
      newArtifact: ViewArtifact,
      previousVersion: Schema.optional(Schema.Number),
      reason: ReplacementReason,
    }),
    Schema.TaggedStruct('StateChanged', {
      previousState: ArtifactState,
      newState: ArtifactState,
      reason: Schema.optional(Schema.String),
    }),
    Schema.TaggedStruct('MetadataUpdated', {
      updated: Schema.Record({ key: Schema.String, value: Schema.String }),
      removed: Schema.Array(Schema.String),
    }),
  ),
})
export type ViewDelta = typeof ViewDelta.Type
```

---

## Enhancement Summary Table (Updated)

| Phase | Enhancement | File | Priority |
|-------|-------------|------|----------|
| P1.1 | Retry schedule | NatsClient.ts | HIGH |
| P1.2 | Retryable error flag | NatsClient.ts | HIGH |
| P1.3 | Stream.async backpressure | NatsClient.ts | HIGH |
| P1.4 | Tracing integration | AvaClientV2.ts | MEDIUM |
| P2.1 | FiberMap subscriptions | atoms/v2/index.ts | HIGH |
| P2.2 | PubSub events (optional) | atoms/v2/index.ts | LOW |
| P3.1 | Atom.subscribable | atoms/v2/index.ts | MEDIUM |
| P3.2 | Result.matchWithWaiting | hooks/v2/index.ts | MEDIUM |
| P3.3 | Atom.pull history | atoms/v2/index.ts | LOW |
| **P4.1** | **Effect.Match deltas** | **AvaClientV2.ts** | **MEDIUM** |
| **P4.2** | **Platform Socket** | **NatsClient.ts** | **LOW** |
| **P4.3** | **ScopedRef reconnect** | **NatsClient.ts** | **LOW** |
| **P4.4** | **ViewDelta Schema** | **schemas/v2/index.ts** | **HIGH** |

---

## Beads Issues

### Feature Issues (Dependencies)

| Issue ID | Title | Priority | Blocks |
|----------|-------|----------|--------|
| `tmnl-i7cbp` | AVA v2 TypeScript Client - Robustness Layer (P1) | HIGH | tmnl-gkosv |
| `tmnl-gkosv` | AVA v2 TypeScript Client - Lifecycle Management (P2) | HIGH | tmnl-94uyl |
| `tmnl-94uyl` | AVA v2 TypeScript Client - Type Safety Enhancements (P4) | MEDIUM | - |

### Task Issues

| Issue ID | Title | Parent | Status |
|----------|-------|--------|--------|
| `tmnl-k6eg9` | P1.1: Implement retry with exponential backoff | tmnl-i7cbp | Open |
| `tmnl-3vf3j` | P1.3: Add backpressure handling via Stream.async strategy | tmnl-i7cbp | Open |
| `tmnl-tgj2l` | P2.1: Implement FiberMap for subscription management | tmnl-gkosv | Open |
| `tmnl-7cppw` | P4.1: Use Effect.Match for ViewDelta discrimination | tmnl-94uyl | Open |

### Pre-existing Issues

| Issue ID | Title | Status | Notes |
|----------|-------|--------|-------|
| `tmnl-zjyrg` | Implement AvaProvider | DONE | Close with commit ref |
| `tmnl-rgy9x` | [Rust] gRPC ChannelData | Open | CRITICAL - Requires Rust team |
| `tmnl-xmyd2` | Wire traced operations | Open | Phase P1.4 |
| `tmnl-73nxp` | Add retry logic | Open | Phase P1.1 |

### Dependency Graph

```
tmnl-i7cbp (Robustness P1)
    ├─── tmnl-k6eg9 (retry backoff)
    └─── tmnl-3vf3j (backpressure)
          │
          ▼
tmnl-gkosv (Lifecycle P2)
    └─── tmnl-tgj2l (FiberMap)
          │
          ▼
tmnl-94uyl (Type Safety P4)
    └─── tmnl-7cppw (Effect.Match)
```

---

## References

### Submodule Sources
- Effect Stream docs: `/submodules/effect/packages/effect/src/Stream.ts`
- Effect Schedule docs: `/submodules/effect/packages/effect/src/Schedule.ts`
- Effect FiberMap: `/submodules/effect/packages/effect/src/FiberMap.ts`
- Effect Channel: `/submodules/effect/packages/effect/src/Channel.ts`
- Effect Match: `/submodules/effect/packages/effect/src/Match.ts`
- Effect ScopedRef: `/submodules/effect/packages/effect/src/ScopedRef.ts`
- effect-atom Result: `/submodules/effect-atom/packages/atom/src/Result.ts`
- effect-atom Atom.pull: `/submodules/effect-atom/packages/atom/src/Atom.ts:1190-1311`
- effect-atom Subscribable: `/submodules/effect-atom/packages/atom/src/Atom.ts:902-926`

### effect-docs MCP (Document IDs)
- Deferred: documentId:19
- PubSub: documentId:21
- Queue: documentId:23
- Match: documentId:10871
- Channel: documentId:5319
- ScopedRef.make: documentId:9532
- Socket.makeWebSocket: documentId:3238
- Socket.toChannel: documentId:3234
- Socket.makeWebSocketChannel: documentId:3240

### External Resources
- DeepWiki Effect WebSocket: https://deepwiki.com/Effect-TS/effect#4.4
- Exa Effect-TS Stream patterns: https://exa.ai (code context search)

### Proto Definitions (src-ava)
- `src-ava/proto/ava/artifacts/v1/artifacts.proto` - ViewArtifact, ViewDelta, ArtifactState
- `src-ava/proto/ava/events/v1/events.proto` - ReconcilerEvent, FiberAction
- `src-ava/proto/ava/execution/v1/execution.proto` - ViewProfileSpec, ChannelRole, PipelineOperator
- `src-ava/proto/ava/execution/v1/hydration.proto` - ChannelData, ChannelBinding, BackpressureConfig
- `src-ava/proto/ava/common/v1/identifiers.proto` - ViewId, ChannelId, AssetId
- `src-ava/proto/ava/common/v1/errors.proto` - AvaError, ChannelError
