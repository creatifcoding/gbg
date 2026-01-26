# TDD Test Plan: IIoT Models and Repositories Layer

Generated: 2026-01-25

## Goal

Design exhaustive TDD test cases for the IIoT Models (9 Model.Class definitions) and Repositories (9 Repository implementations) to ensure:
- Model schemas produce correct Type variants (Type, insert.Type, update.Type)
- Model transforms (Generated, GeneratedByApp, FieldOption, DateTime) work correctly
- Repository methods implement correct SQL queries and return proper types
- Edge cases and error conditions are handled appropriately

## Research Summary

### Effect SQL Testing Patterns (via deepwiki)
- Use `@effect/vitest` with `it.effect()` for Effect programs
- Provide real database clients via `Layer` (not mocking SqlClient interface)
- Use `Effect.provide()` or `it.layer()` to inject dependencies
- `it.scoped` for tests requiring `Scope` for resource management

### Existing Codebase Patterns (from integration tests)
- `TestPgClient` layer with hardcoded connection config
- `withCleanDatabase()` wrapper for test isolation
- `isDatabaseAvailable` check for conditional test execution
- `transformResultNames` for snake_case to camelCase mapping

---

## Test File Organization

```
src/lib/iiot/__tests__/
  models/
    assets.model.test.ts      # PlantModel, LineModel, MachineModel, SensorModel
    alarms.model.test.ts      # AlarmModel, AlarmContextModel
    readings.model.test.ts    # SensorReadingModel, AggregatedReadingModel, AnalyticsRecordModel

  repos/
    unit/
      PlantRepo.unit.test.ts
      LineRepo.unit.test.ts
      MachineRepo.unit.test.ts
      SensorRepo.unit.test.ts
      AlarmRepo.unit.test.ts
      AlarmContextRepo.unit.test.ts
      SensorReadingRepo.unit.test.ts
      AggregatedReadingRepo.unit.test.ts
      AnalyticsRecordRepo.unit.test.ts

    integration/
      asset-repos.integration.test.ts    # Plant, Line, Machine, Sensor lifecycle
      alarm-repos.integration.test.ts    # Alarm, AlarmContext lifecycle
      reading-repos.integration.test.ts  # SensorReading, Aggregated, Analytics lifecycle
      cascade.integration.test.ts        # FK constraint behavior
      concurrent.integration.test.ts     # Concurrent operations

  layer.ts                    # Test layers and utilities (already exists)
```

---

## Test Category 1: Model Schema Tests

### 1.1 Asset Models (assets.model.test.ts)

#### PlantModel
```typescript
describe('Feature: PlantModel Schema', () => {
  describe('Scenario: Type variants', () => {
    it('Given PlantModel.Type, Then it should have all fields including generated timestamps')
    it('Given PlantModel.insert.Type, Then it should require id and name, exclude timestamps')
    it('Given PlantModel.update.Type, Then id should be required, other fields optional')
  })

  describe('Scenario: Model.GeneratedByApp(PlantId)', () => {
    it('Given insert.Type, When id is provided, Then it should be included in insert')
    it('Given insert.Type, When id is missing, Then type check should fail')
  })

  describe('Scenario: Model.FieldOption for location', () => {
    it('Given location as Some(string), When encoding, Then it should produce string value')
    it('Given location as None, When encoding, Then it should produce null')
    it('Given null from DB, When decoding, Then it should produce Option.none()')
    it('Given string from DB, When decoding, Then it should produce Option.some(value)')
  })

  describe('Scenario: Timestamp transforms', () => {
    it('Given CreatedAt field, When inserting, Then it should auto-set to current time')
    it('Given UpdatedAt field, When updating, Then it should auto-update to current time')
    it('Given Date from DB, When decoding createdAt/updatedAt, Then it should produce DateTime')
  })
})
```

#### LineModel
```typescript
describe('Feature: LineModel Schema', () => {
  describe('Scenario: Type variants', () => {
    it('Given LineModel.Type, Then it should have id, name, plantId, timestamps')
    it('Given LineModel.insert.Type, Then it should require id, name, plantId')
    it('Given LineModel.update.Type, Then id should be required, name optional')
  })

  describe('Scenario: Foreign key reference', () => {
    it('Given plantId, Then it should be PlantId branded type')
  })
})
```

#### MachineModel
```typescript
describe('Feature: MachineModel Schema', () => {
  describe('Scenario: Type variants', () => {
    it('Given MachineModel.Type, Then it should have id, name, lineId, model (optional), timestamps')
    it('Given MachineModel.insert.Type, Then it should require id, name, lineId; model optional')
  })

  describe('Scenario: Model.FieldOption for model field', () => {
    it('Given model as Some(string), When encoding, Then it should produce string')
    it('Given model as None, When encoding, Then it should produce null')
  })
})
```

#### SensorModel
```typescript
describe('Feature: SensorModel Schema', () => {
  describe('Scenario: Type variants', () => {
    it('Given SensorModel.Type, Then it should have deviceId as PK, type, unit, machineId')
    it('Given SensorModel.insert.Type, Then deviceId should be required (GeneratedByApp)')
  })

  describe('Scenario: SensorType/SensorUnit enums', () => {
    it('Given valid type value, When decoding, Then it should succeed')
    it('Given invalid type value, When decoding, Then it should fail')
  })
})
```

