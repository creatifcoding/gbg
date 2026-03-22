# Phase 5: WebSocket Real-time Architecture (Epic 20)

**Date**: 2026-02-07
**Status**: ARCHITECTURE — Ready for implementation
**Author**: architect-agent (Val)
**Scope**: Epic 20 — Real-time Subscriptions (8 SP)
**Dependencies**: Epic 19 (Stream Processing), Epic 15 (Event Handlers), Phase 4 (HTTP/RPC)

---

## Executive Summary

Epic 20 adds **WebSocket-based real-time subscriptions** to the IIoT system. Clients connect via WebSocket and subscribe to channels (alarm events, sensor readings, equipment state changes). The architecture leverages the existing `RpcServer.layerProtocolWebsocketRouter` pattern (already proven in `SearchRpcServer` at `/geoint/search`) combined with an internal PubSub-based event distribution layer.

The system already has:
- `RpcServer.layerProtocolWebsocketRouter` used at `/geoint/search` and `/geoint/ingestion` (proven pattern)
- `RpcSerialization.layerJson` / `RpcSerialization.layerNdjson` for wire format
- `SensorRpcs.Subscribe` RPC with `stream: true` (ready to back with real data)
- `EventLog.groupReactivity` for cache invalidation (`alarm-reactivity.ts`)
- `PubSub` used extensively throughout the codebase (ChannelService, event bus)
- `Stream.fromPubSub` for converting PubSub to Stream (used in ChannelService)

Epic 20 unifies these into a cohesive real-time subscription system.

---

## Architecture Decision: RPC WebSocket vs Raw WebSocket

### Option Analysis

| Option | Pros | Cons | Probability |
|--------|------|------|-------------|
| **A: RpcServer.layerProtocolWebsocketRouter** | Type-safe, schema-validated, streaming RPCs, proven in codebase | Requires RPC definitions for each subscription | **75%** |
| B: Raw Bun WebSocket handlers | Full control, custom protocol | No schema validation, manual serialization, reinventing | 10% |
| C: Hybrid (RPC for structured, raw for raw streams) | Flexibility | Two protocols to maintain, complexity | 10% |
| D: Server-Sent Events (SSE) | Simple, HTTP-native, no upgrade needed | One-directional only, no client-to-server messages | 5% |

### Decision: Option A — RpcServer.layerProtocolWebsocketRouter

**Rationale**:
1. **Already proven** — `SearchRpcServer` at `/geoint/search` uses this exact pattern with streaming RPCs
2. **Type safety** — RPC definitions with Effect Schema give us encode/decode + validation for free
3. **Streaming built-in** — `Rpc.make` with `stream: true` produces `Stream<A, E>` responses that the WebSocket router handles natively
4. **Existing infrastructure** — The current `/rpc` endpoint uses `layerProtocolHttpRouter`; adding a parallel WebSocket route is one line change
5. **Client codegen** — `RpcClient` can auto-generate typed WebSocket clients

The key insight is: **streaming RPCs over WebSocket IS the subscription mechanism**. A client calls `Subscribe({ deviceId, ... })` and receives a `Stream<SensorReading>` that stays open until they disconnect. No custom subscription protocol needed.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Client Layer                                          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │  Dashboard UI    │  │  Mobile App      │  │  SCADA/HMI       │           │
│  │  (React + WS)   │  │  (WS client)     │  │  (WS client)     │           │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘           │
│           │                     │                      │                     │
│           └─────────────┬───────┴──────────────────────┘                     │
│                         │                                                    │
│                    WebSocket                                                 │
│                    /ws/iiot                                                   │
│                         │                                                    │
└─────────────────────────┼────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     IIoT WebSocket Server                                    │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐       │
│  │  RpcServer.layerProtocolWebsocketRouter({ path: '/ws/iiot' })    │       │
│  │  + RpcSerialization.layerJson                                     │       │
│  └───────────────────────────────────────────────────────────────────┘       │
│                          │                                                   │
│            RPC Handler Layer (IIoTRealtimeRpcs)                              │
│                          │                                                   │
│  ┌───────────┬───────────┼───────────┬───────────────────────┐              │
│  │           │           │           │                       │              │
│  ▼           ▼           ▼           ▼                       ▼              │
│ Subscribe  Subscribe   Subscribe  Subscribe           Subscribe            │
│ Readings   Alarms      EquipSt   EntityEvents         Invalidations        │
│ (Stream)   (Stream)    (Stream)  (Stream)             (Stream)             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                          │
             Internal Event Distribution
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │ Readings   │ │ Alarms     │ │ Equipment  │
    │ PubSub     │ │ PubSub     │ │ State      │
    │            │ │            │ │ PubSub     │
    └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
          │              │              │
          ▼              ▼              ▼
    Epic 19          EventLog       Entity
    Ingestion        Reactivity     State Changes
    Pipeline         (alarm-        (via cluster)
                     reactivity.ts)
