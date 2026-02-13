# Implementation Plan: Migrate init.sql to Co-located DDL Files

Generated: 2026-01-25T12:00:00Z

## Goal

Eliminate `docker/iiot-db/init.sql` entirely by ensuring all functionality is covered by Effect SQL Migrator-compatible co-located DDL files. The Effect SQL Migrator will bootstrap the entire database schema when the application layer is constructed.

## Research Summary

### Current State Analysis

**init.sql contains 12 sections:**
1. Extensions (TimescaleDB, AGE, pg_lake, pg_stat_statements, btree_gist)
2. Schema creation (`iiot`)
3. Apache AGE graph with asset hierarchy nodes and relationships
4. sensor_readings hypertable with space partition
5. Continuous aggregates (readings_1min, readings_1hour)
6. Compression/retention policies
7. Iceberg analytics table (sensor_analytics)
8. Alarms table with graph trigger
9. Helper functions (5 functions)
10. Mock data generation (~700K sensor readings + alarms)
11. Permissions
12. Verification queries

**Current DDL coverage:**
- `_infrastructure.ddl.ts`: Extensions, schema, graph creation, permissions (pg_mooncake, not pg_lake)
- `_functions.ddl.ts`: 4 of 5 helper functions (missing `get_alarm_context`)
- `assets/*.ddl.ts`: Tables only (plants, lines, machines, sensors) - NO graph nodes/relationships
- `readings/SensorReadingModel.ddl.ts`: Hypertable, aggregates, compression
- `readings/AnalyticsRecordModel.ddl.ts`: Iceberg table (uses pg_lake now)
- `alarms/AlarmModel.ddl.ts`: Alarms table and graph trigger
- `alarms/AlarmContextModel.ddl.ts`: Materialized view and `get_alarm_context` function

### Gap Analysis

| Feature | init.sql | DDL Files | Gap |
|---------|----------|-----------|-----|
| TimescaleDB extension | Yes | Yes | None |
| Apache AGE extension | Yes | Yes | None |
| pg_lake extension | Yes | pg_mooncake | **UPDATE NEEDED** |
| pg_stat_statements | Yes | Yes | None |
| btree_gist | Yes | Yes | None |
| iiot schema | Yes | Yes | None |
| iiot_graph creation | Yes | Yes | None |
| **Graph nodes (plants, lines, machines, sensors)** | Yes | **NO** | **MISSING** |
| **Graph relationships (:contains, :monitors)** | Yes | **NO** | **MISSING** |
| Asset tables | No | Yes | N/A (DDL-only) |
| sensor_readings hypertable | Yes | Yes | None |
| Space partition | Yes | Yes | None |
| Continuous aggregates | Yes | Yes | None |
| Compression policies | Yes | Yes | None |
| Retention policies | Yes | Yes | None |
| sensor_analytics (Iceberg) | Yes | Yes | None |
| alarms table | Yes | Yes | None |
| alarm graph trigger | Yes | Yes | None |
| get_device_readings | Yes | Yes | None |
| get_machine_sensors | Yes | Yes | None |
| get_sensor_hierarchy | Yes | Yes | None |
| get_alarm_context | Yes | Yes | None |
| health_check | Yes | Yes | **UPDATE: pg_lake check** |
| **Mock data** | Yes | **NO** | **SEPARATE SEED FILE NEEDED** |
| Permissions | Yes | Yes | None |

## Existing Codebase Analysis

### Migration Registry Pattern

The `_migrations.ts` file uses `Migrator.fromRecord()` to define ordered migrations:

```typescript
export const iiotMigrations = {
  '0001_extensions': createExtensions,
  '0002_schema_and_graph': Effect.all([createSchema, createGraph], { discard: true }),
  '0003_asset_tables': Effect.gen(function* () { ... }),
  // ... through 0012_alarm_context_matview
}
```

Each migration is an `Effect<void, SqlError, SqlClient>`.

### Graph Client Expectations

`GraphClient.ts` expects:
- Graph named `iiot_graph`
- Node labels: `plant`, `line`, `machine`, `sensor`, `alarm`
- Relationships: `contains`, `monitors`, `triggered_by`
- Properties match init.sql schema (id, name, device_id, etc.)

### Test Infrastructure

