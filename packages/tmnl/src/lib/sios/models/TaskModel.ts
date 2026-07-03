/**
 * TaskModel — Effect SQL Model + DDL for sios.tasks
 * @module sios/models/TaskModel
 */

import { Schema, Effect } from 'effect'
import { Model } from '@effect/sql'
import { SqlClient } from '@effect/sql'
import { TaskId, WorkPackageId } from '../schemas/identifiers'
import { CreatedAt, UpdatedAtNullable, OptionalMetadata, NumericFromPg } from './_common'

export class TaskModel extends Model.Class<TaskModel>('TaskModel')({
  id: Model.GeneratedByApp(TaskId),
  workPackageId: WorkPackageId,
  title: Schema.NonEmptyString,
  description: Model.FieldOption(Schema.String),
  status: Schema.String,
  priority: Schema.String,
  assignedTo: Model.FieldOption(Schema.String),
  plannedQty: NumericFromPg,
  actualQty: NumericFromPg,
  plannedHours: NumericFromPg,
  actualHours: NumericFromPg,
  evidence: Schema.Unknown,         // JSONB → Evidence[]
  requiresEvidence: Schema.Boolean,
  startedAt: Model.FieldOption(Schema.DateFromSelf),
  completedAt: Model.FieldOption(Schema.DateFromSelf),
  suspendedAt: Model.FieldOption(Schema.DateFromSelf),
  blockedReason: Model.FieldOption(Schema.String),
  blockedSince: Model.FieldOption(Schema.DateFromSelf),
  costCode: Model.FieldOption(Schema.String),
  sortOrder: NumericFromPg,
  notes: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,
  createdAt: CreatedAt,
  updatedAt: UpdatedAtNullable,
}) {}

export const createTasksTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sios.tasks (
      id                TEXT PRIMARY KEY,
      work_package_id   TEXT NOT NULL REFERENCES sios.work_packages(id) ON DELETE CASCADE,
      title             TEXT NOT NULL,
      description       TEXT,
      status            TEXT NOT NULL CHECK (status IN ('pending','active','suspended','needs_evidence','done','blocked','cancelled')),
      priority          TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical','high','normal','low')),
      assigned_to       TEXT,
      planned_qty       NUMERIC NOT NULL DEFAULT 0,
      actual_qty        NUMERIC NOT NULL DEFAULT 0,
      planned_hours     NUMERIC NOT NULL DEFAULT 0,
      actual_hours      NUMERIC NOT NULL DEFAULT 0,
      evidence          JSONB NOT NULL DEFAULT '[]',
      requires_evidence BOOLEAN NOT NULL DEFAULT false,
      started_at        TIMESTAMPTZ,
      completed_at      TIMESTAMPTZ,
      suspended_at      TIMESTAMPTZ,
      blocked_reason    TEXT,
      blocked_since     TIMESTAMPTZ,
      cost_code         TEXT,
      sort_order        INTEGER NOT NULL DEFAULT 0,
      notes             TEXT,
      metadata          JSONB DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_tasks_wp ON sios.tasks(work_package_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON sios.tasks(status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON sios.tasks(priority)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON sios.tasks(assigned_to)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_tasks_sort ON sios.tasks(work_package_id, sort_order)`
})
