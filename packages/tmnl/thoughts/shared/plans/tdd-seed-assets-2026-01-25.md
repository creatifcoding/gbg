# TDD Test Plan: seedAssets Composed Function

Generated: 2026-01-25

## Goal

Design a comprehensive TDD approach for the `seedAssets` function that composes individual asset seeders (Plants, Lines, Machines, Sensors) with proper FK ordering and idempotency guarantees.

## Architecture Summary

### Target Structure

```typescript
// Individual seeders (testable units)
const seedPlants: Effect<void, SeedError, PlantRepo>
const seedLines: Effect<void, SeedError, PlantRepo | LineRepo>
const seedMachines: Effect<void, SeedError, LineRepo | MachineRepo>
const seedSensors: Effect<void, SeedError, MachineRepo | SensorRepo>

// Composed function
export const seedAssets: Effect<void, SeedError, PlantRepo | LineRepo | MachineRepo | SensorRepo>
```

### FK Dependency Chain

```
Plants (no FK) --> Lines (FK: plantId) --> Machines (FK: lineId) --> Sensors (FK: machineId)
```

### Idempotency Strategy

Catch duplicate key errors (PostgreSQL error code `23505`) gracefully using `Effect.catchTag` or pattern matching on `SqlError`.

---

## Test Behaviors

### 1. Individual Seeder Tests (Unit-like)

Each seeder should be tested in isolation with its parent dependencies pre-seeded.

#### 1.1 seedPlants

| Behavior | Description | Test Type |
|----------|-------------|-----------|
| **Happy path: inserts all plants** | Given empty plants table, when seedPlants runs, then all mockPlantInserts are persisted | Integration |
| **Idempotent: duplicate IDs ignored** | Given plants already exist, when seedPlants runs again, then no error and count unchanged | Integration |
| **Returns void on success** | Given valid inserts, when seedPlants completes, then Effect succeeds with void | Integration |
| **Requires PlantRepo** | seedPlants has `R = PlantRepo` in its type signature | Type-level |

#### 1.2 seedLines

| Behavior | Description | Test Type |
|----------|-------------|-----------|
| **Happy path: inserts all lines** | Given plants exist + empty lines table, when seedLines runs, then all mockLineInserts persisted | Integration |
| **Idempotent: duplicate IDs ignored** | Given lines already exist, when seedLines runs again, then no error | Integration |
| **FK violation without plants** | Given NO plants exist, when seedLines runs, then fails with SqlError (FK violation) | Integration |
| **Requires LineRepo** | seedLines has `R = LineRepo` in type signature | Type-level |

#### 1.3 seedMachines

| Behavior | Description | Test Type |
|----------|-------------|-----------|
| **Happy path: inserts all machines** | Given lines exist + empty machines table, when seedMachines runs, then all mockMachineInserts persisted | Integration |
| **Idempotent: duplicate IDs ignored** | Given machines already exist, when seedMachines runs again, then no error | Integration |
| **FK violation without lines** | Given NO lines exist, when seedMachines runs, then fails with SqlError (FK violation) | Integration |
| **Requires MachineRepo** | seedMachines has `R = MachineRepo` in type signature | Type-level |

#### 1.4 seedSensors

| Behavior | Description | Test Type |
|----------|-------------|-----------|
| **Happy path: inserts all sensors** | Given machines exist + empty sensors table, when seedSensors runs, then all mockSensorInserts persisted | Integration |
| **Idempotent: duplicate deviceIds ignored** | Given sensors already exist, when seedSensors runs again, then no error | Integration |
| **FK violation without machines** | Given NO machines exist, when seedSensors runs, then fails with SqlError (FK violation) | Integration |
| **Requires SensorRepo** | seedSensors has `R = SensorRepo` in type signature | Type-level |

---

### 2. Composed seedAssets Tests (Integration)

The composed function tests verify correct orchestration.

| Behavior | Description | Verification |
|----------|-------------|--------------|
| **Sequential execution order** | Plants seed before Lines, Lines before Machines, Machines before Sensors | Verify by running against empty DB - all entities created |
| **Full hierarchy created** | Given empty database, when seedAssets runs, then all 4 entity types exist with correct counts | Query counts after run |
| **FK integrity maintained** | All FKs resolve correctly (lineId -> line exists, etc.) | JOIN queries return expected associations |
| **Idempotent full run** | Given already-seeded database, when seedAssets runs again, then no errors and counts unchanged | Run twice, compare counts |
| **Partial failure recovery** | Given plants + lines exist but machines fail (simulated), subsequent seedAssets completes machines + sensors | Requires mock/spy or staged execution |
| **Provides all repos in R** | seedAssets has `R = PlantRepo | LineRepo | MachineRepo | SensorRepo` | Type-level verification |

