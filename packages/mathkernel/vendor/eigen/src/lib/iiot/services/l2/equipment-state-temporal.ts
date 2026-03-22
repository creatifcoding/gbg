/**
 * Equipment State Temporal Queries - Event-Sourced State Reconstruction
 *
 * Provides temporal query capabilities for equipment state:
 * - getEquipmentStateAtTime: Reconstruct equipment state at any point in time
 * - getEquipmentStateHistory: Get full history of state transitions
 * - getDowntimeReport: Calculate downtime periods within a time range
 *
 * Uses EventLog/EventJournal to replay events and fold them into state.
 * This enables ISA-95 compliant audit trails, OEE calculations, and time-travel queries.
 *
 * State Machine (OEE States):
 * ```
 * operational -----> degraded -----> faulted -----> offline
 *      |                |               |
 *      |                +--------> maintenance
 *      |                               |
 *      +-------------------------------+
 * ```
 *
 * @module @gbg/tmnl/iiot/services/l2/equipment-state-temporal
 * @see ISA-95/IEC 62264 for equipment state standards
 * @see OEE calculations: Availability x Performance x Quality
 */

import { Effect, DateTime, Option, Schema } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import type { MachineId } from '../../schemas/assets/machine/schema'
import {
  EquipmentState,
  type StateType,
  type StateReason,
  EquipmentStateId,
  makeEquipmentStateId,
} from '../../schemas/equipment-state/schema'
import { EquipmentStateEvents } from '../../schemas/events/groups'
import {
  EquipmentState as EventEquipmentState,
  type MaintenanceType,
  type FaultSeverity,
} from '../../schemas/events/operational/equipment-state-events'

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error for equipment state temporal query failures.
 */
export class EquipmentStateTemporalError extends Schema.TaggedError<EquipmentStateTemporalError>()(
  'EquipmentStateTemporalError',
  {
    equipmentId: Schema.String,
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// OEE State Types
// =============================================================================

/**
 * OEE-oriented equipment state for temporal reconstruction.
 *
 * Maps event-level states to OEE calculation categories:
 * - running: Productive time (availability numerator)
 * - idle: Performance loss
 * - maintenance: Planned downtime (availability loss)
 * - faulted: Unplanned downtime (availability loss)
 * - degraded: Performance loss (running but below optimal)
 * - offline: Not scheduled (excluded from OEE)
 */
export const OeeState = Schema.Literal(
  'running',      // operational - producing
  'idle',         // operational but not producing
  'maintenance',  // planned/scheduled downtime
  'faulted',      // unplanned downtime (fault detected)
  'degraded',     // running but below optimal
  'offline'       // completely offline / not scheduled
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/OeeState',
    description: 'OEE-oriented equipment state for availability/performance tracking',
  })
)
export type OeeState = typeof OeeState.Type

// =============================================================================
// Equipment State Event Tag Types
// =============================================================================

/**
 * All equipment state event tags that can trigger state transitions.
 */
const EQUIPMENT_STATE_EVENT_TAGS = [
  'EquipmentStateChanged',
  'MaintenanceModeEntered',
  'MaintenanceModeExited',
  'PerformanceDegraded',
  'FaultDetected',
  'FaultCleared',
] as const

type EquipmentStateEventTag = (typeof EQUIPMENT_STATE_EVENT_TAGS)[number]

/**
 * Check if an entry is an equipment state event.
 */
const isEquipmentStateEvent = (eventTag: string): eventTag is EquipmentStateEventTag =>
  EQUIPMENT_STATE_EVENT_TAGS.includes(eventTag as EquipmentStateEventTag)

// =============================================================================
// Event Payload Decoding
// =============================================================================

/**
 * Decode event payload from msgpack bytes using the appropriate schema.
 */