`__tests__/integration/layer.ts` uses `TestPgClientWithMigrations` which runs all migrations on layer construction. Tests use `TEST-` prefixed IDs for cleanup.

## Implementation Phases

### Phase 1: Update Extension DDL for pg_lake

**Files to modify:**
- `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/models/_infrastructure.ddl.ts`

**Changes:**
1. Replace `pg_mooncake` with `pg_lake` in `createExtensions`
2. Add comment about pg_lake requiring `shared_preload_libraries = 'pg_extension_base'`

```typescript
// Replace pg_mooncake block with:
// pg_lake for Iceberg analytics (optional - requires pg_extension_base)
yield* sql.unsafe(`
  DO $$
  BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_lake CASCADE;
      RAISE NOTICE 'pg_lake extension enabled (Iceberg + DuckDB analytics)';
  EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_lake not available - continuing without Iceberg storage';
  END $$
`)
```

**Acceptance criteria:**
- [ ] `createExtensions` attempts pg_lake, not pg_mooncake
- [ ] Graceful fallback if pg_lake unavailable

---

### Phase 2: Create Graph Seed DDL

**Files to create:**
- `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/models/_graph-seed.ddl.ts`

**Purpose:**
Create the initial asset hierarchy in the Apache AGE graph (nodes and relationships) that init.sql currently provides.

**Implementation:**

```typescript
/**
 * IIoT Graph Seed DDL - Initial Asset Hierarchy
 *
 * Creates the base asset nodes and relationships in Apache AGE graph.
 * This is reference/seed data that the application expects.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Graph Node Creation (Plants, Lines, Machines, Sensors)
// =============================================================================

export const createGraphNodes = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Set search_path for AGE
  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  // Plants
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:plant {id: 'PLANT-A', name: 'Chicago Assembly', location: 'Chicago, IL'})
    $$) AS (v agtype)
  `)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:plant {id: 'PLANT-B', name: 'Detroit Manufacturing', location: 'Detroit, MI'})
    $$) AS (v agtype)
  `)

  // Lines
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:line {id: 'LINE-001', name: 'Body Assembly', plant_id: 'PLANT-A'})
    $$) AS (v agtype)
  `)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:line {id: 'LINE-002', name: 'Paint Shop', plant_id: 'PLANT-A'})
    $$) AS (v agtype)
  `)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:line {id: 'LINE-003', name: 'Final Assembly', plant_id: 'PLANT-B'})
    $$) AS (v agtype)
  `)

  // Machines
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:machine {id: 'MCH-001', name: 'Welding Robot Alpha', model: 'FANUC R-2000iC/210F', line_id: 'LINE-001'})
    $$) AS (v agtype)
  `)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:machine {id: 'MCH-002', name: 'Welding Robot Beta', model: 'FANUC R-2000iC/210F', line_id: 'LINE-001'})
    $$) AS (v agtype)
  `)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:machine {id: 'MCH-003', name: 'Paint Booth 1', model: 'Durr EcoPaint', line_id: 'LINE-002'})
    $$) AS (v agtype)
  `)
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:machine {id: 'MCH-004', name: 'Conveyor System A', model: 'Bosch TS5', line_id: 'LINE-003'})
    $$) AS (v agtype)
  `)

  // Sensors
  const sensors = [
    { deviceId: 'TMP-001', type: 'temperature', unit: 'celsius', machineId: 'MCH-001' },
    { deviceId: 'VIB-001', type: 'vibration', unit: 'mm/s', machineId: 'MCH-001' },
    { deviceId: 'TMP-002', type: 'temperature', unit: 'celsius', machineId: 'MCH-002' },
    { deviceId: 'VIB-002', type: 'vibration', unit: 'mm/s', machineId: 'MCH-002' },
    { deviceId: 'TMP-003', type: 'temperature', unit: 'celsius', machineId: 'MCH-003' },
    { deviceId: 'HUM-001', type: 'humidity', unit: 'percent', machineId: 'MCH-003' },
    { deviceId: 'SPD-001', type: 'speed', unit: 'm/min', machineId: 'MCH-004' },
    { deviceId: 'CUR-001', type: 'current', unit: 'amps', machineId: 'MCH-004' },
  ]

  for (const s of sensors) {
    yield* sql.unsafe(`
      SELECT * FROM cypher('iiot_graph', $$
        MERGE (:sensor {device_id: '${s.deviceId}', type: '${s.type}', unit: '${s.unit}', machine_id: '${s.machineId}'})
      $$) AS (v agtype)
    `)
  }
})

