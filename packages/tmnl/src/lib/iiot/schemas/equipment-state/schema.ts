/**
 * Equipment State Schema
 *
 * ISA-95 / OEE standard equipment states for tracking machine availability,
 * performance, and quality metrics. These states are fundamental to OEE
 * (Overall Equipment Effectiveness) calculations.
 *
 * State Categories for OEE:
 * - Availability: running vs downtime (planned/unplanned)
 * - Performance: running at full speed vs idle/blocked
 * - Quality: tracked separately via production/quality schemas
 *
 * @module @gbg/tmnl/iiot/schemas/equipment-state
 * @see ISA-95/IEC 62264 for equipment state definitions
 * @see OEE calculations: Availability x Performance x Quality
 */

import { Option, Schema } from 'effect'
import { MachineId } from '../assets/machine/schema'
import { AssetMetadata } from '../assets/common/types'

// =============================================================================
// EquipmentStateId with Embedded Slug
// =============================================================================

/**
 * Equipment state identifier with embedded slug pattern.
 * Format: 'EST-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const id = makeEquipmentStateId('mch001-20260130-001') // 'EST-mch001-20260130-001'
 * ```
 */
export const EquipmentStateId = Schema.String.pipe(
  Schema.pattern(/^EST-[a-zA-Z0-9-]+$/),
  Schema.brand('EquipmentStateId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/EquipmentStateId',
    description: 'Equipment state identifier with EST- prefix and alphanumeric slug',
  })
)
export type EquipmentStateId = typeof EquipmentStateId.Type

/**
 * Factory function to create an EquipmentStateId from a slug.
 *
 * @param slug - Alphanumeric identifier (hyphens allowed)
 * @returns Branded EquipmentStateId
 *
 * @example
 * ```ts
 * const id = makeEquipmentStateId('mch001-20260130-001') // 'EST-mch001-20260130-001'
 * ```
 */
export const makeEquipmentStateId = (slug: string): EquipmentStateId =>
  `EST-${slug}` as EquipmentStateId

// =============================================================================
// StateType Literal (ISA-95 / OEE Standard States)
// =============================================================================

/**
 * ISA-95 / OEE Standard Equipment States
 *
 * These 6 states cover all possible equipment conditions for OEE tracking:
 *
 * | State | OEE Impact | Description |
 * |-------|------------|-------------|
 * | running | Productive | Equipment producing good parts |
 * | idle | Performance Loss | Available but not producing |
 * | planned_downtime | Availability Loss | Scheduled stops (maintenance, breaks) |
 * | unplanned_downtime | Availability Loss | Unscheduled stops (breakdowns) |
 * | setup | Performance Loss | Changeover, tooling changes |
 * | blocked | Performance Loss | Starved (no input) or blocked (output full) |
 *
 * @see ISA-95 Part 3 - Activity Models
 */
export const StateType = Schema.Literal(
  'running',           // Producing good parts
  'idle',              // Available but not running
  'planned_downtime',  // Scheduled maintenance, breaks
  'unplanned_downtime',// Breakdowns, failures
  'setup',             // Changeover, setup time
  'blocked'            // Starved (no material) or blocked (downstream full)
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/StateType',
    description: 'ISA-95/OEE standard equipment state type',
  })
)
export type StateType = typeof StateType.Type

// =============================================================================
// StateReason Literal (Reasons for State)
// =============================================================================

/**
 * Detailed reasons for equipment state.
 * Provides granular categorization for root cause analysis.
 */
export const StateReason = Schema.Literal(
  // Running reasons
  'production',        // Normal production
  'test_run',          // Test/trial run
  'warmup',            // Equipment warmup cycle

  // Idle reasons
  'no_operator',       // No operator available
  'no_order',          // No production order
  'awaiting_material', // Waiting for material delivery

  // Planned downtime reasons
  'scheduled_maintenance', // Planned maintenance window
  'break',                 // Operator break
  'shift_change',          // Shift changeover
  'cleaning',              // Scheduled cleaning

  // Unplanned downtime reasons
  'breakdown',         // Equipment failure
  'quality_issue',     // Quality-related stoppage
  'tool_failure',      // Tooling failure
  'electrical',        // Electrical fault
  'mechanical',        // Mechanical fault

  // Setup reasons
  'changeover',        // Product changeover
  'tooling_change',    // Tool change
  'material_change',   // Material type change

  // Blocked reasons
  'starved',           // No input material
  'blocked_downstream',// Downstream equipment full
  'waiting_approval',  // Waiting for quality/supervisor approval

  // Other
  'other',             // Other specified reason (see notes)
  'unknown'            // Reason not yet determined
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/StateReason',
    description: 'Detailed reason for equipment state',
  })
)
export type StateReason = typeof StateReason.Type

