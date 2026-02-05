/**
 * IIoT Integration Test Layer
 *
 * Provides database connection and services for integration tests.
 * Migrations run automatically when the layer is built.
 *
 * Requires: docker compose -f docker/docker-compose.iiot.yml up -d
 * Connection: postgresql://iiot:iiot_dev@localhost:5433/iiot_mock
 *
 * @module
 */

import { Effect, Layer, Redacted } from 'effect'
import { PgClient } from '@effect/sql-pg'
import * as BunContext from '@effect/platform-bun/BunContext'
import { TimeSeriesClient } from '../../services/l1/TimeSeriesClient'
import { GraphClient } from '../../services/l1/GraphClient'
import {
  IIoTRepositoriesLive,
  HierarchyRepositoriesLive,
  AssetRepositoriesLive,
  AlarmRepositoriesLive,
  ReadingRepositoriesLive,
  WorkOrderRepositoriesLive,
  EquipmentStateRepositoriesLive,
  ConfigRepositoriesLive,
} from '../../repos'
import { IIoTMigratorLive } from '../../migrations/runner'
import { IIoTSqlEventJournalLayer } from '../../infrastructure/sql-event-journal'

// =============================================================================
// Column Name Transformation
// =============================================================================

/**
 * Transform snake_case/lowercase column names to camelCase
 *
 * Must match the transform in IIoTPgClient.ts for consistent behavior.
 * PostgreSQL lowercases unquoted identifiers in RETURN AS clauses.
 */
const transformResultNames = (columnName: string): string =>
  columnName.replace(/_([a-z])/g, (_, char) => char.toUpperCase())

// =============================================================================
// Test Database Configuration
// =============================================================================

/**
 * PostgreSQL client layer for integration tests
 *
 * Uses hardcoded values matching docker-compose.iiot.yml
 * so tests don't depend on environment variables.
 *
 * Includes transformResultNames for consistent column name handling.
 */
export const TestPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
  maxConnections: 5,
  transformResultNames,
})

/**
 * Platform services layer for migrations
 *
 * PgMigrator.layer requires CommandExecutor, FileSystem, and Path.
 * BunContext.layer provides all three from @effect/platform-bun.
 */
const PlatformLive = BunContext.layer

/**
 * Migration layer for tests
 *
 * Runs all migrations when built. This is a side-effect layer -
 * migrations execute during layer construction.
 *
 * Requires: PgClient + Platform services (CommandExecutor, FileSystem, Path)
 */
const TestMigratorLive = IIoTMigratorLive.pipe(
  Layer.provide(TestPgClient),
  Layer.provide(PlatformLive)
)

/**
 * Base layer with PgClient + migrations applied
 *
 * Use this as the foundation for all test layers.
 * Migrations run once when the layer is built.
 */
export const TestPgClientWithMigrations = Layer.merge(TestPgClient, TestMigratorLive)

// =============================================================================
// Service Layers (built on TestPgClient)
// =============================================================================

/**
 * TimeSeriesClient layer using test database
 *
 * The TimeSeriesClient.Default depends on IIoTPgClientLive, but we provide
 * TestPgClient instead to override the connection configuration.
 */
const TimeSeriesClientLayer = TimeSeriesClient.Default.pipe(
  Layer.provide(TestPgClient)
)

/**
 * GraphClient layer using test database
 */
const GraphClientLayer = GraphClient.Default.pipe(Layer.provide(TestPgClient))

// =============================================================================
// Repository Layers (built on TestPgClient)
// =============================================================================

/**
 * All repositories using test database (with migrations)
 *
 * Provides:
 * - PlantRepo, LineRepo, MachineRepo, SensorRepo (assets)
 * - AlarmRepo, AlarmContextRepo (alarms)
 * - SensorReadingRepo, AggregatedReadingRepo, AnalyticsRecordRepo (readings)
 * - Migrations run automatically on layer build
 */
export const RepositoriesIntegrationLayer = IIoTRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

/**
 * Asset repositories only (with migrations)
 */
export const AssetRepositoriesIntegrationLayer = AssetRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

/**
 * Alarm repositories only (with migrations)
 */
export const AlarmRepositoriesIntegrationLayer = AlarmRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

/**
 * Reading repositories only (with migrations)
 */
export const ReadingRepositoriesIntegrationLayer = ReadingRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

