/**
 * Equipment State Event Handlers — Projections for ISA-95/OEE Equipment State
 *
 * Handles EquipmentStateEvents by projecting them into observability logs.
 * These handlers run when events are written to the EventLog, providing
 * structured logging for state transitions, maintenance, and fault management.
 *
 * IMPORTANT: EventLog.group handlers must return Effect<void, never, R>.
 * All errors must be caught and logged, never propagated.
 *
 * OEE Context:
 * - Availability tracking via state transitions and maintenance events
 * - Performance tracking via degradation events
 * - Downtime tracking via fault detection/clearing
 *
 * @module @gbg/tmnl/iiot/handlers/equipment-handlers
 * @see @effect/experimental/EventLog for EventLog.group API
 * @see ISA-95/IEC 62264 for equipment state standards
 * @see OEE standard for effectiveness calculations
 */

import { Effect, Option, Cause } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { EquipmentStateEvents } from '../schemas/events/groups'

// =============================================================================
// Helper: Wrap handlers with error catching
// =============================================================================

/**
 * Wraps an effect to catch all errors and log them.
 * EventLog.group handlers must not propagate errors.
 */
const catchHandlerError = <A, E, R>(handlerName: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.catchAllCause((cause) =>
      Effect.log(`[EquipmentStateHandler] ${handlerName} failed: ${Cause.pretty(cause)}`)
    ),
    Effect.asVoid
  )

// =============================================================================
// OEE Context Helpers
// =============================================================================

/**
 * Format OEE impact for logging.
 * OEE impact is a value between 0 and 1 representing fractional loss.
 */
const formatOeeImpact = (impact: Option.Option<number>): string =>
  Option.match(impact, {
    onNone: () => 'unknown',
    onSome: (value) => `${(value * 100).toFixed(1)}%`,
  })

/**
 * Format duration in seconds to human-readable format.
 */
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

/**
 * Get OEE availability classification for state transitions.
 */
const getAvailabilityClassification = (
  state: 'operational' | 'degraded' | 'faulted' | 'maintenance' | 'offline'
): string => {
  switch (state) {
    case 'operational':
      return 'productive'
    case 'degraded':
      return 'performance_loss'
    case 'faulted':
      return 'unplanned_downtime'
    case 'maintenance':
      return 'planned_downtime'
    case 'offline':
      return 'not_scheduled'
  }
}

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * EquipmentStateEventHandlers — Projections for Equipment State
 *
 * Each handler receives the event payload and entry metadata, then
 * logs the state transition with OEE-relevant context.
 *
 * Handlers are primarily for observability:
 * - State transitions: Log with availability classification
 * - Maintenance: Log with planned/unplanned classification
 * - Faults: Log with severity and downtime tracking
 * - Performance: Log with degradation metrics
 *
 * All handlers wrap operations in catchHandlerError to ensure errors
 * are logged but not propagated (EventLog requirement).
 *
 * @example
 * ```typescript
 * import { EquipmentStateEventHandlers } from './equipment-handlers'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   EquipmentStateEventHandlers,
 * )
 * ```
 */
