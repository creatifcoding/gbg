/**
 * ZoneModel — Effect SQL Model + DDL for sios.zones
 * @module sios/models/ZoneModel
 */

import { Schema, Effect } from 'effect'
import { Model } from '@effect/sql'
import { SqlClient } from '@effect/sql'
import { ZoneId, ProjectId } from '../schemas/identifiers'
import { CreatedAt, UpdatedAtNullable, OptionalMetadata, NumericFromPg } from './_common'

export class ZoneModel extends Model.Class<ZoneModel>('ZoneModel')({
  id: Model.GeneratedByApp(ZoneId),
  projectId: ProjectId,
  name: Schema.NonEmptyString,
  code: Schema.NonEmptyString,
  status: Schema.String,
  description: Model.FieldOption(Schema.String),
  phaseNumber: Model.FieldOption(NumericFromPg),
  accessConstraints: Model.FieldOption(Schema.String),
  areaSquareFeet: Model.FieldOption(NumericFromPg),
  location: Model.FieldOption(Schema.Unknown),
  holdReason: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,
  createdAt: CreatedAt,
  updatedAt: UpdatedAtNullable,
}) {}

export const createZonesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sios.zones (
      id                  TEXT PRIMARY KEY,
      project_id          TEXT NOT NULL REFERENCES sios.projects(id) ON DELETE CASCADE,
      name                TEXT NOT NULL,
      code                TEXT NOT NULL,
      status              TEXT NOT NULL CHECK (status IN ('defined','active','commissioning','handed_over','on_hold')),
      description         TEXT,
      phase_number        INTEGER,
      access_constraints  TEXT,
      area_square_feet    NUMERIC,
      location            JSONB,
      hold_reason         TEXT,
      metadata            JSONB DEFAULT '{}',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ,
      UNIQUE (project_id, code)
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_zones_project ON sios.zones(project_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_zones_status ON sios.zones(status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_zones_phase ON sios.zones(phase_number)`
})
