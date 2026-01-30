/**
 * EventGroup Definitions for IIoT Event Sourcing
 *
 * Defines EventGroups for use with @effect/experimental EventLog.
 * Events are organized into two categories:
 * - StructuralEvents: Entity lifecycle (created, updated, decommissioned)
 * - OperationalEvents: Runtime business events (state changes, alarms)
 *
 * @module @gbg/tmnl/iiot/schemas/events/groups
 * @see @effect/experimental/EventGroup
 * @see thoughts/shared/specs/entity-system/03-event-hierarchy.md
 */

import { Schema } from 'effect'
import * as EventGroup from '@effect/experimental/EventGroup'
import { EventId, EquipmentLevel, AssetId, EnterpriseId, SiteId, AreaId, PlantId, LineId, WorkCellId, MachineId, SensorId, DeviceId } from '../identifiers'

// =============================================================================
// Import Structural Events
// =============================================================================

import {
  // Upper Hierarchy
  EnterpriseCreated,
  EnterpriseUpdated,
  EnterpriseDecommissioned,
  SiteCreated,
  SiteUpdated,
  SiteDecommissioned,
  AreaCreated,
  AreaUpdated,
  AreaDecommissioned,
  AreaType,
  // Middle Hierarchy
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
  WorkCellDecommissioned,
  // Lower Hierarchy
  MachineCreated,
  MachineUpdated,
  MachineConfigChanged,
  MachineRelocated,
  MachineDecommissioned,
  SensorCreated,
  SensorUpdated,
  SensorCalibrated,
  SensorThresholdChanged,
  SensorDecommissioned,
  DeviceCreated,
  DeviceUpdated,
  DeviceDecommissioned,
  SensorType,
  MeasurementUnit,
  SensorThresholds,
  DeviceType,
  ControlMode,
} from './structural'

// =============================================================================
// Payload Schemas (derived from base event fields)
// =============================================================================

/**
 * Common fields for structural event payloads.
 * Mirrors BaseStructuralEvent fields for EventGroup compatibility.
 */
const StructuralEventFields = {
  /** Unique event identifier (ULID) */
  eventId: EventId,

  /** When the event occurred */
  occurredAt: Schema.DateTimeUtc,

  /** Principal/actor that caused this event */
  causedBy: Schema.String,

  /** Entity this event affects */
  entityId: AssetId,

  /** ISA-95 equipment level */
  entityType: EquipmentLevel,

  /** Full hierarchy path from root to entity */
  hierarchyPath: Schema.Array(AssetId),

  /** Correlation ID for transactions */
  correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Schema version for evolution */
  schemaVersion: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 }
  ),
}

/**
 * Common fields for operational event payloads.
 * Mirrors BaseOperationalEvent fields for EventGroup compatibility.
 */
const OperationalEventFields = {
  /** Unique event identifier (ULID) */
  eventId: EventId,

  /** When the event occurred */
  occurredAt: Schema.DateTimeUtc,

  /** Principal/actor that caused this event */
  causedBy: Schema.String,

  /** Entity this event affects */
  entityId: AssetId,

  /** ISA-95 equipment level */
  entityType: EquipmentLevel,

  /** Correlation ID for transactions */
  correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Schema version for evolution */
  schemaVersion: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 }
  ),
}

// =============================================================================
// Placeholder Payload Schemas (kept for backwards compatibility)
// =============================================================================

/**
 * Base structural event payload.
 * @deprecated Use concrete event payloads instead
 */
const BaseStructuralEventPayload = Schema.Struct(StructuralEventFields)

/**
 * Base operational event payload.
 * Used as placeholder until concrete operational events are wired (Task 1.5.3).
 */
const BaseOperationalEventPayload = Schema.Struct(OperationalEventFields)

// =============================================================================
// Entity-Specific Payload Schemas
// =============================================================================

// --- Enterprise Payloads ---

const EnterpriseCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  enterpriseId: EnterpriseId,
  name: Schema.NonEmptyString,
  industry: Schema.optionalWith(Schema.String, { as: 'Option' }),
  legalName: Schema.optionalWith(Schema.String, { as: 'Option' }),
  taxId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  headquarters: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const EnterpriseUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  enterpriseId: EnterpriseId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  industry: Schema.optionalWith(Schema.String, { as: 'Option' }),
  legalName: Schema.optionalWith(Schema.String, { as: 'Option' }),
  taxId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  headquarters: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const EnterpriseDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  enterpriseId: EnterpriseId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Site Payloads ---

const SiteCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  siteId: SiteId,
  enterpriseId: EnterpriseId,
  name: Schema.NonEmptyString,
  timezone: Schema.String,
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),
  city: Schema.optionalWith(Schema.String, { as: 'Option' }),
  state: Schema.optionalWith(Schema.String, { as: 'Option' }),
  country: Schema.optionalWith(Schema.String, { as: 'Option' }),
  postalCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  latitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  longitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),
})

const SiteUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  siteId: SiteId,
  enterpriseId: EnterpriseId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  timezone: Schema.optionalWith(Schema.String, { as: 'Option' }),
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),
  city: Schema.optionalWith(Schema.String, { as: 'Option' }),
  state: Schema.optionalWith(Schema.String, { as: 'Option' }),
  country: Schema.optionalWith(Schema.String, { as: 'Option' }),
  postalCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  latitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  longitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const SiteDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  siteId: SiteId,
  enterpriseId: EnterpriseId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Area Payloads ---

const AreaCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  areaId: AreaId,
  siteId: SiteId,
  name: Schema.NonEmptyString,
  areaType: Schema.optionalWith(AreaType, { as: 'Option' }),
  building: Schema.optionalWith(Schema.String, { as: 'Option' }),
  floor: Schema.optionalWith(Schema.String, { as: 'Option' }),
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AreaUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  areaId: AreaId,
  siteId: SiteId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  areaType: Schema.optionalWith(AreaType, { as: 'Option' }),
  building: Schema.optionalWith(Schema.String, { as: 'Option' }),
  floor: Schema.optionalWith(Schema.String, { as: 'Option' }),
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AreaDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  areaId: AreaId,
  siteId: SiteId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Plant Payloads ---

const PlantCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  plantId: PlantId,
  name: Schema.NonEmptyString,
  timezone: Schema.String,
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  areaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  siteCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  initialConfig: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { as: 'Option' }),
})

const PlantUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  plantId: PlantId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  timezone: Schema.optionalWith(Schema.String, { as: 'Option' }),
  siteCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const PlantRelocatedPayload = Schema.Struct({
  ...StructuralEventFields,
  plantId: PlantId,
  previousSiteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  previousAreaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  newSiteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  newAreaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
})

const PlantDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  plantId: PlantId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Line Payloads ---

const LineCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  lineId: LineId,
  plantId: PlantId,
  name: Schema.NonEmptyString,
  capacity: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  operatingHoursPerDay: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 24)), { as: 'Option' }),
  shiftsPerDay: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.between(1, 4)), { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  initialConfig: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { as: 'Option' }),
})

const LineUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  lineId: LineId,
  plantId: PlantId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  capacity: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  operatingHoursPerDay: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 24)), { as: 'Option' }),
  shiftsPerDay: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.between(1, 4)), { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const LineConfigChangedPayload = Schema.Struct({
  ...StructuralEventFields,
  lineId: LineId,
  plantId: PlantId,
  configKey: Schema.NonEmptyString,
  previousValue: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  newValue: Schema.Unknown,
  reason: Schema.NonEmptyString,
  requiresRestart: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

const LineRelocatedPayload = Schema.Struct({
  ...StructuralEventFields,
  lineId: LineId,
  previousPlantId: PlantId,
  newPlantId: PlantId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
})

const LineDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  lineId: LineId,
  plantId: PlantId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- WorkCell Payloads ---

const WorkCellCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  workCellId: WorkCellId,
  lineId: LineId,
  name: Schema.NonEmptyString,
  cellType: Schema.optionalWith(Schema.String, { as: 'Option' }),
  cycleTimeSeconds: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  position: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const WorkCellUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  workCellId: WorkCellId,
  lineId: LineId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  cellType: Schema.optionalWith(Schema.String, { as: 'Option' }),
  cycleTimeSeconds: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  position: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const WorkCellDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  workCellId: WorkCellId,
  lineId: LineId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Machine Payloads ---

const MachineCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  machineId: MachineId,
  lineId: LineId,
  workCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),
  name: Schema.NonEmptyString,
  machineType: Schema.NonEmptyString,
  manufacturer: Schema.optionalWith(Schema.String, { as: 'Option' }),
  modelNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  serialNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  installationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  initialConfig: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { as: 'Option' }),
})

const MachineUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  machineId: MachineId,
  lineId: LineId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  machineType: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  manufacturer: Schema.optionalWith(Schema.String, { as: 'Option' }),
  modelNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  serialNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const MachineConfigChangedPayload = Schema.Struct({
  ...StructuralEventFields,
  machineId: MachineId,
  lineId: LineId,
  configKey: Schema.NonEmptyString,
  previousValue: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  newValue: Schema.Unknown,
  reason: Schema.NonEmptyString,
  requiresRestart: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

const MachineRelocatedPayload = Schema.Struct({
  ...StructuralEventFields,
  machineId: MachineId,
  previousLineId: LineId,
  previousWorkCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),
  newLineId: LineId,
  newWorkCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
})

const MachineDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  machineId: MachineId,
  lineId: LineId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  totalOperationalHours: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Sensor Payloads ---

const SensorCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  sensorId: SensorId,
  machineId: MachineId,
  name: Schema.NonEmptyString,
  sensorType: SensorType,
  unit: MeasurementUnit,
  sampleRateMs: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  thresholds: Schema.optionalWith(SensorThresholds, { as: 'Option' }),
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const SensorUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  sensorId: SensorId,
  machineId: MachineId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  sensorType: Schema.optionalWith(SensorType, { as: 'Option' }),
  unit: Schema.optionalWith(MeasurementUnit, { as: 'Option' }),
  sampleRateMs: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const SensorCalibratedPayload = Schema.Struct({
  ...StructuralEventFields,
  sensorId: SensorId,
  machineId: MachineId,
  calibrationDate: Schema.DateTimeUtc,
  nextCalibrationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  calibratedBy: Schema.NonEmptyString,
  certificateNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  offsetAdjustment: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  gainAdjustment: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const SensorThresholdChangedPayload = Schema.Struct({
  ...StructuralEventFields,
  sensorId: SensorId,
  machineId: MachineId,
  previousThresholds: SensorThresholds,
  newThresholds: SensorThresholds,
  reason: Schema.NonEmptyString,
  approvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const SensorDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  sensorId: SensorId,
  machineId: MachineId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  totalReadingsCount: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Device Payloads ---

const DeviceCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  deviceId: DeviceId,
  machineId: MachineId,
  name: Schema.NonEmptyString,
  deviceType: DeviceType,
  controlMode: Schema.optionalWith(ControlMode, { as: 'Option' }),
  ratedPower: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  powerUnit: Schema.optionalWith(Schema.Literal('W', 'kW', 'HP'), { as: 'Option' }),
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const DeviceUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  deviceId: DeviceId,
  machineId: MachineId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  deviceType: Schema.optionalWith(DeviceType, { as: 'Option' }),
  controlMode: Schema.optionalWith(ControlMode, { as: 'Option' }),
  ratedPower: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  powerUnit: Schema.optionalWith(Schema.Literal('W', 'kW', 'HP'), { as: 'Option' }),
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const DeviceDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  deviceId: DeviceId,
  machineId: MachineId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  totalOperationHours: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// =============================================================================
// EventGroup Definitions
// =============================================================================

/**
 * Structural Events — Entity Lifecycle & Configuration
 *
 * These events capture the "shape" of the system:
 * - Entity creation (EnterpriseCreated, PlantCreated, MachineCreated, etc.)
 * - Entity updates (configuration changes)
 * - Entity decommissioning
 *
 * Stored in EventLog, replayed from origin to reconstruct state.
 */
export const StructuralEvents = EventGroup.empty
  // --- Enterprise ---
  .add({
    tag: 'EnterpriseCreated',
    primaryKey: (payload) => payload.enterpriseId,
    payload: EnterpriseCreatedPayload,
  })
  .add({
    tag: 'EnterpriseUpdated',
    primaryKey: (payload) => payload.enterpriseId,
    payload: EnterpriseUpdatedPayload,
  })
  .add({
    tag: 'EnterpriseDecommissioned',
    primaryKey: (payload) => payload.enterpriseId,
    payload: EnterpriseDecommissionedPayload,
  })
  // --- Site ---
  .add({
    tag: 'SiteCreated',
    primaryKey: (payload) => payload.siteId,
    payload: SiteCreatedPayload,
  })
  .add({
    tag: 'SiteUpdated',
    primaryKey: (payload) => payload.siteId,
    payload: SiteUpdatedPayload,
  })
  .add({
    tag: 'SiteDecommissioned',
    primaryKey: (payload) => payload.siteId,
    payload: SiteDecommissionedPayload,
  })
  // --- Area ---
  .add({
    tag: 'AreaCreated',
    primaryKey: (payload) => payload.areaId,
    payload: AreaCreatedPayload,
  })
  .add({
    tag: 'AreaUpdated',
    primaryKey: (payload) => payload.areaId,
    payload: AreaUpdatedPayload,
  })
  .add({
    tag: 'AreaDecommissioned',
    primaryKey: (payload) => payload.areaId,
    payload: AreaDecommissionedPayload,
  })
  // --- Plant ---
  .add({
    tag: 'PlantCreated',
    primaryKey: (payload) => payload.plantId,
    payload: PlantCreatedPayload,
  })
  .add({
    tag: 'PlantUpdated',
    primaryKey: (payload) => payload.plantId,
    payload: PlantUpdatedPayload,
  })
  .add({
    tag: 'PlantRelocated',
    primaryKey: (payload) => payload.plantId,
    payload: PlantRelocatedPayload,
  })
  .add({
    tag: 'PlantDecommissioned',
    primaryKey: (payload) => payload.plantId,
    payload: PlantDecommissionedPayload,
  })
  // --- Line ---
  .add({
    tag: 'LineCreated',
    primaryKey: (payload) => payload.lineId,
    payload: LineCreatedPayload,
  })
  .add({
    tag: 'LineUpdated',
    primaryKey: (payload) => payload.lineId,
    payload: LineUpdatedPayload,
  })
  .add({
    tag: 'LineConfigChanged',
    primaryKey: (payload) => payload.lineId,
    payload: LineConfigChangedPayload,
  })
  .add({
    tag: 'LineRelocated',
    primaryKey: (payload) => payload.lineId,
    payload: LineRelocatedPayload,
  })
  .add({
    tag: 'LineDecommissioned',
    primaryKey: (payload) => payload.lineId,
    payload: LineDecommissionedPayload,
  })
  // --- WorkCell ---
  .add({
    tag: 'WorkCellCreated',
    primaryKey: (payload) => payload.workCellId,
    payload: WorkCellCreatedPayload,
  })
  .add({
    tag: 'WorkCellUpdated',
    primaryKey: (payload) => payload.workCellId,
    payload: WorkCellUpdatedPayload,
  })
  .add({
    tag: 'WorkCellDecommissioned',
    primaryKey: (payload) => payload.workCellId,
    payload: WorkCellDecommissionedPayload,
  })
  // --- Machine ---
  .add({
    tag: 'MachineCreated',
    primaryKey: (payload) => payload.machineId,
    payload: MachineCreatedPayload,
  })
  .add({
    tag: 'MachineUpdated',
    primaryKey: (payload) => payload.machineId,
    payload: MachineUpdatedPayload,
  })
  .add({
    tag: 'MachineConfigChanged',
    primaryKey: (payload) => payload.machineId,
    payload: MachineConfigChangedPayload,
  })
  .add({
    tag: 'MachineRelocated',
    primaryKey: (payload) => payload.machineId,
    payload: MachineRelocatedPayload,
  })
  .add({
    tag: 'MachineDecommissioned',
    primaryKey: (payload) => payload.machineId,
    payload: MachineDecommissionedPayload,
  })
  // --- Sensor ---
  .add({
    tag: 'SensorCreated',
    primaryKey: (payload) => payload.sensorId,
    payload: SensorCreatedPayload,
  })
  .add({
    tag: 'SensorUpdated',
    primaryKey: (payload) => payload.sensorId,
    payload: SensorUpdatedPayload,
  })
  .add({
    tag: 'SensorCalibrated',
    primaryKey: (payload) => payload.sensorId,
    payload: SensorCalibratedPayload,
  })
  .add({
    tag: 'SensorThresholdChanged',
    primaryKey: (payload) => payload.sensorId,
    payload: SensorThresholdChangedPayload,
  })
  .add({
    tag: 'SensorDecommissioned',
    primaryKey: (payload) => payload.sensorId,
    payload: SensorDecommissionedPayload,
  })
  // --- Device ---
  .add({
    tag: 'DeviceCreated',
    primaryKey: (payload) => payload.deviceId,
    payload: DeviceCreatedPayload,
  })
  .add({
    tag: 'DeviceUpdated',
    primaryKey: (payload) => payload.deviceId,
    payload: DeviceUpdatedPayload,
  })
  .add({
    tag: 'DeviceDecommissioned',
    primaryKey: (payload) => payload.deviceId,
    payload: DeviceDecommissionedPayload,
  })

/**
 * Operational Events — Runtime Business Events
 *
 * These events capture the "behavior" of the system:
 * - State transitions (StateStarted, StateEnded)
 * - Alarms (triggered, acknowledged, cleared)
 * - Maintenance actions
 *
 * Stored in EventLog, supports time-travel queries.
 *
 * NOTE: Currently contains placeholder events. Concrete events (StateStarted,
 * StateEnded, etc.) will be wired in Task 1.5.3.
 */
export const OperationalEvents = EventGroup.empty
  .add({
    tag: 'BaseOperationalEvent',
    primaryKey: (payload) => payload.entityId,
    payload: BaseOperationalEventPayload,
  })

/**
 * Combined IIoT Event Groups
 *
 * Merges structural and operational events for use with EventLog.schema.
 * This is the complete set of events that the IIoT EventLog will handle.
 *
 * @example
 * ```typescript
 * import { IIoTEventLogSchema } from './groups'
 * import * as EventLog from '@effect/experimental/EventLog'
 *
 * // Create EventLog layer with this schema
 * const layer = EventLog.layer(IIoTEventLogSchema)
 * ```
 */
export type IIoTEvents =
  | EventGroup.EventGroup.Events<typeof StructuralEvents>
  | EventGroup.EventGroup.Events<typeof OperationalEvents>

// =============================================================================
// Exports for Infrastructure Layer
// =============================================================================

export { StructuralEventFields, OperationalEventFields }