/**
 * Work order repositories only (with migrations)
 *
 * Merges TestPgClientWithMigrations to expose PgClient.PgClient for isDatabaseAvailable check.
 */
export const WorkOrderRepositoriesIntegrationLayer = Layer.merge(
  TestPgClientWithMigrations,
  WorkOrderRepositoriesLive.pipe(Layer.provide(TestPgClientWithMigrations))
)

/**
 * Equipment state repositories only (with migrations)
 *
 * Merges TestPgClientWithMigrations to expose PgClient.PgClient for isDatabaseAvailable check.
 */
export const EquipmentStateRepositoriesIntegrationLayer = Layer.merge(
  TestPgClientWithMigrations,
  EquipmentStateRepositoriesLive.pipe(Layer.provide(TestPgClientWithMigrations))
)

/**
 * Config repositories only (with migrations)
 */
export const ConfigRepositoriesIntegrationLayer = ConfigRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

/**
 * ISA-95 Hierarchy repositories only (Enterprise, Site, Area - with migrations)
 *
 * Merges TestPgClientWithMigrations to expose PgClient.PgClient for isDatabaseAvailable check.
 */
export const HierarchyRepositoriesIntegrationLayer = Layer.merge(
  TestPgClientWithMigrations,
  HierarchyRepositoriesLive.pipe(Layer.provide(TestPgClientWithMigrations))
)

// =============================================================================
// Combined Test Layers
// =============================================================================

/**
 * Full IIoT integration test layer
 *
 * Provides:
 * - PgClient for raw SQL access
 * - TimeSeriesClient for TimescaleDB operations
 * - GraphClient for Apache AGE operations
 * - Migrations run automatically on layer build
 *
 * Usage with @effect/vitest:
 * ```typescript
 * import { it } from '@effect/vitest'
 * import { IIoTIntegrationLayer } from './layer'
 *
 * it.layer(IIoTIntegrationLayer)('test name', () =>
 *   Effect.gen(function* () {
 *     const tsClient = yield* TimeSeriesClient
 *     // ... test code
 *   })
 * )
 * ```
 */
export const IIoTIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  TimeSeriesClientLayer,
  GraphClientLayer
)

/**
 * Full IIoT layer with all repositories
 *
 * Provides all services + all repositories for comprehensive tests.
 * Migrations run automatically on layer build.
 */
export const FullIIoTIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  TimeSeriesClientLayer,
  GraphClientLayer,
  RepositoriesIntegrationLayer
)

/**
 * Layer with only TimeSeriesClient (includes migrations)
 */
export const TimeSeriesIntegrationLayer = Layer.merge(
  TestPgClientWithMigrations,
  TimeSeriesClientLayer
)

/**
 * Layer with only GraphClient (includes migrations)
 */
export const GraphIntegrationLayer = Layer.merge(TestPgClientWithMigrations, GraphClientLayer)

// =============================================================================
// Event Journal Layers
// =============================================================================

/**
 * Generate a deterministic test identity for EventJournal.
 *
 * Uses a fixed UUID for reproducible test behavior:
 * "00000000-0000-0000-0000-000000000001" -> TEST-IDENTITY-1
 */
const makeTestIdentityId = (): Uint8Array => {
  // Fixed test identity UUID: 00000000-0000-0000-0000-000000000001
  return new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
}

/**
 * SQL EventJournal layer for integration tests
 *
 * Provides a SQL-backed EventJournal using the test PostgreSQL database.
 * Uses deterministic test identity for reproducible CRDT behavior.
 *
 * Also exposes PgClient.PgClient for utilities like isDatabaseAvailable
 * and cleanTestEventJournal.
 *
 * Usage:
 * ```typescript
 * import { it } from '@effect/vitest'
 * import { EventJournalIntegrationLayer } from './layer'
 * import { EventJournal } from '@effect/experimental/EventJournal'
 *
 * it.layer(EventJournalIntegrationLayer)('test', () =>
 *   Effect.gen(function* () {
 *     const journal = yield* EventJournal.EventJournal
 *     // ... test code
 *   })
 * )
 * ```
 */
const EventJournalLayer = IIoTSqlEventJournalLayer({
  identityId: makeTestIdentityId(),
  entryTable: 'iiot.event_journal',
  remotesTable: 'iiot.event_remotes',
}).pipe(Layer.provide(TestPgClientWithMigrations))

// Merge with TestPgClientWithMigrations so tests can also use PgClient.PgClient
export const EventJournalIntegrationLayer = Layer.merge(
  TestPgClientWithMigrations,
  EventJournalLayer
)

