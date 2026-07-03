/**
 * WorkPackageModel — Effect SQL Model + DDL for sios.work_packages
 * @module sios/models/WorkPackageModel
 */

import { Schema, Effect } from 'effect'
import { Model } from '@effect/sql'
import { SqlClient } from '@effect/sql'
import { WorkPackageId, ProjectId, ZoneId } from '../schemas/identifiers'
import { CreatedAt, UpdatedAtNullable, OptionalMetadata, NumericFromPg } from './_common'

export class WorkPackageModel extends Model.Class<WorkPackageModel>('WorkPackageModel')({
  id: Model.GeneratedByApp(WorkPackageId),
  projectId: ProjectId,
  zoneId: ZoneId,
  name: Schema.NonEmptyString,
  code: Schema.NonEmptyString,
  status: Schema.String,
  discipline: Schema.String,
  progressUnit: Schema.String,
  equipmentFamily: Model.FieldOption(Schema.String),
  assignedCrewId: Model.FieldOption(Schema.String),
  plannedQty: NumericFromPg,
  actualQty: NumericFromPg,
  budgetedCost: NumericFromPg,
  actualCost: NumericFromPg,
  plannedHours: NumericFromPg,
  actualHours: NumericFromPg,
  scheduledStart: Model.FieldOption(Schema.DateFromSelf),
  scheduledEnd: Model.FieldOption(Schema.DateFromSelf),
  actualStart: Model.FieldOption(Schema.DateFromSelf),
  actualEnd: Model.FieldOption(Schema.DateFromSelf),
  description: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,
  createdAt: CreatedAt,
  updatedAt: UpdatedAtNullable,
}) {}

export const createWorkPackagesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sios.work_packages (
      id                TEXT PRIMARY KEY,
      project_id        TEXT NOT NULL REFERENCES sios.projects(id) ON DELETE CASCADE,
      zone_id           TEXT NOT NULL REFERENCES sios.zones(id) ON DELETE CASCADE,
      name              TEXT NOT NULL,
      code              TEXT NOT NULL,
      status            TEXT NOT NULL CHECK (status IN ('planned','active','suspended','complete','closed')),
      discipline        TEXT NOT NULL CHECK (discipline IN ('mechanical','electrical','controls','steelwork','fire_protection','network','general')),
      progress_unit     TEXT NOT NULL CHECK (progress_unit IN ('linear_feet','each','square_feet','cubic_yards','points','hours','weight_lbs')),
      equipment_family  TEXT,
      assigned_crew_id  TEXT REFERENCES sios.crews(id) ON DELETE SET NULL,
      planned_qty       NUMERIC NOT NULL DEFAULT 0,
      actual_qty        NUMERIC NOT NULL DEFAULT 0,
      budgeted_cost     NUMERIC NOT NULL DEFAULT 0,
      actual_cost       NUMERIC NOT NULL DEFAULT 0,
      planned_hours     NUMERIC NOT NULL DEFAULT 0,
      actual_hours      NUMERIC NOT NULL DEFAULT 0,
      scheduled_start   TIMESTAMPTZ,
      scheduled_end     TIMESTAMPTZ,
      actual_start      TIMESTAMPTZ,
      actual_end        TIMESTAMPTZ,
      description       TEXT,
      metadata          JSONB DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ,
      UNIQUE (zone_id, code)
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_wp_project ON sios.work_packages(project_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_wp_zone ON sios.work_packages(zone_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_wp_status ON sios.work_packages(status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_wp_discipline ON sios.work_packages(discipline)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_wp_crew ON sios.work_packages(assigned_crew_id)`
})
