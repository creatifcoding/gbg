/**
 * Hybrid Query Integration Tests
 *
 * Tests combining TimescaleDB and Apache AGE in single queries.
 * Demonstrates the power of the unified database approach.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/integration/hybrid.test.ts
 *
 * @module
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Stream, Chunk } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { TimeSeriesClient } from '../../services/l1/TimeSeriesClient'
import { GraphClient } from '../../services/l1/GraphClient'
import type { DeviceId, PlantId, MachineId } from '../../schemas/identifiers'
import {
  IIoTIntegrationLayer,
  withCleanDatabase,
  isDatabaseAvailable,
} from './layer'

// =============================================================================
// Test Fixtures
// =============================================================================

// These IDs match the mock data created in docker/iiot-db/init.sql
const MOCK_PLANT_ID = 'PLANT-A' as PlantId
const MOCK_MACHINE_ID = 'MCH-001' as MachineId

// =============================================================================
// Database Availability Check
// =============================================================================

describe('Hybrid Query Integration Tests', () => {
  let dbAvailable = false

  beforeAll(async () => {
    const check = isDatabaseAvailable.pipe(Effect.provide(IIoTIntegrationLayer))
    dbAvailable = await Effect.runPromise(check)
    if (!dbAvailable) {
      console.log(
        'SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }
  })

  // =============================================================================
  // Graph → TimeSeries Queries
  // =============================================================================

  describe('Graph → TimeSeries Queries', () => {
    it('should get readings for sensors on a machine', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const tsClient = yield* TimeSeriesClient
          const graphClient = yield* GraphClient

          // 1. Get sensors for machine from graph
          const sensors = yield* graphClient.getSensorsForMachine(MOCK_MACHINE_ID).pipe(
            Stream.runCollect,
            Effect.map(Chunk.toArray)
          )

          expect(sensors.length).toBeGreaterThan(0)

          // 2. Get latest readings for each sensor from time series
          const deviceIds = sensors.map((s) => s.deviceId)
          const readings = yield* tsClient.getLatestReadingsForDevices(deviceIds)

          // Note: May be 0 if no readings exist in the test database
          expect(Array.isArray(readings)).toBe(true)
        })
      ).pipe(Effect.provide(IIoTIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should get sensor hierarchy then query readings', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const tsClient = yield* TimeSeriesClient
        const graphClient = yield* GraphClient

        // 1. Get all sensors from graph
        const sensors = yield* graphClient.getAllSensors().pipe(
          Stream.runCollect,
          Effect.map(Chunk.toArray)
        )

        if (sensors.length === 0) return // Skip if no sensors

        // 2. Get hierarchy for first sensor
        const firstSensor = sensors[0]
        const hierarchy = yield* graphClient.getSensorHierarchy(firstSensor.deviceId)

        expect(hierarchy.deviceId).toBe(firstSensor.deviceId)
        expect(hierarchy.plantName).toBeTruthy()
        expect(hierarchy.lineName).toBeTruthy()
        expect(hierarchy.machineName).toBeTruthy()

        // 3. Query time series for this sensor
        const readings = yield* tsClient
          .queryReadings({
            deviceId: firstSensor.deviceId,
            limit: 10,
          })
          .pipe(Stream.runCollect, Effect.map(Chunk.toArray))

        expect(Array.isArray(readings)).toBe(true)
      }).pipe(Effect.provide(IIoTIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // Raw SQL Hybrid Queries
  // =============================================================================

  describe('Raw SQL Hybrid Queries', () => {
    it('should join graph traversal with time series data via CTE', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const sql = yield* PgClient.PgClient

        // Set search path for AGE
        yield* sql.unsafe(`SET search_path = ag_catalog, iiot, public`)

        // Hybrid query: Get sensors from graph, join with time series
        const result = yield* sql.unsafe<{
          device_id: string
          sensor_type: string
          reading_count: string // bigint comes as string
        }>(`
          WITH machine_sensors AS (
            SELECT
              device_id::text AS device_id,
              sensor_type::text AS sensor_type
            FROM cypher('iiot_graph', $$
              MATCH (m:machine {id: 'MCH-001'})<-[:monitors]-(s:sensor)
              RETURN s.device_id AS device_id, s.type AS sensor_type
            $$) AS (device_id agtype, sensor_type agtype)
          )
          SELECT
            ms.device_id,
            ms.sensor_type,
            COALESCE(COUNT(sr.time), 0) AS reading_count
          FROM machine_sensors ms
          LEFT JOIN iiot.sensor_readings sr ON sr.device_id = ms.device_id
          GROUP BY ms.device_id, ms.sensor_type
          ORDER BY ms.device_id
        `)

        expect(Array.isArray(result)).toBe(true)
        if (result.length > 0) {
          expect(result[0]).toHaveProperty('device_id')
          expect(result[0]).toHaveProperty('sensor_type')
          expect(result[0]).toHaveProperty('reading_count')
        }
      }).pipe(Effect.provide(IIoTIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should query readings around alarm time for root cause analysis', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          const graphClient = yield* GraphClient
          const tsClient = yield* TimeSeriesClient

          // 1. Create test alarm linked to a sensor
          const testAlarmId = 'TEST-HYBRID-ALM-001'
          const testTime = new Date()

          yield* graphClient.createAlarmNode({
            id: testAlarmId,
            alarmType: 'TEMPERATURE_HIGH',
            severity: 'warning',
            message: 'Test alarm for hybrid query',
            timestamp: testTime,
          })

          // Link to existing sensor TMP-001
          yield* graphClient.linkAlarmToSensor(testAlarmId, 'TMP-001' as DeviceId)

          // 2. Insert some readings around the alarm time
          const readings = Array.from({ length: 10 }, (_, i) => ({
            time: new Date(testTime.getTime() - (5 - i) * 60000), // -5min to +5min
            deviceId: 'TMP-001' as DeviceId,
            value: 25 + i * 0.5,
            quality: 100,
          }))
          yield* tsClient.insertReadings(readings)

          // 3. Set search path and run hybrid query
          yield* sql.unsafe(`SET search_path = ag_catalog, iiot, public`)

          const result = yield* sql.unsafe<{
            alarm_id: string
            sensor_id: string
            reading_time: Date
            reading_value: number
            offset_seconds: number
          }>(`
            WITH alarm_info AS (
              SELECT
                alarm_id::text AS alarm_id,
                sensor_id::text AS sensor_id,
                alarm_time::timestamp AS alarm_time
              FROM cypher('iiot_graph', $$
                MATCH (a:alarm {id: '${testAlarmId}'})-[:triggered_by]->(s:sensor)
                RETURN a.id AS alarm_id, s.device_id AS sensor_id, a.timestamp AS alarm_time
              $$) AS (alarm_id agtype, sensor_id agtype, alarm_time agtype)
            )
            SELECT
              ai.alarm_id,
              ai.sensor_id,
              sr.time AS reading_time,
              sr.value AS reading_value,
              EXTRACT(EPOCH FROM (sr.time - ai.alarm_time::timestamptz))::integer AS offset_seconds
            FROM alarm_info ai
            JOIN iiot.sensor_readings sr ON sr.device_id = ai.sensor_id
            WHERE sr.time BETWEEN ai.alarm_time::timestamptz - INTERVAL '10 minutes'
                              AND ai.alarm_time::timestamptz + INTERVAL '10 minutes'
            ORDER BY sr.time
          `)

          expect(result.length).toBeGreaterThan(0)
          expect(result[0].alarm_id).toBe(testAlarmId)
          expect(result[0].sensor_id).toBe('TMP-001')

          // 4. Cleanup test alarm
          yield* graphClient.executeCypher(
            `MATCH (a:alarm {id: '${testAlarmId}'}) DETACH DELETE a`,
            '(result agtype)'
          )
        })
      ).pipe(Effect.provide(IIoTIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // Plant Hierarchy with Readings
  // =============================================================================

  describe('Plant Hierarchy with Readings', () => {
    it('should get plant hierarchy and aggregate readings per machine', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const graphClient = yield* GraphClient
        const sql = yield* PgClient.PgClient

        // 1. Get plant hierarchy from graph
        const hierarchy = yield* graphClient.getPlantHierarchy(MOCK_PLANT_ID)

        expect(hierarchy.plant.id).toBe(MOCK_PLANT_ID)

        // 2. For each machine, get sensor count and reading stats
        yield* sql.unsafe(`SET search_path = ag_catalog, iiot, public`)

        for (const lineData of hierarchy.lines) {
          for (const machineData of lineData.machines) {
            const sensorIds = machineData.sensors.map((s) => s.deviceId)

            if (sensorIds.length === 0) continue

            // Get reading statistics for this machine's sensors
            const stats = yield* sql<{
              sensor_count: string
              total_readings: string
              avg_value: number | null
            }>`
              SELECT
                COUNT(DISTINCT device_id) AS sensor_count,
                COUNT(*) AS total_readings,
                AVG(value) AS avg_value
              FROM iiot.sensor_readings
              WHERE device_id = ANY(${sensorIds})
            `

            expect(stats.length).toBe(1)
            expect(parseInt(stats[0].sensor_count)).toBeLessThanOrEqual(sensorIds.length)
          }
        }
      }).pipe(Effect.provide(IIoTIntegrationLayer))

      await Effect.runPromise(program)
    })
  })
})
