/**
 * Realtime RPC Handlers — Filter + Throttle Layer
 *
 * Connects the RealtimeRpcs definitions to EventDistribution by:
 *   1. Subscribing to EventDistribution outlet streams
 *   2. Mapping event-distribution event types to RPC response types
 *   3. Applying per-request filters (deviceId, severity, entityType, patterns)
 *   4. Applying optional throttle (readings only)
 *
 * Each handler function takes an EventDistributionShape and a request payload,
 * returning an Effect that yields a Stream of the appropriate RPC success type.
 *
 * @module @gbg/tmnl/iiot/realtime/realtime-handlers
 * @see thoughts/shared/plans/phase5-websocket-architecture.md Section 3
 */

import { Context, DateTime, Duration, Effect, Layer, Stream } from 'effect'
import type { EventDistributionShape } from './event-distribution'
import {
  EventDistribution,
  EventDistributionLive,
  ReadingEvent,
  AlarmEvent as DistAlarmEvent,
  EquipmentStateChange as DistEquipmentStateChange,
  CacheInvalidation as DistCacheInvalidation,
} from './event-distribution'
import { HolonetBridge } from './holonet-bridge'
import {
  AlarmEvent as RpcAlarmEvent,
  EquipmentStateChange as RpcEquipmentStateChange,
  CacheInvalidation as RpcCacheInvalidation,
} from '../rpc/RealtimeRpcs'
import { SensorReading } from '../schemas/readings'
import type { DeviceId } from '../schemas/identifiers'
import type { AlarmSeverity } from '../schemas/alarms'

// =============================================================================
// Severity Ordering
// =============================================================================

/**
 * Severity order for alarm filtering.
 * Higher number = more severe.
 *
 * info (0) < warning (1) < critical (2) < emergency (3)
 */
export const SEVERITY_ORDER: Record<string, number> = {
  info: 0,
  warning: 1,
  critical: 2,
  emergency: 3,
}

// =============================================================================
// Glob Pattern Matching
// =============================================================================

/**
 * Simple glob matcher for cache key patterns.
 *
 * Supports:
 *   - `*` matches any sequence of characters
 *   - `?` matches exactly one character
 *
 * @param pattern - Glob pattern (e.g. 'alarms:*', 'readings:device-00?')
 * @param value   - String to test against the pattern
 * @returns true if value matches pattern
 */
export const matchGlobPattern = (pattern: string, value: string): boolean => {
  const regex = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  )
  return regex.test(value)
}

// =============================================================================
// Handler: SubscribeReadings
// =============================================================================

/**
 * Handle SubscribeReadings RPC.
 *
 * Maps ReadingEvent from EventDistribution to SensorReading from RPC schema.
 * Applies optional deviceId/plantId filter and throttle.
 */
export const handleSubscribeReadings = (
  dist: EventDistributionShape,
  payload: {
    readonly deviceId?: DeviceId | undefined
    readonly plantId?: string | undefined
    readonly throttleMs?: number | undefined
  }
): Effect.Effect<Stream.Stream<SensorReading>> =>
  Effect.gen(function* () {
    const rawStream = yield* dist.subscribeReadings

    // Map dist ReadingEvent -> RPC SensorReading
    let stream: Stream.Stream<SensorReading> = rawStream.pipe(
      Stream.map((evt: ReadingEvent) =>
        new SensorReading({
          time: DateTime.unsafeFromDate(new Date(evt.timestamp)),
          deviceId: evt.deviceId as DeviceId,
          value: evt.value,
          quality: 100 as any, // default good quality
        })
      ),
    )

    // Filter by deviceId if provided
    if (payload.deviceId) {
      const targetDeviceId = payload.deviceId
      stream = stream.pipe(
        Stream.filter((r) => r.deviceId === targetDeviceId),
      )
    }

    // Filter by plantId (deviceId prefix convention)
    if (payload.plantId) {
      const prefix = payload.plantId + ':'
      stream = stream.pipe(
        Stream.filter((r) => (r.deviceId as string).startsWith(prefix)),
      )
    }

    // Apply throttle if provided
    if (payload.throttleMs) {
      const ms = payload.throttleMs
      stream = stream.pipe(
        Stream.throttle({
          cost: () => 1,
          duration: Duration.millis(ms),
          units: 1,
          strategy: 'enforce',
        }),
      )
    }

    return stream
  })

