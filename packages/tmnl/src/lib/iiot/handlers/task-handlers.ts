/**
 * Task Event Handlers — Projections for Task Instance Lifecycle
 *
 * Handles TaskEvents by logging audit trail for ISA-95 Level 3 task execution.
 * These handlers are logging-only - the EventLog itself serves as the
 * immutable audit trail for task lifecycle changes.
 *
 * IMPORTANT: EventLog.group handlers must return Effect<void, never, R>.
 * All errors must be caught and logged, never propagated.
 *
 * @module @gbg/tmnl/iiot/handlers/task-handlers
 * @see @effect/experimental/EventLog for EventLog.group API
 * @see ISA-95/IEC 62264 for operations management standard
 */

import { Effect, Option, Cause } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { TaskEvents } from '../schemas/events/groups'

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
      Effect.log(`[TaskEventHandler] ${handlerName} failed: ${Cause.pretty(cause)}`)
    ),
    Effect.asVoid
  )

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * TaskEventHandlers — Audit Trail for Task Instance Lifecycle
 *
 * Each handler logs the task operation for audit trail purposes.
 * The EventLog entry is the source of truth - handlers provide observability.
 *
 * @example
 * ```typescript
 * import { TaskEventHandlers } from './task-handlers'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   TaskEventHandlers,
 * )
 * ```
 */
