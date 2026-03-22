# IIoT Test Patterns Research

**Generated:** 2026-01-25  
**Purpose:** Document all test patterns in src/lib/iiot/ for preservation in v3 rewrite

---

## Overview

The IIoT module contains a comprehensive test suite spanning:
- **15 test files** across unit, integration, and seed testing
- **@effect/vitest** for Effect-native testing
- **Real PostgreSQL + TimescaleDB + Apache AGE** integration tests
- **Test layer composition** for service dependency injection
- **Schema validation** via Effect Schema
- **Repository patterns** with composite keys and Option types

---

## 1. @effect/vitest Patterns

### 1.1 Basic `it.effect` Tests

**Purpose:** Test Effect programs without manual `Effect.runPromise`

**Pattern:**
```typescript
import { it } from '@effect/vitest'

it.effect('test name', () =>
  Effect.gen(function* () {
    const service = yield* MyService
    const result = yield* service.operation()
    expect(result).toBe(expected)
  }).pipe(Effect.provide(MyService.Default))
)
```

**Examples:**
- `src/lib/iiot/__tests__/services.test.ts:43-55` - TimeSeriesClient insert test
- `src/lib/iiot/__tests__/services.test.ts:133-160` - SensorService validation test
- `src/lib/iiot/__tests__/l2-services.test.ts:31-56` - Ingest readings test

**Key Points:**
- No `.pipe(Effect.runPromise)` needed - vitest handles it
- Services yielded via `yield* ServiceName`
- Layer provided via `.pipe(Effect.provide(...))`
- Assertions use standard vitest `expect()`

### 1.2 `it.scoped` Tests

**Purpose:** Tests with scoped resources (not heavily used in IIoT)

**Pattern:**
```typescript
it.scoped('test with scope', () =>
  Effect.gen(function* () {
    const resource = yield* Scope.make()
    // ... test code
  })
)
```

**Note:** Most IIoT tests use `it.effect` since service layers handle resource management.

---

## 2. Test Layer Composition

### 2.1 Layer Architecture

**File:** `src/lib/iiot/__tests__/integration/layer.ts`

**Core Layers:**
```typescript
// Base database connection
export const TestPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
  transformResultNames, // snake_case → camelCase
})

// Migrations auto-run on layer build
const TestMigratorLive = IIoTMigratorLive.pipe(Layer.provide(TestPgClient))

// Base layer with migrations
export const TestPgClientWithMigrations = Layer.merge(TestPgClient, TestMigratorLive)
```

**Repository Layers:**
```typescript
// All repos (assets + alarms + readings)
export const RepositoriesIntegrationLayer = IIoTRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

// Asset repos only (Plant, Line, Machine, Sensor)
export const AssetRepositoriesIntegrationLayer = AssetRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

// Alarm repos only
export const AlarmRepositoriesIntegrationLayer = AlarmRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

// Reading repos only
export const ReadingRepositoriesIntegrationLayer = ReadingRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)
```

**Service Layers:**
```typescript
// TimeSeriesClient + GraphClient + PgClient
export const IIoTIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  TimeSeriesClientLayer,
  GraphClientLayer
)

// Full stack: services + all repos
export const FullIIoTIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  TimeSeriesClientLayer,
  GraphClientLayer,
  RepositoriesIntegrationLayer
)
```

**Key Principle:** Layers are composable. Tests import only what they need.

### 2.2 Layer Composition Patterns

**Pattern: Single Service Test**
```typescript
// File: l1-clients.test.ts
const program = Effect.gen(function* () {
  const client = yield* TimeSeriesClient
  return yield* client.insertReadings(readings)
}).pipe(Effect.provide(TimeSeriesClient.Default))
```

**Pattern: Multi-Service Test**
```typescript
// File: services.test.ts:129-160
const SensorServiceLayer = SensorService.Default // Already includes dependencies

it.effect('test', () =>
  Effect.gen(function* () {
    const service = yield* SensorService
    // ...
  }).pipe(Effect.provide(SensorServiceLayer))
)
```

**Pattern: Full Integration Test**
```typescript
// File: hybrid.test.ts:59-84
const program = withCleanDatabase(
  Effect.gen(function* () {
    const tsClient = yield* TimeSeriesClient
    const graphClient = yield* GraphClient
    // ... test code
  })
).pipe(Effect.provide(IIoTIntegrationLayer))

await Effect.runPromise(program)
```

---

## 3. Integration Test Patterns

### 3.1 Database Availability Check

**Purpose:** Skip tests gracefully when DB not running

