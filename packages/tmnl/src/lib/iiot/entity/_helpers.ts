/**
 * Entity Handler Helper Functions
 *
 * Feature-flag controlled, non-blocking event emission helpers for entity handlers.
 * Events are logged when enabled but failures never fail the parent operation.
 *
 * @module
 */

import { Effect } from 'effect'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'

// =============================================================================
// Event Emission Helpers
// =============================================================================

/**
 * Feature-flag controlled, non-blocking event emission for WorkOrder events.
 *
 * When workOrderEventSourcingEnabled is true, logs the event.
 * When false, no-op.
 * Failures are caught and logged, never propagating to caller.
 *
 * @param flags - The feature flags instance (already resolved)
 * @param eventType - The event type (e.g., 'WorkOrderCreated')
 * @param payload - The event payload to log
 */
export const maybeEmitWorkOrder = (
  flags: FeatureFlagsShape,
  eventType: string,
  payload: unknown
): Effect.Effect<void> => {
  if (!flags.workOrderEventSourcingEnabled) {
    return Effect.void // No-op when disabled
  }

  return Effect.logInfo(`[ES:WorkOrder] ${eventType}`, { payload }).pipe(
    Effect.catchAll((err) =>
      Effect.logWarning(`Event emission failed (non-blocking): ${String(err)}`)
    )
  )
}

/**
 * Feature-flag controlled, non-blocking event emission for Alarm events.
 *
 * When alarmEventSourcingEnabled is true, logs the event.
 * When false, no-op.
 * Failures are caught and logged, never propagating to caller.
 *
 * @param flags - The feature flags instance (already resolved)
 * @param eventType - The event type (e.g., 'AlarmTriggered')
 * @param payload - The event payload to log
 */
export const maybeEmitAlarm = (
  flags: FeatureFlagsShape,
  eventType: string,
  payload: unknown
): Effect.Effect<void> => {
  if (!flags.alarmEventSourcingEnabled) {
    return Effect.void // No-op when disabled
  }

  return Effect.logInfo(`[ES:Alarm] ${eventType}`, { payload }).pipe(
    Effect.catchAll((err) =>
      Effect.logWarning(`Event emission failed (non-blocking): ${String(err)}`)
    )
  )
}

/**
 * Feature-flag controlled, non-blocking event emission for EquipmentState events.
 *
 * When equipmentStateEventSourcingEnabled is true, logs the event.
 * When false, no-op.
 * Failures are caught and logged, never propagating to caller.
 *
 * @param flags - The feature flags instance (already resolved)
 * @param eventType - The event type (e.g., 'EquipmentStateChanged')
 * @param payload - The event payload to log
 */
export const maybeEmitEquipment = (
  flags: FeatureFlagsShape,
  eventType: string,
  payload: unknown
): Effect.Effect<void> => {
  if (!flags.equipmentStateEventSourcingEnabled) {
    return Effect.void // No-op when disabled
  }

  return Effect.logInfo(`[ES:EquipmentState] ${eventType}`, { payload }).pipe(
    Effect.catchAll((err) =>
      Effect.logWarning(`Event emission failed (non-blocking): ${String(err)}`)
    )
  )
}

// =============================================================================
// Convenience: Combined Event Emission
// =============================================================================

/**
 * Generic event emission with explicit flag check.
 *
 * Use when you have the flags already in scope and want to avoid yield*.
 *
 * @param flags - The feature flags instance
 * @param domain - The domain ('WorkOrder' | 'Alarm' | 'EquipmentState')
 * @param eventType - The event type
 * @param payload - The event payload
 */
export const emitIfEnabled = (
  flags: FeatureFlagsShape,
  domain: 'WorkOrder' | 'Alarm' | 'EquipmentState',
  eventType: string,
  payload: unknown
): Effect.Effect<void> => {
  const enabled = (() => {
    switch (domain) {
      case 'WorkOrder':
        return flags.workOrderEventSourcingEnabled
      case 'Alarm':
        return flags.alarmEventSourcingEnabled
      case 'EquipmentState':
        return flags.equipmentStateEventSourcingEnabled
    }
  })()

  if (!enabled) {
    return Effect.void
  }

  return Effect.logInfo(`[ES:${domain}] ${eventType}`, { payload }).pipe(
    Effect.catchAll((err) =>
      Effect.logWarning(`Event emission failed (non-blocking): ${String(err)}`)
    )
  )
}
