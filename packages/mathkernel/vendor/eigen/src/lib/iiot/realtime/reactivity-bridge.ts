/**
 * ReactivityBridge Service -- Handler-to-EventDistribution Adapter
 *
 * Thin adapter that entity event handlers call when domain events occur.
 * Each method accepts a handler-friendly input shape, constructs the
 * corresponding EventDistribution event type, and publishes it to the
 * appropriate PubSub channel.
 *
 * Architecture decision: Approach A (handler-level integration).
 * - Lower latency than polling
 * - No polling loop required
 * - Each handler calls the bridge inline after writing to EventLog
 *
 * @example
 * ```typescript
 * // Inside an alarm entity handler:
 * const handleAlarmTriggered = (event: AlarmTriggered) =>
 *   Effect.gen(function* () {
 *     yield* EventLog.write(event)
 *     yield* bridge.onAlarmEvent({
 *       eventType: 'triggered',
 *       alarmId: event.alarmId,
 *       deviceId: event.deviceId,
 *       severity: event.severity,
 *       message: event.message,
 *     })
 *   })
 * ```
 *
 * @module @gbg/tmnl/iiot/realtime/reactivity-bridge
 * @see thoughts/shared/plans/phase5-websocket-architecture.md Section 5
 */

import { Context, Effect, Layer } from 'effect'
import {
  EventDistribution,
  ReadingEvent,
  AlarmEvent,
  EquipmentStateChange,
  CacheInvalidation,
} from './event-distribution'

// =============================================================================
// Service Interface
// =============================================================================

export interface ReactivityBridgeShape {
  /** Called when an alarm event occurs (triggered, acknowledged, cleared, etc.) */
  readonly onAlarmEvent: (event: {
    readonly eventType: string
    readonly alarmId: string
    readonly deviceId: string
    readonly severity: string
    readonly message: string
  }) => Effect.Effect<void>

  /** Called when equipment state transitions */
  readonly onEquipmentStateChange: (change: {
    readonly equipmentId: string
    readonly previousState: string
    readonly newState: string
  }) => Effect.Effect<void>

  /** Called when a sensor reading is ingested (from pipeline) */
  readonly onReading: (reading: {
    readonly topic: string
    readonly value: number
    readonly deviceId: string
  }) => Effect.Effect<void>

  /** Called to invalidate a cache entry */
  readonly onCacheInvalidation: (inv: {
    readonly cacheKey: string
    readonly reason: string
  }) => Effect.Effect<void>
}

// =============================================================================
// Context.Tag
// =============================================================================

export class ReactivityBridge extends Context.Tag('tmnl/iiot/ReactivityBridge')<
  ReactivityBridge,
  ReactivityBridgeShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

const makeReactivityBridge = Effect.gen(function* () {
  const eventDist = yield* EventDistribution

  return ReactivityBridge.of({
    onAlarmEvent: (event) =>
      eventDist.publishAlarmEvent(
        new AlarmEvent({
          alarmId: event.alarmId,
          severity: event.severity,
          deviceId: event.deviceId,
          message: event.message,
          timestamp: new Date().toISOString(),
        })
      ),

    onEquipmentStateChange: (change) =>
      eventDist.publishEquipmentStateChange(
        new EquipmentStateChange({
          equipmentId: change.equipmentId,
          previousState: change.previousState,
          newState: change.newState,
          timestamp: new Date().toISOString(),
        })
      ),

    onReading: (reading) =>
      eventDist.publishReading(
        new ReadingEvent({
          topic: reading.topic,
          value: reading.value,
          deviceId: reading.deviceId,
          timestamp: new Date().toISOString(),
        })
      ),

    onCacheInvalidation: (inv) =>
      eventDist.publishInvalidation(
        new CacheInvalidation({
          cacheKey: inv.cacheKey,
          reason: inv.reason,
          timestamp: new Date().toISOString(),
        })
      ),
  })
})

// =============================================================================
// Layers
// =============================================================================

/**
 * Composable layer -- requires EventDistribution in context.
 * Use when EventDistribution is already provided higher up in the Layer tree.
 */
export const ReactivityBridgeLayer: Layer.Layer<ReactivityBridge, never, EventDistribution> =
  Layer.effect(ReactivityBridge, makeReactivityBridge)

/**
 * Convenience alias -- requires EventDistribution in context.
 * Used in tests alongside `EventDistributionLive`:
 *
 * ```typescript
 * effect.pipe(
 *   Effect.provide(ReactivityBridgeLive),
 *   Effect.provide(EventDistributionLive),
 * )
 * ```
 */
export const ReactivityBridgeLive: Layer.Layer<ReactivityBridge, never, EventDistribution> =
  ReactivityBridgeLayer
