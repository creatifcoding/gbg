/**
 * Asset State Shape Interface
 *
 * Defines the contract for AssetState implementations.
 * Both in-memory (AssetState.Default) and SQL-backed (AssetState.SQL) variants
 * must satisfy this interface.
 *
 * @module @gbg/tmnl/ams/v2/base/services/asset-state-shape
 */

import { Effect } from 'effect'
import { Asset, AssetStatus, BaseAssetProperties, AssetSummary } from '../schemas/asset'
import { AssetProperty, PropertyValue } from '../schemas/property'
import { Provenance } from '../../core/schemas/provenance'
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
import { AssetNotFoundError, AssetValidationError, AssetConflictError } from '../commands/asset'
import { PaginatedAssets } from '../queries/asset'

// ─────────────────────────────────────────────────────────────────────────────
// Command Parameter Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateAssetParams {
  readonly siteId: SiteId
  readonly kind: AssetKind
  readonly label: AssetLabel
  readonly description?: AssetDescription
  readonly status?: AssetStatus
  readonly sectorId?: SectorId
  readonly containerId?: ContainerId
  readonly baseProperties?: BaseAssetProperties
  readonly tags?: Tags
  readonly createdBy: IdentityId
}

export interface UpdateAssetParams {
  readonly assetId: AssetId
  readonly label?: AssetLabel
  readonly description?: AssetDescription
  readonly status?: AssetStatus
  readonly tags?: Tags
  readonly expectedVersion?: number
  readonly updatedBy: IdentityId
}

export interface MoveAssetParams {
  readonly assetId: AssetId
  readonly toSiteId: SiteId
  readonly toSectorId?: SectorId
  readonly toContainerId?: ContainerId
  readonly reason?: string
  readonly movedBy: IdentityId
}

export interface SetPropertyParams {
  readonly assetId: AssetId
  readonly key: PropertyKey
  readonly value: PropertyValue
  readonly provenance: Provenance
  readonly changedBy: IdentityId
}

export interface RemovePropertyParams {
  readonly assetId: AssetId
  readonly key: PropertyKey
  readonly reason?: string
  readonly removedBy: IdentityId
}

export interface AddTraitParams {
  readonly assetId: AssetId
  readonly traitId: TraitId
  readonly config?: unknown
  readonly addedBy: IdentityId
}

export interface RemoveTraitParams {
  readonly assetId: AssetId
  readonly traitId: TraitId
  readonly reason?: string
  readonly removedBy: IdentityId
}

export interface DeleteAssetParams {
  readonly assetId: AssetId
  readonly hardDelete?: boolean
  readonly reason?: string
  readonly deletedBy: IdentityId
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Parameter Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ListBySiteParams {
  readonly siteId: SiteId
  readonly limit?: number
  readonly cursor?: string
}

export interface ListBySectorParams {
  readonly sectorId: SectorId
  readonly limit?: number
  readonly cursor?: string
}

export interface ListByContainerParams {
  readonly containerId: ContainerId
  readonly limit?: number
  readonly cursor?: string
}

export interface SearchParams {
  readonly query?: string
  readonly siteId?: SiteId
  readonly sectorId?: SectorId
  readonly containerId?: ContainerId
  readonly kind?: AssetKind
  readonly status?: AssetStatus
  readonly tags?: Tags
  readonly limit?: number
  readonly cursor?: string
}

export interface GetPropertyParams {
  readonly assetId: AssetId
  readonly key: PropertyKey
}

export interface GetPropertiesParams {
  readonly assetId: AssetId
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset State Shape Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AssetStateShape - Interface for AssetState implementations
 *
 * Both in-memory (Default) and SQL-backed (SQL) variants implement this shape.
 *
 * Commands (8):
 * - create, update, move, setProperty, removeProperty, addTrait, removeTrait, delete
 *
 * Queries (11):
 * - findById, findSummaryById, exists, listBySite, listBySector, listByContainer,
 *   search, getProperty, getProperties, countBySite, countByStatus, countByKind
 */
export interface AssetStateShape {
  // ─────────────────────────────────────────────────────────────────────────
  // Commands
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new asset
   */
  readonly create: (params: CreateAssetParams) => Effect.Effect<Asset, AssetValidationError>

  /**
   * Update an existing asset
   */
  readonly update: (
    params: UpdateAssetParams
  ) => Effect.Effect<Asset, AssetNotFoundError | AssetConflictError>

  /**
   * Move an asset to a new location
   */
  readonly move: (params: MoveAssetParams) => Effect.Effect<Asset, AssetNotFoundError>

  /**
   * Set or update an asset property
   */
  readonly setProperty: (params: SetPropertyParams) => Effect.Effect<void, AssetNotFoundError>

  /**
   * Remove an asset property
   */
  readonly removeProperty: (params: RemovePropertyParams) => Effect.Effect<void, AssetNotFoundError>

  /**
   * Add a trait to an asset
   */
  readonly addTrait: (params: AddTraitParams) => Effect.Effect<void, AssetNotFoundError>

  /**
   * Remove a trait from an asset
   */
  readonly removeTrait: (params: RemoveTraitParams) => Effect.Effect<void, AssetNotFoundError>

  /**
   * Delete an asset (soft or hard)
   */
  readonly delete: (params: DeleteAssetParams) => Effect.Effect<void, AssetNotFoundError>

  // ─────────────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find asset by ID
   */
  readonly findById: (assetId: AssetId) => Effect.Effect<Asset, AssetNotFoundError>

  /**
   * Find asset summary by ID
   */
  readonly findSummaryById: (assetId: AssetId) => Effect.Effect<AssetSummary, AssetNotFoundError>

  /**
   * Check if asset exists
   */
  readonly exists: (assetId: AssetId) => Effect.Effect<boolean>

  /**
   * List assets by site with pagination
   */
  readonly listBySite: (params: ListBySiteParams) => Effect.Effect<typeof PaginatedAssets.Type>

  /**
   * List assets by sector with pagination
   */
  readonly listBySector: (params: ListBySectorParams) => Effect.Effect<typeof PaginatedAssets.Type>

  /**
   * List assets by container with pagination
   */
  readonly listByContainer: (
    params: ListByContainerParams
  ) => Effect.Effect<typeof PaginatedAssets.Type>

  /**
   * Search assets with filters
   */
  readonly search: (params: SearchParams) => Effect.Effect<typeof PaginatedAssets.Type>

  /**
   * Get a single property for an asset
   */
  readonly getProperty: (
    params: GetPropertyParams
  ) => Effect.Effect<AssetProperty, AssetNotFoundError>

  /**
   * Get all properties for an asset
   */
  readonly getProperties: (
    params: GetPropertiesParams
  ) => Effect.Effect<readonly AssetProperty[], AssetNotFoundError>

  /**
   * Count assets by site
   */
  readonly countBySite: (siteId: SiteId) => Effect.Effect<number>

  /**
   * Count assets by status
   */
  readonly countByStatus: (status: AssetStatus) => Effect.Effect<number>

  /**
   * Count assets by kind
   */
  readonly countByKind: (kind: AssetKind) => Effect.Effect<number>
}
