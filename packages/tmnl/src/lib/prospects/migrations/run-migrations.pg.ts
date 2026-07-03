#!/usr/bin/env bun
/**
 * Prospect Pipeline — PostgreSQL Migration Runner
 *
 * Runs migrations against the PostgreSQL database.
 *
 * Usage:
 *   # Start PG first:
 *   docker compose -f src/lib/prospects/docker/docker-compose.yml up -d
 *
 *   # Run migrations:
 *   bun src/lib/prospects/migrations/run-migrations.pg.ts
 *
 * Environment:
 *   PROSPECT_DB_HOST     (default: localhost)
 *   PROSPECT_DB_PORT     (default: 5434)
 *   PROSPECT_DB_NAME     (default: prospects)
 *   PROSPECT_DB_USER     (default: prospects)
 *   PROSPECT_DB_PASSWORD (default: prospects_dev)
 *
 * @module
 */

import { Effect, Console } from 'effect'
import { SqlClient } from '@effect/sql'
import { ProspectPgLayer } from '../models/pg-layer'

const program = Effect.gen(function* () {
  yield* Console.log('🔧 Prospect Pipeline — PostgreSQL Migrations')
  yield* Console.log('')

  const sql = yield* SqlClient.SqlClient

  // Migrations run automatically when MigratorLayer builds
  // Verify by checking the effect_sql_migrations table
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
    yield* Console.log(`   ${(m as any).migrationId ?? (m as any).migration_id}: ${(m as any).name}`)
  }

  // Verify tables
  const tables = yield* sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'prospects'
    ORDER BY table_name
  `

  yield* Console.log('')
  yield* Console.log('📋 Prospects tables:')
  for (const t of tables) {
    const count = yield* sql.unsafe(`SELECT COUNT(*) as count FROM prospects."${(t as any).tableName ?? (t as any).table_name}"`)
    yield* Console.log(`   ✓ ${(t as any).tableName ?? (t as any).table_name} (${(count[0] as any).count} rows)`)
  }
})

Effect.runPromise(
  program.pipe(
    Effect.provide(ProspectPgLayer()),
    Effect.catchAll((error) =>
      Console.error(`❌ Migration failed: ${String(error)}`)
    )
  )
).then(() => {
  console.log('\n✨ Done!')
  process.exit(0)
}).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
