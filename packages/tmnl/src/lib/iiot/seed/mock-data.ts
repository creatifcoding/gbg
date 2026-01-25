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

import { Effect, Option, pipe } from 'effect'
import { SqlClient } from '@effect/sql'

// Import repos for asset and alarm seeding
import { PlantRepo } from '../repos/PlantRepo'
import { LineRepo } from '../repos/LineRepo'
import { MachineRepo } from '../repos/MachineRepo'
import { SensorRepo } from '../repos/SensorRepo'
import { AlarmRepo } from '../repos/AlarmRepo'

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
// Feature 2: Asset Seed Functions (TDD Implementation)
// =============================================================================

/**
 * Check if error is a PostgreSQL unique violation (duplicate key).
 * PostgreSQL error code 23505 = unique_violation
 */
const isDuplicateKeyError = (e: unknown): boolean => {
  if (typeof e !== 'object' || e === null) return false
  const err = e as { _tag?: string; cause?: { code?: string } }
  return err._tag === 'SqlError' && err.cause?.code === '23505'
}

/**
 * Seeds all mock plants via PlantRepo.
 * Idempotent: catches duplicate key errors.
 */
export const seedPlants = Effect.gen(function* () {
  const repo = yield* PlantRepo
  yield* Effect.log('Seeding plants...')
  yield* Effect.forEach(mockPlantInserts, (plant) =>
    repo.insert(plant).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void)),
    { concurrency: 10 }
  )
  yield* Effect.log(`  - ${mockPlantInserts.length} plants seeded`)
})

/**
 * Seeds all mock lines via LineRepo.
 * Idempotent: catches duplicate key errors.
 * Requires: Plants must exist (FK constraint).
 */
export const seedLines = Effect.gen(function* () {
  const repo = yield* LineRepo
  yield* Effect.log('Seeding lines...')
  yield* Effect.forEach(mockLineInserts, (line) =>
    repo.insert(line).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void)),
    { concurrency: 10 }
  )
  yield* Effect.log(`  - ${mockLineInserts.length} lines seeded`)
})

/**
 * Seeds all mock machines via MachineRepo.
 * Idempotent: catches duplicate key errors.
 * Requires: Lines must exist (FK constraint).
 */
export const seedMachines = Effect.gen(function* () {
  const repo = yield* MachineRepo
  yield* Effect.log('Seeding machines...')
  yield* Effect.forEach(mockMachineInserts, (machine) =>
    repo.insert(machine).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void)),
    { concurrency: 10 }
  )
  yield* Effect.log(`  - ${mockMachineInserts.length} machines seeded`)
})

/**
 * Seeds all mock sensors via SensorRepo.
 * Idempotent: catches duplicate key errors.
 * Requires: Machines must exist (FK constraint).
 */
export const seedSensors = Effect.gen(function* () {
  const repo = yield* SensorRepo
  yield* Effect.log('Seeding sensors...')
  yield* Effect.forEach(mockSensorInserts, (sensor) =>
    repo.insert(sensor).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void)),
    { concurrency: 10 }
  )
  yield* Effect.log(`  - ${mockSensorInserts.length} sensors seeded`)
})

/**
 * Seeds all assets in FK order: Plants -> Lines -> Machines -> Sensors.
 * Idempotent: safe to run multiple times.
 */
export const seedAssets = pipe(
  seedPlants,
  Effect.andThen(seedLines),
  Effect.andThen(seedMachines),
  Effect.andThen(seedSensors)
)

// =============================================================================
// Mock Readings Seeder (Tier 2: Performance - generate_series)
// =============================================================================

/**
 * Seeds mock sensor readings using PostgreSQL generate_series.
 * Uses sql template tags with parameterized values for safety.
 * Performance: 700K+ rows via server-side generation.
 *
 * Idempotent: Deletes existing mock data before inserting.
 * Parallelized across sensors (each device is independent).
 */
export const seedMockReadings = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Effect.log('Seeding mock sensor readings...')

  const timeRangeDays = SeedConfig.timeRangeDays

  // Seed each sensor in parallel (bounded by connection pool)
  yield* Effect.forEach(sensorSpecs, (spec) => {
    const rowCount = spec.rows === 'primary'
      ? SeedConfig.primarySensorRows
      : SeedConfig.secondarySensorRows

    const { deviceId, valueMin, valueMax, qualityThreshold } = spec
    const valueRange = valueMax - valueMin

    return pipe(
      // Clear existing data for this device (idempotency)
      sql`
        DELETE FROM iiot.sensor_readings
        WHERE device_id = ${deviceId}
          AND time > NOW() - make_interval(days => ${timeRangeDays})
      `,
      // Generate mock data using generate_series
      Effect.andThen(sql`
        INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
        SELECT
          NOW() - (random() * make_interval(days => ${timeRangeDays})),
          ${deviceId},
          ${valueMin} + (random() * ${valueRange}),
          CASE WHEN random() > ${qualityThreshold} THEN 100 ELSE 50 END
        FROM generate_series(1, ${rowCount})
      `),
      Effect.andThen(Effect.log(`  - ${deviceId}: ${rowCount.toLocaleString()} rows`))
    )
  }, { concurrency: 4 }) // Bounded by DB connection pool

  yield* Effect.log('Mock readings seeded successfully')
})

// =============================================================================
// Mock Alarms Seeder (Tier 1: Repo-Based)
// =============================================================================

/**
 * Seeds mock alarm records via AlarmRepo.
 * Uses mockAlarmInserts (type-safe AlarmModel.insert.make() objects).
 * Idempotent: catches duplicate key errors.
 */
export const seedMockAlarms = Effect.gen(function* () {
  const repo = yield* AlarmRepo

  yield* Effect.log('Seeding mock alarms...')

  yield* Effect.forEach(mockAlarmInserts, (alarm) =>
    repo.insert(alarm).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void)),
    { concurrency: 10 }
  )

  yield* Effect.log(`  - ${mockAlarmInserts.length} alarms seeded`)
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
  const timeRangeDays = SeedConfig.timeRangeDays

  yield* Effect.log('Clearing mock data...')

  // Clear readings (within seed time range)
  yield* sql`
    DELETE FROM iiot.sensor_readings
    WHERE time > NOW() - make_interval(days => ${timeRangeDays})
  `

  // Clear all alarms (mock data)
  yield* sql`DELETE FROM iiot.alarms`

  yield* Effect.log('Mock data cleared')
})

// =============================================================================
// Combined Seeder
// =============================================================================

/**
 * Seeds all mock data in correct FK order.
 * Idempotent - safe to run multiple times.
 *
 * Order:
 * 1. Assets (Plants → Lines → Machines → Sensors)
 * 2. Readings (700K+ rows, depends on sensors)
 * 3. Alarms (depends on devices)
 * 4. Refresh aggregates
 */
export const seedAll = Effect.gen(function* () {
  yield* Effect.log('=== IIoT Mock Data Seeder ===')
  yield* Effect.log(`Configuration: ${SeedConfig.primarySensorRows.toLocaleString()} rows/primary, ${SeedConfig.secondarySensorRows.toLocaleString()} rows/secondary`)

  yield* seedAssets
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
