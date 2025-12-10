/**
 * Asset Entity Handlers
 *
 * Effect Cluster handlers for asset entity operations.
 * Uses AssetState service via DI - swap implementations for test/prod.
 * Emits domain events via EventLog for event sourcing.
 *
 * @module @gbg/tmnl/ams/v2/base/handlers/asset
 */

import { DateTime, Effect, Layer, Option, Schedule } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { AssetEntity } from '../entities/asset'
import { AssetState } from '../services/asset-state'
import { AmsEventLogSchema } from '../events/schema'
import {
  AssetCreatedPayload,
  AssetUpdatedPayload,
  AssetMovedPayload,
  PropertyChangedPayload,
  PropertyRemovedPayload,
  TraitAddedPayload,
  TraitRemovedPayload,
  AssetDeletedPayload,
} from '../events/asset'
import type { CreatedAt } from '../../core/schemas/timestamps'

// Re-export entity for convenience
export { AssetEntity } from '../entities/asset'

// ─────────────────────────────────────────────────────────────────────────────
// Handler Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset Entity Handlers
 *
 * Handlers yield AssetState via DI, enabling:
 * - Test: In-memory AssetState.Default
 * - Prod: SQL-backed AssetState implementation
 *
 * Event emission is optional - if EventLog is provided, events are emitted.
 * This allows simple tests without full EventLog setup.
 */