### 1.2 Alarm Models (alarms.model.test.ts)

#### AlarmModel
```typescript
describe('Feature: AlarmModel Schema', () => {
  describe('Scenario: Type variants', () => {
    it('Given AlarmModel.Type, Then it should have id (Generated), deviceId, alarmType, severity, optional fields')
    it('Given AlarmModel.insert.Type, Then id should be excluded (Generated), deviceId/alarmType/severity required')
    it('Given AlarmModel.update.Type, Then id required, all others optional')
  })

  describe('Scenario: Model.Generated(AlarmId)', () => {
    it('Given insert.Type, Then id field should not be present')
    it('Given returned row from INSERT, Then id should be populated by DB')
  })

  describe('Scenario: Multiple FieldOption fields', () => {
    it('Given message as None, When encoding, Then produce null')
    it('Given acknowledgedAt as None, When encoding, Then produce null')
    it('Given clearedAt as None, When encoding, Then produce null')
    it('Given acknowledgedBy as None, When encoding, Then produce null')
  })

  describe('Scenario: OptionalMetadata (JsonFromString + FieldOption)', () => {
    it('Given metadata as Some(Record), When encoding, Then produce JSON string')
    it('Given metadata as None, When encoding, Then produce null')
    it('Given JSON string from DB, When decoding, Then produce Option.some(Record)')
    it('Given null from DB, When decoding, Then produce Option.none()')
    it('Given invalid JSON from DB, When decoding, Then it should fail gracefully')
  })

  describe('Scenario: CreatedAt as triggeredAt', () => {
    it('Given triggeredAt uses CreatedAt, When inserting, Then auto-set current time')
  })
})
```

#### AlarmContextModel
```typescript
describe('Feature: AlarmContextModel Schema', () => {
  describe('Scenario: Composite PK (alarmId, readingTime)', () => {
    it('Given AlarmContextModel.Type, Then it should have alarmId, deviceId, readingTime, value, offsetFromAlarm')
    it('Given AlarmContextModel.insert.Type, Then all fields required (no Generated)')
  })

  describe('Scenario: Date transform for readingTime', () => {
    it('Given Date object, When encoding readingTime, Then produce Date')
    it('Given Date from DB, When decoding readingTime, Then produce Date')
  })

  describe('Scenario: offsetFromAlarm field', () => {
    it('Given Duration/string value, When encoding, Then produce interval-compatible string')
  })
})
```

### 1.3 Reading Models (readings.model.test.ts)

#### SensorReadingModel
```typescript
describe('Feature: SensorReadingModel Schema', () => {
  describe('Scenario: Composite PK (time, deviceId)', () => {
    it('Given SensorReadingModel.Type, Then it should have time, deviceId, value, quality')
    it('Given SensorReadingModel.insert.Type, Then all fields required')
  })

  describe('Scenario: Quality field constraints', () => {
    it('Given quality 0-100, When decoding, Then succeed')
    it('Given quality outside range, When decoding, Then fail')
  })
})
```

#### AggregatedReadingModel
```typescript
describe('Feature: AggregatedReadingModel Schema', () => {
  describe('Scenario: Composite PK (bucket, deviceId)', () => {
    it('Given AggregatedReadingModel.Type, Then it should have bucket, deviceId, avgValue, minValue, maxValue, stddevValue (optional), sampleCount')
  })

  describe('Scenario: stddevValue as FieldOption', () => {
    it('Given stddevValue as Some(number), When encoding, Then produce number')
    it('Given stddevValue as None, When encoding, Then produce null')
  })
})
```

#### AnalyticsRecordModel
```typescript
describe('Feature: AnalyticsRecordModel Schema', () => {
  describe('Scenario: Composite PK (hour, deviceId)', () => {
    it('Given AnalyticsRecordModel.Type, Then it should have hour, deviceId, aggregation fields')
    it('Given hour field, When decoding from DB Date, Then produce Date object')
  })

  describe('Scenario: stddev as FieldOption', () => {
    it('Given stddev as Some(number), Then encode as number')
    it('Given stddev as None, Then encode as null')
  })
})
```

---

## Test Category 2: Repository Unit Tests (Mocked SQL)

### 2.1 Test Infrastructure

```typescript
// repos/unit/_test-utils.ts

/**
 * Mock SqlClient that captures queries for inspection
 */
export interface MockSqlClient {
  queries: Array<{ sql: string; params: unknown[] }>
  setNextResult: <T>(result: T[]) => void
}

export const makeMockSqlClient = (): Layer.Layer<SqlClient.SqlClient> => {
  // Implementation captures sql template strings and returns preset results
}

/**
 * Extract repository for unit testing
 */
export const runRepoTest = <R, A>(
  repoLive: Layer.Layer<R, never, SqlClient.SqlClient>,
  test: Effect.Effect<A, never, R>
): Effect.Effect<{ result: A; queries: MockQuery[] }>
```

### 2.2 Asset Repository Unit Tests

