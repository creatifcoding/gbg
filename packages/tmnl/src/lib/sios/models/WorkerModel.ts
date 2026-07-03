/**
 * WorkerModel — Effect SQL Model + DDL for sios.workers
 * @module sios/models/WorkerModel
 */

import { Schema, Effect } from 'effect'
import { Model } from '@effect/sql'
import { SqlClient } from '@effect/sql'
import { WorkerId } from '../schemas/identifiers'
import { CreatedAt, UpdatedAtNullable, OptionalMetadata, NumericFromPg } from './_common'

export class WorkerModel extends Model.Class<WorkerModel>('WorkerModel')({
  id: Model.GeneratedByApp(WorkerId),
  crewId: Model.FieldOption(Schema.String),
  name: Schema.NonEmptyString,
  status: Schema.String,
  tradeRole: Schema.String,
  hourlyRate: NumericFromPg,
  certifications: Schema.Unknown, // JSONB → Certification[]
  badgeNumber: Model.FieldOption(Schema.String),
  badgeExpiry: Model.FieldOption(Schema.DateFromSelf),
  email: Model.FieldOption(Schema.String),
  phone: Model.FieldOption(Schema.String),
  emergencyContact: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,
  createdAt: CreatedAt,
  updatedAt: UpdatedAtNullable,
}) {}

export const createWorkersTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sios.workers (
      id                TEXT PRIMARY KEY,
      crew_id           TEXT REFERENCES sios.crews(id) ON DELETE SET NULL,
      name              TEXT NOT NULL,
      status            TEXT NOT NULL CHECK (status IN ('active','on_leave','badge_pending','badge_expired','cert_expired','offboarded')),
      trade_role        TEXT NOT NULL CHECK (trade_role IN ('electrician','mechanic','ironworker','welder','controls_tech','plc_programmer','network_tech','foreman','superintendent','safety_officer','qc_inspector','commissioning_tech','general_labor','apprentice')),
      hourly_rate       NUMERIC NOT NULL CHECK (hourly_rate > 0),
      certifications    JSONB NOT NULL DEFAULT '[]',
      badge_number      TEXT,
      badge_expiry      TIMESTAMPTZ,
      email             TEXT,
      phone             TEXT,
      emergency_contact TEXT,
      metadata          JSONB DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_workers_crew ON sios.workers(crew_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workers_status ON sios.workers(status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workers_role ON sios.workers(trade_role)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workers_badge_expiry ON sios.workers(badge_expiry)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workers_certs ON sios.workers USING GIN (certifications)`
})
