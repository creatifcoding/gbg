/**
 * Alarm Event Handlers — Projections for ISA-18.2 Alarm Lifecycle
 *
 * Handles AlarmEvents by projecting them into the read model (AlarmRepo).
 * These handlers run when events are written to the EventLog, maintaining
 * the denormalized alarm state in the database.
 *
 * IMPORTANT: EventLog.group handlers must return Effect<void, never, R>.
 * All errors must be caught and logged, never propagated.
 *
 * @module @gbg/tmnl/iiot/handlers/alarm-handlers
 * @see @effect/experimental/EventLog for EventLog.group API
 * @see ISA-18.2 for alarm management standard
 */

import { Effect, Option, Cause, DateTime } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { AlarmEvents } from '../schemas/events/groups'
import { AlarmRepo } from '../repos/AlarmRepo'

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
      Effect.log(`[AlarmEventHandler] ${handlerName} failed: ${Cause.pretty(cause)}`)
    ),
    Effect.asVoid
  )

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * AlarmEventHandlers — Projections for Alarm State
 *
 * Each handler receives the event payload and entry metadata, then
 * updates the read model (AlarmRepo) to reflect the new state.
 *
 * Handlers are idempotent by design:
 * - AlarmTriggered: Insert only if alarm doesn't exist
 * - State transitions: Update only if current state allows transition
 *
 * All handlers wrap operations in catchHandlerError to ensure errors
 * are logged but not propagated (EventLog requirement).
 *
 * @example
 * ```typescript
 * import { AlarmEventHandlers } from './alarm-handlers'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   AlarmEventHandlers,
 * )
 * ```
 */
