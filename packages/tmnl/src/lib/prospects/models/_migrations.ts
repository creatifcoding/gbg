/**
 * Prospect Pipeline — SQLite Migrations
 *
 * Creates and migrates the prospect pipeline tables.
 * Rich fields stored as JSON TEXT columns, marshalled by Schema.transform.
 *
 * Migration order:
 * 0001 - Schema version tracking
 * 0002 - Companies table (with JSON columns for location, revenue, headcount, capabilities)
 * 0003 - Decision makers table (with JSON columns for contacts, tenure, contract estimate)
 * 0004 - Signals table
 * 0005 - Outreach table
 * 0006 - Enrichments table
 * 0007 - Harvest batches table
 *
 * @module prospects/models/_migrations
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Schema Version
// =============================================================================

const SCHEMA_VERSION = 4

// =============================================================================
// DDL — Companies
// =============================================================================

const createCompaniesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS companies (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      slug              TEXT NOT NULL UNIQUE,
      industry          TEXT NOT NULL,
      sub_industry      TEXT,

      -- Structured location (JSON TEXT → GeoLocation)
      location_json     TEXT,

      size              TEXT NOT NULL DEFAULT 'unknown',

      -- Employee count with provenance (JSON TEXT → HeadcountEstimate)
      headcount_json    TEXT,

      -- Revenue range in cents (JSON TEXT → MoneyRange)
      revenue_json      TEXT,

      website           TEXT,
      linkedin_url      TEXT,
      description       TEXT,

      -- TMNL capability fit profile (JSON TEXT → CapabilityMatch[])
      capabilities_json TEXT,

      harvest_source    TEXT NOT NULL DEFAULT 'manual',
      harvest_date      TEXT NOT NULL,
      harvest_batch_id  TEXT,
      pipeline_stage    TEXT NOT NULL DEFAULT 'harvested',

      -- Tags (JSON TEXT → string[])
      tags_json         TEXT,

      notes             TEXT,
      created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_size ON companies(size)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_pipeline_stage ON companies(pipeline_stage)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_harvest_source ON companies(harvest_source)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_harvest_batch ON companies(harvest_batch_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug)`
})

// =============================================================================
// DDL — Decision Makers
// =============================================================================

const createDecisionMakersTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS decision_makers (
      id                      TEXT PRIMARY KEY,
      name                    TEXT NOT NULL,
      title                   TEXT,
      title_level             TEXT NOT NULL DEFAULT 'unknown',
      company_id              TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

      -- Multi-channel contact info (JSON TEXT → ContactMethod[])
      contacts_json           TEXT,

      -- Time in role with origin context (JSON TEXT → RoleTenure)
      tenure_json             TEXT,

      -- Our opportunity size estimate (JSON TEXT → ContractEstimate)
      contract_estimate_json  TEXT,

      cip_capital             REAL NOT NULL DEFAULT 0,
      cip_interest            REAL NOT NULL DEFAULT 0,
      cip_power               REAL NOT NULL DEFAULT 0,
      cip_composite           REAL NOT NULL DEFAULT 0,
      pipeline_stage          TEXT NOT NULL DEFAULT 'harvested',
      notes                   TEXT,
      created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_dm_company_id ON decision_makers(company_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_dm_title_level ON decision_makers(title_level)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_dm_cip_composite ON decision_makers(cip_composite DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_dm_pipeline_stage ON decision_makers(pipeline_stage)`
})

// =============================================================================
// DDL — Signals
// =============================================================================

const createSignalsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS signals (
      id                  TEXT PRIMARY KEY,
      company_id          TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      decision_maker_id   TEXT REFERENCES decision_makers(id) ON DELETE SET NULL,
      signal_type         TEXT NOT NULL,
      title               TEXT NOT NULL,
      description         TEXT,
      source_url          TEXT,
      weight              INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 3),
      detected_at         TEXT NOT NULL,
      expires_at          TEXT,
      raw                 TEXT,
      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_signals_company_id ON signals(company_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_signals_dm_id ON signals(decision_maker_id) WHERE decision_maker_id IS NOT NULL`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(signal_type)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_signals_weight ON signals(weight DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_signals_detected ON signals(detected_at DESC)`
})

// =============================================================================
// DDL — Outreach
// =============================================================================

const createOutreachTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS outreach (
      id                  TEXT PRIMARY KEY,
      decision_maker_id   TEXT NOT NULL REFERENCES decision_makers(id) ON DELETE CASCADE,
      company_id          TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      channel             TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'drafted',
      subject             TEXT,
      body                TEXT,
      sent_at             TEXT,
      responded_at        TEXT,
      notes               TEXT,
      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_outreach_dm_id ON outreach(decision_maker_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_outreach_company_id ON outreach(company_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach(status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_outreach_channel ON outreach(channel)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_outreach_sent ON outreach(sent_at DESC) WHERE sent_at IS NOT NULL`
})

// =============================================================================
// DDL — Enrichments (data augmentation log)
// =============================================================================

const createEnrichmentsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS enrichments (
      id            TEXT PRIMARY KEY,
      company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      source        TEXT NOT NULL,
      field         TEXT NOT NULL,
      old_value     TEXT,
      new_value     TEXT,
      confidence    REAL NOT NULL DEFAULT 1.0,
      enriched_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_enrichments_company ON enrichments(company_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_enrichments_source ON enrichments(source)`
})

// =============================================================================
// DDL — Harvest Batches
// =============================================================================

const createHarvestBatchesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS harvest_batches (
      id              TEXT PRIMARY KEY,
      source          TEXT NOT NULL,
      query           TEXT,
      records_found   INTEGER NOT NULL DEFAULT 0,
      records_new     INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      records_skipped INTEGER NOT NULL DEFAULT 0,
      started_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at    DATETIME,
      status          TEXT NOT NULL DEFAULT 'running',
      notes           TEXT
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_batches_source ON harvest_batches(source)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_batches_status ON harvest_batches(status)`
})

// =============================================================================
// DDL — Proposals
// =============================================================================

const createProposalsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS proposals (
      id                      TEXT PRIMARY KEY,
      company_id              TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title                   TEXT NOT NULL,
      status                  TEXT NOT NULL DEFAULT 'draft',
      version                 INTEGER NOT NULL DEFAULT 1,

      -- Audience: which DMs this targets (JSON TEXT → string[])
      decision_maker_ids_json TEXT NOT NULL DEFAULT '[]',

      -- Justification: which signals motivated this (JSON TEXT → string[])
      signal_ids_json         TEXT NOT NULL DEFAULT '[]',

      -- Structured sections (JSON TEXT → ProposalSection[])
      sections_json           TEXT NOT NULL DEFAULT '[]',

      -- Our pricing estimate (JSON TEXT → ContractEstimate)
      contract_estimate_json  TEXT,

      -- Capability fit profile (JSON TEXT → CapabilityMatch[])
      capabilities_json       TEXT,

      delivery_method         TEXT,
      sent_at                 TEXT,
      expires_at              TEXT,
      notes                   TEXT,
      created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_proposals_company ON proposals(company_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_proposals_version ON proposals(company_id, version DESC)`
})

// =============================================================================
// DDL — Schema Version
// =============================================================================

const createSchemaVersion = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT NOT NULL
    )
  `
})

// =============================================================================
// Aggregated Migration Runner
// =============================================================================

export const runMigrations = Effect.gen(function* () {
  yield* Effect.logInfo('[prospects] Running migrations...')

  yield* createSchemaVersion
  yield* createCompaniesTable
  yield* createDecisionMakersTable
  yield* createSignalsTable
  yield* createOutreachTable
  yield* createEnrichmentsTable
  yield* createHarvestBatchesTable
  yield* createProposalsTable

  const sql = yield* SqlClient.SqlClient
  yield* sql`
    INSERT OR REPLACE INTO schema_version (version, applied_at)
    VALUES (${SCHEMA_VERSION}, ${new Date().toISOString()})
  `

  yield* Effect.logInfo(
    `[prospects] Migrations complete — schema v${SCHEMA_VERSION}`
  )
})

export const dropAllTables = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`DROP TABLE IF EXISTS proposals`
  yield* sql`DROP TABLE IF EXISTS enrichments`
  yield* sql`DROP TABLE IF EXISTS outreach`
  yield* sql`DROP TABLE IF EXISTS signals`
  yield* sql`DROP TABLE IF EXISTS decision_makers`
  yield* sql`DROP TABLE IF EXISTS harvest_batches`
  yield* sql`DROP TABLE IF EXISTS companies`
  yield* sql`DROP TABLE IF EXISTS schema_version`

  yield* Effect.logInfo('[prospects] All tables dropped')
})

export const resetDatabase = Effect.gen(function* () {
  yield* dropAllTables
  yield* runMigrations
})
