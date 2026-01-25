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
export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  id: PlantId,
  name: Schema.NonEmptyString,
  location: Schema.optional(Schema.String),
}) {}

/** Production line within a plant */
export class Line extends Schema.TaggedClass<Line>()('Line', {
  id: LineId,
  name: Schema.NonEmptyString,
  plantId: PlantId,
}) {}

/** Machine/equipment within a production line */
export class Machine extends Schema.TaggedClass<Machine>()('Machine', {
  id: MachineId,
  name: Schema.NonEmptyString,
  model: Schema.optional(Schema.String),
  lineId: LineId,
}) {}

/** Sensor monitoring a machine */
export class Sensor extends Schema.TaggedClass<Sensor>()('Sensor', {
  deviceId: DeviceId,
  type: SensorType,
  unit: MeasurementUnit,
  machineId: MachineId,
}) {}

// =============================================================================
// Asset Hierarchy (denormalized for queries)
// =============================================================================

/** Full sensor hierarchy path */
export class SensorHierarchy extends Schema.TaggedClass<SensorHierarchy>()('SensorHierarchy', {
  deviceId: DeviceId,
  machineName: Schema.String,
  lineName: Schema.String,
  plantName: Schema.String,
}) {}

/** Machine with its sensors */
export class MachineWithSensors extends Schema.TaggedClass<MachineWithSensors>()('MachineWithSensors', {
  machine: Machine,
  sensors: Schema.Array(Sensor),
}) {}

/** Line with its machines */
export class LineWithMachines extends Schema.TaggedClass<LineWithMachines>()('LineWithMachines', {
  line: Line,
  machines: Schema.Array(MachineWithSensors),
}) {}

/** Plant with its complete hierarchy */
export class PlantHierarchy extends Schema.TaggedClass<PlantHierarchy>()('PlantHierarchy', {
  plant: Plant,
  lines: Schema.Array(LineWithMachines),
}) {}
