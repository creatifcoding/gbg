/**
 * IIoT Migrations - Aggregated DDL for Migrator.fromRecord
 *
 * Collects all co-located DDL into a single migration record.
 * Uses Effect-SQL Migrator pattern for version-tracked schema evolution.
 *
 * Migration order:
 * 0001 - Extensions (TimescaleDB, AGE, pg_lake)
 * 0002 - Schema & Graph creation
 * 0003 - Asset tables (plants, lines, machines, sensors)
 * 0004 - Time-series hypertable (sensor_readings)
 * 0005 - Continuous aggregates (1-min, 1-hour rollups)
 * 0006 - Compression & retention policies
 * 0007 - Iceberg analytics table (pg_lake)
 * 0008 - Alarms table with graph trigger
 * 0009 - Alarm graph trigger
 * 0010 - Helper functions
 * 0011 - Permissions
 * 0012 - Alarm context materialized view
 * 0013 - Graph seed data (asset hierarchy)
 *
 * @module
 */

import { Effect } from 'effect'
import { Migrator } from '@effect/sql'

// Infrastructure DDL
import {
  createExtensions,
  createSchema,
  createGraph,
  grantPermissions,
} from './_infrastructure.ddl'

// Helper Functions DDL
import { createAllFunctions } from './_functions.ddl'
import { createGetAlarmContextFunction } from './alarms/AlarmContextModel.ddl'

// Asset DDL
import { createPlantsTable } from './assets/PlantModel.ddl'
import { createLinesTable } from './assets/LineModel.ddl'
import { createMachinesTable } from './assets/MachineModel.ddl'
import { createSensorsTable } from './assets/SensorModel.ddl'

// Readings DDL
import {
  createSensorReadingsTable,
  createReadings1MinAggregate,
  createReadings1HourAggregate,
  createCompressionPolicies,
} from './readings/SensorReadingModel.ddl'
import { createSensorAnalyticsTable } from './readings/AnalyticsRecordModel.ddl'

// Alarms DDL
import {
  createAlarmsTable,
  createAlarmGraphTrigger,
} from './alarms/AlarmModel.ddl'
import { createAlarmContextView } from './alarms/AlarmContextModel.ddl'

// Graph Seed DDL
import { seedGraphHierarchy } from './_graph-seed.ddl'

// =============================================================================
// Migration Record
// =============================================================================

/**
 * IIoT migrations as a Record for Migrator.fromRecord.
 *
 * Each key follows pattern: "NNNN_description"
 * Each value is an Effect<void, SqlError, SqlClient>
 */
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
  // Note: If alarm_context exists as a table, this migration drops it and creates a view instead
  '0012_alarm_context_matview': createAlarmContextView,

  // Graph Seed Data (asset hierarchy)
  // Idempotent - uses MERGE for nodes and relationships
  '0013_graph_seed': seedGraphHierarchy,
} as const

// =============================================================================
// Migration Loader
// =============================================================================

/**
 * Migration loader for use with PgMigrator.layer.
 *
 * Usage:
 * ```ts
 * import { PgMigrator } from '@effect/sql-pg'
 * import { iiotMigrationLoader } from './models/_migrations'
 *
 * const MigratorLive = PgMigrator.layer({
 *   loader: iiotMigrationLoader,
 *   schemaDirectory: 'src/lib/iiot/migrations',
 * })
 * ```
 */
export const iiotMigrationLoader = Migrator.fromRecord(iiotMigrations)

// =============================================================================
// Type Exports
// =============================================================================

export type IIoTMigrationKey = keyof typeof iiotMigrations