export const TaskEventHandlers = EventLog.group(TaskEvents, (handlers) =>
  handlers
    // =========================================================================
    // TaskBecameReady — Log task ready state with satisfied dependencies
    // =========================================================================
    .handle('TaskBecameReady', ({ payload }) =>
      catchHandlerError(
        'TaskBecameReady',
        Effect.gen(function* () {
          const depCount = payload.satisfiedDependencies.length

          yield* Effect.log(
            `[TaskEventHandler] Task became ready: taskInstanceId=${payload.taskInstanceId}, ` +
              `workOrderId=${payload.workOrderId}, satisfiedDependencies=${depCount}, ` +
              `previousStatus=${payload.previousStatus}`
          )
        })
      )
    )

    // =========================================================================
    // TaskStarted — Log task execution start with operator info
    // =========================================================================
    .handle('TaskStarted', ({ payload }) =>
      catchHandlerError(
        'TaskStarted',
        Effect.gen(function* () {
          const targetText = Option.isSome(payload.targetAssetId)
            ? ` targetAsset=${payload.targetAssetId.value}`
            : ''
          const estimatedText = Option.isSome(payload.estimatedDurationMinutes)
            ? ` estimatedDuration=${payload.estimatedDurationMinutes.value}min`
            : ''

          yield* Effect.log(
            `[TaskEventHandler] Task started: taskInstanceId=${payload.taskInstanceId}, ` +
              `workOrderId=${payload.workOrderId}, startedBy=${payload.startedBy}${targetText}${estimatedText}`
          )
        })
      )
    )

    // =========================================================================
    // TaskProgressUpdated — Log progress change
    // =========================================================================
    .handle('TaskProgressUpdated', ({ payload }) =>
      catchHandlerError(
        'TaskProgressUpdated',
        Effect.gen(function* () {
          const notesText = Option.isSome(payload.notes)
            ? ` notes=${payload.notes.value}`
            : ''

          yield* Effect.log(
            `[TaskEventHandler] Task progress updated: taskInstanceId=${payload.taskInstanceId}, ` +
              `progress=${payload.previousProgress}% → ${payload.newProgress}%, ` +
              `updatedBy=${payload.updatedBy}${notesText}`
          )
        })
      )
    )

    // =========================================================================
    // TaskBlocked — Log task blocked with reason
    // =========================================================================
    .handle('TaskBlocked', ({ payload }) =>
      catchHandlerError(
        'TaskBlocked',
        Effect.gen(function* () {
          const detailsText = Option.isSome(payload.details)
            ? ` details=${payload.details.value}`
            : ''
          const blockedDepsText = Option.isSome(payload.blockedDependencyIds)
            ? ` blockedDeps=${payload.blockedDependencyIds.value.join(',')}`
            : ''

          yield* Effect.log(
            `[TaskEventHandler] Task blocked: taskInstanceId=${payload.taskInstanceId}, ` +
              `workOrderId=${payload.workOrderId}, reason=${payload.blockingReason}, ` +
              `blockedBy=${payload.blockedBy}${detailsText}${blockedDepsText}`
          )
        })
      )
    )

    // =========================================================================
    // TaskUnblocked — Log task unblocked with resolution
    // =========================================================================
    .handle('TaskUnblocked', ({ payload }) =>
      catchHandlerError(
        'TaskUnblocked',
        Effect.gen(function* () {
          const resolutionText = Option.isSome(payload.resolutionNotes)
            ? ` resolution=${payload.resolutionNotes.value}`
            : ''

          yield* Effect.log(
            `[TaskEventHandler] Task unblocked: taskInstanceId=${payload.taskInstanceId}, ` +
              `workOrderId=${payload.workOrderId}, previousReason=${payload.previousBlockingReason}, ` +
              `unblockedBy=${payload.unblockedBy}${resolutionText}`
          )
        })
      )
    )

    // =========================================================================
    // TaskCompleted — Log task completion with duration
    // =========================================================================
    .handle('TaskCompleted', ({ payload }) =>
      catchHandlerError(
        'TaskCompleted',
        Effect.gen(function* () {
          const durationText = Option.isSome(payload.durationMinutes)
            ? ` duration=${payload.durationMinutes.value}min`
            : ''
          const notesText = Option.isSome(payload.notes)
            ? ` notes=${payload.notes.value}`
            : ''

          yield* Effect.log(
            `[TaskEventHandler] Task completed: taskInstanceId=${payload.taskInstanceId}, ` +
              `workOrderId=${payload.workOrderId}, completedBy=${payload.completedBy}${durationText}${notesText}`
          )
        })
      )
    )

    // =========================================================================
    // TaskFailed — Log task failure with error details
    // =========================================================================
    .handle('TaskFailed', ({ payload }) =>
      catchHandlerError(
        'TaskFailed',
        Effect.gen(function* () {
          const errorCodeText = Option.isSome(payload.errorCode)
            ? ` [${payload.errorCode.value}]`
            : ''
          const retryableText = payload.retryable ? ' (retryable)' : ' (not retryable)'

          yield* Effect.log(
            `[TaskEventHandler] Task failed: taskInstanceId=${payload.taskInstanceId}, ` +
              `workOrderId=${payload.workOrderId}, failedBy=${payload.failedBy}, ` +
              `error${errorCodeText}=${payload.error}${retryableText}, retryCount=${payload.retryCount}`
          )
        })
      )
    )

    // =========================================================================
    // TaskSkipped — Log task skip with approval info
    // =========================================================================
    .handle('TaskSkipped', ({ payload }) =>
      catchHandlerError(
        'TaskSkipped',
        Effect.gen(function* () {
          const approvalText = Option.isSome(payload.approvedBy)
            ? ` (approved by ${payload.approvedBy.value})`
            : ''

          yield* Effect.log(
            `[TaskEventHandler] Task skipped: taskInstanceId=${payload.taskInstanceId}, ` +
              `workOrderId=${payload.workOrderId}, skippedBy=${payload.skippedBy}, ` +
              `reason=${payload.reason}${approvalText}`
          )
        })
      )
    )

    // =========================================================================
    // TaskCompensated — Log compensation action (saga pattern)
    // =========================================================================
    .handle('TaskCompensated', ({ payload }) =>
      catchHandlerError(
        'TaskCompensated',
        Effect.gen(function* () {
          const originalErrorText = Option.isSome(payload.originalError)
            ? ` originalError=${payload.originalError.value}`
            : ''
          const notesText = Option.isSome(payload.notes)
            ? ` notes=${payload.notes.value}`
            : ''

          yield* Effect.log(
            `[TaskEventHandler] Task compensated: taskInstanceId=${payload.taskInstanceId}, ` +
              `workOrderId=${payload.workOrderId}, compensatedBy=${payload.compensatedBy}, ` +
              `result=${payload.compensationResult}, action=${payload.compensationAction}${originalErrorText}${notesText}`
          )
        })
      )
    )
)

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Layer type for TaskEventHandlers.
 * This layer provides handlers for all task events in the TaskEvents group.
 */
export type TaskEventHandlersLayer = typeof TaskEventHandlers