#### PlantRepo.unit.test.ts
```typescript
describe('Feature: PlantRepo Unit Tests', () => {
  describe('Scenario: findById query generation', () => {
    it('Given valid PlantId, When calling findById, Then generate correct SELECT with WHERE id = $1')
    it('Given findById returns row, Then return Option.some(PlantModel)')
    it('Given findById returns empty, Then return Option.none()')
  })

  describe('Scenario: findAll query generation', () => {
    it('When calling findAll, Then generate SELECT with ORDER BY name ASC')
    it('Given empty table, When calling findAll, Then return empty array')
  })

  describe('Scenario: insert query generation', () => {
    it('Given insert.Type, When calling insert, Then generate INSERT with RETURNING')
    it('Given location is undefined, When calling insert, Then pass null for location')
    it('Given location is defined, When calling insert, Then pass string for location')
  })

  describe('Scenario: update query generation', () => {
    it('Given update.Type with partial fields, When calling update, Then use COALESCE for optional fields')
    it('Given update sets updated_at = NOW(), Then verify SQL includes NOW()')
  })

  describe('Scenario: delete query generation', () => {
    it('Given PlantId, When calling delete, Then generate DELETE WHERE id = $1')
    it('When delete completes, Then return void (Effect.asVoid)')
  })
})
```

#### LineRepo.unit.test.ts
```typescript
describe('Feature: LineRepo Unit Tests', () => {
  describe('Scenario: findByPlant query generation', () => {
    it('Given PlantId, When calling findByPlant, Then generate SELECT WHERE plant_id = $1')
    it('Then ORDER BY name ASC')
  })

  describe('Scenario: insert with FK reference', () => {
    it('Given plantId in insert.Type, When calling insert, Then include plantId in VALUES')
  })
})
```

#### MachineRepo.unit.test.ts
```typescript
describe('Feature: MachineRepo Unit Tests', () => {
  describe('Scenario: findByLine query generation', () => {
    it('Given LineId, When calling findByLine, Then generate SELECT WHERE line_id = $1')
  })

  describe('Scenario: optional model field handling', () => {
    it('Given model is undefined, When calling insert, Then pass null')
    it('Given model is defined, When calling insert, Then pass string')
    it('Given update with model, When calling update, Then COALESCE handles optional')
  })
})
```

#### SensorRepo.unit.test.ts
```typescript
describe('Feature: SensorRepo Unit Tests', () => {
  describe('Scenario: findByDeviceId (different PK name)', () => {
    it('Given DeviceId, When calling findByDeviceId, Then SELECT WHERE device_id = $1')
  })

  describe('Scenario: findByMachine', () => {
    it('Given MachineId, When calling findByMachine, Then SELECT WHERE machine_id = $1')
    it('Then ORDER BY device_id ASC')
  })
})
```

### 2.3 Alarm Repository Unit Tests

#### AlarmRepo.unit.test.ts
```typescript
describe('Feature: AlarmRepo Unit Tests', () => {
  describe('Scenario: findById with Generated PK', () => {
    it('Given AlarmId, When calling findById, Then SELECT WHERE id = $1')
  })

  describe('Scenario: findByDevice', () => {
    it('Given DeviceId, When calling findByDevice, Then SELECT WHERE device_id = $1 ORDER BY triggered_at DESC')
  })

  describe('Scenario: findOpen', () => {
    it('When calling findOpen, Then SELECT WHERE cleared_at IS NULL')
  })

  describe('Scenario: query with filters', () => {
    it('Given deviceId filter, When calling query, Then include device_id condition')
    it('Given severity filter, When calling query, Then include severity condition')
    it('Given onlyOpen = true, When calling query, Then include cleared_at IS NULL')
    it('Given since Date, When calling query, Then include triggered_at >= $since')
    it('Given limit, When calling query, Then include LIMIT $limit')
    it('Given no filters, When calling query, Then use defaults (1=1, LIMIT 1000)')
  })

  describe('Scenario: insert without id (Generated)', () => {
    it('Given insert.Type (no id), When calling insert, Then INSERT without id column')
    it('Then RETURNING includes auto-generated id')
  })

  describe('Scenario: acknowledge', () => {
    it('Given AlarmId and acknowledgedBy, When calling acknowledge, Then UPDATE SET acknowledged_at = NOW(), acknowledged_by = $2')
    it('Then WHERE id = $1 AND acknowledged_at IS NULL (idempotent)')
  })

  describe('Scenario: clear', () => {
    it('Given AlarmId, When calling clear, Then UPDATE SET cleared_at = NOW()')
    it('Then WHERE id = $1 AND cleared_at IS NULL (idempotent)')
  })
})
```

#### AlarmContextRepo.unit.test.ts
```typescript
describe('Feature: AlarmContextRepo Unit Tests', () => {
  describe('Scenario: insert with composite PK', () => {
    it('Given insert.Type, When calling insert, Then INSERT all fields')
    it('Then ON CONFLICT (alarm_id, reading_time) DO UPDATE for upsert')
  })

  describe('Scenario: insertBatch', () => {
    it('Given array of contexts, When calling insertBatch, Then use UNNEST for efficient batch')
    it('Given empty array, When calling insertBatch, Then return early (no SQL)')
  })

  describe('Scenario: findByAlarm', () => {
    it('Given AlarmId, When calling findByAlarm, Then SELECT WHERE alarm_id = $1 ORDER BY reading_time ASC')
  })

  describe('Scenario: findByAlarmWithWindow', () => {
    it('Given AlarmId and windowMs, When calling findByAlarmWithWindow, Then include ABS(EXTRACT...) filter')
  })

  describe('Scenario: deleteByAlarm', () => {
    it('Given AlarmId, When calling deleteByAlarm, Then DELETE WHERE alarm_id = $1')
  })
})
```

