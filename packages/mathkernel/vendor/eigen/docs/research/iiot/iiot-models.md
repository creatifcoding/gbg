# IIoT Models Pattern Research

**Generated:** 2026-01-25  
**Scope:** Comprehensive analysis of `src/lib/iiot/models/` pattern  
**Purpose:** Document patterns for preservation in v3 iteration

---

## Executive Summary

The IIoT Models system implements a **co-located Model+DDL pattern** for Effect SQL integration with PostgreSQL. Models derive from domain schemas (`schemas/`) and add persistence-specific transforms. DDL files live adjacent to models, enabling version-tracked migrations via `Migrator.fromRecord`.

**Key Insight:** Models are **not** domain schemas—they are persistence adapters with PostgreSQL-specific transforms (`Model.FieldOption`, `Model.Generated`, `Model.DateTimeInsertFromDate`).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Model.Class Pattern](#modelclass-pattern)
3. [Model.FieldOption Pattern](#modelfiledoption-pattern)
4. [Model.Generated Pattern](#modelgenerated-pattern)
5. [DDL Co-location Pattern](#ddl-co-location-pattern)
6. [Common Helpers](#common-helpers)
7. [Migration System](#migration-system)
8. [Infrastructure DDL](#infrastructure-ddl)
9. [Graph Seeding](#graph-seeding)
10. [Code Examples](#code-examples)
11. [Patterns to Preserve](#patterns-to-preserve)

---

## Architecture Overview

```
src/lib/iiot/
├── schemas/               # Domain schemas (Effect Schema)
│   ├── identifiers.ts     # Branded IDs (PlantId, DeviceId, etc.)
│   ├── assets.ts          # Plant, Line, Machine, Sensor
│   ├── readings.ts        # SensorReading, AggregatedReading
│   └── alarms.ts          # Alarm, AlarmContext
│
├── models/                # Persistence models (Effect SQL)
│   ├── _common.ts         # Shared transforms (CreatedAt, OptionalMetadata)
│   ├── _infrastructure.ddl.ts  # Extensions, schema, graph
│   ├── _functions.ddl.ts  # Helper functions
│   ├── _graph-seed.ddl.ts # Initial graph data
│   ├── _migrations.ts     # Aggregated migration record
│   │
│   ├── assets/
│   │   ├── PlantModel.ts       # Model.Class
│   │   ├── PlantModel.ddl.ts   # CREATE TABLE DDL
│   │   ├── LineModel.ts
│   │   ├── LineModel.ddl.ts
│   │   ├── MachineModel.ts
│   │   ├── MachineModel.ddl.ts
│   │   ├── SensorModel.ts
│   │   └── SensorModel.ddl.ts
│   │
│   ├── readings/
│   │   ├── SensorReadingModel.ts
│   │   ├── SensorReadingModel.ddl.ts  # Hypertable + continuous aggs
│   │   ├── AggregatedReadingModel.ts
│   │   ├── AnalyticsRecordModel.ts
│   │   └── AnalyticsRecordModel.ddl.ts  # pg_lake Iceberg
│   │
│   └── alarms/
│       ├── AlarmModel.ts
│       ├── AlarmModel.ddl.ts  # Table + graph trigger
│       ├── AlarmContextModel.ts
│       └── AlarmContextModel.ddl.ts  # Materialized view
│
└── repos/                 # Repositories (not covered here)
```

**Key Principle:** Models derive from domain schemas, adding only PostgreSQL-specific transforms. No business logic in models.

---

## Model.Class Pattern

### Pattern Definition

```typescript
export class <Entity>Model extends Model.Class<<Entity>Model>('<Entity>Model')({
  // 1. Direct field reuse (no transforms needed)
  name: DomainSchema.fields.name,
  
  // 2. Fields with Model-specific transforms
  id: Model.GeneratedByApp(BrandedId),          // Client-provided PK
  optionalField: Model.FieldOption(Schema.String),  // NULL ↔ Option
  
  // 3. DB-only fields (not in domain schema)
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
```

### Real Examples

#### PlantModel (Simple Entity)

```typescript
// src/lib/iiot/models/assets/PlantModel.ts

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { PlantId } from '../../schemas/identifiers'
import { Plant } from '../../schemas/assets'
import { CreatedAt, UpdatedAt } from '../_common'

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

**Domain Schema (for comparison):**

```typescript
// src/lib/iiot/schemas/assets.ts

export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  id: PlantId,
  name: Schema.NonEmptyString,
  location: Schema.optional(Schema.String),
}) {}
```

**Key Transforms:**
- `id: PlantId` → `id: Model.GeneratedByApp(PlantId)` — marks as client-provided PK
- `location: Schema.optional(Schema.String)` → `location: Model.FieldOption(Schema.String)` — NULL ↔ Option mapping
- Added `createdAt`/`updatedAt` — DB-only audit fields

---

#### SensorReadingModel (Composite PK, No Auto-gen)

```typescript
// src/lib/iiot/models/readings/SensorReadingModel.ts

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { SensorReading } from '../../schemas/readings'

export class SensorReadingModel extends Model.Class<SensorReadingModel>('SensorReadingModel')({
  // Derived from SensorReading.fields - with pg Date transform
  time: Schema.DateFromSelf,                      // pg driver returns native Date objects
  deviceId: SensorReading.fields.deviceId,
  value: SensorReading.fields.value,
  quality: SensorReading.fields.quality,
}) {}
```

**Key Insight:** No `Model.Generated` or `Model.GeneratedByApp` — composite PK `(time, deviceId)` means both are provided by caller. Manual repository required.

---

#### AlarmModel (Auto-generated PK)

```typescript
// src/lib/iiot/models/alarms/AlarmModel.ts

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { AlarmId } from '../../schemas/identifiers'
import { Alarm } from '../../schemas/alarms'
import { CreatedAt, OptionalMetadata } from '../_common'

export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  // Derived from Alarm.fields - direct reuse
  deviceId: Alarm.fields.deviceId,
  alarmType: Alarm.fields.alarmType,
  severity: Alarm.fields.severity,

  // Derived with Model-specific transforms
  id: Model.Generated(AlarmId),                         // DB-generated PK
  message: Model.FieldOption(Schema.String),
  triggeredAt: CreatedAt,                               // DateTimeUtc → pg Date
  acknowledgedAt: Model.FieldOption(Schema.DateFromSelf),
  clearedAt: Model.FieldOption(Schema.DateFromSelf),
  acknowledgedBy: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,                           // JSONB field
}) {}
```

**Key Transforms:**
- `id: Model.Generated(AlarmId)` — DB generates PK (e.g., `'ALM-' || gen_random_uuid()`)
- `triggeredAt: CreatedAt` — helper for `Model.DateTimeInsertFromDate` (set on insert)
- `metadata: OptionalMetadata` — JSONB field with NULL ↔ Option

---

## Model.FieldOption Pattern

### Problem Solved

PostgreSQL uses `NULL` for missing values. Effect Schema uses `Option<A>` for optional fields. `Model.FieldOption` bridges this gap:

- **On read:** `NULL` → `Option.none()`, `value` → `Option.some(value)`
- **On write:** `Option.none()` → `NULL`, `Option.some(value)` → `value`

### Usage Pattern

```typescript
// Domain schema (Option-based)
export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  location: Schema.optional(Schema.String),  // Option<string>
}) {}

// Model (NULL-based)
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  location: Model.FieldOption(Schema.String),  // NULL ↔ Option<string>
}) {}
```

### DDL Mapping

```sql
CREATE TABLE iiot.plants (
  location TEXT  -- nullable, no DEFAULT
)
```

**Important:** `Model.FieldOption` does NOT add `DEFAULT NULL`. The column is simply nullable.

---

### Examples from Codebase

| Model | Field | Transform | SQL Type |
|-------|-------|-----------|----------|
| PlantModel | `location` | `Model.FieldOption(Schema.String)` | `TEXT` |
| MachineModel | `model` | `Model.FieldOption(Schema.String)` | `TEXT` |
| AlarmModel | `message` | `Model.FieldOption(Schema.String)` | `TEXT` |
| AlarmModel | `acknowledgedAt` | `Model.FieldOption(Schema.DateFromSelf)` | `TIMESTAMPTZ` |
| AlarmModel | `clearedAt` | `Model.FieldOption(Schema.DateFromSelf)` | `TIMESTAMPTZ` |
| AlarmModel | `acknowledgedBy` | `Model.FieldOption(Schema.String)` | `TEXT` |
| AggregatedReadingModel | `stddevValue` | `Model.FieldOption(Schema.Number)` | `REAL` |
| AnalyticsRecordModel | `stddev` | `Model.FieldOption(Schema.Number)` | `REAL` |

---

## Model.Generated Pattern

### Pattern Definition

**Two variants:**

1. **`Model.Generated(BrandedId)`** — DB generates value (e.g., `gen_random_uuid()`, `serial`)
2. **`Model.GeneratedByApp(BrandedId)`** — Client provides value (e.g., `'PLANT-A'`, `'TMP-001'`)

### Decision Tree

```
Primary key generation strategy?
│
├─ Database generates (auto-increment, UUID)?
│  └─ USE: Model.Generated(BrandedId)
│
└─ Client provides (semantic IDs, device IDs)?
   └─ USE: Model.GeneratedByApp(BrandedId)
```

---

### Examples

#### Model.Generated (DB-generated)

```typescript
// AlarmModel - DB generates UUID-based ID
export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  id: Model.Generated(AlarmId),  // DB generates
  // ...
}) {}
```

**Corresponding DDL:**

```sql
CREATE TABLE iiot.alarms (
  id TEXT PRIMARY KEY DEFAULT 'ALM-' || gen_random_uuid()::TEXT,
  -- ...
)
```

**Usage:**

```typescript
// Insert WITHOUT id (DB generates it)
const alarm = { deviceId, alarmType, severity, ... }
const inserted = yield* AlarmRepo.insert(alarm)
// inserted.id === 'ALM-abc123...' (generated by DB)
```

---

#### Model.GeneratedByApp (Client-provided)

```typescript
// PlantModel - Client provides semantic ID
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  id: Model.GeneratedByApp(PlantId),  // Client provides
  // ...
}) {}
```

**Corresponding DDL:**

```sql
CREATE TABLE iiot.plants (
  id TEXT PRIMARY KEY,  -- No DEFAULT, client must provide
  -- ...
)
```

**Usage:**

```typescript
// Insert WITH id (client provides)
const plant = { id: 'PLANT-A', name: 'Chicago Assembly', ... }
const inserted = yield* PlantRepo.insert(plant)
```

---

### Summary Table

| Model | PK Strategy | Modifier | Example Value |
|-------|-------------|----------|---------------|
| PlantModel | Client-provided | `Model.GeneratedByApp(PlantId)` | `'PLANT-A'` |
| LineModel | Client-provided | `Model.GeneratedByApp(LineId)` | `'LINE-001'` |
| MachineModel | Client-provided | `Model.GeneratedByApp(MachineId)` | `'MCH-001'` |
| SensorModel | Client-provided | `Model.GeneratedByApp(DeviceId)` | `'TMP-001'` |
| AlarmModel | DB-generated | `Model.Generated(AlarmId)` | `'ALM-abc123...'` |
| SensorReadingModel | *Composite PK* | *(none)* | `(time, deviceId)` |

---

## DDL Co-location Pattern

### Pattern Definition

Each Model has a corresponding `.ddl.ts` file that exports Effect-wrapped DDL:

```typescript
// <Entity>Model.ddl.ts

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const create<Entity>Table = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.<table_name> (
      -- column definitions
    )
  `

  // Indexes
  yield* sql`CREATE INDEX IF NOT EXISTS idx_<name> ON iiot.<table> (<cols>)`
})
```

