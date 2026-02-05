/**
 * Machine Entity Schema
 *
 * ISA-95 Work Unit - the fundamental processing equipment within a production line.
 * Machines contain sensors and represent discrete pieces of production equipment.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/machine
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema } from 'effect'
import { AssetStatus, AssetMetadata, BaseAssetFields } from '../common/types'
import { EnterpriseId, SiteId, PlantId, LineId, WorkCellId } from '../../identifiers'
import { HierarchyPath } from '../../hierarchy'

// =============================================================================
// MachineId with Embedded Slug
// =============================================================================

/**
 * Machine identifier with embedded slug pattern.
 * Format: 'MCH-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const id = makeMachineId('cnc-lathe-001') // 'MCH-cnc-lathe-001'
 * ```
 */
export const MachineId = Schema.String.pipe(
  Schema.pattern(/^MCH-[a-zA-Z0-9-]+$/),
  Schema.brand('MachineId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/MachineId',
    description: 'Machine identifier with MCH- prefix and alphanumeric slug',
  })
)
export type MachineId = typeof MachineId.Type

/**
 * Factory function to create a MachineId from a slug.
 *
 * @param slug - Alphanumeric identifier (hyphens allowed)
 * @returns Branded MachineId
 *
 * @example
 * ```ts
 * const id = makeMachineId('cnc-lathe-001') // 'MCH-cnc-lathe-001'
 * ```
 */
export const makeMachineId = (slug: string): MachineId => `MCH-${slug}` as MachineId

// =============================================================================
// Machine Entity
// =============================================================================

/**
 * Machine Entity - ISA-95 Work Unit
 *
 * Represents a discrete piece of production equipment within a production line.
 * Machines are the primary level at which sensors are attached and readings collected.
 *
 * ISA-95 Hierarchy Position: Level 1 (Work Unit)
 * - Parent: WorkCell or Line (Work Center)
 * - Children: Sensors (Control Modules)
 *
 * @example
 * ```ts
 * import { DateTime, Option } from 'effect'
 *
 * const cnc = new Machine({
 *   id: makeMachineId('cnc-lathe-001'),
 *   name: 'CNC Lathe Alpha',
 *   status: 'active',
 *   enterpriseId: 'ENT-acme' as EnterpriseId,
 *   siteId: 'SIT-chicago' as SiteId,
 *   plantId: 'PLT-main' as PlantId,
 *   lineId: 'LIN-assembly' as LineId,
 *   workCellId: Option.some('WCL-cell-01' as WorkCellId),
 *   hierarchyPath: HierarchyPath.fromSegments([...]),
 *   machineType: 'CNC Lathe',
 *   manufacturer: Option.some('Haas'),
 *   modelNumber: Option.some('ST-10'),
 *   createdAt: DateTime.unsafeNow(),
 * })
 * ```
 */
