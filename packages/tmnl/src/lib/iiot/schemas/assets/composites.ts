/**
 * Composite Asset Schemas
 *
 * These schemas define composite/hierarchical views of assets.
 * They are used for RPC responses and service return types.
 *
 * NOTE: These are "view" schemas - they represent denormalized
 * hierarchy traversal results, not the canonical entity schemas.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/composites
 */

import { Schema } from 'effect'
import { DeviceId, PlantId, LineId, MachineId } from '../identifiers'

// =============================================================================
// SensorHierarchy - Path from Sensor to Plant
// =============================================================================

/**
 * Denormalized path from sensor up to plant.
 * Result of a graph traversal: sensor -> machine -> line -> plant
 *
 * Contains names (not full entities) for lightweight response.
 */
export const SensorHierarchy = Schema.Struct({
  /** Device ID of the sensor */
  deviceId: DeviceId,
  /** Name of the machine the sensor monitors */
  machineName: Schema.String,
  /** Name of the line containing the machine */
  lineName: Schema.String,
  /** Name of the plant containing the line */
  plantName: Schema.String,
}).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SensorHierarchy',
    description: 'Denormalized hierarchy path from sensor to plant',
  })
)
export type SensorHierarchy = Schema.Schema.Type<typeof SensorHierarchy>

// =============================================================================
// MachineWithSensors - Machine + Sensors View
// =============================================================================

/**
 * Machine entity with its attached sensors.
 * Used for querying a machine and all sensors monitoring it.
 *
 * Uses lazy reference to avoid circular dependency with Machine/Sensor schemas.
 */
export const MachineWithSensors = Schema.Struct({
  /** The machine entity (simplified inline) */
  machine: Schema.Struct({
    _tag: Schema.Literal('Machine'),
    id: MachineId,
    name: Schema.String,
    model: Schema.optional(Schema.String),
    lineId: LineId,
  }),
  /** Array of sensors monitoring this machine (simplified inline) */
  sensors: Schema.Array(
    Schema.Struct({
      _tag: Schema.Literal('Sensor'),
      deviceId: DeviceId,
      type: Schema.String, // SensorType simplified
      unit: Schema.String, // MeasurementUnit simplified
      machineId: MachineId,
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/MachineWithSensors',
    description: 'Machine with its attached sensors',
  })
)
export type MachineWithSensors = Schema.Schema.Type<typeof MachineWithSensors>

// =============================================================================
// LineWithMachines - Line + Machines + Sensors View
// =============================================================================

/**
 * Line entity with its contained machines and their sensors.
 * Used for intermediate hierarchy aggregation.
 */
export const LineWithMachines = Schema.Struct({
  /** The line entity (simplified inline) */
  line: Schema.Struct({
    _tag: Schema.Literal('Line'),
    id: LineId,
    name: Schema.String,
    plantId: PlantId,
  }),
  /** Array of machines with their sensors */
  machines: Schema.Array(MachineWithSensors),
}).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/LineWithMachines',
    description: 'Line with its machines and their sensors',
  })
)
export type LineWithMachines = Schema.Schema.Type<typeof LineWithMachines>

// =============================================================================
// PlantHierarchy - Complete Plant View
// =============================================================================

/**
 * Complete plant hierarchy: plant -> lines -> machines -> sensors.
 * Result of a full downward graph traversal from plant.
 */
export const PlantHierarchy = Schema.Struct({
  /** The plant entity (simplified inline) */
  plant: Schema.Struct({
    _tag: Schema.Literal('Plant'),
    id: PlantId,
    name: Schema.String,
    location: Schema.optional(Schema.String),
  }),
  /** Array of lines with their machines and sensors */
  lines: Schema.Array(LineWithMachines),
}).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/PlantHierarchy',
    description: 'Complete plant hierarchy with lines, machines, and sensors',
  })
)
export type PlantHierarchy = Schema.Schema.Type<typeof PlantHierarchy>