/**
 * Full IIoT layer with EventJournal for event sourcing tests
 *
 * Combines all repositories with SQL EventJournal persistence.
 */
export const FullIIoTWithEventJournalLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  TimeSeriesClientLayer,
  GraphClientLayer,
  RepositoriesIntegrationLayer,
  EventJournalIntegrationLayer
)

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Clean up test data before/after tests
 *
 * Removes data with TEST- prefix in device_id to avoid affecting mock data.
 */
export const cleanTestData = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Clean TimescaleDB test data
  yield* sql`
    DELETE FROM iiot.sensor_readings
    WHERE device_id LIKE 'TEST-%'
  `.pipe(Effect.orElseSucceed(() => undefined))

  // Clean Apache AGE test nodes and edges
  // Note: This is a no-op if TEST- nodes don't exist
  yield* sql
    .unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MATCH (n)
      WHERE n.device_id STARTS WITH 'TEST-' OR n.id STARTS WITH 'TEST-'
      DETACH DELETE n
    $$) AS (result agtype)
  `)
    .pipe(Effect.orElseSucceed(() => undefined))

  yield* Effect.log('Cleaned test data')
})

/**
 * Clean up test assets (ISA-95 hierarchy order)
 *
 * Order matters due to foreign key constraints:
 * Devices -> Sensors -> WorkCells -> Machines -> Lines -> Plants -> Areas -> Sites -> Enterprises
 */
export const cleanTestAssets = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Level 0: Devices (control modules)
  yield* sql`DELETE FROM iiot.devices WHERE id LIKE 'TEST-%' OR id LIKE 'DEV-test-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Level 0: Sensors (field devices)
  yield* sql`DELETE FROM iiot.sensors WHERE device_id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Level 1: WorkCells
  yield* sql`DELETE FROM iiot.workcells WHERE id LIKE 'TEST-%' OR id LIKE 'WKC-test-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Level 1: Machines
  yield* sql`DELETE FROM iiot.machines WHERE id LIKE 'TEST-%' OR id LIKE 'MCH-test-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Level 1: Lines
  yield* sql`DELETE FROM iiot.lines WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Level 2: Plants
  yield* sql`DELETE FROM iiot.plants WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Level 2: Areas
  yield* sql`DELETE FROM iiot.areas WHERE id LIKE 'TEST-%' OR id LIKE 'ARA-test-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Level 3: Sites
  yield* sql`DELETE FROM iiot.sites WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Level 4: Enterprises
  yield* sql`DELETE FROM iiot.enterprises WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  yield* Effect.log('Cleaned test assets')
})

/**
 * Setup test hierarchy (Enterprise, Site, Area) required for FK constraints.
 *
 * Creates parent records that plants/lines/machines/sensors depend on.
 * Uses UPSERT (ON CONFLICT DO NOTHING) to be idempotent.
 */
export const setupTestHierarchy = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Create test enterprise
  yield* sql.unsafe(`
    INSERT INTO iiot.enterprises (id, name, status, hierarchy_path)
    VALUES ('TEST-ENT-001', 'Test Enterprise', 'active', '/TEST-ENT-001')
    ON CONFLICT (id) DO NOTHING
  `)

  // Create test site
  yield* sql.unsafe(`
    INSERT INTO iiot.sites (id, name, status, hierarchy_path, enterprise_id, timezone)
    VALUES ('TEST-SIT-001', 'Test Site', 'active', '/TEST-ENT-001/TEST-SIT-001', 'TEST-ENT-001', 'America/New_York')
    ON CONFLICT (id) DO NOTHING
  `)

  // Create test area (optional, for tests that need area-level hierarchy)
  yield* sql.unsafe(`
    INSERT INTO iiot.areas (id, name, status, hierarchy_path, enterprise_id, site_id)
    VALUES ('TEST-ARA-001', 'Test Area', 'active', '/TEST-ENT-001/TEST-SIT-001/TEST-ARA-001', 'TEST-ENT-001', 'TEST-SIT-001')
    ON CONFLICT (id) DO NOTHING
  `)

  yield* Effect.log('Setup test hierarchy (Enterprise, Site, Area)')
})

/**
 * Setup mock hierarchy (Enterprise, Site) required for FK constraints in seed tests.
 *
 * Creates parent records that MOCK-prefixed plants/lines/machines/sensors depend on.
 * Uses UPSERT (ON CONFLICT DO NOTHING) to be idempotent.
 */
