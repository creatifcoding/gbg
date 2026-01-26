# IIoT Seed Infrastructure Research

**Generated:** 2026-01-25  
**Purpose:** Comprehensive documentation of IIoT seed patterns for v3 preservation

---

## 1. Seed Architecture Overview

The IIoT seed infrastructure uses a **tiered approach** that balances type safety, schema validation, and performance.

### 1.1 Core Philosophy

- **Tier 1 (Assets/Alarms)**: Full schema validation via repositories
  - Small row counts (2-8 records)
  - Type-safe insert objects via `Model.insert.make()`
  - Effect Schema validation on insert
  - Performance: ~10 rows/s (acceptable for small counts)

- **Tier 2 (Readings)**: Mode-dependent validation
  - Large row counts (700K+ total)
  - Fast mode: PostgreSQL `generate_series` (no validation)
  - Validated mode: `repo.insertBatch()` with schema validation
  - Performance: 70K+ rows/s (fast) vs 500 rows/s (validated)

### 1.2 Module Structure

```
src/lib/iiot/seed/
├── index.ts                 # Public API exports
├── mock-data.ts            # Core seeding logic (635 lines)
├── README.md               # Documentation
└── ctl/                    # CLI scaffold (@gbg/ctl)
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   └── index.ts        # CLI entry point (236 lines)
    └── skills/
        ├── MANIFEST.json
        └── core/
            └── SKILL.md    # Usage patterns
```

### 1.3 Dependencies

**Core Dependencies:**
- Effect: Core functional runtime
- @effect/sql: SQL client abstraction
- @effect/sql-pg: PostgreSQL driver integration

**Seeder Dependencies (from repos/models):**
- Repository Layer: `PlantRepo`, `LineRepo`, `MachineRepo`, `SensorRepo`, `AlarmRepo`, `SensorReadingRepo`
- Model Layer: Type-safe insert objects (`PlantModel.insert.make()`)
- Schema Layer: Branded identifiers (`PlantId`, `DeviceId`), domain schemas

---

## 2. SeedMode Patterns

### 2.1 Type Definition

**Location:** `src/lib/iiot/seed/mock-data.ts:62`

```typescript
export type SeedMode = 'fast' | 'validated'
```

### 2.2 Configuration Object

**Location:** `src/lib/iiot/seed/mock-data.ts:68-79`

```typescript
export const SeedConfig = {
  /** Seed mode: 'fast' (generate_series) or 'validated' (repo insertBatch) */
  mode: 'fast' as SeedMode,
  
  /** Rows per primary sensor (TMP-001, VIB-001, etc.) */
  primarySensorRows: 100_000,
  
  /** Rows per secondary sensor (SPD-001, CUR-001) */
  secondarySensorRows: 50_000,
  
  /** Rows per sensor in validated mode (smaller for performance) */
  validatedModeRows: 1_000,
  
  /** Time range for generated data */
  timeRangeDays: 30,
} as const
```

**Pattern:** Mutable configuration object with `as const` for type inference

### 2.3 Mode Selection Logic

**Location:** `src/lib/iiot/seed/mock-data.ts:454-515`

```typescript
export const seedMockReadings = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const mode = SeedConfig.mode
  const timeRangeDays = SeedConfig.timeRangeDays

  yield* Effect.log(`Seeding mock sensor readings (mode: ${mode})...`)

  if (mode === 'validated') {
    // VALIDATED MODE: repo.insertBatch with typed readings
    const repo = yield* SensorReadingRepo
    const rowCount = SeedConfig.validatedModeRows

    yield* Effect.forEach(sensorSpecs, (spec) => {
      const { deviceId } = spec
      const readings = generateTypedReadings(spec, rowCount, timeRangeDays)

      return pipe(
        // Clear existing data for this device
        sql`
          DELETE FROM iiot.sensor_readings
          WHERE device_id = ${deviceId}
            AND time > NOW() - make_interval(days => ${timeRangeDays})
        `,
        // Insert via repo with full schema validation
        Effect.andThen(repo.insertBatch(readings)),
        Effect.andThen(Effect.log(`  - ${deviceId}: ${rowCount.toLocaleString()} rows (validated)`))
      )
    }, { concurrency: 4 })
    
  } else {
    // FAST MODE: PostgreSQL generate_series (no validation)
    yield* Effect.forEach(sensorSpecs, (spec) => {
      const rowCount = spec.rows === 'primary'
        ? SeedConfig.primarySensorRows
        : SeedConfig.secondarySensorRows

      const { deviceId, valueMin, valueMax, qualityThreshold } = spec
      const valueRange = valueMax - valueMin

      return pipe(
        // Clear existing data
        sql`
          DELETE FROM iiot.sensor_readings
          WHERE device_id = ${deviceId}
            AND time > NOW() - make_interval(days => ${timeRangeDays})
        `,
        // Generate via PostgreSQL generate_series
        Effect.andThen(sql`
          INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
          SELECT
            NOW() - (random() * make_interval(days => ${timeRangeDays})),
            ${deviceId},
            ${valueMin} + (random() * ${valueRange}),
            CASE WHEN random() > ${qualityThreshold} THEN 100 ELSE 50 END
          FROM generate_series(1, ${rowCount})
        `),
        Effect.andThen(Effect.log(`  - ${deviceId}: ${rowCount.toLocaleString()} rows (fast)`))
      )
    }, { concurrency: 4 })
  }

  yield* Effect.log('Mock readings seeded successfully')
})
```

