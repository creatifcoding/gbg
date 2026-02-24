#!/usr/bin/env bun

import { Console, Effect, Layer, Redacted } from 'effect'
import { SqlClient } from '@effect/sql'
import { PgClient } from '@effect/sql-pg'
import { GeointMigratorLive } from '../src/lib/geoint/migrations/runner'

const config: PgClient.PgClientConfig = {
  host: process.env['POSTGRES_HOST'] ?? 'localhost',
  port: Number(process.env['POSTGRES_PORT'] ?? 5432),
  database: process.env['POSTGRES_DB'] ?? 'tmnl',
  username: process.env['POSTGRES_USER'] ?? 'tmnl',
  password: Redacted.make(process.env['POSTGRES_PASSWORD'] ?? 'tmnl_dev_password'),
  maxConnections: Number(process.env['POSTGRES_POOL_SIZE'] ?? 5),
}

const PgClientLive = PgClient.layer(config)
const MigratorLive = GeointMigratorLive.pipe(Layer.provide(PgClientLive))
const AppLayer = Layer.merge(PgClientLive, MigratorLive)

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Console.log('╔══════════════════════════════════════════╗')
  yield* Console.log('║   GEOINT Registry Migration Runner       ║')
  yield* Console.log('╚══════════════════════════════════════════╝')
  yield* Console.log('')

  const migrations = yield* sql`
    SELECT migration_id, name, created_at
    FROM geoint_migrations
    ORDER BY migration_id
  `

  yield* Console.log(`Migrations tracked (${migrations.length}):`)
  for (const migration of migrations) {
    const row = migration as { migration_id: number; name: string }
    yield* Console.log(`  ${String(row.migration_id).padStart(4)} │ ${row.name}`)
  }

  const taxonomyCount = yield* sql<{ count: string }>`
    SELECT COUNT(*)::text as count
    FROM geoint_registry.source_taxonomy
  `

  const sourceCount = yield* sql<{ count: string }>`
    SELECT COUNT(*)::text as count
    FROM geoint_registry.sources
  `

  const stacCount = yield* sql<{ count: string }>`
    SELECT COUNT(*)::text as count
    FROM geoint_registry.sources
    WHERE capabilities->>'provider' = 'stac'
  `

  yield* Console.log('')
  yield* Console.log(`Taxonomy rows: ${taxonomyCount[0]?.count ?? '0'}`)
  yield* Console.log(`Source rows:   ${sourceCount[0]?.count ?? '0'}`)
  yield* Console.log(`STAC rows:     ${stacCount[0]?.count ?? '0'}`)
})

Effect.runPromise(program.pipe(Effect.provide(AppLayer))).then(
  () => process.exit(0),
  (error) => {
    console.error('GEOINT migration failed:', error)
    process.exit(1)
  }
)