export const setupMockHierarchy = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Create mock enterprise
  yield* sql.unsafe(`
    INSERT INTO iiot.enterprises (id, name, status, hierarchy_path)
    VALUES ('MOCK-ENT-001', 'Mock Enterprise', 'active', '/MOCK-ENT-001')
    ON CONFLICT (id) DO NOTHING
  `)

  // Create mock site
  yield* sql.unsafe(`
    INSERT INTO iiot.sites (id, name, status, hierarchy_path, enterprise_id, timezone)
    VALUES ('MOCK-SITE-001', 'Mock Site', 'active', '/MOCK-ENT-001/MOCK-SITE-001', 'MOCK-ENT-001', 'America/New_York')
    ON CONFLICT (id) DO NOTHING
  `)

  yield* Effect.log('Setup mock hierarchy (Enterprise, Site)')
})

/**
 * Clean up test alarms (Alarm table only)
 *
 * Note: iiot.alarm_context is now a materialized view (not a table).
 * It's refreshed from iiot.alarms and iiot.sensor_readings joins.
 * No DELETE needed - the view reflects current source data.
 */
export const cleanTestAlarms = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  yield* sql`DELETE FROM iiot.alarms WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Also clean alarms created via insert (which generate IDs)
  // These can be identified by device_id
  yield* sql`DELETE FROM iiot.alarms WHERE device_id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  yield* Effect.log('Cleaned test alarms')
})

/**
 * Clean up test readings (SensorReading, AnalyticsRecord)
 */
export const cleanTestReadings = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  yield* sql`DELETE FROM iiot.sensor_readings WHERE device_id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  yield* sql`DELETE FROM iiot.analytics_records WHERE device_id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  yield* Effect.log('Cleaned test readings')
})

/**
 * Clean up test work orders (WorkOrder)
 *
 * Note: work_orders has self-referencing FK (parent_work_order_id),
 * so we delete children first by setting parent_work_order_id to NULL.
 */
export const cleanTestWorkOrders = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Clear parent references first to avoid FK constraint violations
  yield* sql`UPDATE iiot.work_orders SET parent_work_order_id = NULL WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  yield* sql`DELETE FROM iiot.work_orders WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  yield* Effect.log('Cleaned test work orders')
})

/**
 * Clean up test equipment states (EquipmentState)
 *
 * Deletes by:
 * - ID starting with EST- (generated IDs)
 * - machine_id starting with TEST- (old fixture format)
 * - machine_id starting with MCH-test- (new fixture format)
 */
export const cleanTestEquipmentStates = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Clean by ID prefix (unlikely to have TEST- prefix since EST- is used)
  yield* sql`DELETE FROM iiot.equipment_states WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Clean by machine_id - old test fixtures used TEST-MCH-*
  yield* sql`DELETE FROM iiot.equipment_states WHERE machine_id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Clean by machine_id - new test fixtures use MCH-test-*
  yield* sql`DELETE FROM iiot.equipment_states WHERE machine_id LIKE 'MCH-test-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  yield* Effect.log('Cleaned test equipment states')
})

/**
 * Clean up test device configs (DeviceConfig)
 *
 * Order matters due to foreign key constraints:
 * device_config_audit_log -> device_configs
 * device_configs.previous_version_id -> device_configs (self-reference)
 *
 * Deletes by:
 * - target_id LIKE 'TEST-%' (test fixtures use TEST-TMP-001, TEST-VIB-001, etc.)
 * - id LIKE 'CFG-test-%' (manually specified test IDs like CFG-test-sensor-01-v1)
 */
export const cleanTestDeviceConfigs = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Clean audit log first (FK to device_configs) - by target_id
  yield* sql`DELETE FROM iiot.device_config_audit_log WHERE config_id IN (
    SELECT id FROM iiot.device_configs WHERE target_id LIKE 'TEST-%' OR id LIKE 'CFG-test-%'
  )`.pipe(Effect.orElseSucceed(() => undefined))

  // Clear version chain references - by target_id
  yield* sql`UPDATE iiot.device_configs SET previous_version_id = NULL
    WHERE target_id LIKE 'TEST-%' OR id LIKE 'CFG-test-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  // Delete configs by target_id and id patterns
  yield* sql`DELETE FROM iiot.device_configs
    WHERE target_id LIKE 'TEST-%' OR id LIKE 'CFG-test-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  yield* Effect.log('Cleaned test device configs')
})

/**
 * Clean up test event journal entries
 *
 * Cleans entries with TEST-* primary keys from all partitions.
 * Also cleans remotes tables for CRDT sync tracking.
 *
 * Order:
 * 1. event_remotes_sync (FK to event_remotes)
 * 2. event_remotes (references entry_id)
 * 3. event_journal (partitioned table)
 */
export const cleanTestEventJournal = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Clean remotes sync first
  yield* sql`DELETE FROM iiot.event_remotes_sync WHERE remote_id IN (
    SELECT DISTINCT remote_id FROM iiot.event_remotes er
    JOIN iiot.event_journal ej ON er.entry_id = ej.id
    WHERE ej.primary_key LIKE 'TEST-%'
  )`.pipe(Effect.orElseSucceed(() => undefined))

  // Clean remotes entries
  yield* sql`DELETE FROM iiot.event_remotes WHERE entry_id IN (
    SELECT id FROM iiot.event_journal WHERE primary_key LIKE 'TEST-%'
  )`.pipe(Effect.orElseSucceed(() => undefined))

  // Clean journal entries (cascades to partitions)
  yield* sql`DELETE FROM iiot.event_journal WHERE primary_key LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  yield* Effect.log('Cleaned test event journal')
})