**Key Patterns:**
1. **Mode detection** via `SeedConfig.mode` at runtime
2. **Row count switching** based on mode (100K vs 1K)
3. **Effect.forEach with concurrency** for parallel device seeding
4. **DELETE before INSERT** for idempotency
5. **Logging with row counts** for verification

### 2.4 Typed Reading Generation (Validated Mode)

**Location:** `src/lib/iiot/seed/mock-data.ts:424-443`

```typescript
const generateTypedReadings = (
  spec: SensorSpec,
  count: number,
  timeRangeDays: number
): readonly (typeof SensorReadingModel.insert.Type)[] => {
  const now = Date.now()
  const msRange = timeRangeDays * 24 * 60 * 60 * 1000
  const { deviceId, valueMin, valueMax, qualityThreshold } = spec
  const valueRange = valueMax - valueMin

  return Array.from({ length: count }, () =>
    SensorReadingModel.insert.make({
      time: new Date(now - Math.random() * msRange),
      deviceId,
      value: valueMin + Math.random() * valueRange,
      quality: (Math.random() > qualityThreshold ? 100 : 50) as QualityScore,
    })
  )
}
```

**Pattern:** Pure function returns array of typed insert objects

---

## 3. Seeder Patterns

### 3.1 Tier 1: Asset Seeders (Repo-Based)

#### 3.1.1 Plant Seeder

**Location:** `src/lib/iiot/seed/mock-data.ts:351-359`

```typescript
export const seedPlants = Effect.gen(function* () {
  const repo = yield* PlantRepo
  yield* Effect.log('Seeding plants...')
  yield* Effect.forEach(mockPlantInserts, (plant) =>
    repo.insert(plant).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void)),
    { concurrency: 10 }
  )
  yield* Effect.log(`  - ${mockPlantInserts.length} plants seeded`)
})
```

**Pattern Elements:**
1. **Repository injection** via `yield* PlantRepo`
2. **Effect.forEach with concurrency** for parallel inserts
3. **Idempotency via catchIf** - catches PostgreSQL `23505` (unique_violation)
4. **Progress logging** before/after

#### 3.1.2 Duplicate Key Detection

**Location:** `src/lib/iiot/seed/mock-data.ts:341-345`

```typescript
const isDuplicateKeyError = (e: unknown): boolean => {
  if (typeof e !== 'object' || e === null) return false
  const err = e as { _tag?: string; cause?: { code?: string } }
  return err._tag === 'SqlError' && err.cause?.code === '23505'
}
```

**Pattern:** Type-safe error predicate for PostgreSQL error codes

#### 3.1.3 Line, Machine, Sensor Seeders

**Locations:** `src/lib/iiot/seed/mock-data.ts:366-404`

**Pattern:** Identical structure to `seedPlants`:
- Same `Effect.forEach` with `concurrency: 10`
- Same `catchIf(isDuplicateKeyError)`
- Same logging pattern

**FK Dependency Order:**
```
Plants (no deps)
  ↓
Lines (depends on Plants)
  ↓
Machines (depends on Lines)
  ↓
Sensors (depends on Machines)
```

### 3.2 Composed Asset Seeder

**Location:** `src/lib/iiot/seed/mock-data.ts:410-415`

```typescript
export const seedAssets = pipe(
  seedPlants,
  Effect.andThen(seedLines),
  Effect.andThen(seedMachines),
  Effect.andThen(seedSensors)
)
```

**Pattern:** Sequential composition via `pipe` + `Effect.andThen`  
**Ensures:** FK constraints satisfied in order

### 3.3 Tier 1: Alarm Seeder

**Location:** `src/lib/iiot/seed/mock-data.ts:526-537`

```typescript
export const seedMockAlarms = Effect.gen(function* () {
  const repo = yield* AlarmRepo

  yield* Effect.log('Seeding mock alarms...')

  yield* Effect.forEach(mockAlarmInserts, (alarm) =>
    repo.insert(alarm).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void)),
    { concurrency: 10 }
  )

  yield* Effect.log(`  - ${mockAlarmInserts.length} alarms seeded`)
})
```

**Pattern:** Identical to asset seeders (Tier 1 pattern)

### 3.4 Aggregate Refresh Seeder

**Location:** `src/lib/iiot/seed/mock-data.ts:547-559`

