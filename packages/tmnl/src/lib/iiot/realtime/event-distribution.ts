/**
 * EventDistribution Service — ChannelService-backed Event Hub
 *
 * Aggregates events from multiple sources (pipeline, handlers) and distributes
 * to subscribers (RPC handlers, WebSocket connections) via ChannelService.
 *
 * Architecture:
 *   4 ChannelService channels for different event types:
 *   - iiot:readings   — high-throughput sensor data
 *   - iiot:alarms     — alarm lifecycle events
 *   - iiot:equipment  — equipment state transitions
 *   - iiot:invalidations — cache invalidation signals
 *
 *   Each channel: PubSub (inlet source) → ChannelService inlet → outlet → subscriber streams
 *   Fan-out is handled by ChannelService's broadcast outlets.
 *
 *   NATS integration (via HolonetBridge):
 *   - Outbound: Every publish dual-writes to local PubSub AND NATS (fire-and-forget)
 *   - Inbound: Remote ingress daemons subscribe to NATS wildcards and inject
 *     into local PubSub inlets for cross-node event distribution.
 *
 * @module @gbg/tmnl/iiot/realtime/event-distribution
 * @see thoughts/shared/plans/phase5-websocket-architecture.md
 */

import { Context, Effect, Layer, PubSub, Stream, Ref, Schema } from 'effect'
import type { Scope } from 'effect'
import type { ChannelId, InletId, OutletId } from '../../streams/constructs/Channel'
import {
  ChannelService,
  ChannelServiceLive,
} from '../../streams/constructs/ChannelService'
import { ChannelBuilder } from '../../streams/constructs/ChannelBuilder'
import { HolonetBridge } from './holonet-bridge'

// =============================================================================
// Event Type Schemas
// =============================================================================

/** Sensor reading event for internal distribution. Published to iiot:readings channel. */
export class ReadingEvent extends Schema.TaggedClass<ReadingEvent>()('ReadingEvent', {
  topic: Schema.String,
  value: Schema.Number,
  timestamp: Schema.String,
  deviceId: Schema.String,
}) {}

/** Alarm lifecycle event for internal distribution. Published to iiot:alarms channel. */
export class AlarmEvent extends Schema.TaggedClass<AlarmEvent>()('AlarmEvent', {
  alarmId: Schema.String,
  severity: Schema.String,
  deviceId: Schema.String,
  message: Schema.String,
  timestamp: Schema.String,
}) {}

/** Equipment state transition for internal distribution. Published to iiot:equipment channel. */
export class EquipmentStateChange extends Schema.TaggedClass<EquipmentStateChange>()('EquipmentStateChange', {
  equipmentId: Schema.String,
  previousState: Schema.String,
  newState: Schema.String,
  timestamp: Schema.String,
}) {}

/** Work order lifecycle event for internal distribution. Published to iiot:work_orders channel. */
export class WorkOrderLifecycleEvent extends Schema.TaggedClass<WorkOrderLifecycleEvent>()('WorkOrderLifecycleEvent', {
  workOrderId: Schema.String,
  eventTag: Schema.String,
  status: Schema.String,
  timestamp: Schema.String,
}) {}

/** Cache invalidation signal for internal distribution. Published to iiot:invalidations channel. */
export class CacheInvalidation extends Schema.TaggedClass<CacheInvalidation>()('CacheInvalidation', {
  cacheKey: Schema.String,
  reason: Schema.String,
  timestamp: Schema.String,
}) {}

// =============================================================================
// Metrics
// =============================================================================

/** Counters for EventDistribution publish operations and active subscribers. */
export interface DistributionMetrics {
  readonly readingsPublished: number
  readonly alarmsPublished: number
  readonly equipmentStatePublished: number
  readonly workOrderLifecyclePublished: number
  readonly invalidationsPublished: number
  readonly activeSubscribers: number
}