---

### 3. Edge Cases

| Edge Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| **Empty mock arrays** | mockPlantInserts = [] | seedPlants succeeds (no-op), no error |
| **Single item arrays** | Each mock array has 1 item | Works correctly with minimal data |
| **Database unavailable** | SqlClient not connected | Fails with SqlError, not silent failure |
| **Partial duplicate state** | Some plants exist, some don't | New ones inserted, existing ones skipped |
| **Concurrent execution** | Two seedAssets calls simultaneously | Both succeed (idempotency handles race) |
| **Transaction boundary** | Mid-seeder failure | Depends on impl - document expected behavior |

---

## Test Structure

### File Organization

```
src/lib/iiot/__tests__/
|-- seed/
|   |-- seed-plants.integration.test.ts
|   |-- seed-lines.integration.test.ts
|   |-- seed-machines.integration.test.ts
|   |-- seed-sensors.integration.test.ts
|   +-- seed-assets.integration.test.ts   # Composed function
+-- integration/
    +-- layer.ts                          # Existing test infrastructure
```

### Test Layer Setup

```typescript
// Reuse existing infrastructure
import {
  TestPgClient,
  AssetRepositoriesIntegrationLayer,
  cleanTestAssets,
  isDatabaseAvailable,
} from '../integration/layer'
```

### Test Fixtures

Use `mockPlantInserts`, `mockLineInserts`, `mockMachineInserts`, `mockSensorInserts` from `mock-data.ts` BUT with `SEED-` prefix for test isolation (instead of `MOCK-` which is production mock data).

**Alternative:** Create dedicated test fixtures in `__fixtures__/seed-fixtures.ts` using `TEST-SEED-` prefix.

---

## Detailed Test Specifications

### Test: seedPlants

```typescript
// seed-plants.integration.test.ts

describe.skipIf(!RUN_INTEGRATION)('seedPlants', () => {
  beforeEach(async () => {
    await Effect.runPromise(cleanSeedTestData.pipe(Effect.provide(TestPgClient)))
  })

  it('should insert all mock plants into empty table', async () => {
    // Arrange: empty database (beforeEach handles)
    // Act: run seedPlants
    // Assert: PlantRepo.findAll() returns mockPlantInserts.length items
  })

  it('should be idempotent - no error on duplicate run', async () => {
    // Arrange: run seedPlants once
    // Act: run seedPlants again
    // Assert: Effect succeeds, count unchanged
  })

  it('should handle SqlError for unique constraint violation gracefully', async () => {
    // Arrange: manually insert one plant
    // Act: run seedPlants (includes that plant ID)
    // Assert: Effect succeeds (error caught internally)
  })
})
```

### Test: seedLines

```typescript
// seed-lines.integration.test.ts

describe.skipIf(!RUN_INTEGRATION)('seedLines', () => {
  beforeEach(async () => {
    await Effect.runPromise(cleanSeedTestData.pipe(Effect.provide(TestPgClient)))
    // Pre-seed plants (FK dependency)
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )
  })

  it('should insert all mock lines when plants exist', async () => {
    // Act: run seedLines
    // Assert: LineRepo.findAll() returns mockLineInserts.length items
  })

  it('should fail with FK violation when plants do NOT exist', async () => {
    // Arrange: clean database (no plants)
    await Effect.runPromise(cleanSeedTestData.pipe(Effect.provide(TestPgClient)))
    // Act: run seedLines
    // Assert: Effect fails with SqlError
  })

  it('should be idempotent', async () => {
    // Run twice, verify no error
  })
})
```

### Test: seedAssets (Composed)

```typescript
// seed-assets.integration.test.ts

describe.skipIf(!RUN_INTEGRATION)('seedAssets (composed)', () => {
  beforeEach(async () => {
    await Effect.runPromise(cleanSeedTestData.pipe(Effect.provide(TestPgClient)))
  })

  it('should create full hierarchy from empty database', async () => {
    // Act
    await Effect.runPromise(
      seedAssets.pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    // Assert - verify all entity counts
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
          sensors: sensors.filter(s => s.deviceId.startsWith('TMP-') || s.deviceId.startsWith('VIB-')).length,
        }
      }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    expect(counts.plants).toBe(mockPlantInserts.length)
    expect(counts.lines).toBe(mockLineInserts.length)
    expect(counts.machines).toBe(mockMachineInserts.length)
    expect(counts.sensors).toBe(mockSensorInserts.length)
  })

  it('should maintain FK integrity across all entities', async () => {
    // Act
    await Effect.runPromise(
      seedAssets.pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    // Assert - verify FK relationships via joins
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        // Query that JOINs sensors -> machines -> lines -> plants
        const rows = yield* sql`
          SELECT s.device_id, m.id as machine_id, l.id as line_id, p.id as plant_id
          FROM iiot.sensors s
          JOIN iiot.machines m ON s.machine_id = m.id
          JOIN iiot.lines l ON m.line_id = l.id
          JOIN iiot.plants p ON l.plant_id = p.id
          WHERE s.device_id LIKE 'TMP-%' OR s.device_id LIKE 'VIB-%'
        `
        return rows.length
      }).pipe(Effect.provide(TestPgClient))
    )

    // All sensors should have valid FK chain
    expect(result).toBe(mockSensorInserts.length)
  })

  it('should be idempotent - full run twice without error', async () => {
    // First run
    await Effect.runPromise(
      seedAssets.pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    // Second run - should not throw
    await Effect.runPromise(
      seedAssets.pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    // Counts should be unchanged
    // (verify counts match mockXxxInserts.length)
  })

  it('should handle partial pre-existing state', async () => {
    // Arrange: pre-seed only plants
    await Effect.runPromise(
      seedPlants.pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    // Act: run full seedAssets
    await Effect.runPromise(
      seedAssets.pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
    )

    // Assert: all entities exist, plants not duplicated
  })
})
```