export class Machine extends Schema.TaggedClass<Machine>()('Machine', {
  /** Unique machine identifier with MCH- prefix */
  id: MachineId,

  // Spread common asset fields
  ...BaseAssetFields,

  // ─────────────────────────────────────────────────────────────────────────
  // Override parent IDs as required (Machine requires up to Line, WorkCell optional)
  // ─────────────────────────────────────────────────────────────────────────

  /** Enterprise ID (required for Machine) */
  enterpriseId: EnterpriseId,

  /** Site ID (required for Machine) */
  siteId: SiteId,

  /** Plant ID (required for Machine) */
  plantId: PlantId,

  /** Line ID (required for Machine) */
  lineId: LineId,

  /** WorkCell ID (optional - Machine can be directly under Line) */
  workCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),

  // ─────────────────────────────────────────────────────────────────────────
  // Machine-Specific Fields
  // ─────────────────────────────────────────────────────────────────────────

  /** Machine type/model category (e.g., 'CNC Lathe', 'Press', 'Conveyor') */
  machineType: Schema.String,

  /** Equipment manufacturer */
  manufacturer: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Model number from manufacturer */
  modelNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Serial number for traceability */
  serialNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Date machine was installed */
  installationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Date of last maintenance */
  lastMaintenanceDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Scheduled next maintenance date */
  nextMaintenanceDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {
  /**
   * Get ISA-95 automation level.
   * Machines are Level 1 (Work Unit).
   */
  getAutomationLevel(): 1 {
    return 1
  }

  /**
   * Check if machine is operational.
   * Returns false if in maintenance or decommissioned.
   */
  isOperational(): boolean {
    return this.status !== 'maintenance' && this.status !== 'decommissioned'
  }

  /**
   * Check if machine is a container.
   * Machines contain sensors, so always returns true.
   */
  isContainer(): true {
    return true
  }

  /**
   * Check if maintenance is overdue.
   *
   * @param now - Reference date (defaults to current time)
   * @returns true if nextMaintenanceDate is in the past
   */
  isMaintenanceOverdue(now?: Date): boolean {
    if (this.nextMaintenanceDate._tag === 'None') {
      return false
    }
    const referenceTime = now ? now.getTime() : Date.now()
    const maintenanceTime = this.nextMaintenanceDate.value.epochMillis
    return Number(maintenanceTime) < referenceTime
  }

  /**
   * Materialize the hierarchy path to a string representation.
   * Convenience method that delegates to HierarchyPath.toString().
   *
   * @returns Materialized path string (e.g., '/ENT-acme/SIT-chicago/PLT-main/LIN-assembly/MCH-cnc-001')
   */
  materializePath(): string {
    return this.hierarchyPath.toString()
  }
}

// =============================================================================
// Machine Namespace
// =============================================================================

/**
 * Machine namespace for schema and type access.
 *
 * @example
 * ```ts
 * import { Machine } from './schema'
 *
 * // Access schema
 * const schema = Machine.Schema
 *
 * // Access type
 * type MachineEntity = Machine.Type
 * ```
 */

/** Machine entity type alias */
export type MachineEntity = typeof Machine.Type

/**
 * Machine type alias for backward compatibility.
 */
export type Machine = Machine.Type

/**
 * @deprecated Use Machine.Type instead
 */
export type MachineType = Machine.Type

// =============================================================================
// Create Machine Parameters
// =============================================================================

/**
 * Parameters for creating a new Machine.
 * Used by command handlers and service methods.
 */
export const CreateMachineParams = Schema.Struct({
  /** Slug for ID generation (without MCH- prefix) */
  slug: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.annotations({
      description: 'Alphanumeric slug for machine ID (MCH- prefix added automatically)',
    })
  ),

  /** Human-readable machine name */
  name: Schema.NonEmptyString,

  /** Initial status (defaults to 'active' in service) */
  status: Schema.optionalWith(AssetStatus, { default: () => 'active' as AssetStatus }),

  // ─────────────────────────────────────────────────────────────────────────
  // Parent Entity References (Required up to Line, WorkCell optional)
  // ─────────────────────────────────────────────────────────────────────────

  /** Enterprise ID (required) */
  enterpriseId: EnterpriseId,

  /** Site ID (required) */
  siteId: SiteId,

  /** Plant ID (required) */
  plantId: PlantId,

  /** Line ID (required) */
  lineId: LineId,

  /** WorkCell ID (optional - machine can be directly under line) */
  workCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),

  // ─────────────────────────────────────────────────────────────────────────
  // Machine-Specific Fields
  // ─────────────────────────────────────────────────────────────────────────

  /** Machine type/model category */
  machineType: Schema.NonEmptyString,

  /** Equipment manufacturer */
  manufacturer: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Model number */
  modelNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Serial number */
  serialNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Installation date */
  installationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Next scheduled maintenance */
  nextMaintenanceDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Optional description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Extensible metadata */
  metadata: Schema.optionalWith(AssetMetadata, { default: () => ({}) }),
})
export type CreateMachineParams = typeof CreateMachineParams.Type
