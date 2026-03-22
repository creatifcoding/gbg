/**
 * IIoT Asset Repository Integration Tests
 *
 * Tests for PlantRepo, LineRepo, MachineRepo, SensorRepo against real PostgreSQL.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test src/lib/iiot/__tests__/repos/assets.integration.test.ts
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Effect, Option, DateTime } from 'effect'
import {
  TestPgClient,
  AssetRepositoriesIntegrationLayer,
  cleanTestAssets,
  setupTestHierarchy,
  isDatabaseAvailable,
} from '../integration/layer'
import { PlantRepo, LineRepo, MachineRepo, SensorRepo } from '../../repos'
import {
  testIds,
  testPlant1Insert,
  testPlant2Insert,
  testLine1Insert,
  testLine2Insert,
  testMachine1Insert,
  testMachine2Insert,
  testSensor1Insert,
  testSensor2Insert,
  testPlant1Update,
  testMachine1Update,
  testSensor1Update,
} from '../__fixtures__/fixtures'
import type { PlantId, LineId, MachineId } from '../../schemas/identifiers'

const RUN_INTEGRATION = process.env['RUN_INTEGRATION_TESTS'] === '1'

// =============================================================================
// PlantRepo Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('PlantRepo Integration', () => {
  beforeAll(async () => {
    const available = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(TestPgClient))
    )
    if (!available) {
      throw new Error(
        'Database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }
    // Setup FK parent records (Enterprise, Site, Area) in iiot_mock
    await Effect.runPromise(
      setupTestHierarchy.pipe(Effect.provide(TestPgClient))
    )
  })

  beforeEach(async () => {
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
    // Re-create hierarchy after clean (cleanTestAssets deletes Enterprise/Site/Area too)
    await Effect.runPromise(
      setupTestHierarchy.pipe(Effect.provide(TestPgClient))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Insert Tests
  // ---------------------------------------------------------------------------

  it('should insert a plant with all fields', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        return yield* plantRepo.insert(testPlant1Insert)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.id).toBe(testIds.plant1)
    expect(result.name).toBe('Test Plant Alpha')
    expect(Option.isSome(result.location)).toBe(true)
    expect(Option.getOrNull(result.location)).toBe('Test Location A')
    expect(DateTime.isDateTime(result.createdAt)).toBe(true)
    // updatedAt is Option<Date> - should be None on initial insert
    expect(Option.isNone(result.updatedAt)).toBe(true)
  })

  it('should insert a plant with optional location as None', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        return yield* plantRepo.insert(testPlant2Insert)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.id).toBe(testIds.plant2)
    expect(result.name).toBe('Test Plant Beta')
    expect(Option.isNone(result.location)).toBe(true)
  })

  it('should fail to insert duplicate plant ID', async () => {
    const result = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        yield* plantRepo.insert(testPlant1Insert)
        yield* plantRepo.insert(testPlant1Insert) // Duplicate
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result._tag).toBe('Failure')
  })

  // ---------------------------------------------------------------------------
  // FindById Tests
  // ---------------------------------------------------------------------------

  it('should find plant by ID', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        yield* plantRepo.insert(testPlant1Insert)
        return yield* plantRepo.findById(testIds.plant1)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
    const plant = Option.getOrThrow(result)
    expect(plant.id).toBe(testIds.plant1)
    expect(plant.name).toBe('Test Plant Alpha')
  })

  it('should return None for non-existent plant', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        return yield* plantRepo.findById(testIds.nonExistentPlant)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(Option.isNone(result)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // FindAll Tests
  // ---------------------------------------------------------------------------

  it('should return empty array when no plants exist', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const all = yield* plantRepo.findAll()
        // Filter to only TEST- prefixed plants (may have other data)
        return all.filter(p => p.id.startsWith('TEST-'))
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result).toEqual([])
  })

  it('should find all plants ordered by name', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        yield* plantRepo.insert(testPlant2Insert) // Beta first
        yield* plantRepo.insert(testPlant1Insert) // Alpha second
        const all = yield* plantRepo.findAll()
        return all.filter(p => p.id.startsWith('TEST-'))
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(2)
    // Should be ordered by name: Alpha before Beta
    expect(result[0].name).toBe('Test Plant Alpha')
    expect(result[1].name).toBe('Test Plant Beta')
  })

  // ---------------------------------------------------------------------------
  // Update Tests
  // ---------------------------------------------------------------------------

  it('should update plant fields', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        yield* plantRepo.insert(testPlant1Insert)
        return yield* plantRepo.update(testPlant1Update)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.id).toBe(testIds.plant1)
    expect(result.name).toBe('Updated Plant Alpha')
    expect(Option.getOrNull(result.location)).toBe('Updated Location')
  })

  it('should update only provided fields (partial update)', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        yield* plantRepo.insert(testPlant1Insert)
        // Update only name, location should remain
        return yield* plantRepo.update({
          id: testIds.plant1,
          name: 'Partial Update',
        })
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.name).toBe('Partial Update')
    // Location should be unchanged
    expect(Option.getOrNull(result.location)).toBe('Test Location A')
  })

  // ---------------------------------------------------------------------------
  // Delete Tests
  // ---------------------------------------------------------------------------

  it('should delete plant', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        yield* plantRepo.insert(testPlant1Insert)
        yield* plantRepo.delete(testIds.plant1)
        return yield* plantRepo.findById(testIds.plant1)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(Option.isNone(result)).toBe(true)
  })

  it('should not error when deleting non-existent plant', async () => {
    // This should not throw
    await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        yield* plantRepo.delete(testIds.nonExistentPlant)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )
  })
})

// =============================================================================
// LineRepo Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('LineRepo Integration', () => {
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
    // Re-create hierarchy after clean
    await Effect.runPromise(
      setupTestHierarchy.pipe(Effect.provide(TestPgClient))
    )
    // Insert parent plant for FK constraints
    await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        yield* plantRepo.insert(testPlant1Insert)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Insert Tests
  // ---------------------------------------------------------------------------

  it('should insert a line with valid plant FK', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const lineRepo = yield* LineRepo
        return yield* lineRepo.insert(testLine1Insert)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.id).toBe(testIds.line1)
    expect(result.name).toBe('Test Line One')
    expect(result.plantId).toBe(testIds.plant1)
  })

  it('should fail to insert line with invalid plant FK', async () => {
    const result = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const lineRepo = yield* LineRepo
        yield* lineRepo.insert({
          ...testLine1Insert,
          plantId: testIds.nonExistentPlant,
        })
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result._tag).toBe('Failure')
  })

  // ---------------------------------------------------------------------------
  // FindByPlant Tests
  // ---------------------------------------------------------------------------

  it('should find lines by plant ID', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const lineRepo = yield* LineRepo
        yield* lineRepo.insert(testLine1Insert)
        yield* lineRepo.insert(testLine2Insert)
        return yield* lineRepo.findByPlant(testIds.plant1)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(2)
    expect(result.map(l => l.id)).toContain(testIds.line1)
    expect(result.map(l => l.id)).toContain(testIds.line2)
  })

  it('should return empty array for plant with no lines', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const lineRepo = yield* LineRepo
        return yield* lineRepo.findByPlant(testIds.plant1)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result).toEqual([])
  })

  // ---------------------------------------------------------------------------
  // FindById Tests
  // ---------------------------------------------------------------------------

  it('should find line by ID', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const lineRepo = yield* LineRepo
        yield* lineRepo.insert(testLine1Insert)
        return yield* lineRepo.findById(testIds.line1)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
  })

  it('should return None for non-existent line', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const lineRepo = yield* LineRepo
        return yield* lineRepo.findById(testIds.nonExistentLine)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(Option.isNone(result)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Cascade Behavior Tests
  // ---------------------------------------------------------------------------

  it('should cascade delete lines when plant is deleted (ON DELETE CASCADE)', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const lineRepo = yield* LineRepo
        yield* lineRepo.insert(testLine1Insert)
        yield* plantRepo.delete(testIds.plant1) // Cascades to delete lines
        // Verify line was cascade deleted
        return yield* lineRepo.findById(testIds.line1)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    // Line should be deleted via cascade
    expect(Option.isNone(result)).toBe(true)
  })
})

// =============================================================================
// MachineRepo Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('MachineRepo Integration', () => {
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
    // Re-create hierarchy after clean
    await Effect.runPromise(
      setupTestHierarchy.pipe(Effect.provide(TestPgClient))
    )
    // Insert parent hierarchy: Plant -> Line
    await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const lineRepo = yield* LineRepo
        yield* plantRepo.insert(testPlant1Insert)
        yield* lineRepo.insert(testLine1Insert)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Insert Tests
  // ---------------------------------------------------------------------------

  it('should insert a machine with modelNumber field', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const machineRepo = yield* MachineRepo
        return yield* machineRepo.insert(testMachine1Insert)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.id).toBe(testIds.machine1)
    expect(result.name).toBe('Test Machine Alpha')
    expect(Option.isSome(result.modelNumber)).toBe(true)
    expect(Option.getOrNull(result.modelNumber)).toBe('Model X-100')
    expect(result.lineId).toBe(testIds.line1)
  })

  it('should insert a machine without modelNumber (optional field)', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const machineRepo = yield* MachineRepo
        return yield* machineRepo.insert(testMachine2Insert)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.id).toBe(testIds.machine2)
    expect(Option.isNone(result.modelNumber)).toBe(true)
  })

  it('should fail to insert machine with invalid line FK', async () => {
    const result = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const machineRepo = yield* MachineRepo
        yield* machineRepo.insert({
          ...testMachine1Insert,
          lineId: testIds.nonExistentLine,
        })
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result._tag).toBe('Failure')
  })

  // ---------------------------------------------------------------------------
  // FindByLine Tests
  // ---------------------------------------------------------------------------

  it('should find machines by line ID', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const machineRepo = yield* MachineRepo
        yield* machineRepo.insert(testMachine1Insert)
        yield* machineRepo.insert(testMachine2Insert)
        return yield* machineRepo.findByLine(testIds.line1)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(2)
  })

  // ---------------------------------------------------------------------------
  // Update Tests
  // ---------------------------------------------------------------------------

  it('should update machine name field', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const machineRepo = yield* MachineRepo
        yield* machineRepo.insert(testMachine1Insert)
        return yield* machineRepo.update(testMachine1Update)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.name).toBe('Updated Machine Alpha')
    // modelNumber should remain unchanged from insert
    expect(Option.getOrNull(result.modelNumber)).toBe('Model X-100')
  })
})

// =============================================================================
// SensorRepo Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('SensorRepo Integration', () => {
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
    // Re-create hierarchy after clean
    await Effect.runPromise(
      setupTestHierarchy.pipe(Effect.provide(TestPgClient))
    )
    // Insert parent hierarchy: Plant -> Line -> Machine
    await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        const lineRepo = yield* LineRepo
        const machineRepo = yield* MachineRepo
        yield* plantRepo.insert(testPlant1Insert)
        yield* lineRepo.insert(testLine1Insert)
        yield* machineRepo.insert(testMachine1Insert)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanTestAssets.pipe(Effect.provide(TestPgClient))
    )
  })

  // ---------------------------------------------------------------------------
  // Insert Tests
  // ---------------------------------------------------------------------------

  it('should insert a sensor with deviceId as PK', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sensorRepo = yield* SensorRepo
        return yield* sensorRepo.insert(testSensor1Insert)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.deviceId).toBe(testIds.device1)
    expect(result.type).toBe('temperature')
    expect(result.unit).toBe('celsius')
    expect(result.machineId).toBe(testIds.machine1)
  })

  it('should fail to insert duplicate deviceId', async () => {
    const result = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const sensorRepo = yield* SensorRepo
        yield* sensorRepo.insert(testSensor1Insert)
        yield* sensorRepo.insert(testSensor1Insert) // Duplicate
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result._tag).toBe('Failure')
  })

  it('should fail to insert sensor with invalid machine FK', async () => {
    const result = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const sensorRepo = yield* SensorRepo
        yield* sensorRepo.insert({
          ...testSensor1Insert,
          machineId: testIds.nonExistentMachine,
        })
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result._tag).toBe('Failure')
  })

  // ---------------------------------------------------------------------------
  // FindByDeviceId Tests
  // ---------------------------------------------------------------------------

  it('should find sensor by deviceId', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sensorRepo = yield* SensorRepo
        yield* sensorRepo.insert(testSensor1Insert)
        return yield* sensorRepo.findByDeviceId(testIds.device1)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result)).toBe(true)
    const sensor = Option.getOrThrow(result)
    expect(sensor.deviceId).toBe(testIds.device1)
  })

  it('should return None for non-existent deviceId', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sensorRepo = yield* SensorRepo
        return yield* sensorRepo.findByDeviceId(testIds.nonExistentDevice)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(Option.isNone(result)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // FindByMachine Tests
  // ---------------------------------------------------------------------------

  it('should find sensors by machine ID', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sensorRepo = yield* SensorRepo
        yield* sensorRepo.insert(testSensor1Insert)
        yield* sensorRepo.insert(testSensor2Insert)
        return yield* sensorRepo.findByMachine(testIds.machine1)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.length).toBe(2)
    expect(result.map(s => s.deviceId)).toContain(testIds.device1)
    expect(result.map(s => s.deviceId)).toContain(testIds.device2)
  })

  // ---------------------------------------------------------------------------
  // Update Tests
  // ---------------------------------------------------------------------------

  it('should update sensor type and unit', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sensorRepo = yield* SensorRepo
        yield* sensorRepo.insert(testSensor1Insert)
        return yield* sensorRepo.update(testSensor1Update)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(result.type).toBe('humidity')
    expect(result.unit).toBe('percent')
    // machineId should be unchanged
    expect(result.machineId).toBe(testIds.machine1)
  })

  // ---------------------------------------------------------------------------
  // Delete Tests
  // ---------------------------------------------------------------------------

  it('should delete sensor by deviceId', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sensorRepo = yield* SensorRepo
        yield* sensorRepo.insert(testSensor1Insert)
        yield* sensorRepo.delete(testIds.device1)
        return yield* sensorRepo.findByDeviceId(testIds.device1)
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(Option.isNone(result)).toBe(true)
  })
})
