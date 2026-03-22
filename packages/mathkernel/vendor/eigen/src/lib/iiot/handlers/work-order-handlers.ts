/**
 * Work Order Event Handlers — Projections for ISA-95 Work Order Lifecycle
 *
 * Handles WorkOrderEvents by projecting them into the read model.
 * These handlers run when events are written to the EventLog, maintaining
 * the work order state for queries and reporting.
 *
 * IMPORTANT: EventLog.group handlers must return Effect<void, never, R>.
 * All errors must be caught and logged, never propagated.
 *
 * @module @gbg/tmnl/iiot/handlers/work-order-handlers
 * @see @effect/experimental/EventLog for EventLog.group API
 * @see ISA-95/IEC 62264 for operations management
 * @see FDA 21 CFR Part 11 for electronic records compliance
 */

import { Effect, Option, Cause } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { WorkOrderEvents } from '../schemas/events/groups'

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
      Effect.log(`[WorkOrderEventHandler] ${handlerName} failed: ${Cause.pretty(cause)}`)
    ),
    Effect.asVoid
  )

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * WorkOrderEventHandlers — Projections for Work Order State
 *
 * Each handler receives the event payload and entry metadata, then
 * logs the action. When WorkOrderRepo is implemented, handlers will
 * update the read model to reflect the new state.
 *
 * Handlers are designed to be idempotent:
 * - WorkOrderCreated: Insert only if work order doesn't exist
 * - State transitions: Update only if current state allows transition
 *
 * All handlers wrap operations in catchHandlerError to ensure errors
 * are logged but not propagated (EventLog requirement).
 *
 * @example
 * ```typescript
 * import { WorkOrderEventHandlers } from './work-order-handlers'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   WorkOrderEventHandlers,
 * )
 * ```
 */
export const WorkOrderEventHandlers = EventLog.group(WorkOrderEvents, (handlers) =>
  handlers
    // =========================================================================
    // WorkOrderCreated — Create new work order record
    // =========================================================================
    .handle('WorkOrderCreated', ({ payload }) =>
      catchHandlerError(
        'WorkOrderCreated',
        Effect.gen(function* () {
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order created: ${payload.workOrderId}, ` +
            `title: "${payload.title}", priority: ${payload.priority}`
          )
          // TODO: When WorkOrderRepo is implemented:
          // const repo = yield* WorkOrderRepo
          // yield* repo.insert({ ... })
        })
      )
    )

    // =========================================================================
    // WorkOrderSubmitted — Submitted for approval
    // =========================================================================
    .handle('WorkOrderSubmitted', ({ payload }) =>
      catchHandlerError(
        'WorkOrderSubmitted',
        Effect.gen(function* () {
          const comments = Option.isSome(payload.comments)
            ? `, comments: "${payload.comments.value}"`
            : ''
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order submitted: ${payload.workOrderId}${comments}`
          )
        })
      )
    )

    // =========================================================================
    // WorkOrderApproved — Approved to proceed
    // =========================================================================
    .handle('WorkOrderApproved', ({ payload }) =>
      catchHandlerError(
        'WorkOrderApproved',
        Effect.gen(function* () {
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order approved: ${payload.workOrderId} ` +
            `by ${payload.approvedBy} (level ${payload.approvalLevel})`
          )
        })
      )
    )

    // =========================================================================
    // WorkOrderRejected — Rejected with reason
    // =========================================================================
    .handle('WorkOrderRejected', ({ payload }) =>
      catchHandlerError(
        'WorkOrderRejected',
        Effect.gen(function* () {
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order rejected: ${payload.workOrderId} ` +
            `by ${payload.rejectedBy}, reason: "${payload.reason}"`
          )
        })
      )
    )

    // =========================================================================
    // WorkOrderStarted — Execution started
    // =========================================================================
    .handle('WorkOrderStarted', ({ payload }) =>
      catchHandlerError(
        'WorkOrderStarted',
        Effect.gen(function* () {
          const assignee = Option.isSome(payload.assignedTo)
            ? `, assigned to: ${payload.assignedTo.value}`
            : ''
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order started: ${payload.workOrderId} ` +
            `by ${payload.startedBy}${assignee}`
          )
        })
      )
    )

    // =========================================================================
    // WorkOrderSuspended — Temporarily paused
    // =========================================================================
    .handle('WorkOrderSuspended', ({ payload }) =>
      catchHandlerError(
        'WorkOrderSuspended',
        Effect.gen(function* () {
          const expectedResume = Option.isSome(payload.expectedResume)
            ? `, expected resume: ${payload.expectedResume.value}`
            : ''
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order suspended: ${payload.workOrderId} ` +
            `by ${payload.suspendedBy}, reason: ${payload.reason}${expectedResume}`
          )
        })
      )
    )

    // =========================================================================
    // WorkOrderResumed — Resumed from suspension
    // =========================================================================
    .handle('WorkOrderResumed', ({ payload }) =>
      catchHandlerError(
        'WorkOrderResumed',
        Effect.gen(function* () {
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order resumed: ${payload.workOrderId} ` +
            `by ${payload.resumedBy}`
          )
        })
      )
    )

    // =========================================================================
    // WorkOrderCompleted — Successfully finished
    // =========================================================================
    .handle('WorkOrderCompleted', ({ payload }) =>
      catchHandlerError(
        'WorkOrderCompleted',
        Effect.gen(function* () {
          const duration = Option.isSome(payload.actualDurationMinutes)
            ? `, duration: ${payload.actualDurationMinutes.value} min`
            : ''
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order completed: ${payload.workOrderId} ` +
            `by ${payload.completedBy}, outcome: ${payload.outcome}${duration}`
          )
        })
      )
    )

    // =========================================================================
    // WorkOrderFailed — Failed with error
    // =========================================================================
    .handle('WorkOrderFailed', ({ payload }) =>
      catchHandlerError(
        'WorkOrderFailed',
        Effect.gen(function* () {
          const failedTask = Option.isSome(payload.failedTaskId)
            ? `, failed task: ${payload.failedTaskId.value}`
            : ''
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order failed: ${payload.workOrderId} ` +
            `reported by ${payload.reportedBy}, reason: "${payload.failureReason}"${failedTask}`
          )
        })
      )
    )

    // =========================================================================
    // WorkOrderCancelled — Cancelled before completion
    // =========================================================================
    .handle('WorkOrderCancelled', ({ payload }) =>
      catchHandlerError(
        'WorkOrderCancelled',
        Effect.gen(function* () {
          const compensation = payload.compensationRequired
            ? ', compensation required'
            : ''
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order cancelled: ${payload.workOrderId} ` +
            `by ${payload.cancelledBy}, reason: "${payload.reason}"${compensation}`
          )
        })
      )
    )

    // =========================================================================
    // WorkOrderClosed — Archived after completion
    // =========================================================================
    .handle('WorkOrderClosed', ({ payload }) =>
      catchHandlerError(
        'WorkOrderClosed',
        Effect.gen(function* () {
          const archive = Option.isSome(payload.archiveReference)
            ? `, archive: ${payload.archiveReference.value}`
            : ''
          yield* Effect.log(
            `[WorkOrderEventHandler] Work order closed: ${payload.workOrderId} ` +
            `by ${payload.closedBy}, final status: ${payload.finalStatus}${archive}`
          )
        })
      )
    )
)

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Layer type for WorkOrderEventHandlers.
 * This layer provides handlers for all work order events in the WorkOrderEvents group.
 */
export type WorkOrderEventHandlersLayer = typeof WorkOrderEventHandlers
