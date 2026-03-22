#!/usr/bin/env bun
/**
 * Genifer Migration Script
 *
 * Runs genifer DDL migrations against the local tmnl_postgres container.
 * Creates schema `genifer` with tables: trees, elements, composites, signals.
 *
 * Usage:
 *   bun run scripts/genifer-migrate.ts
 *
 * @module
 */

import { Effect, Layer, Console } from 'effect'
import { SqlClient } from '@effect/sql'
import { PgClient } from '@effect/sql-pg'
import { GeniferMigratorLive, DevDatabaseConfig } from '../src/lib/genifer/migrations/runner'

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Console.log('╔══════════════════════════════════════════╗')
  yield* Console.log('║     Genifer Migration Runner             ║')
  yield* Console.log('╚══════════════════════════════════════════╝')
  yield* Console.log('')

  // By the time we get here, PgMigrator.layer has already executed migrations
  yield* Console.log('✓ Migrations applied successfully')
  yield* Console.log('')

  // Verify tables exist
  const tables = yield* sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'genifer'
    ORDER BY table_name
  `
  yield* Console.log(`Tables in genifer schema (${tables.length}):`)
  for (const row of tables) {
    yield* Console.log(`  • genifer.${(row as any).table_name}`)
  }

  // Verify migration tracking
  const migrations = yield* sql`
    SELECT migration_id, name, created_at
    FROM genifer_migrations
    ORDER BY migration_id
  `
  yield* Console.log('')
  yield* Console.log(`Migrations tracked (${migrations.length}):`)
  for (const m of migrations) {
    const r = m as any
    yield* Console.log(`  ${String(r.migration_id).padStart(4)} │ ${r.name}`)
  }

  yield* Console.log('')
  yield* Console.log('Done.')
})

// Compose layers: PgClient + GeniferMigrator (side-effect layer runs migrations)
const PgClientLive = PgClient.layer(DevDatabaseConfig)
const MigratorLive = GeniferMigratorLive.pipe(Layer.provide(PgClientLive))
const AppLive = Layer.merge(PgClientLive, MigratorLive)

Effect.runPromise(
  program.pipe(Effect.provide(AppLive))
).then(
  () => process.exit(0),
  (err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  }
)
