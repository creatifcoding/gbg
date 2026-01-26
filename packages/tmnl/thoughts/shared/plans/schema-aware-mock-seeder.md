# Implementation Plan: Schema-Aware Mock Data Seeder

Generated: 2026-01-25

## Goal

Transform `src/lib/iiot/seed/mock-data.ts` from raw SQL strings with hardcoded values into a schema-aware seeder that leverages Effect Schema validation and Model definitions while maintaining performance for bulk operations (700K+ rows).

## Research Summary

### Findings from deepwiki (@effect/sql)

1. **Model.insert Schema**: `Model.Class` automatically generates `Model.insert` schema that enforces validation. Using `Model.makeDataLoaders` provides batched inserts but still validates each row.

2. **sql.insert with Arrays**: The `sql.insert` helper accepts arrays of objects for bulk inserts, generating efficient multi-value INSERT statements. This bypasses Schema validation but maintains type safety through TypeScript.

3. **Performance Trade-off**: For 700K+ rows:
   - `Model.makeDataLoaders` with batching: Still validates each row - significant overhead
   - Direct `sql.insert(arrayOfObjects)`: Bypasses validation, maximum performance
   - PostgreSQL `generate_series`: Server-side generation - fastest for synthetic data

4. **Recommended Pattern**: Hybrid approach:
   - Asset data (small counts): Full Schema validation via repos
   - Sensor readings (700K rows): Typed helpers without runtime validation
   - Use TypeScript types derived from Model.insert for compile-time safety

### Key Code Patterns from Submodules

From `@effect/sql` test suite:
```typescript
// Multi-row insert with sql.insert
sql`INSERT INTO people ${sql.insert([
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 }
])}`

// UNNEST pattern for PostgreSQL (already used in SensorReadingRepo)
sql`INSERT INTO table (col1, col2)
    SELECT * FROM UNNEST(${arr1}::type[], ${arr2}::type[])`
```

## Existing Codebase Analysis

### Schemas Inventory (`src/lib/iiot/schemas/`)

| File | Schemas | Seed Need |
|------|---------|-----------|
| `identifiers.ts` | `PlantId`, `LineId`, `MachineId`, `DeviceId`, `AlarmId` | Branded types for IDs |
| `assets.ts` | `Plant`, `Line`, `Machine`, `Sensor`, `SensorType`, `MeasurementUnit` | Hierarchy seeding |
| `readings.ts` | `SensorReading`, `AggregatedReading`, `AnalyticsRecord`, `QualityScore` | Bulk time-series |
| `alarms.ts` | `Alarm`, `AlarmType`, `AlarmSeverity`, `AlarmContext` | Event seeding |

### Models Inventory (`src/lib/iiot/models/`)

| Model | PK Type | Insert Type Available |
|-------|---------|----------------------|
| `PlantModel` | `PlantId` (GeneratedByApp) | `PlantModel.insert.Type` |
| `LineModel` | `LineId` (GeneratedByApp) | `LineModel.insert.Type` |
| `MachineModel` | `MachineId` (GeneratedByApp) | `MachineModel.insert.Type` |
| `SensorModel` | `DeviceId` (GeneratedByApp) | `SensorModel.insert.Type` |
| `AlarmModel` | `AlarmId` (Generated) | `AlarmModel.insert.Type` |
| `SensorReadingModel` | Composite (time, deviceId) | `SensorReadingModel.insert.Type` |
| `AggregatedReadingModel` | Composite (bucket, deviceId) | Read-only (continuous aggregate) |
| `AnalyticsRecordModel` | Composite (hour, deviceId) | `AnalyticsRecordModel.insert.Type` |

### Repository Inventory (`src/lib/iiot/repos/`)

