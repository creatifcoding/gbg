/**
 * Equipment State Events — ISA-95/OEE Compliant State Transitions
 *
 * Defines 6 operational events for equipment state lifecycle management:
 * - EquipmentStateChanged: State machine transition (operational/degraded/faulted/maintenance/offline)
 * - MaintenanceModeEntered: Equipment enters maintenance state
 * - MaintenanceModeExited: Equipment exits maintenance state
 * - PerformanceDegraded: Equipment operating below optimal
 * - FaultDetected: Equipment fault occurred
 * - FaultCleared: Fault condition resolved
 *
 * These events support OEE (Overall Equipment Effectiveness) calculations:
 * - Availability = Uptime / Planned Production Time
 * - Performance = Actual Output / Theoretical Output
 * - Quality = Good Units / Total Units
 *
 * State Machine:
 * ```
 * operational ─┬─► degraded ─┬─► faulted ─┬─► offline
 *              │             │            │
 *              │             └──► maintenance
 *              │                    │
 *              └────────────────────┘
 * ```
 *
 * These events are stored in EventLog (not TimescaleDB) for full audit trail.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/equipment-state-events
 * @see ISA-95/IEC 62264 for equipment state standards
 * @see OEE standard for effectiveness calculations
 */

import { Schema } from 'effect'
import { MachineId, PropagationId } from '../../identifiers'
import { BaseOperationalEvent } from '../base'

// =============================================================================
// Enums — Equipment State Types
// =============================================================================

/**
 * Equipment State Enum
 *
 * ISA-95 compliant equipment states for OEE tracking.
 *
 * | State | Description | OEE Impact |
 * |-------|-------------|------------|
 * | operational | Running and producing | Productive time |
 * | degraded | Running but below optimal | Performance loss |
 * | faulted | Not running due to fault | Availability loss (unplanned) |
 * | maintenance | Scheduled/unscheduled maintenance | Availability loss (planned) |
 * | offline | Completely offline | Availability loss |
 */
export const EquipmentState = Schema.Literal(
  'operational',
  'degraded',
  'faulted',
  'maintenance',
  'offline'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/EquipmentState',
    description: 'ISA-95 compliant equipment state for OEE tracking',
  })
)
export type EquipmentState = typeof EquipmentState.Type

/**
 * Maintenance Type Enum
 *
 * Categorizes maintenance activities for OEE analysis.
 *
 * | Type | Description | OEE Classification |
 * |------|-------------|-------------------|
 * | scheduled | Planned preventive maintenance | Planned downtime |
 * | unscheduled | Unplanned but non-emergency | Unplanned downtime |
 * | emergency | Urgent repair required | Unplanned downtime |
 */
export const MaintenanceType = Schema.Literal(
  'scheduled',
  'unscheduled',
  'emergency'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/MaintenanceType',
    description: 'Type of maintenance activity',
  })
)
export type MaintenanceType = typeof MaintenanceType.Type

/**
 * Fault Severity Enum
 *
 * Severity levels for equipment faults.
 *
 * | Severity | Description | Action Required |
 * |----------|-------------|-----------------|
 * | minor | Degraded but operational | Monitor, schedule maintenance |
 * | major | Significantly impacted | Prioritize repair |
 * | critical | Cannot operate safely | Immediate shutdown required |
 */
export const FaultSeverity = Schema.Literal(
  'minor',
  'major',
  'critical'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/FaultSeverity',
    description: 'Severity level of equipment fault',
  })
)
export type FaultSeverity = typeof FaultSeverity.Type

/**
 * Maintenance Outcome Enum
 *
 * Outcomes when exiting maintenance mode.
 */
export const MaintenanceOutcome = Schema.Literal(
  'completed',
  'aborted',
  'deferred'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/MaintenanceOutcome',
    description: 'Outcome of maintenance activity',
  })
)
export type MaintenanceOutcome = typeof MaintenanceOutcome.Type

/**
 * Fault Clear Method Enum
 *
 * How a fault was resolved.
 */
export const FaultClearMethod = Schema.Literal(
  'manual',
  'auto',
  'override'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/FaultClearMethod',
    description: 'Method by which fault was cleared',
  })
)
export type FaultClearMethod = typeof FaultClearMethod.Type

// =============================================================================
// EquipmentStateChanged — State Machine Transition
// =============================================================================