// =============================================================================
// State Transition Validation
// =============================================================================

/** Raw state type string (unbranded for internal use) */
type StateTypeRaw =
  | 'running'
  | 'idle'
  | 'planned_downtime'
  | 'unplanned_downtime'
  | 'setup'
  | 'blocked'

/**
 * Valid state transitions.
 * Key: current state, Value: array of valid next states
 *
 * Generally permissive - most transitions are valid because:
 * - A breakdown can happen from any state
 * - Operator can start/stop for various reasons
 * - External factors (starving/blocking) can occur anytime
 */
const VALID_TRANSITIONS: Record<StateTypeRaw, readonly StateTypeRaw[]> = {
  running: ['idle', 'planned_downtime', 'unplanned_downtime', 'setup', 'blocked'],
  idle: ['running', 'planned_downtime', 'unplanned_downtime', 'setup', 'blocked'],
  planned_downtime: ['idle', 'running', 'unplanned_downtime', 'setup'],
  unplanned_downtime: ['idle', 'running', 'planned_downtime', 'setup'],
  setup: ['running', 'idle', 'unplanned_downtime', 'blocked'],
  blocked: ['running', 'idle', 'unplanned_downtime', 'setup'],
}

/**
 * Check if a state transition is valid.
 *
 * @param from - Current state
 * @param to - Desired next state
 * @returns true if transition is allowed
 */
export const isValidStateTransition = (from: StateType, to: StateType): boolean => {
  if (from === to) return false // No-op transitions not allowed
  const fromRaw = from as unknown as StateTypeRaw
  const toRaw = to as unknown as StateTypeRaw
  return VALID_TRANSITIONS[fromRaw]?.includes(toRaw) ?? false
}

/**
 * Get valid reasons for a given state type.
 * Helps with UI dropdowns and validation.
 */
export const getValidReasonsForState = (
  state: StateType
): readonly StateReason[] => {
  const reasonMap: Record<StateTypeRaw, readonly StateReason[]> = {
    running: ['production', 'test_run', 'warmup'],
    idle: ['no_operator', 'no_order', 'awaiting_material', 'other', 'unknown'],
    planned_downtime: ['scheduled_maintenance', 'break', 'shift_change', 'cleaning', 'other'],
    unplanned_downtime: ['breakdown', 'quality_issue', 'tool_failure', 'electrical', 'mechanical', 'other', 'unknown'],
    setup: ['changeover', 'tooling_change', 'material_change', 'other'],
    blocked: ['starved', 'blocked_downstream', 'waiting_approval', 'other'],
  }
  return reasonMap[state as StateTypeRaw] ?? ['other', 'unknown']
}

// =============================================================================
// EquipmentState Entity
// =============================================================================

/**
 * Equipment State Entity
 *
 * Represents a single state period for a machine. Each state has a start time
 * and optionally an end time. When the machine changes state, the current
 * state is ended and a new state is started.
 *
 * OEE Classification Methods:
 * - isProductive(): Availability numerator (running time)
 * - isAvailabilityLoss(): Downtime (planned + unplanned)
 * - isPerformanceLoss(): Speed losses (idle, blocked, setup)
 *
 * @example
 * ```ts
 * import { DateTime, Option } from 'effect'
 *
 * const state = new EquipmentState({
 *   id: makeEquipmentStateId('mch001-20260130-001'),
 *   machineId: 'MCH-cnc-lathe-001' as MachineId,
 *   state: 'running',
 *   reason: Option.some('production' as StateReason),
 *   startedAt: DateTime.unsafeNow(),
 *   endedAt: Option.none(),
 *   operatorId: Option.some('OP-001'),
 *   notes: Option.none(),
 *   metadata: {},
 * })
 * ```
 */
