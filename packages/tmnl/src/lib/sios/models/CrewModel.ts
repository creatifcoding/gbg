/**
 * CrewModel — Effect SQL Model + DDL for sios.crews
 * @module sios/models/CrewModel
 */

import { Schema, Effect } from 'effect'
import { Model } from '@effect/sql'
import { SqlClient } from '@effect/sql'
import { CrewId, ProjectId, WorkerId } from '../schemas/identifiers'
import { CreatedAt, UpdatedAtNullable, OptionalMetadata, NumericFromPg } from './_common'

export class CrewModel extends Model.Class<CrewModel>('CrewModel')({
  id: Model.GeneratedByApp(CrewId),
  projectId: ProjectId,
  name: Schema.NonEmptyString,
  discipline: Schema.String,
  shiftPattern: Schema.String,
  foremanId: Model.FieldOption(Schema.String),
  targetHeadcount: NumericFromPg,
  isActive: Schema.Boolean,
  metadata: OptionalMetadata,
  createdAt: CreatedAt,
  updatedAt: UpdatedAtNullable,
}) {}

export const createCrewsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sios.crews (
      id                TEXT PRIMARY KEY,
      project_id        TEXT NOT NULL REFERENCES sios.projects(id) ON DELETE CASCADE,
      name              TEXT NOT NULL,
      discipline        TEXT NOT NULL CHECK (discipline IN ('mechanical','electrical','controls','steelwork','fire_protection','general','commissioning','multi_trade')),
      shift_pattern     TEXT NOT NULL CHECK (shift_pattern IN ('day','night','swing','extended','rotating')),
      foreman_id        TEXT,
      target_headcount  INTEGER NOT NULL CHECK (target_headcount > 0),
      is_active         BOOLEAN NOT NULL DEFAULT true,
      metadata          JSONB DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_crews_project ON sios.crews(project_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_crews_discipline ON sios.crews(discipline)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_crews_active ON sios.crews(is_active)`
})
