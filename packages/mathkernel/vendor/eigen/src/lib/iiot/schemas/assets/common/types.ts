/**
 * Common Asset Types
 *
 * Shared schemas for all asset entities in the ISA-95 hierarchy.
 * These are imported by Plant, Line, Machine, and Sensor schemas.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/common
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema } from 'effect'
import {
  EnterpriseId,
  SiteId,
  AreaId,
  PlantId,
  LineId,
  WorkCellId,
  MachineId,
} from '../../identifiers'
import { HierarchyPath } from '../../hierarchy'

// =============================================================================
// Asset Status
// =============================================================================

/**
 * Asset operational status.
 * Used for lifecycle management and filtering across all asset types.
 */
export const AssetStatus = Schema.Literal(
  'active',
  'inactive',
  'maintenance',
  'decommissioned'
).pipe(
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
 * Supports GPS coordinates, building/zone, and address.
 */
export class AssetLocation extends Schema.TaggedClass<AssetLocation>()('AssetLocation', {
  /** GPS latitude (-90 to 90) */
  latitude: Schema.optionalWith(Schema.Number.pipe(Schema.between(-90, 90)), { as: 'Option' }),
  /** GPS longitude (-180 to 180) */
  longitude: Schema.optionalWith(Schema.Number.pipe(Schema.between(-180, 180)), { as: 'Option' }),
  /** Building/facility name */
  building: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Floor/level within building */
  floor: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Zone/area designation */
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Free-form address */
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** IANA timezone identifier (e.g., 'America/New_York') */
  timezone: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

// =============================================================================
// Asset Metadata
// =============================================================================

/**
 * Extensible asset metadata for custom attributes.
 * Stored as JSONB in the database.
 */
export const AssetMetadata = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})
export type AssetMetadata = Schema.Schema.Type<typeof AssetMetadata>

// =============================================================================
// Base Asset Fields
// =============================================================================

/**
 * Common fields shared by all asset types.
 * Used for field spreading into asset subclasses (Enterprise, Site, Area, Plant, Line, WorkCell, Machine, Sensor, Device).
 *
 * @example
 * ```typescript
 * class PlantSchema extends Schema.TaggedClass<PlantSchema>()('Plant', {
 *   id: PlantId,
 *   ...BaseAssetFields,
 *   // Plant-specific fields
 * }) {}
 * ```
 */
export const BaseAssetFields = {
  // ─────────────────────────────────────────────────────────────────────────
  // Core Identity
  // ─────────────────────────────────────────────────────────────────────────

  /** Human-readable asset name */
  name: Schema.NonEmptyString,
  /** Current operational status */
  status: AssetStatus,
  /** Optional description of the asset */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  // ─────────────────────────────────────────────────────────────────────────
  // Location & Metadata
  // ─────────────────────────────────────────────────────────────────────────

  /** Physical location information */
  location: Schema.optionalWith(AssetLocation, { as: 'Option' }),
  /** Extensible metadata for custom attributes (JSONB in DB) */
  metadata: Schema.optionalWith(AssetMetadata, { default: () => ({}) }),

  // ─────────────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────────────

  /** Timestamp when asset was created */
  createdAt: Schema.DateTimeUtc,
  /** Timestamp of last update */
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  // ─────────────────────────────────────────────────────────────────────────
  // Hierarchy (ISA-95 Path Tracking)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Full hierarchy path for efficient ancestor/descendant queries.
   * Contains PathSegments array + materialized string.
   *
   * @see HierarchyPath for algorithmic operations
   */
  hierarchyPath: HierarchyPath,

  /**
   * Parent entity references (optional based on level).
   *
   * These enable:
   * 1. Type-safe parent lookups
   * 2. Foreign key constraints in DDL
   * 3. Path consistency validation
   */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  areaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  plantId: Schema.optionalWith(PlantId, { as: 'Option' }),
  lineId: Schema.optionalWith(LineId, { as: 'Option' }),
  workCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),
  machineId: Schema.optionalWith(MachineId, { as: 'Option' }),
} as const
