/**
 * Area Entity Schema
 *
 * ISA-95 Level 2 (Supervisory Control) - Production Area.
 * Logical grouping within a Site, can contain Plants or Lines directly.
 * Used for SCADA/supervisory control scope.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/area
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema, Option } from 'effect'
import { AssetStatus, AssetMetadata, BaseAssetFields } from '../common/types'
import { HierarchyPath } from '../../hierarchy'
import { SiteId } from '../site/schema'
import { EnterpriseId } from '../../identifiers'

// =============================================================================
// Area Identifier
// =============================================================================

/**
 * Area identifier with embedded slug.
 * Format: 'ARA-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const id = makeAreaId('production-1') // 'ARA-production-1'
 * const id2 = makeAreaId('warehouse-east') // 'ARA-warehouse-east'
 * ```
 */
export const AreaId = Schema.String.pipe(
  Schema.pattern(/^ARA-[a-zA-Z0-9-]+$/),
  Schema.brand('AreaId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/AreaId',
    description: 'Area identifier with ARA- prefix and slug',
  })
)
export type AreaId = typeof AreaId.Type

/**
 * Factory function to create an AreaId from a slug.
 *
 * @param slug - Alphanumeric slug with hyphens (e.g., 'production-1')
 * @returns AreaId branded string (e.g., 'ARA-production-1')
 */
export const makeAreaId = (slug: string): AreaId => `ARA-${slug}` as AreaId

// =============================================================================
// Area Type
// =============================================================================

/**
 * Classification of area types within a site.
 * Used for categorization and filtering.
 */
export const AreaType = Schema.Literal(
  'production',
  'warehouse',
  'maintenance',
  'quality',
  'shipping',
  'receiving'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/AreaType',
    description: 'Classification of area types within a site',
  })
)
export type AreaType = typeof AreaType.Type

// =============================================================================
// Area Entity
// =============================================================================

/**
 * Area Entity Schema - ISA-95 Level 2 (Supervisory Control)
 *
 * Represents a production area within a site in the equipment hierarchy.
 * Areas are containers that can hold Plants or Lines directly.
 * Used for SCADA/supervisory control scope.
 *
 * ISA-95 Hierarchy: Enterprise -> Site -> **Area** -> Plant/Line -> Machine -> Sensor
 *
 * @example
 * ```ts
 * import { DateTime, Option } from 'effect'
 *
 * const productionArea = new Area({
 *   id: makeAreaId('production-1'),
 *   name: 'Production Area 1',
 *   status: 'active',
 *   siteId: Option.some('SIT-chicago-facility' as SiteId),
 *   enterpriseId: Option.some('ENT-acme' as EnterpriseId),
 *   areaType: Option.some('production'),
 *   building: Option.some('Building A'),
 *   floor: Option.some('Ground'),
 *   zone: Option.some('Zone 1'),
 *   description: Option.some('Main production area'),
 *   createdAt: DateTime.unsafeNow(),
 *   updatedAt: Option.none(),
 *   metadata: {},
 *   hierarchyPath: HierarchyPath.fromSegments([...]),
 *   location: Option.none(),
 * })
 *
 * productionArea.getAutomationLevel() // 2
 * productionArea.isOperational() // true
 * productionArea.isContainer() // true
 * productionArea.materializePath() // 'ENT-acme/SIT-chicago-facility/ARA-production-1'
 * ```
 */
export class Area extends Schema.TaggedClass<Area>()('Area', {
  /** Unique area identifier (ARA-{slug} format) */
  id: AreaId,

  // Spread common asset fields (from BaseAssetFields)
  ...BaseAssetFields,

  // Override required parent fields for Area (parent is Site)
  /** Parent enterprise identifier (required via Site) */
  enterpriseId: EnterpriseId,

  /** Parent site identifier (required - areas belong to sites) */
  siteId: SiteId,

  /** Area type classification */
  areaType: Schema.optionalWith(AreaType, { as: 'Option' }),

  /** Building/facility name within the site */
  building: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Floor/level within the building */
  floor: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Zone designation within the area */
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  /**
   * Get ISA-95 automation level.
   * Areas are Level 2 (Supervisory Control / SCADA).
   */
  getAutomationLevel(): 2 {
    return 2
  }

  /**
   * Check if area is operational.
   * An area is operational if it's active or inactive (not in maintenance or decommissioned).
   */
  isOperational(): boolean {
    return this.status !== 'maintenance' && this.status !== 'decommissioned'
  }

  /**
   * Check if this asset is a container.
   * Areas always contain plants/lines, so this returns true.
   */
  isContainer(): true {
    return true
  }

  /**
   * Materialize the hierarchy path to a string.
   * Delegates to the hierarchyPath's toString() method.
   *
   * @returns Materialized path string (e.g., 'ENT-acme/SIT-chicago/ARA-production-1')
   */
  materializePath(): string {
    return this.hierarchyPath.toString()
  }
}

/** Area entity type alias for type imports */
export type AreaEntity = typeof Area.Type

// =============================================================================
// Create Area Parameters
// =============================================================================

/**
 * Parameters for creating a new Area.
 * Used in command handlers and service methods.
 */
export const CreateAreaParams = Schema.Struct({
  /** Slug for the area ID (will be prefixed with 'ARA-') */
  slug: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.annotations({
      description: 'Alphanumeric slug for area ID (e.g., "production-1")',
    })
  ),

  /** Human-readable area name */
  name: Schema.NonEmptyString,

  /** Parent site identifier */
  siteId: SiteId,

  /** Initial status (defaults to 'active' in handler) */
  status: Schema.optionalWith(AssetStatus, { as: 'Option' }),

  /** Area type classification */
  areaType: Schema.optional(AreaType),

  /** Building/facility name */
  building: Schema.optional(Schema.String),

  /** Floor/level within building */
  floor: Schema.optional(Schema.String),

  /** Zone designation */
  zone: Schema.optional(Schema.String),

  /** Optional description */
  description: Schema.optional(Schema.String),

  /** Initial metadata */
  metadata: Schema.optional(AssetMetadata),
}).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/CreateAreaParams',
    description: 'Parameters for creating a new production area',
  })
)
export type CreateAreaParams = Schema.Schema.Type<typeof CreateAreaParams>

// =============================================================================
// Update Area Parameters
// =============================================================================

/**
 * Parameters for updating an existing Area.
 */
export const UpdateAreaParams = Schema.Struct({
  /** Area ID to update */
  id: AreaId,

  /** Updated name */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated status */
  status: Schema.optionalWith(AssetStatus, { as: 'Option' }),

  /** Updated area type */
  areaType: Schema.optionalWith(AreaType, { as: 'Option' }),

  /** Updated building */
  building: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated floor */
  floor: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated zone */
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated metadata (merged with existing) */
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
}).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/UpdateAreaParams',
    description: 'Parameters for updating an existing production area',
  })
)
export type UpdateAreaParams = Schema.Schema.Type<typeof UpdateAreaParams>
