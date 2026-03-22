/**
 * Structural Entity Lifecycle Events
 *
 * Barrel export for all ISA-95 entity lifecycle events.
 * These events extend BaseStructuralEvent and are stored in EventLog.
 *
 * Organization:
 * - upper-hierarchy.ts: Enterprise, Site, Area
 * - middle-hierarchy.ts: Plant, Line, WorkCell
 * - lower-hierarchy.ts: Machine, Sensor, Device
 *
 * @module @gbg/tmnl/iiot/schemas/events/structural
 * @see thoughts/shared/specs/entity-system/00-unified-entity-system-spec.md
 */

import { Schema } from 'effect'

// =============================================================================
// Upper Hierarchy (Enterprise, Site, Area)
// =============================================================================

export {
  // Enterprise Events
  EnterpriseCreated,
  EnterpriseUpdated,
  EnterpriseDecommissioned,
  type EnterpriseCreatedType,
  type EnterpriseUpdatedType,
  type EnterpriseDecommissionedType,

  // Site Events
  SiteCreated,
  SiteUpdated,
  SiteDecommissioned,
  type SiteCreatedType,
  type SiteUpdatedType,
  type SiteDecommissionedType,

  // Area Events
  AreaCreated,
  AreaUpdated,
  AreaDecommissioned,
  type AreaCreatedType,
  type AreaUpdatedType,
  type AreaDecommissionedType,

  // Supporting Types
  AreaType,
  type AreaType as AreaTypeType,

  // Union
  UpperHierarchyEvent,
  type UpperHierarchyEvent as UpperHierarchyEventType,
} from './upper-hierarchy'

// =============================================================================
// Middle Hierarchy (Plant, Line, WorkCell)
// =============================================================================

export {
  // Plant Events
  PlantCreated,
  PlantUpdated,
  PlantRelocated,
  PlantDecommissioned,
  type PlantCreatedType,
  type PlantUpdatedType,
  type PlantRelocatedType,
  type PlantDecommissionedType,

  // Line Events
  LineCreated,
  LineUpdated,
  LineConfigChanged,
  LineRelocated,
  LineDecommissioned,
  type LineCreatedType,
  type LineUpdatedType,
  type LineConfigChangedType,
  type LineRelocatedType,
  type LineDecommissionedType,

  // WorkCell Events
  WorkCellCreated,
  WorkCellUpdated,
  WorkCellDecommissioned,
  type WorkCellCreatedType,
  type WorkCellUpdatedType,
  type WorkCellDecommissionedType,

  // Union
  MiddleHierarchyEvent,
  type MiddleHierarchyEvent as MiddleHierarchyEventType,
} from './middle-hierarchy'

// =============================================================================
// Lower Hierarchy (Machine, Sensor, Device)
// =============================================================================

export {
  // Machine Events
  MachineCreated,
  MachineUpdated,
  MachineConfigChanged,
  MachineRelocated,
  MachineDecommissioned,
  type MachineCreatedType,
  type MachineUpdatedType,
  type MachineConfigChangedType,
  type MachineRelocatedType,
  type MachineDecommissionedType,

  // Sensor Events
  SensorCreated,
  SensorUpdated,
  SensorCalibrated,
  SensorThresholdChanged,
  SensorDecommissioned,
  type SensorCreatedType,
  type SensorUpdatedType,
  type SensorCalibratedType,
  type SensorThresholdChangedType,
  type SensorDecommissionedType,

  // Device Events
  DeviceCreated,
  DeviceUpdated,
  DeviceDecommissioned,
  type DeviceCreatedType,
  type DeviceUpdatedType,
  type DeviceDecommissionedType,

  // Supporting Types
  SensorType,
  MeasurementUnit,
  SensorThresholds,
  DeviceType,
  ControlMode,
  type SensorType as SensorTypeType,
  type MeasurementUnit as MeasurementUnitType,
  type SensorThresholds as SensorThresholdsType,
  type DeviceType as DeviceTypeType,
  type ControlMode as ControlModeType,

  // Union
  LowerHierarchyEvent,
  type LowerHierarchyEvent as LowerHierarchyEventType,
} from './lower-hierarchy'

// =============================================================================
// Imports for Combined Union
// =============================================================================

import { UpperHierarchyEvent } from './upper-hierarchy'
import { MiddleHierarchyEvent } from './middle-hierarchy'
import { LowerHierarchyEvent } from './lower-hierarchy'

// =============================================================================
// Combined Structural Event Union
// =============================================================================

/**
 * Union of ALL structural entity lifecycle events.
 *
 * Use this for event handlers that need to process any structural event.
 */
export const AllStructuralEvents = Schema.Union(
  UpperHierarchyEvent,
  MiddleHierarchyEvent,
  LowerHierarchyEvent
)
export type AllStructuralEvents = Schema.Schema.Type<typeof AllStructuralEvents>

// =============================================================================
// Event Tag Lists (for EventGroup registration)
// =============================================================================

/**
 * All structural event tags for EventGroup configuration.
 */
export const STRUCTURAL_EVENT_TAGS = [
  // Enterprise
  'EnterpriseCreated',
  'EnterpriseUpdated',
  'EnterpriseDecommissioned',
  // Site
  'SiteCreated',
  'SiteUpdated',
  'SiteDecommissioned',
  // Area
  'AreaCreated',
  'AreaUpdated',
  'AreaDecommissioned',
  // Plant
  'PlantCreated',
  'PlantUpdated',
  'PlantRelocated',
  'PlantDecommissioned',
  // Line
  'LineCreated',
  'LineUpdated',
  'LineConfigChanged',
  'LineRelocated',
  'LineDecommissioned',
  // WorkCell
  'WorkCellCreated',
  'WorkCellUpdated',
  'WorkCellDecommissioned',
  // Machine
  'MachineCreated',
  'MachineUpdated',
  'MachineConfigChanged',
  'MachineRelocated',
  'MachineDecommissioned',
  // Sensor
  'SensorCreated',
  'SensorUpdated',
  'SensorCalibrated',
  'SensorThresholdChanged',
  'SensorDecommissioned',
  // Device
  'DeviceCreated',
  'DeviceUpdated',
  'DeviceDecommissioned',
] as const

export type StructuralEventTag = (typeof STRUCTURAL_EVENT_TAGS)[number]