```

---

## Component Design

### 1. Real-time RPC Definitions

**File**: `src/lib/iiot/rpc/RealtimeRpcs.ts`

```typescript
import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'
import { DeviceId, PlantId, AlarmId } from '../schemas/identifiers'
import { SensorReading } from '../schemas/readings'
import { Alarm, AlarmSeverity } from '../schemas/alarms'

// =============================================================================
// Subscription RPCs (all streaming)
// =============================================================================

/**
 * Subscribe to real-time sensor readings.
 *
 * Emits readings as they arrive from the ingestion pipeline.
 * Can filter by single device or plant-wide.
 */
export const SubscribeReadings = Rpc.make('Realtime.SubscribeReadings', {
  payload: Schema.Struct({
    /** Subscribe to specific device, or omit for all */
    deviceId: Schema.optional(DeviceId),
    /** Subscribe to all devices in a plant */
    plantId: Schema.optional(PlantId),
    /** Minimum interval between emissions (throttle, ms) */
    throttleMs: Schema.optional(
      Schema.Number.pipe(Schema.int(), Schema.positive())
    ),
  }),
  success: SensorReading,
  error: RealtimeError,
  stream: true,
})

/**
 * Subscribe to alarm events.
 *
 * Emits alarm lifecycle events (triggered, acknowledged, cleared, etc.)
 * in real-time. Backed by EventLog reactivity.
 */
export const SubscribeAlarms = Rpc.make('Realtime.SubscribeAlarms', {
  payload: Schema.Struct({
    /** Filter by device */
    deviceId: Schema.optional(DeviceId),
    /** Filter by minimum severity */
    minSeverity: Schema.optional(AlarmSeverity),
    /** Include only unacknowledged */
    onlyUnacknowledged: Schema.optional(Schema.Boolean),
  }),
  success: AlarmEvent, // Union of alarm lifecycle events
  error: RealtimeError,
  stream: true,
})

/**
 * Subscribe to equipment state changes.
 *
 * Emits when any entity in the hierarchy changes state
 * (e.g., Machine goes from 'running' to 'faulted').
 */
export const SubscribeEquipmentState = Rpc.make('Realtime.SubscribeEquipmentState', {
  payload: Schema.Struct({
    /** Filter by specific entity type */
    entityType: Schema.optional(Schema.Literal(
      'Plant', 'Line', 'WorkCell', 'Machine', 'Device', 'Sensor'
    )),
    /** Filter by plant */
    plantId: Schema.optional(PlantId),
  }),
  success: EquipmentStateChange,
  error: RealtimeError,
  stream: true,
})

/**
 * Subscribe to cache invalidation events.
 *
 * Used by dashboards to know when to re-fetch data.
 * Backed by EventLog.groupReactivity cache key invalidation.
 */
export const SubscribeInvalidations = Rpc.make('Realtime.SubscribeInvalidations', {
  payload: Schema.Struct({
    /** Cache key patterns to watch (e.g., 'alarms:*', 'readings:*') */
    patterns: Schema.Array(Schema.String),
  }),
  success: CacheInvalidation,
  error: RealtimeError,
  stream: true,
})

// =============================================================================
// Supporting Schemas
// =============================================================================

export class RealtimeError extends Schema.TaggedError<RealtimeError>()(
  'RealtimeError',
  {
    message: Schema.String,
    code: Schema.Literal(
      'SUBSCRIPTION_FAILED',
      'INVALID_FILTER',
      'RATE_LIMITED',
      'INTERNAL_ERROR'
    ),
  }
) {}

/**
 * Alarm lifecycle event (union for streaming)
 */