**Benefits:**
- DDL lives next to the Model it creates
- Version-controlled alongside schema changes
- Composable via Effect.gen
- Can be collected into `_migrations.ts`

---

### Examples

#### Simple Table (PlantModel.ddl.ts)

```typescript
// src/lib/iiot/models/assets/PlantModel.ddl.ts

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createPlantsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.plants (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      location    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Index for name lookups
  yield* sql`CREATE INDEX IF NOT EXISTS idx_plants_name ON iiot.plants (name)`
})
```

**Key Observations:**
- `id` has no `DEFAULT` (client-provided via `Model.GeneratedByApp`)
- `location` is nullable (maps to `Model.FieldOption`)
- `created_at`/`updated_at` have `DEFAULT NOW()` (though Model uses `CreatedAt`/`UpdatedAt` transforms)

---

#### Foreign Key Relationship (LineModel.ddl.ts)

```typescript
// src/lib/iiot/models/assets/LineModel.ddl.ts

export const createLinesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.lines (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      plant_id    TEXT NOT NULL REFERENCES iiot.plants(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_plant ON iiot.lines (plant_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_name ON iiot.lines (name)`
})
```

**Key Observations:**
- FK: `plant_id REFERENCES iiot.plants(id) ON DELETE CASCADE`
- Two indexes: FK lookup + name search
- Follows asset hierarchy: plants → lines → machines → sensors

---

#### TimescaleDB Hypertable (SensorReadingModel.ddl.ts)

```typescript
// src/lib/iiot/models/readings/SensorReadingModel.ddl.ts

