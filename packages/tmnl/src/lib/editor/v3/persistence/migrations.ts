/**
 * SQLite Schema Migrations
 *
 * Creates and migrates the editor persistence tables.
 *
 * @module editor/v3/persistence/migrations
 */

import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

// =============================================================================
// Schema Version
// =============================================================================

const SCHEMA_VERSION = 2;

// =============================================================================
// Migration SQL
// =============================================================================

const CREATE_FILE_MAPPINGS = `
CREATE TABLE IF NOT EXISTS file_mappings (
  path TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  last_synced_mtime REAL NOT NULL,
  last_synced_hash TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_file_mappings_document_id ON file_mappings(document_id);
CREATE INDEX IF NOT EXISTS idx_file_mappings_sync_status ON file_mappings(sync_status);
`;

const CREATE_RECENT_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS recent_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  file_path TEXT,
  last_accessed_at TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 1,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_recent_documents_last_accessed ON recent_documents(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_documents_document_id ON recent_documents(document_id);
`;

const CREATE_DOCUMENT_METADATA_CACHE = `
CREATE TABLE IF NOT EXISTS document_metadata_cache (
  document_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  last_modified_at TEXT NOT NULL,
  file_path TEXT,
  tags_json TEXT,
  cached_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metadata_cache_file_path ON document_metadata_cache(file_path);
`;

const CREATE_SCHEMA_VERSION = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

// v2: Block state persistence for focus mode
const CREATE_BLOCK_STATES = `
CREATE TABLE IF NOT EXISTS block_states (
  block_id TEXT PRIMARY KEY,
  fold_state TEXT NOT NULL DEFAULT 'expanded',
  settings_open INTEGER NOT NULL DEFAULT 0,
  active_tab TEXT NOT NULL DEFAULT '',
  node_attrs TEXT NOT NULL DEFAULT '{}',
  saved_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_block_states_saved_at ON block_states(saved_at DESC);
`;

// =============================================================================
// Migration Functions
// =============================================================================

/**
 * Get the current schema version from the database.
 */
export const getCurrentVersion = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Check if schema_version table exists
  const tables = yield* sql<{ name: string }>`
    SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'
  `;

  if (tables.length === 0) {
    return 0;
  }

  const versions = yield* sql<{ version: number }>`
    SELECT MAX(version) as version FROM schema_version
  `;

  return versions[0]?.version ?? 0;
});

/**
 * Run all pending migrations.
 */
export const runMigrations = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const currentVersion = yield* getCurrentVersion;

  yield* Effect.logInfo(`Current schema version: ${currentVersion}`);

  if (currentVersion < 1) {
    yield* Effect.logInfo('Applying migration v1: Initial schema');

    // Create schema version table first
    yield* sql.unsafe(CREATE_SCHEMA_VERSION);

    // Create all tables
    yield* sql.unsafe(CREATE_FILE_MAPPINGS);
    yield* sql.unsafe(CREATE_RECENT_DOCUMENTS);
    yield* sql.unsafe(CREATE_DOCUMENT_METADATA_CACHE);

    // Record migration
    yield* sql`
      INSERT INTO schema_version (version, applied_at) VALUES (1, ${new Date().toISOString()})
    `;

    yield* Effect.logInfo('Migration v1 applied successfully');
  }

  if (currentVersion < 2) {
    yield* Effect.logInfo('Applying migration v2: Block state persistence');

    yield* sql.unsafe(CREATE_BLOCK_STATES);

    yield* sql`
      INSERT INTO schema_version (version, applied_at) VALUES (2, ${new Date().toISOString()})
    `;

    yield* Effect.logInfo('Migration v2 applied successfully');
  }

  yield* Effect.logInfo(`Schema is now at version ${SCHEMA_VERSION}`);
});

/**
 * Drop all tables (for testing).
 */
export const dropAllTables = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql.unsafe('DROP TABLE IF EXISTS file_mappings');
  yield* sql.unsafe('DROP TABLE IF EXISTS recent_documents');
  yield* sql.unsafe('DROP TABLE IF EXISTS document_metadata_cache');
  yield* sql.unsafe('DROP TABLE IF EXISTS block_states');
  yield* sql.unsafe('DROP TABLE IF EXISTS schema_version');

  yield* Effect.logInfo('All tables dropped');
});

/**
 * Reset database (drop and recreate).
 */
export const resetDatabase = Effect.gen(function* () {
  yield* dropAllTables;
  yield* runMigrations;
});