export class EquipmentState extends Schema.TaggedClass<EquipmentState>()('EquipmentState', {
  /** Unique state identifier */
  id: EquipmentStateId,

  /** Machine this state belongs to */
  machineId: MachineId,

  /** Current state type */
  state: StateType,

  /** Detailed reason for state (optional) */
  reason: Schema.optionalWith(StateReason, { as: 'Option' }),

  /** When this state period started */
  startedAt: Schema.DateTimeUtc,

  /** When this state period ended (None if current state) */
  endedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Operator who initiated or recorded this state */
  operatorId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Free-form notes about this state */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Extensible metadata */
  metadata: Schema.optionalWith(AssetMetadata, { default: () => ({}) }),
}) {
  /**
   * Get duration in milliseconds.
   * Returns null if state is still active (no endedAt).
   */
  getDurationMs(): number | null {
    if (this.endedAt._tag === 'None') {
      return null
    }
    const startMs = Number(this.startedAt.epochMillis)
    const endMs = Number(this.endedAt.value.epochMillis)
    return endMs - startMs
  }

  /**
   * Get duration in seconds.
   * Returns null if state is still active.
   */
  getDurationSeconds(): number | null {
    const ms = this.getDurationMs()
    return ms === null ? null : ms / 1000
  }

  /**
   * Get duration in minutes.
   * Returns null if state is still active.
   */
  getDurationMinutes(): number | null {
    const ms = this.getDurationMs()
    return ms === null ? null : ms / 60000
  }

  /**
   * Check if this state is still active (no end time).
   */
  isActive(): boolean {
    return this.endedAt._tag === 'None'
  }

  /**
   * Check if state is productive (contributes to OEE availability numerator).
   * Only 'running' state counts as productive time.
   */
  isProductive(): boolean {
    return this.state === 'running'
  }

  /**
   * Check if state is an availability loss (downtime).
   * Both planned and unplanned downtime reduce availability.
   */
  isAvailabilityLoss(): boolean {
    return this.state === 'unplanned_downtime' || this.state === 'planned_downtime'
  }

  /**
   * Check if state is a performance loss.
   * Idle, blocked, and setup states reduce performance rate.
   */
  isPerformanceLoss(): boolean {
    return this.state === 'idle' || this.state === 'blocked' || this.state === 'setup'
  }

  /**
   * Check if state is unplanned (affects unplanned downtime metrics).
   */
  isUnplanned(): boolean {
    return this.state === 'unplanned_downtime'
  }

  /**
   * Check if state is planned (scheduled downtime).
   */
  isPlanned(): boolean {
    return this.state === 'planned_downtime'
  }

  /**
   * Check if transition to another state is valid.
   */
  canTransitionTo(nextState: StateType): boolean {
    return isValidStateTransition(this.state, nextState)
  }

  /**
   * Get OEE category for this state.
   */
  getOeeCategory(): 'productive' | 'availability_loss' | 'performance_loss' {
    if (this.isProductive()) return 'productive'
    if (this.isAvailabilityLoss()) return 'availability_loss'
    return 'performance_loss'
  }
}
export type EquipmentStateType = typeof EquipmentState.Type

// =============================================================================
// EquipmentState Summary (Lightweight Projection)
// =============================================================================

/**
 * Lightweight equipment state projection for lists and dashboards.
 */
export class EquipmentStateSummary extends Schema.TaggedClass<EquipmentStateSummary>()(
  'EquipmentStateSummary',
  {
    id: EquipmentStateId,
    machineId: MachineId,
    state: StateType,
    reason: Schema.optionalWith(StateReason, { as: 'Option' }),
    startedAt: Schema.DateTimeUtc,
    isActive: Schema.Boolean,
  }
) {}
export type EquipmentStateSummaryType = typeof EquipmentStateSummary.Type

// =============================================================================
// Command Parameters
// =============================================================================

/**
 * Parameters for starting a new equipment state.
 */
export const StartStateParams = Schema.Struct({
  /** Machine entering the state */
  machineId: MachineId,

  /** State type to enter */
  state: StateType,

  /** Optional reason for the state */
  reason: Schema.optionalWith(StateReason, { as: 'Option' }),

  /** Operator initiating the state change */
  operatorId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Optional notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Optional metadata */
  metadata: Schema.optionalWith(AssetMetadata, { default: () => ({}) }),
})
export type StartStateParams = typeof StartStateParams.Type

/**
 * Parameters for ending the current state.
 */