// =============================================================================
// Handler: SubscribeAlarms
// =============================================================================

/**
 * Handle SubscribeAlarms RPC.
 *
 * Maps AlarmEvent from EventDistribution to RPC AlarmEvent.
 * Applies optional deviceId and minSeverity filters.
 */
export const handleSubscribeAlarms = (
  dist: EventDistributionShape,
  payload: {
    readonly deviceId?: DeviceId | undefined
    readonly minSeverity?: AlarmSeverity | undefined
    readonly onlyUnacknowledged?: boolean | undefined
  }
): Effect.Effect<Stream.Stream<RpcAlarmEvent>> =>
  Effect.gen(function* () {
    const rawStream = yield* dist.subscribeAlarms

    // Map dist AlarmEvent -> RPC AlarmEvent
    let stream: Stream.Stream<RpcAlarmEvent> = rawStream.pipe(
      Stream.map((evt: DistAlarmEvent) =>
        new RpcAlarmEvent({
          eventType: 'triggered',
          alarmId: evt.alarmId as any,
          deviceId: evt.deviceId as DeviceId,
          severity: evt.severity as AlarmSeverity,
          timestamp: DateTime.unsafeFromDate(new Date(evt.timestamp)),
        })
      ),
    )

    // Filter by deviceId if provided
    if (payload.deviceId) {
      const targetDeviceId = payload.deviceId
      stream = stream.pipe(
        Stream.filter((a) => a.deviceId === targetDeviceId),
      )
    }

    // Filter by minSeverity if provided
    if (payload.minSeverity) {
      const minOrder = SEVERITY_ORDER[payload.minSeverity as string] ?? 0
      stream = stream.pipe(
        Stream.filter((a) => (SEVERITY_ORDER[a.severity as string] ?? 0) >= minOrder),
      )
    }

    return stream
  })

// =============================================================================
// Handler: SubscribeEquipmentState
// =============================================================================

/**
 * Handle SubscribeEquipmentState RPC.
 *
 * Maps EquipmentStateChange from EventDistribution to RPC EquipmentStateChange.
 * The entityType is derived from the equipmentId prefix convention: "Type:id".
 * Applies optional entityType filter.
 */
export const handleSubscribeEquipmentState = (
  dist: EventDistributionShape,
  payload: {
    readonly entityType?: string | undefined
    readonly plantId?: string | undefined
  }
): Effect.Effect<Stream.Stream<RpcEquipmentStateChange>> =>
  Effect.gen(function* () {
    const rawStream = yield* dist.subscribeEquipmentState

    // Map dist EquipmentStateChange -> RPC EquipmentStateChange
    // Convention: equipmentId is "EntityType:entityId" (e.g., "Machine:mch-001")
    let stream: Stream.Stream<RpcEquipmentStateChange> = rawStream.pipe(
      Stream.map((evt: DistEquipmentStateChange) => {
        const [entityType, entityId] = evt.equipmentId.includes(':')
          ? [evt.equipmentId.split(':')[0], evt.equipmentId.split(':').slice(1).join(':')]
          : ['Unknown', evt.equipmentId]

        return new RpcEquipmentStateChange({
          entityType,
          entityId,
          previousState: evt.previousState,
          currentState: evt.newState,
          changedAt: DateTime.unsafeFromDate(new Date(evt.timestamp)),
        })
      }),
    )

    // Filter by entityType if provided
    if (payload.entityType) {
      const targetType = payload.entityType
      stream = stream.pipe(
        Stream.filter((e) => e.entityType === targetType),
      )
    }

    return stream
  })

// =============================================================================
// Handler: SubscribeInvalidations
// =============================================================================

