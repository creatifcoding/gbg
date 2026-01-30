/**
 * IIoT Asset Schema
 *
 * Polymorphic Asset entity following ISA-95 equipment hierarchy.
 * All equipment levels (Enterprise → Site → Area → Line → Machine → Sensor)
 * are represented as a single Asset class with `kind` discriminator.
 *
 * This follows the AMS v2 pattern: single domain schema with polymorphism,
 * separate Model.Class for persistence.
 *
 * @module @gbg/tmnl/iiot/schemas/asset
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 * @see ADR-0012 for persistence strategy (CRUD, not ES)
 */

import { Schema } from 'effect'
import { AssetId, EquipmentLevel } from './identifiers'

// Re-export specific identifiers for convenience
export {
  EnterpriseId,
  SiteId,
  AreaId,
  PlantId,
  LineId,
  MachineId,
  DeviceId,
} from './identifiers'

// =============================================================================
// Asset Status
// =============================================================================

/**
 * Asset operational status.
 * Used for lifecycle management and filtering.
 */
export const AssetStatus = Schema.Literal(
  'active',
  'inactive',
  'maintenance',
  'decommissioned'
).pipe(
  Schema.brand('@gbg/tmnl/iiot/Asset/fields/AssetStatus'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/AssetStatus',
    description: 'Current operational status of an asset',
  })
)
export type AssetStatus = typeof AssetStatus.Type

// =============================================================================
// Asset Location
// =============================================================================

/**
 * Physical location information for an asset.
 * Supports GPS coordinates, building/zone, and timezone.
 */
export class AssetLocation extends Schema.TaggedClass<AssetLocation>()('AssetLocation', {
  /** GPS latitude (-90 to 90) */
  latitude: Schema.optional(Schema.Number.pipe(Schema.between(-90, 90))),
  /** GPS longitude (-180 to 180) */
  longitude: Schema.optional(Schema.Number.pipe(Schema.between(-180, 180))),
  /** Building/facility name */
  building: Schema.optional(Schema.String),
  /** Floor/level within building */
  floor: Schema.optional(Schema.String),
  /** Zone/area designation */
  zone: Schema.optional(Schema.String),
  /** Free-form address */
  address: Schema.optional(Schema.String),
  /** IANA timezone (e.g., 'America/Chicago') */
  timezone: Schema.optional(Schema.String),
}) {}

// =============================================================================
// Asset Properties
// =============================================================================

/**
 * Extensible asset properties for custom attributes.
 * Stored as JSONB in the database.
 */
export const AssetProperties = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})
export type AssetProperties = Schema.Schema.Type<typeof AssetProperties>

// =============================================================================
// Sensor-Specific Properties
// =============================================================================

/** Supported sensor measurement types */
export const SensorType = Schema.Literal(
  'temperature',
  'vibration',
  'humidity',
  'speed',
  'current',
  'pressure',
  'flow',
  'level'
)
export type SensorType = Schema.Schema.Type<typeof SensorType>

/** Measurement unit strings */
export const MeasurementUnit = Schema.Literal(
  'celsius',
  'fahrenheit',
  'mm/s',
  'percent',
  'm/min',
  'amps',
  'psi',
  'bar',
  'l/min',
  'gpm',
  'meters',
  'feet'
)
export type MeasurementUnit = Schema.Schema.Type<typeof MeasurementUnit>

/**
 * Sensor-specific properties (when kind === 'sensor').
 * Embedded in Asset.properties for sensors.
 */
export class SensorProperties extends Schema.TaggedClass<SensorProperties>()('SensorProperties', {
  /** Sensor measurement type */
  sensorType: SensorType,
  /** Measurement unit */
  unit: MeasurementUnit,
  /** Sample rate in milliseconds */
  sampleRateMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  /** High threshold for alarms */
  thresholdHigh: Schema.optional(Schema.Number),
  /** Critical threshold for alarms */
  thresholdCritical: Schema.optional(Schema.Number),
}) {}

// =============================================================================
// Asset Entity (Polymorphic)
// =============================================================================