### 2.4 Reading Repository Unit Tests

#### SensorReadingRepo.unit.test.ts
```typescript
describe('Feature: SensorReadingRepo Unit Tests', () => {
  describe('Scenario: insert with composite PK', () => {
    it('Given insert.Type, When calling insert, Then INSERT (time, device_id, value, quality)')
    it('Then ON CONFLICT (time, device_id) DO UPDATE for upsert')
  })

  describe('Scenario: insertBatch with UNNEST', () => {
    it('Given array of readings, When calling insertBatch, Then use UNNEST with typed arrays')
    it('Given empty array, When calling insertBatch, Then return early')
  })

  describe('Scenario: findByKey (composite lookup)', () => {
    it('Given time and deviceId, When calling findByKey, Then SELECT WHERE time = $1 AND device_id = $2')
  })

  describe('Scenario: getLatest', () => {
    it('Given DeviceId, When calling getLatest, Then SELECT ORDER BY time DESC LIMIT 1')
  })

  describe('Scenario: queryByDevice with optional filters', () => {
    it('Given since/until undefined, When calling queryByDevice, Then use NULL checks in WHERE')
    it('Given limit undefined, When calling queryByDevice, Then default LIMIT 1000')
  })

  describe('Scenario: streamByDevice', () => {
    it('When calling streamByDevice, Then return Stream.fromEffect + Stream.flatMap(fromIterable)')
  })
})
```

#### AggregatedReadingRepo.unit.test.ts
```typescript
describe('Feature: AggregatedReadingRepo Unit Tests', () => {
  describe('Scenario: queryByDevice with bucket', () => {
    it('Given bucket parameter, When calling queryByDevice, Then include bucket_interval = $bucket')
    it('Given TimeBucket literal, Then use correct value in query')
  })

  describe('Scenario: getLatestBucket', () => {
    it('Given deviceId and bucket, When calling getLatestBucket, Then ORDER BY bucket DESC LIMIT 1')
    it('Then return Option.some or Option.none')
  })

  describe('Scenario: read-only repository (no insert/update)', () => {
    it('Then interface should not have insert method')
    it('Then interface should not have update method')
  })
})
```

#### AnalyticsRecordRepo.unit.test.ts
```typescript
describe('Feature: AnalyticsRecordRepo Unit Tests', () => {
  describe('Scenario: insert with composite PK', () => {
    it('Given insert.Type, When calling insert, Then INSERT (hour, device_id, ...)')
    it('Then ON CONFLICT (hour, device_id) DO UPDATE')
  })

  describe('Scenario: findByKey (composite)', () => {
    it('Given hour and deviceId, When calling findByKey, Then SELECT WHERE hour = $1 AND device_id = $2')
  })

  describe('Scenario: optional stddev handling', () => {
    it('Given stddev undefined, When calling insert, Then pass null')
  })
})
```

---

## Test Category 3: Repository Integration Tests

### 3.1 Test Infrastructure for Integration

```typescript
// repos/integration/_layer.ts

import { Layer, Redacted } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { IIoTRepositoriesLive } from '../../repos'

export const TestPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
  transformResultNames: (name) => name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
})

export const RepositoriesIntegrationLayer = IIoTRepositoriesLive.pipe(
  Layer.provide(TestPgClient)
)

export const cleanTestAssets = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`DELETE FROM iiot.sensors WHERE device_id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.machines WHERE id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.lines WHERE id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.plants WHERE id LIKE 'TEST-%'`
})

export const cleanTestAlarms = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`DELETE FROM iiot.alarm_context WHERE alarm_id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.alarms WHERE device_id LIKE 'TEST-%'`
})

export const cleanTestReadings = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`DELETE FROM iiot.sensor_readings WHERE device_id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.analytics_records WHERE device_id LIKE 'TEST-%'`
})
```

### 3.2 Asset Repository Integration Tests

#### asset-repos.integration.test.ts
```typescript
describe('Feature: Asset Repositories Integration', () => {

  describe('Scenario: Plant CRUD lifecycle', () => {
    it('Given new plant data, When inserting, Then return PlantModel with all fields')
    it('Given inserted plant, When findById, Then return Option.some(plant)')
    it('Given inserted plant, When findAll, Then include plant in results')
    it('Given existing plant, When updating name, Then return updated PlantModel')
    it('Given existing plant, When updating location from None to Some, Then persist change')
    it('Given existing plant, When deleting, Then findById returns Option.none()')
  })

  describe('Scenario: Line CRUD with Plant FK', () => {
    it('Given valid plantId, When inserting line, Then succeed')
    it('Given invalid plantId, When inserting line, Then fail with FK constraint error')
    it('Given plant with lines, When calling findByPlant, Then return all lines for plant')
    it('Given plant with lines, When deleting plant, Then lines should be cascade deleted or blocked')
  })

  describe('Scenario: Machine CRUD with Line FK', () => {
    it('Given valid lineId, When inserting machine, Then succeed')
    it('Given machine with optional model, When inserting with model = None, Then persist null')
    it('Given machine with optional model, When updating model, Then persist new value')
    it('Given line with machines, When calling findByLine, Then return all machines')
  })

  describe('Scenario: Sensor CRUD with Machine FK', () => {
    it('Given valid machineId, When inserting sensor, Then succeed')
    it('Given deviceId as PK, When inserting duplicate deviceId, Then fail with PK conflict')
    it('Given machine with sensors, When calling findByMachine, Then return all sensors')
    it('Given sensor with readings, When deleting sensor, Then handle FK constraint')
  })

  describe('Scenario: Full hierarchy creation', () => {
    it('Given Plant -> Line -> Machine -> Sensor hierarchy, When creating in order, Then all inserts succeed')
    it('Given full hierarchy, When querying from bottom up, Then can trace to plant')
  })
})
```

