# IIoT Seed Module

Schema-aware mock data seeder for IIoT development and testing.

## Architecture

The seeder uses a **tiered approach** balancing type safety and performance:

| Tier | Data Type | Method | Validation | Performance |
|------|-----------|--------|------------|-------------|
| **Tier 1** | Assets, Alarms | Repos | Full schema | ~10 rows/s |
| **Tier 2** | Readings | Mode-dependent | Configurable | 70K+ rows/s |

### Tier 1: Repo-Based (Full Validation)

Assets and alarms use repository methods with `Effect.forEach` concurrency:

```typescript
import { seedAssets, seedMockAlarms } from './seed'

// Seeds in FK order: Plants → Lines → Machines → Sensors
await Effect.runPromise(seedAssets.pipe(Effect.provide(AssetRepositoriesLive)))
```

### Tier 2: Mode-Dependent Readings

Readings support two modes via `SeedConfig.mode`:

```typescript
// Fast mode (default): generate_series, 700K+ rows
SeedConfig.mode = 'fast'

// Validated mode: repo.insertBatch with schema validation
SeedConfig.mode = 'validated'
```

## Usage

### Seed All Data

```typescript
import { seedAll, SeedConfig } from '@tmnl/iiot/seed'
import { IIoTRepositoriesLive } from '@tmnl/iiot/repos'
import { SqlClientLive } from './your-sql-client'

// Configure (optional)
SeedConfig.mode = 'fast' // or 'validated'

// Run seeder
await Effect.runPromise(
  seedAll.pipe(
    Effect.provide(IIoTRepositoriesLive),
    Effect.provide(SqlClientLive)
  )
)
```

### Individual Seeders

```typescript
import {
  seedPlants, seedLines, seedMachines, seedSensors, // Tier 1: Assets
  seedAssets,         // Composed asset seeder
  seedMockReadings,   // Tier 2: Readings (mode-dependent)
  seedMockAlarms,     // Tier 1: Alarms
  refreshAggregates,  // Continuous aggregate refresh
  clearMockData,      // Reset to clean state
  getDataStats,       // Verify counts
} from '@tmnl/iiot/seed'
```

## Configuration

```typescript
export const SeedConfig = {
  mode: 'fast' as SeedMode,        // 'fast' | 'validated'
  primarySensorRows: 100_000,      // Rows per primary sensor (fast mode)
  secondarySensorRows: 50_000,     // Rows per secondary sensor (fast mode)
  validatedModeRows: 1_000,        // Rows per sensor (validated mode)
  timeRangeDays: 30,               // Time range for generated data
}
```

## Mock Data Definitions

Type-safe definitions using `Model.insert.make()`:

| Definition | Count | Model |
|------------|-------|-------|
| `mockPlantInserts` | 2 | PlantModel |
| `mockLineInserts` | 3 | LineModel |
| `mockMachineInserts` | 4 | MachineModel |
| `mockSensorInserts` | 8 | SensorModel |
| `mockAlarmInserts` | 4 | AlarmModel |
| `sensorSpecs` | 8 | SensorSpec (generation params) |

## Sensor Specifications

`SensorSpec` extends sensor identity with generation parameters:

```typescript
interface SensorSpec {
  deviceId: DeviceId
  valueMin: number
  valueMax: number
  qualityThreshold: number  // Probability of low quality (0-1)
  rows: 'primary' | 'secondary'
}
```

## Idempotency

All seeders are idempotent:
- **Assets/Alarms**: Catch PostgreSQL `23505` (unique_violation)
- **Readings**: DELETE before INSERT within time range

Safe to run multiple times without duplicating data.

## Layer Composition

```typescript
import { AssetRepositoriesLive } from '@tmnl/iiot/seed'

// Provides: PlantRepo, LineRepo, MachineRepo, SensorRepo
seedAssets.pipe(Effect.provide(AssetRepositoriesLive))
```

For full seeding (including readings and alarms):

```typescript
import { IIoTRepositoriesLive } from '@tmnl/iiot/repos'

seedAll.pipe(Effect.provide(IIoTRepositoriesLive))
```

## Trade-offs

| Mode | Use Case | Rows | Time | Validation |
|------|----------|------|------|------------|
| `fast` | Dev, stress testing | 700K+ | ~10s | None |
| `validated` | Integration tests | 8K | ~8s | Full schema |

Choose `validated` when correctness matters more than volume.
