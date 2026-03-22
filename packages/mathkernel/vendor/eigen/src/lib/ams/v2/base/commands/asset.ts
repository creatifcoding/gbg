/**
 * Asset Commands
 *
 * CQRS write operations for assets using Schema.TaggedRequest.
 * Commands are intent declarations that will produce events.
 *
 * @module @gbg/tmnl/ams/v2/base/commands/asset
 */

import { Schema } from 'effect';
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
} from '../../core/schemas/identifiers';
import { Provenance } from '../../core/schemas/provenance';
import { AssetStatus, Asset, BaseAssetProperties } from '../schemas/asset';
import { PropertyValue } from '../schemas/property';

// ─────────────────────────────────────────────────────────────────────────────
// Error Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset not found error
 */
export class AssetNotFoundError extends Schema.TaggedClass<AssetNotFoundError>()(
  'AssetNotFoundError',
  {
    assetId: AssetId,
    message: Schema.optional(Schema.String),
  }
) {}

/**
 * Asset validation error
 */
export class AssetValidationError extends Schema.TaggedClass<AssetValidationError>()(
  'AssetValidationError',
  {
    field: Schema.String,
    message: Schema.String,
    value: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * Asset operation conflict (e.g., concurrent modification)
 */
export class AssetConflictError extends Schema.TaggedClass<AssetConflictError>()(
  'AssetConflictError',
  {
    assetId: AssetId,
    reason: Schema.String,
    expectedVersion: Schema.optional(Schema.Number),
    actualVersion: Schema.optional(Schema.Number),
  }
) {}

/**
 * Asset operation not permitted
 */
export class AssetPermissionError extends Schema.TaggedClass<AssetPermissionError>()(
  'AssetPermissionError',
  {
    assetId: Schema.optional(AssetId),
    operation: Schema.String,
    requiredPermission: Schema.String,
    message: Schema.optional(Schema.String),
  }
) {}

/**
 * Union of all asset command errors
 */
export const AssetCommandError = Schema.Union(
  AssetNotFoundError,
  AssetValidationError,
  AssetConflictError,
  AssetPermissionError
);
export type AssetCommandError = typeof AssetCommandError.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new asset
 *
 * Produces: AssetCreated event
 */
export class CreateAsset extends Schema.TaggedRequest<CreateAsset>()(
  'CreateAsset',
  {
    failure: AssetCommandError,
    success: Asset,
    payload: {
      /** Site where asset will be located */
      siteId: SiteId,
      /** Optional sector within site */
      sectorId: Schema.optional(SectorId),
      /** Optional container within sector */
      containerId: Schema.optional(ContainerId),
      /** Asset classification */
      kind: AssetKind,
      /** Human-readable label */
      label: AssetLabel,
      /** Optional description */
      description: Schema.optional(AssetDescription),
      /** Initial status (defaults to 'available') */
      status: Schema.optional(AssetStatus),
      /** Base properties */
      baseProperties: Schema.optional(BaseAssetProperties),
      /** Tags for categorization */
      tags: Schema.optional(Tags),
      /** Identity of creator */
      createdBy: IdentityId,
    },
  }
) {}

/**
 * Update asset metadata (label, description, status)
 *
 * Produces: AssetUpdated event
 */
export class UpdateAsset extends Schema.TaggedRequest<UpdateAsset>()(
  'UpdateAsset',
  {
    failure: AssetCommandError,
    success: Asset,
    payload: {
      /** Asset to update */
      assetId: AssetId,
      /** New label (optional) */
      label: Schema.optional(AssetLabel),
      /** New description (optional) */
      description: Schema.optional(AssetDescription),
      /** New status (optional) */
      status: Schema.optional(AssetStatus),
      /** New tags (optional, replaces existing) */
      tags: Schema.optional(Tags),
      /** Identity of updater */
      updatedBy: IdentityId,
      /** Optimistic concurrency version */
      expectedVersion: Schema.optional(Schema.Number),
    },
  }
) {}

// TODO: Work on canonical tags
/**
 * Move asset to a new location
 *
 * Produces: AssetMoved event
 */
export class MoveAsset extends Schema.TaggedRequest<MoveAsset>()('MoveAsset', {
  failure: AssetCommandError,
  success: Asset,
  payload: {
    /** Asset to move */
    assetId: AssetId,
    /** Target site */
    toSiteId: SiteId,
    /** Target sector (optional) */
    toSectorId: Schema.optional(SectorId),
    /** Target container (optional) */
    toContainerId: Schema.optional(ContainerId),
    /** Identity of mover */
    movedBy: IdentityId,
    /** Movement reason/note */
    reason: Schema.optional(Schema.String),
  },
}) {}

/**
 * Set or update a property on an asset
 *
 * Produces: PropertyChanged event
 */
export class SetAssetProperty extends Schema.TaggedRequest<SetAssetProperty>()(
  'SetAssetProperty',
  {
    failure: AssetCommandError,
    success: Asset,
    payload: {
      /** Asset to update */
      assetId: AssetId,
      /** Property key */
      key: PropertyKey,
      /** New value */
      value: PropertyValue,
      /** Provenance of this value */
      provenance: Provenance,
      /** Identity of setter */
      changedBy: IdentityId,
    },
  }
) {}

/**
 * Remove a property from an asset
 *
 * Produces: PropertyRemoved event
 */
export class RemoveAssetProperty extends Schema.TaggedRequest<RemoveAssetProperty>()(
  'RemoveAssetProperty',
  {
    failure: AssetCommandError,
    success: Asset,
    payload: {
      /** Asset to update */
      assetId: AssetId,
      /** Property key to remove */
      key: PropertyKey,
      /** Identity of remover */
      removedBy: IdentityId,
      /** Reason for removal */
      reason: Schema.optional(Schema.String),
    },
  }
) {}

/**
 * Add a trait to an asset
 *
 * Produces: TraitAdded event
 */
export class AddAssetTrait extends Schema.TaggedRequest<AddAssetTrait>()(
  'AddAssetTrait',
  {
    failure: AssetCommandError,
    success: Asset,
    payload: {
      /** Asset to update */
      assetId: AssetId,
      /** Trait to add */
      traitId: TraitId,
      /** Trait configuration (schema depends on trait type) */
      config: Schema.optional(Schema.Unknown),
      /** Identity of adder */
      addedBy: IdentityId,
    },
  }
) {}

/**
 * Remove a trait from an asset
 *
 * Produces: TraitRemoved event
 */
export class RemoveAssetTrait extends Schema.TaggedRequest<RemoveAssetTrait>()(
  'RemoveAssetTrait',
  {
    failure: AssetCommandError,
    success: Asset,
    payload: {
      /** Asset to update */
      assetId: AssetId,
      /** Trait to remove */
      traitId: TraitId,
      /** Identity of remover */
      removedBy: IdentityId,
      /** Reason for removal */
      reason: Schema.optional(Schema.String),
    },
  }
) {}

/**
 * Delete an asset (soft delete - marks as retired)
 *
 * Produces: AssetDeleted event
 */
export class DeleteAsset extends Schema.TaggedRequest<DeleteAsset>()(
  'DeleteAsset',
  {
    failure: AssetCommandError,
    success: Schema.Void,
    payload: {
      /** Asset to delete */
      assetId: AssetId,
      /** Identity of deleter */
      deletedBy: IdentityId,
      /** Reason for deletion */
      reason: Schema.optional(Schema.String),
      /** Hard delete (permanent) vs soft delete (retire) */
      hard: Schema.optional(Schema.Boolean),
    },
  }
) {}

// ─────────────────────────────────────────────────────────────────────────────
// Command Union
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Union of all asset commands for pattern matching
 */
export const AssetCommand = Schema.Union(
  CreateAsset,
  UpdateAsset,
  MoveAsset,
  SetAssetProperty,
  RemoveAssetProperty,
  AddAssetTrait,
  RemoveAssetTrait,
  DeleteAsset
);
export type AssetCommand = typeof AssetCommand.Type;
