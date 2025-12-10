/**
 * Asset Entity
 *
 * Effect Cluster entity for distributed asset management.
 * Uses Rpc.make for type-safe RPC definitions.
 *
 * @module @gbg/tmnl/ams/v2/base/entities/asset
 */

import { Schema } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import {
  AssetId,
  AssetKind,
  AssetLabel,
  AssetDescription,
  SiteId,
  SectorId,
  ContainerId,
  PropertyKey,
  TraitId,
  Tags,
  IdentityId,
} from '../../core/schemas/identifiers'
import { Provenance } from '../../core/schemas/provenance'
import { Asset, AssetStatus, AssetSummary, BaseAssetProperties } from '../schemas/asset'
import { PropertyValue, AssetProperty } from '../schemas/property'
import {
  AssetNotFoundError,
  AssetValidationError,
  AssetConflictError,
  AssetPermissionError,
  AssetCommandError,
} from '../commands/asset'
import { PaginatedAssets, PageInfo, AssetQueryEmpty } from '../queries/asset'

// ─────────────────────────────────────────────────────────────────────────────
// Command RPCs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new asset
 */
export class CreateAssetRpc extends Rpc.make('CreateAsset', {
  payload: {
    siteId: SiteId,
    kind: AssetKind,
    label: AssetLabel,
    description: Schema.optional(AssetDescription),
    status: Schema.optional(AssetStatus),
    sectorId: Schema.optional(SectorId),
    containerId: Schema.optional(ContainerId),
    baseProperties: Schema.optional(BaseAssetProperties),
    tags: Schema.optional(Tags),
    createdBy: IdentityId,
  },
  success: Asset,
  error: AssetCommandError,
}) {}

/**
 * Update an existing asset
 */
export class UpdateAssetRpc extends Rpc.make('UpdateAsset', {
  payload: {
    assetId: AssetId,
    label: Schema.optional(AssetLabel),
    description: Schema.optional(AssetDescription),
    status: Schema.optional(AssetStatus),
    tags: Schema.optional(Tags),
    expectedVersion: Schema.optional(Schema.Number),
    updatedBy: IdentityId,
  },
  success: Asset,
  error: AssetCommandError,
}) {}

/**
 * Move an asset to a new location
 */
export class MoveAssetRpc extends Rpc.make('MoveAsset', {
  payload: {
    assetId: AssetId,
    toSiteId: SiteId,
    toSectorId: Schema.optional(SectorId),
    toContainerId: Schema.optional(ContainerId),
    reason: Schema.optional(Schema.String),
    movedBy: IdentityId,
  },
  success: Asset,
  error: AssetCommandError,
}) {}

/**
 * Set or update an asset property
 */
export class SetAssetPropertyRpc extends Rpc.make('SetAssetProperty', {
  payload: {
    assetId: AssetId,
    key: PropertyKey,
    value: PropertyValue,
    provenance: Provenance,
    changedBy: IdentityId,
  },
  success: Schema.Void,
  error: AssetCommandError,
}) {}

/**
 * Remove an asset property
 */
export class RemoveAssetPropertyRpc extends Rpc.make('RemoveAssetProperty', {
  payload: {
    assetId: AssetId,
    key: PropertyKey,
    reason: Schema.optional(Schema.String),
    removedBy: IdentityId,
  },
  success: Schema.Void,
  error: AssetCommandError,
}) {}

/**
 * Add a trait to an asset
 */
export class AddAssetTraitRpc extends Rpc.make('AddAssetTrait', {
  payload: {
    assetId: AssetId,
    traitId: TraitId,
    config: Schema.optional(Schema.Unknown),
    addedBy: IdentityId,
  },
  success: Schema.Void,
  error: AssetCommandError,
}) {}

/**
 * Remove a trait from an asset
 */
export class RemoveAssetTraitRpc extends Rpc.make('RemoveAssetTrait', {
  payload: {
    assetId: AssetId,
    traitId: TraitId,
    reason: Schema.optional(Schema.String),
    removedBy: IdentityId,
  },
  success: Schema.Void,
  error: AssetCommandError,
}) {}

/**
 * Delete an asset (soft or hard)
 */
