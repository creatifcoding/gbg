/**
 * Alarm Event Reactivity
 *
 * EventLog.groupReactivity for cache invalidation per ISA-18.2.
 * Maps alarm events to cache keys that should be invalidated.
 *
 * Cache invalidation follows ISA-18.2 alarm lifecycle:
 * - Active alarms: alarms:active (triggered, not yet cleared)
 * - Acknowledged: alarms:unacknowledged (operator has acknowledged)
 * - Cleared: alarms:history (alarm condition has returned to normal)
 * - Escalated: alarms:escalated (unacknowledged past timeout)
 * - Shelved: alarms:shelved (temporarily hidden from operators)
 * - Suppressed: alarms:suppressed (intentionally ignored during maintenance)
 * - Out of Service: alarms:oos (disabled for maintenance)
 * - Config: alarms:config (alarm configuration changes)
 *
 * @module @gbg/tmnl/iiot/handlers/alarm-reactivity
 * @see ISA-18.2 for alarm management standard
 * @see ADR-0012 for ES boundaries (alarms ARE event sourced)
 */

import * as EventLog from '@effect/experimental/EventLog'
import { AlarmEvents } from '../schemas/events/groups'

// =============================================================================
// Cache Key Constants
// =============================================================================

/**
 * Cache key constants for IIoT Alarm Management System
 *
 * These keys map to cache entries that track different alarm states.
 * When an event is written, associated cache keys are invalidated,
 * triggering re-fetch of affected data.
 */
export const ALARM_CACHE_KEYS = {
  /** Active alarms - triggered but not yet cleared */
  ALARMS_ACTIVE: 'alarms:active',

  /** Dashboard summary - counts, recent alarms, severity distribution */
  ALARMS_DASHBOARD: 'alarms:dashboard',

  /** Historical alarms - cleared alarms for analysis */
  ALARMS_HISTORY: 'alarms:history',

  /** Unacknowledged alarms - requiring operator attention */
  ALARMS_UNACKNOWLEDGED: 'alarms:unacknowledged',

  /** Escalated alarms - exceeded response time thresholds */
  ALARMS_ESCALATED: 'alarms:escalated',

  /** Shelved alarms - temporarily hidden */
  ALARMS_SHELVED: 'alarms:shelved',

  /** Suppressed alarms - intentionally ignored */
  ALARMS_SUPPRESSED: 'alarms:suppressed',

  /** Out of service alarms - disabled for maintenance */
  ALARMS_OOS: 'alarms:oos',

  /** Alarm configuration - setpoints, priorities, etc. */
  ALARMS_CONFIG: 'alarms:config',

  /** Device-specific alarm prefix - append deviceId for full key */
  ALARMS_DEVICE_PREFIX: 'alarms:device:',
} as const

// =============================================================================
// Reactivity Configuration
// =============================================================================

/**
 * Alarm Reactivity Layer
 *
 * Invalidates cache keys when alarm events are written.
 * Each event type maps to the cache keys it affects per ISA-18.2.
 *
 * @example
 * ```typescript
 * import { AlarmReactivity } from './alarm-reactivity'
 * import { IIoTEventLogLayer } from '../infrastructure/eventlog-layer'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   AlarmEventHandlers,
 *   AlarmReactivity,
 * )
 * ```
 */
export const AlarmReactivity = EventLog.groupReactivity(AlarmEvents, {
  // =========================================================================
  // AlarmTriggered — New alarm condition detected
  // =========================================================================
  // Affects: active list, dashboard summary, device-specific list
  AlarmTriggered: [
    ALARM_CACHE_KEYS.ALARMS_ACTIVE,
    ALARM_CACHE_KEYS.ALARMS_DASHBOARD,
    ALARM_CACHE_KEYS.ALARMS_UNACKNOWLEDGED,
  ],

  // =========================================================================
  // AlarmAcknowledged — Operator has acknowledged the alarm
  // =========================================================================
  // Affects: active list (to refresh ack status), unacknowledged count
  AlarmAcknowledged: [
    ALARM_CACHE_KEYS.ALARMS_ACTIVE,
    ALARM_CACHE_KEYS.ALARMS_UNACKNOWLEDGED,
  ],

  // =========================================================================
  // AlarmCleared — Alarm condition has returned to normal
  // =========================================================================
  // Affects: active list (remove), history (add)
  AlarmCleared: [
    ALARM_CACHE_KEYS.ALARMS_ACTIVE,
    ALARM_CACHE_KEYS.ALARMS_HISTORY,
    ALARM_CACHE_KEYS.ALARMS_DASHBOARD,
  ],

  // =========================================================================
  // AlarmEscalated — Unacknowledged past timeout threshold
  // =========================================================================
  // Affects: escalated list (add), dashboard (escalation count)
  AlarmEscalated: [
    ALARM_CACHE_KEYS.ALARMS_ESCALATED,
    ALARM_CACHE_KEYS.ALARMS_DASHBOARD,
  ],

  // =========================================================================
  // AlarmShelved — Temporarily hidden from operators
  // =========================================================================
  // Affects: active list (reduce visibility), shelved list (add)
  AlarmShelved: [
    ALARM_CACHE_KEYS.ALARMS_ACTIVE,
    ALARM_CACHE_KEYS.ALARMS_SHELVED,
  ],

  // =========================================================================
  // AlarmUnshelved — Restored to normal visibility
  // =========================================================================
  // Affects: active list (restore visibility), shelved list (remove)
  AlarmUnshelved: [
    ALARM_CACHE_KEYS.ALARMS_ACTIVE,
    ALARM_CACHE_KEYS.ALARMS_SHELVED,
  ],

  // =========================================================================
  // AlarmSuppressed — Intentionally ignored during maintenance
  // =========================================================================
  // Affects: active list (mark suppressed), suppressed list (add)
  AlarmSuppressed: [
    ALARM_CACHE_KEYS.ALARMS_ACTIVE,
    ALARM_CACHE_KEYS.ALARMS_SUPPRESSED,
  ],

  // =========================================================================
  // AlarmOutOfService — Disabled for maintenance
  // =========================================================================
  // Affects: active list (remove from active), OOS list (add)
  AlarmOutOfService: [
    ALARM_CACHE_KEYS.ALARMS_ACTIVE,
    ALARM_CACHE_KEYS.ALARMS_OOS,
  ],

  // =========================================================================
  // AlarmReturnedToService — Re-enabled after maintenance
  // =========================================================================
  // Affects: active list (may become active), OOS list (remove)
  AlarmReturnedToService: [
    ALARM_CACHE_KEYS.ALARMS_ACTIVE,
    ALARM_CACHE_KEYS.ALARMS_OOS,
  ],

  // =========================================================================
  // AlarmConfigChanged — Alarm configuration modified
  // =========================================================================
  // Affects: config cache (setpoints, priorities, etc.)
  AlarmConfigChanged: [
    ALARM_CACHE_KEYS.ALARMS_CONFIG,
  ],
})

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Type for ALARM_CACHE_KEYS values
 */
export type AlarmCacheKey = (typeof ALARM_CACHE_KEYS)[keyof typeof ALARM_CACHE_KEYS]

/**
 * Helper to create device-specific cache key
 *
 * @param deviceId - The device identifier
 * @returns Cache key like "alarms:device:DEV-001"
 */
export const makeDeviceCacheKey = (deviceId: string): string =>
  `${ALARM_CACHE_KEYS.ALARMS_DEVICE_PREFIX}${deviceId}`