| Repo | Insert Method | Bulk Support |
|------|--------------|--------------|
| `PlantRepo` | `insert(PlantModel.insert.Type)` | No batch method |
| `LineRepo` | `insert(LineModel.insert.Type)` | No batch method |
| `MachineRepo` | `insert(MachineModel.insert.Type)` | No batch method |
| `SensorRepo` | `insert(SensorModel.insert.Type)` | No batch method |
| `AlarmRepo` | `insert(AlarmModel.insert.Type)` | No batch method |
| `SensorReadingRepo` | `insert` + `insertBatch` | **Yes - UNNEST pattern** |
| `AnalyticsRecordRepo` | `insert` + `insertBatch` | **Yes - UNNEST pattern** |

### Test Fixtures Pattern (`src/lib/iiot/__tests__/__fixtures__/fixtures.ts`)

Existing fixtures use:
- TEST- prefix for isolation
- `Option.some()` / `Option.none()` for optional Model fields
- Direct type assertions (`as PlantId`, `as QualityScore`)
- Plain objects matching `Model.insert.Type` shape

```typescript
export const testPlant1Insert = {
  id: testIds.plant1,
  name: 'Test Plant Alpha' as const,
  location: Option.some('Test Location A'),
}

export const testSensorReadingBatch = [
  { time: now, deviceId: testIds.device1, value: 25.5, quality: 100 as QualityScore },
  // ...
]
```

### Current mock-data.ts Issues

1. **Raw SQL strings**: Bypasses all type safety
2. **String interpolation**: SQL injection risk (though dev-only)
3. **No schema validation**: Invalid data won't be caught
4. **Hardcoded sensor specs**: Not derived from domain types
5. **No reuse of Model.insert types**: Duplicates field knowledge

## Proposed Architecture

### Tiered Approach

```
Tier 1: Schema-Validated via Repos (small counts)
├── Assets: Plant, Line, Machine, Sensor
└── Alarms: ~10 records

Tier 2: Type-Safe Bulk (large counts)
├── SensorReadings: 700K rows via UNNEST
└── AnalyticsRecords: via insertBatch

Tier 3: DB-Generated (performance-critical)
└── generate_series for synthetic timestamps
```

### File Structure

```
src/lib/iiot/seed/
├── mock-data.ts           # Main seeder (orchestrates tiers)
├── definitions/
│   ├── assets.ts          # Asset hierarchy definitions
│   ├── sensors.ts         # Sensor specifications
│   └── alarms.ts          # Alarm scenarios
└── generators/
    ├── readings.ts        # Time-series generators
    └── analytics.ts       # Analytics record generators
```

### Type-Safe Definitions

```typescript
// src/lib/iiot/seed/definitions/sensors.ts
import type { SensorModel } from '../../models/assets/SensorModel'
import type { DeviceId, MachineId } from '../../schemas/identifiers'
import type { SensorType, MeasurementUnit } from '../../schemas/assets'

/** Sensor spec with value range for mock data generation */
export interface SensorSpec {
  // Fields matching SensorModel.insert.Type
  deviceId: DeviceId
  type: SensorType
  unit: MeasurementUnit
  machineId: MachineId
  // Mock generation parameters
  valueRange: { min: number; max: number }
  qualityThreshold: number
  rowCount: 'primary' | 'secondary'
}

// Type-safe sensor definitions
export const sensorSpecs: readonly SensorSpec[] = [
  {
    deviceId: 'TMP-001' as DeviceId,
    type: 'temperature',
    unit: 'celsius',
    machineId: 'MCH-001' as MachineId,
    valueRange: { min: 20, max: 30 },
    qualityThreshold: 0.05,
    rowCount: 'primary',
  },
  // ...
] as const
```

### Hybrid Seeding Functions