const decodeEquipmentStateEventPayload = (
  eventTag: EquipmentStateEventTag,
  payload: Uint8Array
): Effect.Effect<Record<string, unknown>, Error> => {
  const event = EquipmentStateEvents.events[eventTag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> } | undefined
  if (!event) {
    return Effect.fail(new Error(`Unknown equipment state event: ${eventTag}`))
  }

  return Schema.decode(event.payloadMsgPack as Schema.Schema<Record<string, unknown>, Uint8Array>)(payload).pipe(
    Effect.mapError((e) => new Error(`Failed to decode ${eventTag}: ${String(e)}`))
  )
}

// =============================================================================
// State Transition Logic
// =============================================================================

/**
 * Map event-level equipment state to OEE state.
 *
 * Event states (from EquipmentStateChanged):
 * - operational -> running
 * - degraded -> degraded
 * - faulted -> faulted
 * - maintenance -> maintenance
 * - offline -> offline
 */
const eventStateToOeeState = (eventState: EventEquipmentState): OeeState => {
  switch (eventState) {
    case 'operational':
      return 'running'
    case 'degraded':
      return 'degraded'
    case 'faulted':
      return 'faulted'
    case 'maintenance':
      return 'maintenance'
    case 'offline':
      return 'offline'
    default:
      return 'offline'
  }
}

/**
 * Determine the next OEE state based on an event.
 *
 * State machine transitions:
 * - EquipmentStateChanged -> maps newState to OEE state
 * - MaintenanceModeEntered -> maintenance
 * - MaintenanceModeExited -> running (or degraded based on outcome)
 * - PerformanceDegraded -> degraded
 * - FaultDetected -> faulted
 * - FaultCleared -> running (or previous operational state)
 */
const eventToOeeState = (
  eventTag: EquipmentStateEventTag,
  payload: Record<string, unknown>,
  previousState: OeeState
): OeeState | null => {
  switch (eventTag) {
    case 'EquipmentStateChanged':
      return eventStateToOeeState(payload.newState as EventEquipmentState)

    case 'MaintenanceModeEntered':
      return 'maintenance'

    case 'MaintenanceModeExited':
      // After maintenance, assume returning to running unless outcome indicates otherwise
      const outcome = payload.outcome as string
      if (outcome === 'aborted' || outcome === 'deferred') {
        // If maintenance was incomplete, may need further action
        return 'idle'
      }
      return 'running'

    case 'PerformanceDegraded':
      return 'degraded'

    case 'FaultDetected':
      return 'faulted'

    case 'FaultCleared':
      // After fault cleared, return to running
      return 'running'

    default:
      return null
  }
}

// =============================================================================
// Event Fold Logic
// =============================================================================

/**
 * Tagged event for folding.
 */
interface TaggedEquipmentStateEvent {
  readonly _tag: EquipmentStateEventTag
  readonly machineId: MachineId
  readonly occurredAt: DateTime.Utc
  readonly previousState?: EventEquipmentState
  readonly newState?: EventEquipmentState
  readonly reason?: Option.Option<string>
  readonly triggeredBy?: Option.Option<string>
  readonly maintenanceType?: MaintenanceType
  readonly scheduledDuration?: Option.Option<number>
  readonly workOrderId?: Option.Option<string>
  readonly technician?: Option.Option<string>
  readonly notes?: Option.Option<string>
  readonly actualDuration?: number
  readonly outcome?: string
  readonly performancePercent?: number
  readonly expectedPerformance?: number
  readonly degradationReason?: Option.Option<string>
  readonly affectedMetrics?: readonly string[]
  readonly oeeImpact?: Option.Option<number>
  readonly faultCode?: string
  readonly faultSeverity?: FaultSeverity
  readonly faultDescription?: string
  readonly affectedComponent?: Option.Option<string>
  readonly clearMethod?: string
  readonly verifiedBy?: Option.Option<string>
  readonly resolutionNotes?: Option.Option<string>
  readonly downtime?: Option.Option<number>
  readonly causedBy?: string
  [key: string]: unknown
}

