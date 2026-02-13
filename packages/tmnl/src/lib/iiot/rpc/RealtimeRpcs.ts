/**
 * RealtimeRpcs - Real-time Streaming RPC Definitions
 *
 * Defines 4 streaming RPCs for WebSocket-based subscriptions:
 * - SubscribeReadings: Live sensor readings
 * - SubscribeAlarms: Alarm lifecycle events
 * - SubscribeEquipmentState: Equipment state transitions
 * - SubscribeInvalidations: Cache invalidation notifications
 *
 * All RPCs use `stream: true` to emit events as they arrive.
 *
 * @module
 * @see thoughts/shared/plans/phase5-websocket-architecture.md
 */

import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'
import { DeviceId, PlantId, AlarmId } from '../schemas/identifiers'
import { SensorReading } from '../schemas/readings'
import { AlarmSeverity } from '../schemas/alarms'

// =============================================================================
// Supporting Schemas
// =============================================================================

/**
 * Real-time subscription error.
 *
 * Used as the error channel for all streaming RPCs.
 */
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
 * Alarm lifecycle event (union for streaming).
 *
 * Emitted by SubscribeAlarms for each alarm state transition.
 * Event types follow ISA-18.2 alarm lifecycle.
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
 * Equipment state change notification.
 *
 * Emitted by SubscribeEquipmentState when any entity in the
 * ISA-95 hierarchy changes state.
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
 * Cache invalidation notification.
 *
 * Emitted by SubscribeInvalidations when cached data becomes stale.
 * Backed by EventLog.groupReactivity cache key invalidation.
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
  success: AlarmEvent,
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
// RpcGroup
// =============================================================================

export const RealtimeRpcs = RpcGroup.make(
  SubscribeReadings,
  SubscribeAlarms,
  SubscribeEquipmentState,
  SubscribeInvalidations,
)

// Export type for client typing
export type RealtimeRpcs = typeof RealtimeRpcs