export const AssetEntityHandlers = AssetEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* AssetState

    // Try to get EventLog client - optional dependency
    const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
    const writeEvent = Option.isSome(eventLogOption)
      ? yield* EventLog.makeClient(AmsEventLogSchema)
      : null

    // Helper to emit event if EventLog is available
    const maybeEmit = <T>(
      tag: Parameters<NonNullable<typeof writeEvent>>[0],
      payload: Parameters<NonNullable<typeof writeEvent>>[1]
    ) =>
      writeEvent
        ? writeEvent(tag, payload).pipe(Effect.catchAll(() => Effect.void))
        : Effect.void

    return {
      // ─────────────────────────────────────────────────────────────────────────
      // Command Handlers (with event emission)
      // ─────────────────────────────────────────────────────────────────────────

      CreateAsset: (envelope) =>
        Effect.gen(function* () {
          const asset = yield* state.create({
            siteId: envelope.payload.siteId,
            kind: envelope.payload.kind,
            label: envelope.payload.label,
            description: envelope.payload.description,
            status: envelope.payload.status,
            sectorId: envelope.payload.sectorId,
            containerId: envelope.payload.containerId,
            baseProperties: envelope.payload.baseProperties,
            tags: envelope.payload.tags,
            createdBy: envelope.payload.createdBy,
          })

          // Emit AssetCreated event (use envelope payload for identity info)
          yield* maybeEmit(
            'AssetCreated',
            new AssetCreatedPayload({
              assetId: asset.id,
              siteId: asset.siteId,
              sectorId: asset.sectorId,
              containerId: asset.containerId,
              kind: asset.kind,
              label: asset.label,
              description: asset.description,
              status: asset.status,
              tags: asset.tags,
              createdBy: envelope.payload.createdBy,
              createdAt: asset.createdAt,
            })
          )

          return asset
        }),

      UpdateAsset: (envelope) =>
        Effect.gen(function* () {
          // Get asset before update for diff
          const before = yield* state.findById(envelope.payload.assetId)

          const asset = yield* state.update({
            assetId: envelope.payload.assetId,
            label: envelope.payload.label,
            description: envelope.payload.description,
            status: envelope.payload.status,
            tags: envelope.payload.tags,
            expectedVersion: envelope.payload.expectedVersion,
            updatedBy: envelope.payload.updatedBy,
          })

          // Emit AssetUpdated event
          yield* maybeEmit(
            'AssetUpdated',
            new AssetUpdatedPayload({
              assetId: asset.id,
              previousLabel: before.label !== asset.label ? before.label : undefined,
              newLabel: before.label !== asset.label ? asset.label : undefined,
              previousDescription:
                before.description !== asset.description ? before.description : undefined,
              newDescription:
                before.description !== asset.description ? asset.description : undefined,
              previousStatus: before.status !== asset.status ? before.status : undefined,
              newStatus: before.status !== asset.status ? asset.status : undefined,
              previousTags:
                JSON.stringify(before.tags) !== JSON.stringify(asset.tags) ? before.tags : undefined,
              newTags:
                JSON.stringify(before.tags) !== JSON.stringify(asset.tags) ? asset.tags : undefined,
              updatedBy: envelope.payload.updatedBy,
              updatedAt: DateTime.unsafeNow() as CreatedAt,
              // version not available from Asset - tracked internally by AssetState
            })
          )

          return asset
        }),

      MoveAsset: (envelope) =>
        Effect.gen(function* () {
          // Get asset before move
          const before = yield* state.findById(envelope.payload.assetId)

          const result = yield* state.move({
            assetId: envelope.payload.assetId,
            toSiteId: envelope.payload.toSiteId,
            toSectorId: envelope.payload.toSectorId,
            toContainerId: envelope.payload.toContainerId,
            reason: envelope.payload.reason,
            movedBy: envelope.payload.movedBy,
          })

          // Emit AssetMoved event
          yield* maybeEmit(
            'AssetMoved',
            new AssetMovedPayload({
              assetId: envelope.payload.assetId,
              fromSiteId: before.siteId,
              fromSectorId: before.sectorId,
              fromContainerId: before.containerId,
              toSiteId: envelope.payload.toSiteId,
              toSectorId: envelope.payload.toSectorId,
              toContainerId: envelope.payload.toContainerId,
              reason: envelope.payload.reason,
              movedBy: envelope.payload.movedBy,
              movedAt: DateTime.unsafeNow() as CreatedAt,
            })
          )

          return result
        }),

      SetAssetProperty: (envelope) =>
        Effect.gen(function* () {
          // Get previous value if exists
          const prevValue = yield* state
            .getProperty({
              assetId: envelope.payload.assetId,
              key: envelope.payload.key,
            })
            .pipe(Effect.option)

          const result = yield* state.setProperty({
            assetId: envelope.payload.assetId,
            key: envelope.payload.key,
            value: envelope.payload.value,
            provenance: envelope.payload.provenance,
            changedBy: envelope.payload.changedBy,
          })

          // Emit PropertyChanged event
          yield* maybeEmit(
            'PropertyChanged',
            new PropertyChangedPayload({
              assetId: envelope.payload.assetId,
              key: envelope.payload.key,
              previousValue: Option.isSome(prevValue) ? prevValue.value.value : null,
              newValue: envelope.payload.value,
              provenance: envelope.payload.provenance,
              changedBy: envelope.payload.changedBy,
              changedAt: DateTime.unsafeNow() as CreatedAt,
            })
          )

          return result
        }),

      RemoveAssetProperty: (envelope) =>
        Effect.gen(function* () {
          // Get current value before removal
          const current = yield* state.getProperty({
            assetId: envelope.payload.assetId,
            key: envelope.payload.key,
          })

          const result = yield* state.removeProperty({
            assetId: envelope.payload.assetId,
            key: envelope.payload.key,
            reason: envelope.payload.reason,
            removedBy: envelope.payload.removedBy,
          })

          // Emit PropertyRemoved event
          yield* maybeEmit(
            'PropertyRemoved',
            new PropertyRemovedPayload({
              assetId: envelope.payload.assetId,
              key: envelope.payload.key,
              removedValue: current.value,
              reason: envelope.payload.reason,
              removedBy: envelope.payload.removedBy,
              removedAt: DateTime.unsafeNow() as CreatedAt,
            })
          )

          return result
        }),

      AddAssetTrait: (envelope) =>
        Effect.gen(function* () {
          const result = yield* state.addTrait({
            assetId: envelope.payload.assetId,
            traitId: envelope.payload.traitId,
            config: envelope.payload.config,
            addedBy: envelope.payload.addedBy,
          })

          // Emit TraitAdded event
          yield* maybeEmit(
            'TraitAdded',
            new TraitAddedPayload({
              assetId: envelope.payload.assetId,
              traitId: envelope.payload.traitId,
              config: envelope.payload.config,
              addedBy: envelope.payload.addedBy,
              addedAt: DateTime.unsafeNow() as CreatedAt,
            })
          )

          return result
        }),

      RemoveAssetTrait: (envelope) =>
        Effect.gen(function* () {
          const result = yield* state.removeTrait({
            assetId: envelope.payload.assetId,
            traitId: envelope.payload.traitId,
            reason: envelope.payload.reason,
            removedBy: envelope.payload.removedBy,
          })

          // Emit TraitRemoved event
          yield* maybeEmit(
            'TraitRemoved',
            new TraitRemovedPayload({
              assetId: envelope.payload.assetId,
              traitId: envelope.payload.traitId,
              reason: envelope.payload.reason,
              removedBy: envelope.payload.removedBy,
              removedAt: DateTime.unsafeNow() as CreatedAt,
            })
          )

          return result
        }),

      DeleteAsset: (envelope) =>
        Effect.gen(function* () {
          const hardDelete = envelope.payload.hardDelete ?? false

          const result = yield* state.delete({
            assetId: envelope.payload.assetId,
            hardDelete,
            reason: envelope.payload.reason,
            deletedBy: envelope.payload.deletedBy,
          })

          // Emit AssetDeleted event
          yield* maybeEmit(
            'AssetDeleted',
            new AssetDeletedPayload({
              assetId: envelope.payload.assetId,
              reason: envelope.payload.reason,
              hardDelete,
              deletedBy: envelope.payload.deletedBy,
              deletedAt: DateTime.unsafeNow() as CreatedAt,
            })
          )

          return result
        }),

      // ─────────────────────────────────────────────────────────────────────────
      // Query Handlers (no event emission)
      // ─────────────────────────────────────────────────────────────────────────

      GetAsset: (envelope) => state.findById(envelope.payload.assetId),

      GetAssetSummary: (envelope) => state.findSummaryById(envelope.payload.assetId),

      AssetExists: (envelope) => state.exists(envelope.payload.assetId),

      ListAssetsBySite: (envelope) =>
        state.listBySite({
          siteId: envelope.payload.siteId,
          limit: envelope.payload.limit,
          cursor: envelope.payload.cursor,
        }),

      ListAssetsBySector: (envelope) =>
        state.listBySector({
          sectorId: envelope.payload.sectorId,
          limit: envelope.payload.limit,
          cursor: envelope.payload.cursor,
        }),

      ListAssetsByContainer: (envelope) =>
        state.listByContainer({
          containerId: envelope.payload.containerId,
          limit: envelope.payload.limit,
          cursor: envelope.payload.cursor,
        }),

      SearchAssets: (envelope) =>
        state.search({
          query: envelope.payload.query,
          siteId: envelope.payload.siteId,
          sectorId: envelope.payload.sectorId,
          containerId: envelope.payload.containerId,
          kind: envelope.payload.kind,
          status: envelope.payload.status,
          tags: envelope.payload.tags,
          limit: envelope.payload.limit,
          cursor: envelope.payload.cursor,
        }),

      GetAssetProperty: (envelope) =>
        state.getProperty({
          assetId: envelope.payload.assetId,
          key: envelope.payload.key,
        }),

      GetAssetProperties: (envelope) =>
        state.getProperties({ assetId: envelope.payload.assetId }),

      CountAssetsBySite: (envelope) => state.countBySite(envelope.payload.siteId),

      CountAssetsByStatus: (envelope) => state.countByStatus(envelope.payload.status),

      CountAssetsByKind: (envelope) => state.countByKind(envelope.payload.kind),
    }
  }),
  { defectRetryPolicy: Schedule.exponential('100 millis', 2).pipe(Schedule.upTo('10 seconds')) }
)

/**
 * Asset Entity Layer (Test)
 *
 * Uses in-memory AssetState for fast testing.
 */
export const AssetEntityLayer = AssetEntityHandlers.pipe(
  Layer.provide(AssetState.Default)
)