**Pattern:**
```typescript
import { isDatabaseAvailable } from './integration/layer'

describe('Integration Tests', () => {
  let dbAvailable = false

  beforeAll(async () => {
    const check = isDatabaseAvailable.pipe(Effect.provide(TestPgClient))
    dbAvailable = await Effect.runPromise(check)
    if (!dbAvailable) {
      console.log('SKIPPING: Database not available')
    }
  })

  it('test', async () => {
    if (!dbAvailable) return
    // ... test code
  })
})
```

**Examples:**
- `src/lib/iiot/__tests__/integration/time-series.test.ts:40-50`
- `src/lib/iiot/__tests__/integration/graph.test.ts:38-46`
- `src/lib/iiot/__tests__/integration/hybrid.test.ts:43-51`

### 3.2 Test Data Cleanup

**Cleanup Utilities:**
```typescript
// Clean assets (FK order: Sensors → Machines → Lines → Plants)
export const cleanTestAssets = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`DELETE FROM iiot.sensors WHERE device_id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.machines WHERE id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.lines WHERE id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.plants WHERE id LIKE 'TEST-%'`
})

// Clean alarms
export const cleanTestAlarms = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`DELETE FROM iiot.alarms WHERE device_id LIKE 'TEST-%'`
})

// Clean readings
export const cleanTestReadings = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`DELETE FROM iiot.sensor_readings WHERE device_id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.analytics_records WHERE device_id LIKE 'TEST-%'`
})
```

**Usage in Tests:**
```typescript
beforeEach(async () => {
  await Effect.runPromise(
    cleanTestReadings.pipe(Effect.provide(TestPgClient))
  )
  await Effect.runPromise(
    cleanTestAssets.pipe(Effect.provide(TestPgClient))
  )
})
```

**Key Points:**
- `TEST-` prefix for test data (not `MOCK-` which is seed data)
- FK order matters in cleanup (children before parents)
- Use `Effect.orElseSucceed(() => undefined)` to ignore "not exists" errors

### 3.3 `withCleanDatabase` Wrapper

**Purpose:** Auto-cleanup before test execution

**Pattern:**
```typescript
export const withCleanDatabase = <A, E, R>(test: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* cleanTestData
    return yield* test
  })

// Usage
const program = withCleanDatabase(
  Effect.gen(function* () {
    const client = yield* TimeSeriesClient
    // ... test code
  })
).pipe(Effect.provide(IIoTIntegrationLayer))
```

**Examples:**
- `src/lib/iiot/__tests__/integration/time-series.test.ts:60-78`
- `src/lib/iiot/__tests__/integration/hybrid.test.ts:61-84`

### 3.4 RUN_INTEGRATION_TESTS Flag

**Purpose:** Skip integration tests unless explicitly enabled

**Pattern:**
```typescript
const RUN_INTEGRATION = process.env['RUN_INTEGRATION_TESTS'] === '1'

describe.skipIf(!RUN_INTEGRATION)('Repo Integration', () => {
  // ... tests
})
```

**Run with:**
```bash
RUN_INTEGRATION_TESTS=1 bun test src/lib/iiot/__tests__/repos/
```

**Examples:**
- All files in `__tests__/repos/*.integration.test.ts`
- `__tests__/models.integration.test.ts`
- `__tests__/seed/*.integration.test.ts`

---

## 4. Mock Patterns

### 4.1 In-Memory Mocks (L1 Clients)

**File:** `src/lib/iiot/services/l1/TimeSeriesClient.ts`

**Pattern:** Default layer uses in-memory mock, integration tests override with real DB.

```typescript
// In service file
export const Default = Layer.succeed(
  TimeSeriesClient,
  TimeSeriesClient.of({
    insertReadings: (readings) => Effect.succeed(readings.length),
    queryReadings: (opts) => Stream.empty,
    getLatestReading: (deviceId) => Effect.succeed(null),
    // ... other methods with mock behavior
  })
)

// In integration test
const TimeSeriesClientLayer = TimeSeriesClient.Default.pipe(
  Layer.provide(TestPgClient) // Override with real DB
)
```

**Key Point:** Same API, swappable implementation via Layer.provide.

### 4.2 Test Fixtures

**File:** `src/lib/iiot/__tests__/__fixtures__/fixtures.ts`

