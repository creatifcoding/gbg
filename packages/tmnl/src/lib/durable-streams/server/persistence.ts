/**
 * Durable Streams Server Persistence Layer
 *
 * SQLite persistence with migrations.
 * Follows the pattern from src/lib/editor/v3/persistence/layer.ts
 *
 * @module @gbg/tmnl/durable-streams/server/persistence
 */

import { Effect, Layer, pipe } from 'effect'
import * as SqlClient from '@effect/sql/SqlClient'
import { SqliteClient } from '@effect/sql-sqlite-bun'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** XDG-compliant data directory */
const XDG_DATA_HOME = process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share')

/** Database directory */
const DB_DIR = join(XDG_DATA_HOME, 'tmnl')

/** Default database path */
const DEFAULT_DB_PATH = join(DB_DIR, 'durable-streams.db')

/** Environment variable override */
const getDbPath = () => process.env.DURABLE_STREAM_DB ?? DEFAULT_DB_PATH

// ─────────────────────────────────────────────────────────────────────────────
// Name Transformers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert snake_case to camelCase for result column names
 */
const snakeToCamel = (s: string): string =>
  s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

/**
 * Convert camelCase to snake_case for query column names
 */
const camelToSnake = (s: string): string =>
  s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

// ─────────────────────────────────────────────────────────────────────────────
// Schema Version
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1

// ─────────────────────────────────────────────────────────────────────────────
// Migrations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create all tables for v1
 */
const createTablesV1 = (sql: SqlClient.SqlClient) =>
  Effect.gen(function* () {
    // Schema version table
    yield* sql`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      )
    `

    // Streams table
    yield* sql`
      CREATE TABLE IF NOT EXISTS streams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id TEXT NOT NULL UNIQUE,
        content_type TEXT NOT NULL DEFAULT 'application/json',
        current_sequence INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `

    // Stream entries table
    yield* sql`
      CREATE TABLE IF NOT EXISTS stream_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        data TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (stream_id) REFERENCES streams(stream_id) ON DELETE CASCADE,
        UNIQUE (stream_id, sequence)
      )
    `

    // Indexes for performance
    yield* sql`CREATE INDEX IF NOT EXISTS idx_streams_stream_id ON streams(stream_id)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_entries_stream_id ON stream_entries(stream_id)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_entries_sequence ON stream_entries(stream_id, sequence)`

    // Record schema version
    yield* sql`INSERT OR REPLACE INTO schema_version (version) VALUES (${SCHEMA_VERSION})`

    yield* Effect.log(`[durable-streams] Created schema v${SCHEMA_VERSION}`)
  })

/**
 * Run migrations based on current schema version
 */
const runMigrations = (sql: SqlClient.SqlClient) =>
  Effect.gen(function* () {
    // Check current version
    const versionResult = yield* sql`
      SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'
    `.pipe(Effect.catchAll(() => Effect.succeed([])))

    let currentVersion = 0
    if (versionResult.length > 0) {
      const rows = yield* sql<{ version: number }>`SELECT version FROM schema_version LIMIT 1`
      currentVersion = rows[0]?.version ?? 0
    }

    yield* Effect.log(`[durable-streams] Current schema version: ${currentVersion}`)

    // Run migrations
    if (currentVersion < 1) {
      yield* createTablesV1(sql)
    }

    // Future migrations go here:
    // if (currentVersion < 2) { yield* migrateToV2(sql) }
  })

// ─────────────────────────────────────────────────────────────────────────────
// SQLite Layers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory SQLite for testing
 */
export const SqliteMemoryLayer = SqliteClient.layer({
  filename: ':memory:',
  transformResultNames: snakeToCamel,
  transformQueryNames: camelToSnake,
})

/**
 * File-backed SQLite for production
 */
export const SqliteFileLayer = (filename: string) =>
  SqliteClient.layer({
    filename,
    transformResultNames: snakeToCamel,
    transformQueryNames: camelToSnake,
  })

/**
 * Test layer with in-memory SQLite + migrations
 */
export const DurableStreamTestLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`PRAGMA journal_mode = WAL`
    yield* sql`PRAGMA foreign_keys = ON`
    yield* runMigrations(sql)
  })
).pipe(Layer.provideMerge(SqliteMemoryLayer))

/**
 * Production layer with file-backed SQLite + migrations
 *
 * - Uses XDG data directory
 * - Enables WAL mode for concurrency
 * - Runs migrations on startup
 */
export const DurableStreamPersistenceLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const dbPath = getDbPath()
    const dbDir = join(dbPath, '..')

    // Ensure directory exists
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
      yield* Effect.log(`[durable-streams] Created directory: ${dbDir}`)
    }

    yield* Effect.log(`[durable-streams] Database path: ${dbPath}`)

    const sql = yield* SqlClient.SqlClient

    // Enable WAL mode for concurrent reads
    yield* sql`PRAGMA journal_mode = WAL`
    yield* sql`PRAGMA foreign_keys = ON`

    // Run migrations
    yield* runMigrations(sql)
  })
).pipe(
  Layer.provideMerge(
    Layer.suspend(() => SqliteFileLayer(getDbPath()))
  )
)

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get database path
// ─────────────────────────────────────────────────────────────────────────────

export { getDbPath, DB_DIR, DEFAULT_DB_PATH }