/**
 * Clean all test data (assets, alarms, readings, work orders, equipment states, device configs, event journal)
 *
 * Use this for full cleanup between test suites.
 * Order matters due to foreign key constraints:
 * 1. event_journal (no FKs, but has CRDT remotes)
 * 2. device_config_audit_log (FK to device_configs)
 * 3. device_configs (self-reference via previous_version_id)
 * 4. work_orders (self-reference via parent_work_order_id)
 * 5. equipment_states (FK to machines)
 * 6. readings (no FKs to other test tables)
 * 7. alarms
 * 8. assets (sensors -> machines -> lines -> plants)
 * 9. graph data
 */
export const cleanAllTestData = Effect.gen(function* () {
  // Clean event journal first (standalone, no external FKs)
  yield* cleanTestEventJournal
  // Clean config audit and configs (FK chain)
  yield* cleanTestDeviceConfigs
  // Clean work orders (self-referencing FK)
  yield* cleanTestWorkOrders
  // Clean equipment states (FK to machines)
  yield* cleanTestEquipmentStates
  // Clean readings (no FKs to assets in test data)
  yield* cleanTestReadings
  // Clean alarms
  yield* cleanTestAlarms
  // Clean assets (FK chain: sensors -> machines -> lines -> plants)
  yield* cleanTestAssets
  // Clean graph data
  yield* cleanTestData
  yield* Effect.log('Cleaned all test data')
})

/**
 * Wrapper to run test with clean database state
 *
 * Usage:
 * ```typescript
 * it.layer(IIoTIntegrationLayer)('test', () =>
 *   withCleanDatabase(
 *     Effect.gen(function* () {
 *       // Test code here
 *     })
 *   )
 * )
 * ```
 */
export const withCleanDatabase = <A, E, R>(test: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* cleanTestData
    return yield* test
  })

/**
 * Wrapper to run test with fully clean state (all tables)
 */
export const withFullyCleanDatabase = <A, E, R>(test: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* cleanAllTestData
    return yield* test
  })

/**
 * Check if database is available before running tests
 *
 * Returns true if database connection succeeds, false otherwise.
 */
export const isDatabaseAvailable = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  const result = yield* sql<{ ok: number }>`SELECT 1 as ok`.pipe(
    Effect.map(() => true),
    Effect.orElseSucceed(() => false)
  )
  return result
})

/**
 * Skip test if database is not available
 *
 * Usage:
 * ```typescript
 * it.layer(IIoTIntegrationLayer)('test', () =>
 *   skipIfDatabaseUnavailable(
 *     Effect.gen(function* () {
 *       // Test code
 *     })
 *   )
 * )
 * ```
 */
export const skipIfDatabaseUnavailable = <A, E, R>(
  test: Effect.Effect<A, E, R>
): Effect.Effect<A | undefined, E, R | PgClient.PgClient> =>
  Effect.gen(function* () {
    const available = yield* isDatabaseAvailable
    if (!available) {
      yield* Effect.log(
        'SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
      return undefined
    }
    return yield* test
  })