---

## Error Handling Pattern

### Idempotency via Effect.catchTag

The individual seeders should catch unique constraint violations:

```typescript
// Pattern for each seeder
const seedPlants = Effect.gen(function* () {
  const repo = yield* PlantRepo
  for (const plant of mockPlantInserts) {
    yield* repo.insert(plant).pipe(
      Effect.catchIf(
        (e): e is SqlError.SqlError =>
          SqlError.isSqlError(e) && e.code === '23505', // unique_violation
        () => Effect.void // swallow duplicate key error
      )
    )
  }
})
```

### Alternative: ON CONFLICT DO NOTHING

If the repo supports upsert semantics, the SQL layer handles idempotency:

```sql
INSERT INTO iiot.plants (id, name, location)
VALUES ($1, $2, $3)
ON CONFLICT (id) DO NOTHING
RETURNING ...
```

**Decision:** TDD should test BOTH patterns - the test verifies behavior, not implementation.

---

## Test Execution Order

1. **Write failing tests first** (Red)
2. **Implement seedPlants** (Green)
3. **Refactor if needed**
4. **Repeat for seedLines, seedMachines, seedSensors**
5. **Write composed seedAssets tests** (Red)
6. **Implement composition** (Green)
7. **Integration tests for full flow**

---

## Acceptance Criteria

### For Individual Seeders

- [ ] Happy path inserts all entities
- [ ] Idempotent on duplicate run
- [ ] Type signature exposes correct repo dependency
- [ ] Fails appropriately when FK dependency missing

### For Composed seedAssets

- [ ] Creates full hierarchy from empty database
- [ ] Maintains FK integrity
- [ ] Idempotent across multiple runs
- [ ] Handles partial pre-existing state
- [ ] Sequential ordering proven by FK success

---

## Dependencies

| Dependency | Location | Purpose |
|------------|----------|---------|
| `AssetRepositoriesIntegrationLayer` | `__tests__/integration/layer.ts` | Test layer with repos |
| `cleanTestAssets` | `__tests__/integration/layer.ts` | Cleanup utility |
| `mockPlantInserts` et al. | `seed/mock-data.ts` | Test fixtures |
| `PlantRepo`, `LineRepo`, etc. | `repos/index.ts` | Repository services |

---

## Risks and Considerations

1. **Test data isolation**: Use `MOCK-` prefix consistently; `cleanTestAssets` currently cleans `TEST-` prefix
2. **Shared mock data**: `mockPlantInserts` is also used by `seedAll` - ensure test runs don't pollute production seed data
3. **Transaction scope**: Individual inserts in a loop may not be atomic - document expected behavior for partial failures
4. **Test parallelism**: Vitest runs tests in parallel - ensure test isolation via unique prefixes or sequential mode

---

## Estimated Complexity

| Component | Complexity | Reasoning |
|-----------|------------|-----------|
| seedPlants | Low | No FK dependencies, simple loop + catch |
| seedLines | Medium | FK ordering matters, requires parent setup |
| seedMachines | Medium | Same as seedLines |
| seedSensors | Medium | Same pattern, different PK (deviceId) |
| seedAssets composition | Low | Just `Effect.andThen` chain |
| Test infrastructure | Medium | Cleanup utilities, layer setup |

**Total estimated effort:** 2-3 hours for full TDD cycle

---

## Next Steps

1. Create `src/lib/iiot/__tests__/seed/` directory
2. Write `seed-plants.integration.test.ts` with failing tests
3. Implement `seedPlants` in `mock-data.ts`
4. Iterate through remaining seeders
5. Compose and test `seedAssets`
