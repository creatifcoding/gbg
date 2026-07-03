/**
 * Prospect Pipeline — PostgreSQL Migrations
 *
 * PG-native DDL. Uses Migrator.fromRecord for version-tracked schema evolution.
 * Follows the IIoT migration pattern: co-located DDL, ordered by dependency.
 *
 * Key differences from SQLite version:
 *   - DATETIME → TIMESTAMPTZ
 *   - TEXT for JSON → JSONB (indexable, queryable)
 *   - AUTOINCREMENT → SERIAL / GENERATED
 *   - ON CONFLICT → PG upsert syntax
 *   - search_path set to 'prospects' schema
 *
 * @module prospects/models/_migrations.pg
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'
import { Migrator } from '@effect/sql'

// =============================================================================
// 0001 — Companies
// =============================================================================

const createCompaniesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS prospects.companies (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      slug              TEXT NOT NULL UNIQUE,
      industry          TEXT NOT NULL,
      sub_industry      TEXT,
      location_json     JSONB,
      size              TEXT NOT NULL DEFAULT 'unknown',
      headcount_json    JSONB,
      revenue_json      JSONB,
      website           TEXT,
      linkedin_url      TEXT,
      description       TEXT,
      capabilities_json JSONB,
      harvest_source    TEXT NOT NULL DEFAULT 'manual',
      harvest_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      harvest_batch_id  TEXT,
      pipeline_stage    TEXT NOT NULL DEFAULT 'harvested',
      tags_json         JSONB,
      notes             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_industry ON prospects.companies(industry)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_size ON prospects.companies(size)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_pipeline_stage ON prospects.companies(pipeline_stage)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_harvest_source ON prospects.companies(harvest_source)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_slug ON prospects.companies(slug)`
  // GIN index on JSONB for flexible querying
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_tags ON prospects.companies USING GIN (tags_json)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_capabilities ON prospects.companies USING GIN (capabilities_json)`
})

// =============================================================================
// 0002 — Decision Makers
// =============================================================================

const createDecisionMakersTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS prospects.decision_makers (
      id                      TEXT PRIMARY KEY,
      name                    TEXT NOT NULL,
      title                   TEXT,
      title_level             TEXT NOT NULL DEFAULT 'unknown',
      company_id              TEXT NOT NULL REFERENCES prospects.companies(id) ON DELETE CASCADE,
      contacts_json           JSONB,
      tenure_json             JSONB,
      contract_estimate_json  JSONB,
      cip_capital             REAL NOT NULL DEFAULT 0,
      cip_interest            REAL NOT NULL DEFAULT 0,
      cip_power               REAL NOT NULL DEFAULT 0,
      cip_composite           REAL NOT NULL DEFAULT 0,
      pipeline_stage          TEXT NOT NULL DEFAULT 'harvested',
      notes                   TEXT,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_dm_company_id ON prospects.decision_makers(company_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_dm_title_level ON prospects.decision_makers(title_level)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_dm_cip_composite ON prospects.decision_makers(cip_composite DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_dm_pipeline_stage ON prospects.decision_makers(pipeline_stage)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_dm_contacts ON prospects.decision_makers USING GIN (contacts_json)`
})

// =============================================================================
// 0003 — Signals
// =============================================================================

const createSignalsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS prospects.signals (
      id                  TEXT PRIMARY KEY,
      company_id          TEXT NOT NULL REFERENCES prospects.companies(id) ON DELETE CASCADE,
      decision_maker_id   TEXT REFERENCES prospects.decision_makers(id) ON DELETE SET NULL,
      signal_type         TEXT NOT NULL,
      title               TEXT NOT NULL,
      description         TEXT,
      source_url          TEXT,
      weight              INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 3),
      detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at          TIMESTAMPTZ,
      raw                 TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_signals_company_id ON prospects.signals(company_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_signals_type ON prospects.signals(signal_type)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_signals_weight ON prospects.signals(weight DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_signals_detected ON prospects.signals(detected_at DESC)`
})

// =============================================================================
// 0004 — Proposals
// =============================================================================

const createProposalsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS prospects.proposals (
      id                      TEXT PRIMARY KEY,
      company_id              TEXT NOT NULL REFERENCES prospects.companies(id) ON DELETE CASCADE,
      title                   TEXT NOT NULL,
      status                  TEXT NOT NULL DEFAULT 'draft',
      version                 INTEGER NOT NULL DEFAULT 1,
      decision_maker_ids_json JSONB NOT NULL DEFAULT '[]',
      signal_ids_json         JSONB NOT NULL DEFAULT '[]',
      sections_json           JSONB NOT NULL DEFAULT '[]',
      contract_estimate_json  JSONB,
      capabilities_json       JSONB,
      delivery_method         TEXT,
      sent_at                 TIMESTAMPTZ,
      expires_at              TIMESTAMPTZ,
      notes                   TEXT,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_proposals_company ON prospects.proposals(company_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_proposals_status ON prospects.proposals(status)`
})

// =============================================================================
// 0005 — Outreach
// =============================================================================

const createOutreachTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS prospects.outreach (
      id                  TEXT PRIMARY KEY,
      decision_maker_id   TEXT NOT NULL REFERENCES prospects.decision_makers(id) ON DELETE CASCADE,
      company_id          TEXT NOT NULL REFERENCES prospects.companies(id) ON DELETE CASCADE,
      channel             TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'drafted',
      subject             TEXT,
      body                TEXT,
      sent_at             TIMESTAMPTZ,
      responded_at        TIMESTAMPTZ,
      notes               TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_outreach_dm_id ON prospects.outreach(decision_maker_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_outreach_company_id ON prospects.outreach(company_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_outreach_status ON prospects.outreach(status)`
})

// =============================================================================
// 0006 — Field Provenance (Current State — upsert)
// =============================================================================

const createFieldProvenanceTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS prospects.field_provenance (
      entity_type     TEXT NOT NULL,
      entity_id       TEXT NOT NULL,
      field_name      TEXT NOT NULL,
      value           TEXT,
      source_json     JSONB NOT NULL,
      transform_json  JSONB,
      confidence      REAL NOT NULL DEFAULT 1.0,
      first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (entity_type, entity_id, field_name)
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_fp_entity ON prospects.field_provenance(entity_type, entity_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_fp_confidence ON prospects.field_provenance(confidence)`
  // GIN index on source_json for connector queries
  yield* sql`CREATE INDEX IF NOT EXISTS idx_fp_source ON prospects.field_provenance USING GIN (source_json)`
})

// =============================================================================
// 0007 — Field Changelog (Deltas — append-only on VALUE CHANGE)
// =============================================================================

const createFieldChangelogTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS prospects.field_changelog (
      id              SERIAL PRIMARY KEY,
      entity_type     TEXT NOT NULL,
      entity_id       TEXT NOT NULL,
      field_name      TEXT NOT NULL,
      old_value       TEXT,
      new_value       TEXT,
      source_json     JSONB NOT NULL,
      transform_json  JSONB,
      confidence      REAL NOT NULL DEFAULT 1.0,
      changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_cl_entity ON prospects.field_changelog(entity_type, entity_id, field_name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_cl_changed ON prospects.field_changelog(changed_at DESC)`
})

// =============================================================================
// 0008 — Harvest Batches
// =============================================================================

const createHarvestBatchesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS prospects.harvest_batches (
      id              TEXT PRIMARY KEY,
      source          TEXT NOT NULL,
      query           TEXT,
      records_found   INTEGER NOT NULL DEFAULT 0,
      records_new     INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      records_skipped INTEGER NOT NULL DEFAULT 0,
      started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at    TIMESTAMPTZ,
      status          TEXT NOT NULL DEFAULT 'running',
      notes           TEXT
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_batches_source ON prospects.harvest_batches(source)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_batches_status ON prospects.harvest_batches(status)`
})

// =============================================================================
// Migration Record (for Migrator.fromRecord)
// =============================================================================

export const prospectMigrations = {
  '0001_companies': createCompaniesTable,
  '0002_decision_makers': createDecisionMakersTable,
  '0003_signals': createSignalsTable,
  '0004_proposals': createProposalsTable,
  '0005_outreach': createOutreachTable,
  '0006_field_provenance': createFieldProvenanceTable,
  '0007_field_changelog': createFieldChangelogTable,
  '0008_harvest_batches': createHarvestBatchesTable,
} as const

export const prospectMigrationLoader = Migrator.fromRecord(prospectMigrations)

export type ProspectMigrationKey = keyof typeof prospectMigrations