```typescript
export const refreshAggregates = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Effect.log('Refreshing continuous aggregates...')

  yield* sql.unsafe(`CALL refresh_continuous_aggregate('iiot.readings_1min', NULL, NULL)`)
  yield* Effect.log('  - readings_1min refreshed')

  yield* sql.unsafe(`CALL refresh_continuous_aggregate('iiot.readings_1hour', NULL, NULL)`)
  yield* Effect.log('  - readings_1hour refreshed')

  yield* Effect.log('Continuous aggregates refreshed')
})
```

**Pattern:** Direct SQL execution via `sql.unsafe()` for TimescaleDB procedures

---

## 4. Configuration Patterns

### 4.1 Mock Identifiers

**Location:** `src/lib/iiot/seed/mock-data.ts:89-114`

```typescript
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
```

**Pattern:** 
- Centralized ID registry with `MOCK-` prefix
- Type assertions to branded types
- `as const` for literal type inference

### 4.2 Type-Safe Asset Definitions

**Location:** `src/lib/iiot/seed/mock-data.ts:124-243`

#### 4.2.1 Plant Inserts

```typescript
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
```

**Pattern:**
- `Model.insert.make()` for type-safe insert objects
- `Option.some()` / `Option.none()` for optional fields
- Centralized definition arrays

#### 4.2.2 Sensor Inserts

```typescript
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
  // ... 6 more sensors
]
```

**Pattern:** Literal `type` and `unit` values (validated by Schema.Literal)

### 4.3 Sensor Specifications

**Location:** `src/lib/iiot/seed/mock-data.ts:253-279`

#### 4.3.1 SensorSpec Interface

```typescript
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
```

**Pattern:** Extends sensor identity with generation parameters

#### 4.3.2 Sensor Spec Array

```typescript
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
```

**Pattern:** 
- `readonly` array type
- `as const` for literal inference
- Row tier categorization (`primary` = 100K, `secondary` = 50K)

### 4.4 Alarm Definitions

**Location:** `src/lib/iiot/seed/mock-data.ts:290-331`

```typescript
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
  // ... 3 more alarms
]
```

**Pattern:**
- `Model.insert.make()` for type safety
- `metadata` as typed object (becomes JSONB)
- All optional timestamp fields as `Option.none()`

---

## 5. CLI Scaffold Patterns (@gbg/ctl Integration)

### 5.1 Package Structure

**Location:** `src/lib/iiot/seed/ctl/package.json`

```json
{
  "name": "iiot-seed",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "iiot-seed": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "bun run src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gbg/ctl": "workspace:*",
    "@effect/cli": "^0.53.0",
    "@effect/platform": "^0.76.0",
    "@effect/platform-node": "^0.71.0",
    "effect": "^3.12.0",
    "@effect/sql": "^0.30.0",
    "@effect/sql-sqlite-bun": "^0.25.0"
  }
}
```

**Pattern:** Standalone CLI package within seed module

### 5.2 Database Layer Composition

**Location:** `src/lib/iiot/seed/ctl/src/index.ts:38-57`

```typescript
const transformResultNames = (columnName: string): string =>
  columnName.replace(/_([a-z])/g, (_, char) => char.toUpperCase())

const SeedPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
  maxConnections: 5,
  transformResultNames,
})

const SeedMigratorLive = IIoTMigratorLive.pipe(Layer.provide(SeedPgClient))
const SeedPgClientWithMigrations = Layer.merge(SeedPgClient, SeedMigratorLive)

const FullSeedLayer = Layer.merge(
  SeedPgClientWithMigrations,
  IIoTRepositoriesLive.pipe(Layer.provide(SeedPgClientWithMigrations))
)
```

**Pattern:**
1. **PgClient.layer** with snake_case → camelCase transform
2. **Migrator layer** provided with PgClient
3. **Merged base layer** (client + migrator)
4. **Full layer** with repositories

### 5.3 Command Definitions

#### 5.3.1 Shared Options

**Location:** `src/lib/iiot/seed/ctl/src/index.ts:63-67`

```typescript
const modeOption = Options.choice('mode', ['fast', 'validated']).pipe(
  Options.withAlias('m'),
  Options.withDefault('fast'),
  Options.withDescription('Seed mode: fast (generate_series) or validated (repo batch)')
)
```

**Pattern:** `Options.choice()` for enum values

#### 5.3.2 Stats Command

**Location:** `src/lib/iiot/seed/ctl/src/index.ts:105-117`

```typescript
const statsCommand = Command.make(
  'stats',
  { verbose: verboseOption },
  ({ verbose }) =>
    Effect.gen(function* () {
      yield* printBanner
      if (verbose) {
        yield* Console.log('Querying database...')
      }
      yield* printStats
      yield* printFooter
    })
).pipe(Command.withDescription('Show current data statistics'))
```