export class DeleteAssetRpc extends Rpc.make('DeleteAsset', {
  payload: {
    assetId: AssetId,
    hardDelete: Schema.optional(Schema.Boolean),
    reason: Schema.optional(Schema.String),
    deletedBy: IdentityId,
  },
  success: Schema.Void,
  error: AssetCommandError,
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Query RPCs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a single asset by ID
 */
export class GetAssetRpc extends Rpc.make('GetAsset', {
  payload: { assetId: AssetId },
  success: Asset,
  error: AssetNotFoundError,
}) {}

/**
 * Get asset summary by ID
 */
export class GetAssetSummaryRpc extends Rpc.make('GetAssetSummary', {
  payload: { assetId: AssetId },
  success: AssetSummary,
  error: AssetNotFoundError,
}) {}

/**
 * Check if an asset exists
 */
export class AssetExistsRpc extends Rpc.make('AssetExists', {
  payload: { assetId: AssetId },
  success: Schema.Boolean,
  error: Schema.Never,
}) {}

/**
 * List assets by site
 */
export class ListAssetsBySiteRpc extends Rpc.make('ListAssetsBySite', {
  payload: {
    siteId: SiteId,
    limit: Schema.optional(Schema.Number),
    cursor: Schema.optional(Schema.String),
  },
  success: PaginatedAssets,
  error: Schema.Never,
}) {}

/**
 * List assets by sector
 */
export class ListAssetsBySectorRpc extends Rpc.make('ListAssetsBySector', {
  payload: {
    sectorId: SectorId,
    limit: Schema.optional(Schema.Number),
    cursor: Schema.optional(Schema.String),
  },
  success: PaginatedAssets,
  error: Schema.Never,
}) {}

/**
 * List assets by container
 */
export class ListAssetsByContainerRpc extends Rpc.make('ListAssetsByContainer', {
  payload: {
    containerId: ContainerId,
    limit: Schema.optional(Schema.Number),
    cursor: Schema.optional(Schema.String),
  },
  success: PaginatedAssets,
  error: Schema.Never,
}) {}

/**
 * Search assets with filters
 */
export class SearchAssetsRpc extends Rpc.make('SearchAssets', {
  payload: {
    query: Schema.optional(Schema.String),
    siteId: Schema.optional(SiteId),
    sectorId: Schema.optional(SectorId),
    containerId: Schema.optional(ContainerId),
    kind: Schema.optional(AssetKind),
    status: Schema.optional(AssetStatus),
    tags: Schema.optional(Tags),
    limit: Schema.optional(Schema.Number),
    cursor: Schema.optional(Schema.String),
  },
  success: PaginatedAssets,
  error: Schema.Never,
}) {}

/**
 * Get property for an asset
 */
export class GetAssetPropertyRpc extends Rpc.make('GetAssetProperty', {
  payload: {
    assetId: AssetId,
    key: PropertyKey,
  },
  success: AssetProperty,
  error: AssetNotFoundError,
}) {}

/**
 * Get all properties for an asset
 */
export class GetAssetPropertiesRpc extends Rpc.make('GetAssetProperties', {
  payload: { assetId: AssetId },
  success: Schema.Array(AssetProperty),
  error: AssetNotFoundError,
}) {}

/**
 * Count assets by site
 */
export class CountAssetsBySiteRpc extends Rpc.make('CountAssetsBySite', {
  payload: { siteId: SiteId },
  success: Schema.Number,
  error: Schema.Never,
}) {}

/**
 * Count assets by status
 */
export class CountAssetsByStatusRpc extends Rpc.make('CountAssetsByStatus', {
  payload: { status: AssetStatus },
  success: Schema.Number,
  error: Schema.Never,
}) {}

/**
 * Count assets by kind
 */
export class CountAssetsByKindRpc extends Rpc.make('CountAssetsByKind', {
  payload: { kind: AssetKind },
  success: Schema.Number,
  error: Schema.Never,
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset Entity
 *
 * Distributed actor for asset management operations.
 * Entity ID is the assetId for single-asset operations.
 */
export const AssetEntity = Entity.make('Asset', [
  // Commands
  CreateAssetRpc,
  UpdateAssetRpc,
  MoveAssetRpc,
  SetAssetPropertyRpc,
  RemoveAssetPropertyRpc,
  AddAssetTraitRpc,
  RemoveAssetTraitRpc,
  DeleteAssetRpc,
  // Queries
  GetAssetRpc,
  GetAssetSummaryRpc,
  AssetExistsRpc,
  ListAssetsBySiteRpc,
  ListAssetsBySectorRpc,
  ListAssetsByContainerRpc,
  SearchAssetsRpc,
  GetAssetPropertyRpc,
  GetAssetPropertiesRpc,
  CountAssetsBySiteRpc,
  CountAssetsByStatusRpc,
  CountAssetsByKindRpc,
])

/**
 * Type helper for Asset Entity
 */
export type AssetEntity = typeof AssetEntity