/**
 * IIoT Asset Entity
 *
 * Single polymorphic schema for all equipment levels in the ISA-95 hierarchy.
 * The `kind` field discriminates between enterprise, site, area, line, machine, sensor.
 *
 * @example
 * ```ts
 * // Create a plant (site level)
 * const plant = new Asset({
 *   id: AssetId.make('PLANT-A'),
 *   name: 'Chicago Assembly',
 *   kind: 'site',
 *   status: 'active',
 *   location: new AssetLocation({ timezone: 'America/Chicago' }),
 *   createdAt: DateTime.unsafeNow(),
 * })
 *
 * // Create a sensor (control module)
 * const sensor = new Asset({
 *   id: AssetId.make('TMP-001'),
 *   name: 'Temperature Sensor Alpha',
 *   kind: 'sensor',
 *   status: 'active',
 *   parentId: AssetId.make('MCH-001'),
 *   properties: { sensorType: 'temperature', unit: 'celsius' },
 *   createdAt: DateTime.unsafeNow(),
 * })
 * ```
 */
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  /** Unique asset identifier */
  id: AssetId,

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Equipment level (ISA-95 hierarchy) */
  kind: EquipmentLevel,

  /** Operational status */
  status: AssetStatus,

  /** Optional description */
  description: Schema.optional(Schema.String),

  /** Physical location (optional) */
  location: Schema.optional(AssetLocation),

  /** Custom properties (sensor-specific, model info, etc.) */
  properties: Schema.optional(AssetProperties),

  /** Parent asset ID in hierarchy (optional for top-level) */
  parentId: Schema.optional(AssetId),

  /** Creation timestamp */
  createdAt: Schema.DateTimeUtc,

  /** Last update timestamp */
  updatedAt: Schema.optional(Schema.DateTimeUtc),
}) {
  /**
   * Check if asset is operational (not in maintenance or decommissioned)
   */
  isOperational(): boolean {
    return this.status !== 'maintenance' && this.status !== 'decommissioned'
  }

  /**
   * Check if asset is active
   */
  isActive(): boolean {
    return this.status === 'active'
  }

  /**
   * Check if this asset is a container (can have children)
   */
  isContainer(): boolean {
    return this.kind !== 'sensor'
  }

  /**
   * Check if this is a sensor (leaf node)
   */
  isSensor(): boolean {
    return this.kind === 'sensor'
  }

  /**
   * Get ISA-95 automation level
   */
  getAutomationLevel(): 0 | 1 | 2 | 3 | 4 {
    switch (this.kind) {
      case 'enterprise': return 4
      case 'site': return 3
      case 'area': return 2
      case 'line': return 1
      case 'machine': return 1
      case 'sensor': return 0
    }
  }
}
export type AssetType = typeof Asset.Type

// =============================================================================
// Asset Summary (Lightweight Projection)
// =============================================================================

/**
 * Lightweight asset projection for lists and quick lookups.
 */
export class AssetSummary extends Schema.TaggedClass<AssetSummary>()('AssetSummary', {
  id: AssetId,
  name: Schema.NonEmptyString,
  kind: EquipmentLevel,
  status: AssetStatus,
  parentId: Schema.optional(AssetId),
}) {}
export type AssetSummaryType = typeof AssetSummary.Type

// =============================================================================
// Asset Hierarchy (Denormalized for Queries)
// =============================================================================

/**
 * Full asset hierarchy path (denormalized).
 * Used for breadcrumb displays and navigation.
 */
export class AssetHierarchy extends Schema.TaggedClass<AssetHierarchy>()('AssetHierarchy', {
  /** Asset at this level */
  asset: Asset,
  /** Path from root to this asset (asset IDs) */
  path: Schema.Array(AssetId),
  /** Depth in hierarchy (0 = root) */
  depth: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}) {}

/**
 * Asset with its direct children (single level).
 * For full tree views, use recursive queries with AssetHierarchy.
 */
export class AssetWithChildren extends Schema.TaggedClass<AssetWithChildren>()('AssetWithChildren', {
  /** Parent asset summary */
  asset: AssetSummary,
  /** Direct children summaries */
  children: Schema.Array(AssetSummary),
}) {}

// =============================================================================
// Create/Update Parameters
// =============================================================================

/**
 * Parameters for creating a new asset.
 */
export const CreateAssetParams = Schema.Struct({
  name: Schema.NonEmptyString,
  kind: EquipmentLevel,
  status: Schema.optional(AssetStatus),
  description: Schema.optional(Schema.String),
  location: Schema.optional(AssetLocation),
  properties: Schema.optional(AssetProperties),
  parentId: Schema.optional(AssetId),
})
export type CreateAssetParams = Schema.Schema.Type<typeof CreateAssetParams>

/**
 * Parameters for updating an asset.
 */
export const UpdateAssetParams = Schema.Struct({
  id: AssetId,
  name: Schema.optional(Schema.NonEmptyString),
  status: Schema.optional(AssetStatus),
  description: Schema.optional(Schema.String),
  location: Schema.optional(AssetLocation),
  properties: Schema.optional(AssetProperties),
  parentId: Schema.optional(AssetId),
})
export type UpdateAssetParams = Schema.Schema.Type<typeof UpdateAssetParams>

/**
 * Parameters for querying assets.
 */
export const AssetQueryParams = Schema.Struct({
  kind: Schema.optional(EquipmentLevel),
  status: Schema.optional(AssetStatus),
  parentId: Schema.optional(AssetId),
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  offset: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
})
export type AssetQueryParams = Schema.Schema.Type<typeof AssetQueryParams>

// =============================================================================
// Legacy Aliases (Backward Compatibility)
// =============================================================================

/**
 * @deprecated Use Asset with kind='site' instead
 */
export const Plant = Asset
export type Plant = Asset

/**
 * @deprecated Use Asset with kind='line' instead
 */
export const Line = Asset
export type Line = Asset

/**
 * @deprecated Use Asset with kind='machine' instead
 */
export const Machine = Asset
export type Machine = Asset

/**
 * @deprecated Use Asset with kind='sensor' instead
 */
export const Sensor = Asset
export type Sensor = Asset
