/**
 * Asset Event Compaction
 *
 * EventLog.groupCompaction for creating snapshots from event streams.
 * Reduces storage by folding events into current state.
 *
 * @module @gbg/tmnl/ams/v2/base/handlers/compaction
 */

import { Effect } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { AssetEvents, AssetCreatedPayload, AssetUpdatedPayload, AssetMovedPayload } from '../events/asset'

// ─────────────────────────────────────────────────────────────────────────────
// Compaction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset Compaction Layer
 *
 * Folds asset events into a snapshot.
 * Called periodically or when event count exceeds threshold.
 *
 * Strategy:
 * - For each primaryKey (assetId), fold all events into final state
 * - Write a single AssetCreated event with current state
 * - Deleted assets write AssetDeleted snapshot
 */
export const AssetCompaction = EventLog.groupCompaction(
  AssetEvents,
  ({ primaryKey, events, write }) =>
    Effect.gen(function* () {
      // Track current state by folding events
      let currentState: {
        siteId?: string
        sectorId?: string
        containerId?: string
        kind?: string
        label?: string
        description?: string
        status?: string
        tags?: readonly string[]
        createdBy?: string
        createdAt?: unknown
        version: number
        deleted: boolean
        deletedBy?: string
        deletedAt?: unknown
        hardDelete?: boolean
      } = { version: 0, deleted: false }

      // Fold all events for this primaryKey
      for (const event of events) {
        switch (event._tag) {
          case 'AssetCreated': {
            const payload = event.payload as AssetCreatedPayload
            currentState = {
              ...currentState,
              siteId: payload.siteId,
              sectorId: payload.sectorId,
              containerId: payload.containerId,
              kind: payload.kind,
              label: payload.label,
              description: payload.description,
              status: payload.status,
              tags: payload.tags,
              createdBy: payload.createdBy,
              createdAt: payload.createdAt,
              version: 1,
            }
            break
          }
          case 'AssetUpdated': {
            const payload = event.payload as AssetUpdatedPayload
            currentState = {
              ...currentState,
              label: payload.newLabel ?? currentState.label,
              description: payload.newDescription ?? currentState.description,
              status: payload.newStatus ?? currentState.status,
              tags: payload.newTags ?? currentState.tags,
              version: payload.version,
            }
            break
          }
          case 'AssetMoved': {
            const payload = event.payload as AssetMovedPayload
            currentState = {
              ...currentState,
              siteId: payload.toSiteId,
              sectorId: payload.toSectorId,
              containerId: payload.toContainerId,
            }
            break
          }
          case 'AssetDeleted': {
            const payload = event.payload as { deletedBy: string; deletedAt: unknown; hardDelete: boolean }
            currentState = {
              ...currentState,
              deleted: true,
              deletedBy: payload.deletedBy,
              deletedAt: payload.deletedAt,
              hardDelete: payload.hardDelete,
            }
            break
          }
          // PropertyChanged, TraitAdded, TraitRemoved don't affect core asset state
          default:
            break
        }
      }

      // Write compacted snapshot
      if (currentState.deleted && currentState.hardDelete) {
        // Hard-deleted assets: write deletion marker only
        yield* write('AssetDeleted', {
          assetId: primaryKey,
          reason: 'compacted',
          hardDelete: true,
          deletedBy: currentState.deletedBy!,
          deletedAt: currentState.deletedAt!,
        } as any)
      } else if (currentState.siteId && currentState.kind && currentState.label) {
        // Active or soft-deleted assets: write full state snapshot
        yield* write('AssetCreated', {
          assetId: primaryKey,
          siteId: currentState.siteId,
          sectorId: currentState.sectorId,
          containerId: currentState.containerId,
          kind: currentState.kind,
          label: currentState.label,
          description: currentState.description,
          status: currentState.deleted ? 'retired' : currentState.status,
          tags: currentState.tags,
          createdBy: currentState.createdBy!,
          createdAt: currentState.createdAt!,
        } as any)
      }

      yield* Effect.log(`[Compaction] Compacted ${events.length} events for asset ${primaryKey}`)
    })
)