export class AlarmEvent extends Schema.TaggedClass<AlarmEvent>()('AlarmEvent', {
  eventType: Schema.Literal(
    'triggered', 'acknowledged', 'cleared', 'escalated',
    'shelved', 'unshelved', 'suppressed', 'out_of_service',
    'returned_to_service', 'config_changed'
  ),
  alarmId: AlarmId,
  deviceId: DeviceId,
  severity: AlarmSeverity,
  timestamp: Schema.DateTimeUtc,
  /** Additional context (varies by event type) */
  detail: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

/**
 * Equipment state change notification
 */
export class EquipmentStateChange extends Schema.TaggedClass<EquipmentStateChange>()(
  'EquipmentStateChange',
  {
    entityType: Schema.String,
    entityId: Schema.String,
    previousState: Schema.String,
    currentState: Schema.String,
    changedAt: Schema.DateTimeUtc,
    changedBy: Schema.optional(Schema.String),
  }
) {}

/**
 * Cache invalidation notification
 */
export class CacheInvalidation extends Schema.TaggedClass<CacheInvalidation>()(
  'CacheInvalidation',
  {
    cacheKey: Schema.String,
    invalidatedAt: Schema.DateTimeUtc,
    reason: Schema.optional(Schema.String),
  }
) {}

// =============================================================================
// RpcGroup
// =============================================================================

export const RealtimeRpcs = RpcGroup.make(
  SubscribeReadings,
  SubscribeAlarms,
  SubscribeEquipmentState,
  SubscribeInvalidations,
)

export type RealtimeRpcs = typeof RealtimeRpcs
```

### 2. Event Distribution Service

**File**: `src/lib/iiot/realtime/event-distribution.ts`

Central PubSub hub that aggregates events from multiple sources and distributes to subscribers.

```typescript
import { Context, Effect, Layer, PubSub, Stream, Ref, HashMap } from 'effect'
import { SensorReading } from '../schemas/readings'
import { AlarmEvent, EquipmentStateChange, CacheInvalidation } from '../rpc/RealtimeRpcs'

// =============================================================================
// EventDistribution Service
// =============================================================================

export interface EventDistributionShape {
  // ── Publishing (internal — called by pipeline/handlers) ─────────
  readonly publishReading: (reading: SensorReading) => Effect.Effect<void>
  readonly publishAlarmEvent: (event: AlarmEvent) => Effect.Effect<void>
  readonly publishEquipmentStateChange: (change: EquipmentStateChange) => Effect.Effect<void>
  readonly publishInvalidation: (inv: CacheInvalidation) => Effect.Effect<void>

  // ── Subscribing (internal — called by RPC handlers) ─────────────
  readonly subscribeReadings: Effect.Effect<Stream.Stream<SensorReading>>
  readonly subscribeAlarms: Effect.Effect<Stream.Stream<AlarmEvent>>
  readonly subscribeEquipmentState: Effect.Effect<Stream.Stream<EquipmentStateChange>>
  readonly subscribeInvalidations: Effect.Effect<Stream.Stream<CacheInvalidation>>

  // ── Metrics ─────────────────────────────────────────────────────
  readonly getMetrics: Effect.Effect<DistributionMetrics>
}

export class EventDistribution extends Context.Tag('tmnl/iiot/EventDistribution')<
  EventDistribution,
  EventDistributionShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

const makeEventDistribution = Effect.gen(function* () {
  // Internal PubSubs — bounded to prevent memory explosion
  const readingsPubSub = yield* PubSub.bounded<SensorReading>(10_000)
  const alarmsPubSub = yield* PubSub.bounded<AlarmEvent>(1_000)
  const equipmentStatePubSub = yield* PubSub.bounded<EquipmentStateChange>(1_000)
  const invalidationsPubSub = yield* PubSub.bounded<CacheInvalidation>(1_000)

  // Metrics tracking
  const metrics = yield* Ref.make({
    readingsPublished: 0,
    alarmsPublished: 0,
    equipmentStatePublished: 0,
    invalidationsPublished: 0,
    activeSubscribers: 0,
  })

  return {
    publishReading: (reading) =>
      PubSub.publish(readingsPubSub, reading).pipe(
        Effect.tap(() =>
          Ref.update(metrics, (m) => ({ ...m, readingsPublished: m.readingsPublished + 1 }))
        )
      ),

    publishAlarmEvent: (event) =>
      PubSub.publish(alarmsPubSub, event).pipe(
        Effect.tap(() =>
          Ref.update(metrics, (m) => ({ ...m, alarmsPublished: m.alarmsPublished + 1 }))
        )
      ),

    publishEquipmentStateChange: (change) =>
      PubSub.publish(equipmentStatePubSub, change),

    publishInvalidation: (inv) =>
      PubSub.publish(invalidationsPubSub, inv),

    subscribeReadings: Effect.succeed(Stream.fromPubSub(readingsPubSub)),
    subscribeAlarms: Effect.succeed(Stream.fromPubSub(alarmsPubSub)),
    subscribeEquipmentState: Effect.succeed(Stream.fromPubSub(equipmentStatePubSub)),
    subscribeInvalidations: Effect.succeed(Stream.fromPubSub(invalidationsPubSub)),

    getMetrics: Ref.get(metrics),
  }
})

export const EventDistributionLive: Layer.Layer<EventDistribution> =
  Layer.scoped(EventDistribution, makeEventDistribution)
```

### 3. RPC Handler Implementation

**File**: `src/lib/iiot/realtime/realtime-handlers.ts`

```typescript
import { Effect, Stream, Duration, Schedule } from 'effect'
import { EventDistribution } from './event-distribution'
import {
  RealtimeRpcs,
  SubscribeReadings,
  SubscribeAlarms,
  SubscribeEquipmentState,
  SubscribeInvalidations,
  RealtimeError,
} from '../rpc/RealtimeRpcs'

// =============================================================================
// RPC Handlers
// =============================================================================

const RealtimeRpcHandlers = Effect.gen(function* () {
  const eventDist = yield* EventDistribution

  return {
    // ── SubscribeReadings ─────────────────────────────────────────
    [SubscribeReadings._tag]: (request: typeof SubscribeReadings.payload.Type) => {
      return Effect.gen(function* () {
        const baseStream = yield* eventDist.subscribeReadings

        let stream = baseStream

        // Apply device filter
        if (request.deviceId) {
          stream = stream.pipe(
            Stream.filter((r) => r.deviceId === request.deviceId)
          )
        }

        // Apply throttle (if specified)
        if (request.throttleMs) {
          stream = stream.pipe(
            Stream.throttle({
              cost: () => 1,
              duration: Duration.millis(request.throttleMs!),
              units: 1,
              strategy: 'enforce',
            })
          )
        }

        return stream
      }).pipe(Effect.flatten)
    },

    // ── SubscribeAlarms ───────────────────────────────────────────
    [SubscribeAlarms._tag]: (request: typeof SubscribeAlarms.payload.Type) => {
      return Effect.gen(function* () {
        const baseStream = yield* eventDist.subscribeAlarms

        let stream = baseStream

        // Filter by device
        if (request.deviceId) {
          stream = stream.pipe(
            Stream.filter((e) => e.deviceId === request.deviceId)
          )
        }

        // Filter by severity (minimum level)
        if (request.minSeverity) {
          const severityOrder = ['info', 'warning', 'critical', 'emergency']
          const minIdx = severityOrder.indexOf(request.minSeverity)
          stream = stream.pipe(
            Stream.filter((e) => severityOrder.indexOf(e.severity) >= minIdx)
          )
        }

        return stream
      }).pipe(Effect.flatten)
    },

    // ── SubscribeEquipmentState ───────────────────────────────────
    [SubscribeEquipmentState._tag]: (request) => {
      return Effect.gen(function* () {
        const baseStream = yield* eventDist.subscribeEquipmentState

        let stream = baseStream

        if (request.entityType) {
          stream = stream.pipe(
            Stream.filter((e) => e.entityType === request.entityType)
          )
        }

        return stream
      }).pipe(Effect.flatten)
    },

    // ── SubscribeInvalidations ────────────────────────────────────
    [SubscribeInvalidations._tag]: (request) => {
      return Effect.gen(function* () {
        const baseStream = yield* eventDist.subscribeInvalidations

        let stream = baseStream

        // Filter by patterns (glob match on cache key)
        if (request.patterns.length > 0) {
          stream = stream.pipe(
            Stream.filter((inv) =>
              request.patterns.some((pattern) =>
                matchGlobPattern(pattern, inv.cacheKey)
              )
            )
          )
        }

        return stream
      }).pipe(Effect.flatten)
    },
  }
})

export const RealtimeRpcHandlersLayer = RealtimeRpcs.toLayer(RealtimeRpcHandlers)
```

### 4. WebSocket Server Layer

**File**: `src/lib/iiot/realtime/ws-server.ts`

```typescript
import * as RpcServer from '@effect/rpc/RpcServer'
import { RpcSerialization } from '@effect/rpc'
import { Layer } from 'effect'
import { RealtimeRpcs } from '../rpc/RealtimeRpcs'
import { RealtimeRpcHandlersLayer } from './realtime-handlers'
import { EventDistributionLive } from './event-distribution'

// =============================================================================
// WebSocket RPC Server Layer
// =============================================================================

/**
 * IIoT Real-time WebSocket server.
 *
 * Mounts at /ws/iiot on the HttpRouter.
 * Uses JSON serialization for browser compatibility.
 *
 * Integration with main server:
 * ```typescript
 * export const IIoTHttpServerDev = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
 *   // ... existing layers ...
 *   Layer.provide(IIoTRealtimeWsServer),  // <-- add this
 *   // ... rest of layers ...
 * )
 * ```
 */
export const IIoTRealtimeWsServer = Layer.mergeAll(
  RpcServer.layer(RealtimeRpcs),
  RpcServer.layerProtocolWebsocketRouter({ path: '/ws/iiot' }),
  RpcSerialization.layerJson,
).pipe(
  Layer.provide(RealtimeRpcHandlersLayer),
  Layer.provide(EventDistributionLive),
)
```

### 5. EventLog Reactivity Integration

**File**: `src/lib/iiot/realtime/reactivity-bridge.ts`

Bridges the existing `EventLog.groupReactivity` pattern to the EventDistribution service.

```typescript
import { Effect, Layer, Stream } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { EventDistribution } from './event-distribution'
import { ALARM_CACHE_KEYS } from '../handlers/alarm-reactivity'
import { AlarmEvent, CacheInvalidation } from '../rpc/RealtimeRpcs'

// =============================================================================
// Reactivity Bridge
// =============================================================================

/**
 * Bridges EventLog reactivity cache invalidations to WebSocket subscribers.
 *
 * When an event is written to the EventLog, the groupReactivity
 * config (alarm-reactivity.ts) maps it to cache keys that should be
 * invalidated. This bridge:
 *
 * 1. Subscribes to EventLog reactivity notifications
 * 2. Transforms cache key invalidations to CacheInvalidation events
 * 3. Publishes to EventDistribution for WebSocket delivery
 *
 * Additionally, it transforms alarm events from the EventLog
 * into AlarmEvent notifications for the alarm subscription channel.
 */
export const ReactivityBridgeLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const eventDist = yield* EventDistribution

    // TODO: When EventLog reactivity exposes a subscription API,
    // subscribe to cache key invalidation events here.
    //
    // Current pattern (EventLog.groupReactivity) defines WHICH keys
    // to invalidate, but doesn't provide a push-based notification.
    //
    // Two integration approaches:
    //
    // Approach A: Intercept at entity handler level
    //   When an alarm event handler writes to EventLog, it also
    //   publishes to EventDistribution:
    //
    //   const handleAlarmTriggered = (event: AlarmTriggered) =>
    //     Effect.gen(function* () {
    //       yield* EventLog.write(event)
    //       yield* eventDist.publishAlarmEvent(new AlarmEvent({
    //         eventType: 'triggered',
    //         alarmId: event.alarmId,
    //         ...
    //       }))
    //       yield* eventDist.publishInvalidation(new CacheInvalidation({
    //         cacheKey: ALARM_CACHE_KEYS.ALARMS_ACTIVE,
    //         invalidatedAt: event.occurredAt,
    //       }))
    //     })
    //
    // Approach B: EventLog poll loop (fallback)
    //   Poll EventLog for new events at a fixed interval and
    //   derive invalidations from the reactivity config.
    //
    // RECOMMENDATION: Approach A (handler-level integration)
    // It's simpler, lower latency, and doesn't require polling.

    yield* Effect.logInfo('[ReactivityBridge] Initialized')
  })
)
```

### 6. Server Composition Update

**File**: Update `src/lib/iiot/http/server.ts`

```typescript
// Add to existing server composition:

import { IIoTRealtimeWsServer } from '../realtime/ws-server'

export const IIoTHttpServerDev = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provide(ApiLive),
  Layer.provide(IIoTRpcServer),
  Layer.provide(IIoTRealtimeWsServer),  // <-- NEW: WebSocket subscriptions
  Layer.provide(EntityHandlersLayer),
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
  Layer.provide(ClusterDev),
  Layer.provide(BunHttpServer.layer({ port: 3000 }))
)
```

After this change, the server serves:
- **REST API**: `http://localhost:3000/api/*`
- **Raw RPC**: `http://localhost:3000/rpc` (ndjson)
- **WebSocket**: `ws://localhost:3000/ws/iiot` (JSON)
- **Swagger**: `http://localhost:3000/docs`

---

## Client Connection Flow

```
Client                          Server
  │                               │
  │  WS CONNECT /ws/iiot          │
  │ ──────────────────────────►   │
  │                               │  Accept WebSocket upgrade
  │  ◄──────────────────────────  │
  │  WS OPEN                      │
  │                               │
  │  RPC: SubscribeReadings       │
  │  { deviceId: "DEV-temp-01" }  │
  │ ──────────────────────────►   │
  │                               │  Create filtered Stream
  │                               │  from EventDistribution
  │                               │
  │  ◄─── SensorReading ────────  │  (continuous stream)
  │  ◄─── SensorReading ────────  │
  │  ◄─── SensorReading ────────  │
  │                               │
  │  RPC: SubscribeAlarms         │  (multiplex: same WS)
  │  { minSeverity: "warning" }   │
  │ ──────────────────────────►   │
  │                               │
  │  ◄─── AlarmEvent ───────────  │
  │  ◄─── SensorReading ────────  │  (interleaved)
  │  ◄─── AlarmEvent ───────────  │
  │                               │
  │  WS CLOSE                     │
  │ ──────────────────────────►   │
  │                               │  Stream finalizers run
  │                               │  PubSub subscriptions cleaned up
```