**Pattern:**
```typescript
// Branded IDs
export const testIds = {
  plant1: 'TEST-PLANT-001' as PlantId,
  line1: 'TEST-LINE-001' as LineId,
  machine1: 'TEST-MACHINE-001' as MachineId,
  device1: 'TEST-TMP-001' as DeviceId,
  nonExistentPlant: 'TEST-PLANT-999' as PlantId,
}

// Insert types (Model.insert.Type)
export const testPlant1Insert: PlantModel['insert']['Type'] = {
  id: testIds.plant1,
  name: 'Test Plant Alpha',
  location: Option.some('Test Location A'),
}

// Update types (Model.update.Type)
export const testPlant1Update: PlantModel['update']['Type'] = {
  id: testIds.plant1,
  name: 'Updated Plant Alpha',
  location: Option.some('Updated Location'),
}

// Batch inserts
export const testSensorReadingBatch = [
  {
    time: testDates.now,
    deviceId: testIds.device1,
    value: 25.5,
    quality: 100 as QualityScore,
  },
  {
    time: testDates.oneHourAgo,
    deviceId: testIds.device1,
    value: 24.3,
    quality: 95 as QualityScore,
  },
  // ...
]
```

**Key Points:**
- Fixtures use `TEST-` prefix (not `MOCK-`)
- Types match `Model.insert.Type` / `Model.update.Type`
- Option fields use `Option.some()` / `Option.none()`
- Branded types preserved

---

## 5. Database Test Setup/Teardown

### 5.1 beforeAll Pattern

**Purpose:** Check DB availability, fail fast if missing

```typescript
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
```

### 5.2 beforeEach Pattern

**Purpose:** Clean slate for each test

```typescript
beforeEach(async () => {
  // Clean in FK-safe order
  await Effect.runPromise(
    cleanTestReadings.pipe(Effect.provide(TestPgClient))
  )
  await Effect.runPromise(
    cleanTestAlarms.pipe(Effect.provide(TestPgClient))
  )
  await Effect.runPromise(
    cleanTestAssets.pipe(Effect.provide(TestPgClient))
  )

  // Insert parent hierarchy (for FK-dependent tests)
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
```

**Examples:**
- `src/lib/iiot/__tests__/repos/readings.integration.test.ts:62-82`
- `src/lib/iiot/__tests__/repos/assets.integration.test.ts:54-64`

### 5.3 afterAll Pattern

**Purpose:** Final cleanup to avoid polluting DB

```typescript
afterAll(async () => {
  await Effect.runPromise(
    cleanTestReadings.pipe(Effect.provide(TestPgClient))
  )
  await Effect.runPromise(
    cleanTestAssets.pipe(Effect.provide(TestPgClient))
  )
})
```

---

## 6. Assertion Patterns with Effect

### 6.1 Option Assertions

**Pattern: Option.isSome / Option.isNone**
```typescript
const result = yield* plantRepo.findById(testIds.plant1)
expect(Option.isSome(result)).toBe(true)

const plant = Option.getOrThrow(result)
expect(plant.id).toBe(testIds.plant1)
```

**Pattern: Option.getOrNull for assertions**
```typescript
expect(Option.getOrNull(plant.location)).toBe('Test Location A')
```

**Examples:**
- `src/lib/iiot/__tests__/repos/assets.integration.test.ts:123-128`
- `src/lib/iiot/__tests__/repos/alarms.integration.test.ts:154-157`

### 6.2 Effect.either for Error Testing

**Purpose:** Test failure paths without throwing

**Pattern:**
```typescript
const result = yield* service
  .ingestReadings([{ value: NaN }]) // Invalid
  .pipe(Effect.either)

expect(result._tag).toBe('Left')
if (result._tag === 'Left') {
  expect(result.left._tag).toBe('ValidationError')
}
```

**Examples:**
- `src/lib/iiot/__tests__/services.test.ts:134-146` - Invalid readings rejection
- `src/lib/iiot/__tests__/services.test.ts:209-222` - PlantNotFoundError

### 6.3 Effect.runPromiseExit for Exit Testing

**Purpose:** Test both success/failure without throwing

**Pattern:**
```typescript
const result = await Effect.runPromiseExit(
  Effect.gen(function* () {
    const plantRepo = yield* PlantRepo
    yield* plantRepo.insert(testPlant1Insert)
    yield* plantRepo.insert(testPlant1Insert) // Duplicate
  }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
)

expect(result._tag).toBe('Failure') // SqlError for duplicate key
```

**Examples:**
- `src/lib/iiot/__tests__/repos/assets.integration.test.ts:100-109`
- `src/lib/iiot/__tests__/repos/assets.integration.test.ts:289-301`

### 6.4 Stream Assertions

**Pattern: Stream.runCollect + Chunk.toArray**
```typescript
const readings = yield* client
  .queryReadings({ deviceId: testDeviceId })
  .pipe(Stream.runCollect, Effect.map(Chunk.toArray))

expect(readings.length).toBe(3)
expect(readings[0]._tag).toBe('SensorReading')
```

**Examples:**
- `src/lib/iiot/__tests__/integration/time-series.test.ts:191-203`
- `src/lib/iiot/__tests__/repos/readings.integration.test.ts:360-377`

### 6.5 DateTime Assertions

