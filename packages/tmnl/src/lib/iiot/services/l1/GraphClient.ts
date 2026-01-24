/**
 * GraphClient - L1 Apache AGE Access Layer
 *
 * Real implementation using @effect/sql-pg for Apache AGE graph operations:
 * - Cypher query execution via ag_catalog.cypher()
 * - Node/edge CRUD operations
 * - Asset hierarchy traversal
 *
 * Requires: IIoTPgClientLive layer to be provided
 *
 * IMPORTANT: AGE is preloaded via shared_preload_libraries in docker config.
 * No LOAD 'age' statement is needed.
 *
 * @see docker/docker-compose.iiot.yml for database setup
 * @see docker/iiot-db/init.sql for graph schema
 * @module
 */

import { Effect, Stream, Context, Layer } from 'effect'
import { PgClient } from '@effect/sql-pg'
import type {
  DeviceId,
  MachineId,
  LineId,
  PlantId,
} from '../../schemas/identifiers'
import type { Plant, Line, Machine, Sensor, SensorHierarchy, SensorType, MeasurementUnit } from '../../schemas/assets'
import { GraphQueryError, HierarchyError } from '../../schemas/errors'
import { IIoTPgClientLive } from './IIoTPgClient'

// =============================================================================
// Configuration
// =============================================================================

export interface GraphConfig {
  readonly graphName: string
}

export const GraphConfig = Context.GenericTag<GraphConfig>('iiot/GraphConfig')

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  graphName: 'iiot_graph', // Note: Named 'iiot_graph' to avoid conflict with 'iiot' schema
}

// =============================================================================
// Cypher Result Types
// =============================================================================

/** Raw result from Cypher query */
export interface CypherResult {
  readonly rows: ReadonlyArray<Record<string, unknown>>
}

// =============================================================================
// Apache AGE Helper Functions
// =============================================================================

/**
 * Parse agtype JSON result from Apache AGE
 *
 * AGE returns results as agtype which is serialized as JSON string.
 * We need to parse it back to JavaScript objects.
 */