### 3.3 Alarm Repository Integration Tests

#### alarm-repos.integration.test.ts
```typescript
describe('Feature: Alarm Repositories Integration', () => {

  describe('Scenario: Alarm CRUD lifecycle', () => {
    it('Given alarm with deviceId, When inserting, Then return AlarmModel with Generated id')
    it('Given inserted alarm, When findById, Then return Option.some(alarm)')
    it('Given alarm with optional fields as None, When inserting, Then persist nulls')
    it('Given alarm with metadata, When inserting, Then metadata is stored as JSONB')
    it('Given existing alarm, When updating severity, Then persist change')
    it('Given existing alarm, When deleting, Then findById returns Option.none()')
  })

  describe('Scenario: Alarm query methods', () => {
    it('Given multiple alarms for device, When calling findByDevice, Then return all ordered by triggeredAt DESC')
    it('Given mix of open/cleared alarms, When calling findOpen, Then return only uncleared')
    it('Given alarms with different severities, When query with severity filter, Then filter works')
    it('Given alarms since date, When query with since filter, Then filter works')
    it('Given alarms with limit, When query with limit, Then return at most limit results')
  })

  describe('Scenario: Alarm acknowledge workflow', () => {
    it('Given unacknowledged alarm, When calling acknowledge, Then set acknowledgedAt and acknowledgedBy')
    it('Given already acknowledged alarm, When calling acknowledge again, Then return same (idempotent)')
  })

  describe('Scenario: Alarm clear workflow', () => {
    it('Given uncleared alarm, When calling clear, Then set clearedAt')
    it('Given already cleared alarm, When calling clear again, Then return same (idempotent)')
    it('Given cleared alarm, When calling findOpen, Then not included in results')
  })

  describe('Scenario: AlarmContext batch operations', () => {
    it('Given alarm with context readings, When calling insertBatch, Then all persist')
    it('Given existing context, When calling insert with same PK, Then upsert updates value')
    it('Given alarm id, When calling findByAlarm, Then return all context ordered by readingTime')
    it('Given alarm id and windowMs, When calling findByAlarmWithWindow, Then filter by offset')
    it('Given alarm id, When calling deleteByAlarm, Then all context for alarm removed')
  })
})
```

### 3.4 Reading Repository Integration Tests

#### reading-repos.integration.test.ts
```typescript
describe('Feature: Reading Repositories Integration', () => {

  describe('Scenario: SensorReading insert operations', () => {
    it('Given reading with time/deviceId, When calling insert, Then persist')
    it('Given duplicate time/deviceId, When calling insert, Then upsert updates value/quality')
    it('Given batch of readings, When calling insertBatch, Then all persist efficiently')
    it('Given empty batch, When calling insertBatch, Then no-op (no error)')
  })

  describe('Scenario: SensorReading query operations', () => {
    it('Given time and deviceId, When calling findByKey, Then return Option.some or none')
    it('Given device with readings, When calling getLatest, Then return most recent')
    it('Given device with no readings, When calling getLatest, Then return Option.none()')
    it('Given since/until range, When calling queryByDevice, Then filter by time')
    it('Given limit, When calling queryByDevice, Then return at most limit results')
  })

  describe('Scenario: SensorReading stream operations', () => {
    it('Given device with readings, When calling streamByDevice, Then emit all matching')
    it('Given large dataset, When streaming, Then memory efficient (not load all)')
  })

  describe('Scenario: AggregatedReading queries', () => {
    it('Given bucket type, When calling queryByDevice, Then filter by bucket_interval')
    it('Given device and bucket, When calling getLatestBucket, Then return most recent bucket')
    it('Given no aggregated data, When querying, Then return empty array')
  })

  describe('Scenario: AnalyticsRecord operations', () => {
    it('Given analytics record, When calling insert, Then persist to columnstore')
    it('Given duplicate hour/deviceId, When calling insert, Then upsert updates')
    it('Given hour and deviceId, When calling findByKey, Then return Option')
    it('Given device, When calling queryByDevice with range, Then filter correctly')
  })
})
```

### 3.5 Cascade and Constraint Tests

