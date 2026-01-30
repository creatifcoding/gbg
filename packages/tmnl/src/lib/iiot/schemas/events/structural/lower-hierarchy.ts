/**
 * Lower Hierarchy Entity Lifecycle Events
 *
 * Structural events for Machine, Sensor, and Device entities.
 * These are the physical equipment at the bottom of the ISA-95 hierarchy.
 *
 * | Entity  | ISA-95 Level | Automation Level    |
 * |---------|--------------|---------------------|
 * | Machine | L1           | Equipment           |
 * | Sensor  | L0           | Control Module (R)  |
 * | Device  | L0           | Control Module (W)  |
 *
 * @module @gbg/tmnl/iiot/schemas/events/structural/lower-hierarchy
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 * @see thoughts/shared/specs/entity-system/00-unified-entity-system-spec.md
 */

import { Schema } from 'effect'
import { BaseStructuralEvent } from '../base'
import { MachineId, SensorId, DeviceId, LineId, WorkCellId } from '../../identifiers'
// Import types from existing asset schemas (avoid duplication)
import {
  SensorType as SensorTypeFromAsset,
  MeasurementUnit as MeasurementUnitFromAsset,
} from '../../assets/sensor/schema'
import {
  DeviceType as DeviceTypeFromAsset,
  ControlMode as ControlModeFromAsset,
} from '../../assets/device/schema'

// Re-export the asset types under original names
export const SensorType = SensorTypeFromAsset
export type SensorType = typeof SensorTypeFromAsset.Type
export const MeasurementUnit = MeasurementUnitFromAsset
export type MeasurementUnit = typeof MeasurementUnitFromAsset.Type
export const DeviceType = DeviceTypeFromAsset
export type DeviceType = typeof DeviceTypeFromAsset.Type
export const ControlMode = ControlModeFromAsset
export type ControlMode = typeof ControlModeFromAsset.Type

// =============================================================================
// Machine Events (L1 - Equipment)
// =============================================================================

/**
 * Event: A new machine was registered.
 *
 * Machine represents a discrete processing unit (ISA-95 Equipment).
 * Contains Sensors (for measurement) and Devices (for actuation).
 *
 * @example
 * ```typescript
 * const event = new MachineCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'ADMIN-001',
 *   entityId: 'MCH-cnc-001' as AssetId,
 *   entityType: 'machine',
 *   hierarchyPath: ['ENT-acme', 'SIT-chicago', 'PLT-main', 'LIN-assembly-1', 'MCH-cnc-001'] as AssetId[],
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   machineId: 'MCH-cnc-001' as MachineId,
 *   lineId: 'LIN-assembly-1' as LineId,
 *   machineType: 'cnc_mill',
 *   name: 'CNC Mill 001',
 * })
 * ```
 */
export class MachineCreated extends BaseStructuralEvent.extend<MachineCreated>(
  'MachineCreated'
)({
  /** Machine identifier */
  machineId: MachineId,

  /** Parent line */
  lineId: LineId,

  /** Parent work cell (optional - can be directly under Line) */
  workCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),

  /** Display name of the machine */
  name: Schema.NonEmptyString,

  /** Machine type/category (e.g., 'cnc_mill', 'lathe', 'press') */
  machineType: Schema.NonEmptyString,

  /** Equipment manufacturer */
  manufacturer: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Model number */
  modelNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Serial number */
  serialNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Installation date */
  installationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Description of the machine */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Initial configuration */
  initialConfig: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
}) {
  describe(): string {
    return `Machine ${this.name} (${this.machineId}) created under line ${this.lineId}`
  }
}
export type MachineCreatedType = typeof MachineCreated.Type

/**
 * Event: Machine metadata was updated.
 */
