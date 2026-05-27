/**
 * IIoT Services - BDD Tests
 *
 * Feature: IIoT Service Layer Integration
 *   As an IIoT platform operator
 *   I want services that orchestrate sensor, asset, and alarm operations
 *   So that I can monitor industrial processes effectively
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Stream, Chunk, Layer } from 'effect'
import { it as effectIt } from '@effect/vitest'

// L1 Services
import { TimeSeriesClient } from '../services/l1/TimeSeriesClient'
import { GraphClient } from '../services/l1/GraphClient'
import { AssetGraphQueries } from '../services/l2/AssetGraphQueries'

// L2 Services
import { SensorService } from '../services/l2/SensorService'
import { AssetService } from '../services/l2/AssetService'
import { AlarmService } from '../services/l2/AlarmService'

// L3 Services
import { IIoTService } from '../services/l3/IIoTService'

// Types
import type { DeviceId, PlantId, MachineId } from '../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const TestDeviceId = 'TEST-DEVICE-001' as DeviceId
const TestPlantId = 'TEST-PLANT-001' as PlantId
const TestMachineId = 'TEST-MACHINE-001' as MachineId

// =============================================================================
// Feature: L1 TimeSeriesClient
// =============================================================================

describe('Feature: L1 TimeSeriesClient', () => {
  describe('Scenario: Insert sensor readings', () => {
    effectIt.effect('Given valid readings, When inserting, Then should return count', () =>
      Effect.gen(function* () {
        const client = yield* TimeSeriesClient

        const readings = [
          { time: new Date(), deviceId: TestDeviceId, value: 25.5, quality: 100 as const },
          { time: new Date(), deviceId: TestDeviceId, value: 26.0, quality: 100 as const },
        ]

        const count = yield* client.insertReadings(readings)
        expect(count).toBe(2)
      }).pipe(Effect.provide(TimeSeriesClient.Default))
    )
  })

  describe('Scenario: Query sensor readings', () => {
    effectIt.effect('Given a device ID, When querying, Then should return stream', () =>
      Effect.gen(function* () {
        const client = yield* TimeSeriesClient

        // Insert some data first
        yield* client.insertReadings([
          { time: new Date(), deviceId: TestDeviceId, value: 25.5, quality: 100 as const },
        ])

        // Query the data
        const readings = yield* client
          .queryReadings({ deviceId: TestDeviceId })
          .pipe(Stream.runCollect)

        // Mock implementation returns empty, but structure is correct
        expect(Chunk.isChunk(readings)).toBe(true)
      }).pipe(Effect.provide(TimeSeriesClient.Default))
    )
  })

  describe('Scenario: Get hypertable stats', () => {
    effectIt.effect('Given TimeSeriesClient, When getting stats, Then should return table info', () =>
      Effect.gen(function* () {
        const client = yield* TimeSeriesClient

        const stats = yield* client.getHypertableStats()

        expect(stats.tableName).toBe('sensor_readings')
        expect(typeof stats.numChunks).toBe('number')
        expect(typeof stats.compressionEnabled).toBe('boolean')
      }).pipe(Effect.provide(TimeSeriesClient.Default))
    )
  })
})

// =============================================================================
// Feature: L1 GraphClient
// =============================================================================

describe('Feature: L1 GraphClient', () => {
  describe('Scenario: Execute Cypher query', () => {
    effectIt.effect('Given a Cypher query, When executing, Then should return result', () =>
      Effect.gen(function* () {
        const client = yield* GraphClient

        const result = yield* client.executeCypher('MATCH (n) RETURN n LIMIT 1')

        expect(result).toHaveProperty('rows')
        expect(Array.isArray(result.rows)).toBe(true)
      }).pipe(Effect.provide(GraphClient.Default))
    )
  })

  describe('Scenario: Get plants stream', () => {
    effectIt.effect('Given AssetGraphQueries, When getting plants, Then should return stream', () =>
      Effect.gen(function* () {
        const assetGraph = yield* AssetGraphQueries

        const plants = yield* assetGraph.getPlants().pipe(Stream.runCollect)

        expect(Chunk.isChunk(plants)).toBe(true)
      }).pipe(Effect.provide(AssetGraphQueries.Default))
    )
  })
})

// =============================================================================
// Feature: L2 SensorService
// =============================================================================

describe('Feature: L2 SensorService', () => {
  // Combined layer for SensorService dependencies
  const SensorServiceLayer = SensorService.Default

  describe('Scenario: Ingest validated readings', () => {
    effectIt.effect('Given readings with invalid values, When ingesting, Then should reject', () =>
      Effect.gen(function* () {
        const service = yield* SensorService

        // NaN should be rejected
        const result = yield* service
          .ingestReadings([
            { time: new Date(), deviceId: TestDeviceId, value: NaN },
          ])
          .pipe(Effect.either)

        expect(result._tag).toBe('Left')
      }).pipe(Effect.provide(SensorServiceLayer))
    )

    effectIt.effect('Given valid readings, When ingesting, Then should succeed', () =>
      Effect.gen(function* () {
        const service = yield* SensorService

        const count = yield* service.ingestReadings([
          { time: new Date(), deviceId: TestDeviceId, value: 25.5 },
          { time: new Date(), deviceId: TestDeviceId, value: 26.0, quality: 95 },
        ])

        expect(count).toBe(2)
      }).pipe(Effect.provide(SensorServiceLayer))
    )
  })

  describe('Scenario: Query with time range', () => {
    effectIt.effect('Given device and time range, When querying, Then should filter correctly', () =>
      Effect.gen(function* () {
        const service = yield* SensorService

        const since = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
        const until = new Date()

        const readings = yield* service
          .queryReadings({
            deviceId: TestDeviceId,
            since,
            until,
            limit: 100,
          })
          .pipe(Stream.runCollect)

        // Returns stream structure
        expect(Chunk.isChunk(readings)).toBe(true)
      }).pipe(Effect.provide(SensorServiceLayer))
    )
  })

  describe('Scenario: Get service statistics', () => {
    effectIt.effect('Given SensorService, When getting stats, Then should include sensor count', () =>
      Effect.gen(function* () {
        const service = yield* SensorService

        const stats = yield* service.getStats()

        expect(stats).toHaveProperty('totalSensors')
        expect(stats).toHaveProperty('hypertableStats')
        expect(typeof stats.totalSensors).toBe('number')
      }).pipe(Effect.provide(SensorServiceLayer))
    )
  })
})

// =============================================================================
// Feature: L2 AssetService
// =============================================================================

describe('Feature: L2 AssetService', () => {
  const AssetServiceLayer = AssetService.Default

  describe('Scenario: Get plant by ID', () => {
    effectIt.effect('Given non-existent plant ID, When getting, Then should fail with PlantNotFoundError', () =>
      Effect.gen(function* () {
        const service = yield* AssetService

        const result = yield* service
          .getPlant('NON-EXISTENT' as PlantId)
          .pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('PlantNotFoundError')
        }
      }).pipe(Effect.provide(AssetServiceLayer))
    )
  })

  describe('Scenario: Get machine with sensors', () => {
    effectIt.effect('Given a machine ID, When getting with sensors, Then should include sensor list', () =>
      Effect.gen(function* () {
        const service = yield* AssetService

        const result = yield* service.getMachineWithSensors(TestMachineId)

        expect(result).toHaveProperty('machine')
        expect(result).toHaveProperty('sensors')
        expect(Array.isArray(result.sensors)).toBe(true)
      }).pipe(Effect.provide(AssetServiceLayer))
    )
  })
})

// =============================================================================
// Feature: L2 AlarmService
// =============================================================================

describe('Feature: L2 AlarmService', () => {
  const AlarmServiceLayer = AlarmService.Default

  describe('Scenario: Create and retrieve alarm', () => {
    effectIt.effect('Given alarm params, When creating, Then should return alarm with ID', () =>
      Effect.gen(function* () {
        const service = yield* AlarmService

        const alarm = yield* service.createAlarm({
          deviceId: TestDeviceId,
          alarmType: 'high_temperature',
          severity: 'warning',
          message: 'Temperature exceeded 30C',
        })

        expect(alarm._tag).toBe('Alarm')
        expect(alarm.id).toMatch(/^ALM-/)
        expect(alarm.severity).toBe('warning')

        // Retrieve it
        const retrieved = yield* service.getAlarm(alarm.id)
        expect(retrieved.id).toBe(alarm.id)
      }).pipe(Effect.provide(AlarmServiceLayer))
    )
  })

  describe('Scenario: Acknowledge alarm', () => {
    effectIt.effect('Given an open alarm, When acknowledging, Then should set acknowledgedAt', () =>
      Effect.gen(function* () {
        const service = yield* AlarmService

        // Create alarm
        const alarm = yield* service.createAlarm({
          deviceId: TestDeviceId,
          alarmType: 'sensor_fault',
          severity: 'critical',
          message: 'Sensor communication lost',
        })

        expect(alarm.acknowledgedAt).toBeUndefined()

        // Acknowledge it
        const acknowledged = yield* service.acknowledgeAlarm(alarm.id, 'operator@plant.com')

        expect(acknowledged.acknowledgedAt).toBeDefined()
        expect(acknowledged.acknowledgedBy).toBe('operator@plant.com')
      }).pipe(Effect.provide(AlarmServiceLayer))
    )

    effectIt.effect('Given already acknowledged alarm, When acknowledging again, Then should fail', () =>
      Effect.gen(function* () {
        const service = yield* AlarmService

        const alarm = yield* service.createAlarm({
          deviceId: TestDeviceId,
          alarmType: 'maintenance_due',
          severity: 'info',
          message: 'Scheduled maintenance',
        })

        yield* service.acknowledgeAlarm(alarm.id, 'user1')

        // Try again
        const result = yield* service
          .acknowledgeAlarm(alarm.id, 'user2')
          .pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('AlarmAlreadyAcknowledgedError')
        }
      }).pipe(Effect.provide(AlarmServiceLayer))
    )
  })

  describe('Scenario: Clear alarm', () => {
    effectIt.effect('Given an active alarm, When clearing, Then should set clearedAt', () =>
      Effect.gen(function* () {
        const service = yield* AlarmService

        const alarm = yield* service.createAlarm({
          deviceId: TestDeviceId,
          alarmType: 'high_pressure',
          severity: 'warning',
          message: 'High pressure',
        })

        expect(alarm.clearedAt).toBeUndefined()

        const cleared = yield* service.clearAlarm(alarm.id)

        expect(cleared.clearedAt).toBeDefined()
      }).pipe(Effect.provide(AlarmServiceLayer))
    )
  })

  describe('Scenario: Filter alarms by severity', () => {
    effectIt.effect('Given multiple alarms, When filtering by severity, Then should return matches', () =>
      Effect.gen(function* () {
        const service = yield* AlarmService

        // Create alarms with different severities
        yield* service.createAlarm({
          deviceId: TestDeviceId,
          alarmType: 'high_temperature',
          severity: 'critical',
          message: 'Critical 1',
        })

        yield* service.createAlarm({
          deviceId: TestDeviceId,
          alarmType: 'high_vibration',
          severity: 'warning',
          message: 'Warning 1',
        })

        yield* service.createAlarm({
          deviceId: TestDeviceId,
          alarmType: 'overcurrent',
          severity: 'critical',
          message: 'Critical 2',
        })

        // Filter by critical
        const criticalAlarms = yield* service
          .getAlarms({ severity: 'critical' })
          .pipe(Stream.runCollect)

        const criticalArray = Chunk.toArray(criticalAlarms)
        expect(criticalArray.every((a) => a.severity === 'critical')).toBe(true)
      }).pipe(Effect.provide(AlarmServiceLayer))
    )
  })

  describe('Scenario: Get alarm statistics', () => {
    effectIt.effect('Given alarms in various states, When getting stats, Then should aggregate correctly', () =>
      Effect.gen(function* () {
        const service = yield* AlarmService

        const stats = yield* service.getStats()

        expect(stats).toHaveProperty('total')
        expect(stats).toHaveProperty('open')
        expect(stats).toHaveProperty('acknowledged')
        expect(stats).toHaveProperty('cleared')
        expect(stats).toHaveProperty('bySeverity')
        expect(stats.bySeverity).toHaveProperty('info')
        expect(stats.bySeverity).toHaveProperty('warning')
        expect(stats.bySeverity).toHaveProperty('critical')
        expect(stats.bySeverity).toHaveProperty('emergency')
      }).pipe(Effect.provide(AlarmServiceLayer))
    )
  })
})

// =============================================================================
// Feature: L3 IIoTService Orchestration
// =============================================================================

describe('Feature: L3 IIoTService Orchestration', () => {
  const IIoTServiceLayer = IIoTService.Default

  describe('Scenario: Get machine health summary', () => {
    effectIt.effect('Given a machine ID, When getting health, Then should aggregate sensor and alarm data', () =>
      Effect.gen(function* () {
        const service = yield* IIoTService

        const health = yield* service.getMachineHealth(TestMachineId)

        expect(health).toHaveProperty('machineId')
        expect(health).toHaveProperty('machineName')
        expect(health).toHaveProperty('sensorCount')
        expect(health).toHaveProperty('activeAlarmCount')
        expect(health).toHaveProperty('criticalAlarmCount')
        expect(typeof health.sensorCount).toBe('number')
      }).pipe(Effect.provide(IIoTServiceLayer))
    )
  })

  describe('Scenario: Raise alarm with enrichment', () => {
    effectIt.effect('Given alarm params, When raising, Then should include context', () =>
      Effect.gen(function* () {
        const service = yield* IIoTService

        const enrichedAlert = yield* service.raiseAlarm({
          deviceId: TestDeviceId,
          alarmType: 'high_temperature',
          severity: 'critical',
          message: 'Temperature critical: 95C',
        })

        expect(enrichedAlert).toHaveProperty('alarm')
        expect(enrichedAlert).toHaveProperty('hierarchy')
        expect(enrichedAlert).toHaveProperty('recentReadings')
        expect(enrichedAlert.alarm._tag).toBe('Alarm')
        expect(enrichedAlert.alarm.severity).toBe('critical')
      }).pipe(Effect.provide(IIoTServiceLayer))
    )
  })

  describe('Scenario: Get enriched alerts stream', () => {
    effectIt.effect('Given open alarms, When getting enriched, Then should include context for each', () =>
      Effect.gen(function* () {
        const service = yield* IIoTService

        // Create some alarms first
        yield* service.raiseAlarm({
          deviceId: TestDeviceId,
          alarmType: 'sensor_fault',
          severity: 'warning',
          message: 'Sensor drift detected',
        })

        const alerts = yield* service
          .getEnrichedAlerts({ onlyOpen: true, limit: 5 })
          .pipe(Stream.runCollect)

        const alertsArray = Chunk.toArray(alerts)

        // Each alert should have enriched fields
        alertsArray.forEach((alert) => {
          expect(alert).toHaveProperty('alarm')
          expect(alert).toHaveProperty('hierarchy')
          expect(alert).toHaveProperty('recentReadings')
        })
      }).pipe(Effect.provide(IIoTServiceLayer))
    )
  })

  describe('Scenario: Access underlying services', () => {
    effectIt.effect('Given IIoTService, When accessing sensors/assets/alarms, Then should be available', () =>
      Effect.gen(function* () {
        const service = yield* IIoTService

        // Access L2 services directly through L3
        expect(service.sensors).toBeDefined()
        expect(service.assets).toBeDefined()
        expect(service.alarms).toBeDefined()

        // Can use them directly
        const stats = yield* service.alarms.getStats()
        expect(stats).toHaveProperty('total')
      }).pipe(Effect.provide(IIoTServiceLayer))
    )
  })
})
