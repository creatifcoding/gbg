/** Asset graph query service — domain reads built on the generic GraphClient boundary. */

import { Effect, Stream } from 'effect'
import type { DeviceId, LineId, MachineId, PlantId } from '../../schemas/identifiers'
import type {
  Line,
  Machine,
  MeasurementUnit,
  Plant,
  Sensor,
  SensorHierarchy,
  SensorType,
} from '../../schemas/assets'
import { GraphQueryError, HierarchyError } from '../../schemas/errors'
import { GraphClient } from '../l1/GraphClient'

const escapeCypher = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

export class AssetGraphQueries extends Effect.Service<AssetGraphQueries>()('iiot/AssetGraphQueries', {
  dependencies: [GraphClient.Default],
  effect: Effect.gen(function* () {
    const graph = yield* GraphClient

    const getPlants = (): Stream.Stream<Plant, GraphQueryError> =>
      Stream.fromEffect(
        graph.executeReadOnlyCypher(
          `MATCH (p:plant) RETURN p.id AS id, p.name AS name, p.location AS location`,
          '(id agtype, name agtype, location agtype)',
        ),
      ).pipe(
        Stream.flatMap((result) => Stream.fromIterable(result.rows.map((row) => ({
          _tag: 'Plant',
          id: String(row['id']) as PlantId,
          name: String(row['name']),
          location: row['location'] ? String(row['location']) : undefined,
        }) as Plant))),
      )

    const getLinesForPlant = (plantId: PlantId): Stream.Stream<Line, GraphQueryError> =>
      Stream.fromEffect(
        graph.executeReadOnlyCypher(
          `MATCH (p:plant {id: '${escapeCypher(plantId)}'})-[:contains]->(l:line)
           RETURN l.id AS id, l.name AS name`,
          '(id agtype, name agtype)',
        ),
      ).pipe(
        Stream.flatMap((result) => Stream.fromIterable(result.rows.map((row) => ({
          _tag: 'Line',
          id: String(row['id']) as LineId,
          name: String(row['name']),
          plantId,
        }) as Line))),
      )

    const getMachinesForLine = (lineId: LineId): Stream.Stream<Machine, GraphQueryError> =>
      Stream.fromEffect(
        graph.executeReadOnlyCypher(
          `MATCH (l:line {id: '${escapeCypher(lineId)}'})-[:contains]->(m:machine)
           RETURN m.id AS id, m.name AS name, m.model AS model`,
          '(id agtype, name agtype, model agtype)',
        ),
      ).pipe(
        Stream.flatMap((result) => Stream.fromIterable(result.rows.map((row) => ({
          _tag: 'Machine',
          id: String(row['id']) as MachineId,
          name: String(row['name']),
          model: row['model'] ? String(row['model']) : undefined,
          lineId,
        }) as Machine))),
      )

    const getSensorsForMachine = (machineId: MachineId): Stream.Stream<Sensor, GraphQueryError> =>
      Stream.fromEffect(
        graph.executeReadOnlyCypher(
          `MATCH (m:machine {id: '${escapeCypher(machineId)}'})<-[:monitors]-(s:sensor)
           RETURN s.device_id AS device_id, s.type AS type, s.unit AS unit`,
          '(device_id agtype, type agtype, unit agtype)',
        ),
      ).pipe(
        Stream.flatMap((result) => Stream.fromIterable(result.rows.map((row) => ({
          _tag: 'Sensor',
          deviceId: String(row['deviceId']) as DeviceId,
          type: String(row['type']) as SensorType,
          unit: String(row['unit']) as MeasurementUnit,
          machineId,
        }) as Sensor))),
      )

    const getAllSensors = (): Stream.Stream<Sensor, GraphQueryError> =>
      Stream.fromEffect(
        graph.executeReadOnlyCypher(
          `MATCH (s:sensor)-[:monitors]->(m:machine)
           RETURN s.device_id AS device_id, s.type AS type, s.unit AS unit, m.id AS machine_id`,
          '(device_id agtype, type agtype, unit agtype, machine_id agtype)',
        ),
      ).pipe(
        Stream.flatMap((result) => Stream.fromIterable(result.rows.map((row) => ({
          _tag: 'Sensor',
          deviceId: String(row['deviceId']) as DeviceId,
          type: String(row['type']) as SensorType,
          unit: String(row['unit']) as MeasurementUnit,
          machineId: String(row['machineId']) as MachineId,
        }) as Sensor))),
      )

    const getSensorHierarchy = (deviceId: DeviceId): Effect.Effect<SensorHierarchy, GraphQueryError | HierarchyError> =>
      Effect.gen(function* () {
        const result = yield* graph.executeReadOnlyCypher(
          `MATCH (s:sensor {device_id: '${escapeCypher(deviceId)}'})-[:monitors]->(m:machine)
                 <-[:contains]-(l:line)<-[:contains]-(p:plant)
           RETURN s.device_id AS device_id, m.name AS machine_name,
                  l.name AS line_name, p.name AS plant_name`,
          '(device_id agtype, machine_name agtype, line_name agtype, plant_name agtype)',
        )

        if (result.rows.length === 0) {
          return yield* Effect.fail(new HierarchyError({ message: `No hierarchy found for sensor ${deviceId}` }))
        }

        const row = result.rows[0]
        return {
          deviceId: String(row['deviceId']) as DeviceId,
          machineName: String(row['machineName']),
          lineName: String(row['lineName']),
          plantName: String(row['plantName']),
        }
      })

    const getPlantHierarchy = (plantId: PlantId): Effect.Effect<{
      plant: Plant
      lines: Array<{
        line: Line
        machines: Array<{
          machine: Machine
          sensors: Sensor[]
        }>
      }>
    }, GraphQueryError | HierarchyError> =>
      Effect.gen(function* () {
        const plantResult = yield* graph.executeReadOnlyCypher(
          `MATCH (p:plant {id: '${escapeCypher(plantId)}'})
           RETURN p.id AS id, p.name AS name, p.location AS location`,
          '(id agtype, name agtype, location agtype)',
        )

        if (plantResult.rows.length === 0) {
          return yield* Effect.fail(new HierarchyError({ message: `Plant ${plantId} not found` }))
        }

        const plantRow = plantResult.rows[0]
        const plant: Plant = {
          _tag: 'Plant',
          id: String(plantRow['id']) as PlantId,
          name: String(plantRow['name']),
          location: plantRow['location'] ? String(plantRow['location']) : undefined,
        }

        const hierarchyResult = yield* graph.executeReadOnlyCypher(
          `MATCH (p:plant {id: '${escapeCypher(plantId)}'})-[:contains]->(l:line)
                 -[:contains]->(m:machine)<-[:monitors]-(s:sensor)
           RETURN l.id AS line_id, l.name AS line_name,
                  m.id AS machine_id, m.name AS machine_name, m.model AS machine_model,
                  s.device_id AS device_id, s.type AS sensor_type, s.unit AS sensor_unit`,
          '(line_id agtype, line_name agtype, machine_id agtype, machine_name agtype, machine_model agtype, device_id agtype, sensor_type agtype, sensor_unit agtype)',
        )

        const linesMap = new Map<string, {
          line: Line
          machinesMap: Map<string, { machine: Machine; sensors: Sensor[] }>
        }>()

        for (const row of hierarchyResult.rows) {
          const lineId = String(row['lineId'])
          const machineId = String(row['machineId'])

          if (!linesMap.has(lineId)) {
            linesMap.set(lineId, {
              line: {
                _tag: 'Line',
                id: lineId as LineId,
                name: String(row['lineName']),
                plantId,
              },
              machinesMap: new Map(),
            })
          }

          const lineData = linesMap.get(lineId)!
          if (!lineData.machinesMap.has(machineId)) {
            lineData.machinesMap.set(machineId, {
              machine: {
                _tag: 'Machine',
                id: machineId as MachineId,
                name: String(row['machineName']),
                model: row['machineModel'] ? String(row['machineModel']) : undefined,
                lineId: lineId as LineId,
              },
              sensors: [],
            })
          }

          lineData.machinesMap.get(machineId)!.sensors.push({
            _tag: 'Sensor',
            deviceId: String(row['deviceId']) as DeviceId,
            type: String(row['sensorType']) as SensorType,
            unit: String(row['sensorUnit']) as MeasurementUnit,
            machineId: machineId as MachineId,
          })
        }

        return {
          plant,
          lines: Array.from(linesMap.values()).map((lineData) => ({
            line: lineData.line,
            machines: Array.from(lineData.machinesMap.values()),
          })),
        }
      })

    return {
      getPlants,
      getLinesForPlant,
      getMachinesForLine,
      getSensorsForMachine,
      getAllSensors,
      getSensorHierarchy,
      getPlantHierarchy,
    } as const
  }),
}) {}

export const AssetGraphQueriesLive = AssetGraphQueries.Default