**Pattern:**
- `Command.make(name, options, handler)`
- Handler as Effect generator
- Conditional logging based on options

#### 5.3.3 Seed Command

**Location:** `src/lib/iiot/seed/ctl/src/index.ts:153-190`

```typescript
const seedCommand = Command.make(
  'seed',
  { mode: modeOption, assetsOnly: assetsOnlyOption, clear: clearOption, verbose: verboseOption },
  ({ mode, assetsOnly, clear, verbose }) =>
    Effect.gen(function* () {
      yield* printBanner

      if (verbose) {
        yield* Console.log('')
        yield* Console.log('Configuration:')
        yield* Console.log(`  Mode: ${mode}`)
        yield* Console.log(`  Assets only: ${assetsOnly}`)
        yield* Console.log(`  Clear first: ${clear}`)
      }

      yield* configureSeedMode(mode as SeedMode)

      if (clear) {
        yield* Console.log('')
        yield* Console.log('🗑️  Clearing existing mock data...')
        yield* clearMockData
      }

      yield* Console.log('')
      if (assetsOnly) {
        yield* Console.log('🌱 Seeding assets only...')
        yield* seedAssets
      } else {
        yield* Console.log('🌱 Seeding all mock data...')
        yield* seedAll
      }

      yield* printStats
      yield* Console.log('')
      yield* Console.log('✅ Seed complete!')
      yield* printFooter
    })
).pipe(Command.withDescription('Seed the IIoT database with mock data'))
```

**Pattern:**
- Multiple boolean/choice options
- Conditional logic based on flags
- Config mutation via helper effect

### 5.4 Root Command Assembly

**Location:** `src/lib/iiot/seed/ctl/src/index.ts:196-208`

```typescript
const iiotSeedCommand = Command.make('iiot-seed').pipe(
  Command.withDescription('IIoT Seed CLI - Database seeding tool built with @gbg/ctl'),
  Command.withSubcommands([seedCommand, statsCommand, clearCommand])
)

const cli = Command.run(iiotSeedCommand, {
  name: 'iiot-seed',
  version: '1.0.0',
})
```

**Pattern:**
- Root command with subcommands
- `Command.run()` returns executable function

### 5.5 Main Entry Point

**Location:** `src/lib/iiot/seed/ctl/src/index.ts:214-235`

```typescript
cli(process.argv).pipe(
  Effect.provide(FullSeedLayer),
  Effect.provide(NodeContext.layer),
  Effect.catchAllDefect((defect) =>
    Effect.gen(function* () {
      yield* Console.error('')
      yield* Console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      yield* Console.error('❌ COMMAND FAILED')
      yield* Console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      yield* Console.error('')
      yield* Console.error(`Error: ${String(defect)}`)
      yield* Console.error('')
      yield* Console.error('Troubleshooting:')
      yield* Console.error('  1. Ensure database is running: docker compose -f docker/docker-compose.iiot.yml up -d')
      yield* Console.error('  2. Check connection: localhost:5433, database: iiot_mock')
      yield* Console.error('  3. Verify migrations have run successfully')
      yield* Console.error('')
      return yield* Effect.fail(defect)
    })
  ),
  NodeRuntime.runMain
)
```

**Pattern:**
1. Execute CLI with args
2. Provide dependency layers
3. Catch defects with structured error output
4. Run via NodeRuntime.runMain

---

## 6. Layer Composition for Seeding

### 6.1 Repository Layer Hierarchy

**Source:** `src/lib/iiot/repos/index.ts`

```typescript
// Asset repositories (Plant, Line, Machine, Sensor)
export const AssetRepositoriesLive = Layer.mergeAll(
  PlantRepoLive,
  LineRepoLive,
  MachineRepoLive,
  SensorRepoLive
)

// Alarm repositories (Alarm, AlarmContext)
export const AlarmRepositoriesLive = Layer.mergeAll(
  AlarmRepoLive,
  AlarmContextRepoLive
)

// Reading repositories (SensorReading, AggregatedReading, AnalyticsRecord)
export const ReadingRepositoriesLive = Layer.mergeAll(
  SensorReadingRepoLive,
  AggregatedReadingRepoLive,
  AnalyticsRecordRepoLive
)

// All IIoT repositories combined
export const IIoTRepositoriesLive = Layer.mergeAll(
  AssetRepositoriesLive,
  AlarmRepositoriesLive,
  ReadingRepositoriesLive
)
```

**Pattern:**
- Granular layer composition
- `Layer.mergeAll()` for parallel dependency provision
- Hierarchical layer exports

### 6.2 Seed Module Exports

**Location:** `src/lib/iiot/seed/index.ts:10-36`

