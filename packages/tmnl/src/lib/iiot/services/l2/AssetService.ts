/**
 * AssetService - L2 Domain Service for Asset Hierarchy
 *
 * Business logic for asset management:
 * - Plant/Line/Machine/Sensor hierarchy traversal
 * - Asset registration and discovery
 * - Topology queries
 *
 * @module
 */

import { Effect, Stream, Chunk } from 'effect'
import type { DeviceId, MachineId, LineId, PlantId } from '../../schemas/identifiers'
import type {
  Plant,
  Line,
  Machine,
  Sensor,
  SensorHierarchy,
  PlantHierarchy,
  MachineWithSensors,
  LineWithMachines,
} from '../../schemas/assets'
import {
  MachineNotFoundError,
  PlantNotFoundError,
  HierarchyError,
  GraphQueryError,
} from '../../schemas/errors'
import { GraphClient } from '../l1/GraphClient'

// =============================================================================
// Error Union
// =============================================================================

export type AssetServiceError =
  | MachineNotFoundError
  | PlantNotFoundError
  | HierarchyError
  | GraphQueryError

// =============================================================================
// Service Definition
// =============================================================================

export class AssetService extends Effect.Service<AssetService>()('iiot/AssetService', {
  dependencies: [GraphClient.Default],

  effect: Effect.gen(function* () {
    const graphClient = yield* GraphClient

    // -------------------------------------------------------------------------
    // Plant Operations
    // -------------------------------------------------------------------------

    /**
     * Get all plants
     */
    const getPlants = (): Stream.Stream<Plant, GraphQueryError> => graphClient.getPlants()

    /**
     * Get plant by ID
     */
    const getPlant = (plantId: PlantId): Effect.Effect<Plant, PlantNotFoundError | GraphQueryError> =>
      Effect.gen(function* () {
        const plants = yield* graphClient.getPlants().pipe(Stream.runCollect)
        const plant = Chunk.toArray(plants).find((p) => p.id === plantId)

        if (!plant) {
          return yield* Effect.fail(new PlantNotFoundError({ plantId }))
        }

        return plant
      })

    // -------------------------------------------------------------------------
    // Line Operations
    // -------------------------------------------------------------------------

    /**
     * Get all lines for a plant
     */
    const getLinesForPlant = (plantId: PlantId): Stream.Stream<Line, GraphQueryError> =>
      graphClient.getLinesForPlant(plantId)

    // -------------------------------------------------------------------------
    // Machine Operations
    // -------------------------------------------------------------------------

    /**
     * Get all machines for a line
     */
    const getMachinesForLine = (lineId: LineId): Stream.Stream<Machine, GraphQueryError> =>
      graphClient.getMachinesForLine(lineId)

    /**
     * Get machine with its sensors
     */
    const getMachineWithSensors = (
      machineId: MachineId
    ): Effect.Effect<MachineWithSensors, MachineNotFoundError | GraphQueryError> =>
      Effect.gen(function* () {
        const sensors = yield* graphClient.getSensorsForMachine(machineId).pipe(Stream.runCollect)

        // Build machine object (would come from graph in real impl)
        const machine: Machine = {
          _tag: 'Machine',
          id: machineId,
          name: `Machine ${machineId}`,
          lineId: 'LINE-001' as LineId,
        }

        return {
          machine,
          sensors: Chunk.toArray(sensors),
        }
      })

    // -------------------------------------------------------------------------
    // Sensor Operations
    // -------------------------------------------------------------------------

    /**
     * Get all sensors for a machine
     */
    const getSensorsForMachine = (machineId: MachineId): Stream.Stream<Sensor, GraphQueryError> =>
      graphClient.getSensorsForMachine(machineId)

    /**
     * Get hierarchy path for a sensor (sensor → machine → line → plant)
     */
    const getSensorHierarchy = (
      deviceId: DeviceId
    ): Effect.Effect<SensorHierarchy, GraphQueryError | HierarchyError> =>
      graphClient.getSensorHierarchy(deviceId)

    // -------------------------------------------------------------------------
    // Full Hierarchy
    // -------------------------------------------------------------------------

    /**
     * Get complete plant hierarchy (plant → lines → machines → sensors)
     */
    const getPlantHierarchy = (
      plantId: PlantId
    ): Effect.Effect<PlantHierarchy, PlantNotFoundError | GraphQueryError> =>
      Effect.gen(function* () {
        // Get plant
        const plant = yield* getPlant(plantId)

        // Get lines
        const linesChunk = yield* graphClient.getLinesForPlant(plantId).pipe(Stream.runCollect)
        const lines = Chunk.toArray(linesChunk)

        // Build hierarchy
        const linesWithMachines: LineWithMachines[] = yield* Effect.all(
          lines.map((line) =>
            Effect.gen(function* () {
              const machinesChunk = yield* graphClient.getMachinesForLine(line.id).pipe(Stream.runCollect)
              const machines = Chunk.toArray(machinesChunk)

              const machinesWithSensors: MachineWithSensors[] = yield* Effect.all(
                machines.map((machine) =>
                  Effect.gen(function* () {
                    const sensorsChunk = yield* graphClient
                      .getSensorsForMachine(machine.id)
                      .pipe(Stream.runCollect)

                    return {
                      machine,
                      sensors: Chunk.toArray(sensorsChunk),
                    }
                  })
                )
              )

              return {
                line,
                machines: machinesWithSensors,
              }
            })
          )
        )

        const hierarchy: PlantHierarchy = {
          plant,
          lines: linesWithMachines,
        }

        return hierarchy
      })

    // -------------------------------------------------------------------------
    // Service API
    // -------------------------------------------------------------------------

    return {
      // Plant operations
      getPlants,
      getPlant,

      // Line operations
      getLinesForPlant,

      // Machine operations
      getMachinesForLine,
      getMachineWithSensors,

      // Sensor operations
      getSensorsForMachine,
      getSensorHierarchy,

      // Full hierarchy
      getPlantHierarchy,
    } as const
  }),
}) {}

// =============================================================================
// Exports
// =============================================================================

export const AssetServiceLive = AssetService.Default
