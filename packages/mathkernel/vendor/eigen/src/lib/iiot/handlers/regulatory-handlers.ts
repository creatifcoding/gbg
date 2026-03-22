/**
 * Regulatory Event Handlers — Compliance Audit Trail Projections
 *
 * Handles regulatory compliance events for:
 * - FDA 21 CFR Part 11 (Batch Events with electronic signatures)
 * - ISO 9001 (Quality Events with NCR/CAPA tracking)
 * - General Audit (Operator Events with session tracking)
 *
 * These handlers primarily log for observability and audit compliance.
 * Unlike AlarmEventHandlers, these do not project into a read model repository
 * as the EventLog itself serves as the immutable audit trail.
 *
 * IMPORTANT: EventLog.group handlers must return Effect<void, never, R>.
 * All errors must be caught and logged, never propagated.
 *
 * @module @gbg/tmnl/iiot/handlers/regulatory-handlers
 * @see @effect/experimental/EventLog for EventLog.group API
 * @see FDA 21 CFR Part 11 for electronic records compliance
 * @see ISO 9001:2015 for quality management systems
 */

import { Effect, Option, Cause } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { BatchEvents, QualityEvents, OperatorEvents } from '../schemas/events/groups'

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
      Effect.log(`[RegulatoryEventHandler] ${handlerName} failed: ${Cause.pretty(cause)}`)
    ),
    Effect.asVoid
  )

// =============================================================================
// Batch Event Handlers (FDA 21 CFR Part 11)
// =============================================================================

/**
 * BatchEventHandlers — FDA 21 CFR Part 11 Compliance Audit Trail
 *
 * Handles batch record events for regulatory compliance:
 * - BatchStarted: Logs batch initiation with electronic signature
 * - ParameterRecorded: Logs critical process parameter recording
 * - BatchCompleted: Logs batch completion with yield data
 * - BatchDeviation: Logs deviations with severity and corrective actions
 *
 * All events include electronic signatures per FDA 21 CFR Part 11.
 * The EventLog serves as the immutable audit trail.
 *
 * @example
 * ```typescript
 * import { BatchEventHandlers } from './regulatory-handlers'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   BatchEventHandlers,
 * )
 * ```
 */
export const BatchEventHandlers = EventLog.group(BatchEvents, (handlers) =>
  handlers
    // =========================================================================
    // BatchStarted — Batch production initiated
    // =========================================================================
    .handle('BatchStarted', ({ payload }) =>
      catchHandlerError(
        'BatchStarted',
        Effect.gen(function* () {
          yield* Effect.log(
            `[AUDIT:FDA-21-CFR-11] Batch started: ${payload.batchId} ` +
            `| Product: ${payload.productCode} ` +
            `| Lot: ${payload.lotNumber} ` +
            `| Planned qty: ${payload.plannedQuantity} ` +
            `| Started by: ${payload.startedBy} ` +
            `| Signed by: ${payload.electronicSignature.signedBy} ` +
            `| Signature meaning: ${payload.electronicSignature.signatureMeaning} ` +
            `| Audit trail: ${payload.auditTrailId}`
          )
        })
      )
    )

    // =========================================================================
    // ParameterRecorded — Critical process parameter recorded
    // =========================================================================
    .handle('ParameterRecorded', ({ payload }) =>
      catchHandlerError(
        'ParameterRecorded',
        Effect.gen(function* () {
          const specStatus = payload.withinSpec ? 'WITHIN SPEC' : 'OUT OF SPEC'
          yield* Effect.log(
            `[AUDIT:FDA-21-CFR-11] Parameter recorded: ${payload.parameterId} ` +
            `| Batch: ${payload.batchId} ` +
            `| Parameter: ${payload.parameterName} ` +
            `| Value: ${payload.value} ${payload.unit} ` +
            `| Status: ${specStatus} ` +
            `| Recorded by: ${payload.recordedBy} ` +
            `| Signed by: ${payload.electronicSignature.signedBy} ` +
            `| Audit trail: ${payload.auditTrailId}`
          )
        })
      )
    )

    // =========================================================================
    // BatchCompleted — Batch production completed
    // =========================================================================
    .handle('BatchCompleted', ({ payload }) =>
      catchHandlerError(
        'BatchCompleted',
        Effect.gen(function* () {
          yield* Effect.log(
            `[AUDIT:FDA-21-CFR-11] Batch completed: ${payload.batchId} ` +
            `| Actual qty: ${payload.actualQuantity} ` +
            `| Yield: ${payload.yieldPercentage.toFixed(2)}% ` +
            `| Completed by: ${payload.completedBy} ` +
            `| Signed by: ${payload.electronicSignature.signedBy} ` +
            `| Signature meaning: ${payload.electronicSignature.signatureMeaning} ` +
            `| Audit trail: ${payload.auditTrailId}`
          )
        })
      )
    )

    // =========================================================================
    // BatchDeviation — Deviation from batch record detected
    // =========================================================================
    .handle('BatchDeviation', ({ payload }) =>
      catchHandlerError(
        'BatchDeviation',
        Effect.gen(function* () {
          const correctiveAction = Option.isSome(payload.correctiveAction)
            ? payload.correctiveAction.value
            : 'None documented'

          yield* Effect.log(
            `[AUDIT:FDA-21-CFR-11] DEVIATION DETECTED: ${payload.deviationId} ` +
            `| Batch: ${payload.batchId} ` +
            `| Type: ${payload.deviationType} ` +
            `| Severity: ${payload.severity.toUpperCase()} ` +
            `| Description: ${payload.description} ` +
            `| Detected by: ${payload.detectedBy} ` +
            `| Corrective action: ${correctiveAction} ` +
            `| Signed by: ${payload.electronicSignature.signedBy} ` +
            `| Audit trail: ${payload.auditTrailId}`
          )
        })
      )
    )
)