/**
 * Reconstructed equipment state at a point in time.
 */
export class EquipmentStateAtTime extends Schema.TaggedClass<EquipmentStateAtTime>()(
  'EquipmentStateAtTime',
  {
    /** Machine ID */
    machineId: Schema.String.pipe(Schema.brand('MachineId')),

    /** Current OEE state */
    state: OeeState,

    /** When this state started */
    stateStartedAt: Schema.DateTimeUtc,

    /** Reason for current state (if available) */
    reason: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** The point in time this represents */
    asOf: Schema.DateTimeUtc,

    /** Was this reconstructed from events? */
    fromReplay: Schema.Boolean,

    /** Active fault code (if faulted) */
    activeFaultCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Active work order (if in maintenance) */
    activeWorkOrderId: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Performance percentage (if degraded) */
    performancePercent: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  }
) {}

/**
 * Equipment state transition record.
 * Used for audit trails and OEE analysis.
 */
export class EquipmentStateTransition extends Schema.TaggedClass<EquipmentStateTransition>()(
  'EquipmentStateTransition',
  {
    machineId: Schema.String.pipe(Schema.brand('MachineId')),
    fromState: OeeState,
    toState: OeeState,
    transitionedAt: Schema.DateTimeUtc,
    transitionedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
    reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
    eventTag: Schema.String,
  }
) {}

/**
 * Downtime period record.
 * Represents a continuous period of non-productive time.
 */
export class DowntimePeriod extends Schema.TaggedClass<DowntimePeriod>()(
  'DowntimePeriod',
  {
    machineId: Schema.String.pipe(Schema.brand('MachineId')),

    /** Type of downtime */
    downtimeType: Schema.Literal('planned', 'unplanned'),

    /** State during downtime (maintenance, faulted, etc.) */
    state: OeeState,

    /** When downtime started */
    startedAt: Schema.DateTimeUtc,

    /** When downtime ended (None if still ongoing) */
    endedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

    /** Duration in milliseconds (calculated at query time if ongoing) */
    durationMs: Schema.Number,

    /** Reason for downtime */
    reason: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Associated fault code (if unplanned) */
    faultCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Associated work order (if planned) */
    workOrderId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }
) {}

/**
 * Downtime report for a time range.
 */
export class DowntimeReport extends Schema.TaggedClass<DowntimeReport>()(
  'DowntimeReport',
  {
    machineId: Schema.String.pipe(Schema.brand('MachineId')),

    /** Start of reporting period */
    periodStart: Schema.DateTimeUtc,

    /** End of reporting period */
    periodEnd: Schema.DateTimeUtc,

    /** Total planned downtime in milliseconds */
    plannedDowntimeMs: Schema.Number,

    /** Total unplanned downtime in milliseconds */
    unplannedDowntimeMs: Schema.Number,

    /** Total uptime (running) in milliseconds */
    uptimeMs: Schema.Number,

    /** Availability percentage */
    availability: Schema.Number,

    /** Individual downtime periods */
    periods: Schema.Array(DowntimePeriod),
  }
) {}

/**
 * Accumulated state for folding events.
 */
interface FoldState {
  state: OeeState
  stateStartedAt: DateTime.Utc
  reason: string | undefined
  activeFaultCode: string | undefined
  activeWorkOrderId: string | undefined
  performancePercent: number | undefined
}

/**
 * Fold equipment state events into reconstructed state.
 *
 * Events must be sorted by occurredAt (ascending).
 *
 * @param events - Sorted array of tagged equipment state events
 * @param machineId - The machine ID to construct
 * @param asOf - Point in time to reconstruct state for
 * @returns Reconstructed EquipmentStateAtTime
 */
