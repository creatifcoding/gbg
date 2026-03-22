/**
 * Equipment State Event Reactivity
 *
 * EventLog.groupReactivity for cache invalidation per ISA-95/OEE.
 * Maps equipment state events to cache keys that should be invalidated.
 *
 * Cache invalidation follows OEE availability categories:
 * - Operational: equipment:operational (productive time)
 * - Degraded: equipment:degraded (performance losses)
 * - Faulted: equipment:faulted (unplanned downtime)
 * - Maintenance: equipment:maintenance (planned downtime)
 * - OEE: equipment:oee (effectiveness metrics)
 *
 * @module @gbg/tmnl/iiot/handlers/equipment-reactivity
 * @see ISA-95/IEC 62264 for equipment state standards
 * @see OEE standard for effectiveness calculations
 * @see ADR-0012 for ES boundaries (equipment state IS event sourced)
 */

import * as EventLog from '@effect/experimental/EventLog'
import { EquipmentStateEvents } from '../schemas/events/groups'

// =============================================================================
// Cache Key Constants
// =============================================================================

/**
 * Cache key constants for IIoT Equipment State Management System
 *
 * These keys map to cache entries that track different equipment states.
 * When an event is written, associated cache keys are invalidated,
 * triggering re-fetch of affected data.
 *
 * OEE Categories:
 * - Availability: operational vs downtime (planned + unplanned)
 * - Performance: actual vs expected throughput
 * - Quality: good output vs defects (handled by quality events)
 */
export const EQUIPMENT_CACHE_KEYS = {
  /** Operational equipment - running at expected capacity */
  EQUIPMENT_OPERATIONAL: 'equipment:operational',

  /** Degraded equipment - running below expected capacity */
  EQUIPMENT_DEGRADED: 'equipment:degraded',

  /** Faulted equipment - stopped due to fault (unplanned downtime) */
  EQUIPMENT_FAULTED: 'equipment:faulted',

  /** Equipment in maintenance - planned downtime */
  EQUIPMENT_MAINTENANCE: 'equipment:maintenance',

  /** Offline equipment - not scheduled for production */
  EQUIPMENT_OFFLINE: 'equipment:offline',

  /** Equipment state history - for trend analysis */
  EQUIPMENT_HISTORY: 'equipment:history',

  /** OEE metrics - availability, performance, quality */
  EQUIPMENT_OEE: 'equipment:oee',

  /** Dashboard summary - status distribution, availability rates */
  EQUIPMENT_DASHBOARD: 'equipment:dashboard',

  /** Active faults - requiring attention */
  EQUIPMENT_ACTIVE_FAULTS: 'equipment:active-faults',

  /** Scheduled maintenance - upcoming planned downtime */
  EQUIPMENT_SCHEDULED_MAINTENANCE: 'equipment:scheduled-maintenance',

  /** Machine-specific state prefix - append machineId for full key */
  EQUIPMENT_MACHINE_PREFIX: 'equipment:machine:',

  /** Line-specific state prefix - append lineId for full key */
  EQUIPMENT_LINE_PREFIX: 'equipment:line:',
} as const

// =============================================================================
// Reactivity Configuration
// =============================================================================

/**
 * Equipment State Reactivity Layer
 *
 * Invalidates cache keys when equipment state events are written.
 * Each event type maps to the cache keys it affects per OEE categories.
 *
 * @example
 * ```typescript
 * import { EquipmentStateReactivity } from './equipment-reactivity'
 * import { IIoTEventLogLayer } from '../infrastructure/eventlog-layer'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   EquipmentStateEventHandlers,
 *   EquipmentStateReactivity,
 * )
 * ```
 */
export const EquipmentStateReactivity = EventLog.groupReactivity(EquipmentStateEvents, {
  // =========================================================================
  // EquipmentStateChanged — State Machine Transition
  // =========================================================================
  // Affects: all state lists depending on from/to states, OEE, dashboard
  EquipmentStateChanged: [
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OPERATIONAL,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_DEGRADED,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_FAULTED,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_MAINTENANCE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OFFLINE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_HISTORY,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OEE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_DASHBOARD,
  ],

  // =========================================================================
  // MaintenanceModeEntered — Equipment Enters Maintenance
  // =========================================================================
  // Affects: maintenance list (add), operational (remove), OEE (planned downtime)
  MaintenanceModeEntered: [
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_MAINTENANCE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OPERATIONAL,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_SCHEDULED_MAINTENANCE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OEE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_DASHBOARD,
  ],

  // =========================================================================
  // MaintenanceModeExited — Equipment Exits Maintenance
  // =========================================================================
  // Affects: maintenance list (remove), operational (add if successful)
  MaintenanceModeExited: [
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_MAINTENANCE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OPERATIONAL,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_SCHEDULED_MAINTENANCE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OEE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_DASHBOARD,
  ],

  // =========================================================================
  // PerformanceDegraded — Below Optimal Performance
  // =========================================================================
  // Affects: degraded list (add), operational (update), OEE (performance loss)
  PerformanceDegraded: [
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_DEGRADED,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OPERATIONAL,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OEE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_DASHBOARD,
  ],

  // =========================================================================
  // FaultDetected — Equipment Fault Occurred
  // =========================================================================
  // Affects: faulted list (add), active faults (add), OEE (unplanned downtime)
  FaultDetected: [
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_FAULTED,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_ACTIVE_FAULTS,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OPERATIONAL,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OEE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_DASHBOARD,
  ],

  // =========================================================================
  // FaultCleared — Fault Resolved
  // =========================================================================
  // Affects: faulted list (remove), active faults (remove), operational (add)
  FaultCleared: [
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_FAULTED,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_ACTIVE_FAULTS,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OPERATIONAL,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_HISTORY,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_OEE,
    EQUIPMENT_CACHE_KEYS.EQUIPMENT_DASHBOARD,
  ],
})

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Type for EQUIPMENT_CACHE_KEYS values
 */
export type EquipmentCacheKey = (typeof EQUIPMENT_CACHE_KEYS)[keyof typeof EQUIPMENT_CACHE_KEYS]

/**
 * Helper to create machine-specific cache key
 *
 * @param machineId - The machine identifier
 * @returns Cache key like "equipment:machine:MACH-001"
 */
export const makeMachineCacheKey = (machineId: string): string =>
  `${EQUIPMENT_CACHE_KEYS.EQUIPMENT_MACHINE_PREFIX}${machineId}`

/**
 * Helper to create line-specific cache key
 *
 * @param lineId - The line identifier
 * @returns Cache key like "equipment:line:LINE-001"
 */
export const makeLineCacheKey = (lineId: string): string =>
  `${EQUIPMENT_CACHE_KEYS.EQUIPMENT_LINE_PREFIX}${lineId}`
