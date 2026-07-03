/**
 * CheckpointModel — Effect SQL Model + DDL for sios.checkpoints
 * @module sios/models/CheckpointModel
 */

import { Schema, Effect } from 'effect'
import { Model } from '@effect/sql'
import { SqlClient } from '@effect/sql'
import { CheckpointId, WorkPackageId } from '../schemas/identifiers'
import { CreatedAt, UpdatedAtNullable, OptionalMetadata } from './_common'

export class CheckpointModel extends Model.Class<CheckpointModel>('CheckpointModel')({
  id: Model.GeneratedByApp(CheckpointId),
  workPackageId: WorkPackageId,
  zoneId: Model.FieldOption(Schema.String),
  name: Schema.NonEmptyString,
  description: Model.FieldOption(Schema.String),
  status: Schema.String,
  category: Schema.String,
  checklistItems: Schema.Unknown,        // JSONB → ChecklistItem[]
  requiredEvidence: Schema.Unknown,      // JSONB → EvidenceType[]
  collectedEvidence: Schema.Unknown,     // JSONB → Evidence[]
  inspectorId: Model.FieldOption(Schema.String),
  scheduledDate: Model.FieldOption(Schema.DateFromSelf),
  completedDate: Model.FieldOption(Schema.DateFromSelf),
  failureReason: Model.FieldOption(Schema.String),
  waiverReason: Model.FieldOption(Schema.String),
  waiverApprovedBy: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,
  createdAt: CreatedAt,
  updatedAt: UpdatedAtNullable,
}) {}

export const createCheckpointsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sios.checkpoints (
      id                  TEXT PRIMARY KEY,
      work_package_id     TEXT NOT NULL REFERENCES sios.work_packages(id) ON DELETE CASCADE,
      zone_id             TEXT REFERENCES sios.zones(id) ON DELETE SET NULL,
      name                TEXT NOT NULL,
      description         TEXT,
      status              TEXT NOT NULL CHECK (status IN ('pending','ready','passed','failed','waived')),
      category            TEXT NOT NULL CHECK (category IN ('io_checkout','power_on','conveyor_run','divert_accuracy','plc_logic','scada_integration','network_comm','safety_interlock','weight_calibration','barcode_read_rate','structural','fire_system','acceptance','other')),
      checklist_items     JSONB NOT NULL DEFAULT '[]',
      required_evidence   JSONB NOT NULL DEFAULT '[]',
      collected_evidence  JSONB NOT NULL DEFAULT '[]',
      inspector_id        TEXT,
      scheduled_date      TIMESTAMPTZ,
      completed_date      TIMESTAMPTZ,
      failure_reason      TEXT,
      waiver_reason       TEXT,
      waiver_approved_by  TEXT,
      metadata            JSONB DEFAULT '{}',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_cp_wp ON sios.checkpoints(work_package_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_cp_zone ON sios.checkpoints(zone_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_cp_status ON sios.checkpoints(status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_cp_category ON sios.checkpoints(category)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_cp_scheduled ON sios.checkpoints(scheduled_date)`
})