// =============================================================================
// Graph Relationship Creation
// =============================================================================

export const createGraphRelationships = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  // Plant -> Line (contains)
  const plantLines = [
    { plantId: 'PLANT-A', lineId: 'LINE-001' },
    { plantId: 'PLANT-A', lineId: 'LINE-002' },
    { plantId: 'PLANT-B', lineId: 'LINE-003' },
  ]

  for (const { plantId, lineId } of plantLines) {
    yield* sql.unsafe(`
      SELECT * FROM cypher('iiot_graph', $$
        MATCH (p:plant {id: '${plantId}'}), (l:line {id: '${lineId}'})
        MERGE (p)-[:contains]->(l)
      $$) AS (e agtype)
    `)
  }

  // Line -> Machine (contains)
  const lineMachines = [
    { lineId: 'LINE-001', machineId: 'MCH-001' },
    { lineId: 'LINE-001', machineId: 'MCH-002' },
    { lineId: 'LINE-002', machineId: 'MCH-003' },
    { lineId: 'LINE-003', machineId: 'MCH-004' },
  ]

  for (const { lineId, machineId } of lineMachines) {
    yield* sql.unsafe(`
      SELECT * FROM cypher('iiot_graph', $$
        MATCH (l:line {id: '${lineId}'}), (m:machine {id: '${machineId}'})
        MERGE (l)-[:contains]->(m)
      $$) AS (e agtype)
    `)
  }

  // Sensor -> Machine (monitors)
  const machineIds = ['MCH-001', 'MCH-002', 'MCH-003', 'MCH-004']

  for (const machineId of machineIds) {
    yield* sql.unsafe(`
      SELECT * FROM cypher('iiot_graph', $$
        MATCH (m:machine {id: '${machineId}'}), (s:sensor)
        WHERE s.machine_id = '${machineId}'
        MERGE (s)-[:monitors]->(m)
      $$) AS (e agtype)
    `)
  }
})

// =============================================================================
// Combined Export
// =============================================================================

export const seedGraphHierarchy = Effect.gen(function* () {
  yield* createGraphNodes
  yield* createGraphRelationships
})
```

**Key decisions:**
- Use `MERGE` instead of `CREATE` for idempotency
- Split into nodes and relationships for clarity
- Keep same IDs as init.sql for compatibility

**Acceptance criteria:**
- [ ] All plant, line, machine, sensor nodes created
- [ ] All contains and monitors relationships created
- [ ] Migration is idempotent (can run multiple times safely)

---

### Phase 3: Update Health Check Function

**Files to modify:**
- `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/models/_functions.ddl.ts`

**Changes:**
Update `createHealthCheckFunction` to check for `pg_lake` instead of `pg_mooncake`:

```typescript
// Replace the pg_mooncake check with:
SELECT 'pg_lake'::TEXT,
       CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_lake') THEN 'ok' ELSE 'not_installed' END,
       CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_lake')
            THEN 'Iceberg storage available'
            ELSE 'using regular tables for analytics' END;
```

**Acceptance criteria:**
- [ ] Health check reports pg_lake status correctly

---

### Phase 4: Update Migration Registry

**Files to modify:**
- `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/models/_migrations.ts`

**Changes:**
1. Import new graph seed DDL
2. Add migration `0013_graph_seed` after permissions

```typescript
import { seedGraphHierarchy } from './_graph-seed.ddl'