```typescript
export {
  // Configuration
  SeedConfig,
  type SeedMode,

  // Tier 1: Asset seeders (repo-based, schema-validated)
  seedPlants,
  seedLines,
  seedMachines,
  seedSensors,
  seedAssets,

  // Tier 2: Bulk seeders (mode-dependent)
  seedMockReadings,
  seedMockAlarms,
  refreshAggregates,

  // Utilities
  clearMockData,
  getDataStats,

  // Combined seeder
  seedAll,
} from './mock-data'

// Re-export layer for convenient usage
export { AssetRepositoriesLive } from '../repos'
```

**Pattern:** Convenience re-export of required layers

### 6.3 CLI Layer Composition

**Location:** `src/lib/iiot/seed/ctl/src/index.ts:54-57`

```typescript
const FullSeedLayer = Layer.merge(
  SeedPgClientWithMigrations,
  IIoTRepositoriesLive.pipe(Layer.provide(SeedPgClientWithMigrations))
)
```

**Pattern:**
1. Base layer: PgClient + Migrator
2. Dependent layer: Repositories (provided with base)
3. Merged result: All dependencies

**Dependency Graph:**
```
FullSeedLayer
├── SeedPgClientWithMigrations
│   ├── SeedPgClient (PgClient.layer)
│   └── SeedMigratorLive (IIoTMigratorLive + SeedPgClient)
└── IIoTRepositoriesLive
    ├── AssetRepositoriesLive
    │   ├── PlantRepoLive (requires SqlClient)
    │   ├── LineRepoLive (requires SqlClient)
    │   ├── MachineRepoLive (requires SqlClient)
    │   └── SensorRepoLive (requires SqlClient)
    ├── AlarmRepositoriesLive
    │   ├── AlarmRepoLive (requires SqlClient)
    │   └── AlarmContextRepoLive (requires SqlClient)
    └── ReadingRepositoriesLive
        ├── SensorReadingRepoLive (requires SqlClient)
        ├── AggregatedReadingRepoLive (requires SqlClient)
        └── AnalyticsRecordRepoLive (requires SqlClient)
```

---

## 7. Concurrency Patterns

### 7.1 Effect.forEach with Concurrency

**Pattern Locations:**
- Asset seeders: `{ concurrency: 10 }`
- Reading seeders: `{ concurrency: 4 }`

#### 7.1.1 High Concurrency (Assets)

```typescript
yield* Effect.forEach(mockPlantInserts, (plant) =>
  repo.insert(plant).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void)),
  { concurrency: 10 }
)
```

**Rationale:**
- Small row counts (2-8 records)
- Low database contention
- Higher concurrency = faster completion

#### 7.1.2 Medium Concurrency (Readings)

```typescript
yield* Effect.forEach(sensorSpecs, (spec) => {
  // ... per-device seeding logic
}, { concurrency: 4 })
```

**Rationale:**
- Large row counts per device (50K-100K)
- Avoid overwhelming database connection pool
- Balance between parallelism and resource usage

### 7.2 Concurrency vs. Sequencing

**Sequential (FK constraints):**
```typescript
export const seedAssets = pipe(
  seedPlants,
  Effect.andThen(seedLines),
  Effect.andThen(seedMachines),
  Effect.andThen(seedSensors)
)
```

**Parallel (independent data):**
```typescript
yield* Effect.forEach(sensorSpecs, (spec) => {
  // Each sensor's data is independent
}, { concurrency: 4 })
```

**Pattern:** Sequential for FK ordering, parallel for independent data

---

## 8. Dependency Ordering

### 8.1 Foreign Key Dependency Graph

```
Plants (id: PlantId)
  ↓
Lines (plantId → Plants.id)
  ↓
Machines (lineId → Lines.id)
  ↓
Sensors (machineId → Machines.id)
  ↓
SensorReadings (deviceId → Sensors.deviceId)
Alarms (deviceId → Sensors.deviceId)
```

### 8.2 Seeding Order

**Location:** `src/lib/iiot/seed/mock-data.ts:601-610`

```typescript
export const seedAll = Effect.gen(function* () {
  yield* Effect.log('=== IIoT Mock Data Seeder ===')
  yield* Effect.log(`Configuration: ${SeedConfig.primarySensorRows.toLocaleString()} rows/primary, ${SeedConfig.secondarySensorRows.toLocaleString()} rows/secondary`)

  yield* seedAssets          // 1. Plants → Lines → Machines → Sensors
  yield* seedMockReadings    // 2. Readings (depends on Sensors)
  yield* seedMockAlarms      // 3. Alarms (depends on Sensors)
  yield* refreshAggregates   // 4. Refresh aggregates (depends on Readings)

  yield* Effect.log('=== Seeding complete ===')
})
```

**Pattern:**
1. **Assets first** (FK base)
2. **Readings/Alarms** (parallel-safe, both depend on Sensors)
3. **Aggregates last** (depends on Readings)

### 8.3 Idempotency Strategy

#### 8.3.1 Assets/Alarms (Catch Duplicate)

```typescript
repo.insert(plant).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void))
```

