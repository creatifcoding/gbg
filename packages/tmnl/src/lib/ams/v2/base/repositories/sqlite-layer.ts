/**
 * SQLite Test Layer
 *
 * Provides in-memory SQLite client and table migrations for testing.
 * Use SqliteTestLayer for integration tests.
 *
 * @module @gbg/tmnl/ams/v2/base/repositories/sqlite-layer
 */

import { Effect, Layer } from 'effect'
import { SqliteClient } from '@effect/sql-sqlite-bun'
import { SqlClient } from '@effect/sql'

// ─────────────────────────────────────────────────────────────────────────────
// Name Transformers (snake_case <-> camelCase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert snake_case to camelCase
 * Used for transformResultNames (DB → Model)
 */
const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_, char) => char.toUpperCase())

/**
 * Convert camelCase to snake_case
 * Used for transformQueryNames (Model → DB)
 */
const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)

// ─────────────────────────────────────────────────────────────────────────────
// Table Migrations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SQL migrations for AMS tables
 *
 * Creates all necessary tables for the Asset Management System.
 * Uses SQLite-compatible syntax.
 */
export const createTables = (sql: SqlClient.SqlClient) =>
  Effect.gen(function* () {
    // Sites table
    yield* sql`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        bfo_class TEXT NOT NULL,
        name TEXT NOT NULL,
        geo_frame_json TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Sectors table
    yield* sql`
      CREATE TABLE IF NOT EXISTS sectors (
        id TEXT PRIMARY KEY,
        bfo_class TEXT NOT NULL,
        site_id TEXT NOT NULL REFERENCES sites(id),
        sector_type_id TEXT NOT NULL,
        name TEXT NOT NULL,
        footprint_json TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Containers table
    yield* sql`
      CREATE TABLE IF NOT EXISTS containers (
        id TEXT PRIMARY KEY,
        bfo_class TEXT NOT NULL,
        site_id TEXT NOT NULL REFERENCES sites(id),
        sector_id TEXT REFERENCES sectors(id),
        container_type_id TEXT NOT NULL,
        label TEXT NOT NULL,
        parent_container_id TEXT REFERENCES containers(id),
        is_mobile INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Assets table
    yield* sql`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        bfo_class TEXT NOT NULL,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        site_id TEXT NOT NULL REFERENCES sites(id),
        sector_id TEXT REFERENCES sectors(id),
        container_id TEXT REFERENCES containers(id),
        base_properties_json TEXT,
        tags_json TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Asset properties table (EAV pattern)
    yield* sql`
      CREATE TABLE IF NOT EXISTS asset_properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        provenance_json TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(asset_id, key)
      )
    `

    // Asset traits table
    yield* sql`
      CREATE TABLE IF NOT EXISTS asset_traits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        trait_id TEXT NOT NULL,
        config_json TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(asset_id, trait_id)
      )
    `

    // Event journal table
    yield* sql`
      CREATE TABLE IF NOT EXISTS event_journal (
        sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
        event_tag TEXT NOT NULL,
        primary_key TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        triggered_by TEXT NOT NULL,
        occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        aggregate_version INTEGER NOT NULL
      )
    `

    // Create indexes for common queries
    yield* sql`CREATE INDEX IF NOT EXISTS idx_assets_site_id ON assets(site_id)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_assets_sector_id ON assets(sector_id)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_assets_container_id ON assets(container_id)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(kind)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_asset_properties_asset_id ON asset_properties(asset_id)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_asset_traits_asset_id ON asset_traits(asset_id)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_event_journal_primary_key ON event_journal(primary_key)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_event_journal_event_tag ON event_journal(event_tag)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_sectors_site_id ON sectors(site_id)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_containers_site_id ON containers(site_id)`

    yield* Effect.log('[AMS] Database tables created')
  })

// ─────────────────────────────────────────────────────────────────────────────
// SQLite Layers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory SQLite client layer
 *
 * Creates a fresh in-memory database. Fast for testing.
 * Database is destroyed when the layer scope ends.
 *
 * Includes name transformers for camelCase (TS) <-> snake_case (SQL) mapping.
 */
export const SqliteMemoryLayer = SqliteClient.layer({
  filename: ':memory:',
  transformResultNames: snakeToCamel,
  transformQueryNames: camelToSnake,
})

/**
 * SQLite test layer with migrations
 *
 * Combines SqliteMemoryLayer with table creation.
 * Use this for integration tests.
 *
 * @example
 * ```ts
 * import { SqliteTestLayer } from './sqlite-layer'
 *
 * it.effect('creates asset', () =>
 *   Effect.gen(function* () {
 *     const repo = yield* makeAssetRepository
 *     const asset = yield* repo.insert(AssetModel.insert.make({...}))
 *     expect(asset.id).toBeDefined()
 *   }).pipe(Effect.provide(SqliteTestLayer))
 * )
 * ```
 */
export const SqliteTestLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* createTables(sql)
  })
).pipe(Layer.provideMerge(SqliteMemoryLayer))

/**
 * File-based SQLite client layer
 *
 * Creates a persistent database file.
 * Useful for debugging or data inspection.
 *
 * Includes name transformers for camelCase (TS) <-> snake_case (SQL) mapping.
 */
export const SqliteFileLayer = (filename: string) =>
  SqliteClient.layer({
    filename,
    transformResultNames: snakeToCamel,
    transformQueryNames: camelToSnake,
  })

/**
 * File-based SQLite test layer with migrations
 */
export const SqliteFileTestLayer = (filename: string) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* createTables(sql)
    })
  ).pipe(Layer.provideMerge(SqliteFileLayer(filename)))
