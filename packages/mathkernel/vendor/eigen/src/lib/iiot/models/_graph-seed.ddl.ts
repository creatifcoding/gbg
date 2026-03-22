/**
 * IIoT Graph Seed DDL - Initial Asset Hierarchy
 *
 * Creates the base asset nodes and relationships in Apache AGE graph.
 * Uses MERGE for idempotency (safe to run multiple times).
 *
 * Asset Hierarchy:
 * - Plants: PLANT-A (Chicago), PLANT-B (Detroit)
 * - Lines: LINE-001, LINE-002, LINE-003
 * - Machines: MCH-001 through MCH-004
 * - Sensors: TMP-001, VIB-001, TMP-002, VIB-002, TMP-003, HUM-001, SPD-001, CUR-001
 *
 * Relationships:
 * - Plant -[:contains]-> Line -[:contains]-> Machine
 * - Sensor -[:monitors]-> Machine
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Graph Node Creation
// =============================================================================

/**
 * Creates plant nodes in the iiot_graph.
 */
export const createPlantNodes = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  // PLANT-A: Chicago Assembly
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:plant {id: 'PLANT-A', name: 'Chicago Assembly', location: 'Chicago, IL'})
    $$) AS (v agtype)
  `)

  // PLANT-B: Detroit Manufacturing
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:plant {id: 'PLANT-B', name: 'Detroit Manufacturing', location: 'Detroit, MI'})
    $$) AS (v agtype)
  `)
})

/**
 * Creates production line nodes in the iiot_graph.
 */
export const createLineNodes = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  // LINE-001: Body Assembly (PLANT-A)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:line {id: 'LINE-001', name: 'Body Assembly', plant_id: 'PLANT-A'})
    $$) AS (v agtype)
  `)

  // LINE-002: Paint Shop (PLANT-A)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:line {id: 'LINE-002', name: 'Paint Shop', plant_id: 'PLANT-A'})
    $$) AS (v agtype)
  `)

  // LINE-003: Final Assembly (PLANT-B)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:line {id: 'LINE-003', name: 'Final Assembly', plant_id: 'PLANT-B'})
    $$) AS (v agtype)
  `)
})

/**
 * Creates machine nodes in the iiot_graph.
 */
export const createMachineNodes = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  // MCH-001: Welding Robot Alpha (LINE-001)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:machine {id: 'MCH-001', name: 'Welding Robot Alpha', model: 'FANUC R-2000iC/210F', line_id: 'LINE-001'})
    $$) AS (v agtype)
  `)

  // MCH-002: Welding Robot Beta (LINE-001)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:machine {id: 'MCH-002', name: 'Welding Robot Beta', model: 'FANUC R-2000iC/210F', line_id: 'LINE-001'})
    $$) AS (v agtype)
  `)

  // MCH-003: Paint Booth 1 (LINE-002)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:machine {id: 'MCH-003', name: 'Paint Booth 1', model: 'Durr EcoPaint', line_id: 'LINE-002'})
    $$) AS (v agtype)
  `)

  // MCH-004: Conveyor System A (LINE-003)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:machine {id: 'MCH-004', name: 'Conveyor System A', model: 'Bosch TS5', line_id: 'LINE-003'})
    $$) AS (v agtype)
  `)
})

/**
 * Creates sensor nodes in the iiot_graph.
 */
export const createSensorNodes = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  const sensors = [
    { deviceId: 'TMP-001', type: 'temperature', unit: 'celsius', machineId: 'MCH-001' },
    { deviceId: 'VIB-001', type: 'vibration', unit: 'mm_s', machineId: 'MCH-001' },
    { deviceId: 'TMP-002', type: 'temperature', unit: 'celsius', machineId: 'MCH-002' },
    { deviceId: 'VIB-002', type: 'vibration', unit: 'mm_s', machineId: 'MCH-002' },
    { deviceId: 'TMP-003', type: 'temperature', unit: 'celsius', machineId: 'MCH-003' },
    { deviceId: 'HUM-001', type: 'humidity', unit: 'percent', machineId: 'MCH-003' },
    { deviceId: 'SPD-001', type: 'speed', unit: 'rpm', machineId: 'MCH-004' },
    { deviceId: 'CUR-001', type: 'current', unit: 'ampere', machineId: 'MCH-004' },
  ]

  for (const s of sensors) {
    yield* sql.unsafe(`
      SELECT * FROM cypher('iiot_graph', $$
        MERGE (:sensor {device_id: '${s.deviceId}', type: '${s.type}', unit: '${s.unit}', machine_id: '${s.machineId}'})
      $$) AS (v agtype)
    `)
  }
})

/**
 * Creates all graph nodes (plants, lines, machines, sensors).
 */
export const createGraphNodes = Effect.gen(function* () {
  yield* createPlantNodes
  yield* createLineNodes
  yield* createMachineNodes
  yield* createSensorNodes
})

// =============================================================================
// Graph Relationship Creation
// =============================================================================

/**
 * Creates plant→line contains relationships.
 */
export const createPlantLineRelationships = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  const plantLines = [
    { plantId: 'PLANT-A', lineId: 'LINE-001' },
    { plantId: 'PLANT-A', lineId: 'LINE-002' },
    { plantId: 'PLANT-B', lineId: 'LINE-003' },
  ]

  for (const { plantId, lineId } of plantLines) {
    yield* sql.unsafe(`
      SELECT * FROM cypher('iiot_graph', $$
        MATCH (p:plant {id: '${plantId}'}), (l:line {id: '${lineId}'})
        MERGE (p)-[:contains]->(l)
      $$) AS (e agtype)
    `)
  }
})

/**
 * Creates line→machine contains relationships.
 */
export const createLineMachineRelationships = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  const lineMachines = [
    { lineId: 'LINE-001', machineId: 'MCH-001' },
    { lineId: 'LINE-001', machineId: 'MCH-002' },
    { lineId: 'LINE-002', machineId: 'MCH-003' },
    { lineId: 'LINE-003', machineId: 'MCH-004' },
  ]

  for (const { lineId, machineId } of lineMachines) {
    yield* sql.unsafe(`
      SELECT * FROM cypher('iiot_graph', $$
        MATCH (l:line {id: '${lineId}'}), (m:machine {id: '${machineId}'})
        MERGE (l)-[:contains]->(m)
      $$) AS (e agtype)
    `)
  }
})

/**
 * Creates sensor→machine monitors relationships.
 */
export const createSensorMachineRelationships = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  const machineIds = ['MCH-001', 'MCH-002', 'MCH-003', 'MCH-004']

  for (const machineId of machineIds) {
    yield* sql.unsafe(`
      SELECT * FROM cypher('iiot_graph', $$
        MATCH (m:machine {id: '${machineId}'}), (s:sensor)
        WHERE s.machine_id = '${machineId}'
        MERGE (s)-[:monitors]->(m)
      $$) AS (e agtype)
    `)
  }
})

/**
 * Creates all graph relationships.
 */
export const createGraphRelationships = Effect.gen(function* () {
  yield* createPlantLineRelationships
  yield* createLineMachineRelationships
  yield* createSensorMachineRelationships
})

// =============================================================================
// Combined Export
// =============================================================================

/**
 * Seeds the complete graph hierarchy (nodes + relationships).
 * Idempotent - safe to run multiple times.
 */
export const seedGraphHierarchy = Effect.gen(function* () {
  yield* createGraphNodes
  yield* createGraphRelationships
})