**Strategy:** Ignore PostgreSQL unique violations

#### 8.3.2 Readings (DELETE then INSERT)

```typescript
sql`
  DELETE FROM iiot.sensor_readings
  WHERE device_id = ${deviceId}
    AND time > NOW() - make_interval(days => ${timeRangeDays})
`,
Effect.andThen(sql`INSERT ...`)
```

**Strategy:** Clear existing data within time range before inserting

---

## 9. Code Examples from Implementation

### 9.1 Model Definition Pattern

**Source:** `src/lib/iiot/models/assets/PlantModel.ts`

```typescript
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  // Derived from Plant.fields - direct reuse
  name: Plant.fields.name,

  // Derived with Model-specific transforms
  id: Model.GeneratedByApp(PlantId),         // Add GeneratedByApp modifier
  location: Model.FieldOption(Schema.String), // Schema.optional → Model.FieldOption

  // DB-only fields (not in domain schema)
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
```

**Pattern:**
1. Extend `Model.Class` with class name
2. Reuse domain schema fields directly
3. Apply `Model.*` transforms for DB persistence
4. Add DB-only timestamp fields

### 9.2 Repository Implementation Pattern

**Source:** `src/lib/iiot/repos/PlantRepo.ts`

```typescript
export const PlantRepoLive = Layer.effect(
  PlantRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findById = (id: PlantId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            name,
            location,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM iiot.plants
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(PlantModel)(rows)
      })

    const insert = (plant: typeof PlantModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.plants (id, name, location)
          VALUES (${plant.id}, ${plant.name}, ${Option.getOrNull(plant.location)})
          RETURNING
            id,
            name,
            location,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `
        return yield* decodeFirst(PlantModel)(rows)
      })

    return {
      findById,
      insert,
      // ... other methods
    } satisfies PlantRepository
  })
)
```

**Pattern:**
1. `Layer.effect()` to create repository layer
2. Inject `SqlClient.SqlClient`
3. Define methods as Effect generators
4. Use `decodeOptional` / `decodeFirst` for result parsing
5. `Option.getOrNull()` for optional field conversion
6. Return object satisfying repository interface

### 9.3 Batch Insert Pattern

**Source:** `src/lib/iiot/repos/SensorReadingRepo.ts:74-95`

```typescript
const insertBatch = (readings: readonly (typeof SensorReadingModel.insert.Type)[]) =>
  Effect.gen(function* () {
    if (readings.length === 0) return
    // Use unnest for efficient batch insert
    const times = readings.map(r => r.time)
    const deviceIds = readings.map(r => r.deviceId)
    const values = readings.map(r => r.value)
    const qualities = readings.map(r => r.quality)

    yield* sql`
      INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
      SELECT * FROM UNNEST(
        ${times}::timestamp[],
        ${deviceIds}::text[],
        ${values}::double precision[],
        ${qualities}::integer[]
      )
      ON CONFLICT (time, device_id) DO UPDATE SET
        value = EXCLUDED.value,
        quality = EXCLUDED.quality
    `
  }).pipe(Effect.asVoid)
```

**Pattern:**
1. Early return for empty arrays
2. Extract field arrays from typed objects
3. Use `UNNEST()` for bulk insert
4. `ON CONFLICT` for upsert semantics
5. Explicit array type casts

### 9.4 Decode Utilities Pattern

**Source:** `src/lib/iiot/repos/_decode.ts`

```typescript
export const decodeOptional =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<Option.Option<A>, ParseResult.ParseError, R> =>
    rows.length === 0
      ? Effect.succeed(Option.none())
      : Schema.decodeUnknown(schema)(rows[0]).pipe(Effect.map(Option.some))

export const decodeRows =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<readonly A[], ParseResult.ParseError, R> =>
    Schema.decodeUnknown(Schema.Array(schema))(rows)

export const decodeFirst =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<A, ParseResult.ParseError, R> =>
    Schema.decodeUnknown(schema)(rows[0])