export class MachineUpdated extends BaseStructuralEvent.extend<MachineUpdated>(
  'MachineUpdated'
)({
  /** Machine identifier */
  machineId: MachineId,

  /** Parent line */
  lineId: LineId,

  /** Updated name (if changed) */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated machine type (if changed) */
  machineType: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated manufacturer (if changed) */
  manufacturer: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated model number (if changed) */
  modelNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated serial number (if changed) */
  serialNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated description (if changed) */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Reason for the update */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Machine ${this.machineId} updated`
  }
}
export type MachineUpdatedType = typeof MachineUpdated.Type

/**
 * Event: Machine configuration was changed.
 *
 * Captures operational configuration changes that affect machine behavior.
 */
export class MachineConfigChanged extends BaseStructuralEvent.extend<MachineConfigChanged>(
  'MachineConfigChanged'
)({
  /** Machine identifier */
  machineId: MachineId,

  /** Parent line */
  lineId: LineId,

  /** Configuration key that changed */
  configKey: Schema.NonEmptyString,

  /** Previous value (if any) */
  previousValue: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),

  /** New value */
  newValue: Schema.Unknown,

  /** Reason for the change */
  reason: Schema.NonEmptyString,

  /** Whether this requires machine restart */
  requiresRestart: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {
  describe(): string {
    return `Machine ${this.machineId} config changed: ${this.configKey}`
  }
}
export type MachineConfigChangedType = typeof MachineConfigChanged.Type

/**
 * Event: Machine was relocated to a different line or work cell.
 *
 * Triggers cascade updates to all child Sensors and Devices.
 */
export class MachineRelocated extends BaseStructuralEvent.extend<MachineRelocated>(
  'MachineRelocated'
)({
  /** Machine identifier */
  machineId: MachineId,

  /** Previous parent line */
  previousLineId: LineId,

  /** Previous parent work cell (if any) */
  previousWorkCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),

  /** New parent line */
  newLineId: LineId,

  /** New parent work cell (if any) */
  newWorkCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),

  /** Reason for relocation */
  reason: Schema.NonEmptyString,

  /** Effective date of relocation */
  effectiveDate: Schema.DateTimeUtc,
}) {
  describe(): string {
    return `Machine ${this.machineId} relocated from ${this.previousLineId} to ${this.newLineId}`
  }
}
export type MachineRelocatedType = typeof MachineRelocated.Type

/**
 * Event: Machine was decommissioned.
 *
 * All child Sensors and Devices are cascaded as decommissioned.
 */
export class MachineDecommissioned extends BaseStructuralEvent.extend<MachineDecommissioned>(
  'MachineDecommissioned'
)({
  /** Machine identifier */
  machineId: MachineId,

  /** Parent line */
  lineId: LineId,

  /** Reason for decommissioning */
  reason: Schema.NonEmptyString,

  /** Effective date of decommissioning */
  effectiveDate: Schema.DateTimeUtc,

  /** Final operational hours */
  totalOperationalHours: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),

  /** Notes about the decommissioning */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Machine ${this.machineId} decommissioned: ${this.reason}`
  }
}
export type MachineDecommissionedType = typeof MachineDecommissioned.Type

// =============================================================================
// Sensor Events (L0 - Control Module / Read)
// =============================================================================

/**
 * Sensor threshold configuration (defined here, not in asset schemas).
 */
export const SensorThresholds = Schema.Struct({
  /** Warning high threshold */
  warningHigh: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Critical high threshold */
  criticalHigh: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Warning low threshold */
  warningLow: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Critical low threshold */
  criticalLow: Schema.optionalWith(Schema.Number, { as: 'Option' }),
})
export type SensorThresholds = Schema.Schema.Type<typeof SensorThresholds>

/**
 * Event: A new sensor was registered.
 *
 * Sensor is an ISA-95 Control Module that reads values (instrumentation).
 * Sensors generate temporal events (readings) stored in TimescaleDB.
 *
 * @example
 * ```typescript
 * const event = new SensorCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'ADMIN-001',
 *   entityId: 'SNS-temp-001' as AssetId,
 *   entityType: 'sensor',
 *   hierarchyPath: ['ENT-acme', 'SIT-chicago', 'PLT-main', 'LIN-assembly-1', 'MCH-cnc-001', 'SNS-temp-001'] as AssetId[],
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   sensorId: 'SNS-temp-001' as SensorId,
 *   machineId: 'MCH-cnc-001' as MachineId,
 *   name: 'Spindle Temperature',
 *   sensorType: 'temperature',
 *   unit: 'celsius',
 * })
 * ```
 */