Key aspects:
- **Multiplexing**: A single WebSocket connection can have multiple concurrent streaming RPCs
- **Type-safe**: Both client and server share the same `RealtimeRpcs` definition
- **Auto-cleanup**: When the WebSocket closes, Effect's scope management interrupts all active fibers and unsubscribes from PubSubs
- **Backpressure**: `Stream.throttle` on the server side prevents overwhelming slow clients

---

## Subscription Channels

### Channel 1: Readings Stream

| Property | Value |
|----------|-------|
| RPC | `Realtime.SubscribeReadings` |
| Source | `EventDistribution.readingsPubSub` (fed by ingestion pipeline) |
| Filters | `deviceId`, `plantId`, `throttleMs` |
| Volume | High (1,000+ readings/second unfiltered) |
| Serialization | JSON (each `SensorReading` as tagged struct) |

**Throttle design**: Without throttle, a dashboard showing 100 sensors at 1Hz would receive 100 readings/second. With `throttleMs: 1000`, each device emits at most 1 reading/second to the client.

### Channel 2: Alarms Stream

| Property | Value |
|----------|-------|
| RPC | `Realtime.SubscribeAlarms` |
| Source | `EventDistribution.alarmsPubSub` (fed by entity handlers + alarm detector) |
| Filters | `deviceId`, `minSeverity`, `onlyUnacknowledged` |
| Volume | Low-medium (depends on alarm count) |
| Events | triggered, acknowledged, cleared, escalated, shelved, etc. |

