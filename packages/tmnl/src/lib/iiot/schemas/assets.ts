/**
 * IIoT Asset Hierarchy Schemas
 *
 * Effect Schema definitions for the asset hierarchy:
 * Plant -> Line -> Machine -> Sensor
 *
 * These map to Apache AGE graph nodes in the database.
 *
 * @module
 */

import { Schema } from 'effect'
import { PlantId, LineId, MachineId, DeviceId } from './identifiers'

// =============================================================================
// Sensor Types
// =============================================================================

/** Supported sensor measurement types */
export const SensorType = Schema.Literal(
  'temperature',
  'vibration',
  'humidity',
  'speed',
  'current',
  'pressure',
  'flow',
  'level'
)
export type SensorType = Schema.Schema.Type<typeof SensorType>

/** Measurement unit strings */
export const MeasurementUnit = Schema.Literal(
  'celsius',
  'fahrenheit',
  'mm/s',
  'percent',
  'm/min',
  'amps',
  'psi',
  'bar',
  'l/min',
  'gpm',
  'meters',
  'feet'
)
export type MeasurementUnit = Schema.Schema.Type<typeof MeasurementUnit>

// =============================================================================
// Asset Schemas
// =============================================================================

/** Manufacturing plant */
export const Plant = Schema.TaggedStruct('Plant', {
  id: PlantId,
  name: Schema.NonEmptyString,
  location: Schema.optional(Schema.String),
})
export type Plant = Schema.Schema.Type<typeof Plant>

/** Production line within a plant */
export const Line = Schema.TaggedStruct('Line', {
  id: LineId,
  name: Schema.NonEmptyString,
  plantId: PlantId,
})
export type Line = Schema.Schema.Type<typeof Line>

/** Machine/equipment within a production line */
export const Machine = Schema.TaggedStruct('Machine', {
  id: MachineId,
  name: Schema.NonEmptyString,
  model: Schema.optional(Schema.String),
  lineId: LineId,
})
export type Machine = Schema.Schema.Type<typeof Machine>

/** Sensor monitoring a machine */
export const Sensor = Schema.TaggedStruct('Sensor', {
  deviceId: DeviceId,
  type: SensorType,
  unit: MeasurementUnit,
  machineId: MachineId,
})
export type Sensor = Schema.Schema.Type<typeof Sensor>

// =============================================================================
// Asset Hierarchy (denormalized for queries)
// =============================================================================

/** Full sensor hierarchy path */
export const SensorHierarchy = Schema.TaggedStruct('SensorHierarchy', {
  deviceId: DeviceId,
  machineName: Schema.String,
  lineName: Schema.String,
  plantName: Schema.String,
})
export type SensorHierarchy = Schema.Schema.Type<typeof SensorHierarchy>

/** Machine with its sensors */
export const MachineWithSensors = Schema.TaggedStruct('MachineWithSensors', {
  machine: Machine,
  sensors: Schema.Array(Sensor),
})
export type MachineWithSensors = Schema.Schema.Type<typeof MachineWithSensors>

/** Line with its machines */
export const LineWithMachines = Schema.TaggedStruct('LineWithMachines', {
  line: Line,
  machines: Schema.Array(MachineWithSensors),
})
export type LineWithMachines = Schema.Schema.Type<typeof LineWithMachines>

/** Plant with its complete hierarchy */
export const PlantHierarchy = Schema.TaggedStruct('PlantHierarchy', {
  plant: Plant,
  lines: Schema.Array(LineWithMachines),
})
export type PlantHierarchy = Schema.Schema.Type<typeof PlantHierarchy>
