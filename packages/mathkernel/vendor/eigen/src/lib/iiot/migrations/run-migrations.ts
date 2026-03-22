#!/usr/bin/env bun
/**
 * IIoT Migration CLI Runner
 *
 * Runs migrations against the database specified by environment variables.
 *
 * Usage:
 *   bun src/lib/iiot/migrations/run-migrations.ts
 *
 * Environment:
 *   IIOT_DB_HOST     - Database host (default: localhost)
 *   IIOT_DB_PORT     - Database port (default: 5432)
 *   IIOT_DB_NAME     - Database name (default: iiot)
 *   IIOT_DB_USER     - Database user (default: iiot)
 *   IIOT_DB_PASSWORD - Database password (default: iiot)
 *
 * @module
 */

import { Effect, Layer, Console, Redacted } from 'effect'
import { PgClient, PgMigrator } from '@effect/sql-pg'
import { SqlClient } from '@effect/sql'
import { iiotMigrationLoader } from '../models/_migrations'

// =============================================================================
// Configuration
// =============================================================================

const config: PgClient.PgClientConfig = {
  host: process.env['IIOT_DB_HOST'] ?? 'localhost',
  port: Number(process.env['IIOT_DB_PORT'] ?? 5432),
  database: process.env['IIOT_DB_NAME'] ?? 'iiot',
  username: process.env['IIOT_DB_USER'] ?? 'iiot',
  password: Redacted.make(process.env['IIOT_DB_PASSWORD'] ?? 'iiot'),
  maxConnections: 5,
}

// =============================================================================
// Layers
// =============================================================================

const PgClientLive = PgClient.layer(config)

const MigratorLive = PgMigrator.layer({
  loader: iiotMigrationLoader,
}).pipe(Layer.provide(PgClientLive))

const AppLayer = Layer.merge(PgClientLive, MigratorLive)

// =============================================================================
// Main Program
// =============================================================================

const program = Effect.gen(function* () {
  yield* Console.log('🔧 Running IIoT migrations...')
  yield* Console.log(`   Host: ${config.host}:${config.port}`)
  yield* Console.log(`   Database: ${config.database}`)
  yield* Console.log('')

  // Migrations run automatically when MigratorLive builds
  // Query to verify migrations ran
  const sql = yield* SqlClient.SqlClient

  // Check migration status
  const migrations = yield* sql`
    SELECT migration_id, name, created_at
    FROM effect_sql_migrations
    ORDER BY migration_id
  `.pipe(
    Effect.catchAll(() =>
      Effect.succeed([{ migration_id: 0, name: 'No migrations table', created_at: null }])
    )
  )

  yield* Console.log('✅ Migrations applied:')
  for (const m of migrations) {
    yield* Console.log(`   ${m['migration_id']}: ${m.name}`)
  }
  yield* Console.log('')
  yield* Console.log(`📊 Total: ${migrations.length} migrations`)

  // Verify key tables exist
  const tables = yield* sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'iiot'
    ORDER BY table_name
  `

  yield* Console.log('')
  yield* Console.log('📋 IIoT tables created:')
  for (const t of tables) {
    yield* Console.log(`   - ${t['table_name']}`)
  }
})

// =============================================================================
// Run
// =============================================================================

Effect.runPromise(
  program.pipe(
    Effect.provide(AppLayer),
Effect.catchAll((error) =>
      Console.error(`❌ Migration failed: ${error}`)
    )
  )
).then(() => {
  console.log('\n✨ Done!')
  process.exit(0)
}).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