export const EndStateParams = Schema.Struct({
  /** ID of the state to end */
  id: EquipmentStateId,

  /** Optional notes about why state ended */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type EndStateParams = typeof EndStateParams.Type

/**
 * Parameters for updating the reason of a state.
 */
export const UpdateReasonParams = Schema.Struct({
  /** ID of the state to update */
  id: EquipmentStateId,

  /** New reason for the state */
  reason: StateReason,

  /** Optional notes about the reason change */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type UpdateReasonParams = typeof UpdateReasonParams.Type

/**
 * Parameters for transitioning to a new state.
 * Ends current state and starts new state atomically.
 */
export const TransitionStateParams = Schema.Struct({
  /** Machine transitioning state */
  machineId: MachineId,

  /** ID of current state to end (optional - will find active state if not provided) */
  currentStateId: Schema.optionalWith(EquipmentStateId, { as: 'Option' }),

  /** New state to enter */
  newState: StateType,

  /** Reason for new state */
  reason: Schema.optionalWith(StateReason, { as: 'Option' }),

  /** Operator initiating transition */
  operatorId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Notes about the transition */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type TransitionStateParams = typeof TransitionStateParams.Type

// =============================================================================
// Query Parameters
// =============================================================================

/**
 * Parameters for querying equipment states.
 */
export const EquipmentStateQueryParams = Schema.Struct({
  /** Filter by machine */
  machineId: Schema.optionalWith(MachineId, { as: 'Option' }),

  /** Filter by state type */
  state: Schema.optionalWith(StateType, { as: 'Option' }),

  /** Filter by reason */
  reason: Schema.optionalWith(StateReason, { as: 'Option' }),

  /** Only return active (current) states */
  onlyActive: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Filter states that started after this time */
  since: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Filter states that started before this time */
  until: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Pagination limit */
  limit: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 100 }
  ),

  /** Pagination offset */
  offset: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    { default: () => 0 }
  ),
})
export type EquipmentStateQueryParams = typeof EquipmentStateQueryParams.Type

// =============================================================================
// State Duration Aggregation
// =============================================================================

/**
 * Aggregated state durations for a machine over a time period.
 * Used for OEE calculations and downtime reports.
 */
export class StateDurationAggregate extends Schema.TaggedClass<StateDurationAggregate>()(
  'StateDurationAggregate',
  {
    /** Machine these durations are for */
    machineId: MachineId,

    /** Start of aggregation period */
    periodStart: Schema.DateTimeUtc,

    /** End of aggregation period */
    periodEnd: Schema.DateTimeUtc,

    /** Total milliseconds in 'running' state */
    runningMs: Schema.Number.pipe(Schema.nonNegative()),

    /** Total milliseconds in 'idle' state */
    idleMs: Schema.Number.pipe(Schema.nonNegative()),

    /** Total milliseconds in 'planned_downtime' state */
    plannedDowntimeMs: Schema.Number.pipe(Schema.nonNegative()),

    /** Total milliseconds in 'unplanned_downtime' state */
    unplannedDowntimeMs: Schema.Number.pipe(Schema.nonNegative()),

    /** Total milliseconds in 'setup' state */
    setupMs: Schema.Number.pipe(Schema.nonNegative()),

    /** Total milliseconds in 'blocked' state */
    blockedMs: Schema.Number.pipe(Schema.nonNegative()),

    /** Number of state transitions in period */
    transitionCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }
) {
  /**
   * Calculate availability percentage.
   * Availability = Running Time / (Running Time + Downtime)
   */
  getAvailability(): number {
    const scheduled = this.runningMs + this.unplannedDowntimeMs
    if (scheduled === 0) return 0
    return this.runningMs / scheduled
  }

  /**
   * Get total downtime (planned + unplanned).
   */
  getTotalDowntimeMs(): number {
    return this.plannedDowntimeMs + this.unplannedDowntimeMs
  }

  /**
   * Get total performance loss time (idle + blocked + setup).
   */
  getTotalPerformanceLossMs(): number {
    return this.idleMs + this.blockedMs + this.setupMs
  }

  /**
   * Get total tracked time.
   */
  getTotalMs(): number {
    return (
      this.runningMs +
      this.idleMs +
      this.plannedDowntimeMs +
      this.unplannedDowntimeMs +
      this.setupMs +
      this.blockedMs
    )
  }
}
export type StateDurationAggregateType = typeof StateDurationAggregate.Type
