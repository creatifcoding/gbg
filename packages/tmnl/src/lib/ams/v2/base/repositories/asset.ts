/**
 * Asset SQL Model & Repository
 *
 * Persistence layer for assets using @effect/sql Model.
 * Provides insert/update/select variants with generated fields.
 *
 * @module @gbg/tmnl/ams/v2/base/repositories/asset
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  AssetId,
  AssetKind,
  AssetLabel,
  AssetDescription,
  SiteId,
  SectorId,
  ContainerId,
  Tags,
} from '../../core/schemas/identifiers'
import { AssetStatus } from '../schemas/asset'

// ─────────────────────────────────────────────────────────────────────────────
// SQL Model Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset SQL Model
 *
 * Database representation of an asset with:
 * - Model.Generated: id is database-generated (auto-increment or UUID)
 * - Model.DateTimeInsertFromDate: createdAt set on insert
 * - Model.DateTimeUpdateFromDate: updatedAt set on update
 *
 * Variants:
 * - AssetModel: select schema (full entity)
 * - AssetModel.insert: insert schema (without generated fields)
 * - AssetModel.update: update schema (with id for WHERE clause)
 * - AssetModel.json: JSON API schema
 */
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  /** Primary key - database generated */
  id: Model.Generated(AssetId),

  /** BFO class literal (always 'material_entity' for assets) */
  bfoClass: Schema.String,

  /** Asset classification */
  kind: AssetKind,

  /** Human-readable label */
  label: AssetLabel,

  /** Optional description */
  description: Model.FieldOption(AssetDescription),

  /** Current status */
  status: AssetStatus,

  /** Site ID (foreign key) */
  siteId: SiteId,

  /** Sector ID (foreign key, optional) */
  sectorId: Model.FieldOption(SectorId),

  /** Container ID (foreign key, optional) */
  containerId: Model.FieldOption(ContainerId),

  /** Base properties as JSON */
  basePropertiesJson: Model.FieldOption(Model.JsonFromString(Schema.Unknown)),

  /** Tags as JSON array */
  tagsJson: Model.FieldOption(Model.JsonFromString(Tags)),

  /** Optimistic concurrency version */
  version: Schema.Number.pipe(Schema.int()),

  /** Created timestamp - set on insert */
  createdAt: Model.DateTimeInsertFromDate,

  /** Updated timestamp - set on update */
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Repository Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create Asset repository with CRUD operations
 *
 * @example
 * ```ts
 * const repo = yield* makeAssetRepository
 *
 * // Insert
 * const asset = yield* repo.insert(AssetModel.insert.make({
 *   kind: 'EQUIPMENT',
 *   label: 'Forklift #1',
 *   status: 'available',
 *   siteId: 'site-01',
 *   bfoClass: 'material_entity',
 *   version: 1,
 * }))
 *
 * // Find
 * const found = yield* repo.findById(asset.id)
 *
 * // Update
 * const updated = yield* repo.update(AssetModel.update.make({
 *   ...asset,
 *   label: 'Forklift #1 - Updated',
 * }))
 *
 * // Delete
 * yield* repo.delete(asset.id)
 * ```
 */
export const makeAssetRepository = Model.makeRepository(AssetModel, {
  tableName: 'assets',
  idColumn: 'id',
  spanPrefix: 'AssetRepository',
})

// ─────────────────────────────────────────────────────────────────────────────
// Location Models (for joins)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Site SQL Model
 */