```

**Pattern:**
- Generic decode functions
- Schema-driven transformation
- Effect error handling
- Curried for composition

### 9.5 Update Preparation Pattern

**Source:** `src/lib/iiot/repos/_decode.ts:41-62`

```typescript
export const prepareUpdate = <T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      // Skip undefined - sql.update will omit this field
      continue
    }

    if (Option.isOption(value)) {
      // Convert Option to primitive: none → null, some → value
      result[key] = Option.getOrNull(value)
    } else {
      // Pass through non-Option values as-is
      result[key] = value
    }
  }

  return result
}
```

**Pattern:**
- Transform `Option` fields to primitives
- Skip `undefined` fields (partial update)
- Compatible with `sql.update()` helper

---

## 10. Patterns to Preserve for v3

### 10.1 Architectural Patterns

1. **Tiered Seeding Approach**
   - Tier 1: Full validation via repos (small data)
   - Tier 2: Mode-dependent validation (large data)
   - **Rationale:** Balances correctness and performance

2. **SeedMode Abstraction**
   - Runtime mode selection
   - Config-driven row counts
   - **Preserve:** Mutable `SeedConfig` object pattern

3. **Layer Composition Hierarchy**
   - Granular layer exports
   - Composable dependency trees
   - **Preserve:** `AssetRepositoriesLive`, `IIoTRepositoriesLive` pattern

4. **FK Dependency Ordering**
   - Sequential composition via `pipe` + `Effect.andThen`
   - Parallel execution within tiers
   - **Preserve:** `seedAssets` composition pattern

### 10.2 Code Patterns

1. **Type-Safe Insert Objects**
   ```typescript
   PlantModel.insert.make({
     id: mockIds.plant1,
     name: 'Main Plant',
     location: Option.some('Building A'),
   })
   ```
   - **Preserve:** `Model.insert.make()` pattern
   - **Benefit:** Compile-time validation, IDE autocomplete

2. **Idempotency via catchIf**
   ```typescript
   repo.insert(plant).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void))
   ```
   - **Preserve:** PostgreSQL error code detection
   - **Benefit:** Safe to run multiple times

3. **Concurrency Control**
   ```typescript
   Effect.forEach(items, operation, { concurrency: N })
   ```
   - **Preserve:** Explicit concurrency limits
   - **Benefit:** Resource management, predictable behavior

4. **Decode Utilities**
   ```typescript
   yield* decodeOptional(PlantModel)(rows)
   yield* decodeRows(PlantModel)(rows)
   yield* decodeFirst(PlantModel)(rows)
   ```
   - **Preserve:** Generic decode functions
   - **Benefit:** DRY, type-safe SQL result handling

5. **Batch Insert via UNNEST**
   ```typescript
   sql`
     INSERT INTO table (col1, col2)
     SELECT * FROM UNNEST(
       ${array1}::type1[],
       ${array2}::type2[]
     )
   `
   ```
   - **Preserve:** Array-based bulk insert
   - **Benefit:** Single query for large batches

### 10.3 CLI Patterns

1. **@gbg/ctl Integration**
   - Standalone CLI package in module
   - `Command.make()` + `Options.*` pattern
   - **Preserve:** Consistent CLI authoring across modules

2. **Layer Provision in Main**
   ```typescript
   cli(process.argv).pipe(
     Effect.provide(FullSeedLayer),
     Effect.provide(NodeContext.layer),
     NodeRuntime.runMain
   )
   ```
   - **Preserve:** Dependency injection at entry point
   - **Benefit:** Pure CLI logic, testable

3. **Structured Error Handling**
   - `Effect.catchAllDefect()` with troubleshooting output
   - **Preserve:** User-friendly error messages

### 10.4 Configuration Patterns

1. **Centralized ID Registry**
   ```typescript
   export const mockIds = {
     plant1: 'MOCK-PLANT-001' as PlantId,
     // ...
   } as const
   ```
   - **Preserve:** Single source of truth for mock IDs
   - **Benefit:** Consistency, easy updates

2. **Sensor Specifications**
   ```typescript
   export interface SensorSpec {
     deviceId: DeviceId
     valueMin: number
     valueMax: number
     qualityThreshold: number
     rows: 'primary' | 'secondary'
   }
   ```
   - **Preserve:** Separation of identity and generation params
   - **Benefit:** Flexible data generation

3. **Typed Insert Arrays**
   ```typescript
   export const mockPlantInserts = [
     PlantModel.insert.make({ ... }),
     // ...
   ]
   ```
   - **Preserve:** Centralized, type-safe seed data
   - **Benefit:** Easy to modify, validate at compile-time

### 10.5 Performance Patterns

1. **generate_series for Bulk Data**
   - PostgreSQL-native generation
   - No client-server round trips
   - **Preserve:** Fast mode implementation

2. **DELETE + INSERT for Idempotency**
   - Time-range scoped deletion
   - Avoids duplicate key errors
   - **Preserve:** Pattern for time-series data

3. **Parallel Device Seeding**
   - Independent per-device operations
   - Concurrency limits for resource control
   - **Preserve:** `Effect.forEach` with concurrency

### 10.6 Testing Patterns

**Not Present in Current Implementation - Recommendations:**

1. **Seed Verification Tests**
   ```typescript
   test('seedPlants inserts expected count', async () => {
     await Effect.runPromise(seedPlants.pipe(Effect.provide(testLayer)))
     const stats = await Effect.runPromise(getDataStats.pipe(Effect.provide(testLayer)))
     expect(stats.plants).toBe(mockPlantInserts.length)
   })
   ```

2. **Idempotency Tests**
   ```typescript
   test('seedAll is idempotent', async () => {
     await Effect.runPromise(seedAll.pipe(Effect.provide(testLayer)))
     await Effect.runPromise(seedAll.pipe(Effect.provide(testLayer)))
     // Assert counts unchanged
   })
   ```

3. **Mode Switching Tests**
   ```typescript
   test('fast mode generates expected rows', async () => {
     SeedConfig.mode = 'fast'
     await Effect.runPromise(seedMockReadings.pipe(Effect.provide(testLayer)))
     // Assert row counts
   })
   ```

---

## 11. Key Takeaways

### 11.1 What Works Well

1. **Type Safety Throughout**
   - Branded identifiers prevent ID mixing
   - Model.insert.make() validates at compile time
   - Schema validation catches runtime errors

2. **Performance Flexibility**
   - SeedMode abstraction allows dev vs test tradeoffs
   - Fast mode for iteration (10s for 700K rows)
   - Validated mode for correctness (2s for 8K rows)

3. **Composable Architecture**
   - Granular layer exports
   - Sequential + parallel composition
   - Clear dependency graphs

4. **Idempotency**
   - Safe to run multiple times
   - No manual cleanup required
   - Predictable behavior

### 11.2 Potential Improvements for v3

1. **Seed Data Versioning**
   - Track seed data schema versions
   - Migration-like system for seed data updates

2. **Parameterized Generators**
   - Allow runtime configuration of value ranges
   - Support for realistic data distributions (normal, exponential)

3. **Incremental Seeding**
   - Append new data without full reseed
   - Useful for time-series continuation

4. **Test Layer Fixtures**
   - Reusable test data factories
   - Integration with @effect/vitest

5. **Progress Reporting**
   - Stream-based progress events
   - Real-time row count updates

### 11.3 Anti-Patterns to Avoid

1. **Direct SQL in Seeding Logic**
   - Keep Tier 1 seeders repo-based
   - Only use raw SQL for Tier 2 (performance-critical)

2. **Hardcoded Connection Strings**
   - Use Layer.provide() for dependency injection
   - Support multiple environments via config

3. **Mixing Concerns**
   - Keep seed data definitions separate from seeding logic
   - Maintain clear boundary between CLI and core logic

4. **Implicit Dependencies**
   - Always document FK ordering
   - Use type system to enforce dependencies where possible

---

## Appendix A: File Manifest

### Core Seed Module

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/iiot/seed/index.ts` | 37 | Public API exports |
| `src/lib/iiot/seed/mock-data.ts` | 635 | Core seeding logic, mock data definitions |
| `src/lib/iiot/seed/README.md` | 144 | Module documentation |

