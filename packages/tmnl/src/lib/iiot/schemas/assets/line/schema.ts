/**
 * IIoT Line Entity Schema
 *
 * ISA-95 Work Center - represents a production line within a plant.
 * Lines are containers that hold machines and equipment.
 *
 * ISA-95 Automation Level: L1 (PLC/DCS)
 *
 * @module @gbg/tmnl/iiot/schemas/assets/line
 * @see ISA-95/IEC 62264 for Work Center definition
 */

import { Schema } from 'effect'
import { AssetStatus, AssetMetadata, BaseAssetFields } from '../common/types'
import { HierarchyPath } from '../../hierarchy'
import { PlantId } from '../plant/schema'

// =============================================================================
// Line Identifier
// =============================================================================

/**
 * Line identifier with embedded slug.
 * Pattern: 'LIN-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const lineId = makeLineId('assembly-01') // 'LIN-assembly-01'
 * const lineId2 = makeLineId('packaging-a') // 'LIN-packaging-a'
 * ```
 */
export const LineId = Schema.String.pipe(
  Schema.pattern(/^LIN-[a-zA-Z0-9-]+$/),
  Schema.brand('LineId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/LineId',
    description: 'Production line identifier with LIN- prefix',
  })
)
export type LineId = typeof LineId.Type

/**
 * Factory function to create a LineId from a slug.
 *
 * @param slug - The slug portion (alphanumeric with hyphens)
 * @returns A branded LineId
 *
 * @example
 * ```ts
 * const id = makeLineId('assembly-01') // 'LIN-assembly-01'
 * ```
 */
export const makeLineId = (slug: string): LineId => `LIN-${slug}` as LineId

// =============================================================================
// Line Entity
// =============================================================================

/**
 * Production Line Entity (ISA-95 Work Center)
 *
 * Represents a production line within a plant. Lines contain machines
 * and equipment organized for a specific production process.
 *
 * ISA-95 Hierarchy: Plant → **Line** → Machine → Sensor
 *
 * @example
 * ```ts
 * import { DateTime, Option } from 'effect'
 *
 * const assemblyLine = new LineSchema({
 *   id: makeLineId('assembly-01'),
 *   name: 'Assembly Line 1',
 *   status: 'active',
 *   hierarchyPath: HierarchyPath.fromSegments([...]),
 *   enterpriseId: Option.some('ENT-acme' as EnterpriseId),
 *   siteId: Option.some('SIT-chicago' as SiteId),
 *   plantId: Option.some('PLT-main' as PlantId),
 *   capacity: Option.some(500),
 *   lineType: Option.some('assembly'),
 *   operatingHoursPerDay: Option.some(16),
 *   description: Option.some('Primary assembly line for widget production'),
 *   createdAt: DateTime.unsafeNow(),
 *   updatedAt: Option.none(),
 *   metadata: {},
 * })
 *
 * assemblyLine.isOperational() // true
 * assemblyLine.getAutomationLevel() // 1
 * assemblyLine.isContainer() // true
 * assemblyLine.materializePath() // '/ENT-acme/SIT-chicago/PLT-main/LIN-assembly-01'
 * ```
 */
export class LineSchema extends Schema.TaggedClass<LineSchema>()('Line', {
  /** Unique line identifier (pattern: LIN-{slug}) */
  id: LineId,

  /** Base asset fields (name, status, description, location, metadata, timestamps, hierarchy) */
  ...BaseAssetFields,

  /** Production capacity in units per hour */
  capacity: Schema.optionalWith(
    Schema.Number.pipe(Schema.positive()),
    { as: 'Option' }
  ),

  /** Line type classification (e.g., 'assembly', 'packaging', 'testing') */
  lineType: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Operating hours per day (0-24) */
  operatingHoursPerDay: Schema.optionalWith(
    Schema.Number.pipe(Schema.between(0, 24)),
    { as: 'Option' }
  ),
}) {
  /**
   * Get ISA-95 automation level.
   * Lines operate at Level 1 (PLC/DCS control).
   *
   * @returns 1 - ISA-95 Level 1
   */
  getAutomationLevel(): 1 {
    return 1
  }

  /**
   * Check if the line is operational.
   * A line is operational if not in maintenance or decommissioned.
   *
   * @returns true if status is 'active' or 'inactive'
   */
  isOperational(): boolean {
    return this.status !== 'maintenance' && this.status !== 'decommissioned'
  }

  /**
   * Check if this asset is a container.
   * Lines are containers - they hold machines and equipment.
   *
   * @returns true - lines always contain machines
   */
  isContainer(): true {
    return true
  }

  /**
   * Materialize the hierarchy path to a string.
   * Convenience method for accessing the path string representation.
   *
   * @returns Materialized path string (e.g., '/ENT-acme/SIT-chicago/PLT-main/LIN-assembly-01')
   */
  materializePath(): string {
    return this.hierarchyPath.toString()
  }
}

// =============================================================================
// Line Namespace + Type
// =============================================================================

/**
 * Line namespace containing schema and type utilities.
 */
export namespace Line {
  /** Line schema class */
  export const Schema = LineSchema
  /** Line type derived from schema */
  export type Type = typeof LineSchema.Type
}

/**
 * Line type alias for backward compatibility.
 */
export type Line = Line.Type

// =============================================================================
// Create Line Parameters
// =============================================================================

/**
 * Parameters for creating a new Line.
 * Used by command handlers and API endpoints.
 *
 * @example
 * ```ts
 * const params: CreateLineParams = {
 *   slug: 'assembly-01',
 *   name: 'Assembly Line 1',
 *   plantId: 'PLT-chicago' as PlantId,
 *   status: 'active',
 *   capacity: 500,
 *   lineType: 'assembly',
 *   operatingHoursPerDay: 16,
 * }
 * ```
 */
export const CreateLineParams = Schema.Struct({
  /** Slug for generating LineId (will be prefixed with 'LIN-') */
  slug: Schema.NonEmptyString.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.annotations({
      description: 'URL-safe slug for the line ID',
    })
  ),

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Parent plant identifier */
  plantId: PlantId,

  /** Initial status (defaults to 'active' if not provided) */
  status: Schema.optionalWith(AssetStatus, { default: () => 'active' as const }),

  /** Production capacity in units per hour */
  capacity: Schema.optional(Schema.Number.pipe(Schema.positive())),

  /** Line type classification */
  lineType: Schema.optional(Schema.String),

  /** Operating hours per day (0-24) */
  operatingHoursPerDay: Schema.optional(
    Schema.Number.pipe(Schema.between(0, 24))
  ),

  /** Optional description */
  description: Schema.optional(Schema.String),

  /** Initial metadata */
  metadata: Schema.optional(AssetMetadata),
}).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/CreateLineParams',
    description: 'Parameters for creating a new production line',
  })
)
export type CreateLineParams = Schema.Schema.Type<typeof CreateLineParams>