export const iiotMigrations = {
  // ... existing migrations 0001-0012 ...

  // Graph seed data (asset hierarchy)
  '0013_graph_seed': seedGraphHierarchy,
} as const
```

**Why after permissions:**
Graph operations need the iiot user permissions to be set up first.

**Acceptance criteria:**
- [ ] New migration appears in registry
- [ ] Migration runs after permissions (0011)
- [ ] Migration is idempotent

---

### Phase 5: Create Seed Data Module (Optional/Separate)

**Files to create:**
- `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/seed/mock-data.ts`

**Purpose:**
Generate mock sensor readings and alarms for development/testing. This should NOT be a migration - it's optional seed data.

**Implementation:**

```typescript
/**
 * IIoT Mock Data Seeder
 *
 * Generates development/test data for the IIoT database.
 * NOT a migration - run manually or via dev script.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const seedMockReadings = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const devices = [
    { id: 'TMP-001', min: 20, max: 30 },
    { id: 'VIB-001', min: 0, max: 5 },
    { id: 'TMP-002', min: 22, max: 30 },
    { id: 'VIB-002', min: 0, max: 4 },
    { id: 'TMP-003', min: 35, max: 60 },
    { id: 'HUM-001', min: 40, max: 70 },
    { id: 'SPD-001', min: 10, max: 15 },
    { id: 'CUR-001', min: 5, max: 15 },
  ]

  for (const device of devices) {
    const count = device.id.startsWith('SPD') || device.id.startsWith('CUR') ? 50000 : 100000
    const qualityThreshold = device.id.startsWith('TMP-003') || device.id.startsWith('HUM') ? 0.02 : 0.05

    yield* sql.unsafe(`
      INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
      SELECT
        NOW() - (random() * INTERVAL '30 days'),
        '${device.id}',
        ${device.min} + (random() * ${device.max - device.min}),
        CASE WHEN random() > ${qualityThreshold} THEN 100 ELSE 50 END
      FROM generate_series(1, ${count})
      ON CONFLICT DO NOTHING
    `)
  }
})

export const seedMockAlarms = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    INSERT INTO iiot.alarms (device_id, alarm_type, severity, message, triggered_at)
    VALUES
      ('TMP-001', 'high_temperature', 'warning', 'Temperature exceeded threshold: 29.5C', NOW() - INTERVAL '2 hours'),
      ('VIB-001', 'high_vibration', 'critical', 'Vibration exceeded critical threshold: 4.8 mm/s', NOW() - INTERVAL '1 hour'),
      ('TMP-003', 'high_temperature', 'warning', 'Paint booth temperature high: 58C', NOW() - INTERVAL '30 minutes'),
      ('CUR-001', 'overcurrent', 'critical', 'Current spike detected: 14.2 amps', NOW() - INTERVAL '15 minutes')
    ON CONFLICT DO NOTHING
  `)
})

export const refreshAggregates = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`CALL refresh_continuous_aggregate('iiot.readings_1min', NULL, NULL)`)
  yield* sql.unsafe(`CALL refresh_continuous_aggregate('iiot.readings_1hour', NULL, NULL)`)
})

export const seedAllMockData = Effect.gen(function* () {
  yield* seedMockReadings
  yield* seedMockAlarms
  yield* refreshAggregates
  yield* Effect.log('Mock data seeded successfully')
})
```

**Usage:**
```typescript
// In a dev script or test setup
import { seedAllMockData } from './seed/mock-data'

const program = seedAllMockData.pipe(
  Effect.provide(PgClientLive)
)
```

**Acceptance criteria:**
- [ ] Mock data generation is separate from migrations
- [ ] Can be run optionally for development
- [ ] Uses ON CONFLICT for idempotency

---

### Phase 6: Simplify init.sql to Bootstrap Only

**Files to modify:**
- `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docker/iiot-db/init.sql`

**Changes:**
Replace entire file with minimal bootstrap that creates the `iiot` user (needed for permissions):

```sql
-- =============================================================================
-- TMNL IIoT Database Bootstrap
--
-- Minimal setup for Effect SQL Migrator to take over.
-- All schema creation is handled by co-located DDL migrations.
-- =============================================================================

-- Create the iiot user if it doesn't exist
-- (Needed before migrations grant permissions to this user)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'iiot') THEN
        CREATE ROLE iiot WITH LOGIN PASSWORD 'iiot_dev';
    END IF;
END $$;

-- Log that bootstrap is complete
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'IIoT Database Bootstrap Complete';
    RAISE NOTICE 'Schema will be created by Effect SQL Migrator';
    RAISE NOTICE '===========================================';
END $$;
```

**Why keep anything:**
The Docker entrypoint runs init.sql before the app connects. We need the `iiot` user to exist for the migration's GRANT statements to succeed.

**Alternative:** Remove init.sql entirely and update Dockerfile to use environment variables for user creation. The Dockerfile already sets `POSTGRES_USER=iiot`, but that's the superuser - we might need a separate app user.

**Acceptance criteria:**
- [ ] init.sql creates only the iiot role
- [ ] No schema, tables, or data in init.sql
- [ ] Migrations work after fresh container start

---

### Phase 7: Update Dockerfile (Optional)

**Files to modify:**
- `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docker/iiot-db/Dockerfile`

**Optional changes:**
If init.sql becomes a no-op, consider removing the COPY line:

```dockerfile
# REMOVED: Schema now managed by Effect SQL Migrator
# COPY init.sql /docker-entrypoint-initdb.d/10-iiot-schema.sql
```

**Note:** Keep the COPY if we need the user creation bootstrap.

**Acceptance criteria:**
- [ ] Container starts successfully
- [ ] Effect SQL Migrator can run all migrations

---

## Testing Strategy

### Unit Tests
- No changes needed - DDL files are tested via integration tests

### Integration Tests
1. **Fresh database test:**
   - Start container with minimal init.sql
   - Run migrations via `IIoTMigratorLive`
   - Verify all tables exist
   - Verify graph nodes and relationships exist
   - Run `health_check()` function

2. **Idempotency test:**
   - Run migrations twice
   - Verify no errors
   - Verify no duplicate data

3. **Graph traversal test:**
   - Use `GraphClient.getSensorHierarchy()` for each seed sensor
   - Verify correct plant -> line -> machine -> sensor path

### Manual Verification
```bash
# Start fresh container
docker compose -f docker/docker-compose.iiot.yml down -v
docker compose -f docker/docker-compose.iiot.yml up -d

# Run migrations (via test or app startup)
bun test src/lib/iiot/__tests__/integration/migrations.test.ts

# Verify tables
docker exec -it tmnl-iiot-db psql -U iiot -d iiot_mock -c "\dt iiot.*"

# Verify graph
docker exec -it tmnl-iiot-db psql -U iiot -d iiot_mock -c "
SET search_path = ag_catalog, iiot, public;
SELECT * FROM cypher('iiot_graph', \$\$
  MATCH (p:plant)-[:contains]->(l:line)-[:contains]->(m:machine)<-[:monitors]-(s:sensor)
  RETURN p.name, l.name, m.name, s.device_id
\$\$) AS (plant agtype, line agtype, machine agtype, sensor agtype);
"
```

## Risks & Considerations

### Risk 1: Migration Order Dependencies
**Mitigation:** Graph seed (0013) must run after:
- Extensions (0001) - AGE needs to be loaded
- Schema and graph creation (0002) - iiot_graph must exist
- Permissions (0011) - iiot user needs graph access

### Risk 2: Graph CREATE vs MERGE Semantics
**Mitigation:** Use `MERGE` for idempotency. Apache AGE supports MERGE for nodes and relationships.

### Risk 3: pg_lake Availability
**Mitigation:** Keep fallback to regular table in AnalyticsRecordModel.ddl.ts. Already implemented.

### Risk 4: Existing Databases
**Mitigation:**
- Migrations track state in `effect_sql_migrations` table
- `MERGE` and `IF NOT EXISTS` make operations idempotent
- Existing data is preserved

### Risk 5: Mock Data Volume
**Mitigation:** Keep mock data as separate, optional seeder - not in migrations. This allows:
- Fast CI builds (skip mock data)
- Controlled dev environments
- No accidental production data

## Estimated Complexity

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1: Extension DDL | Low | Low |
| Phase 2: Graph Seed DDL | Medium | Medium |
| Phase 3: Health Check | Low | Low |
| Phase 4: Migration Registry | Low | Low |
| Phase 5: Seed Data Module | Medium | Low |
| Phase 6: Simplify init.sql | Low | Medium |
| Phase 7: Dockerfile | Low | Low |

**Total estimate:** 2-3 hours

## File Summary

### Files to Create
1. `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/models/_graph-seed.ddl.ts` - Graph nodes and relationships
2. `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/seed/mock-data.ts` - Optional mock data seeder

### Files to Modify
1. `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/models/_infrastructure.ddl.ts` - pg_mooncake -> pg_lake
2. `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/models/_functions.ddl.ts` - Health check update
3. `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/models/_migrations.ts` - Add graph seed migration
4. `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docker/iiot-db/init.sql` - Simplify to bootstrap only

### Files to Optionally Modify
1. `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docker/iiot-db/Dockerfile` - Remove init.sql COPY if not needed
