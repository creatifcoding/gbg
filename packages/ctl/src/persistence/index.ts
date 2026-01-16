/**
 * @gbg/ctl/persistence - SQLite storage patterns
 *
 * Provides SQLite layer, repository patterns, and migration utilities.
 *
 * @skill cli/persistence
 */

import { SqlClient } from "@effect/sql"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { Context, Effect, Layer } from "effect"
import { StorageError } from "../messaging/index.js"

// =============================================================================
// SQLITE LAYER FACTORY
// =============================================================================

export interface SqliteConfig {
  readonly filename: string
}

/**
 * Create a SQLite layer with the given configuration
 */
export const createSqliteLayer = (config: SqliteConfig) =>
  SqliteClient.layer({
    filename: config.filename,
  })

// =============================================================================
// SCHEMA UTILITIES
// =============================================================================

export interface TableDef {
  readonly name: string
  readonly columns: string
  readonly indexes?: readonly string[]
}

/**
 * Create table if not exists with indexes
 */
export const ensureTable = (table: TableDef) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      CREATE TABLE IF NOT EXISTS ${sql.literal(table.name)} (
        ${sql.literal(table.columns)}
      )
    `.pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new StorageError({
            operation: `CREATE TABLE ${table.name}`,
            path: "database",
            cause: e instanceof Error ? e.message : String(e),
          })
        )
      )
    )

    if (table.indexes) {
      for (const indexDef of table.indexes) {
        yield* sql.unsafe(indexDef).pipe(
          Effect.catchAll(() => Effect.void) // Ignore index exists errors
        )
      }
    }
  })

/**
 * Initialize multiple tables
 */
export const initializeSchema = (tables: readonly TableDef[]) =>
  Effect.gen(function* () {
    for (const table of tables) {
      yield* ensureTable(table)
    }
  })

// =============================================================================
// MIGRATION SYSTEM
// =============================================================================

export interface Migration {
  readonly version: number
  readonly description: string
  readonly up: (sql: SqlClient.SqlClient) => Effect.Effect<void>
}

/**
 * Run pending migrations
 */
export const runMigrations = (migrations: readonly Migration[]) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // Create migrations table
    yield* sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        description TEXT,
        applied_at TEXT DEFAULT (datetime('now'))
      )
    `

    // Get current version
    const rows = yield* sql<{ version: number }>`
      SELECT COALESCE(MAX(version), 0) as version FROM _migrations
    `
    const currentVersion = rows[0]?.version ?? 0

    // Apply pending migrations
    const pending = migrations.filter((m) => m.version > currentVersion)
    for (const migration of pending) {
      yield* Effect.log(`Applying migration v${migration.version}: ${migration.description}`)
      yield* migration.up(sql)
      yield* sql`
        INSERT INTO _migrations (version, description)
        VALUES (${migration.version}, ${migration.description})
      `
    }

    if (pending.length > 0) {
      yield* Effect.log(`Applied ${pending.length} migration(s)`)
    }
  })

// =============================================================================
// REPOSITORY PATTERN
// =============================================================================

export interface RepositoryConfig<T, CreateInput, UpdateInput> {
  readonly tableName: string
  readonly idColumn: string
  readonly parseRow: (row: unknown) => T
  readonly toInsertValues: (input: CreateInput) => Record<string, unknown>
  readonly toUpdateValues: (input: UpdateInput) => Record<string, unknown>
}

/**
 * Base repository operations
 */
export interface Repository<T, CreateInput, UpdateInput, Id = string> {
  readonly create: (input: CreateInput) => Effect.Effect<Id, StorageError>
  readonly get: (id: Id) => Effect.Effect<T | null, StorageError>
  readonly list: (opts?: { limit?: number; offset?: number }) => Effect.Effect<readonly T[], StorageError>
  readonly update: (id: Id, input: UpdateInput) => Effect.Effect<T | null, StorageError>
  readonly delete: (id: Id) => Effect.Effect<boolean, StorageError>
  readonly count: () => Effect.Effect<number, StorageError>
}

/**
 * Create a repository implementation
 * Note: This is a factory that returns the repository shape.
 * Actual implementation depends on the table schema.
 */
export const createRepository = <T, CreateInput, UpdateInput>(
  config: RepositoryConfig<T, CreateInput, UpdateInput>
): {
  readonly tableName: string
  readonly config: RepositoryConfig<T, CreateInput, UpdateInput>
} => ({
  tableName: config.tableName,
  config,
})

// =============================================================================
// TRANSACTION UTILITIES
// =============================================================================

/**
 * Wrap operations in a transaction
 */
export const withTransaction = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return yield* sql.withTransaction(effect)
  })

// =============================================================================
// PATH UTILITIES
// =============================================================================

/**
 * XDG-compliant paths
 */
export const XDG = {
  config: process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`,
  data: process.env.XDG_DATA_HOME ?? `${process.env.HOME}/.local/share`,
  cache: process.env.XDG_CACHE_HOME ?? `${process.env.HOME}/.cache`,
} as const

/**
 * Get standard paths for an application
 */
export const getAppPaths = (appName: string) => ({
  config: `${XDG.config}/${appName}/config.json`,
  db: `${XDG.data}/${appName}/data.db`,
  cache: `${XDG.cache}/${appName}/`,
  logs: `${XDG.data}/${appName}/logs/`,
})

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { SqlClient } from "@effect/sql"
export { SqliteClient } from "@effect/sql-sqlite-bun"
