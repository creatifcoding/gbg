/**
 * Middle Hierarchy Entity Lifecycle Events
 *
 * Structural events for Plant, Line, and WorkCell entities.
 * These are the production-level entities in the ISA-95 hierarchy.
 *
 * | Entity   | ISA-95 Level | Automation Level |
 * |----------|--------------|------------------|
 * | Plant    | L3           | Manufacturing Ops|
 * | Line     | L1           | Automation Ctrl  |
 * | WorkCell | L1           | Work Unit        |
 *
 * @module @gbg/tmnl/iiot/schemas/events/structural/middle-hierarchy
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 * @see thoughts/shared/specs/entity-system/00-unified-entity-system-spec.md
 */

import { Schema } from 'effect'
import { BaseStructuralEvent } from '../base'
import { PlantId, LineId, WorkCellId, SiteId, AreaId } from '../../identifiers'

// =============================================================================
// Plant Events (L3 - Functional Manufacturing Unit)
// =============================================================================

/**
 * Event: A new plant (functional manufacturing unit) was registered.
 *
 * Plant is a functional grouping within a Site or Area. It contains
 * production Lines and represents a logical manufacturing unit.
 *
 * @example
 * ```typescript
 * const event = new PlantCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'ADMIN-001',
 *   entityId: 'PLT-main' as AssetId,
 *   entityType: 'plant',
 *   hierarchyPath: ['ENT-acme', 'SIT-chicago', 'PLT-main'] as AssetId[],
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   plantId: 'PLT-main' as PlantId,
 *   name: 'Main Production Plant',
 *   timezone: 'America/Chicago',
 *   siteId: Option.some('SIT-chicago' as SiteId),
 * })
 * ```
 */
export class PlantCreated extends BaseStructuralEvent.extend<PlantCreated>(
  'PlantCreated'
)({
  /** Plant identifier */
  plantId: PlantId,

  /** Display name of the plant */
  name: Schema.NonEmptyString,

  /** IANA timezone ID (e.g., 'America/Chicago') */
  timezone: Schema.String,

  /** Parent site (optional - can be under Area directly) */
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),

  /** Parent area (optional - can be under Site directly) */
  areaId: Schema.optionalWith(AreaId, { as: 'Option' }),

  /** ERP site code for integration */
  siteCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Description of the plant */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Initial configuration properties */
  initialConfig: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
}) {
  describe(): string {
    return `Plant ${this.name} (${this.plantId}) created`
  }
}
export type PlantCreatedType = typeof PlantCreated.Type

/**
 * Event: Plant metadata was updated.
 */
export class PlantUpdated extends BaseStructuralEvent.extend<PlantUpdated>(
  'PlantUpdated'
)({
  /** Plant identifier */
  plantId: PlantId,

  /** Updated name (if changed) */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated timezone (if changed) */
  timezone: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated ERP site code (if changed) */
  siteCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated description (if changed) */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Reason for the update */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Plant ${this.plantId} updated`
  }
}
export type PlantUpdatedType = typeof PlantUpdated.Type

/**
 * Event: Plant was relocated to a different parent.
 *
 * Rare operation - triggers cascade updates to all child Lines.
 * The hierarchyPath on this event reflects the NEW location.
 */
export class PlantRelocated extends BaseStructuralEvent.extend<PlantRelocated>(
  'PlantRelocated'
)({
  /** Plant identifier */
  plantId: PlantId,

  /** Previous parent site (if any) */
  previousSiteId: Schema.optionalWith(SiteId, { as: 'Option' }),

  /** Previous parent area (if any) */
  previousAreaId: Schema.optionalWith(AreaId, { as: 'Option' }),

  /** New parent site (if any) */
  newSiteId: Schema.optionalWith(SiteId, { as: 'Option' }),

  /** New parent area (if any) */
  newAreaId: Schema.optionalWith(AreaId, { as: 'Option' }),

  /** Reason for relocation */
  reason: Schema.NonEmptyString,

  /** Effective date of relocation */
  effectiveDate: Schema.DateTimeUtc,
}) {
  describe(): string {
    return `Plant ${this.plantId} relocated: ${this.reason}`
  }
}
export type PlantRelocatedType = typeof PlantRelocated.Type

/**
 * Event: Plant was decommissioned.
 *
 * All child Lines, WorkCells, and Machines are cascaded as decommissioned.
 */
export class PlantDecommissioned extends BaseStructuralEvent.extend<PlantDecommissioned>(
  'PlantDecommissioned'
)({
  /** Plant identifier */
  plantId: PlantId,

  /** Reason for decommissioning */
  reason: Schema.NonEmptyString,

  /** Effective date of decommissioning */
  effectiveDate: Schema.DateTimeUtc,

  /** Notes about the decommissioning */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Plant ${this.plantId} decommissioned: ${this.reason}`
  }
}
export type PlantDecommissionedType = typeof PlantDecommissioned.Type