```typescript
// src/lib/iiot/seed/mock-data.ts

/**
 * Tier 1: Schema-validated asset seeding via repositories
 *
 * Uses repos for full validation + proper FieldOption handling
 */
export const seedAssets = Effect.gen(function* () {
  const plantRepo = yield* PlantRepo
  const lineRepo = yield* LineRepo
  // ... etc

  // Insert with full schema validation
  for (const plant of assetDefinitions.plants) {
    yield* plantRepo.insert(plant).pipe(
      Effect.catchTag('SqlError', () => Effect.void) // Idempotent
    )
  }
  // ... lines, machines, sensors
})

/**
 * Tier 2: Type-safe bulk seeding via direct SQL
 *
 * Uses Model.insert.Type for compile-time safety,
 * sql.insert for runtime performance
 */
export const seedReadingsBulk = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  for (const spec of sensorSpecs) {
    const rowCount = spec.rowCount === 'primary'
      ? SeedConfig.primarySensorRows
      : SeedConfig.secondarySensorRows

    // Clear existing (idempotency)
    yield* sql`
      DELETE FROM iiot.sensor_readings
      WHERE device_id = ${spec.deviceId}
        AND time > NOW() - INTERVAL '${SeedConfig.timeRangeDays} days'
    `

    // Tier 3: DB-generated synthetic data
    yield* sql`
      INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
      SELECT
        NOW() - (random() * INTERVAL '${SeedConfig.timeRangeDays} days'),
        ${spec.deviceId},
        ${spec.valueRange.min} + (random() * ${spec.valueRange.max - spec.valueRange.min}),
        CASE WHEN random() > ${spec.qualityThreshold} THEN 100 ELSE 50 END
      FROM generate_series(1, ${rowCount})
    `
  }
})

/**
 * Alternative: Use insertBatch for smaller validated sets
 */
export const seedReadingsValidated = Effect.gen(function* () {
  const readingRepo = yield* SensorReadingRepo

  // Generate typed readings (satisfies SensorReadingModel.insert.Type)
  const readings = generateReadings(sensorSpecs[0], 1000)

  yield* readingRepo.insertBatch(readings)
})
```

## Trade-offs Analysis

| Approach | Type Safety | Schema Validation | Performance | Use Case |
|----------|-------------|-------------------|-------------|----------|
| Repo.insert | Compile + Runtime | Full | Slow | Assets (<100 rows) |
| Repo.insertBatch | Compile + Runtime | Full | Medium | Test fixtures |
| sql.insert(array) | Compile only | None | Fast | Moderate bulk |
| generate_series | None | None | Fastest | 700K+ synthetic |

### Recommendation

**Hybrid approach**:
1. Assets (Plant, Line, Machine, Sensor, Alarm): Use repos for full validation
2. Readings bulk: Keep `generate_series` for performance, but type the specs
3. Test/demo data: Use `insertBatch` with typed arrays

This preserves type safety at definition time while accepting that synthetic bulk data (random values) doesn't benefit from runtime validation.

## Implementation Phases

### Phase 1: Extract Definitions (Type-Safe)

**Files to create:**
- `src/lib/iiot/seed/definitions/assets.ts`
- `src/lib/iiot/seed/definitions/sensors.ts`
- `src/lib/iiot/seed/definitions/alarms.ts`

**Steps:**
1. Create `SensorSpec` interface extending sensor fields with generation params
2. Create `AssetDefinitions` interface for hierarchy (plants -> lines -> machines -> sensors)
3. Create `AlarmScenario` interface for alarm definitions
4. Extract hardcoded specs from current mock-data.ts into typed constants
5. Ensure all IDs use branded types (`as DeviceId`, etc.)

**Acceptance criteria:**
- [ ] All definitions compile against Model.insert.Type shapes
- [ ] No raw strings for IDs - all branded
- [ ] Sensor types and units use schema literals

### Phase 2: Refactor seedAssets (Repo-Based)

**Files to modify:**
- `src/lib/iiot/seed/mock-data.ts`

**Steps:**
1. Import repositories and definitions
2. Create `seedPlants`, `seedLines`, `seedMachines`, `seedSensors` functions
3. Each uses repo.insert with proper Option wrapping
4. Add idempotency via `Effect.catchTag('SqlError', ...)` for duplicate key
5. Compose into `seedAssets` that respects FK order

**Acceptance criteria:**
- [ ] Assets insert via repos, not raw SQL
- [ ] Optional fields use `Option.some()`/`Option.none()`
- [ ] FK constraints respected (plants before lines before machines before sensors)