**Pattern:**
```typescript
expect(DateTime.isDateTime(plant.createdAt)).toBe(true)

const createdAtDate = DateTime.toDate(plant.createdAt)
expect(createdAtDate.getTime()).toBeLessThanOrEqual(now.getTime())
```

**Examples:**
- `src/lib/iiot/__tests__/repos/assets.integration.test.ts:79-84`
- `src/lib/iiot/__tests__/models.integration.test.ts:344-350`

---

## 7. Repository Test Patterns

### 7.1 Insert Tests

**Pattern: Basic Insert**
```typescript
it('should insert entity with all fields', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const plantRepo = yield* PlantRepo
      return yield* plantRepo.insert(testPlant1Insert)
    }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
  )

  expect(result.id).toBe(testIds.plant1)
  expect(result.name).toBe('Test Plant Alpha')
  expect(DateTime.isDateTime(result.createdAt)).toBe(true)
})
```

**Pattern: Insert Batch (UNNEST)**
```typescript
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
```

**Examples:**
- `src/lib/iiot/__tests__/repos/assets.integration.test.ts:70-84`
- `src/lib/iiot/__tests__/repos/readings.integration.test.ts:163-179`

### 7.2 FindById Tests

**Pattern:**
```typescript
it('should find entity by ID', async () => {
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
})

it('should return None for non-existent ID', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const plantRepo = yield* PlantRepo
      return yield* plantRepo.findById(testIds.nonExistentPlant)
    }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
  )

  expect(Option.isNone(result)).toBe(true)
})
```

**Examples:**
- `src/lib/iiot/__tests__/repos/assets.integration.test.ts:115-139`
- `src/lib/iiot/__tests__/repos/alarms.integration.test.ts:139-168`

### 7.3 Update Tests

**Pattern: Partial Update**
```typescript
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
  // Location unchanged
  expect(Option.getOrNull(result.location)).toBe('Test Location A')
})
```

**Examples:**
- `src/lib/iiot/__tests__/repos/assets.integration.test.ts:193-209`
- `src/lib/iiot/__tests__/repos/assets.integration.test.ts:478-490`

### 7.4 Delete Tests

**Pattern:**
```typescript
it('should delete entity', async () => {
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

it('should not error when deleting non-existent entity', async () => {
  // Should not throw
  await Effect.runPromise(
    Effect.gen(function* () {
      const plantRepo = yield* PlantRepo
      yield* plantRepo.delete(testIds.nonExistentPlant)
    }).pipe(Effect.provide(AssetRepositoriesIntegrationLayer))
  )
})
```

**Examples:**
- `src/lib/iiot/__tests__/repos/assets.integration.test.ts:215-236`
- `src/lib/iiot/__tests__/repos/alarms.integration.test.ts:395-412`

### 7.5 Query Tests

**Pattern: Query with Filters**
```typescript
it('should query with filters', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const alarmRepo = yield* AlarmRepo
      yield* alarmRepo.insert(testAlarm1Insert) // warning
      yield* alarmRepo.insert(testAlarm2Insert) // critical
      return yield* alarmRepo.query({ severity: 'critical' })
    }).pipe(Effect.provide(RepositoriesIntegrationLayer))
  )

  const testResults = result.filter(a => a.deviceId === testIds.device1)
  expect(testResults.length).toBe(1)
  expect(testResults[0].severity).toBe('critical')
})
```

**Examples:**
- `src/lib/iiot/__tests__/repos/alarms.integration.test.ts:238-257`
- `src/lib/iiot/__tests__/repos/readings.integration.test.ts:301-320`

### 7.6 Composite Key Tests

**Pattern: findByKey with Composite PK**
```typescript
it('should find reading by composite key (time, deviceId)', async () => {
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
```

**Examples:**
- `src/lib/iiot/__tests__/repos/readings.integration.test.ts:97-120`
- `src/lib/iiot/__tests__/repos/readings.integration.test.ts:583-606`

---

## 8. Service Test Patterns

### 8.1 L1 Service Tests (Clients)

**Purpose:** Test low-level TimescaleDB and Apache AGE operations

**Pattern:**
```typescript
it.effect('Given valid readings, When inserting, Then it should return insert count', () =>
  Effect.gen(function* () {
    const client = yield* TimeSeriesClient

    const readings = [
      { time: new Date(), deviceId: testDeviceId, value: 25.5, quality: 100 },
      { time: new Date(), deviceId: testDeviceId, value: 26.0, quality: 100 },
    ]

    const count = yield* client.insertReadings(readings)
    expect(count).toBe(2)
  }).pipe(Effect.provide(TimeSeriesClient.Default))
)
```

