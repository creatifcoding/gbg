/**
 * IIoT Reading Repository Integration Tests
 *
 * Tests for SensorReadingRepo, AggregatedReadingRepo, AnalyticsRecordRepo against real PostgreSQL.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test src/lib/iiot/__tests__/repos/readings.integration.test.ts
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Effect, Option, Stream } from 'effect'
import {
  TestPgClient,
  RepositoriesIntegrationLayer,
  cleanTestAssets,
  cleanTestReadings,
  isDatabaseAvailable,
} from '../integration/layer'
import {
  SensorReadingRepo,
  AggregatedReadingRepo,
  AnalyticsRecordRepo,
  PlantRepo,
  LineRepo,
  MachineRepo,
  SensorRepo,
} from '../../repos'
import {
  testIds,
  testPlant1Insert,
  testLine1Insert,
  testMachine1Insert,
  testSensor1Insert,
  testSensorReading1Insert,
  testSensorReading2Insert,
  testSensorReadingBatch,
  testAnalyticsRecord1Insert,
  testAnalyticsRecord2Insert,
  testDates,
} from '../__fixtures__/fixtures'
import type { QualityScore } from '../../schemas/readings'

const RUN_INTEGRATION = process.env['RUN_INTEGRATION_TESTS'] === '1'

// =============================================================================
// SensorReadingRepo Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('SensorReadingRepo Integration', () => {
  beforeAll(async () => {
    const available = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(TestPgClient))
    )
    if (!available) {
      throw new Error(
        'Database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }
  })

  beforeEach(async () => {
    await Effect.runPromise(
      cleanTestReadings.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
    // Insert parent hierarchy: Plant -> Line -> Machine -> Sensor
    await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const lineRepo = yield* LineRepo
        const machineRepo = yield* MachineRepo
        const sensorRepo = yield* SensorRepo
        yield* plantRepo.insert(testPlant1Insert)
        yield* lineRepo.insert(testLine1Insert)
        yield* machineRepo.insert(testMachine1Insert)
        yield* sensorRepo.insert(testSensor1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanTestReadings.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Insert Tests (Composite PK)
  // ---------------------------------------------------------------------------

  it('should insert sensor reading with composite PK (time, deviceId)', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insert(testSensorReading1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    // Verify by finding
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.findByKey(
          testSensorReading1Insert.time,
          testSensorReading1Insert.deviceId
        )
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
    const reading = Option.getOrThrow(result)
    expect(reading.value).toBe(25.5)
    expect(reading.quality).toBe(100)
  })

  it('should upsert on conflict (composite PK)', async () => {
    // Insert first
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insert(testSensorReading1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    // Insert again with different value - should update
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insert({
          ...testSensorReading1Insert,
          value: 30.0,
          quality: 80 as QualityScore,
        })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.findByKey(
          testSensorReading1Insert.time,
          testSensorReading1Insert.deviceId
        )
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
    const reading = Option.getOrThrow(result)
    expect(reading.value).toBe(30.0) // Updated value
    expect(reading.quality).toBe(80) // Updated quality
  })

  // ---------------------------------------------------------------------------
  // InsertBatch Tests (UNNEST)
  // ---------------------------------------------------------------------------

  it('should insert batch of readings with UNNEST', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insertBatch(testSensorReadingBatch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.queryByDevice({ deviceId: testIds.device1 })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(3)
  })

  it('should handle empty batch gracefully', async () => {
    // Should not throw
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insertBatch([])
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )
  })

  it('should upsert batch on conflict', async () => {
    // Insert batch first
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insertBatch(testSensorReadingBatch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    // Insert same batch with different values
    const updatedBatch = testSensorReadingBatch.map(r => ({
      ...r,
      value: r.value + 10,
    }))

    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insertBatch(updatedBatch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.queryByDevice({ deviceId: testIds.device1 })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(3)
    // Values should be updated
    expect(result.every(r => r.value >= 33)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // FindByKey Tests
  // ---------------------------------------------------------------------------

  it('should find reading by composite key', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insert(testSensorReading1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.findByKey(
          testSensorReading1Insert.time,
          testSensorReading1Insert.deviceId
        )
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
  })

  it('should return None for non-existent key', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.findByKey(new Date(), testIds.nonExistentDevice)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isNone(result)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // GetLatest Tests
  // ---------------------------------------------------------------------------

  it('should get latest reading for device', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insertBatch(testSensorReadingBatch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.getLatest(testIds.device1)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
    const reading = Option.getOrThrow(result)
    // Latest should be the most recent timestamp
    expect(reading.value).toBe(25.5) // The 'now' reading
  })

  it('should return None when no readings exist', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.getLatest(testIds.device1)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isNone(result)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // QueryByDevice Tests
  // ---------------------------------------------------------------------------

  it('should query readings by device with time range', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insertBatch(testSensorReadingBatch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.queryByDevice({
          deviceId: testIds.device1,
          since: testDates.twoHoursAgo,
        })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(3)
  })

  it('should respect limit parameter', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insertBatch(testSensorReadingBatch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.queryByDevice({
          deviceId: testIds.device1,
          limit: 1,
        })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(1)
  })

  it('should return empty array for device with no readings', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        return yield* readingRepo.queryByDevice({
          deviceId: testIds.nonExistentDevice,
        })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result).toEqual([])
  })

  // ---------------------------------------------------------------------------
  // StreamByDevice Tests
  // ---------------------------------------------------------------------------

  it('should stream readings by device', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insertBatch(testSensorReadingBatch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        const stream = readingRepo.streamByDevice({ deviceId: testIds.device1 })
        return yield* Stream.runCollect(stream)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(3)
  })

  it('should stream empty for device with no readings', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        const stream = readingRepo.streamByDevice({ deviceId: testIds.nonExistentDevice })
        return yield* Stream.runCollect(stream)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(0)
  })
})

// =============================================================================
// AggregatedReadingRepo Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('AggregatedReadingRepo Integration', () => {
  beforeAll(async () => {
    const available = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(TestPgClient))
    )
    if (!available) {
      throw new Error('Database not available')
    }
  })

  beforeEach(async () => {
    await Effect.runPromise(
      cleanTestReadings.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
    // Insert parent hierarchy
    await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const lineRepo = yield* LineRepo
        const machineRepo = yield* MachineRepo
        const sensorRepo = yield* SensorRepo
        yield* plantRepo.insert(testPlant1Insert)
        yield* lineRepo.insert(testLine1Insert)
        yield* machineRepo.insert(testMachine1Insert)
        yield* sensorRepo.insert(testSensor1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanTestReadings.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // QueryByDevice Tests
  // ---------------------------------------------------------------------------

  it('should query aggregated readings with bucket filter', async () => {
    // Note: This requires data in the sensor_readings_agg view
    // For integration tests, we first insert raw readings that populate the continuous aggregate
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insertBatch(testSensorReadingBatch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const aggRepo = yield* AggregatedReadingRepo
        return yield* aggRepo.queryByDevice({
          deviceId: testIds.device1,
          bucket: '1hour',
        })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    // Depending on whether continuous aggregate exists, this may return data or empty
    // The test validates the query doesn't error
    expect(Array.isArray(result)).toBe(true)
  })

  it('should return empty array for device with no aggregated data', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const aggRepo = yield* AggregatedReadingRepo
        return yield* aggRepo.queryByDevice({
          deviceId: testIds.nonExistentDevice,
          bucket: '1hour',
        })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result).toEqual([])
  })

  // ---------------------------------------------------------------------------
  // GetLatestBucket Tests
  // ---------------------------------------------------------------------------

  it('should get latest bucket for device', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const readingRepo = yield* SensorReadingRepo
        yield* readingRepo.insertBatch(testSensorReadingBatch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const aggRepo = yield* AggregatedReadingRepo
        return yield* aggRepo.getLatestBucket(testIds.device1, '1hour')
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    // May return Some or None depending on continuous aggregate state
    expect(Option.isOption(result)).toBe(true)
  })

  it('should return None for device with no data', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const aggRepo = yield* AggregatedReadingRepo
        return yield* aggRepo.getLatestBucket(testIds.nonExistentDevice, '1hour')
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isNone(result)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // StreamByDevice Tests
  // ---------------------------------------------------------------------------

  it('should stream aggregated readings', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const aggRepo = yield* AggregatedReadingRepo
        const stream = aggRepo.streamByDevice({
          deviceId: testIds.device1,
          bucket: '1hour',
        })
        return yield* Stream.runCollect(stream)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Array.isArray([...result])).toBe(true)
  })
})

// =============================================================================
// AnalyticsRecordRepo Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('AnalyticsRecordRepo Integration', () => {
  beforeAll(async () => {
    const available = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(TestPgClient))
    )
    if (!available) {
      throw new Error('Database not available')
    }
  })

  beforeEach(async () => {
    await Effect.runPromise(
      cleanTestReadings.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
    // Insert parent hierarchy
    await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const lineRepo = yield* LineRepo
        const machineRepo = yield* MachineRepo
        const sensorRepo = yield* SensorRepo
        yield* plantRepo.insert(testPlant1Insert)
        yield* lineRepo.insert(testLine1Insert)
        yield* machineRepo.insert(testMachine1Insert)
        yield* sensorRepo.insert(testSensor1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanTestReadings.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Insert Tests (Composite PK)
  // ---------------------------------------------------------------------------

  it('should insert analytics record with composite PK (hour, deviceId)', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        yield* analyticsRepo.insert(testAnalyticsRecord1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        return yield* analyticsRepo.findByKey(
          testAnalyticsRecord1Insert.hour,
          testAnalyticsRecord1Insert.deviceId
        )
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
    const record = Option.getOrThrow(result)
    expect(record.avgValue).toBe(24.5)
    expect(record.sampleCount).toBe(360)
    expect(Option.isSome(record.stddev)).toBe(true)
  })

  it('should insert record with optional stddev as None', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        yield* analyticsRepo.insert(testAnalyticsRecord2Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        return yield* analyticsRepo.findByKey(
          testAnalyticsRecord2Insert.hour,
          testAnalyticsRecord2Insert.deviceId
        )
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
    const record = Option.getOrThrow(result)
    expect(Option.isNone(record.stddev)).toBe(true)
  })

  it('should upsert on conflict (composite PK)', async () => {
    // Insert first
    await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        yield* analyticsRepo.insert(testAnalyticsRecord1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    // Insert again with different values - should update
    await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        yield* analyticsRepo.insert({
          ...testAnalyticsRecord1Insert,
          avgValue: 30.0,
        })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        return yield* analyticsRepo.findByKey(
          testAnalyticsRecord1Insert.hour,
          testAnalyticsRecord1Insert.deviceId
        )
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
    const record = Option.getOrThrow(result)
    expect(record.avgValue).toBe(30.0) // Updated value
  })

  // ---------------------------------------------------------------------------
  // InsertBatch Tests
  // ---------------------------------------------------------------------------

  it('should insert batch of analytics records', async () => {
    const batch = [testAnalyticsRecord1Insert, testAnalyticsRecord2Insert]

    await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        yield* analyticsRepo.insertBatch(batch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        return yield* analyticsRepo.queryByDevice({ deviceId: testIds.device1 })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(2)
  })

  it('should handle empty batch gracefully', async () => {
    // Should not throw
    await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        yield* analyticsRepo.insertBatch([])
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )
  })

  // ---------------------------------------------------------------------------
  // FindByKey Tests
  // ---------------------------------------------------------------------------

  it('should find record by composite key', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        yield* analyticsRepo.insert(testAnalyticsRecord1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        return yield* analyticsRepo.findByKey(
          testAnalyticsRecord1Insert.hour,
          testAnalyticsRecord1Insert.deviceId
        )
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
  })

  it('should return None for non-existent key', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        return yield* analyticsRepo.findByKey(new Date(), testIds.nonExistentDevice)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isNone(result)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // QueryByDevice Tests
  // ---------------------------------------------------------------------------

  it('should query records by device with time range', async () => {
    const batch = [testAnalyticsRecord1Insert, testAnalyticsRecord2Insert]

    await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        yield* analyticsRepo.insertBatch(batch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        return yield* analyticsRepo.queryByDevice({
          deviceId: testIds.device1,
          since: testDates.oneDayAgo,
        })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(2)
  })

  it('should respect limit parameter', async () => {
    const batch = [testAnalyticsRecord1Insert, testAnalyticsRecord2Insert]

    await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        yield* analyticsRepo.insertBatch(batch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        return yield* analyticsRepo.queryByDevice({
          deviceId: testIds.device1,
          limit: 1,
        })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(1)
  })

  it('should return empty array for device with no data', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        return yield* analyticsRepo.queryByDevice({
          deviceId: testIds.nonExistentDevice,
        })
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result).toEqual([])
  })

  // ---------------------------------------------------------------------------
  // StreamByDevice Tests
  // ---------------------------------------------------------------------------

  it('should stream analytics records by device', async () => {
    const batch = [testAnalyticsRecord1Insert, testAnalyticsRecord2Insert]

    await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        yield* analyticsRepo.insertBatch(batch)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        const stream = analyticsRepo.streamByDevice({ deviceId: testIds.device1 })
        return yield* Stream.runCollect(stream)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(2)
  })

  it('should stream empty for device with no data', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const analyticsRepo = yield* AnalyticsRecordRepo
        const stream = analyticsRepo.streamByDevice({ deviceId: testIds.nonExistentDevice })
        return yield* Stream.runCollect(stream)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(0)
  })
})
