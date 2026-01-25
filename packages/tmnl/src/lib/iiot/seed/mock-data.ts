/**
 * IIoT Mock Data Seeder
 *
 * Schema-aware seeder that leverages Effect Schema validation and Model definitions.
 * NOT part of migrations - run manually when needed.
 *
 * Architecture (Tiered Approach):
 * - Tier 1: Assets/Alarms via repos (full validation, small counts)
 * - Tier 2: Readings via generate_series (performance, 700K+ rows)
 *
 * Usage:
 * ```ts
 * import { seedAll, clearMockData } from './mock-data'
 *
 * // Seed all mock data (clears existing first)
 * await Effect.runPromise(seedAll.pipe(Effect.provide(SqlClientLive)))
 *
 * // Or seed individual components
 * await Effect.runPromise(seedMockReadings.pipe(Effect.provide(SqlClientLive)))
 * ```
 *
 * @module
 */

import { Effect, Option } from 'effect'
import { SqlClient } from '@effect/sql'

// Import branded identifiers (used for mockIds typing)
import type {
  PlantId,
  LineId,
  MachineId,
  DeviceId,
} from '../schemas/identifiers'

// Import Models for type-safe insert.make()
import { PlantModel } from '../models/assets/PlantModel'
import { LineModel } from '../models/assets/LineModel'
import { MachineModel } from '../models/assets/MachineModel'
import { SensorModel } from '../models/assets/SensorModel'
import { AlarmModel } from '../models/alarms/AlarmModel'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Seeding configuration.
 * Adjust row counts for development vs stress testing.
 */
export const SeedConfig = {
  /** Rows per primary sensor (TMP-001, VIB-001, etc.) */
  primarySensorRows: 100_000,
  /** Rows per secondary sensor (SPD-001, CUR-001) */
  secondarySensorRows: 50_000,
  /** Time range for generated data */
  timeRangeDays: 30,
} as const

// =============================================================================
// Mock Identifiers
// =============================================================================

/**
 * Mock asset identifiers.
 * Uses MOCK- prefix for isolation from test data (TEST-) and production data.
 */
export const mockIds = {
  // Plants
  plant1: 'MOCK-PLANT-001' as PlantId,
  plant2: 'MOCK-PLANT-002' as PlantId,

  // Lines
  line1: 'MOCK-LINE-001' as LineId,
  line2: 'MOCK-LINE-002' as LineId,
  line3: 'MOCK-LINE-003' as LineId,

  // Machines
  machine1: 'MOCK-MCH-001' as MachineId,
  machine2: 'MOCK-MCH-002' as MachineId,
  machine3: 'MOCK-MCH-003' as MachineId,
  machine4: 'MOCK-MCH-004' as MachineId,

  // Sensors (matching existing sensorSpecs)
  tmp001: 'TMP-001' as DeviceId,
  vib001: 'VIB-001' as DeviceId,
  tmp002: 'TMP-002' as DeviceId,
  vib002: 'VIB-002' as DeviceId,
  tmp003: 'TMP-003' as DeviceId,
  hum001: 'HUM-001' as DeviceId,
  spd001: 'SPD-001' as DeviceId,
  cur001: 'CUR-001' as DeviceId,
} as const

// =============================================================================
// Feature 1.1: Type-Safe Asset Definitions
// =============================================================================

/**
 * Mock plant definitions.
 * Uses PlantModel.insert.make() for type-safe insert objects.
 */
export const mockPlantInserts = [
  PlantModel.insert.make({
    id: mockIds.plant1,
    name: 'Main Manufacturing Plant',
    location: Option.some('Building A, North Campus'),
  }),
  PlantModel.insert.make({
    id: mockIds.plant2,
    name: 'Secondary Assembly Plant',
    location: Option.none(),
  }),
]

/**
 * Mock line definitions.
 * Uses LineModel.insert.make() for type-safe insert objects.
 */
export const mockLineInserts = [
  LineModel.insert.make({
    id: mockIds.line1,
    name: 'Assembly Line 1',
    plantId: mockIds.plant1,
  }),
  LineModel.insert.make({
    id: mockIds.line2,
    name: 'Packaging Line 1',
    plantId: mockIds.plant1,
  }),
  LineModel.insert.make({
    id: mockIds.line3,
    name: 'Paint Booth Line',
    plantId: mockIds.plant2,
  }),
]