export const createSensorReadingsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create base table
  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.sensor_readings (
      time        TIMESTAMPTZ NOT NULL,
      device_id   TEXT NOT NULL,
      value       DOUBLE PRECISION NOT NULL,
      quality     INTEGER DEFAULT 100,
      CONSTRAINT sensor_readings_pkey PRIMARY KEY (time, device_id)
    )
  `

  // Convert to hypertable (chunk by day)
  yield* sql.unsafe(`SELECT create_hypertable('iiot.sensor_readings', by_range('time', INTERVAL '1 day'), if_not_exists => TRUE)`)

  // Add space partition for high cardinality workloads
  yield* sql.unsafe(`SELECT add_dimension('iiot.sensor_readings', by_hash('device_id', 4), if_not_exists => TRUE)`)

  // Indexes for efficient queries
  yield* sql`CREATE INDEX IF NOT EXISTS idx_readings_device ON iiot.sensor_readings (device_id, time DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_readings_quality ON iiot.sensor_readings (quality) WHERE quality < 100`
})
```

**Key Observations:**
- Composite PK: `(time, device_id)`
- **TimescaleDB-specific:**
  - `create_hypertable()` — time-series chunking (1-day chunks)
  - `add_dimension()` — space partitioning (hash device_id into 4 partitions)
- Partial index on `quality` for bad readings (`WHERE quality < 100`)

---

#### Continuous Aggregates (still in SensorReadingModel.ddl.ts)

```typescript
export const createReadings1MinAggregate = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS iiot.readings_1min
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
    GROUP BY bucket, device_id
    WITH NO DATA
  `)

  // Refresh policy: update every minute, with 1-minute lag
  yield* sql.unsafe(`
    SELECT add_continuous_aggregate_policy('iiot.readings_1min',
      start_offset => INTERVAL '1 hour',
      end_offset => INTERVAL '1 minute',
      schedule_interval => INTERVAL '1 minute',
      if_not_exists => TRUE
    )
  `)
})
```

**Key Observations:**
- `WITH (timescaledb.continuous)` — automatic refresh
- `WITH NO DATA` — don't populate immediately (policy handles it)
- Refresh policy: keep materialized data from 1 hour ago to 1 minute ago

---

#### Compression & Retention (still in SensorReadingModel.ddl.ts)

```typescript
export const createCompressionPolicies = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Enable compression on sensor_readings
  yield* sql.unsafe(`
    ALTER TABLE iiot.sensor_readings SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'device_id',
      timescaledb.compress_orderby = 'time DESC'
    )
  `)

  // Compress raw data after 7 days
  yield* sql.unsafe(`SELECT add_compression_policy('iiot.sensor_readings', INTERVAL '7 days', if_not_exists => TRUE)`)

  // Drop raw data after 30 days (aggregates preserved longer)
  yield* sql.unsafe(`SELECT add_retention_policy('iiot.sensor_readings', INTERVAL '30 days', if_not_exists => TRUE)`)
})
```

**Key Observations:**
- Compress by `device_id` (segment by), order by `time DESC` (newest first)
- Auto-compress after 7 days
- Auto-drop raw data after 30 days (1-min and 1-hour aggregates remain)

---

#### pg_lake Iceberg Table (AnalyticsRecordModel.ddl.ts)

```typescript
// src/lib/iiot/models/readings/AnalyticsRecordModel.ddl.ts

