/**
 * IIoT Seed Assets Integration Tests
 *
 * TDD tests for seedPlants, seedLines, seedMachines, seedSensors, and composed seedAssets.
 * These tests are written FIRST - the functions don't exist yet and tests MUST fail.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test src/lib/iiot/__tests__/seed/seed-assets.integration.test.ts
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Effect, Exit } from 'effect'
import { PgClient } from '@effect/sql-pg'
import {
  TestPgClient,
  TestPgClientWithMigrations,
  AssetRepositoriesIntegrationLayer,
  cleanTestAssets,
  isDatabaseAvailable,
} from '../integration/layer'
import { PlantRepo, LineRepo, MachineRepo, SensorRepo } from '../../repos'

// =============================================================================
// IMPORTS THAT DON'T EXIST YET - THIS WILL CAUSE TEST FAILURES
// =============================================================================

// These functions are the target of TDD - they don't exist yet
import {
  seedPlants,
  seedLines,
  seedMachines,
  seedSensors,
  seedAssets,
} from '../../seed/mock-data'

// Import mock data for count verification
import {
  mockPlantInserts,
  mockLineInserts,
  mockMachineInserts,
  mockSensorInserts,
  mockIds,
} from '../../seed/mock-data'

const RUN_INTEGRATION = process.env['RUN_INTEGRATION_TESTS'] === '1'

// =============================================================================
// Test Layer: Repos + PgClient with migrations
// =============================================================================

/**
 * Combined layer for seed tests: Asset repos + PgClient (for raw SQL cleanup)
 */
const SeedTestLayer = AssetRepositoriesIntegrationLayer

// =============================================================================
// Cleanup Utilities
// =============================================================================

/**
 * Clean MOCK-prefixed data (seed data uses MOCK- prefix, not TEST-)
 * Order matters due to FK constraints: Sensors -> Machines -> Lines -> Plants
 */
const cleanMockAssets = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Delete in FK-safe order
  yield* sql`DELETE FROM iiot.sensors WHERE device_id IN ('TMP-001', 'VIB-001', 'TMP-002', 'VIB-002', 'TMP-003', 'HUM-001', 'SPD-001', 'CUR-001')`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  yield* sql`DELETE FROM iiot.machines WHERE id LIKE 'MOCK-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  yield* sql`DELETE FROM iiot.lines WHERE id LIKE 'MOCK-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  yield* sql`DELETE FROM iiot.plants WHERE id LIKE 'MOCK-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
})

// =============================================================================
// seedPlants Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('seedPlants', () => {
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
    // Clean both TEST- and MOCK- prefixed data
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanMockAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanMockAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Happy Path
  // ---------------------------------------------------------------------------

  it('should insert all mock plants into empty table', async () => {
    // Act: run seedPlants
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: verify all plants were inserted
    const plants = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const all = yield* plantRepo.findAll()
        return all.filter(p => p.id.startsWith('MOCK-'))
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(plants.length).toBe(mockPlantInserts.length)
    expect(plants.map(p => p.id)).toContain(mockIds.plant1)
    expect(plants.map(p => p.id)).toContain(mockIds.plant2)
  })

  // ---------------------------------------------------------------------------
  // Idempotency
  // ---------------------------------------------------------------------------

  it('should be idempotent - no error on duplicate run', async () => {
    // Arrange: run seedPlants once
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )

    // Act: run seedPlants again - should not throw
    const result = await Effect.runPromiseExit(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect succeeds
    expect(Exit.isSuccess(result)).toBe(true)

    // Assert: count unchanged
    const plants = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const all = yield* plantRepo.findAll()
        return all.filter(p => p.id.startsWith('MOCK-'))
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(plants.length).toBe(mockPlantInserts.length)
  })

  // ---------------------------------------------------------------------------
  // Partial Pre-existing State
  // ---------------------------------------------------------------------------

  it('should handle partial pre-existing state gracefully', async () => {
    // Arrange: manually insert one plant
    await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        yield* plantRepo.insert(mockPlantInserts[0])
      }).pipe(Effect.provide(SeedTestLayer))
    )

    // Act: run seedPlants (includes that plant ID)
    const result = await Effect.runPromiseExit(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect succeeds (duplicate error caught internally)
    expect(Exit.isSuccess(result)).toBe(true)

    // Assert: all plants exist
    const plants = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const all = yield* plantRepo.findAll()
        return all.filter(p => p.id.startsWith('MOCK-'))
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(plants.length).toBe(mockPlantInserts.length)
  })
})