export const AlarmEventHandlers = EventLog.group(AlarmEvents, (handlers) =>
  handlers
    // =========================================================================
    // AlarmTriggered — Create new alarm record
    // =========================================================================
    .handle('AlarmTriggered', ({ payload }) =>
      catchHandlerError(
        'AlarmTriggered',
        Effect.gen(function* () {
          const repo = yield* AlarmRepo

          // Insert alarm into read model with all required fields
          // AlarmModel.insert.Type requires Option types for optional fields
          yield* repo.insert({
            deviceId: payload.deviceId,
            alarmType: payload.alarmType,
            severity: payload.severity,
            message: payload.message,
            metadata: payload.metadata,
            // Use payload.occurredAt as the triggeredAt timestamp
            triggeredAt: DateTime.unsafeMake(payload.occurredAt),
            acknowledgedAt: Option.none(),
            acknowledgedBy: Option.none(),
            clearedAt: Option.none(),
          })

          yield* Effect.log(`[AlarmEventHandler] Alarm triggered: ${payload.alarmId}`)
        })
      )
    )

    // =========================================================================
    // AlarmAcknowledged — Update alarm state to acknowledged
    // =========================================================================
    .handle('AlarmAcknowledged', ({ payload }) =>
      catchHandlerError(
        'AlarmAcknowledged',
        Effect.gen(function* () {
          const repo = yield* AlarmRepo

          // Use the acknowledge method which is idempotent
          yield* repo.acknowledge(payload.alarmId, payload.acknowledgedBy)

          yield* Effect.log(`[AlarmEventHandler] Alarm acknowledged: ${payload.alarmId} by ${payload.acknowledgedBy}`)
        })
      )
    )

    // =========================================================================
    // AlarmCleared — Update alarm state to cleared
    // =========================================================================
    .handle('AlarmCleared', ({ payload }) =>
      catchHandlerError(
        'AlarmCleared',
        Effect.gen(function* () {
          const repo = yield* AlarmRepo

          // Use the clear method which is idempotent
          yield* repo.clear(payload.alarmId)

          yield* Effect.log(`[AlarmEventHandler] Alarm cleared: ${payload.alarmId}`)
        })
      )
    )

    // =========================================================================
    // AlarmEscalated — Log escalation (no state change in basic model)
    // =========================================================================
    .handle('AlarmEscalated', ({ payload }) =>
      catchHandlerError(
        'AlarmEscalated',
        Effect.gen(function* () {
          // Escalation is tracked in the event log, not the read model
          // This handler primarily logs for observability
          yield* Effect.log(
            `[AlarmEventHandler] Alarm escalated: ${payload.alarmId} to level ${payload.escalationLevel}, ` +
            `notifying ${payload.escalatedTo}`
          )
        })
      )
    )

    // =========================================================================
    // AlarmShelved — Update alarm metadata with shelve info
    // =========================================================================
    .handle('AlarmShelved', ({ payload }) =>
      catchHandlerError(
        'AlarmShelved',
        Effect.gen(function* () {
          const repo = yield* AlarmRepo

          // Get current alarm to preserve metadata
          const existing = yield* repo.findById(payload.alarmId)

          if (Option.isSome(existing)) {
            const alarm = existing.value
            const shelveMetadata = {
              ...(Option.isSome(alarm.metadata) ? alarm.metadata.value : {}),
              shelvedBy: payload.shelvedBy,
              shelvedUntil: DateTime.formatIso(payload.shelvedUntil),
              shelveReason: Option.getOrNull(payload.reason),
            }

            yield* repo.update({
              id: payload.alarmId,
              metadata: Option.some(shelveMetadata),
            })
          }

          yield* Effect.log(
            `[AlarmEventHandler] Alarm shelved: ${payload.alarmId} by ${payload.shelvedBy} until ${DateTime.formatIso(payload.shelvedUntil)}`
          )
        })
      )
    )

    // =========================================================================
    // AlarmUnshelved — Remove shelve metadata
    // =========================================================================
    .handle('AlarmUnshelved', ({ payload }) =>
      catchHandlerError(
        'AlarmUnshelved',
        Effect.gen(function* () {
          const repo = yield* AlarmRepo

          // Get current alarm to update metadata
          const existing = yield* repo.findById(payload.alarmId)

          if (Option.isSome(existing)) {
            const alarm = existing.value
            // Remove shelve-related metadata
            const currentMeta = Option.isSome(alarm.metadata) ? alarm.metadata.value : {}
            const { shelvedBy: _, shelvedUntil: __, shelveReason: ___, ...cleanMeta } = currentMeta as Record<string, unknown>

            yield* repo.update({
              id: payload.alarmId,
              metadata: Option.some(cleanMeta),
            })
          }

          yield* Effect.log(
            `[AlarmEventHandler] Alarm unshelved: ${payload.alarmId} (auto: ${Option.getOrElse(payload.autoUnshelve, () => true)})`
          )
        })
      )
    )

    // =========================================================================
    // AlarmSuppressed — Update alarm metadata with suppression info
    // =========================================================================
    .handle('AlarmSuppressed', ({ payload }) =>
      catchHandlerError(
        'AlarmSuppressed',
        Effect.gen(function* () {
          const repo = yield* AlarmRepo

          // Get current alarm to preserve metadata
          const existing = yield* repo.findById(payload.alarmId)

          if (Option.isSome(existing)) {
            const alarm = existing.value
            const suppressMetadata = {
              ...(Option.isSome(alarm.metadata) ? alarm.metadata.value : {}),
              suppressedBy: payload.suppressedBy,
              suppressReason: payload.reason,
              workOrderId: Option.getOrNull(payload.workOrderId),
            }

            yield* repo.update({
              id: payload.alarmId,
              metadata: Option.some(suppressMetadata),
            })
          }

          yield* Effect.log(
            `[AlarmEventHandler] Alarm suppressed: ${payload.alarmId} by ${payload.suppressedBy}`
          )
        })
      )
    )

    // =========================================================================
    // AlarmOutOfService — Mark alarm as out of service
    // =========================================================================
    .handle('AlarmOutOfService', ({ payload }) =>
      catchHandlerError(
        'AlarmOutOfService',
        Effect.gen(function* () {
          const repo = yield* AlarmRepo

          // Get current alarm to preserve metadata
          const existing = yield* repo.findById(payload.alarmId)

          if (Option.isSome(existing)) {
            const alarm = existing.value
            const oosMetadata = {
              ...(Option.isSome(alarm.metadata) ? alarm.metadata.value : {}),
              outOfService: true,
              disabledBy: payload.disabledBy,
              disabledReason: payload.reason,
              workOrderId: Option.getOrNull(payload.workOrderId),
              expectedReturnDate: Option.map(payload.expectedReturnDate, DateTime.formatIso).pipe(Option.getOrNull),
            }

            yield* repo.update({
              id: payload.alarmId,
              metadata: Option.some(oosMetadata),
            })
          }

          yield* Effect.log(
            `[AlarmEventHandler] Alarm out of service: ${payload.alarmId} by ${payload.disabledBy}`
          )
        })
      )
    )

    // =========================================================================
    // AlarmReturnedToService — Mark alarm as back in service
    // =========================================================================
    .handle('AlarmReturnedToService', ({ payload }) =>
      catchHandlerError(
        'AlarmReturnedToService',
        Effect.gen(function* () {
          const repo = yield* AlarmRepo

          // Get current alarm to update metadata
          const existing = yield* repo.findById(payload.alarmId)

          if (Option.isSome(existing)) {
            const alarm = existing.value
            // Remove OOS-related metadata
            const currentMeta = Option.isSome(alarm.metadata) ? alarm.metadata.value : {}
            const {
              outOfService: _,
              disabledBy: __,
              disabledReason: ___,
              expectedReturnDate: ____,
              ...cleanMeta
            } = currentMeta as Record<string, unknown>

            yield* repo.update({
              id: payload.alarmId,
              metadata: Option.some({
                ...cleanMeta,
                returnedToServiceBy: payload.returnedBy,
                returnedToServiceNotes: Option.getOrNull(payload.notes),
              }),
            })
          }

          yield* Effect.log(
            `[AlarmEventHandler] Alarm returned to service: ${payload.alarmId} by ${payload.returnedBy}`
          )
        })
      )
    )

    // =========================================================================
    // AlarmConfigChanged — Log configuration change (audit trail)
    // =========================================================================
    .handle('AlarmConfigChanged', ({ payload }) =>
      catchHandlerError(
        'AlarmConfigChanged',
        Effect.gen(function* () {
          // Configuration changes are tracked in the event log
          // The read model doesn't need to store config history
          // This is purely for observability/audit

          yield* Effect.log(
            `[AlarmEventHandler] Alarm config changed: ${payload.alarmId} by ${payload.changedBy}, ` +
            `changes: ${JSON.stringify(payload.changes)}`
          )
        })
      )
    )
)

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Layer type for AlarmEventHandlers.
 * This layer provides handlers for all alarm events in the AlarmEvents group.
 */
export type AlarmEventHandlersLayer = typeof AlarmEventHandlers
