/**
 * TimeSeriesClient Integration Tests
 *
 * Tests real TimescaleDB operations against the IIoT database.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/integration/time-series.test.ts
 *
 * @module
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Stream, Chunk } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { TimeSeriesClient } from '../../services/l1/TimeSeriesClient'
import type { DeviceId } from '../../schemas/identifiers'
import {
  TimeSeriesIntegrationLayer,
  withCleanDatabase,
  isDatabaseAvailable,
} from './layer'

// =============================================================================
// Test Constants
// =============================================================================

const TEST_DEVICE_ID = 'TEST-TMP-001' as DeviceId
const TEST_DEVICE_ID_2 = 'TEST-TMP-002' as DeviceId

// =============================================================================
// Database Availability Check
// =============================================================================

describe('TimeSeriesClient Integration Tests', () => {
  let dbAvailable = false

  beforeAll(async () => {
    const check = isDatabaseAvailable.pipe(
      Effect.provide(TimeSeriesIntegrationLayer)
    )
    dbAvailable = await Effect.runPromise(check)
    if (!dbAvailable) {
      console.log(
        'SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }
  })

  // =============================================================================
  // Insert Operations
  // =============================================================================

  describe('Insert Operations', () => {
    it('should insert single reading', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const client = yield* TimeSeriesClient

          const count = yield* client.insertReadings([
            {
              time: new Date(),
              deviceId: TEST_DEVICE_ID,
              value: 25.5,
              quality: 100,
            },
          ])

          expect(count).toBe(1)
          return count
        })
      ).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should insert multiple readings', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const client = yield* TimeSeriesClient
          const now = Date.now()

          const readings = Array.from({ length: 10 }, (_, i) => ({
            time: new Date(now - i * 1000),
            deviceId: TEST_DEVICE_ID,
            value: 20 + Math.random() * 10,
            quality: 100,
          }))

          const count = yield* client.insertReadings(readings)
          expect(count).toBe(10)
          return count
        })
      ).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should bulk insert readings efficiently', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const client = yield* TimeSeriesClient
          const now = Date.now()

          // Generate 100 readings
          const readings = Array.from({ length: 100 }, (_, i) => ({
            time: new Date(now - i * 100),
            deviceId: TEST_DEVICE_ID_2,
            value: 15 + Math.random() * 20,
            quality: i % 10 === 0 ? 50 : 100, // Some lower quality readings
          }))

          const count = yield* client.insertReadingsBulk(readings)
          expect(count).toBe(100)
          return count
        })
      ).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should handle upsert on conflict', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const client = yield* TimeSeriesClient
          const time = new Date()

          // Insert initial reading
          yield* client.insertReadings([
            {
              time,
              deviceId: TEST_DEVICE_ID,
              value: 20.0,
              quality: 100,
            },
          ])

          // Insert same time/device with different value (upsert)
          yield* client.insertReadings([
            {
              time,
              deviceId: TEST_DEVICE_ID,
              value: 25.0,
              quality: 90,
            },
          ])

          // Verify the value was updated
          const reading = yield* client.getLatestReading(TEST_DEVICE_ID)
          expect(reading).not.toBeNull()
          expect(reading!.value).toBe(25.0)
          expect(reading!.quality).toBe(90)
        })
      ).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // Query Operations
  // =============================================================================

  describe('Query Operations', () => {
    it('should query readings by device', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const client = yield* TimeSeriesClient
          const now = Date.now()

          // Insert test data
          yield* client.insertReadings([
            { time: new Date(now - 1000), deviceId: TEST_DEVICE_ID, value: 22.0 },
            { time: new Date(now - 2000), deviceId: TEST_DEVICE_ID, value: 23.0 },
            { time: new Date(now - 3000), deviceId: TEST_DEVICE_ID, value: 24.0 },
          ])

          // Query readings
          const readings = yield* client
            .queryReadings({
              deviceId: TEST_DEVICE_ID,
              since: new Date(now - 10000),
              until: new Date(now),
              limit: 10,
            })
            .pipe(Stream.runCollect, Effect.map(Chunk.toArray))

          expect(readings.length).toBe(3)
          expect(readings[0]._tag).toBe('SensorReading')
          expect(readings[0].deviceId).toBe(TEST_DEVICE_ID)
        })
      ).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should get latest reading for device', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const client = yield* TimeSeriesClient
          const now = Date.now()

          // Insert readings at different times
          yield* client.insertReadings([
            { time: new Date(now - 3000), deviceId: TEST_DEVICE_ID, value: 10.0 },
            { time: new Date(now - 2000), deviceId: TEST_DEVICE_ID, value: 20.0 },
            { time: new Date(now - 1000), deviceId: TEST_DEVICE_ID, value: 30.0 }, // Latest
          ])

          const latest = yield* client.getLatestReading(TEST_DEVICE_ID)

          expect(latest).not.toBeNull()
          expect(latest!.value).toBe(30.0)
        })
      ).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should return null for non-existent device', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const client = yield* TimeSeriesClient

          const reading = yield* client.getLatestReading(
            'TEST-NON-EXISTENT' as DeviceId
          )

          expect(reading).toBeNull()
        })
      ).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should get latest readings for multiple devices', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const client = yield* TimeSeriesClient
          const now = Date.now()

          // Insert readings for two devices
          yield* client.insertReadings([
            { time: new Date(now - 1000), deviceId: TEST_DEVICE_ID, value: 25.0 },
            { time: new Date(now - 1000), deviceId: TEST_DEVICE_ID_2, value: 30.0 },
          ])

          const readings = yield* client.getLatestReadingsForDevices([
            TEST_DEVICE_ID,
            TEST_DEVICE_ID_2,
          ])

          expect(readings.length).toBe(2)
          const values = readings.map((r) => r.value).sort()
          expect(values).toEqual([25.0, 30.0])
        })
      ).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // Aggregation Operations
  // =============================================================================

  describe('Aggregation Operations', () => {
    it('should query aggregated readings', async () => {
      if (!dbAvailable) return

      const program = withCleanDatabase(
        Effect.gen(function* () {
          const client = yield* TimeSeriesClient
          const sql = yield* PgClient.PgClient
          const now = Date.now()

          // Insert enough readings to have aggregation data
          const readings = Array.from({ length: 20 }, (_, i) => ({
            time: new Date(now - i * 60000), // 1 minute apart
            deviceId: TEST_DEVICE_ID,
            value: 20 + Math.sin(i) * 5, // Varying values
          }))

          yield* client.insertReadings(readings)

          // Manually refresh the continuous aggregate (not refreshed immediately)
          yield* sql.unsafe(
            `CALL refresh_continuous_aggregate('iiot.readings_1min', NULL, NULL)`
          )

          // Query aggregated (1min bucket)
          const aggregated = yield* client
            .queryAggregated({
              deviceId: TEST_DEVICE_ID,
              bucket: '1min',
              since: new Date(now - 3600000), // Last hour
              until: new Date(now),
            })
            .pipe(Stream.runCollect, Effect.map(Chunk.toArray))

          // Should have some aggregated buckets
          expect(aggregated.length).toBeGreaterThan(0)
          if (aggregated.length > 0) {
            expect(aggregated[0]._tag).toBe('AggregatedReading')
            expect(aggregated[0]).toHaveProperty('avgValue')
            expect(aggregated[0]).toHaveProperty('minValue')
            expect(aggregated[0]).toHaveProperty('maxValue')
          }
        })
      ).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // =============================================================================
  // Health & Statistics
  // =============================================================================

  describe('Health & Statistics', () => {
    it('should verify TimescaleDB health', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* TimeSeriesClient

        const healthy = yield* client.healthCheck()
        expect(healthy).toBe(true)
      }).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should get hypertable statistics', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const client = yield* TimeSeriesClient

        const stats = yield* client.getHypertableStats()

        expect(stats).toHaveProperty('tableName')
        expect(stats).toHaveProperty('numChunks')
        expect(stats).toHaveProperty('compressionEnabled')
        expect(stats).toHaveProperty('totalSize')
        expect(stats.tableName).toBe('sensor_readings')
      }).pipe(Effect.provide(TimeSeriesIntegrationLayer))

      await Effect.runPromise(program)
    })
  })
})