export const EquipmentStateEventHandlers = EventLog.group(EquipmentStateEvents, (handlers) =>
  handlers
    // =========================================================================
    // EquipmentStateChanged — State Machine Transition
    // =========================================================================
    .handle('EquipmentStateChanged', ({ payload }) =>
      catchHandlerError(
        'EquipmentStateChanged',
        Effect.gen(function* () {
          const fromClassification = getAvailabilityClassification(payload.previousState)
          const toClassification = getAvailabilityClassification(payload.newState)

          yield* Effect.log(
            `[EquipmentStateHandler] State changed: ${payload.machineId} ` +
            `${payload.previousState} -> ${payload.newState} ` +
            `(${fromClassification} -> ${toClassification})` +
            `${Option.isSome(payload.reason) ? `, reason: ${payload.reason.value}` : ''}` +
            `${Option.isSome(payload.triggeredBy) ? `, triggered by: ${payload.triggeredBy.value}` : ''}`
          )
        })
      )
    )

    // =========================================================================
    // MaintenanceModeEntered — Equipment Enters Maintenance
    // =========================================================================
    .handle('MaintenanceModeEntered', ({ payload }) =>
      catchHandlerError(
        'MaintenanceModeEntered',
        Effect.gen(function* () {
          const downtimeType = payload.maintenanceType === 'scheduled'
            ? 'planned_downtime'
            : 'unplanned_downtime'

          const durationInfo = Option.match(payload.scheduledDuration, {
            onNone: () => 'duration unknown',
            onSome: (duration) => `scheduled ${formatDuration(duration)}`,
          })

          yield* Effect.log(
            `[EquipmentStateHandler] Maintenance entered: ${payload.machineId} ` +
            `type=${payload.maintenanceType} (${downtimeType}), ${durationInfo}` +
            `${Option.isSome(payload.workOrderId) ? `, WO: ${payload.workOrderId.value}` : ''}` +
            `${Option.isSome(payload.technician) ? `, tech: ${payload.technician.value}` : ''}`
          )
        })
      )
    )

    // =========================================================================
    // MaintenanceModeExited — Equipment Exits Maintenance
    // =========================================================================
    .handle('MaintenanceModeExited', ({ payload }) =>
      catchHandlerError(
        'MaintenanceModeExited',
        Effect.gen(function* () {
          yield* Effect.log(
            `[EquipmentStateHandler] Maintenance exited: ${payload.machineId} ` +
            `outcome=${payload.outcome}, actual duration: ${formatDuration(payload.actualDuration)}` +
            `${Option.isSome(payload.workOrderId) ? `, WO: ${payload.workOrderId.value}` : ''}` +
            `${Option.isSome(payload.technician) ? `, tech: ${payload.technician.value}` : ''}` +
            `${Option.isSome(payload.nextMaintenanceDate) ? `, next maintenance scheduled` : ''}`
          )
        })
      )
    )

    // =========================================================================
    // PerformanceDegraded — Below Optimal Performance
    // =========================================================================
    .handle('PerformanceDegraded', ({ payload }) =>
      catchHandlerError(
        'PerformanceDegraded',
        Effect.gen(function* () {
          const performanceLoss = payload.expectedPerformance - payload.performancePercent
          const oeeImpactStr = formatOeeImpact(payload.oeeImpact)

          yield* Effect.log(
            `[EquipmentStateHandler] Performance degraded: ${payload.machineId} ` +
            `at ${payload.performancePercent.toFixed(1)}% (expected: ${payload.expectedPerformance.toFixed(1)}%, ` +
            `loss: ${performanceLoss.toFixed(1)}%), OEE impact: ${oeeImpactStr}` +
            `${Option.isSome(payload.degradationReason) ? `, reason: ${payload.degradationReason.value}` : ''}` +
            `, affected metrics: [${payload.affectedMetrics.join(', ')}]`
          )
        })
      )
    )

    // =========================================================================
    // FaultDetected — Equipment Fault Occurred
    // =========================================================================
    .handle('FaultDetected', ({ payload }) =>
      catchHandlerError(
        'FaultDetected',
        Effect.gen(function* () {
          const severityLevel = payload.faultSeverity === 'critical' ? 'CRITICAL'
            : payload.faultSeverity === 'major' ? 'MAJOR'
            : 'MINOR'

          yield* Effect.log(
            `[EquipmentStateHandler] [${severityLevel}] Fault detected: ${payload.machineId} ` +
            `code=${payload.faultCode}, ${payload.faultDescription}` +
            `${Option.isSome(payload.affectedComponent) ? `, component: ${payload.affectedComponent.value}` : ''}` +
            `${Option.isSome(payload.recommendedAction) ? `, action: ${payload.recommendedAction.value}` : ''}`
          )

          // Log sensor readings if available (for diagnostic context)
          if (Option.isSome(payload.sensorReadings)) {
            const readings = Object.entries(payload.sensorReadings.value)
              .map(([key, value]) => `${key}=${value}`)
              .join(', ')
            yield* Effect.log(
              `[EquipmentStateHandler] Fault sensor readings: ${payload.machineId} [${readings}]`
            )
          }
        })
      )
    )

    // =========================================================================
    // FaultCleared — Fault Resolved
    // =========================================================================
    .handle('FaultCleared', ({ payload }) =>
      catchHandlerError(
        'FaultCleared',
        Effect.gen(function* () {
          const downtimeInfo = Option.match(payload.downtime, {
            onNone: () => 'downtime not tracked',
            onSome: (seconds) => `downtime: ${formatDuration(seconds)}`,
          })

          yield* Effect.log(
            `[EquipmentStateHandler] Fault cleared: ${payload.machineId} ` +
            `code=${payload.faultCode}, method=${payload.clearMethod}, ${downtimeInfo}` +
            `${Option.isSome(payload.verifiedBy) ? `, verified by: ${payload.verifiedBy.value}` : ''}` +
            `${Option.isSome(payload.resolutionNotes) ? `, notes: ${payload.resolutionNotes.value}` : ''}`
          )
        })
      )
    )
)

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Layer type for EquipmentStateEventHandlers.
 * This layer provides handlers for all equipment state events in the EquipmentStateEvents group.
 */
export type EquipmentStateEventHandlersLayer = typeof EquipmentStateEventHandlers
