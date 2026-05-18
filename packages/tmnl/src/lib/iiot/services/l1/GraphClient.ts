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
 * ## API Reference
 *
 * ### Low-Level Cypher
 *
 * | Method | Description |
 * |--------|-------------|
 * | `executeCypher()` | Run arbitrary Cypher query, returns raw rows |
 *
 * ### Asset Hierarchy (Read)
 *
 * | Method | Return Type | Description |
 * |--------|-------------|-------------|
 * | `getAllPlants()` | `Stream<Plant>` | All plants in the graph |
 * | `getPlant()` | `Effect<Plant \| null>` | Single plant by ID |
 * | `getLinesForPlant()` | `Stream<Line>` | Lines contained by a plant |
 * | `getMachinesForLine()` | `Stream<Machine>` | Machines on a line |
 * | `getSensorsForMachine()` | `Stream<Sensor>` | Sensors monitoring a machine |
 * | `getSensorHierarchy()` | `Effect<SensorHierarchy>` | Full path: sensor → machine → line → plant |
 * | `getPlantHierarchy()` | `Effect<PlantHierarchy>` | Full tree: plant → lines → machines → sensors |
 * | `getAllSensors()` | `Stream<{sensor, alarmCount}>` | All sensors with alarm counts |
 *
 * ### Alarm Operations
 *
 * | Method | Description |
 * |--------|-------------|
 * | `createAlarmNode()` | Create alarm node with id, type, severity, message, timestamp |
 * | `linkAlarmToSensor()` | Create `(alarm)-[:triggered_by]->(sensor)` edge |
 *
 * ### Diagnostics
 *
 * | Method | Description |
 * |--------|-------------|
 * | `healthCheck()` | Verify AGE graph exists and is queryable |
 *
 * ## Cypher Conventions
 *
 * - Use **snake_case** aliases in RETURN clauses (e.g., `AS device_id`)
 * - PostgreSQL lowercases all identifiers; `transformResultNames` converts `device_id` → `deviceId`
 * - Cast `agtype` to `text` before casting to other types (e.g., `timestamp::text::timestamptz`)
 *
 * @see docker/docker-compose.iiot.yml for database setup
 * @see docker/iiot-db/init.sql for graph schema
 * @module
 */

import { Effect, Stream, Context, Layer } from 'effect'
import { PgClient } from '@effect/sql-pg'
import type {
  AssetId,
  DeviceId,
  MachineId,
  LineId,
  PlantId,
  WorkOrderId,
  type EdgeId,
} from '../../schemas/identifiers'
import type { Plant, Line, Machine, Sensor, SensorHierarchy, SensorType, MeasurementUnit } from '../../schemas/assets'
import { GraphQueryError, HierarchyError } from '../../schemas/errors'
import {
  getRelationshipEdgeDescriptor,
  isRelationshipAllowed,
  RelationshipEndpoint,
  type RelationshipEdgeMetadata,
  type RelationshipEdgeType,
  type RelationshipNodeType,
  type RelationshipPropagationPolicy,
} from '../../schemas/relationships'
import type { ObservationSignal, ReactorObservation } from '../../schemas/reactor'
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