#### cascade.integration.test.ts
```typescript
describe('Feature: FK Cascade Behavior', () => {

  describe('Scenario: Asset hierarchy constraints', () => {
    it('Given plant with lines, When deleting plant, Then appropriate cascade/restrict behavior')
    it('Given line with machines, When deleting line, Then appropriate behavior')
    it('Given machine with sensors, When deleting machine, Then appropriate behavior')
    it('Given sensor with readings, When deleting sensor, Then appropriate behavior')
  })

  describe('Scenario: Alarm FK constraints', () => {
    it('Given alarm with deviceId, When sensor deleted, Then appropriate behavior')
    it('Given alarm with context, When alarm deleted, Then context cascade deleted')
  })

  describe('Scenario: Invalid FK references', () => {
    it('Given non-existent plantId, When inserting line, Then fail with SqlError')
    it('Given non-existent lineId, When inserting machine, Then fail with SqlError')
    it('Given non-existent machineId, When inserting sensor, Then fail with SqlError')
    it('Given non-existent deviceId, When inserting alarm, Then fail with SqlError')
  })
})
```

### 3.6 Concurrent Operations Tests

#### concurrent.integration.test.ts
```typescript
describe('Feature: Concurrent Operations', () => {

  describe('Scenario: Parallel inserts', () => {
    it('Given 10 parallel plant inserts, When executing concurrently, Then all succeed')
    it('Given parallel inserts with same PK, When executing, Then one succeeds, others upsert')
  })

  describe('Scenario: Parallel reads during writes', () => {
    it('Given concurrent insert and findAll, When executing, Then findAll sees consistent state')
    it('Given concurrent update and findById, When executing, Then read sees before or after, not partial')
  })

  describe('Scenario: Optimistic locking patterns', () => {
    it('Given two concurrent updates to same row, When executing, Then both complete (last wins)')
    it('Given acknowledge called twice concurrently, When executing, Then idempotent (both see same result)')
  })

  describe('Scenario: Batch insert contention', () => {
    it('Given two insertBatch with overlapping PKs, When executing, Then upsert handles correctly')
  })
})
```

---

## Test Category 4: Edge Cases

### 4.1 Empty State Tests

```typescript
describe('Feature: Empty State Handling', () => {
  it('Given empty plants table, When calling findAll, Then return empty array []')
  it('Given empty sensors table, When calling findByMachine, Then return empty array []')
  it('Given empty alarms table, When calling findOpen, Then return empty array []')
  it('Given empty readings table, When calling getLatest, Then return Option.none()')
})
```

### 4.2 Non-Existent ID Tests

```typescript
describe('Feature: Non-Existent ID Handling', () => {
  it('Given non-existent PlantId, When calling findById, Then return Option.none()')
  it('Given non-existent AlarmId, When calling acknowledge, Then return undefined (no match)')
  it('Given non-existent composite key, When calling findByKey, Then return Option.none()')
  it('Given non-existent id, When calling delete, Then no error (void return)')
})
```

### 4.3 Duplicate Key Tests

```typescript
describe('Feature: Duplicate Key Handling', () => {
  describe('Scenario: Single PK with GeneratedByApp', () => {
    it('Given existing PlantId, When inserting same id, Then fail with unique constraint error')
    it('Given existing DeviceId, When inserting same deviceId, Then fail with unique constraint error')
  })

  describe('Scenario: Composite PK with upsert', () => {
    it('Given existing (time, deviceId), When inserting, Then upsert updates value')
    it('Given existing (alarmId, readingTime), When inserting, Then upsert updates')
    it('Given existing (hour, deviceId), When inserting, Then upsert updates')
  })
})
```

### 4.4 NULL Handling Tests

```typescript
describe('Feature: NULL Field Handling', () => {
  describe('Scenario: Optional fields as None', () => {
    it('Given location = None, When inserting plant, Then DB stores NULL')
    it('Given model = None, When inserting machine, Then DB stores NULL')
    it('Given message = None, When inserting alarm, Then DB stores NULL')
    it('Given metadata = None, When inserting alarm, Then DB stores NULL')
    it('Given stddev = None, When inserting analytics, Then DB stores NULL')
  })

  describe('Scenario: NULL from DB decoded as Option.none()', () => {
    it('Given plant with NULL location, When findById, Then location is Option.none()')
    it('Given alarm with NULL acknowledgedAt, When findById, Then acknowledgedAt is Option.none()')
  })
})
```

### 4.5 Invalid Data Tests

```typescript
describe('Feature: Invalid Data Rejection', () => {
  describe('Scenario: Schema validation failures', () => {
    it('Given invalid SensorType, When inserting sensor, Then fail with schema error')
    it('Given quality > 100, When inserting reading, Then fail with constraint error')
    it('Given quality < 0, When inserting reading, Then fail with constraint error')
    it('Given invalid AlarmSeverity, When inserting alarm, Then fail with schema error')
  })

  describe('Scenario: Type mismatches', () => {
    it('Given string for numeric value, When inserting reading, Then fail')
    it('Given number for id field, When inserting, Then fail with branded type error')
  })

  describe('Scenario: Malformed JSON metadata', () => {
    it('Given invalid JSON string in metadata column, When decoding, Then fail gracefully')
  })
})
```

### 4.6 Timestamp Edge Cases

```typescript
describe('Feature: Timestamp Edge Cases', () => {
  describe('Scenario: Timezone handling', () => {
    it('Given UTC timestamp, When inserting and reading, Then timezone preserved')
    it('Given local timestamp, When inserting, Then stored as UTC')
  })

  describe('Scenario: Microsecond precision', () => {
    it('Given readings with same second different microseconds, When inserting, Then both persist')
  })

  describe('Scenario: Date range queries', () => {
    it('Given since = until, When querying, Then return readings at exact time')
    it('Given since > until (invalid), When querying, Then return empty (not error)')
  })
})
```