### CLI Scaffold

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/iiot/seed/ctl/package.json` | 27 | CLI package config |
| `src/lib/iiot/seed/ctl/tsconfig.json` | 8 | TypeScript config |
| `src/lib/iiot/seed/ctl/src/index.ts` | 236 | CLI entry point |
| `src/lib/iiot/seed/ctl/skills/MANIFEST.json` | 21 | Skill registry |
| `src/lib/iiot/seed/ctl/skills/core/SKILL.md` | 86 | CLI usage documentation |

### Supporting Files (Dependencies)

| File | Purpose |
|------|---------|
| `src/lib/iiot/repos/index.ts` | Layer composition |
| `src/lib/iiot/repos/PlantRepo.ts` | Plant repository |
| `src/lib/iiot/repos/SensorReadingRepo.ts` | Reading repository with batch insert |
| `src/lib/iiot/repos/_decode.ts` | Decode utilities |
| `src/lib/iiot/models/assets/PlantModel.ts` | Plant model |
| `src/lib/iiot/models/alarms/AlarmModel.ts` | Alarm model |
| `src/lib/iiot/models/_common.ts` | Model transforms |
| `src/lib/iiot/schemas/identifiers.ts` | Branded identifiers |
| `src/lib/iiot/schemas/assets.ts` | Asset domain schemas |
| `src/lib/iiot/schemas/readings.ts` | Reading domain schemas |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Tier 1** | Asset/alarm seeders using full repo validation |
| **Tier 2** | Bulk reading seeders with mode-dependent validation |
| **SeedMode** | Runtime configuration: 'fast' (generate_series) or 'validated' (repo batch) |
| **Model.insert.make()** | Type-safe insert object constructor |
| **decodeOptional** | Decode SQL result to `Option<Model>` |
| **decodeRows** | Decode SQL result array to `Model[]` |
| **decodeFirst** | Decode first SQL result to `Model` or fail |
| **prepareUpdate** | Transform update object for `sql.update()` |
| **isDuplicateKeyError** | PostgreSQL error code `23505` predicate |
| **AssetRepositoriesLive** | Layer providing asset repos |
| **IIoTRepositoriesLive** | Layer providing all IIoT repos |
| **FullSeedLayer** | Complete dependency layer for CLI |
| **Effect.forEach** | Parallel iteration with concurrency control |
| **UNNEST** | PostgreSQL array unnesting for bulk insert |

---

**End of Research Document**
