/**
 * Asset Events
 *
 * Domain events for asset management using @effect/experimental Event.
 * Events represent facts that have occurred in the system.
 *
 * @module @gbg/tmnl/ams/v2/base/events/asset
 */

import { Schema } from 'effect';
import * as EventGroup from '@effect/experimental/EventGroup';
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
import { CreatedAt } from '../../core/schemas/timestamps';
import { Provenance } from '../../core/schemas/provenance';
import { AssetStatus } from '../schemas/asset';
import { PropertyValue } from '../schemas/property';

// ─────────────────────────────────────────────────────────────────────────────
// Event Payload Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset created event payload */
/* TODO: Shall these be updated to TaggedRequests, with rich annotations.
 */
export class AssetCreatedPayload extends Schema.Class<AssetCreatedPayload>(
  'AssetCreatedPayload'
)({
  /** Created asset ID */
  assetId: AssetId,
  /** Site where asset was created */
  siteId: SiteId,
  /** Sector (optional) */
  sectorId: Schema.optional(SectorId),
  /** Container (optional) */
  containerId: Schema.optional(ContainerId),
  /** Asset classification */
  kind: AssetKind,
  /** Human-readable label */
  label: AssetLabel,
  /** Description (optional) */
  description: Schema.optional(AssetDescription),
  /** Initial status */
  status: AssetStatus,
  /** Tags */
  tags: Schema.optional(Tags),
  /** Identity of creator */
  createdBy: IdentityId,
  /** When created */
  createdAt: CreatedAt,
}) {}

/**
 * Asset updated event payload
 */
export class AssetUpdatedPayload extends Schema.Class<AssetUpdatedPayload>(
  'AssetUpdatedPayload'
)({
  /** Asset ID */
  assetId: AssetId,
  /** Previous label (if changed) */
  previousLabel: Schema.optional(AssetLabel),
  /** New label (if changed) */
  newLabel: Schema.optional(AssetLabel),
  /** Previous description (if changed) */
  previousDescription: Schema.optional(AssetDescription),
  /** New description (if changed) */
  newDescription: Schema.optional(AssetDescription),
  /** Previous status (if changed) */
  previousStatus: Schema.optional(AssetStatus),
  /** New status (if changed) */
  newStatus: Schema.optional(AssetStatus),
  /** Previous tags (if changed) */
  previousTags: Schema.optional(Tags),
  /** New tags (if changed) */
  newTags: Schema.optional(Tags),
  /** Identity of updater */
  updatedBy: IdentityId,
  /** When updated */
  updatedAt: CreatedAt,
  /** Version after update (optional - may not be tracked in all implementations) */
  version: Schema.optional(Schema.Number),
}) {}

/**
 * Asset moved event payload
 */
export class AssetMovedPayload extends Schema.Class<AssetMovedPayload>(
  'AssetMovedPayload'
)({
  /** Asset ID */
  assetId: AssetId,
  /** Previous site */
  fromSiteId: SiteId,
  /** Previous sector (optional) */
  fromSectorId: Schema.optional(SectorId),
  /** Previous container (optional) */
  fromContainerId: Schema.optional(ContainerId),
  /** New site */
  toSiteId: SiteId,
  /** New sector (optional) */
  toSectorId: Schema.optional(SectorId),
  /** New container (optional) */
  toContainerId: Schema.optional(ContainerId),
  /** Movement reason */
  reason: Schema.optional(Schema.String),
  /** Identity of mover */
  movedBy: IdentityId,
  /** When moved */
  movedAt: CreatedAt,
}) {}

/**
 * Property changed event payload
 */
export class PropertyChangedPayload extends Schema.Class<PropertyChangedPayload>(
  'PropertyChangedPayload'
)({
  /** Asset ID */
  assetId: AssetId,
  /** Property key */
  key: PropertyKey,
  /** Previous value (null if new property) */
  previousValue: Schema.NullOr(PropertyValue),
  /** New value */
  newValue: PropertyValue,
  /** Provenance of new value */
  provenance: Provenance,
  /** Identity of changer */
  changedBy: IdentityId,
  /** When changed */
  changedAt: CreatedAt,
}) {}

/**
 * Property removed event payload
 */
export class PropertyRemovedPayload extends Schema.Class<PropertyRemovedPayload>(
  'PropertyRemovedPayload'
)({
  /** Asset ID */
  assetId: AssetId,
  /** Property key */
  key: PropertyKey,
  /** Removed value */
  removedValue: PropertyValue,
  /** Reason for removal */
  reason: Schema.optional(Schema.String),
  /** Identity of remover */
  removedBy: IdentityId,
  /** When removed */
  removedAt: CreatedAt,
}) {}

/**
 * Trait added event payload
 */
export class TraitAddedPayload extends Schema.Class<TraitAddedPayload>(
  'TraitAddedPayload'
)({
  /** Asset ID */
  assetId: AssetId,
  /** Trait ID */
  traitId: TraitId,
  /** Trait configuration (optional) */
  config: Schema.optional(Schema.Unknown),
  /** Identity of adder */
  addedBy: IdentityId,
  /** When added */
  addedAt: CreatedAt,
}) {}

/**
 * Trait removed event payload
 */
export class TraitRemovedPayload extends Schema.Class<TraitRemovedPayload>(
  'TraitRemovedPayload'
)({
  /** Asset ID */
  assetId: AssetId,
  /** Trait ID */
  traitId: TraitId,
  /** Reason for removal */
  reason: Schema.optional(Schema.String),
  /** Identity of remover */
  removedBy: IdentityId,
  /** When removed */
  removedAt: CreatedAt,
}) {}

/**
 * Asset deleted event payload
 */
export class AssetDeletedPayload extends Schema.Class<AssetDeletedPayload>(
  'AssetDeletedPayload'
)({
  /** Asset ID */
  assetId: AssetId,
  /** Reason for deletion */
  reason: Schema.optional(Schema.String),
  /** Whether this was a hard delete */
  hardDelete: Schema.Boolean,
  /** Identity of deleter */
  deletedBy: IdentityId,
  /** When deleted */
  deletedAt: CreatedAt,
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Event Group
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset event group for EventLog
 *
 * Uses builder pattern with EventGroup.empty.add()
 */
export const AssetEvents = EventGroup.empty
  .add({
    tag: 'AssetCreated',
    payload: AssetCreatedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  .add({
    tag: 'AssetUpdated',
    payload: AssetUpdatedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  .add({
    tag: 'AssetMoved',
    payload: AssetMovedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  .add({
    tag: 'PropertyChanged',
    payload: PropertyChangedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  .add({
    tag: 'PropertyRemoved',
    payload: PropertyRemovedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  .add({
    tag: 'TraitAdded',
    payload: TraitAddedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  .add({
    tag: 'TraitRemoved',
    payload: TraitRemovedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  .add({
    tag: 'AssetDeleted',
    payload: AssetDeletedPayload,
    primaryKey: (payload) => payload.assetId,
  });

/**
 * Type helper for AssetEvents
 */
export type AssetEvents = EventGroup.EventGroup.Events<typeof AssetEvents>;
