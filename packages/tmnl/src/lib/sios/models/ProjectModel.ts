/**
 * ProjectModel — Effect SQL Model + DDL for sios.projects
 * @module sios/models/ProjectModel
 */

import { Schema, Effect } from 'effect'
import { Model } from '@effect/sql'
import { SqlClient } from '@effect/sql'
import { ProjectId } from '../schemas/identifiers'
import { CreatedAt, UpdatedAtNullable, OptionalMetadata, NumericFromPg } from './_common'

// =============================================================================
// Model
// =============================================================================

export class ProjectModel extends Model.Class<ProjectModel>('ProjectModel')({
  id: Model.GeneratedByApp(ProjectId),
  name: Schema.NonEmptyString,
  code: Schema.NonEmptyString,
  status: Schema.String,
  client: Schema.NonEmptyString,
  integrator: Model.FieldOption(Schema.String),
  projectType: Schema.String,
  deliveryMethod: Schema.String,
  siteCondition: Schema.String,
  location: Model.FieldOption(Schema.Unknown),       // JSONB → GeoLocation
  shiftWindow: Model.FieldOption(Schema.Unknown),     // JSONB → ShiftWindow
  timezone: Model.FieldOption(Schema.String),
  startDate: Model.FieldOption(Schema.DateFromSelf),
  endDate: Model.FieldOption(Schema.DateFromSelf),
  actualStartDate: Model.FieldOption(Schema.DateFromSelf),
  actualEndDate: Model.FieldOption(Schema.DateFromSelf),
  budgetedCost: NumericFromPg,
  holdReason: Model.FieldOption(Schema.String),
  description: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,
  createdAt: CreatedAt,
  updatedAt: UpdatedAtNullable,
}) {}

// =============================================================================
// DDL
// =============================================================================

export const createProjectsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sios.projects (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      code              TEXT NOT NULL UNIQUE,
      status            TEXT NOT NULL CHECK (status IN ('bidding','awarded','mobilising','active','commissioning','complete','on_hold','cancelled')),
      client            TEXT NOT NULL,
      integrator        TEXT,
      project_type      TEXT NOT NULL CHECK (project_type IN ('airport_bhs','warehouse_sortation','manufacturing','distribution','parcel_hub','retrofit','other')),
      delivery_method   TEXT NOT NULL CHECK (delivery_method IN ('design_build','design_bid_build','cm_at_risk','integrated_delivery','turnkey')),
      site_condition    TEXT NOT NULL CHECK (site_condition IN ('greenfield','brownfield_full','brownfield_partial','brownfield_overlay')),
      location          JSONB,
      shift_window      JSONB,
      timezone          TEXT,
      start_date        TIMESTAMPTZ,
      end_date          TIMESTAMPTZ,
      actual_start_date TIMESTAMPTZ,
      actual_end_date   TIMESTAMPTZ,
      budgeted_cost     NUMERIC NOT NULL DEFAULT 0,
      hold_reason       TEXT,
      description       TEXT,
      metadata          JSONB DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_projects_status ON sios.projects(status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_projects_type ON sios.projects(project_type)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_projects_code ON sios.projects(code)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_projects_site_condition ON sios.projects(site_condition)`
})
