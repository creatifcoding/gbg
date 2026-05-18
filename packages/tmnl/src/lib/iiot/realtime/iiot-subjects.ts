/**
 * IIoT Subject Definitions — NATS Subject Specs for IIoT Event Channels
 *
 * Defines 4 NATS subject specs for the IIoT realtime event channels,
 * using the Holonet subject architecture. Each spec provides:
 * - resolve() — concrete subject from params
 * - wildcardPattern() — subscription wildcard
 * - matches() — test if a concrete subject matches
 * - extractParams() — pull params from concrete subject
 *
 * Domain: "iiot" (independent domain, no convention restrictions)
 *
 * @module @gbg/tmnl/iiot/realtime/iiot-subjects
 * @see src/lib/holonet/subject/schemas.ts
 */

import { createSubjectSpec } from '../../holonet/subject/schemas'

// =============================================================================
// IIoT Subject Specs
// =============================================================================

/**
 * Sensor reading events.
 * Pattern: iiot.readings.{deviceId}
 *
 * @example
 * ```typescript
 * IIoTReadingsSubject.resolve({ deviceId: 'sensor-42' })
 * // => "iiot.readings.sensor-42"
 *
 * IIoTReadingsSubject.wildcardPattern()
 * // => "iiot.readings.*"
 *
 * IIoTReadingsSubject.matches('iiot.readings.sensor-42')
 * // => true
 * ```
 */
export const IIoTReadingsSubject = createSubjectSpec({
  domain: 'iiot',
  entityType: 'readings',
  pattern: 'iiot.readings.{deviceId}',
  schemaId: 'ReadingEvent',
  description: 'Sensor reading events — high-throughput telemetry from IIoT devices',
  streamMapping: { _tag: 'domain' },
})

/**
 * Alarm lifecycle events.
 * Pattern: iiot.alarms.{deviceId}
 *
 * @example
 * ```typescript
 * IIoTAlarmsSubject.resolve({ deviceId: 'plc-17' })
 * // => "iiot.alarms.plc-17"
 *
 * IIoTAlarmsSubject.wildcardPattern()
 * // => "iiot.alarms.*"
 * ```
 */
export const IIoTAlarmsSubject = createSubjectSpec({
  domain: 'iiot',
  entityType: 'alarms',
  pattern: 'iiot.alarms.{deviceId}',
  schemaId: 'AlarmEvent',
  description: 'Alarm lifecycle events — raise, acknowledge, clear',
  streamMapping: { _tag: 'domain' },
})

/**
 * Equipment state transition events.
 * Pattern: iiot.equipment.{equipmentId}
 *
 * @example
 * ```typescript
 * IIoTEquipmentSubject.resolve({ equipmentId: 'press-A' })
 * // => "iiot.equipment.press-A"
 *
 * IIoTEquipmentSubject.wildcardPattern()
 * // => "iiot.equipment.*"
 * ```
 */
export const IIoTEquipmentSubject = createSubjectSpec({
  domain: 'iiot',
  entityType: 'equipment',
  pattern: 'iiot.equipment.{equipmentId}',
  schemaId: 'EquipmentStateChange',
  description: 'Equipment state transitions — running, idle, faulted',
  streamMapping: { _tag: 'domain' },
})

/**
 * Work order lifecycle events.
 * Pattern: iiot.work_orders.{workOrderId}
 *
 * @example
 * ```typescript
 * IIoTWorkOrdersSubject.resolve({ workOrderId: 'WO-2026-00042' })
 * // => "iiot.work_orders.WO-2026-00042"
 *
 * IIoTWorkOrdersSubject.wildcardPattern()
 * // => "iiot.work_orders.*"
 * ```
 */
export const IIoTWorkOrdersSubject = createSubjectSpec({
  domain: 'iiot',
  entityType: 'work_orders',
  pattern: 'iiot.work_orders.{workOrderId}',
  schemaId: 'WorkOrderLifecycleEvent',
  description: 'Work order lifecycle events — create, approve, start, suspend, complete',
  streamMapping: { _tag: 'domain' },
})

/**
 * Cache invalidation signals.
 * Pattern: iiot.invalidations.{cacheKey}
 *
 * @example
 * ```typescript
 * IIoTInvalidationsSubject.resolve({ cacheKey: 'site:plant-1:sensors' })
 * // => "iiot.invalidations.site:plant-1:sensors"
 *
 * IIoTInvalidationsSubject.wildcardPattern()
 * // => "iiot.invalidations.*"
 * ```
 */
export const IIoTInvalidationsSubject = createSubjectSpec({
  domain: 'iiot',
  entityType: 'invalidations',
  pattern: 'iiot.invalidations.{cacheKey}',
  schemaId: 'CacheInvalidation',
  description: 'Cache invalidation signals — cross-node coherence',
  streamMapping: { _tag: 'domain' },
})

// =============================================================================
// Convenience Aggregates
// =============================================================================

/**
 * All IIoT subject specs as a record, keyed by channel name.
 */
export const IIoTSubjects = {
  readings: IIoTReadingsSubject,
  alarms: IIoTAlarmsSubject,
  equipment: IIoTEquipmentSubject,
  workOrders: IIoTWorkOrdersSubject,
  invalidations: IIoTInvalidationsSubject,
} as const

/**
 * All IIoT subject specs as an array.
 */
export const IIoTSubjectList = [
  IIoTReadingsSubject,
  IIoTAlarmsSubject,
  IIoTEquipmentSubject,
  IIoTWorkOrdersSubject,
  IIoTInvalidationsSubject,
] as const
