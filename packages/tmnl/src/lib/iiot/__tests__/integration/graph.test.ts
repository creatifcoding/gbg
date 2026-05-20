/**
 * GraphClient Integration Tests
 *
 * Tests real Apache AGE Cypher operations against the IIoT database.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/integration/graph.test.ts
 *
 * @module
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Stream, Chunk } from 'effect'
import { GraphClient } from '../../services/l1/GraphClient'
import type { DeviceId, PlantId, LineId, MachineId, WorkOrderId } from '../../schemas/identifiers'
import {
  RELATIONSHIP_EDGE_REGISTRY,
  RelationshipEdgeMetadata,
  type RelationshipEdgeType,
  type RelationshipNodeType,
} from '../../schemas/relationships/edge-types'
import { GraphIntegrationLayer, isDatabaseAvailable } from './layer'

// =============================================================================
// Test Fixtures
// =============================================================================

// These IDs match the mock data created in docker/iiot-db/init.sql
const MOCK_PLANT_ID = 'PLANT-A' as PlantId
const MOCK_LINE_ID = 'LINE-001' as LineId
const MOCK_MACHINE_ID = 'MCH-001' as MachineId
const MOCK_SENSOR_ID = 'TMP-001' as DeviceId

const TEST_RELATIONSHIP_NODE_TYPES: readonly RelationshipNodeType[] = [
  'enterprise',
  'site',
  'area',
  'plant',
  'line',
  'workcell',
  'machine',
  'sensor',
  'device',
  'alarm',
  'work_order',
  'external',
]

const relationshipNodeId = (input: {
  readonly suffix: string
  readonly role: 'source' | 'target'
  readonly nodeType: RelationshipNodeType
}) => `TEST-REL-${input.role}-${input.nodeType}-${input.suffix}`

const nodeIdProperty = (nodeType: RelationshipNodeType): 'id' | 'device_id' =>
  nodeType === 'sensor' || nodeType === 'device' ? 'device_id' : 'id'

// =============================================================================
// Database Availability Check
// =============================================================================

describe('GraphClient Integration Tests', () => {
  let dbAvailable = false

  beforeAll(async () => {
    const check = isDatabaseAvailable.pipe(Effect.provide(GraphIntegrationLayer))
    dbAvailable = await Effect.runPromise(check)
    if (!dbAvailable) {
      console.log(
        'SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }
  })

  // =============================================================================
  // Health Check
  // =============================================================================

  describe('Health Check', () => {
    it('should verify Apache AGE graph exists', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const healthy = yield* client.healthCheck()
        expect(healthy).toBe(true)
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // Cypher Execution
  // =============================================================================

  describe('Cypher Execution', () => {
    it('should execute basic Cypher query', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const result = yield* client.executeCypher(
          'MATCH (n) RETURN count(n) AS cnt',
          '(cnt agtype)'
        )

        expect(result).toHaveProperty('rows')
        expect(result.rows.length).toBe(1)
        expect(typeof result.rows[0]['cnt']).toBe('number')
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should parse agtype results correctly', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const result = yield* client.executeCypher(
          "RETURN 'hello' AS text, 42 AS num, true AS bool",
          '(text agtype, num agtype, bool agtype)'
        )

        expect(result.rows.length).toBe(1)
        expect(result.rows[0]['text']).toBe('hello')
        expect(result.rows[0]['num']).toBe(42)
        expect(result.rows[0]['bool']).toBe(true)
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // Plant Operations
  // =============================================================================

  describe('Plant Operations', () => {
    it('should get all plants', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const plants = yield* client.getPlants().pipe(
          Stream.runCollect,
          Effect.map(Chunk.toArray)
        )

        expect(plants.length).toBeGreaterThan(0)
        expect(plants[0]._tag).toBe('Plant')
        expect(plants[0]).toHaveProperty('id')
        expect(plants[0]).toHaveProperty('name')
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should find the Chicago Assembly plant', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const plants = yield* client.getPlants().pipe(
          Stream.runCollect,
          Effect.map(Chunk.toArray)
        )

        const chicago = plants.find((p) => p.id === MOCK_PLANT_ID)
        expect(chicago).toBeDefined()
        expect(chicago!.name).toBe('Chicago Assembly')
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // Hierarchy Navigation
  // =============================================================================

  describe('Hierarchy Navigation', () => {
    it('should get lines for a plant', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const lines = yield* client.getLinesForPlant(MOCK_PLANT_ID).pipe(
          Stream.runCollect,
          Effect.map(Chunk.toArray)
        )

        expect(lines.length).toBeGreaterThan(0)
        expect(lines[0]._tag).toBe('Line')
        expect(lines[0].plantId).toBe(MOCK_PLANT_ID)
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should get machines for a line', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const machines = yield* client.getMachinesForLine(MOCK_LINE_ID).pipe(
          Stream.runCollect,
          Effect.map(Chunk.toArray)
        )

        expect(machines.length).toBeGreaterThan(0)
        expect(machines[0]._tag).toBe('Machine')
        expect(machines[0].lineId).toBe(MOCK_LINE_ID)
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should get sensors for a machine', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const sensors = yield* client.getSensorsForMachine(MOCK_MACHINE_ID).pipe(
          Stream.runCollect,
          Effect.map(Chunk.toArray)
        )

        expect(sensors.length).toBeGreaterThan(0)
        expect(sensors[0]._tag).toBe('Sensor')
        expect(sensors[0].machineId).toBe(MOCK_MACHINE_ID)
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should get full sensor hierarchy', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const hierarchy = yield* client.getSensorHierarchy(MOCK_SENSOR_ID)

        expect(hierarchy).toHaveProperty('deviceId')
        expect(hierarchy).toHaveProperty('machineName')
        expect(hierarchy).toHaveProperty('lineName')
        expect(hierarchy).toHaveProperty('plantName')
        expect(hierarchy.deviceId).toBe(MOCK_SENSOR_ID)
        expect(hierarchy.plantName).toBe('Chicago Assembly')
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should get full plant hierarchy', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const hierarchy = yield* client.getPlantHierarchy(MOCK_PLANT_ID)

        expect(hierarchy.plant._tag).toBe('Plant')
        expect(hierarchy.plant.id).toBe(MOCK_PLANT_ID)
        expect(hierarchy.lines.length).toBeGreaterThan(0)
        expect(hierarchy.lines[0].line._tag).toBe('Line')
        expect(hierarchy.lines[0].machines.length).toBeGreaterThan(0)
        expect(hierarchy.lines[0].machines[0].machine._tag).toBe('Machine')
        expect(hierarchy.lines[0].machines[0].sensors.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // All Sensors Query
  // =============================================================================

  describe('All Sensors Query', () => {
    it('should get all sensors with machine associations', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        const sensors = yield* client.getAllSensors().pipe(
          Stream.runCollect,
          Effect.map(Chunk.toArray)
        )

        expect(sensors.length).toBeGreaterThan(0)
        expect(sensors[0]._tag).toBe('Sensor')
        expect(sensors[0]).toHaveProperty('deviceId')
        expect(sensors[0]).toHaveProperty('type')
        expect(sensors[0]).toHaveProperty('unit')
        expect(sensors[0]).toHaveProperty('machineId')
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // Work Order Relationship Queries
  // =============================================================================

  describe('Work Order Relationship Queries', () => {
    it('should create, read, and soft-delete generic schema-registered relationship edges', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient
        const workOrderId = `TEST-WO-GENERIC-EDGE-${Date.now()}` as WorkOrderId

        yield* client.upsertRelationshipNode(
          { type: 'work_order', id: workOrderId },
          { status: 'started', primary_asset_id: MOCK_MACHINE_ID },
        )
        yield* client.upsertRelationshipEdge({
          source: { type: 'work_order', id: workOrderId },
          target: { type: 'machine', id: MOCK_MACHINE_ID },
          edgeType: 'targets',
          metadata: {
            _tag: 'RelationshipEdgeMetadata',
            createdBy: 'graph-test',
            reason: 'generic-edge-test',
            context: { role: 'primary' },
          },
        })

        const targets = yield* client.getRelationshipTargetIds({
          source: { type: 'work_order', id: workOrderId },
          edgeType: 'targets',
          targetType: 'machine',
        })
        expect(targets).toContain(MOCK_MACHINE_ID)

        yield* client.softDeleteRelationshipEdge({
          source: { type: 'work_order', id: workOrderId },
          target: { type: 'machine', id: MOCK_MACHINE_ID },
          edgeType: 'targets',
          reason: 'test-cleanup',
        })

        const afterDelete = yield* client.getRelationshipTargetIds({
          source: { type: 'work_order', id: workOrderId },
          edgeType: 'targets',
          targetType: 'machine',
        })
        expect(afterDelete).not.toContain(MOCK_MACHINE_ID)

        const invalid = yield* client.upsertRelationshipEdge({
          source: { type: 'work_order', id: workOrderId },
          target: { type: 'machine', id: MOCK_MACHINE_ID },
          edgeType: 'monitors',
          metadata: {
            _tag: 'RelationshipEdgeMetadata',
            createdBy: 'graph-test',
            reason: 'invalid-edge-test',
          },
        }).pipe(Effect.either)
        expect(invalid._tag).toBe('Left')

        // Cleanup
        yield* client.executeCypher(
          `MATCH (wo:work_order {id: '${workOrderId}'}) DETACH DELETE wo`,
          '(result agtype)'
        )
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should create, query, and soft-delete every allowed relationship edge pair', async () => {
      if (!dbAvailable) return

      const suffix = `${Date.now()}`

      const program = Effect.gen(function* () {
        const client = yield* GraphClient
        const cleanupRelationshipMatrixNodes = Effect.forEach(
          TEST_RELATIONSHIP_NODE_TYPES,
          (nodeType) => Effect.forEach(
            ['source', 'target'] as const,
            (role) => client.executeCypher(
              `MATCH (n:${nodeType} {${nodeIdProperty(nodeType)}: '${relationshipNodeId({ suffix, role, nodeType })}'}) DETACH DELETE n`,
              '(result agtype)',
            ).pipe(Effect.ignore),
            { concurrency: 1 },
          ),
          { concurrency: 1 },
        )

        yield* cleanupRelationshipMatrixNodes

        yield* Effect.forEach(
          TEST_RELATIONSHIP_NODE_TYPES,
          (nodeType) => Effect.all([
            client.upsertRelationshipNode(
              { type: nodeType, id: relationshipNodeId({ suffix, role: 'source', nodeType }) },
              { name: `source ${nodeType}` },
            ),
            client.upsertRelationshipNode(
              { type: nodeType, id: relationshipNodeId({ suffix, role: 'target', nodeType }) },
              { name: `target ${nodeType}` },
            ),
          ]),
          { concurrency: 1 },
        )

        const allowedPairs = Object.entries(RELATIONSHIP_EDGE_REGISTRY).flatMap(([edgeType, descriptor]) =>
          descriptor.allowedSourceTypes.flatMap((sourceType) =>
            descriptor.allowedTargetTypes.map((targetType) => ({
              edgeType: edgeType as RelationshipEdgeType,
              sourceType,
              targetType,
            })),
          ),
        )

        expect(allowedPairs).toHaveLength(87)

        yield* Effect.forEach(
          allowedPairs,
          ({ edgeType, sourceType, targetType }) => Effect.gen(function* () {
            const sourceId = relationshipNodeId({ suffix, role: 'source', nodeType: sourceType })
            const targetId = relationshipNodeId({ suffix, role: 'target', nodeType: targetType })

            yield* client.upsertRelationshipEdge({
              source: { type: sourceType, id: sourceId },
              target: { type: targetType, id: targetId },
              edgeType,
              metadata: new RelationshipEdgeMetadata({
                createdBy: 'graph-relationship-matrix-test',
                reason: `relationship-matrix:${edgeType}`,
                context: { sourceType, targetType },
              }),
            })

            const targetIds = yield* client.getRelationshipTargetIds({
              source: { type: sourceType, id: sourceId },
              edgeType,
              targetType,
            })
            expect(targetIds).toContain(targetId)

            yield* client.softDeleteRelationshipEdge({
              source: { type: sourceType, id: sourceId },
              target: { type: targetType, id: targetId },
              edgeType,
              reason: 'relationship-matrix-cleanup',
            })

            const afterDelete = yield* client.getRelationshipTargetIds({
              source: { type: sourceType, id: sourceId },
              edgeType,
              targetType,
            })
            expect(afterDelete).not.toContain(targetId)
          }),
          { concurrency: 1 },
        )

        yield* cleanupRelationshipMatrixNodes
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should find work orders targeting a machine through graph edges', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient
        const workOrderId = `TEST-WO-GRAPH-${Date.now()}` as WorkOrderId

        yield* client.upsertWorkOrderTargetingMachine({
          id: workOrderId,
          status: 'started',
          machineId: MOCK_MACHINE_ID,
        })

        const ids = yield* client.getWorkOrderIdsTargetingMachine(MOCK_MACHINE_ID)

        expect(ids).toContain(workOrderId)

        // Cleanup
        yield* client.executeCypher(
          `MATCH (wo:work_order {id: '${workOrderId}'}) DETACH DELETE wo`,
          '(result agtype)'
        )
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // Alarm Operations
  // =============================================================================

  describe('Alarm Operations', () => {
    it('should create alarm node', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        yield* client.createAlarmNode({
          id: 'TEST-ALM-001',
          alarmType: 'TEMPERATURE_HIGH',
          severity: 'warning',
          message: 'Test alarm',
          timestamp: new Date(),
        })

        // Verify by querying
        const result = yield* client.executeCypher(
          "MATCH (a:alarm {id: 'TEST-ALM-001'}) RETURN a.id AS id",
          '(id agtype)'
        )

        expect(result.rows.length).toBe(1)
        expect(result.rows[0]['id']).toBe('TEST-ALM-001')

        // Cleanup
        yield* client.executeCypher(
          "MATCH (a:alarm {id: 'TEST-ALM-001'}) DELETE a",
          '(result agtype)'
        )
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should link alarm to sensor', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* GraphClient

        // Create test alarm
        yield* client.createAlarmNode({
          id: 'TEST-ALM-002',
          alarmType: 'VIBRATION_ANOMALY',
          severity: 'critical',
          message: 'Test link alarm',
          timestamp: new Date(),
        })

        // Link to sensor
        yield* client.linkAlarmToSensor('TEST-ALM-002', MOCK_SENSOR_ID)

        // Verify relationship
        // Note: Use snake_case aliases so transformResultNames converts to camelCase
        const result = yield* client.executeCypher(
          `MATCH (a:alarm {id: 'TEST-ALM-002'})-[:triggered_by]->(s:sensor {device_id: '${MOCK_SENSOR_ID}'})
           RETURN a.id AS alarm_id, s.device_id AS sensor_id`,
          '(alarm_id agtype, sensor_id agtype)'
        )

        expect(result.rows.length).toBe(1)
        expect(result.rows[0]['alarmId']).toBe('TEST-ALM-002')
        expect(result.rows[0]['sensorId']).toBe(MOCK_SENSOR_ID)

        // Cleanup
        yield* client.executeCypher(
          "MATCH (a:alarm {id: 'TEST-ALM-002'}) DETACH DELETE a",
          '(result agtype)'
        )
      }).pipe(Effect.provide(GraphIntegrationLayer))

      await Effect.runPromise(program)
    })
  })
})
