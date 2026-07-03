#!/usr/bin/env bun
/**
 * Prospect Pipeline — Migration CLI Runner
 *
 * Creates/migrates the SQLite database for the prospect pipeline.
 *
 * Usage:
 *   bun src/lib/prospects/migrations/run-migrations.ts
 *   bun src/lib/prospects/migrations/run-migrations.ts --reset
 *
 * Database location: src/lib/prospects/data/prospects.db
 *
 * @module
 */

import { Effect, Console } from 'effect'
import { SqlClient } from '@effect/sql'
import { ProspectDbLayer } from '../models/sqlite-layer'
import { resetDatabase } from '../models/_migrations'

// =============================================================================
// CLI Flags
// =============================================================================

const shouldReset = process.argv.includes('--reset')

// =============================================================================
// Main Program
// =============================================================================

const program = Effect.gen(function* () {
  yield* Console.log('🔧 Prospect Pipeline — Database Migration')
  yield* Console.log('')

  if (shouldReset) {
    yield* Console.log('⚠️  --reset flag detected. Dropping and recreating all tables.')
    yield* resetDatabase
  }

  // Verify tables exist
  const sql = yield* SqlClient.SqlClient

  const tables = yield* sql<{ name: string }>`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
  `

  yield* Console.log('')
  yield* Console.log('📋 Prospect pipeline tables:')
  for (const t of tables) {
    // Count rows in each table
    const countResult = yield* sql.unsafe(`SELECT COUNT(*) as count FROM "${t.name}"`)
    const count = (countResult[0] as { count: number })?.count ?? 0
    yield* Console.log(`   ✓ ${t.name} (${count} rows)`)
  }

  // Get schema version
  const version = yield* sql<{ version: number }>`
    SELECT MAX(version) as version FROM schema_version
  `
  yield* Console.log('')
  yield* Console.log(`📊 Schema version: ${version[0]?.version ?? 0}`)
})

// =============================================================================
// Run
// =============================================================================

Effect.runPromise(
  program.pipe(
    Effect.provide(ProspectDbLayer()),
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