---

## Test Fixtures

### 5.1 Asset Fixtures

```typescript
// __fixtures__/assets.ts

import type { PlantId, LineId, MachineId, DeviceId } from '../schemas/identifiers'
import type { PlantModel, LineModel, MachineModel, SensorModel } from '../models'

export const testPlantId = 'TEST-PLANT-001' as PlantId
export const testLineId = 'TEST-LINE-001' as LineId
export const testMachineId = 'TEST-MCH-001' as MachineId
export const testDeviceId = 'TEST-TMP-001' as DeviceId

export const validPlantInsert: typeof PlantModel.insert.Type = {
  id: testPlantId,
  name: 'Test Plant',
  location: 'Test Location',
}

export const validLineInsert: typeof LineModel.insert.Type = {
  id: testLineId,
  name: 'Test Line',
  plantId: testPlantId,
}

export const validMachineInsert: typeof MachineModel.insert.Type = {
  id: testMachineId,
  name: 'Test Machine',
  lineId: testLineId,
  model: 'Test Model X',
}

export const validSensorInsert: typeof SensorModel.insert.Type = {
  deviceId: testDeviceId,
  type: 'temperature',
  unit: 'celsius',
  machineId: testMachineId,
}

export const createTestHierarchy = Effect.gen(function* () {
  const plantRepo = yield* PlantRepo
  const lineRepo = yield* LineRepo
  const machineRepo = yield* MachineRepo
  const sensorRepo = yield* SensorRepo

  const plant = yield* plantRepo.insert(validPlantInsert)
  const line = yield* lineRepo.insert(validLineInsert)
  const machine = yield* machineRepo.insert(validMachineInsert)
  const sensor = yield* sensorRepo.insert(validSensorInsert)

  return { plant, line, machine, sensor }
})
```

### 5.2 Alarm Fixtures

```typescript
// __fixtures__/alarms.ts

import type { AlarmId } from '../schemas/identifiers'
import type { AlarmModel, AlarmContextModel } from '../models'

export const testAlarmId = 'TEST-ALM-001' as AlarmId

export const validAlarmInsert: typeof AlarmModel.insert.Type = {
  deviceId: testDeviceId,
  alarmType: 'high_temperature',
  severity: 'warning',
  message: undefined, // Option.none equivalent
  metadata: undefined,
}

export const validAlarmWithMetadata: typeof AlarmModel.insert.Type = {
  deviceId: testDeviceId,
  alarmType: 'sensor_fault',
  severity: 'critical',
  message: 'Sensor malfunction detected',
  metadata: { source: 'automated', priority: 1 },
}

export const validAlarmContextInsert: typeof AlarmContextModel.insert.Type = {
  alarmId: testAlarmId,
  deviceId: testDeviceId,
  readingTime: new Date(),
  value: 85.5,
  offsetFromAlarm: '-5 seconds',
}
```

### 5.3 Reading Fixtures

```typescript
// __fixtures__/readings.ts

import type { SensorReadingModel, AggregatedReadingModel, AnalyticsRecordModel } from '../models'

export const validReadingInsert: typeof SensorReadingModel.insert.Type = {
  time: new Date(),
  deviceId: testDeviceId,
  value: 25.5,
  quality: 100,
}

export const generateReadingBatch = (
  deviceId: DeviceId,
  count: number,
  baseTime = Date.now()
): Array<typeof SensorReadingModel.insert.Type> =>
  Array.from({ length: count }, (_, i) => ({
    time: new Date(baseTime - i * 1000),
    deviceId,
    value: 20 + Math.random() * 10,
    quality: 100,
  }))

export const validAnalyticsInsert: typeof AnalyticsRecordModel.insert.Type = {
  hour: new Date(Date.UTC(2026, 0, 25, 12, 0, 0)),
  deviceId: testDeviceId,
  avgValue: 25.5,
  minValue: 20.0,
  maxValue: 30.0,
  stddev: 2.5,
  sampleCount: 360,
}
```

---

## Layer Composition for Tests

### 6.1 Unit Test Layer (Mocked SQL)

```typescript
// __tests__/repos/unit/_layer.ts

import { Layer } from 'effect'
import { SqlClient } from '@effect/sql'

/**
 * Mock SQL client for unit tests.
 * Captures queries and returns preset results.
 */
export const MockSqlClientLayer = Layer.succeed(
  SqlClient.SqlClient,
  makeMockSqlClient()
)

/**
 * Repository + mock SQL for isolated unit testing
 */
export const PlantRepoUnitLayer = PlantRepoLive.pipe(
  Layer.provide(MockSqlClientLayer)
)
```

### 6.2 Integration Test Layer (Real DB)

```typescript
// __tests__/repos/integration/_layer.ts

import { Layer, Redacted } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { IIoTRepositoriesLive } from '../../../repos'

export const TestPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
  transformResultNames: (name) =>
    name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
})

/**
 * All repositories with real PostgreSQL
 */
export const RepositoriesIntegrationLayer = Layer.merge(
  TestPgClient,
  IIoTRepositoriesLive.pipe(Layer.provide(TestPgClient))
)

/**
 * Individual repository layers for focused tests
 */
export const PlantRepoIntegrationLayer = Layer.merge(
  TestPgClient,
  PlantRepoLive.pipe(Layer.provide(TestPgClient))
)
```