**Examples:**
- `src/lib/iiot/__tests__/services.test.ts:43-55` - TimeSeriesClient insert
- `src/lib/iiot/__tests__/services.test.ts:99-109` - GraphClient Cypher query
- `src/lib/iiot/__tests__/l1-clients.test.ts:31-50` - Insert sensor readings

### 8.2 L2 Service Tests (Domain Services)

**Purpose:** Test domain-level operations (validation, business logic)

**Pattern:**
```typescript
it.effect('Given readings with invalid values, When ingesting, Then should reject', () =>
  Effect.gen(function* () {
    const service = yield* SensorService

    const result = yield* service
      .ingestReadings([{ time: new Date(), deviceId: testDeviceId, value: NaN }])
      .pipe(Effect.either)

    expect(result._tag).toBe('Left')
  }).pipe(Effect.provide(SensorService.Default))
)
```

**Examples:**
- `src/lib/iiot/__tests__/services.test.ts:134-146` - SensorService validation
- `src/lib/iiot/__tests__/l2-services.test.ts:254-275` - AlarmService create
- `src/lib/iiot/__tests__/services.test.ts:270-290` - AlarmService acknowledge

### 8.3 L3 Service Tests (Orchestration)

**Purpose:** Test cross-domain operations (sensors + alarms + assets)

**Pattern:**
```typescript
it.effect('Given alarm params, When raising, Then should include context', () =>
  Effect.gen(function* () {
    const service = yield* IIoTService

    const enrichedAlert = yield* service.raiseAlarm({
      deviceId: testDeviceId,
      alarmType: 'threshold_exceeded',
      severity: 'critical',
      message: 'Temperature critical: 95C',
    })

    expect(enrichedAlert).toHaveProperty('alarm')
    expect(enrichedAlert).toHaveProperty('hierarchy')
    expect(enrichedAlert).toHaveProperty('recentReadings')
    expect(enrichedAlert.alarm._tag).toBe('Alarm')
    expect(enrichedAlert.alarm.severity).toBe('critical')
  }).pipe(Effect.provide(IIoTService.Default))
)
```

**Examples:**
- `src/lib/iiot/__tests__/services.test.ts:424-442` - Raise alarm with enrichment
- `src/lib/iiot/__tests__/l3-orchestration.test.ts:47-62` - Get machine health
- `src/lib/iiot/__tests__/services.test.ts:406-421` - Get machine health summary

---

## 9. How Repos Are Tested

### 9.1 Asset Repos (Plant, Line, Machine, Sensor)

**Test Coverage:**
- Insert (single entity)
- FindById (Option-returning)
- FindAll (array-returning)
- Update (partial updates)
- Delete (idempotent)
- FK constraints (insert failures)
- Cascade behavior

**Key File:** `src/lib/iiot/__tests__/repos/assets.integration.test.ts`

**Example Test Flow:**
```typescript
describe('PlantRepo Integration', () => {
  beforeAll(/* check DB */)
  beforeEach(/* cleanup */)
  afterAll(/* final cleanup */)

  it('should insert a plant with all fields')
  it('should insert a plant with optional location as None')
  it('should fail to insert duplicate plant ID')
  it('should find plant by ID')
  it('should return None for non-existent plant')
  it('should return empty array when no plants exist')
  it('should find all plants ordered by name')
  it('should update plant fields')
  it('should update only provided fields (partial update)')
  it('should delete plant')
  it('should not error when deleting non-existent plant')
})
```

### 9.2 Alarm Repos (Alarm, AlarmContext)

**Test Coverage:**
- Insert with auto-generated ID
- FindById / FindByDevice
- Query with filters (severity, onlyOpen, limit)
- Acknowledge (idempotent)
- Clear (idempotent)
- Delete
- AlarmContext materialized view refresh
- AlarmContext time window queries

**Key File:** `src/lib/iiot/__tests__/repos/alarms.integration.test.ts`

**AlarmContext Pattern:**
```typescript
beforeEach(async () => {
  // Insert hierarchy
  yield* plantRepo.insert(testPlant1Insert)
  yield* lineRepo.insert(testLine1Insert)
  yield* machineRepo.insert(testMachine1Insert)
  yield* sensorRepo.insert(testSensor1Insert)

  // Create alarm (triggeredAt auto-set)
  const alarm = yield* alarmRepo.insert(testAlarm1Insert)

  // Create sensor readings ±5 min around alarm
  const triggeredAt = DateTime.toDate(alarm.triggeredAt)
  const readings = [
    { time: new Date(triggeredAt.getTime() - 4 * 60 * 1000), deviceId, value: 78.0 },
    { time: new Date(triggeredAt.getTime() - 2 * 60 * 1000), deviceId, value: 82.5 },
    { time: new Date(triggeredAt.getTime() + 1 * 60 * 1000), deviceId, value: 85.0 },
  ]
  yield* readingRepo.insertBatch(readings)
})

it('should find context after refresh', async () => {
  const contextRepo = yield* AlarmContextRepo
  yield* contextRepo.refresh() // Refresh materialized view
  const context = yield* contextRepo.findByAlarm(testAlarmId)

  expect(context.length).toBe(3)
  expect(context[0].offsetSeconds).toBeCloseTo(-240, 0) // -4 min
})
```

