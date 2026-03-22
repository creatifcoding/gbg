/**
 * Context Event Handlers — Projections for Work Order Context Management
 *
 * Handles ContextEvents by logging audit trail for ISA-95 Level 3 operations.
 * These handlers are logging-only - the EventLog itself serves as the
 * immutable audit trail for operational context changes.
 *
 * IMPORTANT: EventLog.group handlers must return Effect<void, never, R>.
 * All errors must be caught and logged, never propagated.
 *
 * @module @gbg/tmnl/iiot/handlers/context-handlers
 * @see @effect/experimental/EventLog for EventLog.group API
 * @see ISA-95/IEC 62264 for operations management standard
 */

import { Effect, Option, Cause } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { ContextEvents } from '../schemas/events/groups'

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
      Effect.log(`[ContextEventHandler] ${handlerName} failed: ${Cause.pretty(cause)}`)
    ),
    Effect.asVoid
  )

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * ContextEventHandlers — Audit Trail for Work Order Context
 *
 * Each handler logs the context operation for audit trail purposes.
 * The EventLog entry is the source of truth - handlers provide observability.
 *
 * @example
 * ```typescript
 * import { ContextEventHandlers } from './context-handlers'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   ContextEventHandlers,
 * )
 * ```
 */
export const ContextEventHandlers = EventLog.group(ContextEvents, (handlers) =>
  handlers
    // =========================================================================
    // ContextCreated — Log context creation with work order association
    // =========================================================================
    .handle('ContextCreated', ({ payload }) =>
      catchHandlerError(
        'ContextCreated',
        Effect.gen(function* () {
          const assetCount = payload.initialAssets.length

          yield* Effect.log(
            `[ContextEventHandler] Context created: contextId=${payload.contextId}, ` +
              `workOrderId=${payload.workOrderId}, initialAssets=${assetCount}`
          )
        })
      )
    )

    // =========================================================================
    // ContextUpdated — Log field updates with before/after summary
    // =========================================================================
    .handle('ContextUpdated', ({ payload }) =>
      catchHandlerError(
        'ContextUpdated',
        Effect.gen(function* () {
          const prevSummary = Option.isSome(payload.previousValue)
            ? JSON.stringify(payload.previousValue.value).slice(0, 50)
            : '<none>'
          const newSummary = JSON.stringify(payload.newValue).slice(0, 50)
          const reasonText = Option.isSome(payload.reason)
            ? ` reason=${payload.reason.value}`
            : ''

          yield* Effect.log(
            `[ContextEventHandler] Context updated: contextId=${payload.contextId}, ` +
              `field=${payload.fieldName}, previous=${prevSummary}, new=${newSummary}${reasonText}`
          )
        })
      )
    )

    // =========================================================================
    // ContextSnapshotted — Log snapshot creation with reason
    // =========================================================================
    .handle('ContextSnapshotted', ({ payload }) =>
      catchHandlerError(
        'ContextSnapshotted',
        Effect.gen(function* () {
          const notesText = Option.isSome(payload.notes)
            ? ` notes=${payload.notes.value}`
            : ''

          yield* Effect.log(
            `[ContextEventHandler] Context snapshotted: contextId=${payload.contextId}, ` +
              `snapshotId=${payload.snapshotId}, reason=${payload.snapshotReason}${notesText}`
          )
        })
      )
    )

    // =========================================================================
    // AssetAttached — Log asset attachment with role
    // =========================================================================
    .handle('AssetAttached', ({ payload }) =>
      catchHandlerError(
        'AssetAttached',
        Effect.gen(function* () {
          const notesText = Option.isSome(payload.notes)
            ? ` notes=${payload.notes.value}`
            : ''

          yield* Effect.log(
            `[ContextEventHandler] Asset attached: contextId=${payload.contextId}, ` +
              `assetId=${payload.attachedAssetId}, role=${payload.assetRole}${notesText}`
          )
        })
      )
    )

    // =========================================================================
    // AssetDetached — Log asset detachment with reason
    // =========================================================================
    .handle('AssetDetached', ({ payload }) =>
      catchHandlerError(
        'AssetDetached',
        Effect.gen(function* () {
          const notesText = Option.isSome(payload.notes)
            ? ` notes=${payload.notes.value}`
            : ''

          yield* Effect.log(
            `[ContextEventHandler] Asset detached: contextId=${payload.contextId}, ` +
              `assetId=${payload.detachedAssetId}, reason=${payload.reason}${notesText}`
          )
        })
      )
    )

    // =========================================================================
    // ResourceAllocated — Log resource allocation details
    // =========================================================================
    .handle('ResourceAllocated', ({ payload }) =>
      catchHandlerError(
        'ResourceAllocated',
        Effect.gen(function* () {
          const quantityText = Option.isSome(payload.quantity)
            ? ` quantity=${payload.quantity.value}`
            : ''
          const unitText = Option.isSome(payload.unit)
            ? payload.unit.value
            : ''

          yield* Effect.log(
            `[ContextEventHandler] Resource allocated: contextId=${payload.contextId}, ` +
              `resourceId=${payload.resourceId}, type=${payload.resourceType}, ` +
              `name=${payload.resourceName}${quantityText}${unitText}, allocatedBy=${payload.allocatedBy}`
          )
        })
      )
    )

    // =========================================================================
    // ResourceReleased — Log resource release with reason
    // =========================================================================
    .handle('ResourceReleased', ({ payload }) =>
      catchHandlerError(
        'ResourceReleased',
        Effect.gen(function* () {
          const quantityText = Option.isSome(payload.quantityReturned)
            ? ` quantityReturned=${payload.quantityReturned.value}`
            : ''
          const conditionText = Option.isSome(payload.conditionNotes)
            ? ` condition=${payload.conditionNotes.value}`
            : ''

          yield* Effect.log(
            `[ContextEventHandler] Resource released: contextId=${payload.contextId}, ` +
              `resourceId=${payload.resourceId}, reason=${payload.releaseReason}, ` +
              `releasedBy=${payload.releasedBy}${quantityText}${conditionText}`
          )
        })
      )
    )

    // =========================================================================
    // ExternalRefLinked — Log external system reference linking
    // =========================================================================
    .handle('ExternalRefLinked', ({ payload }) =>
      catchHandlerError(
        'ExternalRefLinked',
        Effect.gen(function* () {
          const urlText = Option.isSome(payload.linkUrl)
            ? ` url=${payload.linkUrl.value}`
            : ''

          yield* Effect.log(
            `[ContextEventHandler] External ref linked: contextId=${payload.contextId}, ` +
              `refId=${payload.externalRefId}, system=${payload.externalSystem}, ` +
              `type=${payload.externalType}, externalId=${payload.externalIdentifier}${urlText}`
          )
        })
      )
    )

    // =========================================================================
    // ExternalRefUnlinked — Log external reference unlinking
    // =========================================================================
    .handle('ExternalRefUnlinked', ({ payload }) =>
      catchHandlerError(
        'ExternalRefUnlinked',
        Effect.gen(function* () {
          const notesText = Option.isSome(payload.notes)
            ? ` notes=${payload.notes.value}`
            : ''

          yield* Effect.log(
            `[ContextEventHandler] External ref unlinked: contextId=${payload.contextId}, ` +
              `refId=${payload.externalRefId}, reason=${payload.reason}${notesText}`
          )
        })
      )
    )

    // =========================================================================
    // ChildWorkOrderSpawned — Log child work order creation
    // =========================================================================
    .handle('ChildWorkOrderSpawned', ({ payload }) =>
      catchHandlerError(
        'ChildWorkOrderSpawned',
        Effect.gen(function* () {
          const inheritAssets = payload.inheritAssets ?? false
          const inheritResources = payload.inheritResources ?? false

          yield* Effect.log(
            `[ContextEventHandler] Child work order spawned: parentContextId=${payload.contextId}, ` +
              `childWorkOrderId=${payload.childWorkOrderId}, type=${payload.childType}, ` +
              `reason=${payload.reason}, inheritAssets=${inheritAssets}, inheritResources=${inheritResources}`
          )
        })
      )
    )
)

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Layer type for ContextEventHandlers.
 * This layer provides handlers for all context events in the ContextEvents group.
 */
export type ContextEventHandlersLayer = typeof ContextEventHandlers
