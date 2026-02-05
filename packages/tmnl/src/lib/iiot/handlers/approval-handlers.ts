/**
 * Approval Event Handlers — Projections for FDA 21 CFR Part 11 Compliance
 *
 * Handles ApprovalEvents by logging audit trail for 4-eyes principle compliance.
 * These handlers are logging-only - the EventLog itself serves as the
 * immutable audit trail for regulatory compliance.
 *
 * IMPORTANT: EventLog.group handlers must return Effect<void, never, R>.
 * All errors must be caught and logged, never propagated.
 *
 * @module @gbg/tmnl/iiot/handlers/approval-handlers
 * @see @effect/experimental/EventLog for EventLog.group API
 * @see FDA 21 CFR Part 11 for electronic records compliance
 */

import { Effect, Option, Cause } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { ApprovalEvents } from '../schemas/events/groups'

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
      Effect.log(`[ApprovalEventHandler] ${handlerName} failed: ${Cause.pretty(cause)}`)
    ),
    Effect.asVoid
  )

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * ApprovalEventHandlers — Audit Trail for FDA 4-Eyes Principle
 *
 * Each handler logs the approval operation for audit trail purposes.
 * The EventLog entry is the source of truth - handlers provide observability.
 *
 * All approval events include electronic signature tracking for
 * FDA 21 CFR Part 11 compliance.
 *
 * @example
 * ```typescript
 * import { ApprovalEventHandlers } from './approval-handlers'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   ApprovalEventHandlers,
 * )
 * ```
 */
export const ApprovalEventHandlers = EventLog.group(ApprovalEvents, (handlers) =>
  handlers
    // =========================================================================
    // ApprovalRequested — Log approval request creation
    // =========================================================================
    .handle('ApprovalRequested', ({ payload }) =>
      catchHandlerError(
        'ApprovalRequested',
        Effect.gen(function* () {
          const expiresText = Option.isSome(payload.expiresAt)
            ? ` expiresAt=${payload.expiresAt.value}`
            : ''
          const justificationText = Option.isSome(payload.justification)
            ? ` justification="${payload.justification.value.slice(0, 50)}..."`
            : ''

          yield* Effect.log(
            `[ApprovalEventHandler] Approval requested: requestId=${payload.approvalRequestId}, ` +
              `requestedBy=${payload.requestedBy}, requiredLevel=${payload.requiredLevel}, ` +
              `type=${payload.requestType}, subjectType=${payload.subjectType}, ` +
              `subjectId=${payload.subjectId}${expiresText}${justificationText}`
          )
        })
      )
    )

    // =========================================================================
    // ApprovalGranted — Log approval granted with conditions
    // =========================================================================
    .handle('ApprovalGranted', ({ payload }) =>
      catchHandlerError(
        'ApprovalGranted',
        Effect.gen(function* () {
          const conditionsText = Option.isSome(payload.conditions)
            ? ` conditions="${payload.conditions.value}"`
            : ''
          const validUntilText = Option.isSome(payload.validUntil)
            ? ` validUntil=${payload.validUntil.value}`
            : ''
          const commentsText = Option.isSome(payload.comments)
            ? ` comments="${payload.comments.value.slice(0, 50)}..."`
            : ''

          yield* Effect.log(
            `[ApprovalEventHandler] Approval granted: requestId=${payload.approvalRequestId}, ` +
              `approvedBy=${payload.approvedBy}, level=${payload.approvalLevel}${conditionsText}${validUntilText}${commentsText}`
          )
        })
      )
    )

    // =========================================================================
    // ApprovalRejected — Log approval rejection with reason
    // =========================================================================
    .handle('ApprovalRejected', ({ payload }) =>
      catchHandlerError(
        'ApprovalRejected',
        Effect.gen(function* () {
          const canResubmitText = payload.canResubmit ? ' (can resubmit)' : ' (cannot resubmit)'
          const suggestedText = Option.isSome(payload.suggestedChanges)
            ? ` suggestedChanges="${payload.suggestedChanges.value.slice(0, 50)}..."`
            : ''

          yield* Effect.log(
            `[ApprovalEventHandler] Approval rejected: requestId=${payload.approvalRequestId}, ` +
              `rejectedBy=${payload.rejectedBy}, level=${payload.approvalLevel}, ` +
              `reason="${payload.reason}"${canResubmitText}${suggestedText}`
          )
        })
      )
    )

    // =========================================================================
    // ApprovalEscalated — Log escalation with level progression
    // =========================================================================
    .handle('ApprovalEscalated', ({ payload }) =>
      catchHandlerError(
        'ApprovalEscalated',
        Effect.gen(function* () {
          const previousApproversText = payload.previousApprovers.length > 0
            ? ` previousApprovers=[${payload.previousApprovers.join(',')}]`
            : ''
          const notesText = Option.isSome(payload.notes)
            ? ` notes="${payload.notes.value.slice(0, 50)}..."`
            : ''

          yield* Effect.log(
            `[ApprovalEventHandler] Approval escalated: requestId=${payload.approvalRequestId}, ` +
              `fromLevel=${payload.fromLevel} → toLevel=${payload.toLevel}, ` +
              `escalatedTo=${payload.escalatedTo}, reason=${payload.escalationReason}, ` +
              `elapsedSeconds=${payload.elapsedSeconds}${previousApproversText}${notesText}`
          )
        })
      )
    )

    // =========================================================================
    // ApprovalCompleted — Log completion with final status
    // =========================================================================
    .handle('ApprovalCompleted', ({ payload }) =>
      catchHandlerError(
        'ApprovalCompleted',
        Effect.gen(function* () {
          const approversText = payload.approvers.length > 0
            ? ` approvers=[${payload.approvers.join(',')}]`
            : ''
          const notesText = Option.isSome(payload.notes)
            ? ` notes="${payload.notes.value.slice(0, 50)}..."`
            : ''

          yield* Effect.log(
            `[ApprovalEventHandler] Approval completed: requestId=${payload.approvalRequestId}, ` +
              `finalStatus=${payload.finalStatus}, ` +
              `levelsCompleted=${payload.totalLevelsCompleted}/${payload.totalLevelsRequired}, ` +
              `durationSeconds=${payload.totalDurationSeconds}${approversText}${notesText}`
          )
        })
      )
    )

    // =========================================================================
    // ApprovalExpired — Log expiration with pending approvers
    // =========================================================================
    .handle('ApprovalExpired', ({ payload }) =>
      catchHandlerError(
        'ApprovalExpired',
        Effect.gen(function* () {
          const pendingText = payload.pendingApprovers.length > 0
            ? ` pendingApprovers=[${payload.pendingApprovers.join(',')}]`
            : ''
          const autoRenewText = payload.autoRenew ? ' (will auto-renew)' : ''
          const notesText = Option.isSome(payload.notes)
            ? ` notes="${payload.notes.value.slice(0, 50)}..."`
            : ''

          yield* Effect.log(
            `[ApprovalEventHandler] Approval expired: requestId=${payload.approvalRequestId}, ` +
              `expiredAt=${payload.expiredAt}, lastActiveLevel=${payload.lastActiveLevel}${pendingText}${autoRenewText}${notesText}`
          )
        })
      )
    )
)

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Layer type for ApprovalEventHandlers.
 * This layer provides handlers for all approval events in the ApprovalEvents group.
 */
export type ApprovalEventHandlersLayer = typeof ApprovalEventHandlers