export const createSensorAnalyticsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Try Iceberg table first, fallback to regular table
  yield* sql.unsafe(`
    DO $$
    BEGIN
        -- Try to create Iceberg table (pg_lake)
        EXECUTE '
            CREATE TABLE IF NOT EXISTS iiot.sensor_analytics (
                device_id   TEXT,
                hour        TIMESTAMPTZ,
                avg_value   REAL,
                min_value   REAL,
                max_value   REAL,
                stddev      REAL,
                sample_count INTEGER,
                PRIMARY KEY (hour, device_id)
            ) USING iceberg
            WITH (partition_by = ''day(hour), bucket(16, device_id)'')
        ';
        RAISE NOTICE 'Created iiot.sensor_analytics as Iceberg table';
    EXCEPTION WHEN OTHERS THEN
        -- Fallback: create regular table if pg_lake not available
        CREATE TABLE IF NOT EXISTS iiot.sensor_analytics (
            device_id   TEXT,
            hour        TIMESTAMPTZ,
            avg_value   REAL,
            min_value   REAL,
            max_value   REAL,
            stddev      REAL,
            sample_count INTEGER,
            PRIMARY KEY (hour, device_id)
        );
        CREATE INDEX IF NOT EXISTS idx_analytics_device ON iiot.sensor_analytics (device_id, hour DESC);
        RAISE NOTICE 'Created iiot.sensor_analytics as regular table (pg_lake not available)';
    END $$
  `)
})
```

**Key Observations:**
- **Graceful degradation:** try Iceberg (columnstore), fallback to regular table
- Iceberg partitioning: `day(hour), bucket(16, device_id)` — time + hash partitions
- If regular table: add index manually

---

#### Materialized View (AlarmContextModel.ddl.ts)

```typescript
// src/lib/iiot/models/alarms/AlarmContextModel.ddl.ts