### 9.3 Reading Repos (SensorReading, AggregatedReading, AnalyticsRecord)

**Test Coverage:**
- Insert (single)
- InsertBatch (UNNEST pattern)
- Upsert on conflict (composite PK)
- FindByKey (composite PK)
- GetLatest (newest timestamp)
- QueryByDevice (time range, limit)
- StreamByDevice (Effect Stream)
- Aggregated queries (time buckets)

**Key File:** `src/lib/iiot/__tests__/repos/readings.integration.test.ts`

**Composite Key Pattern:**
```typescript
it('should insert sensor reading with composite PK (time, deviceId)', async () => {
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
  const reading = Option.getOrThrow(result)
  expect(reading.value).toBe(25.5)
  expect(reading.quality).toBe(100)
})
```

**Batch Insert Pattern (UNNEST):**
```typescript
it('should insert batch of readings with UNNEST', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const readingRepo = yield* SensorReadingRepo
      yield* readingRepo.insertBatch(testSensorReadingBatch) // UNNEST in SQL
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
```

---

## 10. Testing Patterns to Preserve for v3

### 10.1 Layer Composition Pattern

**Why:** Enables swapping implementations (mock vs real DB) without changing test code.

**Preserve:**
- Test layer definitions in `__tests__/integration/layer.ts`
- Layer merging via `Layer.mergeAll`
- Layer overriding via `Layer.provide`
- Migrations auto-run on layer build

**Example:**
```typescript
// Composable layers
const TestLayer = Layer.mergeAll(
  TestPgClient,
  RepositoriesLive,
  ServicesLive
)

// Tests use layers without knowing implementation
it.effect('test', () =>
  Effect.gen(function* () {
    const service = yield* MyService
    // ...
  }).pipe(Effect.provide(TestLayer))
)
```

### 10.2 @effect/vitest Pattern

**Why:** Eliminates boilerplate, enables Effect-native testing.

**Preserve:**
- `it.effect()` for Effect programs
- `it.scoped()` for scoped resources
- Direct `yield*` of services
- No manual `Effect.runPromise`

**Example:**
```typescript
it.effect('test name', () =>
  Effect.gen(function* () {
    const service = yield* MyService
    const result = yield* service.operation()
    expect(result).toBe(expected)
  }).pipe(Effect.provide(MyService.Default))
)
```

### 10.3 Cleanup Utilities Pattern

**Why:** Prevents test pollution, enables FK-safe cleanup.

**Preserve:**
- Separate cleanup functions per domain
- FK-aware ordering (children → parents)
- `Effect.orElseSucceed(() => undefined)` for missing data
- `withCleanDatabase` wrapper
- TEST- prefix convention

**Example:**
```typescript
export const cleanTestAssets = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  // FK order: Sensors → Machines → Lines → Plants
  yield* sql`DELETE FROM iiot.sensors WHERE device_id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.machines WHERE id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.lines WHERE id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.plants WHERE id LIKE 'TEST-%'`
})
```

### 10.4 Option Assertion Pattern

**Why:** Effect Option type requires specific assertions.

**Preserve:**
- `Option.isSome()` / `Option.isNone()` checks
- `Option.getOrThrow()` for extraction
- `Option.getOrNull()` for nullable assertions

**Example:**
```typescript
const result = yield* repo.findById(id)
expect(Option.isSome(result)).toBe(true)
const entity = Option.getOrThrow(result)
expect(entity.id).toBe(id)
```

### 10.5 Effect.either Error Testing Pattern

**Why:** Test error paths without throwing exceptions.

**Preserve:**
- `pipe(Effect.either)` for expected errors
- `result._tag` checks for Left/Right
- Error type extraction via `result.left._tag`

**Example:**
```typescript
const result = yield* service.operation().pipe(Effect.either)
expect(result._tag).toBe('Left')
if (result._tag === 'Left') {
  expect(result.left._tag).toBe('ValidationError')
}
```

### 10.6 Integration Test Flag Pattern

**Why:** Separates fast unit tests from slow integration tests.

**Preserve:**
- `RUN_INTEGRATION_TESTS=1` environment variable
- `describe.skipIf(!RUN_INTEGRATION)` pattern
- Database availability checks in `beforeAll`