### Channel 3: Equipment State Stream

| Property | Value |
|----------|-------|
| RPC | `Realtime.SubscribeEquipmentState` |
| Source | `EventDistribution.equipmentStatePubSub` (fed by entity state transitions) |
| Filters | `entityType`, `plantId` |
| Volume | Low (state changes are infrequent) |

### Channel 4: Cache Invalidation Stream

| Property | Value |
|----------|-------|
| RPC | `Realtime.SubscribeInvalidations` |
| Source | `EventDistribution.invalidationsPubSub` (fed by reactivity bridge) |
| Filters | `patterns` (glob match on cache keys) |
| Volume | Low-medium (correlates with event writes) |

---

## Client Reconnection Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                  Client Reconnection Logic                   │
│                                                             │
│  1. WebSocket CLOSE detected                                │
│     ↓                                                       │
│  2. Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s     │
│     ↓                                                       │
│  3. Reconnect + re-subscribe to all channels                │
│     ↓                                                       │
│  4. On success: reset backoff, resume normal operation      │
│  4. On failure: loop back to step 2                         │
│                                                             │
│  Special cases:                                             │
│  - 1006 (abnormal close): immediate retry (network glitch)  │
│  - 1008 (policy violation): don't retry (auth issue)        │
│  - 1011 (server error): retry with backoff                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Client-side responsibilities** (documented, not implemented server-side):
- Maintain a list of active subscriptions for re-subscribe on reconnect
- Use `lastEventTimestamp` to detect gaps (server does NOT replay missed events)
- If gap detected, fall back to REST API for current state + resume streaming

