/**
 * IIoT WorkCell Entity Schema
 *
 * ISA-95 Level 1 - Work Cell / Work Unit.
 * A grouping of machines that work together to perform a coordinated operation.
 * Sits between Line and Machine in the hierarchy.
 *
 * ISA-95 Automation Level: L1 (PLC/DCS - Work Unit)
 *
 * @module @gbg/tmnl/iiot/schemas/assets/workcell
 * @see ISA-95/IEC 62264 for Work Cell definition
 */

import { Schema } from 'effect'
import { AssetStatus, AssetMetadata, BaseAssetFields } from '../common/types'
import { LineId } from '../line/schema'
import { HierarchyPath } from '../../hierarchy'

// =============================================================================
// WorkCell Identifier
// =============================================================================

/**
 * WorkCell identifier with embedded slug.
 * Pattern: 'WCL-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const workCellId = makeWorkCellId('welding-01') // 'WCL-welding-01'
 * const workCellId2 = makeWorkCellId('assembly-station-a') // 'WCL-assembly-station-a'
 * ```
 */
export const WorkCellId = Schema.String.pipe(
  Schema.pattern(/^WCL-[a-zA-Z0-9-]+$/),
  Schema.brand('WorkCellId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/WorkCellId',
    description: 'Work cell identifier with WCL- prefix',
  })
)
export type WorkCellId = typeof WorkCellId.Type

/**
 * Factory function to create a WorkCellId from a slug.
 *
 * @param slug - The slug portion (alphanumeric with hyphens)
 * @returns A branded WorkCellId
 *
 * @example
 * ```ts
 * const id = makeWorkCellId('welding-01') // 'WCL-welding-01'
 * ```
 */
export const makeWorkCellId = (slug: string): WorkCellId =>
  `WCL-${slug}` as WorkCellId

// =============================================================================
// WorkCell Entity
// =============================================================================

/**
 * Work Cell Entity Schema (ISA-95 Level 1 - Work Unit)
 *
 * A grouping of machines that work together to perform a coordinated operation.
 * Work cells sit between Lines and Machines in the ISA-95 hierarchy.
 *
 * ISA-95 Hierarchy: Plant -> Line -> **WorkCell** -> Machine -> Sensor
 *
 * @example
 * ```ts
 * import { DateTime, Option } from 'effect'
 *
 * const weldingCell = new WorkCellSchema({
 *   id: makeWorkCellId('welding-01'),
 *   name: 'Welding Station 1',
 *   status: 'active',
 *   lineId: 'LIN-assembly-01' as LineId,
 *   enterpriseId: Option.some('ENT-acme' as EnterpriseId),
 *   siteId: Option.some('SIT-chicago' as SiteId),
 *   plantId: Option.some('PLT-main' as PlantId),
 *   hierarchyPath: HierarchyPath.empty(),
 *   cellType: Option.some('welding'),
 *   cycleTimeSeconds: Option.some(45),
 *   position: Option.some(3),
 *   description: Option.some('Primary welding station for frame assembly'),
 *   createdAt: DateTime.unsafeNow(),
 *   updatedAt: Option.none(),
 *   metadata: {},
 * })
 *
 * weldingCell.isOperational() // true
 * weldingCell.getAutomationLevel() // 1
 * weldingCell.isContainer() // true
 * weldingCell.materializePath() // '/ENT-acme/SIT-chicago/PLT-main/LIN-assembly-01/WCL-welding-01'
 * ```
 */
export class WorkCellSchema extends Schema.TaggedClass<WorkCellSchema>()('WorkCell', {
  /** Unique work cell identifier (pattern: WCL-{slug}) */
  id: WorkCellId,

  /** Spread BaseAssetFields for common asset properties */
  ...BaseAssetFields,

  /** Work cell type classification (e.g., 'assembly', 'welding', 'packaging') */
  cellType: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Cycle time in seconds for the work cell operation */
  cycleTimeSeconds: Schema.optionalWith(
    Schema.Number.pipe(Schema.positive()),
    { as: 'Option' }
  ),

  /** Sequence position in the parent line (0-indexed) */
  position: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    { as: 'Option' }
  ),
}) {
  /**
   * Get ISA-95 automation level.
   * Work cells operate at Level 1 (PLC/DCS control - Work Unit).
   *
   * @returns 1 - ISA-95 Level 1
   */
  getAutomationLevel(): 1 {
    return 1
  }

  /**
   * Check if the work cell is operational.
   * A work cell is operational if not in maintenance or decommissioned.
   *
   * @returns true if status is 'active' or 'inactive'
   */
  isOperational(): boolean {
    return this.status !== 'maintenance' && this.status !== 'decommissioned'
  }

  /**
   * Check if this asset is a container.
   * Work cells are containers - they hold machines and equipment.
   *
   * @returns true - work cells always contain machines
   */
  isContainer(): true {
    return true
  }

  /**
   * Materialize the hierarchy path to a string representation.
   * Delegates to the underlying HierarchyPath instance.
   *
   * @returns The materialized path string (e.g., '/ENT-acme/SIT-chicago/PLT-main/LIN-assembly-01/WCL-welding-01')
   */
  materializePath(): string {
    return this.hierarchyPath.toString()
  }
}

// =============================================================================
// Create WorkCell Parameters
// =============================================================================

/**
 * Parameters for creating a new WorkCell.
 * Used by command handlers and API endpoints.
 *
 * @example
 * ```ts
 * const params: CreateWorkCellParams = {
 *   slug: 'welding-01',
 *   name: 'Welding Station 1',
 *   lineId: 'LIN-assembly-01' as LineId,
 *   status: 'active',
 *   cellType: 'welding',
 *   cycleTimeSeconds: 45,
 *   position: 3,
 * }
 * ```
 */
export const CreateWorkCellParams = Schema.Struct({
  /** Slug for generating WorkCellId (will be prefixed with 'WCL-') */
  slug: Schema.NonEmptyString.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.annotations({
      description: 'URL-safe slug for the work cell ID',
    })
  ),

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Parent line identifier */
  lineId: LineId,

  /** Initial status (defaults to 'active' if not provided) */
  status: Schema.optionalWith(AssetStatus, { default: () => 'active' as const }),

  /** Work cell type classification */
  cellType: Schema.optional(Schema.String),

  /** Cycle time in seconds */
  cycleTimeSeconds: Schema.optional(Schema.Number.pipe(Schema.positive())),

  /** Sequence position in the parent line */
  position: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.nonNegative())
  ),

  /** Optional description */
  description: Schema.optional(Schema.String),

  /** Initial metadata */
  metadata: Schema.optional(AssetMetadata),
}).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/CreateWorkCellParams',
    description: 'Parameters for creating a new work cell',
  })
)
export type CreateWorkCellParams = Schema.Schema.Type<typeof CreateWorkCellParams>

// =============================================================================
// WorkCell Namespace
// =============================================================================

/**
 * WorkCell namespace providing access to schema and type.
 *
 * @example
 * ```ts
 * import { WorkCell } from '@gbg/tmnl/iiot/schemas/assets/workcell'
 *
 * const cell: WorkCell.Type = new WorkCell.Schema({ ... })
 * ```
 */
export namespace WorkCell {
  /** The WorkCell schema class */
  export const Schema = WorkCellSchema

  /** Type derived from WorkCellSchema */
  export type Type = typeof WorkCellSchema.Type
}
