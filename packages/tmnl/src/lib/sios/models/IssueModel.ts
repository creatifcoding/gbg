/**
 * IssueModel — Effect SQL Model + DDL for sios.issues
 * @module sios/models/IssueModel
 */

import { Schema, Effect } from 'effect'
import { Model } from '@effect/sql'
import { SqlClient } from '@effect/sql'
import { IssueId, ProjectId } from '../schemas/identifiers'
import { CreatedAt, UpdatedAtNullable, OptionalMetadata } from './_common'

export class IssueModel extends Model.Class<IssueModel>('IssueModel')({
  id: Model.GeneratedByApp(IssueId),
  projectId: ProjectId,
  zoneId: Model.FieldOption(Schema.String),
  workPackageId: Model.FieldOption(Schema.String),
  title: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  status: Schema.String,
  severity: Schema.String,
  category: Schema.String,
  reportedBy: Schema.NonEmptyString,
  assignedTo: Model.FieldOption(Schema.String),
  evidence: Schema.Unknown,             // JSONB → Evidence[]
  slaDeadline: Model.FieldOption(Schema.DateFromSelf),
  resolvedAt: Model.FieldOption(Schema.DateFromSelf),
  verifiedAt: Model.FieldOption(Schema.DateFromSelf),
  resolution: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,
  createdAt: CreatedAt,
  updatedAt: UpdatedAtNullable,
}) {}

export const createIssuesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sios.issues (
      id                TEXT PRIMARY KEY,
      project_id        TEXT NOT NULL REFERENCES sios.projects(id) ON DELETE CASCADE,
      zone_id           TEXT REFERENCES sios.zones(id) ON DELETE SET NULL,
      work_package_id   TEXT REFERENCES sios.work_packages(id) ON DELETE SET NULL,
      title             TEXT NOT NULL,
      description       TEXT NOT NULL,
      status            TEXT NOT NULL CHECK (status IN ('open','assigned','in_progress','resolved','verified','closed','wont_fix')),
      severity          TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
      category          TEXT NOT NULL CHECK (category IN ('safety','quality','design','material','access','coordination','equipment','environmental','other')),
      reported_by       TEXT NOT NULL,
      assigned_to       TEXT,
      evidence          JSONB NOT NULL DEFAULT '[]',
      sla_deadline      TIMESTAMPTZ,
      resolved_at       TIMESTAMPTZ,
      verified_at       TIMESTAMPTZ,
      resolution        TEXT,
      metadata          JSONB DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_issues_project ON sios.issues(project_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_issues_zone ON sios.issues(zone_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_issues_status ON sios.issues(status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_issues_severity ON sios.issues(severity)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_issues_assigned ON sios.issues(assigned_to)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_issues_sla ON sios.issues(sla_deadline)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_issues_evidence ON sios.issues USING GIN (evidence)`
})
