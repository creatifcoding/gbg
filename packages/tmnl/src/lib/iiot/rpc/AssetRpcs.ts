/**
 * AssetRpcs - RPC Definitions for Asset Hierarchy Operations
 *
 * Stateless graph queries for Plant/Line/Machine/Sensor hierarchy.
 * All tags imported from centralized tags.ts.
 *
 * @module
 */

import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'
import { DeviceId, MachineId, PlantId, LineId } from '../schemas/identifiers'
import {
  PlantSchema,
  LineSchema,
  MachineSchema,
  SensorSchema,
  SensorHierarchy,
  PlantHierarchy,
  MachineWithSensors,
} from '../schemas/assets'
import { RpcGraphError, RpcPlantNotFoundError, RpcMachineNotFoundError, RpcHierarchyError } from './errors'
import {
  SensorHierarchyGetTag,
  PlantHierarchyGetTag,
  MachineGetWithSensorsTag,
  PlantGetTag,
  PlantListTag,
  LineListForPlantTag,
  MachineListForLineTag,
  SensorListForMachineTag,
} from '../tags'

// =============================================================================
// Plant Operations
// =============================================================================

/** List all plants */
export const ListPlants = Rpc.make(PlantListTag, {
  success: PlantSchema,
  error: RpcGraphError,
  stream: true,
})

/** Get plant by ID */
export const GetPlant = Rpc.make(PlantGetTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  success: PlantSchema,
  error: Schema.Union(RpcGraphError, RpcPlantNotFoundError),
})

/** Get complete plant hierarchy (plant → lines → machines → sensors) */
export const GetPlantHierarchy = Rpc.make(PlantHierarchyGetTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  success: PlantHierarchy,
  error: Schema.Union(RpcGraphError, RpcPlantNotFoundError),
})

// =============================================================================
// Line Operations
// =============================================================================

/** List lines for a plant */
export const ListLinesForPlant = Rpc.make(LineListForPlantTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  success: LineSchema,
  error: RpcGraphError,
  stream: true,
})

// =============================================================================
// Machine Operations
// =============================================================================

/** List machines for a line */
export const ListMachinesForLine = Rpc.make(MachineListForLineTag, {
  payload: Schema.Struct({
    lineId: LineId,
  }),
  success: MachineSchema,
  error: RpcGraphError,
  stream: true,
})

/** Get machine with its sensors */
export const GetMachineWithSensors = Rpc.make(MachineGetWithSensorsTag, {
  payload: Schema.Struct({
    machineId: MachineId,
  }),
  success: MachineWithSensors,
  error: Schema.Union(RpcGraphError, RpcMachineNotFoundError),
})

// =============================================================================
// Sensor Operations
// =============================================================================

/** List sensors for a machine */
export const ListSensorsForMachine = Rpc.make(SensorListForMachineTag, {
  payload: Schema.Struct({
    machineId: MachineId,
  }),
  success: SensorSchema,
  error: RpcGraphError,
  stream: true,
})

/** Get sensor hierarchy path (sensor → machine → line → plant) */
export const GetSensorHierarchy = Rpc.make(SensorHierarchyGetTag, {
  payload: Schema.Struct({
    deviceId: DeviceId,
  }),
  success: SensorHierarchy,
  error: Schema.Union(RpcGraphError, RpcHierarchyError),
})

// =============================================================================
// RpcGroup Export
// =============================================================================

export const AssetRpcs = RpcGroup.make(
  // Plant operations
  ListPlants,
  GetPlant,
  GetPlantHierarchy,
  // Line operations
  ListLinesForPlant,
  // Machine operations
  ListMachinesForLine,
  GetMachineWithSensors,
  // Sensor operations
  ListSensorsForMachine,
  GetSensorHierarchy
)

// Export type for client typing
export type AssetRpcs = typeof AssetRpcs