export class SiteModel extends Model.Class<SiteModel>('SiteModel')({
  id: Model.Generated(SiteId),
  bfoClass: Schema.String,
  name: Schema.NonEmptyTrimmedString,
  geoFrameJson: Model.FieldOption(Model.JsonFromString(Schema.Unknown)),
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}

export const makeSiteRepository = Model.makeRepository(SiteModel, {
  tableName: 'sites',
  idColumn: 'id',
  spanPrefix: 'SiteRepository',
})

/**
 * Sector SQL Model
 */
export class SectorModel extends Model.Class<SectorModel>('SectorModel')({
  id: Model.Generated(SectorId),
  bfoClass: Schema.String,
  siteId: SiteId,
  sectorTypeId: Schema.String,
  name: Schema.NonEmptyTrimmedString,
  footprintJson: Model.FieldOption(Model.JsonFromString(Schema.Unknown)),
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}

export const makeSectorRepository = Model.makeRepository(SectorModel, {
  tableName: 'sectors',
  idColumn: 'id',
  spanPrefix: 'SectorRepository',
})

/**
 * Container SQL Model
 */
export class ContainerModel extends Model.Class<ContainerModel>('ContainerModel')({
  id: Model.Generated(ContainerId),
  bfoClass: Schema.String,
  siteId: SiteId,
  sectorId: Model.FieldOption(SectorId),
  containerTypeId: Schema.String,
  label: Schema.NonEmptyTrimmedString,
  parentContainerId: Model.FieldOption(ContainerId),
  isMobile: Schema.Boolean,
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}

export const makeContainerRepository = Model.makeRepository(ContainerModel, {
  tableName: 'containers',
  idColumn: 'id',
  spanPrefix: 'ContainerRepository',
})

// ─────────────────────────────────────────────────────────────────────────────
// Property & Trait Models
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset Property SQL Model (EAV pattern)
 */
export class AssetPropertyModel extends Model.Class<AssetPropertyModel>('AssetPropertyModel')(
  {
    id: Model.Generated(Schema.Number.pipe(Schema.int())),
    assetId: AssetId,
    key: Schema.NonEmptyTrimmedString,
    value: Schema.String,
    provenanceJson: Model.JsonFromString(Schema.Unknown),
    createdAt: Model.DateTimeInsertFromDate,
    updatedAt: Model.DateTimeUpdateFromDate,
  }
) {}

export const makeAssetPropertyRepository = Model.makeRepository(AssetPropertyModel, {
  tableName: 'asset_properties',
  idColumn: 'id',
  spanPrefix: 'AssetPropertyRepository',
})

/**
 * Asset Trait SQL Model
 */
export class AssetTraitModel extends Model.Class<AssetTraitModel>('AssetTraitModel')({
  id: Model.Generated(Schema.Number.pipe(Schema.int())),
  assetId: AssetId,
  traitId: Schema.NonEmptyTrimmedString,
  configJson: Model.FieldOption(Model.JsonFromString(Schema.Unknown)),
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}

export const makeAssetTraitRepository = Model.makeRepository(AssetTraitModel, {
  tableName: 'asset_traits',
  idColumn: 'id',
  spanPrefix: 'AssetTraitRepository',
})

// ─────────────────────────────────────────────────────────────────────────────
// Event Journal Model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event Journal SQL Model
 *
 * Stores domain events for event sourcing.
 * Used by EventLog for persistence.
 */
export class EventJournalModel extends Model.Class<EventJournalModel>('EventJournalModel')({
  /** Auto-increment sequence number */
  sequenceNumber: Model.Generated(Schema.Number.pipe(Schema.int())),

  /** Event tag (e.g., 'AssetCreated') */
  eventTag: Schema.NonEmptyTrimmedString,

  /** Primary key of the aggregate (e.g., assetId) */
  primaryKey: Schema.NonEmptyTrimmedString,

  /** Event payload as JSON */
  payloadJson: Model.JsonFromString(Schema.Unknown),

  /** Identity who triggered the event */
  triggeredBy: Schema.String,

  /** When the event occurred */
  occurredAt: Model.DateTimeInsertFromDate,

  /** Version for optimistic concurrency */
  aggregateVersion: Schema.Number.pipe(Schema.int()),
}) {}

export const makeEventJournalRepository = Model.makeRepository(EventJournalModel, {
  tableName: 'event_journal',
  idColumn: 'sequenceNumber',
  spanPrefix: 'EventJournalRepository',
})