export class SensorCreated extends BaseStructuralEvent.extend<SensorCreated>(
  'SensorCreated'
)({
  /** Sensor identifier */
  sensorId: SensorId,

  /** Parent machine */
  machineId: MachineId,

  /** Display name of the sensor */
  name: Schema.NonEmptyString,

  /** Sensor type/classification */
  sensorType: SensorType,

  /** Measurement unit */
  unit: MeasurementUnit,

  /** Sample rate in milliseconds */
  sampleRateMs: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Initial threshold configuration */
  thresholds: Schema.optionalWith(SensorThresholds, { as: 'Option' }),

  /** OPC-UA Node ID for integration */
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Description of the sensor */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Sensor ${this.name} (${this.sensorId}) created under machine ${this.machineId}`
  }
}
export type SensorCreatedType = typeof SensorCreated.Type

/**
 * Event: Sensor metadata was updated.
 */
export class SensorUpdated extends BaseStructuralEvent.extend<SensorUpdated>(
  'SensorUpdated'
)({
  /** Sensor identifier */
  sensorId: SensorId,

  /** Parent machine */
  machineId: MachineId,

  /** Updated name (if changed) */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated sensor type (if changed) */
  sensorType: Schema.optionalWith(SensorType, { as: 'Option' }),

  /** Updated unit (if changed) */
  unit: Schema.optionalWith(MeasurementUnit, { as: 'Option' }),

  /** Updated sample rate (if changed) */
  sampleRateMs: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Updated OPC-UA Node ID (if changed) */
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated description (if changed) */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Reason for the update */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Sensor ${this.sensorId} updated`
  }
}
export type SensorUpdatedType = typeof SensorUpdated.Type

/**
 * Event: Sensor was calibrated.
 *
 * Calibration affects the interpretation of future readings.
 * This is a structural event because it changes the sensor's configuration.
 */
export class SensorCalibrated extends BaseStructuralEvent.extend<SensorCalibrated>(
  'SensorCalibrated'
)({
  /** Sensor identifier */
  sensorId: SensorId,

  /** Parent machine */
  machineId: MachineId,

  /** Calibration date */
  calibrationDate: Schema.DateTimeUtc,

  /** Next calibration due date */
  nextCalibrationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Calibration performed by (technician/system) */
  calibratedBy: Schema.NonEmptyString,

  /** Calibration certificate/reference number */
  certificateNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Offset adjustment applied */
  offsetAdjustment: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Gain/scale adjustment applied */
  gainAdjustment: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Calibration notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Sensor ${this.sensorId} calibrated by ${this.calibratedBy}`
  }
}
export type SensorCalibratedType = typeof SensorCalibrated.Type

/**
 * Event: Sensor alarm thresholds were changed.
 *
 * Distinct from SensorUpdated - this specifically captures threshold changes
 * that affect alarm triggering.
 */
export class SensorThresholdChanged extends BaseStructuralEvent.extend<SensorThresholdChanged>(
  'SensorThresholdChanged'
)({
  /** Sensor identifier */
  sensorId: SensorId,

  /** Parent machine */
  machineId: MachineId,

  /** Previous thresholds */
  previousThresholds: SensorThresholds,

  /** New thresholds */
  newThresholds: SensorThresholds,

  /** Reason for the change */
  reason: Schema.NonEmptyString,

  /** Approved by (if required) */
  approvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Sensor ${this.sensorId} thresholds changed: ${this.reason}`
  }
}
export type SensorThresholdChangedType = typeof SensorThresholdChanged.Type

/**
 * Event: Sensor was decommissioned.
 */