const initialMetrics: DistributionMetrics = {
  readingsPublished: 0,
  alarmsPublished: 0,
  equipmentStatePublished: 0,
  workOrderLifecyclePublished: 0,
  invalidationsPublished: 0,
  activeSubscribers: 0,
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * EventDistribution service shape.
 *
 * Publish methods dual-write to local PubSub and NATS (via HolonetBridge).
 * Subscribe methods return outlet streams from ChannelService broadcast.
 */
export interface EventDistributionShape {
  readonly publishReading: (reading: ReadingEvent) => Effect.Effect<void>
  readonly publishAlarmEvent: (event: AlarmEvent) => Effect.Effect<void>
  readonly publishEquipmentStateChange: (change: EquipmentStateChange) => Effect.Effect<void>
  readonly publishWorkOrderLifecycle: (event: WorkOrderLifecycleEvent) => Effect.Effect<void>
  readonly publishInvalidation: (inv: CacheInvalidation) => Effect.Effect<void>

  readonly subscribeReadings: Effect.Effect<Stream.Stream<ReadingEvent>>
  readonly subscribeAlarms: Effect.Effect<Stream.Stream<AlarmEvent>>
  readonly subscribeEquipmentState: Effect.Effect<Stream.Stream<EquipmentStateChange>>
  readonly subscribeWorkOrders: Effect.Effect<Stream.Stream<WorkOrderLifecycleEvent>>
  readonly subscribeInvalidations: Effect.Effect<Stream.Stream<CacheInvalidation>>

  readonly getMetrics: Effect.Effect<DistributionMetrics>
}

// =============================================================================
// Context.Tag
// =============================================================================

/**
 * EventDistribution service tag.
 *
 * Central event hub for the IIoT real-time subsystem.
 * All event publishing and subscribing flows through this service.
 */
export class EventDistribution extends Context.Tag('tmnl/iiot/EventDistribution')<
  EventDistribution,
  EventDistributionShape
>() {}

// =============================================================================
// Channel Definitions
// =============================================================================

const CHANNELS = {
  readings: {
    id: 'iiot:readings' as ChannelId,
    inlet: 'iiot:readings:inlet:in' as InletId,
    outlet: 'iiot:readings:outlet:out' as OutletId,
  },
  alarms: {
    id: 'iiot:alarms' as ChannelId,
    inlet: 'iiot:alarms:inlet:in' as InletId,
    outlet: 'iiot:alarms:outlet:out' as OutletId,
  },
  equipment: {
    id: 'iiot:equipment' as ChannelId,
    inlet: 'iiot:equipment:inlet:in' as InletId,
    outlet: 'iiot:equipment:outlet:out' as OutletId,
  },
  workOrders: {
    id: 'iiot:work_orders' as ChannelId,
    inlet: 'iiot:work_orders:inlet:in' as InletId,
    outlet: 'iiot:work_orders:outlet:out' as OutletId,
  },
  invalidations: {
    id: 'iiot:invalidations' as ChannelId,
    inlet: 'iiot:invalidations:inlet:in' as InletId,
    outlet: 'iiot:invalidations:outlet:out' as OutletId,
  },
} as const

// =============================================================================
// Implementation
// =============================================================================

const makeEventDistribution = Effect.gen(function* () {
  const channels = yield* ChannelService
  const bridge = yield* HolonetBridge

  // -- Register 4 channels with broadcast outlets --

  yield* channels.register(
    ChannelBuilder.create('iiot:readings')
      .name('IIoT Readings')
      .inlet('in')
      .outlet('out', { broadcast: true, maxLag: 10_000 })
      .wire('in', 'out')
  ).pipe(Effect.orDie)

  yield* channels.register(
    ChannelBuilder.create('iiot:alarms')
      .name('IIoT Alarms')
      .inlet('in')
      .outlet('out', { broadcast: true, maxLag: 1_000 })
      .wire('in', 'out')
  ).pipe(Effect.orDie)

  yield* channels.register(
    ChannelBuilder.create('iiot:equipment')
      .name('IIoT Equipment State')
      .inlet('in')
      .outlet('out', { broadcast: true, maxLag: 1_000 })
      .wire('in', 'out')
  ).pipe(Effect.orDie)

  yield* channels.register(
    ChannelBuilder.create('iiot:work_orders')
      .name('IIoT Work Orders')
      .inlet('in')
      .outlet('out', { broadcast: true, maxLag: 1_000 })
      .wire('in', 'out')
  ).pipe(Effect.orDie)

  yield* channels.register(
    ChannelBuilder.create('iiot:invalidations')
      .name('IIoT Cache Invalidations')
      .inlet('in')
      .outlet('out', { broadcast: true, maxLag: 1_000 })
      .wire('in', 'out')
  ).pipe(Effect.orDie)

  // -- Open all channels --

  yield* channels.open(CHANNELS.readings.id).pipe(Effect.orDie)
  yield* channels.open(CHANNELS.alarms.id).pipe(Effect.orDie)
  yield* channels.open(CHANNELS.equipment.id).pipe(Effect.orDie)
  yield* channels.open(CHANNELS.workOrders.id).pipe(Effect.orDie)
  yield* channels.open(CHANNELS.invalidations.id).pipe(Effect.orDie)

  // -- Inlet PubSubs (publishers push here, streams pipe into channel inlets) --

  const readingsInlet = yield* PubSub.unbounded<ReadingEvent>()
  const alarmsInlet = yield* PubSub.unbounded<AlarmEvent>()
  const equipmentInlet = yield* PubSub.unbounded<EquipmentStateChange>()
  const workOrdersInlet = yield* PubSub.unbounded<WorkOrderLifecycleEvent>()
  const invalidationsInlet = yield* PubSub.unbounded<CacheInvalidation>()

  // -- Connect PubSub streams to channel inlets --

  yield* channels.connectStream(
    CHANNELS.readings.id,
    CHANNELS.readings.inlet,
    Stream.fromPubSub(readingsInlet),
    'event-distribution:readings',
  ).pipe(Effect.orDie)

  yield* channels.connectStream(
    CHANNELS.alarms.id,
    CHANNELS.alarms.inlet,
    Stream.fromPubSub(alarmsInlet),
    'event-distribution:alarms',
  ).pipe(Effect.orDie)

  yield* channels.connectStream(
    CHANNELS.equipment.id,
    CHANNELS.equipment.inlet,
    Stream.fromPubSub(equipmentInlet),
    'event-distribution:equipment',
  ).pipe(Effect.orDie)

  yield* channels.connectStream(
    CHANNELS.workOrders.id,
    CHANNELS.workOrders.inlet,
    Stream.fromPubSub(workOrdersInlet),
    'event-distribution:work-orders',
  ).pipe(Effect.orDie)

  yield* channels.connectStream(
    CHANNELS.invalidations.id,
    CHANNELS.invalidations.inlet,
    Stream.fromPubSub(invalidationsInlet),
    'event-distribution:invalidations',
  ).pipe(Effect.orDie)

  // -- Remote ingress daemons (NATS → local PubSub inlets) --
  // Each daemon subscribes to the bridge's remote stream and publishes
  // incoming events into the local PubSub inlet for ChannelService distribution.

  const forkIngress = <A>(
    remote: Effect.Effect<Stream.Stream<A>, never, Scope.Scope>,
    inlet: PubSub.PubSub<A>,
    label: string,
  ) =>
    Stream.unwrapScoped(remote).pipe(
      Stream.runForEach((event) => PubSub.publish(inlet, event).pipe(Effect.asVoid)),
      Effect.annotateLogs('ingress', label),
      Effect.fork,
    )

  yield* forkIngress(bridge.remoteReadings, readingsInlet, 'readings')
  yield* forkIngress(bridge.remoteAlarms, alarmsInlet, 'alarms')
  yield* forkIngress(bridge.remoteEquipment, equipmentInlet, 'equipment')
  yield* forkIngress(bridge.remoteWorkOrders, workOrdersInlet, 'work-orders')
  yield* forkIngress(bridge.remoteInvalidations, invalidationsInlet, 'invalidations')

  // -- Metrics --

  const metrics = yield* Ref.make<DistributionMetrics>(initialMetrics)

  // -- Helper: get outlet stream with Scope cast --

  const outletStream = <A>(channelId: ChannelId, outletId: OutletId) =>
    channels.getOutletStream<A>(channelId, outletId).pipe(
      Effect.map((s) => s as Stream.Stream<A, never, never>),
      Effect.orDie,
    )

  return EventDistribution.of({
    // -- Publishing --

    publishReading: (reading) =>
      PubSub.publish(readingsInlet, reading).pipe(
        Effect.tap(() => bridge.publishReading(reading)),
        Effect.tap(() =>
          Ref.update(metrics, (m) => ({
            ...m,
            readingsPublished: m.readingsPublished + 1,
          }))
        ),
        Effect.asVoid,
      ),

    publishAlarmEvent: (event) =>
      PubSub.publish(alarmsInlet, event).pipe(
        Effect.tap(() => bridge.publishAlarm(event)),
        Effect.tap(() =>
          Ref.update(metrics, (m) => ({
            ...m,
            alarmsPublished: m.alarmsPublished + 1,
          }))
        ),
        Effect.asVoid,
      ),

    publishEquipmentStateChange: (change) =>
      PubSub.publish(equipmentInlet, change).pipe(
        Effect.tap(() => bridge.publishEquipment(change)),
        Effect.tap(() =>
          Ref.update(metrics, (m) => ({
            ...m,
            equipmentStatePublished: m.equipmentStatePublished + 1,
          }))
        ),
        Effect.asVoid,
      ),

    publishWorkOrderLifecycle: (event) =>
      PubSub.publish(workOrdersInlet, event).pipe(
        Effect.tap(() => bridge.publishWorkOrder(event)),
        Effect.tap(() =>
          Ref.update(metrics, (m) => ({
            ...m,
            workOrderLifecyclePublished: m.workOrderLifecyclePublished + 1,
          }))
        ),
        Effect.asVoid,
      ),

    publishInvalidation: (inv) =>
      PubSub.publish(invalidationsInlet, inv).pipe(
        Effect.tap(() => bridge.publishInvalidation(inv)),
        Effect.tap(() =>
          Ref.update(metrics, (m) => ({
            ...m,
            invalidationsPublished: m.invalidationsPublished + 1,
          }))
        ),
        Effect.asVoid,
      ),

    // -- Subscribing (outlet streams from ChannelService) --

    subscribeReadings: outletStream<ReadingEvent>(
      CHANNELS.readings.id,
      CHANNELS.readings.outlet,
    ),

    subscribeAlarms: outletStream<AlarmEvent>(
      CHANNELS.alarms.id,
      CHANNELS.alarms.outlet,
    ),

    subscribeEquipmentState: outletStream<EquipmentStateChange>(
      CHANNELS.equipment.id,
      CHANNELS.equipment.outlet,
    ),

    subscribeWorkOrders: outletStream<WorkOrderLifecycleEvent>(
      CHANNELS.workOrders.id,
      CHANNELS.workOrders.outlet,
    ),

    subscribeInvalidations: outletStream<CacheInvalidation>(
      CHANNELS.invalidations.id,
      CHANNELS.invalidations.outlet,
    ),

    // -- Metrics --

    getMetrics: Ref.get(metrics),
  })
})

// =============================================================================
// Layers
// =============================================================================

/**
 * Composable layer — requires ChannelService + HolonetBridge in context.
 * Use when both services are already provided higher up in the Layer tree.
 */
export const EventDistributionLayer: Layer.Layer<
  EventDistribution,
  never,
  ChannelService | HolonetBridge
> = Layer.effect(EventDistribution, makeEventDistribution)

/**
 * Partially self-contained layer — bundles ChannelService but still
 * requires HolonetBridge from the caller.
 * Use in tests where ChannelService is internal but NATS bridge is external.
 */
export const EventDistributionLive: Layer.Layer<EventDistribution, never, HolonetBridge> =
  EventDistributionLayer.pipe(Layer.provide(ChannelServiceLive))