export const createAlarmContextView = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Drop existing table or view if exists (migration from table to matview)
  yield* sql.unsafe(`DROP TABLE IF EXISTS iiot.alarm_context CASCADE`)
  yield* sql.unsafe(`DROP MATERIALIZED VIEW IF EXISTS iiot.alarm_context CASCADE`)

  yield* sql.unsafe(`
    CREATE MATERIALIZED VIEW iiot.alarm_context AS
    SELECT
      a.id AS alarm_id,
      a.device_id,
      sr.time AS reading_time,
      sr.value,
      sr.quality,
      EXTRACT(EPOCH FROM (sr.time - a.triggered_at)) AS offset_seconds
    FROM iiot.alarms a
    JOIN iiot.sensor_readings sr
      ON sr.device_id = a.device_id
      AND sr.time BETWEEN a.triggered_at - INTERVAL '5 minutes'
                      AND a.triggered_at + INTERVAL '5 minutes'
    WITH NO DATA
  `)

  // Unique index required for REFRESH CONCURRENTLY
  yield* sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alarm_context_unique
    ON iiot.alarm_context (alarm_id, reading_time)
  `)
})
```

**Key Observations:**
- **Materialized view** — pre-computed join for fast reads
- `WITH NO DATA` — don't populate immediately (refresh manually or via policy)
- Unique index enables `REFRESH MATERIALIZED VIEW CONCURRENTLY` (non-blocking)

---

## Common Helpers

### Location: `src/lib/iiot/models/_common.ts`

Shared transforms for Model definitions.

---

### Timestamp Helpers

```typescript
/**
 * DateTime that's set on insert (created_at pattern).
 * Uses Model.DateTimeInsertFromDate for pg driver Date objects.
 */
export const CreatedAt = Model.DateTimeInsertFromDate

/**
 * DateTime that's updated on each modification (updated_at pattern).
 * Uses Model.DateTimeUpdateFromDate for pg driver Date objects.
 */
export const UpdatedAt = Model.DateTimeUpdateFromDate
```

**Usage:**

```typescript
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  createdAt: CreatedAt,  // Set on INSERT
  updatedAt: UpdatedAt,  // Updated on UPDATE
}) {}
```

**DDL:**

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**Important:** While SQL has `DEFAULT NOW()`, the Model transform also ensures correct TypeScript types (Date objects).

---

### Optional Nullable Helper

```typescript
/**
 * Helper for optional fields that are NULL in the database.
 * Maps NULL → undefined on read, undefined → NULL on write.
 */
export const optionalNullable = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Schema.optionalWith(schema, { nullable: true })
```

**Note:** This is defined but **not used** in the codebase. `Model.FieldOption` is preferred.

---

### JSON Transforms

```typescript
/**
 * JSONB stored as text in PostgreSQL (for TEXT columns storing JSON).
 * Wraps a schema to handle JSON stringify/parse.
 * NOTE: For actual JSONB columns, pg driver returns parsed objects - use schema directly.
 */
export const JsonFromString = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Model.JsonFromString(schema)

/**
 * Metadata record schema for arbitrary key-value storage.
 */
export const MetadataRecord = Schema.Record({ key: Schema.String, value: Schema.Unknown })

/**
 * Optional nullable metadata field for JSONB columns.
 * NOTE: pg driver returns JSONB as parsed objects, not strings.
 * So we use the schema directly, not JsonFromString.
 */
export const OptionalMetadata = Model.FieldOption(MetadataRecord)
```

**Usage:**

```typescript
export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  metadata: OptionalMetadata,  // JSONB column, NULL ↔ Option<Record<string, unknown>>
}) {}
```

**DDL:**

```sql
metadata JSONB DEFAULT '{}'
```

**Important:** PostgreSQL driver returns JSONB as parsed objects, so no `JsonFromString` needed. That helper is for TEXT columns storing JSON.

---

## Migration System

### Location: `src/lib/iiot/models/_migrations.ts`

Aggregates all DDL into a single migration record for `Migrator.fromRecord`.

---

### Pattern

```typescript
export const iiotMigrations = {
  '0001_description': Effect1,
  '0002_description': Effect2,
  // ...
} as const

export const iiotMigrationLoader = Migrator.fromRecord(iiotMigrations)
```

---

### Full Migration Record