// =============================================================================
// Quality Event Handlers (ISO 9001)
// =============================================================================

/**
 * QualityEventHandlers — ISO 9001 Quality Management Audit Trail
 *
 * Handles quality management events for regulatory compliance:
 * - InspectionCompleted: Logs inspection results with pass/fail status
 * - NCROpened: Logs non-conformance reports with severity
 * - NCRClosed: Logs NCR resolution with root cause analysis
 * - CAPACreated: Logs corrective/preventive actions
 * - CAPAResolved: Logs CAPA completion with effectiveness rating
 *
 * Supports the ISO 9001 quality loop: Inspection -> NCR -> CAPA -> Resolution
 *
 * @example
 * ```typescript
 * import { QualityEventHandlers } from './regulatory-handlers'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   QualityEventHandlers,
 * )
 * ```
 */
export const QualityEventHandlers = EventLog.group(QualityEvents, (handlers) =>
  handlers
    // =========================================================================
    // InspectionCompleted — Quality inspection completed
    // =========================================================================
    .handle('InspectionCompleted', ({ payload }) =>
      catchHandlerError(
        'InspectionCompleted',
        Effect.gen(function* () {
          const resultIcon = payload.result === 'pass' ? 'PASS' :
                            payload.result === 'fail' ? 'FAIL' : 'CONDITIONAL'
          yield* Effect.log(
            `[AUDIT:ISO-9001] Inspection completed: ${payload.inspectionId} ` +
            `| Item: ${payload.itemId} ` +
            `| Result: ${resultIcon} ` +
            `| Criteria: ${payload.criteria.join(', ')} ` +
            `| Inspector: ${payload.inspectorId}`
          )
        })
      )
    )

    // =========================================================================
    // NCROpened — Non-Conformance Report opened
    // =========================================================================
    .handle('NCROpened', ({ payload }) =>
      catchHandlerError(
        'NCROpened',
        Effect.gen(function* () {
          yield* Effect.log(
            `[AUDIT:ISO-9001] NCR OPENED: ${payload.ncrId} ` +
            `| Title: ${payload.title} ` +
            `| Severity: ${payload.severity.toUpperCase()} ` +
            `| Affected items: ${payload.affectedItems.join(', ')} ` +
            `| Description: ${payload.description} ` +
            `| Detected by: ${payload.detectedBy}`
          )
        })
      )
    )

    // =========================================================================
    // NCRClosed — NCR resolved and closed
    // =========================================================================
    .handle('NCRClosed', ({ payload }) =>
      catchHandlerError(
        'NCRClosed',
        Effect.gen(function* () {
          const linkedCapa = Option.isSome(payload.linkedCAPAId)
            ? `CAPA: ${payload.linkedCAPAId.value}`
            : 'No CAPA linked'

          yield* Effect.log(
            `[AUDIT:ISO-9001] NCR CLOSED: ${payload.ncrId} ` +
            `| Resolution: ${payload.resolution} ` +
            `| Root cause: ${payload.rootCause} ` +
            `| ${linkedCapa} ` +
            `| Closed by: ${payload.closedBy}`
          )
        })
      )
    )

    // =========================================================================
    // CAPACreated — Corrective/Preventive Action created
    // =========================================================================
    .handle('CAPACreated', ({ payload }) =>
      catchHandlerError(
        'CAPACreated',
        Effect.gen(function* () {
          yield* Effect.log(
            `[AUDIT:ISO-9001] CAPA CREATED: ${payload.capaId} ` +
            `| Type: ${payload.type.toUpperCase()} ` +
            `| Title: ${payload.title} ` +
            `| Description: ${payload.description} ` +
            `| Linked NCRs: ${payload.linkedNCRIds.join(', ')} ` +
            `| Assigned to: ${payload.assignedTo}`
          )
        })
      )
    )

    // =========================================================================
    // CAPAResolved — CAPA completed and verified
    // =========================================================================
    .handle('CAPAResolved', ({ payload }) =>
      catchHandlerError(
        'CAPAResolved',
        Effect.gen(function* () {
          const effectivenessLabel = payload.effectivenessRating === 'effective' ? 'EFFECTIVE' :
                                     payload.effectivenessRating === 'partially_effective' ? 'PARTIALLY EFFECTIVE' :
                                     'INEFFECTIVE'
          yield* Effect.log(
            `[AUDIT:ISO-9001] CAPA RESOLVED: ${payload.capaId} ` +
            `| Resolution: ${payload.resolution} ` +
            `| Verification: ${payload.verificationMethod} ` +
            `| Effectiveness: ${effectivenessLabel} ` +
            `| Resolved by: ${payload.resolvedBy}`
          )
        })
      )
    )
)