### Phase 3: Refactor seedReadings (Typed Bulk)

**Files to modify:**
- `src/lib/iiot/seed/mock-data.ts`

**Steps:**
1. Keep `generate_series` approach for performance
2. Replace string interpolation with sql template tags
3. Use typed SensorSpec for parameters
4. Add proper TypeScript types to raw SQL results where queried

**Acceptance criteria:**
- [ ] No string concatenation in SQL
- [ ] SensorSpec provides all parameters
- [ ] Device IDs properly typed in SQL

### Phase 4: Refactor seedAlarms (Repo-Based)

**Files to modify:**
- `src/lib/iiot/seed/mock-data.ts`

**Steps:**
1. Create `AlarmScenario` definitions with proper types
2. Use `AlarmRepo.insert` for each alarm
3. Use `AlarmModel.insert.Type` shape with `Option.some()` for message/metadata
4. Remove raw SQL alarm inserts

**Acceptance criteria:**
- [ ] Alarms insert via AlarmRepo
- [ ] AlarmType and AlarmSeverity use schema literals
- [ ] Optional fields properly wrapped

### Phase 5: Add Validation Mode

**Files to modify:**
- `src/lib/iiot/seed/mock-data.ts`

**Steps:**
1. Add `SeedMode` type: `'fast' | 'validated'`
2. For `'validated'` mode: use `insertBatch` with sample data
3. For `'fast'` mode: use `generate_series`
4. Add config option to toggle modes

**Acceptance criteria:**
- [ ] Can run in either mode
- [ ] Validated mode uses repos for all data
- [ ] Fast mode matches current performance

### Phase 6: Documentation and Tests

**Files to create:**
- `src/lib/iiot/seed/README.md`
- `src/lib/iiot/__tests__/seed/mock-data.test.ts`

**Steps:**
1. Document tier approach and trade-offs
2. Add unit tests for definition types (compile-time checks)
3. Add integration test for small seed (validated mode)

**Acceptance criteria:**
- [ ] README explains architecture
- [ ] Tests verify type safety of definitions
- [ ] Integration test confirms seeding works

## Testing Strategy

1. **Type Tests**: Ensure definitions satisfy `Model.insert.Type` at compile time
2. **Unit Tests**: Test generation functions with small inputs
3. **Integration Tests**: Run validated mode against test database
4. **Performance Baseline**: Benchmark fast mode vs current implementation

## Risks and Considerations

1. **Breaking FK Constraints**: Asset hierarchy must seed in order. Current mock-data.ts assumes graph-seeded assets exist.

2. **Existing Data**: Current seeder deletes within time range. New seeder should maintain idempotency.

3. **generate_series Performance**: This is PostgreSQL-specific. If portability needed, would require different approach.

4. **Continuous Aggregates**: AggregatedReadings are read-only (from continuous aggregate). No seeding needed - populated by refresh.

5. **Option Handling**: Model.insert expects `Option<T>` for nullable fields. Test fixtures use this pattern but raw SQL doesn't. Must convert.

## Estimated Complexity

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1 | Low | Low |
| Phase 2 | Medium | Medium (FK ordering) |
| Phase 3 | Low | Low |
| Phase 4 | Low | Low |
| Phase 5 | Medium | Low |
| Phase 6 | Low | Low |

**Total Estimate**: 4-6 hours for full implementation

## Summary

The key insight is that **type safety at definition time** is more valuable than **runtime validation during bulk insert** for synthetic mock data. The hybrid approach:

1. **Preserves correctness** by validating asset hierarchy via repos
2. **Preserves performance** by using `generate_series` for readings
3. **Improves safety** by using branded types and typed specs instead of raw strings
4. **Enables flexibility** by adding a validated mode for smaller test scenarios

The current raw SQL approach is not wrong for performance-critical bulk operations, but it can be improved with proper TypeScript types and structured definitions that reference the existing Schema/Model definitions.