export class SensorDecommissioned extends BaseStructuralEvent.extend<SensorDecommissioned>(
  'SensorDecommissioned'
)({
  /** Sensor identifier */
  sensorId: SensorId,

  /** Parent machine */
  machineId: MachineId,

  /** Reason for decommissioning */
  reason: Schema.NonEmptyString,

  /** Effective date of decommissioning */
  effectiveDate: Schema.DateTimeUtc,

  /** Total readings recorded by this sensor */
  totalReadingsCount: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), { as: 'Option' }),

  /** Notes about the decommissioning */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Sensor ${this.sensorId} decommissioned: ${this.reason}`
  }
}
export type SensorDecommissionedType = typeof SensorDecommissioned.Type

// =============================================================================
// Device Events (L0 - Control Module / Write)
// =============================================================================

/**
 * Event: A new device (actuator) was registered.
 *
 * Device is an ISA-95 Control Module that writes values (actuation).
 * Devices receive commands and report status.
 *
 * @example
 * ```typescript
 * const event = new DeviceCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'ADMIN-001',
 *   entityId: 'DEV-motor-001' as AssetId,
 *   entityType: 'device',
 *   hierarchyPath: ['ENT-acme', 'SIT-chicago', 'PLT-main', 'LIN-assembly-1', 'MCH-cnc-001', 'DEV-motor-001'] as AssetId[],
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   deviceId: 'DEV-motor-001' as DeviceId,
 *   machineId: 'MCH-cnc-001' as MachineId,
 *   name: 'Spindle Motor',
 *   deviceType: 'motor',
 * })
 * ```
 */
export class DeviceCreated extends BaseStructuralEvent.extend<DeviceCreated>(
  'DeviceCreated'
)({
  /** Device identifier */
  deviceId: DeviceId,

  /** Parent machine */
  machineId: MachineId,

  /** Display name of the device */
  name: Schema.NonEmptyString,

  /** Device type/classification */
  deviceType: DeviceType,

  /** Control mode */
  controlMode: Schema.optionalWith(ControlMode, { as: 'Option' }),

  /** Rated power capacity */
  ratedPower: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Power unit (W, kW, HP) */
  powerUnit: Schema.optionalWith(Schema.Literal('W', 'kW', 'HP'), { as: 'Option' }),

  /** OPC-UA Node ID for integration */
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Description of the device */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Device ${this.name} (${this.deviceId}) created under machine ${this.machineId}`
  }
}
export type DeviceCreatedType = typeof DeviceCreated.Type

/**
 * Event: Device metadata was updated.
 */
export class DeviceUpdated extends BaseStructuralEvent.extend<DeviceUpdated>(
  'DeviceUpdated'
)({
  /** Device identifier */
  deviceId: DeviceId,

  /** Parent machine */
  machineId: MachineId,

  /** Updated name (if changed) */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated device type (if changed) */
  deviceType: Schema.optionalWith(DeviceType, { as: 'Option' }),

  /** Updated control mode (if changed) */
  controlMode: Schema.optionalWith(ControlMode, { as: 'Option' }),

  /** Updated rated power (if changed) */
  ratedPower: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Updated power unit (if changed) */
  powerUnit: Schema.optionalWith(Schema.Literal('W', 'kW', 'HP'), { as: 'Option' }),

  /** Updated OPC-UA Node ID (if changed) */
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated description (if changed) */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Reason for the update */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Device ${this.deviceId} updated`
  }
}
export type DeviceUpdatedType = typeof DeviceUpdated.Type

/**
 * Event: Device was decommissioned.
 */
export class DeviceDecommissioned extends BaseStructuralEvent.extend<DeviceDecommissioned>(
  'DeviceDecommissioned'
)({
  /** Device identifier */
  deviceId: DeviceId,

  /** Parent machine */
  machineId: MachineId,

  /** Reason for decommissioning */
  reason: Schema.NonEmptyString,

  /** Effective date of decommissioning */
  effectiveDate: Schema.DateTimeUtc,

  /** Total operation hours */
  totalOperationHours: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),

  /** Notes about the decommissioning */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Device ${this.deviceId} decommissioned: ${this.reason}`
  }
}
export type DeviceDecommissionedType = typeof DeviceDecommissioned.Type

// =============================================================================
// Event Union for Lower Hierarchy
// =============================================================================

/**
 * Union of all lower hierarchy structural events.
 */
export const LowerHierarchyEvent = Schema.Union(
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
  DeviceDecommissioned
)
export type LowerHierarchyEvent = Schema.Schema.Type<typeof LowerHierarchyEvent>

