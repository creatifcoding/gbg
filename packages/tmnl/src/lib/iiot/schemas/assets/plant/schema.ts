/**
 * Plant Entity Schema
 *
 * ISA-95 Level 3 (Site) - Manufacturing facility/plant.
 * Plants are containers that hold production lines.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/plant
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema } from 'effect'
import { AssetStatus, AssetLocation, AssetMetadata, BaseAssetFields } from '../common/types'
import { HierarchyPath } from '../../hierarchy'

// =============================================================================
// Plant Identifier
// =============================================================================

/**
 * Plant identifier with embedded slug.
 * Format: 'PLT-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const id = makePlantId('chicago-assembly') // 'PLT-chicago-assembly'
 * ```
 */
export const PlantId = Schema.String.pipe(
  Schema.pattern(/^PLT-[a-zA-Z0-9-]+$/),
  Schema.brand('PlantId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/PlantId',
    description: 'Plant identifier with PLT- prefix and slug',
  })
)
export type PlantId = typeof PlantId.Type

/**
 * Factory function to create a PlantId from a slug.
 *
 * @param slug - Alphanumeric slug with hyphens (e.g., 'chicago-assembly')
 * @returns PlantId branded string (e.g., 'PLT-chicago-assembly')
 */
export const makePlantId = (slug: string): PlantId => `PLT-${slug}` as PlantId

// =============================================================================
// Plant Entity
// =============================================================================

/**
 * Plant Entity - ISA-95 Level 3 (Site)
 *
 * Represents a manufacturing facility or plant in the equipment hierarchy.
 * Plants are containers that hold production lines (Level 2).
 * Parent: Area or Site (enterpriseId, siteId required, areaId optional)
 *
 * @example
 * ```ts
 * const plant = new PlantSchema({
 *   id: makePlantId('chicago-assembly'),
 *   name: 'Chicago Assembly Plant',
 *   status: 'active',
 *   timezone: 'America/Chicago',
 *   hierarchyPath: HierarchyPath.fromSegments([...]),
 *   enterpriseId: 'ENT-acme' as EnterpriseId,
 *   siteId: 'SIT-chicago' as SiteId,
 *   createdAt: DateTime.unsafeNow(),
 * })
 *
 * plant.getAutomationLevel() // 3
 * plant.isOperational() // true
 * plant.isContainer() // true
 * plant.materializePath() // '/ENT-acme/SIT-chicago/PLT-chicago-assembly'
 * ```
 */
export class PlantSchema extends Schema.TaggedClass<PlantSchema>()('Plant', {
  /** Unique plant identifier (PLT-{slug} format) */
  id: PlantId,

  // Spread base asset fields (name, status, description, location, metadata, timestamps, hierarchy)
  ...BaseAssetFields,

  /** IANA timezone identifier (e.g., 'America/Chicago') */
  timezone: Schema.String.pipe(
    Schema.annotations({
      description: 'IANA timezone identifier for the plant location',
    })
  ),

  /** ERP site code for integration */
  siteCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  /**
   * Get ISA-95 automation level.
   * Plants are Level 3 (Site/MES).
   */
  getAutomationLevel(): 3 {
    return 3
  }

  /**
   * Check if plant is operational.
   * A plant is operational if it's active or inactive (not in maintenance or decommissioned).
   */
  isOperational(): boolean {
    return this.status === 'active' || this.status === 'inactive'
  }

  /**
   * Check if this asset is a container.
   * Plants always contain lines, so this returns true.
   */
  isContainer(): true {
    return true
  }

  /**
   * Materialize the hierarchy path to a string.
   * @returns String representation of the hierarchy path (e.g., '/ENT-acme/SIT-chicago/PLT-chicago-assembly')
   */
  materializePath(): string {
    return this.hierarchyPath.toString()
  }
}

// =============================================================================
// Plant Namespace + Type
// =============================================================================

/**
 * Plant namespace containing schema and type utilities.
 *
 * Usage:
 * - `Plant.Schema` - The Effect Schema class for encoding/decoding
 * - `Plant.Type` - The TypeScript type (same as `Plant`)
 * - `type Plant` - Same as `Plant.Type` (via declaration merging)
 */
export namespace Plant {
  /** Plant schema class */
  export const Schema = PlantSchema
  /** Plant type derived from schema */
  export type Type = typeof PlantSchema.Type
}

/**
 * Plant type alias for backward compatibility.
 * Allows `import type { Plant }` to work as a type.
 */
export type Plant = Plant.Type

// =============================================================================
// Create Plant Parameters
// =============================================================================

/**
 * Parameters for creating a new Plant.
 * Used in command handlers and service methods.
 */
export const CreatePlantParams = Schema.Struct({
  /** Slug for the plant ID (will be prefixed with 'PLT-') */
  slug: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.annotations({
      description: 'Alphanumeric slug for plant ID (e.g., "chicago-assembly")',
    })
  ),

  /** Human-readable plant name */
  name: Schema.NonEmptyString,

  /** IANA timezone identifier */
  timezone: Schema.String,

  /** Initial status (defaults to 'active' in handler) */
  status: Schema.optionalWith(AssetStatus, { as: 'Option' }),

  /** ERP site code */
  siteCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Optional description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Physical location */
  location: Schema.optionalWith(AssetLocation, { as: 'Option' }),

  /** Initial metadata */
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
})
export type CreatePlantParams = Schema.Schema.Type<typeof CreatePlantParams>

// =============================================================================
// Update Plant Parameters
// =============================================================================

/**
 * Parameters for updating an existing Plant.
 */
export const UpdatePlantParams = Schema.Struct({
  /** Plant ID to update */
  id: PlantId,

  /** Updated name */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated status */
  status: Schema.optionalWith(AssetStatus, { as: 'Option' }),

  /** Updated timezone */
  timezone: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated site code */
  siteCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated location */
  location: Schema.optionalWith(AssetLocation, { as: 'Option' }),

  /** Updated metadata (merged with existing) */
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
})
export type UpdatePlantParams = Schema.Schema.Type<typeof UpdatePlantParams>