// =============================================================================
// Line Events (L1 - Work Center / Production Line)
// =============================================================================

/**
 * Event: A new production line was registered.
 *
 * Line represents an ISA-95 Work Center - a sequence of machines
 * that perform production operations. Contains WorkCells and/or Machines.
 *
 * @example
 * ```typescript
 * const event = new LineCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'ADMIN-001',
 *   entityId: 'LIN-assembly-1' as AssetId,
 *   entityType: 'line',
 *   hierarchyPath: ['ENT-acme', 'SIT-chicago', 'PLT-main', 'LIN-assembly-1'] as AssetId[],
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   lineId: 'LIN-assembly-1' as LineId,
 *   plantId: 'PLT-main' as PlantId,
 *   name: 'Assembly Line 1',
 *   capacity: Option.some(100), // 100 units/hour
 * })
 * ```
 */
export class LineCreated extends BaseStructuralEvent.extend<LineCreated>(
  'LineCreated'
)({
  /** Line identifier */
  lineId: LineId,

  /** Parent plant */
  plantId: PlantId,

  /** Display name of the line */
  name: Schema.NonEmptyString,

  /** Production capacity (units per hour) */
  capacity: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Operating hours per day (0-24) */
  operatingHoursPerDay: Schema.optionalWith(
    Schema.Number.pipe(Schema.between(0, 24)),
    { as: 'Option' }
  ),

  /** Number of shifts per day */
  shiftsPerDay: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.between(1, 4)),
    { as: 'Option' }
  ),

  /** Description of the line */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Initial configuration */
  initialConfig: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
}) {
  describe(): string {
    return `Line ${this.name} (${this.lineId}) created under plant ${this.plantId}`
  }
}
export type LineCreatedType = typeof LineCreated.Type

/**
 * Event: Line metadata was updated.
 */
export class LineUpdated extends BaseStructuralEvent.extend<LineUpdated>(
  'LineUpdated'
)({
  /** Line identifier */
  lineId: LineId,

  /** Parent plant */
  plantId: PlantId,

  /** Updated name (if changed) */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated capacity (if changed) */
  capacity: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Updated operating hours (if changed) */
  operatingHoursPerDay: Schema.optionalWith(
    Schema.Number.pipe(Schema.between(0, 24)),
    { as: 'Option' }
  ),

  /** Updated shifts per day (if changed) */
  shiftsPerDay: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.between(1, 4)),
    { as: 'Option' }
  ),

  /** Updated description (if changed) */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Reason for the update */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Line ${this.lineId} updated`
  }
}
export type LineUpdatedType = typeof LineUpdated.Type

/**
 * Event: Line configuration was changed.
 *
 * Distinct from LineUpdated - this captures operational configuration
 * changes that affect production (not just metadata).
 */
export class LineConfigChanged extends BaseStructuralEvent.extend<LineConfigChanged>(
  'LineConfigChanged'
)({
  /** Line identifier */
  lineId: LineId,

  /** Parent plant */
  plantId: PlantId,

  /** Configuration key that changed */
  configKey: Schema.NonEmptyString,

  /** Previous value (if any) */
  previousValue: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),

  /** New value */
  newValue: Schema.Unknown,

  /** Reason for the change */
  reason: Schema.NonEmptyString,

  /** Whether this requires line restart */
  requiresRestart: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {
  describe(): string {
    return `Line ${this.lineId} config changed: ${this.configKey}`
  }
}
export type LineConfigChangedType = typeof LineConfigChanged.Type

/**
 * Event: Line was relocated to a different plant.
 *
 * Triggers cascade updates to all child WorkCells and Machines.
 */
export class LineRelocated extends BaseStructuralEvent.extend<LineRelocated>(
  'LineRelocated'
)({
  /** Line identifier */
  lineId: LineId,

  /** Previous parent plant */
  previousPlantId: PlantId,

  /** New parent plant */
  newPlantId: PlantId,

  /** Reason for relocation */
  reason: Schema.NonEmptyString,

  /** Effective date of relocation */
  effectiveDate: Schema.DateTimeUtc,
}) {
  describe(): string {
    return `Line ${this.lineId} relocated from ${this.previousPlantId} to ${this.newPlantId}`
  }
}
export type LineRelocatedType = typeof LineRelocated.Type

/**
 * Event: Line was decommissioned.
 *
 * All child WorkCells, Machines, Sensors, and Devices are cascaded.
 */
export class LineDecommissioned extends BaseStructuralEvent.extend<LineDecommissioned>(
  'LineDecommissioned'
)({
  /** Line identifier */
  lineId: LineId,

  /** Parent plant */
  plantId: PlantId,

  /** Reason for decommissioning */
  reason: Schema.NonEmptyString,

  /** Effective date of decommissioning */
  effectiveDate: Schema.DateTimeUtc,

  /** Notes about the decommissioning */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Line ${this.lineId} decommissioned: ${this.reason}`
  }
}
export type LineDecommissionedType = typeof LineDecommissioned.Type