const parseAgtype = (value: unknown): unknown => {
  if (typeof value === 'string') {
    try {
      // agtype strings are JSON encoded
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

/**
 * Escape string for Cypher query
 * Prevents Cypher injection by escaping special characters
 */
const escapeCypher = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// =============================================================================
// Service Definition
// =============================================================================

export class GraphClient extends Effect.Service<GraphClient>()('iiot/GraphClient', {
  effect: Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    const graphName = DEFAULT_GRAPH_CONFIG.graphName

    /**
     * Set search_path for Apache AGE queries
     *
     * Must be called before any Cypher query to ensure ag_catalog functions are available.
     * Note: Using SET LOCAL would scope to transaction, but we use session-level for simplicity.
     */
    const setSearchPath = () =>
      sql.unsafe(`SET search_path = ag_catalog, iiot, public`)

    /**
     * Execute a raw Cypher query
     *
     * Uses ag_catalog.cypher() function to execute Cypher queries.
     * Returns results as parsed JavaScript objects.
     *
     * @param query - Cypher query string
     * @param columnDefs - Column definitions for the AS clause (e.g., "(id agtype, name agtype)")
     */
    const executeCypher = (
      query: string,
      columnDefs: string = '(result agtype)'
    ): Effect.Effect<CypherResult, GraphQueryError> =>
      Effect.gen(function* () {
        yield* Effect.logDebug(`Executing Cypher: ${query.slice(0, 100)}...`)

        // Set search_path for AGE functions
        yield* setSearchPath()

        // Execute Cypher via ag_catalog.cypher()
        // Note: Using unsafe because query structure is dynamic
        const cypherSql = `SELECT * FROM cypher('${graphName}', $$ ${query} $$) AS ${columnDefs}`

        const rawRows = yield* sql.unsafe<Record<string, unknown>>(cypherSql)

        // Parse agtype values in each row
        const rows = rawRows.map((row) => {
          const parsed: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(row)) {
            parsed[key] = parseAgtype(value)
          }
          return parsed
        })

        return { rows }
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new GraphQueryError({
              query,
              message: `Cypher query failed: ${String(cause)}`,
              cause,
            })
          )
        )
      )

    /**
     * Get all plants
     */
    const getPlants = (): Stream.Stream<Plant, GraphQueryError> =>
      Stream.fromEffect(
        executeCypher(
          `MATCH (p:plant) RETURN p.id AS id, p.name AS name, p.location AS location`,
          '(id agtype, name agtype, location agtype)'
        )
      ).pipe(
        Stream.flatMap((result) =>
          Stream.fromIterable(
            result.rows.map(
              (row) =>
                ({
                  _tag: 'Plant',
                  id: String(row['id']) as PlantId,
                  name: String(row['name']),
                  location: row['location'] ? String(row['location']) : undefined,
                }) as Plant
            )
          )
        )
      )

    /**
     * Get lines for a plant
     */
    const getLinesForPlant = (plantId: PlantId): Stream.Stream<Line, GraphQueryError> =>
      Stream.fromEffect(
        executeCypher(
          `MATCH (p:plant {id: '${escapeCypher(plantId)}'})-[:contains]->(l:line)
           RETURN l.id AS id, l.name AS name`,
          '(id agtype, name agtype)'
        )
      ).pipe(
        Stream.flatMap((result) =>
          Stream.fromIterable(
            result.rows.map(
              (row) =>
                ({
                  _tag: 'Line',
                  id: String(row['id']) as LineId,
                  name: String(row['name']),
                  plantId,
                }) as Line
            )
          )
        )
      )

    /**
     * Get machines for a line
     */
    const getMachinesForLine = (lineId: LineId): Stream.Stream<Machine, GraphQueryError> =>
      Stream.fromEffect(
        executeCypher(
          `MATCH (l:line {id: '${escapeCypher(lineId)}'})-[:contains]->(m:machine)
           RETURN m.id AS id, m.name AS name, m.model AS model`,
          '(id agtype, name agtype, model agtype)'
        )
      ).pipe(
        Stream.flatMap((result) =>
          Stream.fromIterable(
            result.rows.map(
              (row) =>
                ({
                  _tag: 'Machine',
                  id: String(row['id']) as MachineId,
                  name: String(row['name']),
                  model: row['model'] ? String(row['model']) : undefined,
                  lineId,
                }) as Machine
            )
          )
        )
      )

    /**
     * Get sensors monitoring a machine
     */
    const getSensorsForMachine = (machineId: MachineId): Stream.Stream<Sensor, GraphQueryError> =>
      Stream.fromEffect(
        executeCypher(
          `MATCH (m:machine {id: '${escapeCypher(machineId)}'})<-[:monitors]-(s:sensor)
           RETURN s.device_id AS deviceId, s.type AS type, s.unit AS unit`,
          '(deviceId agtype, type agtype, unit agtype)'
        )
      ).pipe(
        Stream.flatMap((result) =>
          Stream.fromIterable(
            result.rows.map(
              (row) =>
                ({
                  _tag: 'Sensor',
                  deviceId: String(row['deviceId']) as DeviceId,
                  type: String(row['type']) as SensorType,
                  unit: String(row['unit']) as MeasurementUnit,
                  machineId,
                }) as Sensor
            )
          )
        )
      )

    /**
     * Get full hierarchy path for a sensor
     *
     * Traverses: sensor -[:monitors]-> machine <-[:contains]- line <-[:contains]- plant
     */
    const getSensorHierarchy = (
      deviceId: DeviceId
    ): Effect.Effect<SensorHierarchy, GraphQueryError | HierarchyError> =>
      Effect.gen(function* () {
        const result = yield* executeCypher(
          `MATCH (s:sensor {device_id: '${escapeCypher(deviceId)}'})-[:monitors]->(m:machine)
                 <-[:contains]-(l:line)<-[:contains]-(p:plant)
           RETURN s.device_id AS deviceId, m.name AS machineName,
                  l.name AS lineName, p.name AS plantName`,
          '(deviceId agtype, machineName agtype, lineName agtype, plantName agtype)'
        )

        if (result.rows.length === 0) {
          return yield* Effect.fail(
            new HierarchyError({
              message: `No hierarchy found for sensor ${deviceId}`,
            })
          )
        }

        const row = result.rows[0]
        return {
          deviceId: String(row['deviceId']) as DeviceId,
          machineName: String(row['machineName']),
          lineName: String(row['lineName']),
          plantName: String(row['plantName']),
        }
      })

    /**
     * Create a relationship between alarm and sensor
     *
     * Creates: (alarm)-[:triggered_by]->(sensor)
     */
    const linkAlarmToSensor = (
      alarmId: string,
      deviceId: DeviceId
    ): Effect.Effect<void, GraphQueryError> =>
      Effect.gen(function* () {
        yield* executeCypher(
          `MATCH (a:alarm {id: '${escapeCypher(alarmId)}'}), (s:sensor {device_id: '${escapeCypher(deviceId)}'})
           CREATE (a)-[:triggered_by]->(s)`,
          '(e agtype)'
        )
      })

    /**
     * Get all sensors in the graph with their machine associations
     */
    const getAllSensors = (): Stream.Stream<Sensor, GraphQueryError> =>
      Stream.fromEffect(
        executeCypher(
          `MATCH (s:sensor)-[:monitors]->(m:machine)
           RETURN s.device_id AS deviceId, s.type AS type, s.unit AS unit, m.id AS machineId`,
          '(deviceId agtype, type agtype, unit agtype, machineId agtype)'
        )
      ).pipe(
        Stream.flatMap((result) =>
          Stream.fromIterable(
            result.rows.map(
              (row) =>
                ({
                  _tag: 'Sensor',
                  deviceId: String(row['deviceId']) as DeviceId,
                  type: String(row['type']) as SensorType,
                  unit: String(row['unit']) as MeasurementUnit,
                  machineId: String(row['machineId']) as MachineId,
                }) as Sensor
            )
          )
        )
      )

    /**
     * Create a new alarm node in the graph
     */
    const createAlarmNode = (alarm: {
      id: string
      alarmType: string
      severity: string
      message?: string
      timestamp: Date
    }): Effect.Effect<void, GraphQueryError> =>
      Effect.gen(function* () {
        yield* executeCypher(
          `CREATE (:alarm {
            id: '${escapeCypher(alarm.id)}',
            alarm_type: '${escapeCypher(alarm.alarmType)}',
            severity: '${escapeCypher(alarm.severity)}',
            message: '${escapeCypher(alarm.message ?? '')}',
            timestamp: '${alarm.timestamp.toISOString()}'
          })`,
          '(v agtype)'
        )
      })

    /**
     * Get sensors with recent alarms
     */
    const getSensorsWithAlarms = (
      since?: Date
    ): Stream.Stream<
      { sensor: Sensor; alarmCount: number },
      GraphQueryError
    > =>
      Stream.fromEffect(
        Effect.gen(function* () {
          const sinceStr = since?.toISOString() ?? new Date(0).toISOString()

          const result = yield* executeCypher(
            `MATCH (a:alarm)-[:triggered_by]->(s:sensor)-[:monitors]->(m:machine)
             WHERE a.timestamp >= '${sinceStr}'
             RETURN s.device_id AS deviceId, s.type AS type, s.unit AS unit,
                    m.id AS machineId, COUNT(a) AS alarmCount`,
            '(deviceId agtype, type agtype, unit agtype, machineId agtype, alarmCount agtype)'
          )

          return result.rows.map((row) => ({
            sensor: {
              _tag: 'Sensor' as const,
              deviceId: String(row['deviceId']) as DeviceId,
              type: String(row['type']) as SensorType,
              unit: String(row['unit']) as MeasurementUnit,
              machineId: String(row['machineId']) as MachineId,
            },
            alarmCount: Number(row['alarmCount']),
          }))
        })
      ).pipe(Stream.flatMap((items) => Stream.fromIterable(items)))

    /**
     * Get plant with full hierarchy (lines, machines, sensors)
     */
    const getPlantHierarchy = (
      plantId: PlantId
    ): Effect.Effect<
      {
        plant: Plant
        lines: Array<{
          line: Line
          machines: Array<{
            machine: Machine
            sensors: Sensor[]
          }>
        }>
      },
      GraphQueryError | HierarchyError
    > =>
      Effect.gen(function* () {
        // Get plant
        const plantResult = yield* executeCypher(
          `MATCH (p:plant {id: '${escapeCypher(plantId)}'})
           RETURN p.id AS id, p.name AS name, p.location AS location`,
          '(id agtype, name agtype, location agtype)'
        )

        if (plantResult.rows.length === 0) {
          return yield* Effect.fail(
            new HierarchyError({ message: `Plant ${plantId} not found` })
          )
        }

        const plantRow = plantResult.rows[0]
        const plant: Plant = {
          _tag: 'Plant',
          id: String(plantRow['id']) as PlantId,
          name: String(plantRow['name']),
          location: plantRow['location'] ? String(plantRow['location']) : undefined,
        }

        // Get full hierarchy in one query
        const hierarchyResult = yield* executeCypher(
          `MATCH (p:plant {id: '${escapeCypher(plantId)}'})-[:contains]->(l:line)
                 -[:contains]->(m:machine)<-[:monitors]-(s:sensor)
           RETURN l.id AS lineId, l.name AS lineName,
                  m.id AS machineId, m.name AS machineName, m.model AS machineModel,
                  s.device_id AS deviceId, s.type AS sensorType, s.unit AS sensorUnit`,
          '(lineId agtype, lineName agtype, machineId agtype, machineName agtype, machineModel agtype, deviceId agtype, sensorType agtype, sensorUnit agtype)'
        )

        // Group results into hierarchy structure
        const linesMap = new Map<
          string,
          {
            line: Line
            machinesMap: Map<
              string,
              { machine: Machine; sensors: Sensor[] }
            >
          }
        >()

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

          const machineData = lineData.machinesMap.get(machineId)!
          machineData.sensors.push({
            _tag: 'Sensor',
            deviceId: String(row['deviceId']) as DeviceId,
            type: String(row['sensorType']) as SensorType,
            unit: String(row['sensorUnit']) as MeasurementUnit,
            machineId: machineId as MachineId,
          })
        }

        // Convert to final structure
        const lines = Array.from(linesMap.values()).map((lineData) => ({
          line: lineData.line,
          machines: Array.from(lineData.machinesMap.values()),
        }))

        return { plant, lines }
      })

    /**
     * Check if Apache AGE graph exists and is accessible
     */
    const healthCheck = (): Effect.Effect<boolean, GraphQueryError> =>
      Effect.gen(function* () {
        yield* setSearchPath()
        const result = yield* sql<{ name: string }>`
          SELECT name FROM ag_catalog.ag_graph WHERE name = ${graphName}
        `
        return result.length > 0
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new GraphQueryError({
              query: 'health_check',
              message: `Apache AGE health check failed: ${String(cause)}`,
              cause,
            })
          )
        )
      )

    return {
      executeCypher,
      getPlants,
      getLinesForPlant,
      getMachinesForLine,
      getSensorsForMachine,
      getSensorHierarchy,
      linkAlarmToSensor,
      getAllSensors,
      createAlarmNode,
      getSensorsWithAlarms,
      getPlantHierarchy,
      healthCheck,
    } as const
  }),
  dependencies: [IIoTPgClientLive],
}) {}

// =============================================================================
// Exports
// =============================================================================

export const GraphClientLive = GraphClient.Default

/**
 * Layer for testing - allows providing custom PgClient
 * Usage: GraphClientTest.pipe(Layer.provide(YourTestPgClient))
 */
export const GraphClientTest = Layer.effect(
  GraphClient,
  Effect.gen(function* () {
    // Validates PgClient is available, then returns GraphClient instance
    yield* PgClient.PgClient
    return yield* GraphClient
  })
)
