/**
 * Prospect Pipeline — SQLite Layers
 *
 * Provides SQLite client layers (in-memory and file-based) with
 * automatic table creation for the prospect pipeline.
 *
 * Follows the AMS v2 sqlite-layer pattern.
 *
 * @module prospects/models/sqlite-layer
 */

import { Effect, Layer } from 'effect'
import { SqliteClient } from '@effect/sql-sqlite-bun'
import { SqlClient } from '@effect/sql'
import { runMigrations } from './_migrations'
import * as path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// Name Transformers (snake_case <-> camelCase)
// ─────────────────────────────────────────────────────────────────────────────

const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())

const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)

// ─────────────────────────────────────────────────────────────────────────────
// Default Database Path
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default path for the prospect pipeline database.
 * Located in the TMNL package data directory.
 */
const PROSPECT_DB_PATH = path.join(
  import.meta.dir,
  '..', // prospects/
  'data',
  'prospects.db'
)

// ─────────────────────────────────────────────────────────────────────────────
// SQLite Layers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory SQLite client layer.
 * Fast for testing. Database destroyed when scope ends.
 */
export const SqliteMemoryLayer = SqliteClient.layer({
  filename: ':memory:',
  transformResultNames: snakeToCamel,
  transformQueryNames: camelToSnake,
})

/**
 * File-based SQLite client layer.
 * Persistent database at the given path.
 */
export const SqliteFileLayer = (filename: string = PROSPECT_DB_PATH) =>
  SqliteClient.layer({
    filename,
    transformResultNames: snakeToCamel,
    transformQueryNames: camelToSnake,
  })

/**
 * In-memory SQLite layer with migrations applied.
 * Use this for integration tests.
 */
export const SqliteTestLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* runMigrations
  })
).pipe(Layer.provideMerge(SqliteMemoryLayer))

/**
 * File-based SQLite layer with migrations applied.
 * Use this for the actual prospect pipeline.
 *
 * @example
 * ```ts
 * import { ProspectDbLayer } from './sqlite-layer'
 *
 * const program = Effect.gen(function* () {
 *   const sql = yield* SqlClient.SqlClient
 *   const companies = yield* sql`SELECT * FROM companies`
 *   // ...
 * }).pipe(Effect.provide(ProspectDbLayer()))
 * ```
 */
export const ProspectDbLayer = (filename?: string) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      yield* runMigrations
    })
  ).pipe(Layer.provideMerge(SqliteFileLayer(filename)))