export const foldEquipmentStateEvents = (
  events: ReadonlyArray<TaggedEquipmentStateEvent>,
  machineId: MachineId,
  asOf: DateTime.Utc
): EquipmentStateAtTime => {
  if (events.length === 0) {
    // No events - assume offline/unknown
    return new EquipmentStateAtTime({
      machineId,
      state: 'offline',
      stateStartedAt: asOf,
      reason: Option.none(),
      asOf,
      fromReplay: true,
      activeFaultCode: Option.none(),
      activeWorkOrderId: Option.none(),
      performancePercent: Option.none(),
    })
  }

  // Initial state
  let foldState: FoldState = {
    state: 'offline',
    stateStartedAt: events[0].occurredAt,
    reason: undefined,
    activeFaultCode: undefined,
    activeWorkOrderId: undefined,
    performancePercent: undefined,
  }

  // Process each event to update state
  for (const event of events) {
    const newState = eventToOeeState(event._tag, event as Record<string, unknown>, foldState.state)

    if (newState !== null && newState !== foldState.state) {
      foldState = {
        state: newState,
        stateStartedAt: event.occurredAt,
        reason: Option.getOrUndefined(event.reason as Option.Option<string>) ??
                Option.getOrUndefined(event.degradationReason as Option.Option<string>) ??
                event.faultDescription,
        activeFaultCode: event._tag === 'FaultDetected' ? event.faultCode :
                        (event._tag === 'FaultCleared' ? undefined : foldState.activeFaultCode),
        activeWorkOrderId: event._tag === 'MaintenanceModeEntered'
          ? Option.getOrUndefined(event.workOrderId as Option.Option<string>)
          : (event._tag === 'MaintenanceModeExited' ? undefined : foldState.activeWorkOrderId),
        performancePercent: event._tag === 'PerformanceDegraded'
          ? event.performancePercent
          : (newState === 'running' ? undefined : foldState.performancePercent),
      }
    } else if (event._tag === 'PerformanceDegraded') {
      // Update performance even if state doesn't change
      foldState.performancePercent = event.performancePercent
    }
  }

  return new EquipmentStateAtTime({
    machineId,
    state: foldState.state,
    stateStartedAt: foldState.stateStartedAt,
    reason: foldState.reason ? Option.some(foldState.reason) : Option.none(),
    asOf,
    fromReplay: true,
    activeFaultCode: foldState.activeFaultCode ? Option.some(foldState.activeFaultCode) : Option.none(),
    activeWorkOrderId: foldState.activeWorkOrderId ? Option.some(foldState.activeWorkOrderId) : Option.none(),
    performancePercent: foldState.performancePercent !== undefined
      ? Option.some(foldState.performancePercent)
      : Option.none(),
  })
}

// =============================================================================
// Temporal Queries
// =============================================================================

/**
 * Get the equipment state at a specific point in time.
 *
 * Reads all events for the machine up to `asOf` timestamp,
 * then folds them to reconstruct the state.
 *
 * @param machineId - Machine to query
 * @param asOf - Point in time to reconstruct state for
 * @returns EquipmentStateAtTime with reconstructed state
 *
 * @example
 * ```typescript
 * const result = yield* getEquipmentStateAtTime(
 *   machineId,
 *   DateTime.unsafeFromDate(new Date('2024-01-15T10:30:00Z'))
 * )
 * console.log(result.state) // 'running' | 'maintenance' | 'faulted' | etc
 * ```
 */