### 6.3 Scoped Test Wrapper

```typescript
// __tests__/repos/integration/_utils.ts

import { Effect } from 'effect'
import { it } from '@effect/vitest'

/**
 * Run integration test with database cleanup
 */
export const integrationTest = <A>(
  name: string,
  test: Effect.Effect<A, unknown, RepositoriesIntegration>,
  options?: { skip?: boolean; only?: boolean }
) => {
  const itFn = options?.skip ? it.skip : options?.only ? it.only : it

  itFn.effect(name, () =>
    Effect.gen(function* () {
      yield* cleanAllTestData
      return yield* test
    }).pipe(
      Effect.provide(RepositoriesIntegrationLayer),
      Effect.scoped
    )
  )
}
```

---

## Expected Test Counts

| Category | Test File | Est. Test Count |
|----------|-----------|-----------------|
| Model Schema | assets.model.test.ts | ~20 |
| Model Schema | alarms.model.test.ts | ~18 |
| Model Schema | readings.model.test.ts | ~12 |
| Repo Unit | PlantRepo.unit.test.ts | ~12 |
| Repo Unit | LineRepo.unit.test.ts | ~8 |
| Repo Unit | MachineRepo.unit.test.ts | ~10 |
| Repo Unit | SensorRepo.unit.test.ts | ~8 |
| Repo Unit | AlarmRepo.unit.test.ts | ~20 |
| Repo Unit | AlarmContextRepo.unit.test.ts | ~12 |
| Repo Unit | SensorReadingRepo.unit.test.ts | ~14 |
| Repo Unit | AggregatedReadingRepo.unit.test.ts | ~8 |
| Repo Unit | AnalyticsRecordRepo.unit.test.ts | ~10 |
| Integration | asset-repos.integration.test.ts | ~18 |
| Integration | alarm-repos.integration.test.ts | ~16 |
| Integration | reading-repos.integration.test.ts | ~14 |
| Integration | cascade.integration.test.ts | ~10 |
| Integration | concurrent.integration.test.ts | ~8 |
| **TOTAL** | | **~208 tests** |

---

## Implementation Notes

### Testing @effect/sql Model.Class

The Model.Class produces three type variants:
- `ModelName` (Type) - Full model with all fields
- `ModelName.insert.Type` - Fields needed for INSERT (excludes Generated, includes GeneratedByApp)
- `ModelName.update.Type` - PK required, all other fields optional

Test these at the type level with TypeScript's `Expect` utility:

```typescript
import { Schema } from 'effect'

// Type-level tests
type PlantType = typeof PlantModel.Type
type PlantInsert = typeof PlantModel.insert.Type
type PlantUpdate = typeof PlantModel.update.Type

// Assert id is required in insert for GeneratedByApp
type _Assert1 = Expect<PlantInsert['id'] extends PlantId ? true : false>

// Assert id is excluded in insert for Generated
type _Assert2 = Expect<AlarmInsert extends { id: AlarmId } ? false : true>
```

### Testing FieldOption Transforms

```typescript
import { Option } from 'effect'

// Encoding
const withLocation = { ...plant, location: Option.some('Chicago') }
const withoutLocation = { ...plant, location: Option.none() }

// Assert encoding produces correct SQL values
expect(encodeLocation(withLocation.location)).toBe('Chicago')
expect(encodeLocation(withoutLocation.location)).toBeNull()

// Decoding
const dbRowWithNull = { location: null }
const dbRowWithValue = { location: 'Chicago' }

expect(decodeLocation(dbRowWithNull.location)).toEqual(Option.none())
expect(decodeLocation(dbRowWithValue.location)).toEqual(Option.some('Chicago'))
```

### Testing Repository with @effect/vitest

```typescript
import { it, describe, expect } from '@effect/vitest'
import { Effect, Option } from 'effect'

describe('PlantRepo', () => {
  it.effect('findById returns Option.some for existing', () =>
    Effect.gen(function* () {
      const repo = yield* PlantRepo
      yield* repo.insert(validPlantInsert)

      const result = yield* repo.findById(testPlantId)

      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result).name).toBe('Test Plant')
    }).pipe(Effect.provide(RepositoriesIntegrationLayer))
  )
})
```

---

## Risks and Considerations

1. **Database availability** - Integration tests require Docker with IIoT stack running
2. **Test isolation** - Use TEST- prefix for all test data to avoid mock data conflicts
3. **Continuous aggregates** - TimescaleDB CAggs need manual refresh in tests
4. **FK constraints** - Tests must create parent entities before children
5. **Cleanup order** - Delete in reverse FK order (sensors -> machines -> lines -> plants)
6. **Branded types** - Use proper type assertions (`as PlantId`) in test fixtures

---

## Estimated Complexity

| Phase | Effort |
|-------|--------|
| Model schema tests | 2-3 hours |
| Repository unit tests (mock SQL) | 4-6 hours |
| Repository integration tests | 6-8 hours |
| Edge case tests | 2-3 hours |
| Test infrastructure setup | 2-3 hours |
| **Total** | **16-23 hours** |
