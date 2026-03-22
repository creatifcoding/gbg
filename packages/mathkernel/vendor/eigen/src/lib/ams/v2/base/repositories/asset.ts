/**
 * Asset SQL Model & Repository
 *
 * Persistence layer for assets using @effect/sql Model.
 * Provides insert/update/select variants with generated fields.
 *
 * @module @gbg/tmnl/ams/v2/base/repositories/asset
 */

import { Option, Schema } from 'effect';
import { Model } from '@effect/sql';

// ─────────────────────────────────────────────────────────────────────────────
// Nullable JSON Schema Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a schema for nullable JSON that properly handles null ↔ Option.none()
 *
 * The issue with Model.FieldOption(Model.JsonFromString(...)) is that:
 * 1. JsonFromString uses Schema.parseJson which stringifies null → "null" (string)
 * 2. SQLite expects actual null, not the string "null"
 *
 * Additionally, Schema.Option vs Schema.OptionFromSelf matters:
 * - Schema.Option(A) has encoded form { _tag: "None" | "Some", value?: A }
 * - Schema.OptionFromSelf(A) treats Option<A> as the encoded form directly
 *
 * We MUST use OptionFromSelf to avoid the extra OptionEncoded transformation
 * layer that causes "missing _tag" errors when decoding SELECT results.
 *
 * This schema directly transforms:
 * - Database (encoded): null | string (JSON text)
 * - TypeScript (decoded): Option<unknown>
 */
const NullableJsonFromString = Schema.transform(
  Schema.NullOr(Schema.String), // Database side: null | string
  Schema.OptionFromSelf(Schema.Unknown), // TypeScript side: Option<unknown> (no OptionEncoded layer!)
  {
    strict: true,
    decode: (encoded) =>
      encoded === null ? Option.none() : Option.some(JSON.parse(encoded)),
    encode: (decoded) =>
      Option.isNone(decoded) ? null : JSON.stringify(decoded.value),
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SQLite Boolean Schema Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SQLite stores booleans as 0/1 integers.
 * This schema transforms between SQLite INTEGER (0/1) and TypeScript boolean.
 *
 * - Database (encoded): 0 | 1
 * - TypeScript (decoded): boolean
 */
const SqliteBoolean = Schema.transform(
  Schema.Union(Schema.Literal(0), Schema.Literal(1), Schema.Boolean), // Accept both int and bool from DB
  Schema.Boolean,
  {
    strict: true,
    decode: (encoded) => encoded === 1 || encoded === true,
    encode: (decoded) => (decoded ? 1 : 0),
  }
);

import {
  AssetId,
  AssetKind,
  AssetLabel,
  AssetDescription,
  SiteId,
  SectorId,
  ContainerId,
  Tags,
} from '../../core/schemas/identifiers';
import { AssetStatus } from '../schemas/asset';

// ─────────────────────────────────────────────────────────────────────────────
// SQL Model Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset SQL Model
 *
 * Database representation of an asset with:
 * - Model.Generated: id is database-generated (auto-increment or UUID)
 * - Model.DateTimeInsert: createdAt set on insert
 * - Model.DateTimeUpdate: updatedAt set on update
 *
 * Variants:
 * - AssetModel: select schema (full entity)
 * - AssetModel.insert: insert schema (without generated fields)
 * - AssetModel.update: update schema (with id for WHERE clause)
 * - AssetModel.json: JSON API schema
 */

export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  /** Primary key - database generated */
  id: Model.GeneratedByApp(AssetId),

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
  basePropertiesJson: NullableJsonFromString,

  /** Tags as JSON array */
  tagsJson: NullableJsonFromString,

  /** Optimistic concurrency version */
  version: Schema.Number.pipe(Schema.int()),

  /** Created timestamp - set on insert (ISO string for SQLite compatibility) */
  createdAt: Model.DateTimeInsert,

  /** Updated timestamp - set on update (ISO string for SQLite compatibility) */
  updatedAt: Model.DateTimeUpdate,
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
});

// ─────────────────────────────────────────────────────────────────────────────
// Location Models (for joins)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Site SQL Model
 */
export class SiteModel extends Model.Class<SiteModel>('SiteModel')({
  id: Model.GeneratedByApp(SiteId),
  bfoClass: Schema.String,
  name: Schema.NonEmptyTrimmedString,
  geoFrameJson: NullableJsonFromString,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

export const makeSiteRepository = Model.makeRepository(SiteModel, {
  tableName: 'sites',
  idColumn: 'id',
  spanPrefix: 'SiteRepository',
});

/**
 * Sector SQL Model
 */
export class SectorModel extends Model.Class<SectorModel>('SectorModel')({
  id: Model.GeneratedByApp(SectorId),
  bfoClass: Schema.String,
  siteId: SiteId,
  sectorTypeId: Schema.String,
  name: Schema.NonEmptyTrimmedString,
  footprintJson: NullableJsonFromString,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

export const makeSectorRepository = Model.makeRepository(SectorModel, {
  tableName: 'sectors',
  idColumn: 'id',
  spanPrefix: 'SectorRepository',
});

/**
 * Container SQL Model
 */
export class ContainerModel extends Model.Class<ContainerModel>(
  'ContainerModel'
)({
  id: Model.GeneratedByApp(ContainerId),
  bfoClass: Schema.String,
  siteId: SiteId,
  sectorId: Model.FieldOption(SectorId),
  containerTypeId: Schema.String,
  label: Schema.NonEmptyTrimmedString,
  parentContainerId: Model.FieldOption(ContainerId),
  isMobile: SqliteBoolean,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

export const makeContainerRepository = Model.makeRepository(ContainerModel, {
  tableName: 'containers',
  idColumn: 'id',
  spanPrefix: 'ContainerRepository',
});

// ─────────────────────────────────────────────────────────────────────────────
// Property & Trait Models
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset Property SQL Model (EAV pattern)
 */
export class AssetPropertyModel extends Model.Class<AssetPropertyModel>(
  'AssetPropertyModel'
)({
  id: Model.Generated(Schema.Number.pipe(Schema.int())),
  assetId: AssetId,
  key: Schema.NonEmptyTrimmedString,
  value: Schema.String,
  provenanceJson: Model.JsonFromString(Schema.Unknown),
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

export const makeAssetPropertyRepository = Model.makeRepository(
  AssetPropertyModel,
  {
    tableName: 'asset_properties',
    idColumn: 'id',
    spanPrefix: 'AssetPropertyRepository',
  }
);

/**
 * Asset Trait SQL Model
 */
export class AssetTraitModel extends Model.Class<AssetTraitModel>(
  'AssetTraitModel'
)({
  id: Model.Generated(Schema.Number.pipe(Schema.int())),
  assetId: AssetId,
  traitId: Schema.NonEmptyTrimmedString,
  configJson: NullableJsonFromString,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

export const makeAssetTraitRepository = Model.makeRepository(AssetTraitModel, {
  tableName: 'asset_traits',
  idColumn: 'id',
  spanPrefix: 'AssetTraitRepository',
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Journal Model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event Journal SQL Model
 *
 * Stores domain events for event sourcing.
 * Used by EventLog for persistence.
 */
export class EventJournalModel extends Model.Class<EventJournalModel>(
  'EventJournalModel'
)({
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
  occurredAt: Model.DateTimeInsert,

  /** Version for optimistic concurrency */
  aggregateVersion: Schema.Number.pipe(Schema.int()),
}) {}

export const makeEventJournalRepository = Model.makeRepository(
  EventJournalModel,
  {
    tableName: 'event_journal',
    idColumn: 'sequenceNumber',
    spanPrefix: 'EventJournalRepository',
  }
);