export interface PropagationTargetExpansion {
  readonly edgeType: RelationshipEdgeType
  readonly source: RelationshipEndpoint
  readonly target: RelationshipEndpoint
  readonly requestTarget: RelationshipEndpoint
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

const nodeIdProperty = (type: RelationshipNodeType): string => {
  switch (type) {
    case 'sensor':
    case 'device':
      return 'device_id'
    default:
      return 'id'
  }
}

const makeEdgeId = (input: {
  readonly source: RelationshipEndpoint
  readonly target: RelationshipEndpoint
  readonly edgeType: RelationshipEdgeType
}): EdgeId => {
  const raw = `EDGE-${input.edgeType}-${input.source.type}-${input.source.id}-${input.target.type}-${input.target.id}`
  return raw.replace(/[^a-zA-Z0-9:_-]/g, '-') as EdgeId
}

const cypherMap = (entries: Record<string, string | number | boolean | null | undefined>): string => {
  const props = Object.entries(entries)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (value === null) return `${key}: null`
      if (typeof value === 'number' || typeof value === 'boolean') return `${key}: ${String(value)}`
      return `${key}: '${escapeCypher(value)}'`
    })
  return `{${props.join(', ')}}`
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

    const assertReadOnlyCypher = (query: string): Effect.Effect<void, GraphQueryError> => {
      const forbidden = /\b(CREATE|MERGE|SET|DELETE|DETACH|DROP|ALTER|CALL|REMOVE)\b/i
      return forbidden.test(query)
        ? Effect.fail(new GraphQueryError({
          query,
          message: 'Only read-only Cypher is allowed on this API',
        }))
        : Effect.void
    }

    const executeReadOnlyCypher = (
      query: string,
      columnDefs: string = '(result agtype)',
    ): Effect.Effect<CypherResult, GraphQueryError> =>
      Effect.zipRight(assertReadOnlyCypher(query), executeCypher(query, columnDefs))

    /**
     * Get all plants
     */
    const getPlants = (): Stream.Stream<Plant, GraphQueryError> =>
      Stream.fromEffect(
        executeCypher(
          `MATCH (p:plant) RETURN p.id AS id, p.name AS name, p.location AS location`,
          '(id agtype, name agtype, location agtype)' // snake_case aliases → camelCase via transform
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
           RETURN s.device_id AS device_id, s.type AS type, s.unit AS unit`,
          '(device_id agtype, type agtype, unit agtype)'
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
           RETURN s.device_id AS device_id, m.name AS machine_name,
                  l.name AS line_name, p.name AS plant_name`,
          '(device_id agtype, machine_name agtype, line_name agtype, plant_name agtype)'
        )

        if (result.rows.length === 0) {
          return yield* Effect.fail(
            new HierarchyError({
              message: `No hierarchy found for sensor ${deviceId}`,
            })
          )
        }

        const row = result.rows[0]
        // Note: PgClient.transformResultNames converts snake_case → camelCase
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
     * Create or update a generic relationship node in the graph.
     *
     * Labels are restricted by RelationshipNodeType before interpolation.
     */
    const upsertRelationshipNode = (
      endpoint: RelationshipEndpoint,
      properties: Record<string, string | number | boolean | null | undefined> = {},
    ): Effect.Effect<void, GraphQueryError> =>
      Effect.gen(function* () {
        const idProperty = nodeIdProperty(endpoint.type)
        const propertyMap = cypherMap({
          ...properties,
          [idProperty]: endpoint.id,
          updated_at: new Date().toISOString(),
        })

        yield* executeCypher(
          `MERGE (n:${endpoint.type} {${idProperty}: '${escapeCypher(endpoint.id)}'})
           SET n += ${propertyMap}`,
          '(n agtype)'
        )
      })

    /**
     * Create or update a schema-registered relationship edge.
     */
    const upsertRelationshipEdge = (input: {
      readonly source: RelationshipEndpoint
      readonly target: RelationshipEndpoint
      readonly edgeType: RelationshipEdgeType
      readonly metadata: RelationshipEdgeMetadata
    }): Effect.Effect<void, GraphQueryError> =>
      Effect.gen(function* () {
        if (!isRelationshipAllowed({
          edgeType: input.edgeType,
          sourceType: input.source.type,
          targetType: input.target.type,
        })) {
          return yield* Effect.fail(new GraphQueryError({
            query: 'upsertRelationshipEdge',
            message: `Relationship ${input.source.type} -[:${input.edgeType}]-> ${input.target.type} is not allowed by registry`,
          }))
        }

        const sourceIdProperty = nodeIdProperty(input.source.type)
        const targetIdProperty = nodeIdProperty(input.target.type)
        const edgeId = input.metadata.edgeId ?? makeEdgeId(input)
        const validFrom = input.metadata.validFrom ?? new Date().toISOString()
        const edgeProperties = cypherMap({
          edge_id: edgeId,
          created_at: new Date().toISOString(),
          created_by: input.metadata.createdBy,
          valid_from: validFrom,
          valid_to: null,
          reason: input.metadata.reason,
          version: 1,
          source_type: input.source.type,
          target_type: input.target.type,
          context_json: JSON.stringify(input.metadata.context ?? {}),
        })

        yield* executeCypher(
          `MATCH (source:${input.source.type} {${sourceIdProperty}: '${escapeCypher(input.source.id)}'}),
                  (target:${input.target.type} {${targetIdProperty}: '${escapeCypher(input.target.id)}'})
           MERGE (source)-[edge:${input.edgeType}]->(target)
           SET edge += ${edgeProperties}`,
          '(edge agtype)'
        )

        yield* sql`
          INSERT INTO iiot.relationship_edge_audit (
            edge_id,
            action,
            edge_type,
            source_type,
            source_id,
            target_type,
            target_id,
            actor,
            reason,
            descriptor_version,
            valid_from,
            metadata
          ) VALUES (
            ${edgeId},
            'upsert',
            ${input.edgeType},
            ${input.source.type},
            ${input.source.id},
            ${input.target.type},
            ${input.target.id},
            ${input.metadata.createdBy},
            ${input.metadata.reason ?? null},
            1,
            ${validFrom},
            ${JSON.stringify(input.metadata.context ?? {})}::jsonb
          )
        `
      })

    /**
     * Soft-delete an active schema-registered relationship edge.
     */
    const softDeleteRelationshipEdge = (input: {
      readonly source: RelationshipEndpoint
      readonly target: RelationshipEndpoint
      readonly edgeType: RelationshipEdgeType
      readonly reason?: string
    }): Effect.Effect<void, GraphQueryError> =>
      Effect.gen(function* () {
        if (!isRelationshipAllowed({
          edgeType: input.edgeType,
          sourceType: input.source.type,
          targetType: input.target.type,
        })) {
          return yield* Effect.fail(new GraphQueryError({
            query: 'softDeleteRelationshipEdge',
            message: `Relationship ${input.source.type} -[:${input.edgeType}]-> ${input.target.type} is not allowed by registry`,
          }))
        }

        const sourceIdProperty = nodeIdProperty(input.source.type)
        const targetIdProperty = nodeIdProperty(input.target.type)
        const edgeId = makeEdgeId(input)
        const validTo = new Date().toISOString()
        yield* executeCypher(
          `MATCH (source:${input.source.type} {${sourceIdProperty}: '${escapeCypher(input.source.id)}'})
                  -[edge:${input.edgeType}]->
                 (target:${input.target.type} {${targetIdProperty}: '${escapeCypher(input.target.id)}'})
           SET edge.valid_to = '${validTo}',
               edge.deactivation_reason = '${escapeCypher(input.reason ?? 'soft_delete')}'`,
          '(edge agtype)'
        )

        yield* sql`
          INSERT INTO iiot.relationship_edge_audit (
            edge_id,
            action,
            edge_type,
            source_type,
            source_id,
            target_type,
            target_id,
            actor,
            reason,
            descriptor_version,
            valid_to,
            metadata
          ) VALUES (
            ${edgeId},
            'soft_delete',
            ${input.edgeType},
            ${input.source.type},
            ${input.source.id},
            ${input.target.type},
            ${input.target.id},
            'system',
            ${input.reason ?? 'soft_delete'},
            1,
            ${validTo},
            '{}'::jsonb
          )
        `
      })

    /**
     * Read target ids for an active schema-registered edge from a source.
     */
    const getRelationshipTargetIds = (input: {
      readonly source: RelationshipEndpoint
      readonly edgeType: RelationshipEdgeType
      readonly targetType: RelationshipNodeType
    }): Effect.Effect<readonly string[], GraphQueryError> =>
      Effect.gen(function* () {
        if (!isRelationshipAllowed({
          edgeType: input.edgeType,
          sourceType: input.source.type,
          targetType: input.targetType,
        })) {
          return yield* Effect.fail(new GraphQueryError({
            query: 'getRelationshipTargetIds',
            message: `Relationship ${input.source.type} -[:${input.edgeType}]-> ${input.targetType} is not allowed by registry`,
          }))
        }

        const sourceIdProperty = nodeIdProperty(input.source.type)
        const targetIdProperty = nodeIdProperty(input.targetType)
        const result = yield* executeCypher(
          `MATCH (source:${input.source.type} {${sourceIdProperty}: '${escapeCypher(input.source.id)}'})
                  -[edge:${input.edgeType}]->
                 (target:${input.targetType})
           WHERE edge.valid_to IS NULL
           RETURN target.${targetIdProperty} AS target_id
           ORDER BY target.${targetIdProperty}`,
          '(target_id agtype)'
        )

        return result.rows.map((row) => String(row['targetId']))
      })

    /**
     * Expand a Reactor observation through a relationship-scoped propagation
     * policy.
     *
     * This is the generic replacement for one-off helpers such as
     * getWorkOrderIdsTargetingMachine. It does not know what the target entity
     * should do with the request; it only resolves graph endpoints.
     */
    const expandPropagationTargets = (input: {
      readonly observation: ReactorObservation
      readonly policy: RelationshipPropagationPolicy
      readonly signal: ObservationSignal
    }): Effect.Effect<readonly PropagationTargetExpansion[], GraphQueryError> =>
      Effect.gen(function* () {
        const edge = getRelationshipEdgeDescriptor(input.policy.edgeType)
        const subject = input.observation.subject
        const subjectIdProperty = nodeIdProperty(subject.type)

        if (input.policy.observedEndpoint === 'source') {
          if (!edge.allowedSourceTypes.includes(subject.type)) return []

          const expansions = yield* Effect.forEach(
            edge.allowedTargetTypes,
            (targetType) =>
              Effect.gen(function* () {
                const targetIdProperty = nodeIdProperty(targetType)
                const result = yield* executeReadOnlyCypher(
                  `MATCH (observed:${subject.type} {${subjectIdProperty}: '${escapeCypher(subject.id)}'})
                          -[edge:${input.policy.edgeType}]->
                         (target:${targetType})
                   WHERE edge.valid_to IS NULL
                   RETURN target.${targetIdProperty} AS request_id`,
                  '(request_id agtype)',
                )

                return result.rows.map((row): PropagationTargetExpansion => {
                  const source = subject
                  const target = new RelationshipEndpoint({ type: targetType, id: String(row['requestId']) })
                  return {
                    edgeType: input.policy.edgeType,
                    source,
                    target,
                    requestTarget: input.policy.requestEndpoint === 'source' ? source : target,
                  }
                })
              }),
            { concurrency: 'unbounded' },
          )

          return expansions.flat()
        }

        if (!edge.allowedTargetTypes.includes(subject.type)) return []

        const expansions = yield* Effect.forEach(
          edge.allowedSourceTypes,
          (sourceType) =>
            Effect.gen(function* () {
              const sourceIdProperty = nodeIdProperty(sourceType)
              const result = yield* executeReadOnlyCypher(
                `MATCH (source:${sourceType})
                        -[edge:${input.policy.edgeType}]->
                       (observed:${subject.type} {${subjectIdProperty}: '${escapeCypher(subject.id)}'})
                 WHERE edge.valid_to IS NULL
                 RETURN source.${sourceIdProperty} AS request_id`,
                '(request_id agtype)',
              )

              return result.rows.map((row): PropagationTargetExpansion => {
                const source = new RelationshipEndpoint({ type: sourceType, id: String(row['requestId']) })
                const target = subject
                return {
                  edgeType: input.policy.edgeType,
                  source,
                  target,
                  requestTarget: input.policy.requestEndpoint === 'source' ? source : target,
                }
              })
            }),
          { concurrency: 'unbounded' },
        )

        return expansions.flat()
      }).pipe(Effect.withSpan('iiot.graph.expandPropagationTargets'))

    /**
     * Create or update a work order node in the graph.
     *
     * Work orders remain relationally authoritative in iiot.work_orders; this
     * node is the graph relationship anchor used by Reactor queries.
     */
    const upsertWorkOrderNode = (workOrder: {
      readonly id: WorkOrderId
      readonly status?: string
      readonly primaryAssetId?: AssetId
    }): Effect.Effect<void, GraphQueryError> =>
      upsertRelationshipNode(
        { type: 'work_order', id: workOrder.id },
        {
          status: workOrder.status,
          primary_asset_id: workOrder.primaryAssetId,
        },
      )

    /**
     * Link a work order to the machine it targets.
     *
     * Creates: (work_order)-[:targets]->(machine)
     */
    const linkWorkOrderToMachine = (
      workOrderId: WorkOrderId,
      machineId: MachineId,
    ): Effect.Effect<void, GraphQueryError> =>
      upsertRelationshipEdge({
        source: { type: 'work_order', id: workOrderId },
        target: { type: 'machine', id: machineId },
        edgeType: 'targets',
        metadata: {
          _tag: 'RelationshipEdgeMetadata',
          createdBy: 'system',
          reason: 'requires_asset',
          context: { targetLevel: 'machine' },
        },
      })

    /**
     * Convenience helper for test fixtures and sync adapters.
     */
    const upsertWorkOrderTargetingMachine = (workOrder: {
      readonly id: WorkOrderId
      readonly status?: string
      readonly machineId: MachineId
    }): Effect.Effect<void, GraphQueryError> =>
      Effect.gen(function* () {
        yield* upsertWorkOrderNode({
          id: workOrder.id,
          status: workOrder.status,
          primaryAssetId: workOrder.machineId as unknown as AssetId,
        })
        yield* linkWorkOrderToMachine(workOrder.id, workOrder.machineId)
      })

    /**
     * Find work orders directly targeting a machine.
     *
     * Reactor v1 uses this as the graph-backed candidate set before applying
     * relational pre-dispatch eligibility filters.
     */
    const getWorkOrderIdsTargetingMachine = (
      machineId: MachineId,
    ): Effect.Effect<readonly WorkOrderId[], GraphQueryError> =>
      Effect.gen(function* () {
        const result = yield* executeCypher(
          `MATCH (wo:work_order)-[:targets]->(m:machine {id: '${escapeCypher(machineId)}'})
           RETURN wo.id AS work_order_id
           ORDER BY wo.id`,
          '(work_order_id agtype)'
        )

        return result.rows.map((row) => String(row['workOrderId']) as WorkOrderId)
      })

    /**
     * Get all sensors in the graph with their machine associations
     */
    const getAllSensors = (): Stream.Stream<Sensor, GraphQueryError> =>
      Stream.fromEffect(
        executeCypher(
          `MATCH (s:sensor)-[:monitors]->(m:machine)
           RETURN s.device_id AS device_id, s.type AS type, s.unit AS unit, m.id AS machine_id`,
          '(device_id agtype, type agtype, unit agtype, machine_id agtype)'
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
             RETURN s.device_id AS device_id, s.type AS type, s.unit AS unit,
                    m.id AS machine_id, COUNT(a) AS alarm_count`,
            '(device_id agtype, type agtype, unit agtype, machine_id agtype, alarm_count agtype)'
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
        // Note: Using snake_case aliases so transformResultNames converts to camelCase
        const hierarchyResult = yield* executeCypher(
          `MATCH (p:plant {id: '${escapeCypher(plantId)}'})-[:contains]->(l:line)
                 -[:contains]->(m:machine)<-[:monitors]-(s:sensor)
           RETURN l.id AS line_id, l.name AS line_name,
                  m.id AS machine_id, m.name AS machine_name, m.model AS machine_model,
                  s.device_id AS device_id, s.type AS sensor_type, s.unit AS sensor_unit`,
          '(line_id agtype, line_name agtype, machine_id agtype, machine_name agtype, machine_model agtype, device_id agtype, sensor_type agtype, sensor_unit agtype)'
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
      executeReadOnlyCypher,
      getPlants,
      getLinesForPlant,
      getMachinesForLine,
      getSensorsForMachine,
      getSensorHierarchy,
      linkAlarmToSensor,
      upsertRelationshipNode,
      upsertRelationshipEdge,
      softDeleteRelationshipEdge,
      getRelationshipTargetIds,
      expandPropagationTargets,
      upsertWorkOrderNode,
      linkWorkOrderToMachine,
      upsertWorkOrderTargetingMachine,
      getWorkOrderIdsTargetingMachine,
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
