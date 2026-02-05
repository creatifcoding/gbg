/**
 * Work Order Temporal Queries — Event-Sourced State Reconstruction
 *
 * Provides temporal query capabilities for work orders:
 * - getWorkOrderAtTime: Reconstruct work order state at any point in time
 * - getWorkOrderHistory: Get full history of work order state transitions
 *
 * Uses EventLog/EventJournal to replay events and fold them into state.
 * This enables FDA 21 CFR Part 11 compliant audit trails and time-travel queries.
 *
 * @module @gbg/tmnl/iiot/services/l2/work-order-temporal
 * @see ISA-95/IEC 62264 for operations management
 * @see FDA 21 CFR Part 11 for electronic records compliance
 * @see ADR-0012 for ES boundaries (work orders ARE event sourced)
 */

import { Effect, DateTime, Option, Schema } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import type { WorkOrderId, WorkflowDefinitionId, TaskInstanceId } from '../../schemas/identifiers'
import {
  WorkOrder,
  WorkOrderAtTime,
  WorkOrderTransition,
  type WorkOrderStatus,
  type WorkOrderPriority,
  type WorkOrderType,
  type WorkOrderOutcome,
  type SuspensionReason,
  type WorkOrderFinalStatus,
} from '../../schemas/work-orders'
import { WorkOrderEvents } from '../../schemas/events/groups'

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error for work order temporal query failures.
 */