// =============================================================================
// Operator Event Handlers (General Audit)
// =============================================================================

/**
 * OperatorEventHandlers — Regulatory Compliance Operator Audit Trail
 *
 * Handles operator interaction events for audit compliance:
 * - OperatorLogin: Logs operator authentication
 * - OperatorLogout: Logs session termination
 * - ParameterOverride: Logs manual parameter changes with justification
 * - ManualAcknowledgment: Logs operator acknowledgments
 * - ShiftHandoff: Logs shift transitions with notes
 *
 * Critical for FDA 21 CFR Part 11 electronic signature compliance.
 *
 * @example
 * ```typescript
 * import { OperatorEventHandlers } from './regulatory-handlers'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   OperatorEventHandlers,
 * )
 * ```
 */
export const OperatorEventHandlers = EventLog.group(OperatorEvents, (handlers) =>
  handlers
    // =========================================================================
    // OperatorLogin — Operator logged into system
    // =========================================================================
    .handle('OperatorLogin', ({ payload }) =>
      catchHandlerError(
        'OperatorLogin',
        Effect.gen(function* () {
          yield* Effect.log(
            `[AUDIT:OPERATOR] Login: ${payload.sessionId} ` +
            `| Operator: ${payload.operatorId} ` +
            `| Workstation: ${payload.workstation} ` +
            `| Auth method: ${payload.authMethod}`
          )
        })
      )
    )

    // =========================================================================
    // OperatorLogout — Operator logged out of system
    // =========================================================================
    .handle('OperatorLogout', ({ payload }) =>
      catchHandlerError(
        'OperatorLogout',
        Effect.gen(function* () {
          yield* Effect.log(
            `[AUDIT:OPERATOR] Logout: ${payload.sessionId} ` +
            `| Operator: ${payload.operatorId} ` +
            `| Reason: ${payload.reason}`
          )
        })
      )
    )

    // =========================================================================
    // ParameterOverride — Operator manually overrode a parameter
    // =========================================================================
    .handle('ParameterOverride', ({ payload }) =>
      catchHandlerError(
        'ParameterOverride',
        Effect.gen(function* () {
          const approver = Option.isSome(payload.approvedBy)
            ? `Approved by: ${payload.approvedBy.value}`
            : 'No approval required'

          yield* Effect.log(
            `[AUDIT:OPERATOR] PARAMETER OVERRIDE: ${payload.overrideId} ` +
            `| Parameter: ${payload.parameterId} ` +
            `| Previous: ${payload.previousValue} ` +
            `| New: ${payload.newValue} ` +
            `| Reason: ${payload.reason} ` +
            `| Operator: ${payload.operatorId} ` +
            `| ${approver}`
          )
        })
      )
    )

    // =========================================================================
    // ManualAcknowledgment — Operator acknowledged a condition/alarm
    // =========================================================================
    .handle('ManualAcknowledgment', ({ payload }) =>
      catchHandlerError(
        'ManualAcknowledgment',
        Effect.gen(function* () {
          const comment = Option.isSome(payload.comment)
            ? `Comment: ${payload.comment.value}`
            : 'No comment'

          yield* Effect.log(
            `[AUDIT:OPERATOR] Acknowledgment: ${payload.acknowledgmentId} ` +
            `| Target: ${payload.targetType}:${payload.targetId} ` +
            `| Operator: ${payload.operatorId} ` +
            `| ${comment}`
          )
        })
      )
    )

    // =========================================================================
    // ShiftHandoff — Shift handoff between operators
    // =========================================================================
    .handle('ShiftHandoff', ({ payload }) =>
      catchHandlerError(
        'ShiftHandoff',
        Effect.gen(function* () {
          const notes = Option.isSome(payload.notes)
            ? `Notes: ${payload.notes.value}`
            : 'No notes'
          const openItems = payload.openItems.length > 0
            ? `Open items: ${payload.openItems.join('; ')}`
            : 'No open items'

          yield* Effect.log(
            `[AUDIT:OPERATOR] SHIFT HANDOFF: ${payload.handoffId} ` +
            `| Outgoing: ${payload.outgoingOperatorId} ` +
            `| Incoming: ${payload.incomingOperatorId} ` +
            `| ${notes} ` +
            `| ${openItems}`
          )
        })
      )
    )
)

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Layer type for BatchEventHandlers.
 * This layer provides handlers for all batch events in the BatchEvents group.
 */
export type BatchEventHandlersLayer = typeof BatchEventHandlers

/**
 * Layer type for QualityEventHandlers.
 * This layer provides handlers for all quality events in the QualityEvents group.
 */
export type QualityEventHandlersLayer = typeof QualityEventHandlers

/**
 * Layer type for OperatorEventHandlers.
 * This layer provides handlers for all operator events in the OperatorEvents group.
 */
export type OperatorEventHandlersLayer = typeof OperatorEventHandlers