export const getEquipmentStateAtTime = (
  machineId: MachineId,
  asOf: DateTime.Utc
): Effect.Effect<EquipmentStateAtTime, EquipmentStateTemporalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const allEntries = yield* journal.entries.pipe(
      Effect.mapError((e) => new EquipmentStateTemporalError({
        equipmentId: machineId,
        operation: 'getEquipmentStateAtTime',
        message: `Failed to read entries: ${String(e)}`,
      }))
    )

    // Filter entries by primaryKey first (fast path)
    const machineEntries = allEntries.filter((entry) =>
      isEquipmentStateEvent(entry.event) &&
      entry.primaryKey === machineId
    )

    if (machineEntries.length === 0) {
      // No events found - return offline state
      return new EquipmentStateAtTime({
        machineId,
        state: 'offline',
        stateStartedAt: asOf,
        reason: Option.some('No events found'),
        asOf,
        fromReplay: true,
        activeFaultCode: Option.none(),
        activeWorkOrderId: Option.none(),
        performancePercent: Option.none(),
      })
    }

    // Decode all payloads for this machine
    const allTaggedEvents: TaggedEquipmentStateEvent[] = []

    for (const entry of machineEntries) {
      const payload = yield* decodeEquipmentStateEventPayload(
        entry.event as EquipmentStateEventTag,
        entry.payload
      ).pipe(
        Effect.mapError((e) => new EquipmentStateTemporalError({
          equipmentId: machineId,
          operation: 'getEquipmentStateAtTime',
          message: `Failed to decode event ${entry.event}: ${String(e)}`,
        }))
      )

      allTaggedEvents.push({
        _tag: entry.event as EquipmentStateEventTag,
        ...payload,
      } as TaggedEquipmentStateEvent)
    }

    // Filter by occurredAt <= asOf (payload-level filtering for accurate temporal query)
    const asOfMillis = DateTime.toEpochMillis(asOf)
    const relevantEvents = allTaggedEvents.filter((event) =>
      DateTime.toEpochMillis(event.occurredAt) <= asOfMillis
    )

    // Sort by occurredAt
    relevantEvents.sort((a, b) =>
      DateTime.toEpochMillis(a.occurredAt) - DateTime.toEpochMillis(b.occurredAt)
    )

    // Fold events to state
    return foldEquipmentStateEvents(relevantEvents, machineId, asOf)
  })

/**
 * Get the full history of state transitions for a machine.
 *
 * Returns an array of EquipmentStateTransition records showing each
 * state change with timestamp and context.
 *
 * @param machineId - Machine to get history for
 * @returns Array of state transitions (empty if no events)
 *
 * @example
 * ```typescript
 * const history = yield* getEquipmentStateHistory(machineId)
 * // [
 * //   { fromState: 'offline', toState: 'running', transitionedAt: ... },
 * //   { fromState: 'running', toState: 'maintenance', transitionedAt: ... },
 * //   { fromState: 'maintenance', toState: 'running', transitionedAt: ... },
 * // ]
 * ```
 */
export const getEquipmentStateHistory = (
  machineId: MachineId
): Effect.Effect<EquipmentStateTransition[], EquipmentStateTemporalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const allEntries = yield* journal.entries.pipe(
      Effect.mapError((e) => new EquipmentStateTemporalError({
        equipmentId: machineId,
        operation: 'getEquipmentStateHistory',
        message: `Failed to read entries: ${String(e)}`,
      }))
    )

    // Filter entries for this machine
    const relevantEntries = allEntries.filter((entry) =>
      isEquipmentStateEvent(entry.event) &&
      entry.primaryKey === machineId
    )

    if (relevantEntries.length === 0) {
      return []
    }

    // Sort by createdAtMillis
    relevantEntries.sort((a, b) => a.createdAtMillis - b.createdAtMillis)

    // Decode payloads
    const taggedEvents: Array<{ entry: EventJournal.Entry; event: TaggedEquipmentStateEvent }> = []

    for (const entry of relevantEntries) {
      const payload = yield* decodeEquipmentStateEventPayload(
        entry.event as EquipmentStateEventTag,
        entry.payload
      ).pipe(
        Effect.mapError((e) => new EquipmentStateTemporalError({
          equipmentId: machineId,
          operation: 'getEquipmentStateHistory',
          message: `Failed to decode event ${entry.event}: ${String(e)}`,
        }))
      )

      taggedEvents.push({
        entry,
        event: {
          _tag: entry.event as EquipmentStateEventTag,
          ...payload,
        } as TaggedEquipmentStateEvent,
      })
    }

    // Build transitions
    const transitions: EquipmentStateTransition[] = []
    let previousState: OeeState = 'offline'

    for (const { event } of taggedEvents) {
      const newState = eventToOeeState(event._tag, event as Record<string, unknown>, previousState)

      if (newState !== null && newState !== previousState) {
        // Extract reason based on event type
        const reason = Option.getOrUndefined(event.reason as Option.Option<string>) ??
                       Option.getOrUndefined(event.degradationReason as Option.Option<string>) ??
                       event.faultDescription

        transitions.push(new EquipmentStateTransition({
          machineId,
          fromState: previousState,
          toState: newState,
          transitionedAt: event.occurredAt,
          transitionedBy: event.causedBy ? Option.some(event.causedBy) : Option.none(),
          reason: reason ? Option.some(reason) : Option.none(),
          eventTag: event._tag,
        }))

        previousState = newState
      }
    }

    return transitions
  })