export class WorkOrderTemporalError extends Schema.TaggedError<WorkOrderTemporalError>()(
  'WorkOrderTemporalError',
  {
    workOrderId: Schema.String,
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// Work Order Event Tag Types
// =============================================================================

/**
 * All work order event tags that can trigger state transitions.
 */
const WORK_ORDER_EVENT_TAGS = [
  'WorkOrderCreated',
  'WorkOrderSubmitted',
  'WorkOrderApproved',
  'WorkOrderRejected',
  'WorkOrderStarted',
  'WorkOrderSuspended',
  'WorkOrderResumed',
  'WorkOrderCompleted',
  'WorkOrderFailed',
  'WorkOrderCancelled',
  'WorkOrderClosed',
] as const

type WorkOrderEventTag = (typeof WORK_ORDER_EVENT_TAGS)[number]

/**
 * Check if an entry is a work order event.
 */
const isWorkOrderEvent = (eventTag: string): eventTag is WorkOrderEventTag =>
  WORK_ORDER_EVENT_TAGS.includes(eventTag as WorkOrderEventTag)

// =============================================================================
// Event Payload Decoding
// =============================================================================

/**
 * Decode event payload from msgpack bytes using the appropriate schema.
 */
const decodeWorkOrderEventPayload = (
  eventTag: WorkOrderEventTag,
  payload: Uint8Array
): Effect.Effect<Record<string, unknown>, Error> => {
  const event = WorkOrderEvents.events[eventTag] as { payloadMsgPack: Schema.Schema<unknown, Uint8Array> } | undefined
  if (!event) {
    return Effect.fail(new Error(`Unknown work order event: ${eventTag}`))
  }

  return Schema.decode(event.payloadMsgPack as Schema.Schema<Record<string, unknown>, Uint8Array>)(payload).pipe(
    Effect.mapError((e) => new Error(`Failed to decode ${eventTag}: ${String(e)}`))
  )
}

// =============================================================================
// State Transition Logic
// =============================================================================

/**
 * Determine the next work order state based on an event.
 *
 * State machine per ISA-95 operations management:
 * - WorkOrderCreated -> created (draft)
 * - WorkOrderSubmitted -> submitted (pending_approval)
 * - WorkOrderApproved -> approved
 * - WorkOrderRejected -> rejected (terminal)
 * - WorkOrderStarted -> started (in_progress)
 * - WorkOrderSuspended -> suspended
 * - WorkOrderResumed -> resumed (in_progress)
 * - WorkOrderCompleted -> completed
 * - WorkOrderFailed -> failed
 * - WorkOrderCancelled -> cancelled
 * - WorkOrderClosed -> closed (terminal)
 */
const eventToState = (eventTag: WorkOrderEventTag): WorkOrderStatus | null => {
  switch (eventTag) {
    case 'WorkOrderCreated':
      return 'created'
    case 'WorkOrderSubmitted':
      return 'submitted'
    case 'WorkOrderApproved':
      return 'approved'
    case 'WorkOrderRejected':
      return 'rejected'
    case 'WorkOrderStarted':
      return 'started'
    case 'WorkOrderSuspended':
      return 'suspended'
    case 'WorkOrderResumed':
      return 'resumed'
    case 'WorkOrderCompleted':
      return 'completed'
    case 'WorkOrderFailed':
      return 'failed'
    case 'WorkOrderCancelled':
      return 'cancelled'
    case 'WorkOrderClosed':
      return 'closed'
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
  readonly _tag: WorkOrderEventTag
  readonly workOrderId: WorkOrderId
  readonly occurredAt: DateTime.Utc
  readonly causedBy: string
  // WorkOrderCreated fields
  readonly templateId?: Option.Option<WorkflowDefinitionId>
  readonly priority?: WorkOrderPriority
  readonly scheduledStart?: Option.Option<DateTime.Utc>
  readonly assignedTo?: Option.Option<string>
  readonly title?: string
  readonly description?: Option.Option<string>
  readonly metadata?: Option.Option<Record<string, unknown>>
  // WorkOrderApproved fields
  readonly approvedBy?: string
  readonly approvalLevel?: number
  readonly comments?: Option.Option<string>
  // WorkOrderRejected fields
  readonly rejectedBy?: string
  readonly reason?: string | Option.Option<string>
  // WorkOrderStarted fields
  readonly startedBy?: string
  // WorkOrderSuspended fields
  readonly suspendedBy?: string
  readonly expectedResume?: Option.Option<DateTime.Utc>
  readonly notes?: Option.Option<string>
  // WorkOrderResumed fields
  readonly resumedBy?: string
  // WorkOrderCompleted fields
  readonly completedBy?: string
  readonly outcome?: string
  readonly summary?: string
  readonly actualDurationMinutes?: Option.Option<number>
  // WorkOrderFailed fields
  readonly failedTaskId?: Option.Option<string>
  readonly failureReason?: string
  readonly reportedBy?: string
  // WorkOrderCancelled fields
  readonly cancelledBy?: string
  readonly compensationRequired?: boolean
  // WorkOrderClosed fields
  readonly closedBy?: string
  readonly finalStatus?: string
  readonly archiveReference?: Option.Option<string>
  [key: string]: unknown
}

// =============================================================================
// Helpers for Option/Union Extraction
// =============================================================================

/**
 * Extract string from a field that may be string | Option<string>.
 */
const extractString = (value: string | Option.Option<string> | undefined): string | undefined => {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value
  return Option.getOrUndefined(value)
}

/**
 * Fold work order events into a WorkOrder state.
 *
 * Events must be sorted by occurredAt (ascending).
 * Throws if events array is empty.
 *
 * @param events - Sorted array of tagged work order events
 * @param workOrderId - The work order ID to construct
 * @returns Reconstructed WorkOrder state
 */
export const foldWorkOrderEvents = (
  events: ReadonlyArray<TaggedEvent>,
  workOrderId: WorkOrderId
): WorkOrder => {
  if (events.length === 0) {
    throw new Error(`Cannot fold empty events for work order ${workOrderId}`)
  }

  // Initial state from first event (must be WorkOrderCreated)
  const firstEvent = events[0]
  if (firstEvent._tag !== 'WorkOrderCreated') {
    throw new Error(`First event must be WorkOrderCreated, got ${firstEvent._tag}`)
  }

  // Initialize from creation event
  let status: WorkOrderStatus = 'created'
  let assignedTo: Option.Option<string> = firstEvent.assignedTo ?? Option.none()
  let actualStart: Option.Option<DateTime.Utc> = Option.none()
  let actualEnd: Option.Option<DateTime.Utc> = Option.none()
  let outcome: Option.Option<WorkOrderOutcome> = Option.none()
  let summary: Option.Option<string> = Option.none()
  let failedTaskId: Option.Option<TaskInstanceId> = Option.none()
  let failureReason: Option.Option<string> = Option.none()
  let suspensionReason: Option.Option<SuspensionReason> = Option.none()
  let expectedResume: Option.Option<DateTime.Utc> = Option.none()
  let cancellationReason: Option.Option<string> = Option.none()
  let compensationRequired = false
  let finalStatus: Option.Option<WorkOrderFinalStatus> = Option.none()

  // Process each event to update state
  for (const event of events) {
    switch (event._tag) {
      case 'WorkOrderCreated':
        status = 'created'
        break

      case 'WorkOrderSubmitted':
        status = 'submitted'
        break

      case 'WorkOrderApproved':
        status = 'approved'
        break

      case 'WorkOrderRejected':
        status = 'rejected'
        break

      case 'WorkOrderStarted':
        status = 'started'
        actualStart = Option.some(event.occurredAt)
        if (event.startedBy) {
          assignedTo = Option.some(event.startedBy)
        }
        break

      case 'WorkOrderSuspended':
        status = 'suspended'
        {
          const reason = extractString(event.reason)
          suspensionReason = reason ? Option.some(reason as SuspensionReason) : Option.none()
        }
        expectedResume = event.expectedResume ?? Option.none()
        break

      case 'WorkOrderResumed':
        status = 'resumed'
        suspensionReason = Option.none()
        expectedResume = Option.none()
        break

      case 'WorkOrderCompleted':
        status = 'completed'
        actualEnd = Option.some(event.occurredAt)
        outcome = event.outcome ? Option.some(event.outcome as WorkOrderOutcome) : Option.none()
        summary = event.summary ? Option.some(event.summary) : Option.none()
        break

      case 'WorkOrderFailed':
        status = 'failed'
        actualEnd = Option.some(event.occurredAt)
        failedTaskId = (event.failedTaskId ?? Option.none<string>()).pipe(
          Option.map((id): TaskInstanceId => id as TaskInstanceId)
        )
        failureReason = event.failureReason ? Option.some(event.failureReason) : Option.none()
        break

      case 'WorkOrderCancelled':
        status = 'cancelled'
        actualEnd = Option.some(event.occurredAt)
        {
          const reason = extractString(event.reason)
          cancellationReason = reason ? Option.some(reason) : Option.none()
        }
        compensationRequired = event.compensationRequired ?? false
        break

      case 'WorkOrderClosed':
        status = 'closed'
        finalStatus = event.finalStatus ? Option.some(event.finalStatus as WorkOrderFinalStatus) : Option.none()
        break
    }
  }

  // Construct WorkOrder from accumulated state
  return new WorkOrder({
    id: workOrderId,
    workflowDefinitionId: Option.getOrElse(
      firstEvent.templateId ?? Option.none(),
      () => 'WF-unknown' as WorkflowDefinitionId
    ),
    workflowVersion: '1.0.0', // Default, not tracked in events
    title: firstEvent.title as string,
    description: Option.getOrElse(firstEvent.description ?? Option.none(), () => ''),
    type: 'other' as WorkOrderType, // Default, not tracked in creation event
    priority: firstEvent.priority ?? ('normal' as WorkOrderPriority),
    status,
    createdBy: firstEvent.causedBy,
    createdAt: firstEvent.occurredAt,
    scheduledStart: firstEvent.scheduledStart ?? Option.none(),
    dueDate: Option.none(), // Not tracked in events
    actualStart,
    actualEnd,
    parentWorkOrderId: Option.none(), // Not tracked in events
    primaryAssetId: Option.none(), // Not tracked in events
    assignedTo,
    outcome,
    summary,
    failedTaskId,
    failureReason,
    suspensionReason,
    expectedResume,
    cancellationReason,
    compensationRequired,
    finalStatus,
    metadata: Option.getOrElse(firstEvent.metadata ?? Option.none(), () => ({})),
  })
}

// =============================================================================
// Temporal Queries
// =============================================================================

/**
 * Get the work order state at a specific point in time.
 *
 * Reads all events for the work order up to `asOf` timestamp,
 * then folds them to reconstruct the state.
 *
 * @param workOrderId - Work order to query
 * @param asOf - Point in time to reconstruct state for
 * @returns WorkOrderAtTime with reconstructed state
 *
 * @example
 * ```typescript
 * const result = yield* getWorkOrderAtTime(workOrderId, DateTime.unsafeFromDate(new Date('2024-01-15T10:30:00Z')))
 * console.log(result.workOrder.status) // 'approved' | 'started' | etc
 * ```
 */
export const getWorkOrderAtTime = (
  workOrderId: WorkOrderId,
  asOf: DateTime.Utc
): Effect.Effect<WorkOrderAtTime, WorkOrderTemporalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const allEntries = yield* journal.entries.pipe(
      Effect.mapError((e) => new WorkOrderTemporalError({
        workOrderId,
        operation: 'getWorkOrderAtTime',
        message: `Failed to read entries: ${String(e)}`,
      }))
    )

    // Filter entries by primaryKey first (fast path)
    const workOrderEntries = allEntries.filter((entry) =>
      isWorkOrderEvent(entry.event) &&
      entry.primaryKey === workOrderId
    )

    if (workOrderEntries.length === 0) {
      return yield* Effect.fail(new WorkOrderTemporalError({
        workOrderId,
        operation: 'getWorkOrderAtTime',
        message: `No events found for work order ${workOrderId}`,
      }))
    }

    // Decode all payloads for this work order
    const allTaggedEvents: TaggedEvent[] = []

    for (const entry of workOrderEntries) {
      const payload = yield* decodeWorkOrderEventPayload(
        entry.event as WorkOrderEventTag,
        entry.payload
      ).pipe(
        Effect.mapError((e) => new WorkOrderTemporalError({
          workOrderId,
          operation: 'getWorkOrderAtTime',
          message: `Failed to decode event ${entry.event}: ${String(e)}`,
        }))
      )

      allTaggedEvents.push({
        _tag: entry.event as WorkOrderEventTag,
        ...payload,
      } as TaggedEvent)
    }

    // Filter by occurredAt <= asOf (payload-level filtering for accurate temporal query)
    const asOfMillis = DateTime.toEpochMillis(asOf)
    const relevantEvents = allTaggedEvents.filter((event) =>
      DateTime.toEpochMillis(event.occurredAt) <= asOfMillis
    )

    if (relevantEvents.length === 0) {
      return yield* Effect.fail(new WorkOrderTemporalError({
        workOrderId,
        operation: 'getWorkOrderAtTime',
        message: `No events found for work order ${workOrderId} up to ${DateTime.formatIso(asOf)}`,
      }))
    }

    // Sort by occurredAt
    relevantEvents.sort((a, b) =>
      DateTime.toEpochMillis(a.occurredAt) - DateTime.toEpochMillis(b.occurredAt)
    )

    // Fold events to state
    const workOrder = foldWorkOrderEvents(relevantEvents, workOrderId)

    return new WorkOrderAtTime({
      workOrder,
      asOf,
      fromReplay: true,
    })
  })

/**
 * Get the full history of state transitions for a work order.
 *
 * Returns an array of WorkOrderTransition records showing each
 * state change with timestamp and actor.
 *
 * @param workOrderId - Work order to get history for
 * @returns Array of state transitions (empty if no events)
 *
 * @example
 * ```typescript
 * const history = yield* getWorkOrderHistory(workOrderId)
 * // [
 * //   { fromState: undefined, toState: 'created', transitionedAt: ... },
 * //   { fromState: 'created', toState: 'submitted', transitionedAt: ... },
 * //   { fromState: 'submitted', toState: 'approved', transitionedAt: ... },
 * //   { fromState: 'approved', toState: 'started', transitionedAt: ... },
 * // ]
 * ```
 */
export const getWorkOrderHistory = (
  workOrderId: WorkOrderId
): Effect.Effect<WorkOrderTransition[], WorkOrderTemporalError, EventJournal.EventJournal> =>
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal
    const allEntries = yield* journal.entries.pipe(
      Effect.mapError((e) => new WorkOrderTemporalError({
        workOrderId,
        operation: 'getWorkOrderHistory',
        message: `Failed to read entries: ${String(e)}`,
      }))
    )

    // Filter entries for this work order
    const relevantEntries = allEntries.filter((entry) =>
      isWorkOrderEvent(entry.event) &&
      entry.primaryKey === workOrderId
    )

    if (relevantEntries.length === 0) {
      return []
    }

    // Sort by createdAtMillis
    relevantEntries.sort((a, b) => a.createdAtMillis - b.createdAtMillis)

    // Decode payloads
    const taggedEvents: Array<{ entry: EventJournal.Entry; event: TaggedEvent }> = []

    for (const entry of relevantEntries) {
      const payload = yield* decodeWorkOrderEventPayload(
        entry.event as WorkOrderEventTag,
        entry.payload
      ).pipe(
        Effect.mapError((e) => new WorkOrderTemporalError({
          workOrderId,
          operation: 'getWorkOrderHistory',
          message: `Failed to decode event ${entry.event}: ${String(e)}`,
        }))
      )

      taggedEvents.push({
        entry,
        event: {
          _tag: entry.event as WorkOrderEventTag,
          ...payload,
        } as TaggedEvent,
      })
    }

    // Build transitions
    const transitions: WorkOrderTransition[] = []
    let previousState: WorkOrderStatus | undefined

    for (const { event } of taggedEvents) {
      const newState = eventToState(event._tag)

      if (newState !== null) {
        // Extract reason based on event type
        let reason: string | undefined
        if (event._tag === 'WorkOrderRejected') {
          reason = event.reason as string
        } else if (event._tag === 'WorkOrderSuspended') {
          reason = event.reason as string
        } else if (event._tag === 'WorkOrderCancelled') {
          reason = event.reason as string
        } else if (event._tag === 'WorkOrderFailed') {
          reason = event.failureReason
        }

        // Determine who caused the transition
        let transitionedBy: string | undefined = event.causedBy
        if (event._tag === 'WorkOrderApproved') {
          transitionedBy = event.approvedBy
        } else if (event._tag === 'WorkOrderRejected') {
          transitionedBy = event.rejectedBy
        } else if (event._tag === 'WorkOrderStarted') {
          transitionedBy = event.startedBy
        } else if (event._tag === 'WorkOrderSuspended') {
          transitionedBy = event.suspendedBy
        } else if (event._tag === 'WorkOrderResumed') {
          transitionedBy = event.resumedBy
        } else if (event._tag === 'WorkOrderCompleted') {
          transitionedBy = event.completedBy
        } else if (event._tag === 'WorkOrderFailed') {
          transitionedBy = event.reportedBy
        } else if (event._tag === 'WorkOrderCancelled') {
          transitionedBy = event.cancelledBy
        } else if (event._tag === 'WorkOrderClosed') {
          transitionedBy = event.closedBy
        }

        transitions.push(new WorkOrderTransition({
          workOrderId,
          fromState: previousState ?? ('created' as WorkOrderStatus), // First event has no fromState
          toState: newState,
          transitionedAt: event.occurredAt,
          transitionedBy,
          reason,
        }))

        previousState = newState
      }
    }

    return transitions
  })
