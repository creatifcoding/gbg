/**
 * ADR Review Database Migrations
 *
 * Version-tracked SQL schema for review persistence.
 * Follows the editor v3 migration pattern.
 */
import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// -----------------------------------------------------------------------------
// Schema Version
// -----------------------------------------------------------------------------

const SCHEMA_VERSION = 1

// -----------------------------------------------------------------------------
// SQL Statements
// -----------------------------------------------------------------------------

const CREATE_SCHEMA_VERSION = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);`

const CREATE_UNIT_REVIEWS = `
CREATE TABLE IF NOT EXISTS unit_reviews (
  adr_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TEXT,
  reviewed_by TEXT,
  PRIMARY KEY (adr_id, unit_path)
);`

const CREATE_REVIEW_COMMENTS = `
CREATE TABLE IF NOT EXISTS review_comments (
  id TEXT PRIMARY KEY,
  adr_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reply_to TEXT
);`

const CREATE_COMMENTS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_comments_unit
ON review_comments(adr_id, unit_path);`

// -----------------------------------------------------------------------------
// Migration Helpers
// -----------------------------------------------------------------------------

/**
 * Get current schema version from database.
 * Returns 0 if schema_version table doesn't exist.
 */
export const getCurrentVersion = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Check if schema_version table exists
  const tables = yield* sql<{ name: string }>`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='schema_version'
  `

  if (tables.length === 0) {
    return 0
  }

  // Get latest version
  const versions = yield* sql<{ version: number }>`
    SELECT version FROM schema_version
    ORDER BY version DESC
    LIMIT 1
  `

  return versions.length > 0 ? versions[0].version : 0
})

// -----------------------------------------------------------------------------
// Run Migrations
// -----------------------------------------------------------------------------

/**
 * Run all pending migrations.
 * Idempotent — safe to call multiple times.
 */
export const runMigrations = Effect.gen(function* () {
  yield* Effect.logInfo('[adr-review] Checking migrations...')
  const sql = yield* SqlClient.SqlClient
  const currentVersion = yield* getCurrentVersion
  yield* Effect.logInfo(`[adr-review] Current schema version: ${currentVersion}`)

  // V1: Initial schema
  if (currentVersion < 1) {
    yield* Effect.logInfo('[adr-review] Running migration v1: Initial schema')

    yield* sql.unsafe(CREATE_SCHEMA_VERSION)
    yield* Effect.logInfo('[adr-review] Created schema_version table')

    yield* sql.unsafe(CREATE_UNIT_REVIEWS)
    yield* Effect.logInfo('[adr-review] Created unit_reviews table')

    yield* sql.unsafe(CREATE_REVIEW_COMMENTS)
    yield* Effect.logInfo('[adr-review] Created review_comments table')

    yield* sql.unsafe(CREATE_COMMENTS_INDEX)
    yield* Effect.logInfo('[adr-review] Created comments index')

    yield* sql`
      INSERT INTO schema_version (version, applied_at)
      VALUES (1, ${new Date().toISOString()})
    `

    yield* Effect.logInfo('[adr-review] Migration v1 complete')
  } else {
    yield* Effect.logInfo('[adr-review] No migrations needed')
  }

  yield* Effect.logInfo(`[adr-review] Database at schema version ${SCHEMA_VERSION}`)
})

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { SCHEMA_VERSION }
