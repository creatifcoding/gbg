/**
 * Asset Entity Handlers
 *
 * Effect Cluster handlers for asset entity operations.
 * Uses AssetState service via DI - swap implementations for test/prod.
 *
 * @module @gbg/tmnl/ams/v2/base/handlers/asset
 */

import { Effect, Layer, Schedule } from 'effect'
import { AssetEntity } from '../entities/asset'
import { AssetState } from '../services/asset-state'

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
 */
export const AssetEntityHandlers = AssetEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* AssetState

    return {
      // ─────────────────────────────────────────────────────────────────────────
      // Command Handlers
      // ─────────────────────────────────────────────────────────────────────────

      CreateAsset: (envelope) =>
        state.create({
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
        }),

      UpdateAsset: (envelope) =>
        state.update({
          assetId: envelope.payload.assetId,
          label: envelope.payload.label,
          description: envelope.payload.description,
          status: envelope.payload.status,
          tags: envelope.payload.tags,
          expectedVersion: envelope.payload.expectedVersion,
          updatedBy: envelope.payload.updatedBy,
        }),

      MoveAsset: (envelope) =>
        state.move({
          assetId: envelope.payload.assetId,
          toSiteId: envelope.payload.toSiteId,
          toSectorId: envelope.payload.toSectorId,
          toContainerId: envelope.payload.toContainerId,
          reason: envelope.payload.reason,
          movedBy: envelope.payload.movedBy,
        }),

      SetAssetProperty: (envelope) =>
        state.setProperty({
          assetId: envelope.payload.assetId,
          key: envelope.payload.key,
          value: envelope.payload.value,
          provenance: envelope.payload.provenance,
          changedBy: envelope.payload.changedBy,
        }),

      RemoveAssetProperty: (envelope) =>
        state.removeProperty({
          assetId: envelope.payload.assetId,
          key: envelope.payload.key,
          reason: envelope.payload.reason,
          removedBy: envelope.payload.removedBy,
        }),

      AddAssetTrait: (envelope) =>
        state.addTrait({
          assetId: envelope.payload.assetId,
          traitId: envelope.payload.traitId,
          config: envelope.payload.config,
          addedBy: envelope.payload.addedBy,
        }),

      RemoveAssetTrait: (envelope) =>
        state.removeTrait({
          assetId: envelope.payload.assetId,
          traitId: envelope.payload.traitId,
          reason: envelope.payload.reason,
          removedBy: envelope.payload.removedBy,
        }),

      DeleteAsset: (envelope) =>
        state.delete({
          assetId: envelope.payload.assetId,
          hardDelete: envelope.payload.hardDelete,
          reason: envelope.payload.reason,
          deletedBy: envelope.payload.deletedBy,
        }),

      // ─────────────────────────────────────────────────────────────────────────
      // Query Handlers
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