**Example:**
```typescript
const RUN_INTEGRATION = process.env['RUN_INTEGRATION_TESTS'] === '1'

describe.skipIf(!RUN_INTEGRATION)('Repo Integration', () => {
  beforeAll(async () => {
    const available = await Effect.runPromise(isDatabaseAvailable)
    if (!available) throw new Error('Database not available')
  })
  // ... tests
})
```

### 10.7 Fixture Type Safety Pattern

**Why:** Ensures test data matches Model types.

**Preserve:**
- Fixtures typed as `Model['insert']['Type']`
- Branded type usage in fixtures
- Option.some/Option.none for optionals
- Reusable fixture modules

**Example:**
```typescript
// fixtures.ts
export const testPlant1Insert: PlantModel['insert']['Type'] = {
  id: 'TEST-PLANT-001' as PlantId, // Branded type
  name: 'Test Plant Alpha',
  location: Option.some('Test Location A'), // Option type
}
```

### 10.8 Stream Testing Pattern

**Why:** Effect Streams require specific collection patterns.

**Preserve:**
- `Stream.runCollect` for full collection
- `Effect.map(Chunk.toArray)` for array conversion
- `Stream.take(n)` for limiting infinite streams

**Example:**
```typescript
const readings = yield* client
  .queryReadings({ deviceId })
  .pipe(Stream.runCollect, Effect.map(Chunk.toArray))

expect(readings.length).toBe(3)
```

### 10.9 Composite Key Testing Pattern

**Why:** IIoT uses composite PKs extensively (time, deviceId).

**Preserve:**
- `findByKey(key1, key2)` patterns
- Upsert on conflict tests
- Composite key in batch operations

**Example:**
```typescript
const reading = yield* repo.findByKey(time, deviceId)
expect(Option.isSome(reading)).toBe(true)
```

### 10.10 BDD Test Naming Pattern

**Why:** Tests read as specifications.

**Preserve:**
- "Given/When/Then" structure in test names
- Feature/Scenario hierarchy
- Descriptive test names

**Example:**
```typescript
describe('Feature: SensorService Operations', () => {
  describe('Scenario: Ingest sensor readings', () => {
    it('Given valid readings, When ingesting, Then it should return count', () => {
      // ...
    })
  })
})
```

---

## 11. Code Examples from Actual Implementation

### 11.1 Schema Validation Test

**File:** `src/lib/iiot/__tests__/schemas.test.ts`

```typescript
describe('Feature: Branded Identifiers', () => {
  describe('Scenario: Valid identifier encoding', () => {
    it('Given a valid string, When encoding as PlantId, Then it should succeed', () => {
      const result = Schema.decodeUnknownSync(PlantId)('PLANT-001')
      expect(result).toBe('PLANT-001')
    })

    it('Given a number, When encoding as PlantId, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(PlantId)(123)).toThrow()
    })
  })
})
```

### 11.2 Service Integration Test

**File:** `src/lib/iiot/__tests__/services.test.ts`

```typescript
it.effect('Given valid readings, When ingesting, Then should succeed', () =>
  Effect.gen(function* () {
    const service = yield* SensorService

    const count = yield* service.ingestReadings([
      { time: new Date(), deviceId: TestDeviceId, value: 25.5 },
      { time: new Date(), deviceId: TestDeviceId, value: 26.0, quality: 95 },
    ])

    expect(count).toBe(2)
  }).pipe(Effect.provide(SensorService.Default))
)
```

### 11.3 Hybrid Query Integration Test

**File:** `src/lib/iiot/__tests__/integration/hybrid.test.ts`

```typescript
it('should join graph traversal with time series data via CTE', async () => {
  if (!dbAvailable) return

  const program = Effect.gen(function* () {
    const sql = yield* PgClient.PgClient

    // Set search path for AGE
    yield* sql.unsafe(`SET search_path = ag_catalog, iiot, public`)

    // Hybrid query: Get sensors from graph, join with time series
    const result = yield* sql.unsafe<{
      deviceId: string
      sensorType: string
      readingCount: string
    }>(`
      WITH machine_sensors AS (
        SELECT
          device_id::text AS device_id,
          sensor_type::text AS sensor_type
        FROM cypher('iiot_graph', $$
          MATCH (m:machine {id: 'MCH-001'})<-[:monitors]-(s:sensor)
          RETURN s.device_id AS device_id, s.type AS sensor_type
        $$) AS (device_id agtype, sensor_type agtype)
      )
      SELECT
        ms.device_id,
        ms.sensor_type,
        COALESCE(COUNT(sr.time), 0) AS reading_count
      FROM machine_sensors ms
      LEFT JOIN iiot.sensor_readings sr ON sr.device_id = ms.device_id
      GROUP BY ms.device_id, ms.sensor_type
      ORDER BY ms.device_id
    `)

    expect(Array.isArray(result)).toBe(true)
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('deviceId')
      expect(result[0]).toHaveProperty('sensorType')
      expect(result[0]).toHaveProperty('readingCount')
    }
  }).pipe(Effect.provide(IIoTIntegrationLayer))

  await Effect.runPromise(program)
})
```