// =============================================================================
// seedLines Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('seedLines', () => {
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
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanMockAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanMockAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Happy Path (with plants pre-seeded)
  // ---------------------------------------------------------------------------

  it('should insert all mock lines when plants exist', async () => {
    // Arrange: pre-seed plants (FK dependency)
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )

    // Act: run seedLines
    await Effect.runPromise(
      seedLines.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: verify all lines were inserted
    const lines = await Effect.runPromise(
      Effect.gen(function* () {
        const lineRepo = yield* LineRepo
        const all = yield* lineRepo.findAll()
        return all.filter(l => l.id.startsWith('MOCK-'))
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(lines.length).toBe(mockLineInserts.length)
    expect(lines.map(l => l.id)).toContain(mockIds.line1)
    expect(lines.map(l => l.id)).toContain(mockIds.line2)
    expect(lines.map(l => l.id)).toContain(mockIds.line3)
  })

  // ---------------------------------------------------------------------------
  // FK Violation (plants don't exist)
  // ---------------------------------------------------------------------------

  it('should fail with FK violation when plants do NOT exist', async () => {
    // Arrange: empty database (no plants)

    // Act: run seedLines without seeding plants first
    const result = await Effect.runPromiseExit(
      seedLines.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect fails with SqlError (FK violation)
    expect(Exit.isFailure(result)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Idempotency
  // ---------------------------------------------------------------------------

  it('should be idempotent - no error on duplicate run', async () => {
    // Arrange: seed plants and lines once
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )
    await Effect.runPromise(
      seedLines.pipe(Effect.provide(SeedTestLayer))
    )

    // Act: run seedLines again
    const result = await Effect.runPromiseExit(
      seedLines.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect succeeds
    expect(Exit.isSuccess(result)).toBe(true)

    // Assert: count unchanged
    const lines = await Effect.runPromise(
      Effect.gen(function* () {
        const lineRepo = yield* LineRepo
        const all = yield* lineRepo.findAll()
        return all.filter(l => l.id.startsWith('MOCK-'))
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(lines.length).toBe(mockLineInserts.length)
  })
})

// =============================================================================
// seedMachines Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('seedMachines', () => {
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
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanMockAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanMockAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Happy Path (with plants + lines pre-seeded)
  // ---------------------------------------------------------------------------

  it('should insert all mock machines when lines exist', async () => {
    // Arrange: pre-seed plants and lines (FK dependency chain)
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )
    await Effect.runPromise(
      seedLines.pipe(Effect.provide(SeedTestLayer))
    )

    // Act: run seedMachines
    await Effect.runPromise(
      seedMachines.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: verify all machines were inserted
    const machines = await Effect.runPromise(
      Effect.gen(function* () {
        const machineRepo = yield* MachineRepo
        const all = yield* machineRepo.findAll()
        return all.filter(m => m.id.startsWith('MOCK-'))
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(machines.length).toBe(mockMachineInserts.length)
    expect(machines.map(m => m.id)).toContain(mockIds.machine1)
    expect(machines.map(m => m.id)).toContain(mockIds.machine2)
    expect(machines.map(m => m.id)).toContain(mockIds.machine3)
    expect(machines.map(m => m.id)).toContain(mockIds.machine4)
  })

  // ---------------------------------------------------------------------------
  // FK Violation (lines don't exist)
  // ---------------------------------------------------------------------------

  it('should fail with FK violation when lines do NOT exist', async () => {
    // Arrange: empty database (no lines)

    // Act: run seedMachines without seeding lines first
    const result = await Effect.runPromiseExit(
      seedMachines.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect fails with SqlError (FK violation)
    expect(Exit.isFailure(result)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Idempotency
  // ---------------------------------------------------------------------------

  it('should be idempotent - no error on duplicate run', async () => {
    // Arrange: seed full hierarchy once
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )
    await Effect.runPromise(
      seedLines.pipe(Effect.provide(SeedTestLayer))
    )
    await Effect.runPromise(
      seedMachines.pipe(Effect.provide(SeedTestLayer))
    )

    // Act: run seedMachines again
    const result = await Effect.runPromiseExit(
      seedMachines.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect succeeds
    expect(Exit.isSuccess(result)).toBe(true)

    // Assert: count unchanged
    const machines = await Effect.runPromise(
      Effect.gen(function* () {
        const machineRepo = yield* MachineRepo
        const all = yield* machineRepo.findAll()
        return all.filter(m => m.id.startsWith('MOCK-'))
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(machines.length).toBe(mockMachineInserts.length)
  })
})

// =============================================================================
// seedSensors Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('seedSensors', () => {
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
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanMockAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanMockAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Happy Path (with full hierarchy pre-seeded)
  // ---------------------------------------------------------------------------

  it('should insert all mock sensors when machines exist', async () => {
    // Arrange: pre-seed full hierarchy (FK dependency chain)
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )
    await Effect.runPromise(
      seedLines.pipe(Effect.provide(SeedTestLayer))
    )
    await Effect.runPromise(
      seedMachines.pipe(Effect.provide(SeedTestLayer))
    )

    // Act: run seedSensors
    await Effect.runPromise(
      seedSensors.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: verify all sensors were inserted
    const sensors = await Effect.runPromise(
      Effect.gen(function* () {
        const sensorRepo = yield* SensorRepo
        const all = yield* sensorRepo.findAll()
        // Filter by known mock sensor deviceIds
        return all.filter(s =>
          s.deviceId.startsWith('TMP-') ||
          s.deviceId.startsWith('VIB-') ||
          s.deviceId.startsWith('HUM-') ||
          s.deviceId.startsWith('SPD-') ||
          s.deviceId.startsWith('CUR-')
        )
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(sensors.length).toBe(mockSensorInserts.length)
    expect(sensors.map(s => s.deviceId)).toContain(mockIds.tmp001)
    expect(sensors.map(s => s.deviceId)).toContain(mockIds.vib001)
    expect(sensors.map(s => s.deviceId)).toContain(mockIds.tmp002)
    expect(sensors.map(s => s.deviceId)).toContain(mockIds.vib002)
    expect(sensors.map(s => s.deviceId)).toContain(mockIds.tmp003)
    expect(sensors.map(s => s.deviceId)).toContain(mockIds.hum001)
    expect(sensors.map(s => s.deviceId)).toContain(mockIds.spd001)
    expect(sensors.map(s => s.deviceId)).toContain(mockIds.cur001)
  })

  // ---------------------------------------------------------------------------
  // FK Violation (machines don't exist)
  // ---------------------------------------------------------------------------

  it('should fail with FK violation when machines do NOT exist', async () => {
    // Arrange: empty database (no machines)

    // Act: run seedSensors without seeding machines first
    const result = await Effect.runPromiseExit(
      seedSensors.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect fails with SqlError (FK violation)
    expect(Exit.isFailure(result)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Idempotency
  // ---------------------------------------------------------------------------

  it('should be idempotent - no error on duplicate run', async () => {
    // Arrange: seed full hierarchy + sensors once
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )
    await Effect.runPromise(
      seedLines.pipe(Effect.provide(SeedTestLayer))
    )
    await Effect.runPromise(
      seedMachines.pipe(Effect.provide(SeedTestLayer))
    )
    await Effect.runPromise(
      seedSensors.pipe(Effect.provide(SeedTestLayer))
    )

    // Act: run seedSensors again
    const result = await Effect.runPromiseExit(
      seedSensors.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect succeeds
    expect(Exit.isSuccess(result)).toBe(true)

    // Assert: count unchanged
    const sensors = await Effect.runPromise(
      Effect.gen(function* () {
        const sensorRepo = yield* SensorRepo
        const all = yield* sensorRepo.findAll()
        return all.filter(s =>
          s.deviceId.startsWith('TMP-') ||
          s.deviceId.startsWith('VIB-') ||
          s.deviceId.startsWith('HUM-') ||
          s.deviceId.startsWith('SPD-') ||
          s.deviceId.startsWith('CUR-')
        )
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(sensors.length).toBe(mockSensorInserts.length)
  })
})

// =============================================================================
// seedAssets (Composed) Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('seedAssets (composed)', () => {
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
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
    await Effect.runPromise(
      cleanMockAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanMockAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Full Hierarchy Creation
  // ---------------------------------------------------------------------------

  it('should create full hierarchy from empty database', async () => {
    // Act: run composed seedAssets
    await Effect.runPromise(
      seedAssets.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: verify all entity counts
    const counts = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const lineRepo = yield* LineRepo
        const machineRepo = yield* MachineRepo
        const sensorRepo = yield* SensorRepo

        const plants = yield* plantRepo.findAll()
        const lines = yield* lineRepo.findAll()
        const machines = yield* machineRepo.findAll()
        const sensors = yield* sensorRepo.findAll()

        return {
          plants: plants.filter(p => p.id.startsWith('MOCK-')).length,
          lines: lines.filter(l => l.id.startsWith('MOCK-')).length,
          machines: machines.filter(m => m.id.startsWith('MOCK-')).length,
          sensors: sensors.filter(s =>
            s.deviceId.startsWith('TMP-') ||
            s.deviceId.startsWith('VIB-') ||
            s.deviceId.startsWith('HUM-') ||
            s.deviceId.startsWith('SPD-') ||
            s.deviceId.startsWith('CUR-')
          ).length,
        }
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(counts.plants).toBe(mockPlantInserts.length)
    expect(counts.lines).toBe(mockLineInserts.length)
    expect(counts.machines).toBe(mockMachineInserts.length)
    expect(counts.sensors).toBe(mockSensorInserts.length)
  })

  // ---------------------------------------------------------------------------
  // FK Integrity (JOIN test)
  // ---------------------------------------------------------------------------

  it('should maintain FK integrity across all entities', async () => {
    // Act
    await Effect.runPromise(
      seedAssets.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: verify FK relationships via JOIN query
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sql = yield* PgClient.PgClient
        // Query that JOINs sensors -> machines -> lines -> plants
        const rows = yield* sql<{
          deviceId: string
          machineId: string
          lineId: string
          plantId: string
        }>`
          SELECT s.device_id as "deviceId", m.id as "machineId", l.id as "lineId", p.id as "plantId"
          FROM iiot.sensors s
          JOIN iiot.machines m ON s.machine_id = m.id
          JOIN iiot.lines l ON m.line_id = l.id
          JOIN iiot.plants p ON l.plant_id = p.id
          WHERE s.device_id IN ('TMP-001', 'VIB-001', 'TMP-002', 'VIB-002', 'TMP-003', 'HUM-001', 'SPD-001', 'CUR-001')
        `
        return rows.length
      }).pipe(Effect.provide(TestPgClientWithMigrations))
    )

    // All sensors should have valid FK chain
    expect(result).toBe(mockSensorInserts.length)
  })

  // ---------------------------------------------------------------------------
  // Idempotency (Full Run)
  // ---------------------------------------------------------------------------

  it('should be idempotent - full run twice without error', async () => {
    // First run
    await Effect.runPromise(
      seedAssets.pipe(Effect.provide(SeedTestLayer))
    )

    // Second run - should not throw
    const result = await Effect.runPromiseExit(
      seedAssets.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect succeeds
    expect(Exit.isSuccess(result)).toBe(true)

    // Assert: counts unchanged
    const counts = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const lineRepo = yield* LineRepo
        const machineRepo = yield* MachineRepo
        const sensorRepo = yield* SensorRepo

        const plants = yield* plantRepo.findAll()
        const lines = yield* lineRepo.findAll()
        const machines = yield* machineRepo.findAll()
        const sensors = yield* sensorRepo.findAll()

        return {
          plants: plants.filter(p => p.id.startsWith('MOCK-')).length,
          lines: lines.filter(l => l.id.startsWith('MOCK-')).length,
          machines: machines.filter(m => m.id.startsWith('MOCK-')).length,
          sensors: sensors.filter(s =>
            s.deviceId.startsWith('TMP-') ||
            s.deviceId.startsWith('VIB-') ||
            s.deviceId.startsWith('HUM-') ||
            s.deviceId.startsWith('SPD-') ||
            s.deviceId.startsWith('CUR-')
          ).length,
        }
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(counts.plants).toBe(mockPlantInserts.length)
    expect(counts.lines).toBe(mockLineInserts.length)
    expect(counts.machines).toBe(mockMachineInserts.length)
    expect(counts.sensors).toBe(mockSensorInserts.length)
  })

  // ---------------------------------------------------------------------------
  // Partial Pre-existing State
  // ---------------------------------------------------------------------------

  it('should handle partial pre-existing state (plants only)', async () => {
    // Arrange: pre-seed only plants
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )

    // Act: run full seedAssets
    const result = await Effect.runPromiseExit(
      seedAssets.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect succeeds
    expect(Exit.isSuccess(result)).toBe(true)

    // Assert: all entities exist, plants not duplicated
    const counts = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const lineRepo = yield* LineRepo
        const machineRepo = yield* MachineRepo
        const sensorRepo = yield* SensorRepo

        const plants = yield* plantRepo.findAll()
        const lines = yield* lineRepo.findAll()
        const machines = yield* machineRepo.findAll()
        const sensors = yield* sensorRepo.findAll()

        return {
          plants: plants.filter(p => p.id.startsWith('MOCK-')).length,
          lines: lines.filter(l => l.id.startsWith('MOCK-')).length,
          machines: machines.filter(m => m.id.startsWith('MOCK-')).length,
          sensors: sensors.filter(s =>
            s.deviceId.startsWith('TMP-') ||
            s.deviceId.startsWith('VIB-') ||
            s.deviceId.startsWith('HUM-') ||
            s.deviceId.startsWith('SPD-') ||
            s.deviceId.startsWith('CUR-')
          ).length,
        }
      }).pipe(Effect.provide(SeedTestLayer))
    )

    // Plants should NOT be duplicated
    expect(counts.plants).toBe(mockPlantInserts.length)
    expect(counts.lines).toBe(mockLineInserts.length)
    expect(counts.machines).toBe(mockMachineInserts.length)
    expect(counts.sensors).toBe(mockSensorInserts.length)
  })

  // ---------------------------------------------------------------------------
  // Partial Pre-existing State (plants + lines)
  // ---------------------------------------------------------------------------

  it('should handle partial pre-existing state (plants + lines)', async () => {
    // Arrange: pre-seed plants and lines
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(SeedTestLayer))
    )
    await Effect.runPromise(
      seedLines.pipe(Effect.provide(SeedTestLayer))
    )

    // Act: run full seedAssets
    const result = await Effect.runPromiseExit(
      seedAssets.pipe(Effect.provide(SeedTestLayer))
    )

    // Assert: Effect succeeds
    expect(Exit.isSuccess(result)).toBe(true)

    // Assert: all entities exist, none duplicated
    const counts = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const lineRepo = yield* LineRepo
        const machineRepo = yield* MachineRepo
        const sensorRepo = yield* SensorRepo

        const plants = yield* plantRepo.findAll()
        const lines = yield* lineRepo.findAll()
        const machines = yield* machineRepo.findAll()
        const sensors = yield* sensorRepo.findAll()

        return {
          plants: plants.filter(p => p.id.startsWith('MOCK-')).length,
          lines: lines.filter(l => l.id.startsWith('MOCK-')).length,
          machines: machines.filter(m => m.id.startsWith('MOCK-')).length,
          sensors: sensors.filter(s =>
            s.deviceId.startsWith('TMP-') ||
            s.deviceId.startsWith('VIB-') ||
            s.deviceId.startsWith('HUM-') ||
            s.deviceId.startsWith('SPD-') ||
            s.deviceId.startsWith('CUR-')
          ).length,
        }
      }).pipe(Effect.provide(SeedTestLayer))
    )

    expect(counts.plants).toBe(mockPlantInserts.length)
    expect(counts.lines).toBe(mockLineInserts.length)
    expect(counts.machines).toBe(mockMachineInserts.length)
    expect(counts.sensors).toBe(mockSensorInserts.length)
  })
})