/**
 * Handle SubscribeInvalidations RPC.
 *
 * Maps CacheInvalidation from EventDistribution to RPC CacheInvalidation.
 * Applies pattern matching on cacheKey using glob patterns.
 */
export const handleSubscribeInvalidations = (
  dist: EventDistributionShape,
  payload: {
    readonly patterns: ReadonlyArray<string>
  }
): Effect.Effect<Stream.Stream<RpcCacheInvalidation>> =>
  Effect.gen(function* () {
    const rawStream = yield* dist.subscribeInvalidations

    // Map dist CacheInvalidation -> RPC CacheInvalidation
    let stream: Stream.Stream<RpcCacheInvalidation> = rawStream.pipe(
      Stream.map((evt: DistCacheInvalidation) =>
        new RpcCacheInvalidation({
          cacheKey: evt.cacheKey,
          invalidatedAt: DateTime.unsafeFromDate(new Date(evt.timestamp)),
          reason: evt.reason,
        })
      ),
    )

    // Filter by patterns (any pattern match passes)
    const patterns = payload.patterns
    if (patterns.length > 0) {
      stream = stream.pipe(
        Stream.filter((inv) =>
          patterns.some((pattern) => matchGlobPattern(pattern, inv.cacheKey))
        ),
      )
    }

    return stream
  })

// =============================================================================
// Composite Handler Layer
// =============================================================================

/**
 * Service interface for realtime RPC handlers.
 *
 * Each method corresponds to a streaming RPC from RealtimeRpcs,
 * taking the request payload and returning a Stream.
 */
export interface RealtimeRpcHandlersShape {
  readonly subscribeReadings: (payload: {
    readonly deviceId?: DeviceId | undefined
    readonly plantId?: string | undefined
    readonly throttleMs?: number | undefined
  }) => Effect.Effect<Stream.Stream<SensorReading>>

  readonly subscribeAlarms: (payload: {
    readonly deviceId?: DeviceId | undefined
    readonly minSeverity?: AlarmSeverity | undefined
    readonly onlyUnacknowledged?: boolean | undefined
  }) => Effect.Effect<Stream.Stream<RpcAlarmEvent>>

  readonly subscribeEquipmentState: (payload: {
    readonly entityType?: string | undefined
    readonly plantId?: string | undefined
  }) => Effect.Effect<Stream.Stream<RpcEquipmentStateChange>>

  readonly subscribeInvalidations: (payload: {
    readonly patterns: ReadonlyArray<string>
  }) => Effect.Effect<Stream.Stream<RpcCacheInvalidation>>
}

export class RealtimeRpcHandlers extends Context.Tag('tmnl/iiot/RealtimeRpcHandlers')<
  RealtimeRpcHandlers,
  RealtimeRpcHandlersShape
>() {}

/**
 * Build the handler service from EventDistribution.
 */
const makeRealtimeRpcHandlers = Effect.gen(function* () {
  const dist = yield* EventDistribution

  return RealtimeRpcHandlers.of({
    subscribeReadings: (payload) => handleSubscribeReadings(dist, payload),
    subscribeAlarms: (payload) => handleSubscribeAlarms(dist, payload),
    subscribeEquipmentState: (payload) => handleSubscribeEquipmentState(dist, payload),
    subscribeInvalidations: (payload) => handleSubscribeInvalidations(dist, payload),
  })
})

/**
 * Composable layer -- requires EventDistribution in context.
 */
export const RealtimeRpcHandlersLayer: Layer.Layer<
  RealtimeRpcHandlers,
  never,
  EventDistribution
> = Layer.effect(RealtimeRpcHandlers, makeRealtimeRpcHandlers)

/**
 * Partially self-contained layer -- bundles EventDistribution internally
 * but still requires HolonetBridge from the caller.
 * For standalone setups, provide HolonetBridgeLive (backed by NATS).
 */
export const RealtimeRpcHandlersLive: Layer.Layer<RealtimeRpcHandlers, never, HolonetBridge> =
  RealtimeRpcHandlersLayer.pipe(Layer.provide(EventDistributionLive))