**Server-side** (built-in via Effect):
- WebSocket close triggers fiber interruption
- PubSub subscriptions auto-unsubscribe (scoped)
- No server-side session tracking needed (stateless subscriptions)

---

## File Structure

```
src/lib/iiot/realtime/
├── event-distribution.ts      # EventDistribution service (PubSub hub)
├── reactivity-bridge.ts       # EventLog reactivity → EventDistribution
├── realtime-handlers.ts       # RPC handler implementations
├── ws-server.ts               # WebSocket RPC server layer
└── __tests__/
    ├── event-distribution.test.ts
    ├── realtime-handlers.test.ts
    └── ws-integration.test.ts

src/lib/iiot/rpc/
├── RealtimeRpcs.ts            # RPC definitions + schemas (NEW)
└── index.ts                   # Updated to include RealtimeRpcs
```

---

## Implementation Phases

### Phase 20.1: Infrastructure (Tasks 20.1.1 - 20.1.2)

**Files to create**:
- `src/lib/iiot/rpc/RealtimeRpcs.ts` — RPC definitions with streaming schemas
- `src/lib/iiot/realtime/event-distribution.ts` — PubSub hub service
- `src/lib/iiot/realtime/ws-server.ts` — WebSocket server layer

**Acceptance**:
- [ ] RealtimeRpcs compiles with all 4 streaming RPCs
- [ ] EventDistribution service passes unit tests
- [ ] WebSocket server layer can be provided to IIoTHttpServerDev
- [ ] `ws://localhost:3000/ws/iiot` accepts connections

**Estimated effort**: 3 SP

### Phase 20.2: Subscription Channels (Tasks 20.2.1 - 20.2.3)

**Files to create**:
- `src/lib/iiot/realtime/realtime-handlers.ts` — Handler implementations

**Files to modify**:
- `src/lib/iiot/rpc/index.ts` — Add RealtimeRpcs to exports

**Acceptance**:
- [ ] SubscribeReadings emits filtered readings from EventDistribution
- [ ] SubscribeAlarms emits alarm lifecycle events with severity filtering
- [ ] SubscribeEquipmentState emits state changes with entity type filtering
- [ ] Throttle logic works correctly

**Estimated effort**: 2 SP

### Phase 20.3: EventLog Integration (Tasks 20.3.1 - 20.3.2)

**Files to create**:
- `src/lib/iiot/realtime/reactivity-bridge.ts` — Bridge layer

**Files to modify**:
- Entity handlers (alarm, work-order, equipment-state) to publish to EventDistribution

**Acceptance**:
- [ ] Alarm events written to EventLog also appear on alarm subscription
- [ ] Cache invalidation events reach SubscribeInvalidations
- [ ] End-to-end: trigger alarm via REST → alarm appears on WebSocket

**Estimated effort**: 2 SP

### Phase 20.4: Integration Testing (Task 20.4.1)

**Files to create**:
- `src/lib/iiot/realtime/__tests__/ws-integration.test.ts`

**Acceptance**:
- [ ] E2E test: start server → connect WS → subscribe → trigger event → verify event received
- [ ] Multiple concurrent subscriptions on same connection
- [ ] Client disconnect cleanly unsubscribes
- [ ] Throttle prevents flooding slow clients

**Estimated effort**: 1 SP

---

## Integration with Phase 4

### Existing RPC Subscribe (SensorRpcs.Subscribe)

The existing `SensorRpcs.Subscribe` RPC at `/rpc` (HTTP) is polling-based and returns streaming results. With Phase 5:

1. **Keep SensorRpcs.Subscribe** at `/rpc` for backward compatibility
2. **Add Realtime.SubscribeReadings** at `/ws/iiot` for true push-based streaming
3. Both can share the same `EventDistribution.readingsPubSub` as data source

### Existing AlarmReactivity

The `alarm-reactivity.ts` `EventLog.groupReactivity` config remains unchanged. The ReactivityBridge adds a publishing step at the handler level.

---

## Test Strategy

### Unit Tests

| Component | Test Focus | Pattern |
|-----------|-----------|---------|
| `EventDistribution` | Publish/subscribe, bounded buffer | `Registry.make()` |
| `RealtimeRpcs` | Schema encode/decode roundtrip | `Schema.decodeSync` |
| `Handlers` | Filtering (device, severity, pattern) | Stream assertions |

### Integration Tests

| Test | Setup | Verification |
|------|-------|-------------|
| WS connect + subscribe | `IIoTHttpServerDev` + WS client | Receive events via stream |
| Multiplexed subscriptions | 2+ subscriptions on same WS | Both receive independently |
| Disconnect cleanup | Connect, subscribe, disconnect | No leaked fibers/subscriptions |
| Throttle enforcement | Subscribe with throttleMs | Max N events per window |

### Client Compatibility

| Client | Transport | Notes |
|--------|-----------|-------|
| Browser (native WS) | `new WebSocket('ws://...')` | JSON serialization required |
| `@effect/rpc` client | `RpcClient.layerProtocolWebsocket` | Type-safe, auto-generated |
| Node.js/Bun | `ws` package or native | Any WS client works |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| High-frequency readings overwhelming WS | Browser freeze | `Stream.throttle` + bounded PubSub (10k cap) |
| WebSocket disconnects silently | Client shows stale data | Client-side heartbeat + reconnection logic |
| RpcServer.layerProtocolWebsocketRouter API changes | Breaking upgrade | Pin `@effect/rpc` version; tested in geoint already |
| Multiple WS connections per client | Memory waste | Document: use single WS with multiplexed subscriptions |
| EventDistribution PubSub backpressure | Dropped events | Bounded PubSub (10k readings, 1k alarms); monitor with metrics |
| JSON serialization overhead | Latency on high-frequency | Switch to msgpack for production (RpcSerialization.layerMsgPack) |

---

## Open Questions

- [ ] **Q1**: Should we support msgpack serialization on WebSocket (in addition to JSON)?
  - Recommendation: Start with JSON for browser dev tools compatibility. Add msgpack as an alternate endpoint (`/ws/iiot/bin`) if needed.
- [ ] **Q2**: Should the WebSocket endpoint be behind auth middleware?
  - Recommendation: Yes, but defer to Phase 6 (Epic 22: Layer Composition). For now, open access like the REST API.
- [ ] **Q3**: Should SubscribeReadings include a "catch-up" mode that replays recent readings on connect?
  - Recommendation: No. Keep subscriptions stateless (push-only). If the client needs historical data, use the REST API (`SensorRpcs.Query`).
- [ ] **Q4**: Should we also expose the `IIoTRpcs` (full entity RPCs) over WebSocket?
  - Recommendation: Potentially, but keep it separate. The `/ws/iiot` endpoint is for subscriptions (read-only streaming). Entity mutations should go through `/api/*` (REST) or `/rpc` (HTTP RPC).
- [ ] **Q5**: How do we integrate with the existing ChannelService from `src/lib/streams/`?
  - Recommendation: The ChannelService provides topology-based routing which is useful for UI composition but is more complex than needed for Epic 20. Keep EventDistribution (simple PubSub) for Phase 5. If UI needs advanced routing, bridge EventDistribution into ChannelService in a later phase.

---

## Success Criteria

1. WebSocket connections accepted at `ws://localhost:3000/ws/iiot`
2. SubscribeReadings delivers sensor readings in real-time from ingestion pipeline
3. SubscribeAlarms delivers alarm lifecycle events as they occur
4. SubscribeEquipmentState delivers state change notifications
5. SubscribeInvalidations delivers cache key invalidation events
6. Multiple concurrent subscriptions work on a single WebSocket
7. Client disconnect cleanly tears down all subscriptions
8. Throttle prevents overwhelming slow clients
9. All unit + integration tests pass
10. TypeScript compiles without errors
