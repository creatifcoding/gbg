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
 * 0014-0015 - Work Orders (sequence, table)
 * 0016-0017 - Equipment State (table, duration view)
 * 0018-0020 - Device Config (table, audit log, trigger)
 * 0021 - Event Journal (partitioned event sourcing)
 * 0022 - Work Order Transitions (FDA 21 CFR Part 11 audit trail)
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

// Asset DDL (ordered by ISA-95 FK hierarchy)
import { createEnterprisesTable } from './assets/EnterpriseModel.ddl'
import { createSitesTable } from './assets/SiteModel.ddl'
import { createAreasTable } from './assets/AreaModel.ddl'
import { createPlantsTable } from './assets/PlantModel.ddl'
import { createLinesTable } from './assets/LineModel.ddl'
import { createWorkCellsTable } from './assets/WorkCellModel.ddl'
import { createMachinesTable } from './assets/MachineModel.ddl'
import { createSensorsTable } from './assets/SensorModel.ddl'
import { createDevicesTable } from './assets/DeviceModel.ddl'

// Readings DDL
import {
  createSensorReadingsTable,
  createReadings1MinAggregate,
  createReadings1HourAggregate,
  createReadings1DayAggregate,
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

// Work Order DDL
import {
  createWorkOrdersTable,
  createWorkOrderSequence,
} from './work-orders/WorkOrderModel.ddl'
import {
  createWorkOrderTransitionsTable,
  createTransitionsImmutabilityTrigger,
} from './work-orders/WorkOrderTransitionModel.ddl'

// Equipment State DDL
import {
  createEquipmentStatesTable,
  createEquipmentStateDurationView,
} from './equipment-state/EquipmentStateModel.ddl'

// Device Config DDL
import {
  createDeviceConfigsTable,
  createDeviceConfigAuditLog,
  createDeviceConfigAuditTrigger,
} from './device-config/DeviceConfigModel.ddl'

// Event Journal DDL
import { createEventJournalSchema } from './_event-journal.ddl'

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

  // Asset tables (ISA-95 FK order: Enterprise → Site → Area → Plant → Line → WorkCell → Machine → Sensor/Device)
  '0003_asset_tables': Effect.gen(function* () {
    yield* createEnterprisesTable
    yield* createSitesTable
    yield* createAreasTable
    yield* createPlantsTable
    yield* createLinesTable
    yield* createWorkCellsTable
    yield* createMachinesTable
    yield* createSensorsTable
    yield* createDevicesTable
  }),

  // Time-series infrastructure
  '0004_sensor_readings_hypertable': createSensorReadingsTable,
  // Sequential: each cagg depends on the previous
  '0005_continuous_aggregates': Effect.gen(function* () {
    yield* createReadings1MinAggregate
    yield* createReadings1HourAggregate
    yield* createReadings1DayAggregate
  }),
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

  // Work Orders (ISA-95 Level 3)
  '0014_work_order_sequence': createWorkOrderSequence,
  '0015_work_orders_table': createWorkOrdersTable,

  // Equipment State (OEE tracking)
  '0016_equipment_states_table': createEquipmentStatesTable,
  '0017_equipment_state_durations': createEquipmentStateDurationView,

  // Device Config (FDA 21 CFR Part 11 compliance)
  '0018_device_configs_table': createDeviceConfigsTable,
  '0019_device_config_audit_log': createDeviceConfigAuditLog,
  '0020_device_config_audit_trigger': createDeviceConfigAuditTrigger,

  // Event Journal (EventLog persistence)
  // Creates partitioned event_journal table with entity_type partitions,
  // event_remotes and event_remotes_sync tables, identity table, and all indexes
  // (including CRDT conflict detection and anti-join indexes)
  '0021_event_journal_schema': createEventJournalSchema,

  // Work Order Transitions (FDA 21 CFR Part 11 audit trail)
  // Normalized transitions table with immutability trigger
  '0022_work_order_transitions': Effect.gen(function* () {
    yield* createWorkOrderTransitionsTable
    yield* createTransitionsImmutabilityTrigger
  }),
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