/**
 * Mock machine definitions.
 * Uses MachineModel.insert.make() for type-safe insert objects.
 */
export const mockMachineInserts = [
  MachineModel.insert.make({
    id: mockIds.machine1,
    name: 'CNC Mill Alpha',
    model: Option.some('HAAS VF-2SS'),
    lineId: mockIds.line1,
  }),
  MachineModel.insert.make({
    id: mockIds.machine2,
    name: 'Assembly Robot Arm',
    model: Option.some('Fanuc M-710iC'),
    lineId: mockIds.line1,
  }),
  MachineModel.insert.make({
    id: mockIds.machine3,
    name: 'Packaging Station',
    model: Option.none(),
    lineId: mockIds.line2,
  }),
  MachineModel.insert.make({
    id: mockIds.machine4,
    name: 'Paint Spray Booth',
    model: Option.some('Graco ProMix 2KS'),
    lineId: mockIds.line3,
  }),
]

/**
 * Mock sensor definitions.
 * Uses SensorModel.insert.make() for type-safe insert objects.
 */
export const mockSensorInserts = [
  SensorModel.insert.make({
    deviceId: mockIds.tmp001,
    type: 'temperature',
    unit: 'celsius',
    machineId: mockIds.machine1,
  }),
  SensorModel.insert.make({
    deviceId: mockIds.vib001,
    type: 'vibration',
    unit: 'mm/s',
    machineId: mockIds.machine1,
  }),
  SensorModel.insert.make({
    deviceId: mockIds.tmp002,
    type: 'temperature',
    unit: 'celsius',
    machineId: mockIds.machine2,
  }),
  SensorModel.insert.make({
    deviceId: mockIds.vib002,
    type: 'vibration',
    unit: 'mm/s',
    machineId: mockIds.machine2,
  }),
  SensorModel.insert.make({
    deviceId: mockIds.tmp003,
    type: 'temperature',
    unit: 'celsius',
    machineId: mockIds.machine4,
  }),
  SensorModel.insert.make({
    deviceId: mockIds.hum001,
    type: 'humidity',
    unit: 'percent',
    machineId: mockIds.machine4,
  }),
  SensorModel.insert.make({
    deviceId: mockIds.spd001,
    type: 'speed',
    unit: 'm/min',
    machineId: mockIds.machine3,
  }),
  SensorModel.insert.make({
    deviceId: mockIds.cur001,
    type: 'current',
    unit: 'amps',
    machineId: mockIds.machine3,
  }),
]

// =============================================================================
// Feature 1.2: Type-Safe Sensor Spec Definitions
// =============================================================================

/**
 * Sensor specification with value range for mock data generation.
 * Extends sensor identity with generation parameters.
 */
export interface SensorSpec {
  /** Branded device identifier */
  readonly deviceId: DeviceId
  /** Minimum value for random generation */
  readonly valueMin: number
  /** Maximum value for random generation */
  readonly valueMax: number
  /** Probability of generating low quality (0-1) */
  readonly qualityThreshold: number
  /** Row count category */
  readonly rows: 'primary' | 'secondary'
}

/**
 * Type-safe sensor specifications for mock data generation.
 * All deviceIds must exist in mockSensorInserts.
 */
export const sensorSpecs: readonly SensorSpec[] = [
  { deviceId: mockIds.tmp001, valueMin: 20, valueMax: 30, qualityThreshold: 0.05, rows: 'primary' },
  { deviceId: mockIds.vib001, valueMin: 0, valueMax: 5, qualityThreshold: 0.05, rows: 'primary' },
  { deviceId: mockIds.tmp002, valueMin: 22, valueMax: 30, qualityThreshold: 0.05, rows: 'primary' },
  { deviceId: mockIds.vib002, valueMin: 0, valueMax: 4, qualityThreshold: 0.05, rows: 'primary' },
  { deviceId: mockIds.tmp003, valueMin: 35, valueMax: 60, qualityThreshold: 0.02, rows: 'primary' },
  { deviceId: mockIds.hum001, valueMin: 40, valueMax: 70, qualityThreshold: 0.02, rows: 'primary' },
  { deviceId: mockIds.spd001, valueMin: 10, valueMax: 15, qualityThreshold: 0.03, rows: 'secondary' },
  { deviceId: mockIds.cur001, valueMin: 5, valueMax: 15, qualityThreshold: 0.03, rows: 'secondary' },
] as const