```typescript
export const iiotMigrations = {
  // Infrastructure
  '0001_extensions': createExtensions,
  '0002_schema_and_graph': Effect.all([createSchema, createGraph], { discard: true }),

  // Asset tables (must be in FK order: plants → lines → machines → sensors)
  '0003_asset_tables': Effect.gen(function* () {
    yield* createPlantsTable
    yield* createLinesTable
    yield* createMachinesTable
    yield* createSensorsTable
  }),

  // Time-series infrastructure
  '0004_sensor_readings_hypertable': createSensorReadingsTable,
  '0005_continuous_aggregates': Effect.all([
    createReadings1MinAggregate,
    createReadings1HourAggregate,
  ], { discard: true }),
  '0006_compression_retention': createCompressionPolicies,

  // Iceberg analytics (pg_lake)
  '0007_analytics_iceberg': createSensorAnalyticsTable,

  // Alarms
  '0008_alarms_table': createAlarmsTable,
  '0009_alarm_graph_trigger': createAlarmGraphTrigger,

  // Helper functions
  '0010_helper_functions': Effect.all([
    createAllFunctions,
    createGetAlarmContextFunction,
  ], { discard: true }),

  // Permissions
  '0011_permissions': grantPermissions,

  // Alarm Context Materialized View
  '0012_alarm_context_matview': createAlarmContextView,

  // Graph Seed Data (asset hierarchy)
  '0013_graph_seed': seedGraphHierarchy,
} as const
```

---

### Key Observations

1. **Sequential numbering:** `0001`, `0002`, etc. — ensures order
2. **FK order:** Assets created before alarms (which FK to sensors)
3. **Infrastructure first:** Extensions → Schema → Graph → Tables
4. **Composition via Effect.all:** Multiple DDL in one migration (e.g., `0003_asset_tables`)
5. **Idempotency:** All DDL uses `IF NOT EXISTS` or `MERGE` (graph)

---

### Usage

```typescript
import { PgMigrator } from '@effect/sql-pg'
import { iiotMigrationLoader } from './models/_migrations'

const MigratorLive = PgMigrator.layer({
  loader: iiotMigrationLoader,
  schemaDirectory: 'src/lib/iiot/migrations',  // Optional: dump SQL files
})

// Run migrations
const program = Effect.gen(function* () {
  const migrator = yield* Migrator.Migrator
  yield* migrator.run()
})

await Effect.runPromise(program.pipe(Effect.provide(MigratorLive)))
```

---

## Infrastructure DDL

### Location: `src/lib/iiot/models/_infrastructure.ddl.ts`

Extensions, schema, graph, and permissions.

---

### Extensions

```typescript
export const createExtensions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // TimescaleDB (already enabled in base image, ensure loaded)
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`)

  // Apache AGE for graph queries
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS age`)
  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  // pg_lake for Iceberg analytics (optional)
  yield* sql.unsafe(`
    DO $$
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_lake CASCADE;
        RAISE NOTICE 'pg_lake extension enabled (Iceberg + DuckDB analytics)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pg_lake not available - continuing without Iceberg storage';
    END $$
  `)

  // Additional useful extensions
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`)
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS btree_gist`)
})
```

**Key Extensions:**
- **TimescaleDB:** Time-series hypertables, continuous aggregates
- **Apache AGE:** Graph database (asset hierarchy)
- **pg_lake:** Iceberg analytics with DuckDB-powered queries (optional)
- **pg_stat_statements:** Query performance monitoring
- **btree_gist:** GiST index support

---

### Schema & Graph

```typescript
export const createSchema = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`CREATE SCHEMA IF NOT EXISTS iiot`
})

export const createGraph = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(`SELECT create_graph('iiot_graph')`)
})
```

**Key Observations:**
- Schema: `iiot` (all tables live here)
- Graph: `iiot_graph` (Apache AGE graph, separate from schema)

---

### Permissions

```typescript
export const grantPermissions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`GRANT USAGE ON SCHEMA iiot TO iiot`)
  yield* sql.unsafe(`GRANT USAGE ON SCHEMA ag_catalog TO iiot`)
  yield* sql.unsafe(`GRANT ALL ON ALL TABLES IN SCHEMA iiot TO iiot`)
  yield* sql.unsafe(`GRANT ALL ON ALL SEQUENCES IN SCHEMA iiot TO iiot`)
  yield* sql.unsafe(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA iiot TO iiot`)
  yield* sql.unsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA ag_catalog TO iiot`)
})
```

---

## Graph Seeding

### Location: `src/lib/iiot/models/_graph-seed.ddl.ts`

Initial asset hierarchy in Apache AGE graph.

---

### Pattern