/**
 * EquipmentStateChanged event.
 *
 * Emitted when equipment transitions between states in the state machine:
 * ```
 * operational ─┬─► degraded ─┬─► faulted ─┬─► offline
 *              │             │            │
 *              │             └──► maintenance
 *              │                    │
 *              └────────────────────┘
 * ```
 *
 * @example
 * ```typescript
 * const event = new EquipmentStateChanged({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'sensor-monitor',
 *   entityId: machineId as AssetId,
 *   entityType: 'machine',
 *   machineId,
 *   previousState: 'operational',
 *   newState: 'degraded',
 *   reason: Option.some('Temperature threshold exceeded'),
 *   triggeredBy: Option.some('auto-detection'),
 * })
 * ```
 */
export class EquipmentStateChanged extends BaseOperationalEvent.extend<EquipmentStateChanged>(
  'EquipmentStateChanged'
)({
  /** Machine undergoing state change */
  machineId: MachineId,

  /** State before the transition */
  previousState: EquipmentState,

  /** State after the transition */
  newState: EquipmentState,

  /** Domain propagation id minted by the source transition. Optional for legacy journal entries. */
  propagationId: Schema.optional(PropagationId),

  /** Reason for the state change */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** What triggered the transition (operator, sensor, system) */
  triggeredBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type EquipmentStateChangedType = typeof EquipmentStateChanged.Type

// =============================================================================
// MaintenanceModeEntered — Equipment Enters Maintenance
// =============================================================================

/**
 * MaintenanceModeEntered event.
 *
 * Emitted when equipment enters maintenance mode.
 * State transition: any → maintenance
 *
 * This event affects OEE Availability calculation:
 * - Scheduled: Counted as planned downtime
 * - Unscheduled/Emergency: Counted as unplanned downtime
 *
 * @example
 * ```typescript
 * const event = new MaintenanceModeEntered({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'maintenance-system',
 *   entityId: machineId as AssetId,
 *   entityType: 'machine',
 *   machineId,
 *   maintenanceType: 'scheduled',
 *   scheduledDuration: Option.some(3600),
 *   workOrderId: Option.some('WO-2026-00001'),
 *   technician: Option.some('TECH-001'),
 *   notes: Option.some('Quarterly preventive maintenance'),
 * })
 * ```
 */
export class MaintenanceModeEntered extends BaseOperationalEvent.extend<MaintenanceModeEntered>(
  'MaintenanceModeEntered'
)({
  /** Machine entering maintenance */
  machineId: MachineId,

  /** Type of maintenance being performed */
  maintenanceType: MaintenanceType,

  /** Planned duration in seconds (if known) */
  scheduledDuration: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Associated work order ID */
  workOrderId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Technician performing maintenance */
  technician: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Additional notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type MaintenanceModeEnteredType = typeof MaintenanceModeEntered.Type

// =============================================================================
// MaintenanceModeExited — Equipment Exits Maintenance
// =============================================================================

/**
 * MaintenanceModeExited event.
 *
 * Emitted when equipment exits maintenance mode.
 * State transition: maintenance → operational|degraded
 *
 * Captures actual downtime for OEE Availability calculation.
 *
 * @example
 * ```typescript
 * const event = new MaintenanceModeExited({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'technician-001',
 *   entityId: machineId as AssetId,
 *   entityType: 'machine',
 *   machineId,
 *   actualDuration: 3200,
 *   outcome: 'completed',
 *   workOrderId: Option.some('WO-2026-00001'),
 *   technician: Option.some('TECH-001'),
 *   nextMaintenanceDate: Option.some(nextDate),
 *   notes: Option.some('Maintenance completed successfully'),
 * })
 * ```
 */
export class MaintenanceModeExited extends BaseOperationalEvent.extend<MaintenanceModeExited>(
  'MaintenanceModeExited'
)({
  /** Machine exiting maintenance */
  machineId: MachineId,

  /** Actual duration of maintenance in seconds */
  actualDuration: Schema.Number.pipe(Schema.nonNegative()),

  /** Outcome of the maintenance activity */
  outcome: MaintenanceOutcome,

  /** Associated work order ID */
  workOrderId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Technician who performed maintenance */
  technician: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Next scheduled maintenance date */
  nextMaintenanceDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Additional notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type MaintenanceModeExitedType = typeof MaintenanceModeExited.Type

// =============================================================================
// PerformanceDegraded — Below Optimal Performance
// =============================================================================

/**
 * PerformanceDegraded event.
 *
 * Emitted when equipment is operating below optimal performance levels.
 * This affects OEE Performance calculation.
 *
 * State: Equipment remains operational but in degraded state.
 *
 * @example
 * ```typescript
 * const event = new PerformanceDegraded({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'performance-monitor',
 *   entityId: machineId as AssetId,
 *   entityType: 'machine',
 *   machineId,
 *   performancePercent: 75.5,
 *   expectedPerformance: 100.0,
 *   degradationReason: Option.some('Worn tooling'),
 *   affectedMetrics: ['cycle_time', 'throughput'],
 *   oeeImpact: Option.some(0.245),
 * })
 * ```
 */
export class PerformanceDegraded extends BaseOperationalEvent.extend<PerformanceDegraded>(
  'PerformanceDegraded'
)({
  /** Machine experiencing performance degradation */
  machineId: MachineId,

  /** Current performance as percentage (0-100) */
  performancePercent: Schema.Number.pipe(Schema.between(0, 100)),

  /** Expected/target performance percentage */
  expectedPerformance: Schema.Number.pipe(Schema.between(0, 100)),

  /** Reason for degradation (if known) */
  degradationReason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Which metrics are affected (cycle_time, throughput, quality, etc.) */
  affectedMetrics: Schema.Array(Schema.String),

  /** Estimated impact on OEE (0.0 to 1.0) */
  oeeImpact: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 1)), { as: 'Option' }),
}) {}

export type PerformanceDegradedType = typeof PerformanceDegraded.Type

// =============================================================================
// FaultDetected — Equipment Fault Occurred
// =============================================================================

/**
 * FaultDetected event.
 *
 * Emitted when an equipment fault is detected.
 * State transition: any → faulted
 *
 * This affects OEE Availability as unplanned downtime.
 *
 * @example
 * ```typescript
 * const event = new FaultDetected({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'fault-monitor',
 *   entityId: machineId as AssetId,
 *   entityType: 'machine',
 *   machineId,
 *   faultCode: 'E-OVERTEMP-001',
 *   faultSeverity: 'critical',
 *   faultDescription: 'Motor temperature exceeded safe operating limit',
 *   affectedComponent: Option.some('spindle-motor'),
 *   sensorReadings: Option.some({ temperature: 150.5, threshold: 120.0 }),
 *   recommendedAction: Option.some('Immediate shutdown and inspection required'),
 * })
 * ```
 */
export class FaultDetected extends BaseOperationalEvent.extend<FaultDetected>(
  'FaultDetected'
)({
  /** Machine experiencing fault */
  machineId: MachineId,

  /** Unique fault code for classification */
  faultCode: Schema.NonEmptyString,

  /** Severity of the fault */
  faultSeverity: FaultSeverity,

  /** Human-readable description of the fault */
  faultDescription: Schema.String,

  /** Component affected by the fault */
  affectedComponent: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Sensor readings at time of fault */
  sensorReadings: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Number }),
    { as: 'Option' }
  ),

  /** Recommended action to resolve */
  recommendedAction: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type FaultDetectedType = typeof FaultDetected.Type

// =============================================================================
// FaultCleared — Fault Resolved
// =============================================================================

/**
 * FaultCleared event.
 *
 * Emitted when an equipment fault is resolved.
 * State transition: faulted → operational|degraded
 *
 * Captures downtime for OEE Availability calculation.
 *
 * @example
 * ```typescript
 * const event = new FaultCleared({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'technician-001',
 *   entityId: machineId as AssetId,
 *   entityType: 'machine',
 *   machineId,
 *   faultCode: 'E-OVERTEMP-001',
 *   clearMethod: 'manual',
 *   verifiedBy: Option.some('TECH-001'),
 *   resolutionNotes: Option.some('Replaced thermal paste'),
 *   downtime: Option.some(7200),
 * })
 * ```
 */
export class FaultCleared extends BaseOperationalEvent.extend<FaultCleared>(
  'FaultCleared'
)({
  /** Machine with cleared fault */
  machineId: MachineId,

  /** Fault code that was cleared */
  faultCode: Schema.NonEmptyString,

  /** How the fault was cleared */
  clearMethod: FaultClearMethod,

  /** Person who verified the fault was cleared */
  verifiedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Notes on how fault was resolved */
  resolutionNotes: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Total downtime in seconds (for OEE calculation) */
  downtime: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
}) {}

export type FaultClearedType = typeof FaultCleared.Type

// =============================================================================
// Union Type for All Equipment State Events
// =============================================================================

/**
 * Union of all equipment state events for type guards and handlers.
 */
export type EquipmentStateEvent =
  | EquipmentStateChanged
  | MaintenanceModeEntered
  | MaintenanceModeExited
  | PerformanceDegraded
  | FaultDetected
  | FaultCleared

/**
 * Equipment state event tags for type narrowing.
 */
export const EQUIPMENT_STATE_EVENT_TAGS = [
  'EquipmentStateChanged',
  'MaintenanceModeEntered',
  'MaintenanceModeExited',
  'PerformanceDegraded',
  'FaultDetected',
  'FaultCleared',
] as const

export type EquipmentStateEventTag = (typeof EQUIPMENT_STATE_EVENT_TAGS)[number]