// =============================================================================
// Feature 1.3: Type-Safe Alarm Definitions
// =============================================================================

/**
 * Mock alarm definitions.
 * Uses AlarmModel.insert.make() for type-safe insert objects.
 * Note: id is Model.Generated so not provided - auto-generated on insert.
 */
export const mockAlarmInserts = [
  AlarmModel.insert.make({
    deviceId: mockIds.tmp001,
    alarmType: 'high_temperature',
    severity: 'warning',
    message: Option.some('Temperature exceeded threshold: 29.5C'),
    metadata: Option.some({ threshold: 28, actualValue: 29.5 }),
    acknowledgedAt: Option.none(),
    clearedAt: Option.none(),
    acknowledgedBy: Option.none(),
  }),
  AlarmModel.insert.make({
    deviceId: mockIds.vib001,
    alarmType: 'high_vibration',
    severity: 'critical',
    message: Option.some('Vibration exceeded critical threshold: 4.8 mm/s'),
    metadata: Option.some({ threshold: 4.0, actualValue: 4.8 }),
    acknowledgedAt: Option.none(),
    clearedAt: Option.none(),
    acknowledgedBy: Option.none(),
  }),
  AlarmModel.insert.make({
    deviceId: mockIds.tmp003,
    alarmType: 'high_temperature',
    severity: 'warning',
    message: Option.some('Paint booth temperature high: 58C'),
    metadata: Option.some({ threshold: 55, actualValue: 58 }),
    acknowledgedAt: Option.none(),
    clearedAt: Option.none(),
    acknowledgedBy: Option.none(),
  }),
  AlarmModel.insert.make({
    deviceId: mockIds.cur001,
    alarmType: 'overcurrent',
    severity: 'critical',
    message: Option.some('Current spike detected: 14.2 amps'),
    metadata: Option.some({ threshold: 12, actualValue: 14.2 }),
    acknowledgedAt: Option.none(),
    clearedAt: Option.none(),
    acknowledgedBy: Option.none(),
  }),
]

// =============================================================================
// Mock Readings Seeder (Tier 2: Performance - generate_series)
// =============================================================================

/**
 * Seeds mock sensor readings using PostgreSQL generate_series.
 * Uses raw SQL for efficiency (700K+ rows).
 *
 * Idempotent: Deletes existing mock data before inserting.
 */
export const seedMockReadings = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Effect.log('Seeding mock sensor readings...')

  for (const spec of sensorSpecs) {
    const rowCount = spec.rows === 'primary'
      ? SeedConfig.primarySensorRows
      : SeedConfig.secondarySensorRows

    // Clear existing data for this device (idempotency)
    yield* sql.unsafe(`
      DELETE FROM iiot.sensor_readings
      WHERE device_id = '${spec.deviceId}'
        AND time > NOW() - INTERVAL '${SeedConfig.timeRangeDays} days'
    `)

    // Generate mock data using generate_series
    yield* sql.unsafe(`
      INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
      SELECT
        NOW() - (random() * INTERVAL '${SeedConfig.timeRangeDays} days'),
        '${spec.deviceId}',
        ${spec.valueMin} + (random() * ${spec.valueMax - spec.valueMin}),
        CASE WHEN random() > ${spec.qualityThreshold} THEN 100 ELSE 50 END
      FROM generate_series(1, ${rowCount})
    `)

    yield* Effect.log(`  - ${spec.deviceId}: ${rowCount.toLocaleString()} rows`)
  }

  yield* Effect.log('Mock readings seeded successfully')
})

// =============================================================================
// Mock Alarms Seeder
// =============================================================================

/**
 * Mock alarm records for testing.
 */