### 11.4 Repository Composite Key Test

**File:** `src/lib/iiot/__tests__/repos/readings.integration.test.ts`

```typescript
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
```

### 11.5 Materialized View Refresh Test

**File:** `src/lib/iiot/__tests__/repos/alarms.integration.test.ts`

```typescript
it('should find all context records for an alarm after refresh', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const contextRepo = yield* AlarmContextRepo
      // Refresh the materialized view to pick up the test data
      yield* contextRepo.refresh()
      return yield* contextRepo.findByAlarm(testAlarmId)
    }).pipe(Effect.provide(RepositoriesIntegrationLayer))
  )

  expect(result.length).toBe(3)
  // Should be ordered by reading_time ASC
  expect(result[0].value).toBe(78.0)
  expect(result[1].value).toBe(82.5)
  expect(result[2].value).toBe(85.0)
})

it('should return correct offset_seconds', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const contextRepo = yield* AlarmContextRepo
      yield* contextRepo.refresh()
      return yield* contextRepo.findByAlarm(testAlarmId)
    }).pipe(Effect.provide(RepositoriesIntegrationLayer))
  )

  expect(result.length).toBe(3)
  // First reading: 4 minutes before alarm = -240 seconds
  expect(result[0].offsetSeconds).toBeCloseTo(-240, 0)
  // Second reading: 2 minutes before alarm = -120 seconds
  expect(result[1].offsetSeconds).toBeCloseTo(-120, 0)
  // Third reading: 1 minute after alarm = +60 seconds
  expect(result[2].offsetSeconds).toBeCloseTo(60, 0)
})
```

### 11.6 Model Type Variant Test

**File:** `src/lib/iiot/__tests__/models.integration.test.ts`

```typescript
describe('Model.GeneratedByApp Integration', () => {
  it('should require id in insert type (GeneratedByApp)', async () => {
    // PlantModel.id is Model.GeneratedByApp - must be provided by client
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        return yield* plantRepo.insert(testPlant1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    // The ID should exactly match what we provided
    expect(result.id).toBe(testIds.plant1)
  })
})

describe('Model.Generated Integration', () => {
  it('should exclude id from insert type (Generated)', async () => {
    // AlarmModel.id is Model.Generated - should be auto-generated by DB
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const alarmRepo = yield* AlarmRepo
        // testAlarm1Insert does NOT have id field - it's excluded from insert type
        return yield* alarmRepo.insert(testAlarm1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    // The ID should be auto-generated and non-empty
    expect(result.id).toBeDefined()
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
  })
})

describe('Model.FieldOption Integration', () => {
  it('should store Option.some as non-NULL value', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        return yield* plantRepo.insert(testPlant1Insert)
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isSome(result.location)).toBe(true)
    expect(Option.getOrNull(result.location)).toBe('Test Location A')
  })

  it('should store Option.none as NULL value', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const plantRepo = yield* PlantRepo
        return yield* plantRepo.insert(testPlant2Insert) // Has location: None
      }).pipe(Effect.provide(RepositoriesIntegrationLayer))
    )

    expect(Option.isNone(result.location)).toBe(true)
  })
})
```

### 11.7 TDD Seed Test (Test-First Pattern)

**File:** `src/lib/iiot/__tests__/seed/seed-assets.integration.test.ts`

```typescript
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

describe.skipIf(!RUN_INTEGRATION)('seedPlants', () => {
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
  })

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
  })
})
```

---

## Summary

The IIoT test suite demonstrates advanced Effect-TS testing patterns:

1. **@effect/vitest integration** - Effect-native testing without manual promise handling
2. **Layer composition** - Swappable implementations via dependency injection
3. **Real database testing** - TimescaleDB + Apache AGE integration tests
4. **Type-safe fixtures** - Model.insert.Type ensures test data matches schemas
5. **Option/Either assertions** - Effect-specific assertion patterns
6. **Composite key handling** - Testing repositories with multi-column PKs
7. **Stream testing** - Effect Stream collection and assertion patterns
8. **BDD test structure** - Given/When/Then naming for readability
9. **Cleanup utilities** - FK-aware cleanup with Effect programs
10. **TDD approach** - Tests written before implementation (seed tests)

All patterns should be preserved in the v3 rewrite to maintain test quality and Effect-native idioms.
