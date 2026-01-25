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

const SCHEMA_VERSION = 3;

// =============================================================================
// Migration SQL
// =============================================================================

// NOTE: Column names MUST match Model field names exactly (camelCase)
// @effect/sql Model.makeRepository uses Model field names as SQL column names
const CREATE_FILE_MAPPINGS = `
CREATE TABLE IF NOT EXISTS file_mappings (
  path TEXT PRIMARY KEY,
  documentId TEXT NOT NULL,
  lastSyncedMtime REAL NOT NULL,
  lastSyncedHash TEXT NOT NULL,
  syncStatus TEXT NOT NULL DEFAULT 'synced',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_file_mappings_documentId ON file_mappings(documentId);
CREATE INDEX IF NOT EXISTS idx_file_mappings_syncStatus ON file_mappings(syncStatus);
`;

const CREATE_RECENT_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS recent_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  documentId TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  filePath TEXT,
  lastAccessedAt TEXT NOT NULL,
  accessCount INTEGER NOT NULL DEFAULT 1,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_recent_documents_lastAccessedAt ON recent_documents(lastAccessedAt DESC);
CREATE INDEX IF NOT EXISTS idx_recent_documents_documentId ON recent_documents(documentId);
`;

const CREATE_DOCUMENT_METADATA_CACHE = `
CREATE TABLE IF NOT EXISTS document_metadata_cache (
  documentId TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  wordCount INTEGER NOT NULL DEFAULT 0,
  charCount INTEGER NOT NULL DEFAULT 0,
  lastModifiedAt TEXT NOT NULL,
  filePath TEXT,
  tagsJson TEXT,
  cachedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metadata_cache_filePath ON document_metadata_cache(filePath);
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
  blockId TEXT PRIMARY KEY,
  foldState TEXT NOT NULL DEFAULT 'expanded',
  settingsOpen INTEGER NOT NULL DEFAULT 0,
  activeTab TEXT NOT NULL DEFAULT '',
  nodeAttrs TEXT NOT NULL DEFAULT '{}',
  savedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_block_states_savedAt ON block_states(savedAt DESC);
`;

// v3: Dataplane persistence for linking system
const CREATE_DATAPLANE_PORTS = `
CREATE TABLE IF NOT EXISTS dataplane_ports (
  id TEXT PRIMARY KEY,
  blockId TEXT NOT NULL,
  direction TEXT NOT NULL,
  dataType TEXT NOT NULL,
  position TEXT NOT NULL,
  label TEXT,
  parentBlockId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dataplane_ports_blockId ON dataplane_ports(blockId);
`;

const CREATE_DATAPLANE_LINKS = `
CREATE TABLE IF NOT EXISTS dataplane_links (
  id TEXT PRIMARY KEY,
  sourcePort TEXT NOT NULL,
  targetPort TEXT NOT NULL,
  direction TEXT NOT NULL,
  relationship TEXT NOT NULL,
  transform TEXT,
  metadataJson TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (sourcePort) REFERENCES dataplane_ports(id) ON DELETE CASCADE,
  FOREIGN KEY (targetPort) REFERENCES dataplane_ports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dataplane_links_sourcePort ON dataplane_links(sourcePort);
CREATE INDEX IF NOT EXISTS idx_dataplane_links_targetPort ON dataplane_links(targetPort);
`;

const CREATE_DATAPLANE_PLANES = `
CREATE TABLE IF NOT EXISTS dataplane_planes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parentPlaneId TEXT,
  portIdsJson TEXT NOT NULL DEFAULT '[]',
  metadataJson TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (parentPlaneId) REFERENCES dataplane_planes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dataplane_planes_parentPlaneId ON dataplane_planes(parentPlaneId);
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

  if (currentVersion < 3) {
    yield* Effect.logInfo('Applying migration v3: Dataplane persistence');

    yield* sql.unsafe(CREATE_DATAPLANE_PORTS);
    yield* sql.unsafe(CREATE_DATAPLANE_LINKS);
    yield* sql.unsafe(CREATE_DATAPLANE_PLANES);

    yield* sql`
      INSERT INTO schema_version (version, applied_at) VALUES (3, ${new Date().toISOString()})
    `;

    yield* Effect.logInfo('Migration v3 applied successfully');
  }

  yield* Effect.logInfo(`Schema is now at version ${SCHEMA_VERSION}`);
});

/**
 * Drop all tables (for testing).
 */
export const dropAllTables = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql.unsafe('DROP TABLE IF EXISTS dataplane_links');
  yield* sql.unsafe('DROP TABLE IF EXISTS dataplane_planes');
  yield* sql.unsafe('DROP TABLE IF EXISTS dataplane_ports');
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