/**
 * Get downtime report for a machine within a time range.
 *
 * Calculates planned and unplanned downtime, uptime, and availability.
 *
 * @param machineId - Machine to analyze
 * @param startTime - Start of analysis period
 * @param endTime - End of analysis period
 * @returns DowntimeReport with periods and metrics
 *
 * @example
 * ```typescript
 * const report = yield* getDowntimeReport(
 *   machineId,
 *   DateTime.unsafeFromDate(new Date('2024-01-01')),
 *   DateTime.unsafeFromDate(new Date('2024-01-31'))
 * )
 * console.log(`Availability: ${(report.availability * 100).toFixed(1)}%`)
 * ```
 */
export const getDowntimeReport = (
  machineId: MachineId,
  startTime: DateTime.Utc,
  endTime: DateTime.Utc
): Effect.Effect<DowntimeReport, EquipmentStateTemporalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    // Get all transitions in the time range
    const history = yield* getEquipmentStateHistory(machineId)

    const startMillis = DateTime.toEpochMillis(startTime)
    const endMillis = DateTime.toEpochMillis(endTime)
    const totalPeriodMs = endMillis - startMillis

    // Filter and process transitions within the time range
    const relevantTransitions = history.filter((t) => {
      const transitionMillis = DateTime.toEpochMillis(t.transitionedAt)
      return transitionMillis >= startMillis && transitionMillis <= endMillis
    })

    // Build downtime periods
    const periods: DowntimePeriod[] = []
    let currentState: OeeState = 'offline'
    let currentStateStart = startTime
    let currentReason: string | undefined
    let currentFaultCode: string | undefined
    let currentWorkOrderId: string | undefined

    // Get initial state at startTime
    const initialState = yield* getEquipmentStateAtTime(machineId, startTime)
    currentState = initialState.state
    currentStateStart = initialState.stateStartedAt
    currentReason = Option.getOrUndefined(initialState.reason)
    currentFaultCode = Option.getOrUndefined(initialState.activeFaultCode)
    currentWorkOrderId = Option.getOrUndefined(initialState.activeWorkOrderId)

    // Process each transition
    for (const transition of relevantTransitions) {
      // If we were in a downtime state, record the period
      if (isDowntimeState(currentState)) {
        const periodStart = DateTime.toEpochMillis(currentStateStart) < startMillis
          ? startTime
          : currentStateStart

        periods.push(new DowntimePeriod({
          machineId,
          downtimeType: currentState === 'maintenance' ? 'planned' : 'unplanned',
          state: currentState,
          startedAt: periodStart,
          endedAt: Option.some(transition.transitionedAt),
          durationMs: DateTime.toEpochMillis(transition.transitionedAt) - DateTime.toEpochMillis(periodStart),
          reason: currentReason ? Option.some(currentReason) : Option.none(),
          faultCode: currentFaultCode ? Option.some(currentFaultCode) : Option.none(),
          workOrderId: currentWorkOrderId ? Option.some(currentWorkOrderId) : Option.none(),
        }))
      }

      // Update current state
      currentState = transition.toState
      currentStateStart = transition.transitionedAt
      currentReason = Option.getOrUndefined(transition.reason)

      // Track fault/work order based on state
      if (currentState === 'faulted') {
        // Would need to look at the event to get fault code
        currentFaultCode = undefined // Simplified - would need event lookup
        currentWorkOrderId = undefined
      } else if (currentState === 'maintenance') {
        currentFaultCode = undefined
        // Would need event lookup for work order
        currentWorkOrderId = undefined
      } else {
        currentFaultCode = undefined
        currentWorkOrderId = undefined
      }
    }

    // Handle final period if still in downtime at end of range
    if (isDowntimeState(currentState)) {
      const periodStart = DateTime.toEpochMillis(currentStateStart) < startMillis
        ? startTime
        : currentStateStart

      periods.push(new DowntimePeriod({
        machineId,
        downtimeType: currentState === 'maintenance' ? 'planned' : 'unplanned',
        state: currentState,
        startedAt: periodStart,
        endedAt: Option.none(),
        durationMs: endMillis - DateTime.toEpochMillis(periodStart),
        reason: currentReason ? Option.some(currentReason) : Option.none(),
        faultCode: currentFaultCode ? Option.some(currentFaultCode) : Option.none(),
        workOrderId: currentWorkOrderId ? Option.some(currentWorkOrderId) : Option.none(),
      }))
    }

    // Calculate totals
    let plannedDowntimeMs = 0
    let unplannedDowntimeMs = 0

    for (const period of periods) {
      if (period.downtimeType === 'planned') {
        plannedDowntimeMs += period.durationMs
      } else {
        unplannedDowntimeMs += period.durationMs
      }
    }

    const totalDowntimeMs = plannedDowntimeMs + unplannedDowntimeMs
    const uptimeMs = totalPeriodMs - totalDowntimeMs

    // Availability = Uptime / (Uptime + Unplanned Downtime)
    // Note: Planned downtime is typically excluded from availability calculation
    const scheduledTime = totalPeriodMs - plannedDowntimeMs
    const availability = scheduledTime > 0 ? uptimeMs / scheduledTime : 0

    return new DowntimeReport({
      machineId,
      periodStart: startTime,
      periodEnd: endTime,
      plannedDowntimeMs,
      unplannedDowntimeMs,
      uptimeMs,
      availability: Math.max(0, Math.min(1, availability)),
      periods,
    })
  })

/**
 * Check if a state represents downtime.
 */
const isDowntimeState = (state: OeeState): boolean => {
  return state === 'maintenance' || state === 'faulted' || state === 'offline'
}

// =============================================================================
// OEE Helpers
// =============================================================================

/**
 * Calculate availability for a machine over a time range.
 *
 * Availability = Operating Time / Scheduled Time
 * Where: Scheduled Time = Total Time - Planned Downtime
 *
 * @param machineId - Machine to calculate availability for
 * @param startTime - Start of calculation period
 * @param endTime - End of calculation period
 * @returns Availability as a decimal (0.0 to 1.0)
 *
 * @example
 * ```typescript
 * const availability = yield* calculateAvailability(
 *   machineId,
 *   DateTime.unsafeFromDate(new Date('2024-01-01')),
 *   DateTime.unsafeFromDate(new Date('2024-01-31'))
 * )
 * console.log(`Availability: ${(availability * 100).toFixed(1)}%`)
 * ```
 */
export const calculateAvailability = (
  machineId: MachineId,
  startTime: DateTime.Utc,
  endTime: DateTime.Utc
): Effect.Effect<number, EquipmentStateTemporalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const report = yield* getDowntimeReport(machineId, startTime, endTime)
    return report.availability
  })