// =============================================================================
// WorkCell Events (L1 - Work Unit)
// =============================================================================

/**
 * Event: A new work cell was registered.
 *
 * WorkCell is a logical grouping of machines within a Line.
 * Represents an ISA-95 Work Unit.
 *
 * @example
 * ```typescript
 * const event = new WorkCellCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'ADMIN-001',
 *   entityId: 'WCL-welding-1' as AssetId,
 *   entityType: 'workcell',
 *   hierarchyPath: ['ENT-acme', 'SIT-chicago', 'PLT-main', 'LIN-assembly-1', 'WCL-welding-1'] as AssetId[],
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   workCellId: 'WCL-welding-1' as WorkCellId,
 *   lineId: 'LIN-assembly-1' as LineId,
 *   name: 'Welding Cell 1',
 *   cellType: Option.some('welding'),
 * })
 * ```
 */
export class WorkCellCreated extends BaseStructuralEvent.extend<WorkCellCreated>(
  'WorkCellCreated'
)({
  /** WorkCell identifier */
  workCellId: WorkCellId,

  /** Parent line */
  lineId: LineId,

  /** Display name of the work cell */
  name: Schema.NonEmptyString,

  /** Cell type/classification */
  cellType: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Target cycle time in seconds */
  cycleTimeSeconds: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Position/sequence within the line */
  position: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), { as: 'Option' }),

  /** Description of the work cell */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `WorkCell ${this.name} (${this.workCellId}) created under line ${this.lineId}`
  }
}
export type WorkCellCreatedType = typeof WorkCellCreated.Type

/**
 * Event: WorkCell metadata was updated.
 */
export class WorkCellUpdated extends BaseStructuralEvent.extend<WorkCellUpdated>(
  'WorkCellUpdated'
)({
  /** WorkCell identifier */
  workCellId: WorkCellId,

  /** Parent line */
  lineId: LineId,

  /** Updated name (if changed) */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated cell type (if changed) */
  cellType: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated cycle time (if changed) */
  cycleTimeSeconds: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Updated position (if changed) */
  position: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), { as: 'Option' }),

  /** Updated description (if changed) */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Reason for the update */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `WorkCell ${this.workCellId} updated`
  }
}
export type WorkCellUpdatedType = typeof WorkCellUpdated.Type

/**
 * Event: WorkCell was decommissioned.
 *
 * All child Machines, Sensors, and Devices are cascaded.
 */
export class WorkCellDecommissioned extends BaseStructuralEvent.extend<WorkCellDecommissioned>(
  'WorkCellDecommissioned'
)({
  /** WorkCell identifier */
  workCellId: WorkCellId,

  /** Parent line */
  lineId: LineId,

  /** Reason for decommissioning */
  reason: Schema.NonEmptyString,

  /** Effective date of decommissioning */
  effectiveDate: Schema.DateTimeUtc,

  /** Notes about the decommissioning */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `WorkCell ${this.workCellId} decommissioned: ${this.reason}`
  }
}
export type WorkCellDecommissionedType = typeof WorkCellDecommissioned.Type

// =============================================================================
// Event Union for Middle Hierarchy
// =============================================================================

/**
 * Union of all middle hierarchy structural events.
 */
export const MiddleHierarchyEvent = Schema.Union(
  PlantCreated,
  PlantUpdated,
  PlantRelocated,
  PlantDecommissioned,
  LineCreated,
  LineUpdated,
  LineConfigChanged,
  LineRelocated,
  LineDecommissioned,
  WorkCellCreated,
  WorkCellUpdated,
  WorkCellDecommissioned
)
export type MiddleHierarchyEvent = Schema.Schema.Type<typeof MiddleHierarchyEvent>

