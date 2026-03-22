# IIoT Services Architecture Research

**Date:** 2026-01-25  
**Scope:** `src/lib/iiot/services/`  
**Purpose:** Document patterns for v3 evolution (DDL-first, schema-aware seed generation)

---

## Executive Summary

The IIoT Services module implements a **three-layer Effect-native architecture**:

- **L1 (Infrastructure):** Database clients (PgClient wrappers for TimescaleDB + Apache AGE)
- **L2 (Domain):** Business logic services (Sensor, Asset, Alarm operations)
- **L3 (Orchestration):** Cross-domain workflows (monitoring, dashboards, enriched alerts)

**Key Patterns:**
- Effect.Service with dependency injection
- Stream-based query APIs
- Schema-driven validation (Effect Schema)
- Automatic dependency resolution via Layer.Default
- Shared PgClient connection pool

---

## 1. Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  L3: Orchestration (IIoTService)                                │
│  - Cross-domain operations (alarm + sensor + asset)             │
│  - Dashboard aggregations                                       │
│  - Real-time monitoring workflows                               │
│  Dependencies: SensorService, AssetService, AlarmService        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  L2: Domain Services                                            │
│  - SensorService: Reading ingestion, queries, streaming         │
│  - AssetService: Hierarchy traversal (plant→line→machine→sensor)│
│  - AlarmService: Alarm lifecycle, acknowledgement, RCA          │
│  Dependencies: TimeSeriesClient, GraphClient, IIoTPgClient      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  L1: Infrastructure Clients                                     │
│  - IIoTPgClient: Shared PgClient layer (connection config)      │
│  - TimeSeriesClient: TimescaleDB hypertable operations          │
│  - GraphClient: Apache AGE Cypher queries                       │
│  Dependencies: @effect/sql-pg                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Design Principle:** Each layer depends ONLY on layers below it. L3 never imports L1 directly.

---

## 2. L1 Service Patterns (Infrastructure)

### 2.1 IIoTPgClient - Shared Connection Layer

**File:** `src/lib/iiot/services/l1/IIoTPgClient.ts`

**Purpose:** Single source of truth for PostgreSQL connection configuration.

#### Pattern: PgClient.layerConfig with Environment Variables

```typescript
export const IIoTPgClientLive = PgClient.layerConfig({
  host: Config.string('IIOT_POSTGRES_HOST').pipe(Config.withDefault('localhost')),
  port: Config.number('IIOT_POSTGRES_PORT').pipe(Config.withDefault(5433)),
  database: Config.string('IIOT_POSTGRES_DB').pipe(Config.withDefault('iiot_mock')),
  username: Config.string('IIOT_POSTGRES_USER').pipe(Config.withDefault('iiot')),
  password: Config.redacted('IIOT_POSTGRES_PASSWORD').pipe(
    Config.withDefault(Redacted.make('iiot_dev'))
  ),
  maxConnections: Config.number('IIOT_POSTGRES_POOL_SIZE').pipe(Config.withDefault(10)),
  transformResultNames: Config.succeed(transformResultNames),
})
```

