/**
 * Prospect Pipeline — PostgreSQL Layers
 *
 * PgClient configuration + PgMigrator for the prospect pipeline.
 * Follows the IIoT run-migrations.ts pattern.
 *
 * @module prospects/models/pg-layer
 */

import { Effect, Layer, Redacted } from 'effect'
import { PgClient, PgMigrator } from '@effect/sql-pg'
import { prospectMigrationLoader } from './_migrations.pg'

// =============================================================================
// Configuration
// =============================================================================

export interface ProspectPgConfig {
  readonly host: string
  readonly port: number
  readonly database: string
  readonly username: string
  readonly password: string
}

const defaultConfig: ProspectPgConfig = {
  host: process.env['PROSPECT_DB_HOST'] ?? 'localhost',
  port: Number(process.env['PROSPECT_DB_PORT'] ?? 5434),
  database: process.env['PROSPECT_DB_NAME'] ?? 'prospects',
  username: process.env['PROSPECT_DB_USER'] ?? 'prospects',
  password: process.env['PROSPECT_DB_PASSWORD'] ?? 'prospects_dev',
}

// =============================================================================
// PgClient Layer
// =============================================================================

/**
 * PostgreSQL client layer for the prospect pipeline.
 *
 * Uses snake_case ↔ camelCase transforms (same as SQLite layer).
 * Default connection: localhost:5434/prospects
 */
export const ProspectPgClientLayer = (config: Partial<ProspectPgConfig> = {}) => {
  const c = { ...defaultConfig, ...config }
  return PgClient.layer({
    host: c.host,
    port: c.port,
    database: c.database,
    username: c.username,
    password: Redacted.make(c.password),
    maxConnections: 10,
    transformResultNames: (s) => s.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()),
    transformQueryNames: (s) => s.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`),
  })
}

// =============================================================================
// Migrator Layer
// =============================================================================

/**
 * Migration layer using Migrator.fromRecord.
 * Runs all prospect pipeline migrations on Layer build.
 */
export const ProspectMigratorLayer = (config: Partial<ProspectPgConfig> = {}) =>
  PgMigrator.layer({
    loader: prospectMigrationLoader,
  }).pipe(Layer.provide(ProspectPgClientLayer(config)))

// =============================================================================
// Combined Database Layer
// =============================================================================

/**
 * Complete prospect database layer: PgClient + Migrator.
 *
 * Provide this to your Effect program and both the SQL client
 * and migrations are handled.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function* () {
 *   const sql = yield* SqlClient.SqlClient
 *   const companies = yield* sql`SELECT * FROM prospects.companies`
 * }).pipe(Effect.provide(ProspectPgLayer()))
 * ```
 */
export const ProspectPgLayer = (config: Partial<ProspectPgConfig> = {}) =>
  Layer.merge(
    ProspectPgClientLayer(config),
    ProspectMigratorLayer(config)
  )