```typescript
export const createPlantNodes = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:plant {id: 'PLANT-A', name: 'Chicago Assembly', location: 'Chicago, IL'})
    $$) AS (v agtype)
  `)
})
```

**Key Observations:**
- **`MERGE`** — idempotent (safe to run multiple times)
- **`cypher('iiot_graph', $$...$$)`** — Apache AGE syntax for Cypher queries
- **`AS (v agtype)`** — required return type for AGE queries

---

### Asset Hierarchy Created

```
Plants:
  - PLANT-A (Chicago Assembly, Chicago IL)
  - PLANT-B (Detroit Manufacturing, Detroit MI)

Lines:
  - LINE-001 (Body Assembly, PLANT-A)
  - LINE-002 (Paint Shop, PLANT-A)
  - LINE-003 (Final Assembly, PLANT-B)

Machines:
  - MCH-001 (Welding Robot Alpha, LINE-001)
  - MCH-002 (Welding Robot Beta, LINE-001)
  - MCH-003 (Paint Booth 1, LINE-002)
  - MCH-004 (Conveyor System A, LINE-003)

Sensors:
  - TMP-001 (temperature, celsius, MCH-001)
  - VIB-001 (vibration, mm/s, MCH-001)
  - TMP-002 (temperature, celsius, MCH-002)
  - VIB-002 (vibration, mm/s, MCH-002)
  - TMP-003 (temperature, celsius, MCH-003)
  - HUM-001 (humidity, percent, MCH-003)
  - SPD-001 (speed, m/min, MCH-004)
  - CUR-001 (current, amps, MCH-004)
```

---

### Relationships

```
Plant -[:contains]-> Line -[:contains]-> Machine
Sensor -[:monitors]-> Machine
```

**Example:**

```cypher
MATCH (p:plant {id: 'PLANT-A'})-[:contains]->(l:line)-[:contains]->(m:machine)<-[:monitors]-(s:sensor)
RETURN p, l, m, s
```

---

## Code Examples

### Full Model + DDL Example (PlantModel)

**Domain Schema:**

```typescript
// src/lib/iiot/schemas/identifiers.ts
export const PlantId = Schema.String.pipe(Schema.brand('PlantId'))
export type PlantId = Schema.Schema.Type<typeof PlantId>

// src/lib/iiot/schemas/assets.ts
export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  id: PlantId,
  name: Schema.NonEmptyString,
  location: Schema.optional(Schema.String),
}) {}
```

**Model:**

```typescript
// src/lib/iiot/models/assets/PlantModel.ts
import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { PlantId } from '../../schemas/identifiers'
import { Plant } from '../../schemas/assets'
import { CreatedAt, UpdatedAt } from '../_common'

