/**
 * Alarm Temporal Queries — Event-Sourced State Reconstruction
 *
 * Provides temporal query capabilities for alarms:
 * - getAlarmAtTime: Reconstruct alarm state at any point in time
 * - getAlarmHistory: Get full history of alarm state transitions
 *
 * Uses EventLog/EventJournal to replay events and fold them into state.
 * This enables ISA-18.2 compliant audit trails and time-travel queries.
 *
 * @module @gbg/tmnl/iiot/services/l2/alarm-temporal
 * @see ISA-18.2 for alarm management audit requirements
 * @see ADR-0012 for ES boundaries (alarms ARE event sourced)
 */

import { Effect, DateTime, Option, Schema, Array as Arr } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import * as MsgPack from '@effect/platform/MsgPack'
import type { AlarmId, DeviceId } from '../../schemas/identifiers'
import {
  Alarm,
  AlarmAtTime,
  AlarmTransition,
  type AlarmState,
  type AlarmSeverity,
  type AlarmType,
} from '../../schemas/alarms'
import { AlarmEvents } from '../../schemas/events/groups'

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error for alarm temporal query failures.
 */
export class AlarmTemporalError extends Schema.TaggedError<AlarmTemporalError>()(
  'AlarmTemporalError',
  {
    alarmId: Schema.String,
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// Alarm Event Tag Types
// =============================================================================

/**
 * All alarm event tags that can trigger state transitions.
 */
const ALARM_EVENT_TAGS = [
  'AlarmTriggered',
  'AlarmAcknowledged',
  'AlarmCleared',
  'AlarmEscalated',
  'AlarmShelved',
  'AlarmUnshelved',
  'AlarmSuppressed',
  'AlarmOutOfService',
  'AlarmReturnedToService',
  'AlarmConfigChanged',
] as const

type AlarmEventTag = (typeof ALARM_EVENT_TAGS)[number]

/**
 * Check if an entry is an alarm event.
 */
const isAlarmEvent = (eventTag: string): eventTag is AlarmEventTag =>
  ALARM_EVENT_TAGS.includes(eventTag as AlarmEventTag)

// =============================================================================
// Event Payload Decoding
// =============================================================================

/**
 * Decode event payload from msgpack bytes using the appropriate schema.
 */
const decodeAlarmEventPayload = (
  eventTag: AlarmEventTag,
  payload: Uint8Array
): Effect.Effect<Record<string, unknown>, Error> => {
  const event = AlarmEvents.events[eventTag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> } | undefined
  if (!event) {
    return Effect.fail(new Error(`Unknown alarm event: ${eventTag}`))
  }

  return Schema.decode(event.payloadMsgPack as Schema.Schema<Record<string, unknown>, Uint8Array>)(payload).pipe(
    Effect.mapError((e) => new Error(`Failed to decode ${eventTag}: ${String(e)}`))
  )
}

// =============================================================================
// State Transition Logic
// =============================================================================

/**
 * Determine the next alarm state based on an event.
 *
 * Follows ISA-18.2 state machine:
 * - AlarmTriggered -> unacknowledged
 * - AlarmAcknowledged -> acknowledged
 * - AlarmCleared -> cleared
 * - AlarmShelved -> shelved
 * - AlarmUnshelved -> previous state (unack or ack)
 * - AlarmSuppressed -> suppressed
 * - AlarmOutOfService -> out_of_service
 * - AlarmReturnedToService -> unacknowledged or cleared
 */
const eventToState = (eventTag: AlarmEventTag): AlarmState | null => {
  switch (eventTag) {
    case 'AlarmTriggered':
      return 'unacknowledged'
    case 'AlarmAcknowledged':
      return 'acknowledged'
    case 'AlarmCleared':
      return 'cleared'
    case 'AlarmShelved':
      return 'shelved'
    case 'AlarmUnshelved':
      // Returns to previous state - need to look at payload
      return 'unacknowledged' // Default, actual logic in fold
    case 'AlarmSuppressed':
      return 'suppressed'
    case 'AlarmOutOfService':
      return 'out_of_service'
    case 'AlarmReturnedToService':
      return 'unacknowledged' // Or cleared based on payload
    case 'AlarmEscalated':
    case 'AlarmConfigChanged':
      return null // No state change
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
interface TaggedEvent {
  readonly _tag: AlarmEventTag
  readonly alarmId: AlarmId
  readonly deviceId: DeviceId
  readonly occurredAt: DateTime.Utc
  readonly severity?: AlarmSeverity
  readonly alarmType?: AlarmType
  readonly message?: Option.Option<string>
  readonly acknowledgedBy?: string
  readonly clearedAt?: DateTime.Utc
  readonly shelvedUntil?: DateTime.Utc
  readonly triggerValue?: number
  readonly thresholdValue?: Option.Option<number>
  readonly unit?: Option.Option<string>
  readonly metadata?: Option.Option<Record<string, unknown>>
  readonly reason?: Option.Option<string>
  readonly initialState?: 'unacknowledged' | 'cleared'
  [key: string]: unknown
}

/**
 * Fold alarm events into an Alarm state.
 *
 * Events must be sorted by occurredAt (ascending).
 * Throws if events array is empty.
 *
 * @param events - Sorted array of tagged alarm events
 * @param alarmId - The alarm ID to construct
 * @returns Reconstructed Alarm state
 */
export const foldAlarmEvents = (
  events: ReadonlyArray<TaggedEvent>,
  alarmId: AlarmId
): Alarm => {
  if (events.length === 0) {
    throw new Error(`Cannot fold empty events for alarm ${alarmId}`)
  }

  // Initial state from first event (must be AlarmTriggered)
  const firstEvent = events[0]
  if (firstEvent._tag !== 'AlarmTriggered') {
    throw new Error(`First event must be AlarmTriggered, got ${firstEvent._tag}`)
  }

  let state: AlarmState = 'unacknowledged'
  let acknowledgedAt: DateTime.Utc | undefined
  let acknowledgedBy: string | undefined
  let clearedAt: DateTime.Utc | undefined
  let shelvedUntil: DateTime.Utc | undefined
  let suppressionReason: string | undefined

  // Process each event to update state
  for (const event of events) {
    switch (event._tag) {
      case 'AlarmTriggered':
        state = 'unacknowledged'
        break

      case 'AlarmAcknowledged':
        state = 'acknowledged'
        acknowledgedAt = event.occurredAt
        acknowledgedBy = event.acknowledgedBy
        break

      case 'AlarmCleared':
        state = 'cleared'
        clearedAt = event.occurredAt
        break

      case 'AlarmShelved':
        state = 'shelved'
        shelvedUntil = event.shelvedUntil
        suppressionReason = Option.getOrUndefined(event.reason as Option.Option<string>)
        break

      case 'AlarmUnshelved':
        // Return to acknowledged if it was acknowledged before shelving
        state = acknowledgedAt ? 'acknowledged' : 'unacknowledged'
        shelvedUntil = undefined
        break

      case 'AlarmSuppressed':
        state = 'suppressed'
        suppressionReason = Option.getOrUndefined(event.reason as Option.Option<string>)
        break

      case 'AlarmOutOfService':
        state = 'out_of_service'
        suppressionReason = Option.getOrUndefined(event.reason as Option.Option<string>)
        break

      case 'AlarmReturnedToService':
        state = event.initialState ?? 'unacknowledged'
        suppressionReason = undefined
        break

      case 'AlarmEscalated':
      case 'AlarmConfigChanged':
        // No state change, but could track escalation level
        break
    }
  }

  // Construct Alarm from accumulated state
  return new Alarm({
    id: alarmId,
    deviceId: firstEvent.deviceId,
    alarmType: firstEvent.alarmType!,
    severity: firstEvent.severity!,
    state,
    triggeredAt: firstEvent.occurredAt,
    message: Option.getOrUndefined(firstEvent.message as Option.Option<string>),
    acknowledgedAt,
    acknowledgedBy,
    clearedAt,
    shelvedUntil,
    suppressionReason,
    metadata: Option.getOrUndefined(firstEvent.metadata as Option.Option<Record<string, unknown>>),
  })
}

// =============================================================================
// Temporal Queries
// =============================================================================

/**
 * Get the alarm state at a specific point in time.
 *
 * Reads all events for the alarm up to `asOf` timestamp,
 * then folds them to reconstruct the state.
 *
 * @param alarmId - Alarm to query
 * @param asOf - Point in time to reconstruct state for
 * @returns AlarmAtTime with reconstructed state
 *
 * @example
 * ```typescript
 * const result = yield* getAlarmAtTime(alarmId, DateTime.unsafeFromDate(new Date('2024-01-15T10:30:00Z')))
 * console.log(result.alarm.state) // 'acknowledged' | 'unacknowledged' | etc
 * ```
 */
export const getAlarmAtTime = (
  alarmId: AlarmId,
  asOf: DateTime.Utc
): Effect.Effect<AlarmAtTime, AlarmTemporalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const allEntries = yield* journal.entries.pipe(
      Effect.mapError((e) => new AlarmTemporalError({
        alarmId,
        operation: 'getAlarmAtTime',
        message: `Failed to read entries: ${String(e)}`,
      }))
    )

    // Filter entries by primaryKey first (fast path)
    const alarmEntries = allEntries.filter((entry) =>
      isAlarmEvent(entry.event) &&
      entry.primaryKey === alarmId
    )

    if (alarmEntries.length === 0) {
      return yield* Effect.fail(new AlarmTemporalError({
        alarmId,
        operation: 'getAlarmAtTime',
        message: `No events found for alarm ${alarmId}`,
      }))
    }

    // Decode all payloads for this alarm
    const allTaggedEvents: TaggedEvent[] = []

    for (const entry of alarmEntries) {
      const payload = yield* decodeAlarmEventPayload(
        entry.event as AlarmEventTag,
        entry.payload
      ).pipe(
        Effect.mapError((e) => new AlarmTemporalError({
          alarmId,
          operation: 'getAlarmAtTime',
          message: `Failed to decode event ${entry.event}: ${String(e)}`,
        }))
      )

      allTaggedEvents.push({
        _tag: entry.event as AlarmEventTag,
        ...payload,
      } as TaggedEvent)
    }

    // Filter by occurredAt <= asOf (payload-level filtering for accurate temporal query)
    const asOfMillis = DateTime.toEpochMillis(asOf)
    const relevantEvents = allTaggedEvents.filter((event) =>
      DateTime.toEpochMillis(event.occurredAt) <= asOfMillis
    )

    if (relevantEvents.length === 0) {
      return yield* Effect.fail(new AlarmTemporalError({
        alarmId,
        operation: 'getAlarmAtTime',
        message: `No events found for alarm ${alarmId} up to ${DateTime.formatIso(asOf)}`,
      }))
    }

    // Sort by occurredAt
    relevantEvents.sort((a, b) =>
      DateTime.toEpochMillis(a.occurredAt) - DateTime.toEpochMillis(b.occurredAt)
    )

    // Fold events to state
    const alarm = foldAlarmEvents(relevantEvents, alarmId)

    return new AlarmAtTime({
      alarm,
      asOf,
      fromReplay: true,
    })
  })

/**
 * Get the full history of state transitions for an alarm.
 *
 * Returns an array of AlarmTransition records showing each
 * state change with timestamp and actor.
 *
 * @param alarmId - Alarm to get history for
 * @returns Array of state transitions (empty if no events)
 *
 * @example
 * ```typescript
 * const history = yield* getAlarmHistory(alarmId)
 * // [
 * //   { fromState: undefined, toState: 'unacknowledged', transitionedAt: ... },
 * //   { fromState: 'unacknowledged', toState: 'acknowledged', transitionedAt: ... },
 * //   { fromState: 'acknowledged', toState: 'cleared', transitionedAt: ... },
 * // ]
 * ```
 */
export const getAlarmHistory = (
  alarmId: AlarmId
): Effect.Effect<AlarmTransition[], AlarmTemporalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const allEntries = yield* journal.entries.pipe(
      Effect.mapError((e) => new AlarmTemporalError({
        alarmId,
        operation: 'getAlarmHistory',
        message: `Failed to read entries: ${String(e)}`,
      }))
    )

    // Filter entries for this alarm
    const relevantEntries = allEntries.filter((entry) =>
      isAlarmEvent(entry.event) &&
      entry.primaryKey === alarmId
    )

    if (relevantEntries.length === 0) {
      return []
    }

    // Sort by createdAtMillis
    relevantEntries.sort((a, b) => a.createdAtMillis - b.createdAtMillis)

    // Decode payloads
    const taggedEvents: Array<{ entry: EventJournal.Entry; event: TaggedEvent }> = []

    for (const entry of relevantEntries) {
      const payload = yield* decodeAlarmEventPayload(
        entry.event as AlarmEventTag,
        entry.payload
      ).pipe(
        Effect.mapError((e) => new AlarmTemporalError({
          alarmId,
          operation: 'getAlarmHistory',
          message: `Failed to decode event ${entry.event}: ${String(e)}`,
        }))
      )

      taggedEvents.push({
        entry,
        event: {
          _tag: entry.event as AlarmEventTag,
          ...payload,
        } as TaggedEvent,
      })
    }

    // Build transitions
    const transitions: AlarmTransition[] = []
    let previousState: AlarmState | undefined

    for (const { event } of taggedEvents) {
      const newState = eventToState(event._tag)

      if (newState !== null) {
        // Safely extract reason - only some events have it and it's Option<string>
        const reasonField = event.reason
        const reason = reasonField !== undefined && Option.isOption(reasonField)
          ? Option.getOrUndefined(reasonField as Option.Option<string>)
          : undefined

        transitions.push(new AlarmTransition({
          alarmId,
          fromState: previousState ?? ('unacknowledged' as AlarmState), // First event has no fromState
          toState: newState,
          transitionedAt: event.occurredAt,
          transitionedBy: event.causedBy as string,
          reason,
        }))

        previousState = newState
      }
    }

    return transitions
  })
