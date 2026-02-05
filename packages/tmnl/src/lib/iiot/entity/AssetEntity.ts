/**
 * AssetEntity - Effect Cluster Entity for Asset Hierarchy Management
 *
 * Manages ISA-95 compliant asset hierarchy: Enterprise → Site → Area → Plant
 * → Line → WorkCell → Machine → Sensor/Device
 *
 * Entity Lifecycle:
 * - Get: Retrieve asset by ID
 * - GetChildren: Get child assets in hierarchy
 * - GetHierarchy: Get full asset path to root
 * - Update: Modify asset metadata
 *
 * @module
 */

import { Schema } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { AssetId, EquipmentLevel } from '../schemas/identifiers'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Asset not found error */
export class RpcAssetNotFoundError extends Schema.TaggedError<RpcAssetNotFoundError>()(
  'RpcAssetNotFoundError',
  {
    assetId: AssetId,
  }
) {}

/** Asset validation error */
export class RpcAssetValidationError extends Schema.TaggedError<RpcAssetValidationError>()(
  'RpcAssetValidationError',
  {
    message: Schema.String,
  }
) {}

/** Hierarchy error */
export class RpcAssetHierarchyError extends Schema.TaggedError<RpcAssetHierarchyError>()(
  'RpcAssetHierarchyError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Asset Representation for Entity State
// =============================================================================

/** Generic asset representation for entity state */
export const AssetRecord = Schema.Struct({
  id: AssetId,
  name: Schema.NonEmptyString,
  level: EquipmentLevel,
  parentId: Schema.optionalWith(AssetId, { as: 'Option' }),
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) }
  ),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
})
export type AssetRecord = Schema.Schema.Type<typeof AssetRecord>

/** Asset hierarchy path */
export const AssetPath = Schema.Array(
  Schema.Struct({
    id: AssetId,
    name: Schema.String,
    level: EquipmentLevel,
  })
)
export type AssetPath = Schema.Schema.Type<typeof AssetPath>

// =============================================================================
// RPC Tags
// =============================================================================

export const AssetEntityType = 'Asset' as const
export const AssetGetTag = `${AssetEntityType}.Get` as const
export const AssetGetChildrenTag = `${AssetEntityType}.GetChildren` as const
export const AssetGetHierarchyTag = `${AssetEntityType}.GetHierarchy` as const
export const AssetUpdateTag = `${AssetEntityType}.Update` as const

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Get asset by ID
 */
export class GetAssetRpc extends Rpc.make(AssetGetTag, {
  payload: Schema.Struct({
    assetId: AssetId,
  }),
  success: AssetRecord,
  error: RpcAssetNotFoundError,
}) {}

/**
 * Get child assets of a parent
 */
export class GetChildrenRpc extends Rpc.make(AssetGetChildrenTag, {
  payload: Schema.Struct({
    parentId: AssetId,
    level: Schema.optionalWith(EquipmentLevel, { as: 'Option' }),
  }),
  success: Schema.Array(AssetRecord),
  error: RpcAssetHierarchyError,
}) {}

/**
 * Get full hierarchy path to root
 */
export class GetHierarchyRpc extends Rpc.make(AssetGetHierarchyTag, {
  payload: Schema.Struct({
    assetId: AssetId,
  }),
  success: AssetPath,
  error: RpcAssetNotFoundError,
}) {}

/**
 * Update asset metadata
 */
export class UpdateAssetRpc extends Rpc.make(AssetUpdateTag, {
  payload: Schema.Struct({
    assetId: AssetId,
    name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
    metadata: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { as: 'Option' }
    ),
  }),
  success: AssetRecord,
  error: Schema.Union(RpcAssetNotFoundError, RpcAssetValidationError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Asset Entity
 *
 * Distributed actor managing asset hierarchy state.
 * Each asset instance is keyed by assetId.
 *
 * Note: Assets are typically read-heavy and write-light.
 * For bulk operations, use the repository layer directly.
 */
export const AssetEntity = Entity.make(AssetEntityType, [
  GetAssetRpc,
  GetChildrenRpc,
  GetHierarchyRpc,
  UpdateAssetRpc,
])

/**
 * Type helper for Asset Entity
 */
export type AssetEntity = typeof AssetEntity