export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  name: Plant.fields.name,
  id: Model.GeneratedByApp(PlantId),
  location: Model.FieldOption(Schema.String),
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
```

**DDL:**

```typescript
// src/lib/iiot/models/assets/PlantModel.ddl.ts
import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createPlantsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.plants (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      location    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_plants_name ON iiot.plants (name)`
})
```

**Repository (hypothetical):**

```typescript
// src/lib/iiot/repos/PlantRepo.ts
import { Model } from '@effect/sql'
import { PlantModel } from '../models/assets/PlantModel'

export const PlantRepo = Model.makeRepository(PlantModel, {
  tableName: 'iiot.plants',
  idColumn: 'id',
  spanPrefix: 'PlantRepo',
})
```

**Usage:**

```typescript
import { Effect } from 'effect'
import { PlantRepo } from './repos/PlantRepo'

const program = Effect.gen(function* () {
  // Insert (client provides id)
  const plant = { id: 'PLANT-C', name: 'Austin Fab', location: 'Austin, TX' }
  const inserted = yield* PlantRepo.insert(plant)

  // Query
  const found = yield* PlantRepo.findById('PLANT-C')

  // Update
  yield* PlantRepo.update({ id: 'PLANT-C', name: 'Austin Fabrication' })
})
```

---

## Patterns to Preserve

### 1. Model Derivation from Domain Schemas

**Pattern:**

```typescript
// Domain schema (pure business logic)
export class Entity extends Schema.TaggedClass<Entity>()('Entity', {
  id: BrandedId,
  field: Schema.String,
  optionalField: Schema.optional(Schema.String),
}) {}

// Model (persistence adapter)
export class EntityModel extends Model.Class<EntityModel>('EntityModel')({
  // Reuse fields
  field: Entity.fields.field,

  // Add persistence transforms
  id: Model.GeneratedByApp(BrandedId),
  optionalField: Model.FieldOption(Schema.String),

  // Add DB-only fields
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
```

**Why:**
- Domain schemas stay pure (no DB concerns)
- Models add only persistence transforms
- Single source of truth for business rules

---

### 2. Co-located DDL

**Pattern:**

```
EntityModel.ts       # Model.Class
EntityModel.ddl.ts   # CREATE TABLE, indexes
```

**Why:**
- Schema changes are atomic (both files in one commit)
- Easy to find DDL for a given Model
- DDL is versioned alongside code

---

### 3. Migration Record Pattern

**Pattern:**

```typescript
export const migrations = {
  '0001_description': ddlEffect1,
  '0002_description': ddlEffect2,
} as const

export const migrationLoader = Migrator.fromRecord(migrations)
```

**Why:**
- Sequential versioning
- Composable via Effect
- Easy to rollback (remove entry, re-run)

---

### 4. Common Helpers

**Pattern:**

```typescript
// _common.ts
export const CreatedAt = Model.DateTimeInsertFromDate
export const UpdatedAt = Model.DateTimeUpdateFromDate
export const OptionalMetadata = Model.FieldOption(MetadataRecord)
```

**Why:**
- DRY (don't repeat timestamp logic)
- Consistent patterns across models
- Easy to update all models at once

---

### 5. Graceful Degradation (pg_lake example)

**Pattern:**

```sql
DO $$
BEGIN
    EXECUTE 'CREATE TABLE ... USING iceberg ...';
    RAISE NOTICE 'Created as Iceberg table';
EXCEPTION WHEN OTHERS THEN
    CREATE TABLE ... (regular table);
    RAISE NOTICE 'Created as regular table (pg_lake not available)';
END $$
```

**Why:**
- Optional extensions don't block migrations
- Fail gracefully, log the fallback
- System remains functional

---

### 6. Idempotent DDL

**Pattern:**

```sql
CREATE TABLE IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...
SELECT create_hypertable(..., if_not_exists => TRUE)
```

```cypher
MERGE (:plant {id: 'PLANT-A', ...})
```

**Why:**
- Safe to re-run migrations
- No "already exists" errors
- Easy to recover from partial migrations

---

### 7. Domain-Driven Directory Structure

**Pattern:**

```
models/
├── assets/      # Asset hierarchy domain
├── readings/    # Time-series domain
├── alarms/      # Alarm domain
```

**Why:**
- Models grouped by domain, not by layer
- Easy to find related models
- Mirrors business structure

---

### 8. Effect-First DDL

**Pattern:**

```typescript
export const createTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`...`
  yield* sql`...`  // Can compose multiple statements
})
```

**Why:**
- Composable via Effect.gen
- Type-safe (SqlClient in scope)
- Can sequence with other Effects

---

### 9. Explicit Column Names (no SELECT *)

**Pattern:**

```sql
CREATE MATERIALIZED VIEW iiot.alarm_context AS
SELECT
  a.id AS alarm_id,          -- Explicit renaming
  a.device_id,
  sr.time AS reading_time,   -- Explicit renaming
  sr.value,
  sr.quality,
  EXTRACT(EPOCH FROM (sr.time - a.triggered_at)) AS offset_seconds
FROM ...
```

**Why:**
- Models know exact column names
- No surprises from `SELECT *`
- Covering index can match exact columns

---

### 10. FK Cascade Deletion

**Pattern:**

```sql
plant_id TEXT NOT NULL REFERENCES iiot.plants(id) ON DELETE CASCADE
```

**Why:**
- Deleting a plant deletes all child lines, machines, sensors
- Maintains referential integrity
- No orphaned records

---

## Summary

The IIoT Models pattern provides:

1. **Model.Class** — Effect SQL persistence layer
2. **Model.FieldOption** — NULL ↔ Option bridge
3. **Model.Generated/GeneratedByApp** — PK generation strategy
4. **Co-located DDL** — Effect-wrapped CREATE TABLE statements
5. **Common helpers** — DRY timestamp and metadata transforms
6. **Migration record** — Version-tracked schema evolution
7. **Infrastructure DDL** — Extensions, schema, graph, permissions
8. **Graph seeding** — Idempotent MERGE for initial data

**Core Principle:** Models are **persistence adapters**, not domain schemas. They derive from domain schemas and add only PostgreSQL-specific transforms.

---

## Next Steps for v3

1. **Preserve co-location** — Keep Model + DDL together
2. **Preserve migration record** — Migrator.fromRecord is elegant
3. **Preserve common helpers** — CreatedAt, UpdatedAt, OptionalMetadata
4. **Consider auto-DDL generation** — Could Models generate their own DDL? (Experimental)
5. **Document FK cascade semantics** — Should all FKs cascade? Or some SET NULL?
6. **Add repo generation examples** — Show full CRUD repos for each model
7. **Add test patterns** — How to test migrations? (Use ephemeral DB, run migrator, assert schema)

