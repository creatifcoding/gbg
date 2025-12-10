/**
 * Asset Event Handlers
 *
 * EventLog.group handlers that process events and update read models.
 * These handlers run when events are written to the journal.
 *
 * @module @gbg/tmnl/ams/v2/base/handlers/event-handlers
 */

import { Effect } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { AssetEvents } from '../events/asset'
import { AssetState } from '../services/asset-state'

// ─────────────────────────────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset Event Handlers Layer
 *
 * Processes asset events and updates the read model (AssetState).
 * Each handler receives { payload, entry, conflicts } and returns success/error.
 */
export const AssetEventHandlers = EventLog.group(AssetEvents, (handlers) =>
  Effect.gen(function* () {
    const state = yield* AssetState

    return handlers
      .handle('AssetCreated', ({ payload }) =>
        Effect.gen(function* () {
          // Event already reflects creation - state was updated by command handler
          // This handler can trigger side effects like notifications, indexing, etc.
          yield* Effect.log(`[EventLog] Asset created: ${payload.assetId}`)
          return void 0
        })
      )
      .handle('AssetUpdated', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(`[EventLog] Asset updated: ${payload.assetId} v${payload.version}`)
          return void 0
        })
      )
      .handle('AssetMoved', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(
            `[EventLog] Asset moved: ${payload.assetId} from ${payload.fromSiteId} to ${payload.toSiteId}`
          )
          return void 0
        })
      )
      .handle('PropertyChanged', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(
            `[EventLog] Property changed: ${payload.assetId}.${payload.key} = ${payload.newValue}`
          )
          return void 0
        })
      )
      .handle('PropertyRemoved', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(`[EventLog] Property removed: ${payload.assetId}.${payload.key}`)
          return void 0
        })
      )
      .handle('TraitAdded', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(`[EventLog] Trait added: ${payload.assetId} <- ${payload.traitId}`)
          return void 0
        })
      )
      .handle('TraitRemoved', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(`[EventLog] Trait removed: ${payload.assetId} x ${payload.traitId}`)
          return void 0
        })
      )
      .handle('AssetDeleted', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(
            `[EventLog] Asset deleted: ${payload.assetId} (hard=${payload.hardDelete})`
          )
          return void 0
        })
      )
  })
)
