/**
 * TimeEntryModel — Effect SQL Model + DDL for sios.time_entries
 * @module sios/models/TimeEntryModel
 */

import { Schema, Effect } from 'effect'
import { Model } from '@effect/sql'
import { SqlClient } from '@effect/sql'
import { TimeEntryId, TaskId, WorkPackageId, WorkerId } from '../schemas/identifiers'
import { CreatedAt, UpdatedAtNullable, OptionalMetadata, NumericFromPg } from './_common'

export class TimeEntryModel extends Model.Class<TimeEntryModel>('TimeEntryModel')({
  id: Model.GeneratedByApp(TimeEntryId),
  taskId: TaskId,
  workPackageId: WorkPackageId,
  workerId: WorkerId,
  hours: NumericFromPg,
  cost: Model.FieldOption(NumericFromPg),
  workDate: Model.DateTimeInsertFromDate,
  shiftPattern: Model.FieldOption(Schema.String),
  costCode: Model.FieldOption(Schema.String),
  notes: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,
  createdAt: CreatedAt,
  updatedAt: UpdatedAtNullable,
}) {}

export const createTimeEntriesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sios.time_entries (
      id                TEXT PRIMARY KEY,
      task_id           TEXT NOT NULL REFERENCES sios.tasks(id) ON DELETE CASCADE,
      work_package_id   TEXT NOT NULL REFERENCES sios.work_packages(id) ON DELETE CASCADE,
      worker_id         TEXT NOT NULL REFERENCES sios.workers(id) ON DELETE CASCADE,
      hours             NUMERIC NOT NULL CHECK (hours > 0),
      cost              NUMERIC,
      work_date         TIMESTAMPTZ NOT NULL,
      shift_pattern     TEXT CHECK (shift_pattern IS NULL OR shift_pattern IN ('day','night','swing','extended')),
      cost_code         TEXT,
      notes             TEXT,
      metadata          JSONB DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_te_task ON sios.time_entries(task_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_te_wp ON sios.time_entries(work_package_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_te_worker ON sios.time_entries(worker_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_te_date ON sios.time_entries(work_date)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_te_wp_date ON sios.time_entries(work_package_id, work_date)`
})