const mockAlarms = [
  {
    deviceId: 'TMP-001',
    alarmType: 'high_temperature',
    severity: 'warning',
    message: 'Temperature exceeded threshold: 29.5C',
    hoursAgo: 2,
  },
  {
    deviceId: 'VIB-001',
    alarmType: 'high_vibration',
    severity: 'critical',
    message: 'Vibration exceeded critical threshold: 4.8 mm/s',
    hoursAgo: 1,
  },
  {
    deviceId: 'TMP-003',
    alarmType: 'high_temperature',
    severity: 'warning',
    message: 'Paint booth temperature high: 58C',
    hoursAgo: 0.5,
  },
  {
    deviceId: 'CUR-001',
    alarmType: 'overcurrent',
    severity: 'critical',
    message: 'Current spike detected: 14.2 amps',
    hoursAgo: 0.25,
  },
] as const

/**
 * Seeds mock alarm records.
 * Idempotent: Uses ON CONFLICT DO NOTHING.
 */
export const seedMockAlarms = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Effect.log('Seeding mock alarms...')

  // Clear existing mock alarms (based on known messages)
  yield* sql.unsafe(`
    DELETE FROM iiot.alarms
    WHERE message LIKE 'Temperature exceeded threshold%'
       OR message LIKE 'Vibration exceeded critical%'
       OR message LIKE 'Paint booth temperature%'
       OR message LIKE 'Current spike detected%'
  `)

  for (const alarm of mockAlarms) {
    yield* sql.unsafe(`
      INSERT INTO iiot.alarms (device_id, alarm_type, severity, message, triggered_at)
      VALUES (
        '${alarm.deviceId}',
        '${alarm.alarmType}',
        '${alarm.severity}',
        '${alarm.message}',
        NOW() - INTERVAL '${alarm.hoursAgo} hours'
      )
    `)
  }

  yield* Effect.log(`  - ${mockAlarms.length} alarms seeded`)
})

// =============================================================================
// Continuous Aggregate Refresh
// =============================================================================

/**
 * Refreshes continuous aggregates after seeding.
 * Required for aggregates to include newly inserted data.
 */
export const refreshAggregates = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Effect.log('Refreshing continuous aggregates...')

  yield* sql.unsafe(`CALL refresh_continuous_aggregate('iiot.readings_1min', NULL, NULL)`)
  yield* Effect.log('  - readings_1min refreshed')

  yield* sql.unsafe(`CALL refresh_continuous_aggregate('iiot.readings_1hour', NULL, NULL)`)
  yield* Effect.log('  - readings_1hour refreshed')

  yield* Effect.log('Continuous aggregates refreshed')
})

// =============================================================================
// Clear Mock Data
// =============================================================================

/**
 * Clears all mock data from the database.
 * Useful for resetting to clean state.
 */
export const clearMockData = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Effect.log('Clearing mock data...')

  // Clear readings (within seed time range)
  yield* sql.unsafe(`
    DELETE FROM iiot.sensor_readings
    WHERE time > NOW() - INTERVAL '${SeedConfig.timeRangeDays} days'
  `)

  // Clear all alarms (mock data)
  yield* sql.unsafe(`DELETE FROM iiot.alarms`)

  yield* Effect.log('Mock data cleared')
})

// =============================================================================
// Combined Seeder
// =============================================================================

/**
 * Seeds all mock data in correct order.
 * Idempotent - safe to run multiple times.
 *
 * Order:
 * 1. Readings (700K+ rows)
 * 2. Alarms
 * 3. Refresh aggregates
 */
export const seedAll = Effect.gen(function* () {
  yield* Effect.log('=== IIoT Mock Data Seeder ===')
  yield* Effect.log(`Configuration: ${SeedConfig.primarySensorRows.toLocaleString()} rows/primary, ${SeedConfig.secondarySensorRows.toLocaleString()} rows/secondary`)

  yield* seedMockReadings
  yield* seedMockAlarms
  yield* refreshAggregates

  yield* Effect.log('=== Seeding complete ===')
})

// =============================================================================
// Stats Helper
// =============================================================================

/**
 * Returns current data counts for verification.
 */
export const getDataStats = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const readingsResult = yield* sql<{ count: string }>`
    SELECT COUNT(*)::text as count FROM iiot.sensor_readings
  `
  const alarmsResult = yield* sql<{ count: string }>`
    SELECT COUNT(*)::text as count FROM iiot.alarms
  `

  return {
    readings: parseInt(readingsResult[0]?.count ?? '0', 10),
    alarms: parseInt(alarmsResult[0]?.count ?? '0', 10),
  }
})