**Key Features:**
- Environment-driven config with sensible defaults
- `transformResultNames`: Converts `snake_case` → `camelCase` automatically
- `Redacted.make()` for password safety (Effect's secret management)
- Shared across all L1 clients (TimeSeriesClient, GraphClient)

#### Pattern: Column Name Transformation

PostgreSQL lowercases all unquoted identifiers. Apache AGE Cypher exacerbates this:

```sql
-- Cypher query
RETURN s.device_id AS deviceId

-- PostgreSQL returns column named: "deviceid" (lowercase)
```

**Solution:** Transform all column names on fetch:

```typescript
const transformResultNames = (columnName: string): string =>
  columnName.replace(/_([a-z])/g, (_, char) => char.toUpperCase())
```

**Result:** All queries return camelCase fields automatically.

#### Pattern: Health Check

```typescript
export const checkIIoTDatabaseHealth = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Check connection
  const connection = yield* sql<{ test: number }>`SELECT 1 as test`.pipe(
    Effect.map(() => true),
    Effect.catchAll(() => Effect.succeed(false))
  )

  // Check TimescaleDB version
  const timescaledb = yield* sql<{ extversion: string }>`
    SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'
  `.pipe(
    Effect.map((rows) => rows[0]?.extversion ?? null),
    Effect.catchAll(() => Effect.succeed(null))
  )

  // ... check AGE, hypertables, continuous aggregates ...

  return { healthy, connection, timescaledb, age, hypertable, graph, continuousAggregates }
})
```

**Verified Components:**
- PostgreSQL connection
- TimescaleDB extension loaded
- Apache AGE extension loaded
- `iiot.sensor_readings` hypertable exists (with compression stats)
- `iiot_graph` graph exists (with sensor count)
- Continuous aggregates (`readings_1min`, `readings_1hour`)

---

### 2.2 TimeSeriesClient - TimescaleDB Operations

**File:** `src/lib/iiot/services/l1/TimeSeriesClient.ts`

**Purpose:** Hypertable CRUD, continuous aggregate queries, streaming.

#### Pattern: Effect.Service with Dependencies

```typescript
export class TimeSeriesClient extends Effect.Service<TimeSeriesClient>()('iiot/TimeSeriesClient', {
  effect: Effect.gen(function* () {
    const sql = yield* PgClient.PgClient

    // Define operations...
    const insertReadings = (readings) => { /* ... */ }
    const queryReadings = (params) => { /* ... */ }

    return { insertReadings, queryReadings, /* ... */ } as const
  }),
  dependencies: [IIoTPgClientLive],
}) {}

export const TimeSeriesClientLive = TimeSeriesClient.Default
```

**Key Details:**
- Service tag: `'iiot/TimeSeriesClient'`
- Auto-injects `IIoTPgClientLive` via `dependencies` array
- `TimeSeriesClient.Default` creates Layer with all deps resolved

#### Pattern: Stream-Based Queries

```typescript
const queryReadings = (params: {
  deviceId: DeviceId
  since?: Date
  until?: Date
  limit?: number
}): Stream.Stream<SensorReading, IIoTQueryError> =>
  Stream.fromEffect(
    Effect.gen(function* () {
      const rows = yield* sql<SensorReadingRow>`
        SELECT time, device_id, value, quality
        FROM iiot.sensor_readings
        WHERE device_id = ${params.deviceId}
          AND time >= ${params.since ?? defaultSince}
          AND time <= ${params.until ?? defaultUntil}
        ORDER BY time DESC
        LIMIT ${params.limit ?? 1000}
      `
      return rows.map(mapRowToSensorReading)
    }).pipe(
      Effect.catchAll((cause) =>
        Effect.fail(new IIoTQueryError({ operation: 'queryReadings', message: String(cause) }))
      )
    )
  ).pipe(Stream.flatMap((readings) => Stream.fromIterable(readings)))
```

**Why Stream?**
- Progressive data consumption (don't load 10k rows into memory)
- Composable with Stream.map, Stream.filter, Stream.take
- Effect-native backpressure handling

#### Pattern: Batch Insert with ON CONFLICT

```typescript
const insertReadings = (
  readings: ReadonlyArray<{ time: Date; deviceId: DeviceId; value: number; quality?: number }>
): Effect.Effect<number, IIoTQueryError> =>
  Effect.gen(function* () {
    if (readings.length === 0) return 0

    const result = yield* pipe(
      Effect.forEach(readings, (reading) =>
        sql`
          INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
          VALUES (${reading.time}, ${reading.deviceId}, ${reading.value}, ${reading.quality ?? 100})
          ON CONFLICT (time, device_id) DO UPDATE SET
            value = EXCLUDED.value,
            quality = EXCLUDED.quality
          RETURNING device_id
        `
      ),
      Effect.map((results) => results.reduce((acc, r) => acc + r.length, 0))
    )

    return result
  }).pipe(
    Effect.catchAll((cause) =>
      Effect.fail(new IIoTQueryError({ operation: 'insertReadings', message: String(cause) }))
    )
  )
```

**Features:**
- Idempotent upsert (ON CONFLICT DO UPDATE)
- Per-row insertion for safety (or `insertReadingsBulk` for batching)
- Default quality=100 if not provided

#### Pattern: Continuous Aggregates

```typescript
const queryAggregated = (params: {
  deviceId: DeviceId
  bucket: TimeBucket // '1min' | '5min' | '15min' | '1hour'
  since?: Date
  until?: Date
}): Stream.Stream<AggregatedReading, IIoTQueryError> =>
  Stream.fromEffect(
    Effect.gen(function* () {
      const viewName =
        params.bucket === '1min' || params.bucket === '5min' || params.bucket === '15min'
          ? 'iiot.readings_1min'
          : 'iiot.readings_1hour'

      // Use unsafe query because view name is dynamic (but controlled by us)
      const rows = yield* sql.unsafe<AggregatedReadingRow>(
        `SELECT bucket, device_id, avg_value, min_value, max_value, stddev_value, sample_count
         FROM ${viewName}
         WHERE device_id = $1 AND bucket >= $2 AND bucket <= $3
         ORDER BY bucket DESC`,
        [params.deviceId, params.since.toISOString(), params.until.toISOString()]
      )

      return rows.map(mapRowToAggregatedReading)
    })
  ).pipe(Stream.flatMap(Stream.fromIterable))
```

**Latency Note:**
- Continuous aggregates refreshed ~1 minute (background worker)
- Use `queryReadings()` for real-time alerts, `queryAggregated()` for dashboards

#### Pattern: Latest Reading Optimization

```typescript
const getLatestReading = (
  deviceId: DeviceId
): Effect.Effect<SensorReading | null, IIoTQueryError> =>
  Effect.gen(function* () {
    const rows = yield* sql<SensorReadingRow>`
      SELECT time, device_id, value, quality
      FROM iiot.sensor_readings
      WHERE device_id = ${deviceId}
      ORDER BY time DESC
      LIMIT 1
    `
    if (rows.length === 0) return null
    return mapRowToSensorReading(rows[0])
  })
```

**Index Used:** `idx_readings_device (device_id, time DESC)` - O(1) lookup

---

### 2.3 GraphClient - Apache AGE Operations

**File:** `src/lib/iiot/services/l1/GraphClient.ts`

**Purpose:** Cypher query execution, asset hierarchy traversal, alarm→sensor relationships.

#### Pattern: Cypher Execution via ag_catalog.cypher()

```typescript
const executeCypher = (
  query: string,
  columnDefs: string = '(result agtype)'
): Effect.Effect<CypherResult, GraphQueryError> =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`Executing Cypher: ${query.slice(0, 100)}...`)

    // Set search_path for AGE functions
    yield* sql.unsafe(`SET search_path = ag_catalog, iiot, public`)

    // Execute Cypher via ag_catalog.cypher()
    const cypherSql = `SELECT * FROM cypher('${graphName}', $$ ${query} $$) AS ${columnDefs}`

    const rawRows = yield* sql.unsafe<Record<string, unknown>>(cypherSql)

    // Parse agtype values in each row
    const rows = rawRows.map((row) => {
      const parsed: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        parsed[key] = parseAgtype(value) // JSON.parse agtype strings
      }
      return parsed
    })

    return { rows }
  }).pipe(
    Effect.catchAll((cause) =>
      Effect.fail(new GraphQueryError({ query, message: String(cause) }))
    )
  )
```

**Key Details:**
- `SET search_path` ensures `cypher()` function is available
- `$$ ... $$` dollar-quoting avoids escaping quotes in Cypher
- `parseAgtype()` converts AGE's JSON-encoded agtype → JavaScript objects

#### Pattern: Hierarchy Traversal

```typescript
const getSensorHierarchy = (
  deviceId: DeviceId
): Effect.Effect<SensorHierarchy, GraphQueryError | HierarchyError> =>
  Effect.gen(function* () {
    const result = yield* executeCypher(
      `MATCH (s:sensor {device_id: '${escapeCypher(deviceId)}'})-[:monitors]->(m:machine)
             <-[:contains]-(l:line)<-[:contains]-(p:plant)
       RETURN s.device_id AS device_id, m.name AS machine_name,
              l.name AS line_name, p.name AS plant_name`,
      '(device_id agtype, machine_name agtype, line_name agtype, plant_name agtype)'
    )

    if (result.rows.length === 0) {
      return yield* Effect.fail(new HierarchyError({ message: `No hierarchy found for sensor ${deviceId}` }))
    }

    const row = result.rows[0]
    return {
      deviceId: String(row['deviceId']) as DeviceId,
      machineName: String(row['machineName']),
      lineName: String(row['lineName']),
      plantName: String(row['plantName']),
    }
  })
```

**Graph Pattern:**
```
(sensor)-[:monitors]->(machine)<-[:contains]-(line)<-[:contains]-(plant)
```

#### Pattern: Full Plant Hierarchy (Nested Graph Query)

```typescript
const getPlantHierarchy = (plantId: PlantId) =>
  Effect.gen(function* () {
    // Single query to fetch full hierarchy
    const hierarchyResult = yield* executeCypher(
      `MATCH (p:plant {id: '${escapeCypher(plantId)}'})-[:contains]->(l:line)
             -[:contains]->(m:machine)<-[:monitors]-(s:sensor)
       RETURN l.id AS line_id, l.name AS line_name,
              m.id AS machine_id, m.name AS machine_name, m.model AS machine_model,
              s.device_id AS device_id, s.type AS sensor_type, s.unit AS sensor_unit`,
      '(line_id agtype, line_name agtype, machine_id agtype, machine_name agtype, machine_model agtype, device_id agtype, sensor_type agtype, sensor_unit agtype)'
    )

    // Group results into hierarchy structure (Map-based aggregation)
    const linesMap = new Map<string, { line: Line; machinesMap: Map<string, { machine: Machine; sensors: Sensor[] }> }>()

    for (const row of hierarchyResult.rows) {
      const lineId = String(row['lineId'])
      const machineId = String(row['machineId'])

      if (!linesMap.has(lineId)) {
        linesMap.set(lineId, { line: { /* ... */ }, machinesMap: new Map() })
      }

      const lineData = linesMap.get(lineId)!
      if (!lineData.machinesMap.has(machineId)) {
        lineData.machinesMap.set(machineId, { machine: { /* ... */ }, sensors: [] })
      }

      lineData.machinesMap.get(machineId)!.sensors.push({ /* sensor data */ })
    }

    // Convert to final structure
    const lines = Array.from(linesMap.values()).map((lineData) => ({
      line: lineData.line,
      machines: Array.from(lineData.machinesMap.values()),
    }))

    return { plant, lines }
  })
```

**Optimization:** Single Cypher query instead of N+1 traversal.

#### Pattern: Alarm→Sensor Relationship

```typescript
const createAlarmNode = (alarm: {
  id: string
  alarmType: string
  severity: string
  message?: string
  timestamp: Date
}): Effect.Effect<void, GraphQueryError> =>
  Effect.gen(function* () {
    yield* executeCypher(
      `CREATE (:alarm {
        id: '${escapeCypher(alarm.id)}',
        alarm_type: '${escapeCypher(alarm.alarmType)}',
        severity: '${escapeCypher(alarm.severity)}',
        message: '${escapeCypher(alarm.message ?? '')}',
        timestamp: '${alarm.timestamp.toISOString()}'
      })`,
      '(v agtype)'
    )
  })

const linkAlarmToSensor = (alarmId: string, deviceId: DeviceId) =>
  Effect.gen(function* () {
    yield* executeCypher(
      `MATCH (a:alarm {id: '${escapeCypher(alarmId)}'}), (s:sensor {device_id: '${escapeCypher(deviceId)}'})
       CREATE (a)-[:triggered_by]->(s)`,
      '(e agtype)'
    )
  })
```

**Security:** `escapeCypher()` prevents injection by escaping `\` and `'`.

---

## 3. L2 Service Patterns (Domain)

### 3.1 SensorService - Reading Operations

**File:** `src/lib/iiot/services/l2/SensorService.ts`

**Purpose:** Business logic for sensor data ingestion, queries, subscriptions.

#### Pattern: Service with Multiple Dependencies

```typescript
export class SensorService extends Effect.Service<SensorService>()('iiot/SensorService', {
  dependencies: [TimeSeriesClient.Default, GraphClient.Default],

  scoped: Effect.gen(function* () {
    const tsClient = yield* TimeSeriesClient
    const graphClient = yield* GraphClient

    // Define operations...
    return { ingestReadings, queryReadings, /* ... */ } as const
  }),
}) {}
```

**Key Difference:** `scoped` instead of `effect` - allows for cleanup on scope close.

#### Pattern: Validation Layer

```typescript
const ingestReadings = (
  readings: ReadonlyArray<{ time: Date; deviceId: DeviceId; value: number; quality?: number }>
): Effect.Effect<number, InvalidReadingError | IIoTQueryError> =>
  Effect.gen(function* () {
    // Validate readings
    for (const reading of readings) {
      if (!Number.isFinite(reading.value)) {
        return yield* Effect.fail(
          new InvalidReadingError({
            deviceId: reading.deviceId,
            message: 'Value must be a finite number',
            value: reading.value,
          })
        )
      }
    }

    // Insert into TimescaleDB
    const inserted = yield* tsClient.insertReadings(
      readings.map((r) => ({ ...r, quality: (r.quality ?? 100) as QualityScore }))
    )

    yield* Effect.logInfo(`Ingested ${inserted} readings`)
    return inserted
  })
```

**Responsibility:** Domain validation before delegating to L1.

#### Pattern: Real-Time Subscription

```typescript
const subscribeToDevice = (
  deviceId: DeviceId,
  pollIntervalMs: number = 5000
): Stream.Stream<SensorReading, IIoTQueryError> =>
  Stream.repeatEffectWithSchedule(
    Effect.gen(function* () {
      const latest = yield* tsClient.getLatestReading(deviceId)
      return latest
    }),
    Schedule.spaced(pollIntervalMs)
  ).pipe(
    Stream.filter((reading): reading is SensorReading => reading !== null)
  )
```

**Pattern:** Polling-based subscription (real-time via short interval).

#### Pattern: Atom-Based State

```typescript
// Atoms for reactive state
const latestReadingsAtom = Atom.make<Map<DeviceId, SensorReading>>(new Map())
const activeSubscriptionsAtom = Atom.make<number>(0)

return {
  // ... operations ...
  latestReadingsAtom,
  activeSubscriptionsAtom,
}
```

**Exposed for React:** `useAtomValue(sensorService.latestReadingsAtom)`

---

### 3.2 AssetService - Hierarchy Traversal

**File:** `src/lib/iiot/services/l2/AssetService.ts`

**Purpose:** Business logic for asset hierarchy (plant→line→machine→sensor).

#### Pattern: Stream Collection Pattern

```typescript
const getPlant = (plantId: PlantId): Effect.Effect<Plant, PlantNotFoundError | GraphQueryError> =>
  Effect.gen(function* () {
    const plants = yield* graphClient.getPlants().pipe(Stream.runCollect)
    const plant = Chunk.toArray(plants).find((p) => p.id === plantId)

    if (!plant) {
      return yield* Effect.fail(new PlantNotFoundError({ plantId }))
    }

    return plant
  })
```

**Pattern:** `Stream.runCollect` → `Chunk` → `Chunk.toArray()` for in-memory operations.

#### Pattern: Nested Effect.all for Hierarchy

```typescript
const getPlantHierarchy = (plantId: PlantId) =>
  Effect.gen(function* () {
    const plant = yield* getPlant(plantId)
    const linesChunk = yield* graphClient.getLinesForPlant(plantId).pipe(Stream.runCollect)
    const lines = Chunk.toArray(linesChunk)

    // Parallel fetch of machines + sensors for each line
    const linesWithMachines: LineWithMachines[] = yield* Effect.all(
      lines.map((line) =>
        Effect.gen(function* () {
          const machinesChunk = yield* graphClient.getMachinesForLine(line.id).pipe(Stream.runCollect)
          const machines = Chunk.toArray(machinesChunk)

          const machinesWithSensors: MachineWithSensors[] = yield* Effect.all(
            machines.map((machine) =>
              Effect.gen(function* () {
                const sensorsChunk = yield* graphClient.getSensorsForMachine(machine.id).pipe(Stream.runCollect)
                return { machine, sensors: Chunk.toArray(sensorsChunk) }
              })
            )
          )

          return { line, machines: machinesWithSensors }
        })
      )
    )

    return { plant, lines: linesWithMachines }
  })
```

**Effect.all:** Parallel execution of all sub-queries (vs sequential waterfall).

---

### 3.3 AlarmService - Alarm Lifecycle

**File:** `src/lib/iiot/services/l2/AlarmService.ts`

**Purpose:** Alarm CRUD, acknowledgement, clearing, root cause analysis.

#### Pattern: Schema-Driven Decode/Encode

```typescript
const AlarmRowSchema = Schema.Struct({
  id: Schema.String,
  deviceId: Schema.String,
  alarmType: Schema.String,
  severity: Schema.String,
  message: Schema.NullOr(Schema.String),
  triggeredAt: Schema.DateFromSelf,
  acknowledgedAt: Schema.NullOr(Schema.DateFromSelf),
  clearedAt: Schema.NullOr(Schema.DateFromSelf),
  acknowledgedBy: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

const AlarmFromRow = Schema.transformOrFail(
  AlarmRowSchema,
  Schema.typeSchema(Alarm),
  {
    strict: true,
    decode: (row, _, ast) =>
      ParseResult.try({
        try: () => ({
          _tag: 'Alarm' as const,
          id: row.id as Schema.Schema.Type<typeof AlarmId>,
          deviceId: row.deviceId as Schema.Schema.Type<typeof DeviceId>,
          alarmType: row.alarmType as Schema.Schema.Type<typeof AlarmType>,
          severity: row.severity as Schema.Schema.Type<typeof AlarmSeverity>,
          triggeredAt: DateTime.unsafeFromDate(row.triggeredAt),
          message: row.message ?? undefined,
          acknowledgedAt: row.acknowledgedAt ? DateTime.unsafeFromDate(row.acknowledgedAt) : undefined,
          clearedAt: row.clearedAt ? DateTime.unsafeFromDate(row.clearedAt) : undefined,
          acknowledgedBy: row.acknowledgedBy ?? undefined,
          metadata: row.metadata ?? undefined,
        }),
        catch: (e) =>
          new ParseResult.Type(ast, row, `Failed to decode alarm row: ${String(e)}`),
      }),
    encode: (alarm, _, ast) => { /* reverse transformation */ },
  }
)

const decodeRow = (row: AlarmRow, operation: string) =>
  decodeRowEffect(row).pipe(
    Effect.mapError(
      (parseError) =>
        new IIoTQueryError({
          operation,
          message: `Failed to decode alarm: ${String(parseError)}`,
        })
    )
  )
```

**Benefits:**
- Type-safe DB row → domain model conversion
- Date → DateTime.Utc transformation
- null → undefined normalization (DB uses null, domain uses undefined)
- Branded identifiers enforced at decode

#### Pattern: State Machine Enforcement

```typescript
const acknowledgeAlarm = (alarmId: AlarmId, acknowledgedBy: string) =>
  Effect.gen(function* () {
    // Check current state BEFORE updating
    const alarm = yield* getAlarm(alarmId)

    if (alarm.acknowledgedAt) {
      return yield* Effect.fail(new AlarmAlreadyAcknowledgedError({ alarmId }))
    }

    // Update the alarm
    const rows = yield* sql<AlarmRow>`
      UPDATE iiot.alarms
      SET acknowledged_at = NOW(), acknowledged_by = ${acknowledgedBy}
      WHERE id = ${alarmId}
      RETURNING /* columns */
    `

    return yield* decodeRow(rows[0], 'acknowledgeAlarm')
  })
```

**Pattern:** Check-then-act (optimistic locking via domain errors).

#### Pattern: Root Cause Analysis

```typescript
const getAlarmContext = (
  alarmId: AlarmId,
  windowMs: number = 5 * 60 * 1000 // 5 minutes
): Effect.Effect<AlarmContext[], AlarmNotFoundError | IIoTQueryError> =>
  Effect.gen(function* () {
    const alarm = yield* getAlarm(alarmId)

    // Get readings around alarm time
    const alarmTime = DateTime.toDate(alarm.triggeredAt)
    const since = new Date(alarmTime.getTime() - windowMs)
    const until = new Date(alarmTime.getTime() + windowMs)

    const readings = yield* tsClient
      .queryReadings({ deviceId: alarm.deviceId, since, until })
      .pipe(Stream.runCollect)

    return Chunk.toArray(readings).map((reading): AlarmContext => ({
      _tag: 'AlarmContext',
      alarmId,
      deviceId: alarm.deviceId,
      readingTime: reading.time,
      value: reading.value,
      quality: reading.quality,
      offsetSeconds: (DateTime.toDate(reading.time).getTime() - alarmTime.getTime()) / 1000,
    }))
  })
```

**Use Case:** Dashboard showing sensor values ±5min around alarm trigger time.

#### Pattern: Parameterized Optional Filters

```typescript
const getAlarms = (params?: {
  deviceId?: DeviceId
  severity?: AlarmSeverity
  onlyOpen?: boolean
}): Stream.Stream<Alarm, IIoTQueryError> => {
  const deviceIdParam = params?.deviceId ?? null
  const severityParam = params?.severity ?? null
  const onlyOpenParam = params?.onlyOpen ?? false

  return Stream.fromEffect(
    sql<AlarmRow>`
      SELECT /* columns */
      FROM iiot.alarms
      WHERE (${deviceIdParam}::text IS NULL OR device_id = ${deviceIdParam})
        AND (${severityParam}::text IS NULL OR severity = ${severityParam})
        AND (NOT ${onlyOpenParam}::boolean OR cleared_at IS NULL)
      ORDER BY triggered_at DESC
    `
  ).pipe(
    Stream.flatMap(Stream.fromIterable),
    Stream.mapEffect((row) => decodeRow(row, 'getAlarms'))
  )
}
```

**SQL Pattern:** `(param IS NULL OR column = param)` - no-op when param is null.

---

## 4. L3 Service Patterns (Orchestration)

### 4.1 IIoTService - Cross-Domain Workflows

**File:** `src/lib/iiot/services/l3/IIoTService.ts`

**Purpose:** Orchestration combining L2 services for dashboard/monitoring workflows.

#### Pattern: Parallel Data Fetching

```typescript
const getDeviceContext = (deviceId: DeviceId) =>
  Effect.gen(function* () {
    // Parallel fetch of device info
    const [hierarchy, latestReading, alarmsChunk] = yield* Effect.all([
      assetService.getSensorHierarchy(deviceId),
      sensorService.getLatestReading(deviceId),
      alarmService.getAlarms({ deviceId, onlyOpen: true }).pipe(Stream.runCollect),
    ])

    return {
      deviceId,
      hierarchy,
      latestReading,
      activeAlarms: Chunk.toArray(alarmsChunk),
    }
  })
```

**Effect.all:** Runs all 3 operations concurrently (not sequential).

#### Pattern: Threshold Monitoring

```typescript
const monitorDevice = (params: {
  deviceId: DeviceId
  thresholds: { warning?: number; critical?: number }
  pollIntervalMs?: number
}): Stream.Stream<SensorReading | EnrichedAlert, any> =>
  sensorService.subscribeToDevice(params.deviceId, params.pollIntervalMs).pipe(
    Stream.mapEffect((reading) =>
      Effect.gen(function* () {
        // Check thresholds
        if (params.thresholds.critical && reading.value > params.thresholds.critical) {
          const alert = yield* raiseAlarm({
            deviceId: params.deviceId,
            alarmType: 'threshold_exceeded',
            severity: 'critical',
            message: `Value ${reading.value} exceeds critical threshold ${params.thresholds.critical}`,
          })
          return alert as SensorReading | EnrichedAlert
        }

        if (params.thresholds.warning && reading.value > params.thresholds.warning) {
          const alert = yield* raiseAlarm({
            deviceId: params.deviceId,
            alarmType: 'threshold_exceeded',
            severity: 'warning',
            message: `Value ${reading.value} exceeds warning threshold ${params.thresholds.warning}`,
          })
          return alert as SensorReading | EnrichedAlert
        }

        return reading as SensorReading | EnrichedAlert
      })
    )
  )
```

**Stream Pattern:** Reactive workflow emitting readings or alarms.

#### Pattern: Enriched Alerts

```typescript
const getEnrichedAlerts = (params?: {
  severity?: AlarmSeverity
  onlyOpen?: boolean
  limit?: number
}): Stream.Stream<EnrichedAlert, any> =>
  alarmService.getAlarms({
    severity: params?.severity,
    onlyOpen: params?.onlyOpen ?? true,
  }).pipe(
    Stream.take(params?.limit ?? 50),
    Stream.mapEffect((alarm) =>
      Effect.gen(function* () {
        // Get hierarchy (may fail if sensor not found)
        const hierarchy = yield* assetService
          .getSensorHierarchy(alarm.deviceId)
          .pipe(Effect.option)

        // Get recent readings around alarm time
        const alarmTime = new Date(alarm.triggeredAt as unknown as string)
        const since = new Date(alarmTime.getTime() - 5 * 60 * 1000)
        const until = new Date(alarmTime.getTime() + 5 * 60 * 1000)

        const readingsChunk = yield* sensorService
          .queryReadings({ deviceId: alarm.deviceId, since, until, limit: 20 })
          .pipe(Stream.runCollect)

        return {
          alarm,
          hierarchy: hierarchy._tag === 'Some' ? hierarchy.value : null,
          recentReadings: Chunk.toArray(readingsChunk),
        }
      })
    )
  )
```

**Effect.option:** Converts errors to Option (None if hierarchy lookup fails).

---

## 5. Effect.Service Pattern Deep Dive

### 5.1 Service Definition Anatomy

```typescript
export class TimeSeriesClient extends Effect.Service<TimeSeriesClient>()(
  'iiot/TimeSeriesClient',  // ← Unique tag for service registry
  {
    effect: Effect.gen(function* () {
      const sql = yield* PgClient.PgClient  // ← Inject dependencies

      // Define operations
      const insertReadings = (readings) => { /* ... */ }
      const queryReadings = (params) => { /* ... */ }

      return { insertReadings, queryReadings } as const  // ← Service API
    }),
    dependencies: [IIoTPgClientLive],  // ← Auto-provide these layers
  }
) {}
```

**Key Components:**
1. **Service Tag:** `'iiot/TimeSeriesClient'` - unique identifier
2. **effect:** Generator function defining service implementation
3. **dependencies:** Array of Layers to auto-inject
4. **Return as const:** Ensures return type is precise (no widening to `Function`)

### 5.2 Dependency Resolution

```typescript
// L1 - Infrastructure
export const IIoTPgClientLive = PgClient.layerConfig({ /* ... */ })
export const TimeSeriesClientLive = TimeSeriesClient.Default  // Auto-includes IIoTPgClientLive
export const GraphClientLive = GraphClient.Default            // Auto-includes IIoTPgClientLive

// L2 - Domain
export const SensorServiceLive = SensorService.Default        // Auto-includes TimeSeriesClient + GraphClient
export const AssetServiceLive = AssetService.Default          // Auto-includes GraphClient
export const AlarmServiceLive = AlarmService.Default          // Auto-includes TimeSeriesClient + IIoTPgClient

// L3 - Orchestration
export const IIoTServiceLive = IIoTService.Default            // Auto-includes SensorService + AssetService + AlarmService
```

**Effect.Service.Default:**
- Automatically resolves all `dependencies` in the array
- Creates a Layer with full dependency tree
- No manual `Layer.provide` chaining needed

### 5.3 Usage in Application

```typescript
const program = Effect.gen(function* () {
  const iiot = yield* IIoTService

  const overview = yield* iiot.getPlantOverview('PLANT-001' as PlantId)
  console.log(overview)
})

// Run with auto-provided dependencies
await Effect.runPromise(
  program.pipe(Effect.provide(IIoTServiceLive))
)
```

**Effect.provide:**
- Injects `IIoTServiceLive` (which includes all L2 + L1 layers)
- No need to manually provide SensorService, TimeSeriesClient, etc.

---

## 6. PgClient Patterns

### 6.1 Tagged Template Literal Queries

```typescript
const rows = yield* sql<SensorReadingRow>`
  SELECT time, device_id, value, quality
  FROM iiot.sensor_readings
  WHERE device_id = ${deviceId}
    AND time >= ${since}
    AND time <= ${until}
  ORDER BY time DESC
  LIMIT ${limit}
`
```

**Advantages:**
- Parameterized queries (SQL injection safe)
- Type-safe result mapping via `<SensorReadingRow>`
- Automatic escaping of parameters

### 6.2 Dynamic SQL with sql.unsafe()

```typescript
const viewName = params.bucket === '1min' ? 'iiot.readings_1min' : 'iiot.readings_1hour'

const rows = yield* sql.unsafe<AggregatedReadingRow>(
  `SELECT bucket, device_id, avg_value, min_value, max_value
   FROM ${viewName}
   WHERE device_id = $1 AND bucket >= $2 AND bucket <= $3`,
  [params.deviceId, params.since.toISOString(), params.until.toISOString()]
)
```

**When to Use:**
- Dynamic table/view names (but only from trusted sources!)
- Complex queries not expressible with tagged templates
- ALWAYS pass user input via `$1, $2, ...` parameters

### 6.3 Error Handling

```typescript
const result = yield* sql<RowType>`SELECT ...`.pipe(
  Effect.catchAll((cause) =>
    Effect.fail(
      new IIoTQueryError({
        operation: 'operationName',
        message: `Failed to X: ${String(cause)}`,
        cause,
      })
    )
  )
)
```

**Pattern:** Wrap all SQL queries with domain-specific error types.

---

## 7. TimescaleDB Integration

### 7.1 Hypertable Pattern

```sql
-- Schema (from docker/iiot-db/init.sql)
CREATE TABLE iiot.sensor_readings (
  time TIMESTAMPTZ NOT NULL,
  device_id TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  quality INTEGER NOT NULL DEFAULT 100,
  CONSTRAINT sensor_readings_pkey PRIMARY KEY (time, device_id)
);

SELECT create_hypertable('iiot.sensor_readings', 'time');

-- Index for efficient device queries
CREATE INDEX idx_readings_device ON iiot.sensor_readings (device_id, time DESC);
```

**Hypertable Benefits:**
- Automatic time-based partitioning (chunks)
- Compression (older chunks compressed)
- Retention policies (auto-delete old data)

### 7.2 Continuous Aggregates

```sql
-- 1-minute aggregates
CREATE MATERIALIZED VIEW iiot.readings_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  device_id,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  STDDEV(value) AS stddev_value,
  COUNT(*) AS sample_count
FROM iiot.sensor_readings
GROUP BY bucket, device_id;

-- 1-hour aggregates
CREATE MATERIALIZED VIEW iiot.readings_1hour
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  device_id,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  STDDEV(value) AS stddev_value,
  COUNT(*) AS sample_count
FROM iiot.sensor_readings
GROUP BY bucket, device_id;
```

**Usage:**
- `queryAggregated({ bucket: '1min' })` → `iiot.readings_1min`
- `queryAggregated({ bucket: '1hour' })` → `iiot.readings_1hour`

### 7.3 Health Check Queries

```typescript
// Check hypertable stats
const stats = yield* sql<HypertableStatsRow>`
  SELECT
    h.hypertable_name,
    h.num_chunks,
    h.compression_enabled,
    pg_size_pretty(
      COALESCE(hypertable_size(format('%I.%I', h.hypertable_schema, h.hypertable_name)::regclass), 0)
    ) AS total_bytes
  FROM timescaledb_information.hypertables h
  WHERE h.hypertable_schema = 'iiot' AND h.hypertable_name = 'sensor_readings'
`
```

**Metrics:**
- `num_chunks`: Number of time partitions
- `compression_enabled`: Compression policy active
- `total_bytes`: Disk usage

---

## 8. Stream Patterns

### 8.1 Stream.fromEffect → Stream.flatMap

```typescript
const queryReadings = (params: {
  deviceId: DeviceId
  since?: Date
  until?: Date
  limit?: number
}): Stream.Stream<SensorReading, IIoTQueryError> =>
  Stream.fromEffect(
    Effect.gen(function* () {
      const rows = yield* sql<SensorReadingRow>`SELECT ...`
      return rows.map(mapRowToSensorReading)
    })
  ).pipe(Stream.flatMap((readings) => Stream.fromIterable(readings)))
```

**Pattern Breakdown:**
1. `Stream.fromEffect` - Lift Effect<T[]> → Stream<T[]>
2. `Stream.flatMap(Stream.fromIterable)` - Flatten T[] → Stream<T>

### 8.2 Stream.repeatEffectWithSchedule (Polling)

```typescript
const subscribeToDevice = (
  deviceId: DeviceId,
  pollIntervalMs: number = 5000
): Stream.Stream<SensorReading, IIoTQueryError> =>
  Stream.repeatEffectWithSchedule(
    Effect.gen(function* () {
      const latest = yield* tsClient.getLatestReading(deviceId)
      return latest
    }),
    Schedule.spaced(pollIntervalMs)
  ).pipe(
    Stream.filter((reading): reading is SensorReading => reading !== null)
  )
```

**Effect:** Polls every `pollIntervalMs`, filters out null results.

### 8.3 Stream.mapEffect (Async Transformation)

```typescript
const getEnrichedAlerts = (params) =>
  alarmService.getAlarms({ onlyOpen: true }).pipe(
    Stream.take(50),
    Stream.mapEffect((alarm) =>
      Effect.gen(function* () {
        const hierarchy = yield* assetService.getSensorHierarchy(alarm.deviceId).pipe(Effect.option)
        const readings = yield* sensorService.queryReadings({ deviceId: alarm.deviceId }).pipe(Stream.runCollect)
        return { alarm, hierarchy, recentReadings: Chunk.toArray(readings) }
      })
    )
  )
```

**Pattern:** Transform each stream element with an Effect (async operation).

---

## 9. What's Working Well

### 9.1 Clean Layer Separation

- L1/L2/L3 boundaries are well-defined
- No cross-layer imports (L3 never imports L1 directly)
- Each layer has clear responsibilities

### 9.2 Effect-Native Throughout

- No `Promise`, no `async/await`, no callbacks
- Consistent error handling via `Effect.catchAll`
- Stream-based APIs for progressive data consumption

### 9.3 Automatic Dependency Injection

- `Effect.Service` with `dependencies` array eliminates boilerplate
- No manual `Layer.provide` chains in application code
- TestLayers allow swapping implementations (e.g., `TimeSeriesClientTest`)

### 9.4 Type-Safe Database Operations

- `sql<RowType>` template literals enforce result types
- Schema.transformOrFail for validated decode/encode (AlarmService)
- Branded identifiers (DeviceId, AlarmId) prevent type confusion

### 9.5 Column Name Normalization

- `transformResultNames` converts `snake_case` → `camelCase` globally
- Works seamlessly with Apache AGE's lowercase identifier issue

### 9.6 Health Checks Built-In

- `checkIIoTDatabaseHealth` verifies TimescaleDB + AGE extensions
- Hypertable stats, continuous aggregate checks
- Graph existence validation

### 9.7 Stream Composition

- Queries return `Stream.Stream<T>` for backpressure-aware consumption
- Composable with `.pipe(Stream.take(10))`, `.pipe(Stream.filter(...))`, etc.
- `Stream.runCollect` for in-memory operations when needed

---

## 10. What Needs Improvement for v3

### 10.1 Schema Validation Inconsistency

**Current State:**
- AlarmService uses `Schema.transformOrFail` (full validation)
- TimeSeriesClient uses manual row mapping (`mapRowToSensorReading`)
- GraphClient uses manual parsing (`parseAgtype`)

**v3 Goal:** All services use Schema.decode for row→domain transformation.

**Example:**
```typescript
// Replace manual mapping
const mapRowToSensorReading = (row: SensorReadingRow): SensorReading => ({
  _tag: 'SensorReading',
  time: DateTime.unsafeMake(row.time),
  deviceId: row.deviceId as DeviceId,
  value: row.value,
  quality: row.quality as QualityScore,
})

// With Schema-driven decode
const SensorReadingFromRow = Schema.transformOrFail(
  SensorReadingRowSchema,
  Schema.typeSchema(SensorReading),
  { /* decode/encode transformations */ }
)
```

### 10.2 No DDL Schema Reflection

**Current State:**
- Schema defined in `docker/iiot-db/init.sql` (SQL)
- Domain types defined in `src/lib/iiot/schemas/*.ts` (TypeScript)
- No automated sync between SQL schema and TypeScript types

**v3 Goal:** DDL-first approach with schema introspection.

**Proposed Flow:**
```
1. Define DDL in SQL files (source of truth)
2. Introspect PostgreSQL schema at build time
3. Generate TypeScript Schema.Struct definitions
4. Generate seed data templates from schema constraints
```

**Benefits:**
- Single source of truth (DDL)
- Type safety enforced by database constraints
- Automatic schema evolution (migrations detected)

### 10.3 Hardcoded Column Lists

**Current State:**
```typescript
const ALARM_COLUMNS = `
  id,
  device_id AS "deviceId",
  alarm_type AS "alarmType",
  severity,
  message,
  ...
` as const
```

**Problem:** Repeated in every query, easy to get out of sync with schema.

**v3 Goal:** Generate column lists from Schema definitions.

**Example:**
```typescript
// Auto-generated from Schema
const selectAlarmColumns = generateSelectColumns(AlarmRowSchema)
// → "id, device_id AS deviceId, alarm_type AS alarmType, ..."
```

### 10.4 Manual Error Mapping

**Current State:**
```typescript
const result = yield* sql<RowType>`SELECT ...`.pipe(
  Effect.catchAll((cause) =>
    Effect.fail(
      new IIoTQueryError({
        operation: 'operationName',
        message: `Failed to X: ${String(cause)}`,
        cause,
      })
    )
  )
)
```

**Problem:** Boilerplate error wrapping in every operation.

**v3 Goal:** Centralized error interceptor layer.

**Example:**
```typescript
const withErrorMapping = <T>(operation: string, effect: Effect.Effect<T, any, any>) =>
  effect.pipe(
    Effect.catchAll((cause) =>
      Effect.fail(new IIoTQueryError({ operation, message: String(cause) }))
    )
  )

const rows = yield* withErrorMapping('queryReadings', sql<RowType>`SELECT ...`)
```

### 10.5 No Seed Data Generation

**Current State:**
- Mock data manually written in `docker/iiot-db/init.sql`
- No schema-aware seed generation

**v3 Goal:** Schema-aware seed generator.

**Proposed API:**
```typescript
const seedConfig = {
  'iiot.sensor_readings': {
    count: 1000,
    strategy: 'timeseries',
    constraints: {
      deviceId: { from: ['SENSOR-001', 'SENSOR-002', 'SENSOR-003'] },
      value: { range: [0, 100] },
      quality: { default: 100 },
      time: { interval: '5 seconds', start: '-7 days' },
    },
  },
}

const seedData = yield* generateSeedData(seedConfig)
yield* bulkInsert('iiot.sensor_readings', seedData)
```

### 10.6 No Migration Tooling

**Current State:**
- Schema changes require manual SQL editing
- No version tracking of schema evolution

**v3 Goal:** DDL-based migrations with version control.

**Proposed:**
```
migrations/
  001-initial-schema.sql
  002-add-alarm-metadata.sql
  003-add-continuous-aggregates.sql

migrate --to 003  # Apply up to version 003
migrate --rollback  # Revert last migration
```

### 10.7 Test Layer Inconsistency

**Current State:**
- `TimeSeriesClientTest` defined but not used in tests
- No test fixtures for PgClient

**v3 Goal:** Full test coverage with in-memory PgClient layer.

**Example:**
```typescript
const testLayer = Layer.provide(
  TimeSeriesClientTest,
  PgClient.layerTest({ /* in-memory SQLite */ })
)

it.effect('inserts readings', () =>
  Effect.gen(function* () {
    const ts = yield* TimeSeriesClient
    const count = yield* ts.insertReadings([{ /* ... */ }])
    expect(count).toBe(1)
  }).pipe(Effect.provide(testLayer))
)
```

### 10.8 No Observability

**Current State:**
- Logging via `Effect.logDebug`, `Effect.logInfo`, `Effect.logWarning`
- No metrics (query duration, error rates)

**v3 Goal:** Built-in metrics and tracing.

**Example:**
```typescript
const queryReadings = (params) =>
  sql<RowType>`SELECT ...`.pipe(
    Effect.withSpan('TimeSeriesClient.queryReadings', {
      attributes: { deviceId: params.deviceId },
    }),
    Effect.catchAll((cause) => {
      metrics.increment('iiot.query.errors', { operation: 'queryReadings' })
      return Effect.fail(new IIoTQueryError({ /* ... */ }))
    })
  )
```

### 10.9 Redundant AlarmService Implementation

**Current State:**
- AlarmService in L2 (database-backed)
- Comment in file: "even though redundant, document it"

**Problem:** Alarms stored in both `iiot.alarms` table AND `iiot_graph` (via trigger).

**v3 Clarification Needed:**
- Should alarms be purely graph-based (single source of truth)?
- Should table be a materialized view of graph data?
- Should graph be secondary index for alarm→sensor relationships?

**Recommendation:** Keep dual storage (table for OLTP, graph for traversal).

---

## 11. Code Examples from Actual Implementation

### 11.1 Complete Service Definition (TimeSeriesClient)

```typescript
export class TimeSeriesClient extends Effect.Service<TimeSeriesClient>()('iiot/TimeSeriesClient', {
  effect: Effect.gen(function* () {
    const sql = yield* PgClient.PgClient

    const insertReadings = (readings) =>
      Effect.gen(function* () {
        if (readings.length === 0) return 0

        const result = yield* pipe(
          Effect.forEach(readings, (reading) =>
            sql`
              INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
              VALUES (${reading.time}, ${reading.deviceId}, ${reading.value}, ${reading.quality ?? 100})
              ON CONFLICT (time, device_id) DO UPDATE SET
                value = EXCLUDED.value, quality = EXCLUDED.quality
              RETURNING device_id
            `
          ),
          Effect.map((results) => results.reduce((acc, r) => acc + r.length, 0))
        )

        return result
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(new IIoTQueryError({
            operation: 'insertReadings',
            message: `Failed to insert readings: ${String(cause)}`,
            cause,
          }))
        )
      )

    const queryReadings = (params) =>
      Stream.fromEffect(
        Effect.gen(function* () {
          const rows = yield* sql<SensorReadingRow>`
            SELECT time, device_id, value, quality
            FROM iiot.sensor_readings
            WHERE device_id = ${params.deviceId}
              AND time >= ${params.since ?? defaultSince}
              AND time <= ${params.until ?? defaultUntil}
            ORDER BY time DESC
            LIMIT ${params.limit ?? 1000}
          `
          return rows.map(mapRowToSensorReading)
        })
      ).pipe(Stream.flatMap(Stream.fromIterable))

    const getLatestReading = (deviceId) =>
      Effect.gen(function* () {
        const rows = yield* sql<SensorReadingRow>`
          SELECT time, device_id, value, quality
          FROM iiot.sensor_readings
          WHERE device_id = ${deviceId}
          ORDER BY time DESC
          LIMIT 1
        `
        if (rows.length === 0) return null
        return mapRowToSensorReading(rows[0])
      })

    return { insertReadings, queryReadings, getLatestReading } as const
  }),
  dependencies: [IIoTPgClientLive],
}) {}
```

### 11.2 Complete Orchestration (IIoTService)

```typescript
export class IIoTService extends Effect.Service<IIoTService>()('iiot/IIoTService', {
  dependencies: [SensorService.Default, AssetService.Default, AlarmService.Default],

  effect: Effect.gen(function* () {
    const sensorService = yield* SensorService
    const assetService = yield* AssetService
    const alarmService = yield* AlarmService

    const getDeviceContext = (deviceId) =>
      Effect.gen(function* () {
        const [hierarchy, latestReading, alarmsChunk] = yield* Effect.all([
          assetService.getSensorHierarchy(deviceId),
          sensorService.getLatestReading(deviceId),
          alarmService.getAlarms({ deviceId, onlyOpen: true }).pipe(Stream.runCollect),
        ])

        return {
          deviceId,
          hierarchy,
          latestReading,
          activeAlarms: Chunk.toArray(alarmsChunk),
        }
      })

    const raiseAlarm = (params) =>
      Effect.gen(function* () {
        const alarm = yield* alarmService.createAlarm({
          deviceId: params.deviceId,
          alarmType: params.alarmType,
          severity: params.severity,
          message: params.message,
        })

        const hierarchy = yield* assetService
          .getSensorHierarchy(params.deviceId)
          .pipe(Effect.option)

        const readings = yield* sensorService
          .queryReadings({ deviceId: params.deviceId, limit: 10 })
          .pipe(Stream.runCollect)

        return {
          alarm,
          hierarchy: hierarchy._tag === 'Some' ? hierarchy.value : null,
          recentReadings: Chunk.toArray(readings),
        }
      })

    return { getDeviceContext, raiseAlarm } as const
  }),
}) {}
```

### 11.3 Schema Transform (AlarmService)

```typescript
const AlarmRowSchema = Schema.Struct({
  id: Schema.String,
  deviceId: Schema.String,
  alarmType: Schema.String,
  severity: Schema.String,
  message: Schema.NullOr(Schema.String),
  triggeredAt: Schema.DateFromSelf,
  acknowledgedAt: Schema.NullOr(Schema.DateFromSelf),
  clearedAt: Schema.NullOr(Schema.DateFromSelf),
  acknowledgedBy: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

const AlarmFromRow = Schema.transformOrFail(
  AlarmRowSchema,
  Schema.typeSchema(Alarm),
  {
    strict: true,
    decode: (row, _, ast) =>
      ParseResult.try({
        try: () => ({
          _tag: 'Alarm' as const,
          id: row.id as Schema.Schema.Type<typeof AlarmId>,
          deviceId: row.deviceId as Schema.Schema.Type<typeof DeviceId>,
          alarmType: row.alarmType as Schema.Schema.Type<typeof AlarmType>,
          severity: row.severity as Schema.Schema.Type<typeof AlarmSeverity>,
          triggeredAt: DateTime.unsafeFromDate(row.triggeredAt),
          message: row.message ?? undefined,
          acknowledgedAt: row.acknowledgedAt ? DateTime.unsafeFromDate(row.acknowledgedAt) : undefined,
          clearedAt: row.clearedAt ? DateTime.unsafeFromDate(row.clearedAt) : undefined,
          acknowledgedBy: row.acknowledgedBy ?? undefined,
          metadata: row.metadata ?? undefined,
        }),
        catch: (e) =>
          new ParseResult.Type(ast, row, `Failed to decode alarm row: ${String(e)}`),
      }),
    encode: (alarm, _, ast) =>
      ParseResult.try({
        try: () => ({
          id: alarm.id,
          deviceId: alarm.deviceId,
          alarmType: alarm.alarmType,
          severity: alarm.severity,
          message: alarm.message ?? null,
          triggeredAt: DateTime.toDate(alarm.triggeredAt),
          acknowledgedAt: alarm.acknowledgedAt ? DateTime.toDate(alarm.acknowledgedAt) : null,
          clearedAt: alarm.clearedAt ? DateTime.toDate(alarm.clearedAt) : null,
          acknowledgedBy: alarm.acknowledgedBy ?? null,
          metadata: alarm.metadata ?? null,
        }),
        catch: (e) =>
          new ParseResult.Type(ast, alarm, `Failed to encode alarm: ${String(e)}`),
      }),
  }
)

const decodeRow = (row: AlarmRow, operation: string) =>
  Schema.decode(AlarmFromRow)(row).pipe(
    Effect.mapError(
      (parseError) =>
        new IIoTQueryError({
          operation,
          message: `Failed to decode alarm: ${String(parseError)}`,
        })
    )
  )
```

---

## 12. Service Dependency Graph

```
IIoTService (L3)
  ├─ SensorService (L2)
  │   ├─ TimeSeriesClient (L1)
  │   │   └─ IIoTPgClientLive (L1)
  │   └─ GraphClient (L1)
  │       └─ IIoTPgClientLive (L1)
  ├─ AssetService (L2)
  │   └─ GraphClient (L1)
  │       └─ IIoTPgClientLive (L1)
  └─ AlarmService (L2)
      ├─ TimeSeriesClient (L1)
      │   └─ IIoTPgClientLive (L1)
      └─ IIoTPgClientLive (L1) [direct for SQL queries]
```

**Shared Layer:** `IIoTPgClientLive` is injected once, reused by all L1 clients.

---

## 13. Key Takeaways for v3

### 13.1 Preserve These Patterns

1. **Three-layer architecture** (L1/L2/L3 separation)
2. **Effect.Service with automatic dependency injection**
3. **Stream-based query APIs**
4. **Shared PgClient layer** (single connection pool)
5. **Column name transformation** (snake_case → camelCase)

### 13.2 Evolve These Patterns

1. **Schema validation:** Standardize on Schema.transformOrFail for all row→domain conversions
2. **DDL-first approach:** Introspect schema, generate TypeScript types
3. **Schema-aware seed generation:** Constraint-driven mock data
4. **Centralized error mapping:** Reduce boilerplate
5. **Test layers:** Full coverage with in-memory PgClient
6. **Observability:** Metrics, tracing, query duration

### 13.3 Clarify These Decisions

1. **Alarm storage:** Table vs graph (current: both via trigger)
2. **Migration strategy:** SQL files vs code-first
3. **Seed data location:** SQL files vs TypeScript generators

---

## 14. References

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/iiot/services/index.ts` | 20 | Module exports |
| `src/lib/iiot/services/l1/IIoTPgClient.ts` | 232 | Shared PgClient layer |
| `src/lib/iiot/services/l1/TimeSeriesClient.ts` | 516 | TimescaleDB operations |
| `src/lib/iiot/services/l1/GraphClient.ts` | 600 | Apache AGE operations |
| `src/lib/iiot/services/l2/SensorService.ts` | 220 | Sensor domain logic |
| `src/lib/iiot/services/l2/AssetService.ts` | 224 | Asset hierarchy logic |
| `src/lib/iiot/services/l2/AlarmService.ts` | 533 | Alarm lifecycle logic |
| `src/lib/iiot/services/l3/IIoTService.ts` | 402 | Orchestration workflows |

**Total Service Code:** ~2,747 lines

---

## 15. Appendix: Pattern Index

| Pattern | Location | Description |
|---------|----------|-------------|
| **Effect.Service** | All services | Service definition with DI |
| **PgClient.layerConfig** | IIoTPgClient.ts:52 | Environment-based config |
| **transformResultNames** | IIoTPgClient.ts:32 | snake_case → camelCase |
| **checkIIoTDatabaseHealth** | IIoTPgClient.ts:127 | Health checks |
| **Stream.fromEffect + flatMap** | TimeSeriesClient.ts:249 | Query streaming |
| **ON CONFLICT DO UPDATE** | TimeSeriesClient.ts:159 | Idempotent upsert |
| **sql.unsafe with params** | TimeSeriesClient.ts:309 | Dynamic SQL |
| **executeCypher** | GraphClient.ts:151 | Cypher execution |
| **escapeCypher** | GraphClient.ts:120 | Injection prevention |
| **getPlantHierarchy** | GraphClient.ts:433 | Nested graph query |
| **Schema.transformOrFail** | AlarmService.ts:74 | Row decode/encode |
| **Parameterized filters** | AlarmService.ts:266 | Optional SQL filters |
| **Effect.all** | IIoTService.ts:90 | Parallel fetch |
| **Stream.mapEffect** | IIoTService.ts:214 | Async stream transform |
| **Effect.option** | IIoTService.ts:217 | Error → Option |

---

**End of Research Document**
