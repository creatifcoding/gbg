/**
 * SIOS — PostgreSQL Migrations
 *
 * Migrator.fromRecord for version-tracked schema evolution.
 * Ordered by dependency: projects → zones → crews → workers → work_packages → tasks → time_entries → issues → checkpoints.
 *
 * Schema: 'sios'
 *
 * @module sios/models/_migrations
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'
import { Migrator } from '@effect/sql'

// DDL imports
import { createProjectsTable } from './ProjectModel'
import { createZonesTable } from './ZoneModel'
import { createCrewsTable } from './CrewModel'
import { createWorkersTable } from './WorkerModel'
import { createWorkPackagesTable } from './WorkPackageModel'
import { createTasksTable } from './TaskModel'
import { createTimeEntriesTable } from './TimeEntryModel'
import { createIssuesTable } from './IssueModel'
import { createCheckpointsTable } from './CheckpointModel'

// =============================================================================
// 0000 — Create Schema
// =============================================================================

const createSiosSchema = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`CREATE SCHEMA IF NOT EXISTS sios`
})

// =============================================================================
// Migration Record
// =============================================================================

export const siosMigrations = {
  '0000_schema': createSiosSchema,
  '0001_projects': createProjectsTable,
  '0002_zones': createZonesTable,
  '0003_crews': createCrewsTable,
  '0004_workers': createWorkersTable,
  '0005_work_packages': createWorkPackagesTable,
  '0006_tasks': createTasksTable,
  '0007_time_entries': createTimeEntriesTable,
  '0008_issues': createIssuesTable,
  '0009_checkpoints': createCheckpointsTable,
} as const

export const siosMigrationLoader = Migrator.fromRecord(siosMigrations)

export type SiosMigrationKey = keyof typeof siosMigrations
