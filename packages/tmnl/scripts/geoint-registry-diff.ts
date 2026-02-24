#!/usr/bin/env bun

import { Console, Effect, Layer, Redacted } from 'effect'
import { SqlClient } from '@effect/sql'
import { PgClient } from '@effect/sql-pg'
import { listSeededSourceRegistry } from '../src/lib/geoint/registry/sourceRegistry'

type DbSourceRow = {
  source_id: string
  canonical_source: string
  capabilities: unknown
}

type DbAliasRow = {
  source_id: string
  adapter: string
  external_id: string
  canonical_source: string
}

const strict = process.argv.includes('--strict')

const config: PgClient.PgClientConfig = {
  host: process.env['POSTGRES_HOST'] ?? 'localhost',
  port: Number(process.env['POSTGRES_PORT'] ?? 5432),
  database: process.env['POSTGRES_DB'] ?? 'tmnl',
  username: process.env['POSTGRES_USER'] ?? 'tmnl',
  password: Redacted.make(process.env['POSTGRES_PASSWORD'] ?? 'tmnl_dev_password'),
  maxConnections: Number(process.env['POSTGRES_POOL_SIZE'] ?? 5),
}

const PgClientLive = PgClient.layer(config)

const normalizeAlias = (sourceId: string, adapter: string, externalId: string, canonical: string) =>
  `${sourceId}|${adapter}|${externalId.toLowerCase()}|${canonical}`

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const seed = listSeededSourceRegistry()
  const seedSourceMap = new Map(seed.map((entry) => [String(entry.sourceId), entry]))

  const dbSources = yield* sql<DbSourceRow>`
    SELECT source_id, canonical_source, capabilities
    FROM geoint_registry.sources
    ORDER BY source_id
  `

  const dbAliases = yield* sql<DbAliasRow>`
    SELECT source_id, adapter, external_id, canonical_source
    FROM geoint_registry.source_aliases
    ORDER BY source_id, adapter, external_id
  `

  const dbSourceMap = new Map(dbSources.map((row) => [row.source_id, row]))

  const seedIds = new Set([...seedSourceMap.keys()])
  const dbIds = new Set([...dbSourceMap.keys()])

  const missingInDb = [...seedIds].filter((id) => !dbIds.has(id)).sort()
  const extraInDb = [...dbIds].filter((id) => !seedIds.has(id)).sort()

  const canonicalMismatches = [...seedIds]
    .filter((id) => dbIds.has(id))
    .flatMap((id) => {
      const seedEntry = seedSourceMap.get(id)
      const dbEntry = dbSourceMap.get(id)
      if (!seedEntry || !dbEntry) return []
      return seedEntry.canonicalSource === dbEntry.canonical_source
        ? []
        : [{ sourceId: id, seed: seedEntry.canonicalSource, db: dbEntry.canonical_source }]
    })

  const seedAliasSet = new Set(
    seed.flatMap((entry) =>
      entry.aliases.map((alias) =>
        normalizeAlias(String(entry.sourceId), alias.adapter, alias.externalId, alias.canonical)
      )
    )
  )

  const dbAliasSet = new Set(
    dbAliases.map((alias) =>
      normalizeAlias(alias.source_id, alias.adapter, alias.external_id, alias.canonical_source)
    )
  )

  const missingAliasesInDb = [...seedAliasSet].filter((item) => !dbAliasSet.has(item)).sort()
  const extraAliasesInDb = [...dbAliasSet].filter((item) => !seedAliasSet.has(item)).sort()

  const seedStac = seed.filter((entry) => entry.capabilities.provider === 'stac').map((entry) => String(entry.sourceId)).sort()
  const dbStac = dbSources
    .filter((row) => (row.capabilities as any)?.provider === 'stac')
    .map((row) => row.source_id)
    .sort()

  const summary = {
    strict,
    seedSourceCount: seed.length,
    dbSourceCount: dbSources.length,
    seedAliasCount: seedAliasSet.size,
    dbAliasCount: dbAliasSet.size,
    missingInDb,
    extraInDb,
    canonicalMismatches,
    missingAliasesInDb,
    extraAliasesInDb,
    seedStac,
    dbStac,
  }

  const hasDrift =
    missingInDb.length > 0 ||
    extraInDb.length > 0 ||
    canonicalMismatches.length > 0 ||
    missingAliasesInDb.length > 0 ||
    extraAliasesInDb.length > 0

  yield* Console.log('[geoint:registry:diff] summary')
  yield* Console.log(JSON.stringify(summary, null, 2))

  if (strict && hasDrift) {
    return yield* Effect.fail(new Error('Registry drift detected in strict mode'))
  }

  return summary
})

Effect.runPromise(program.pipe(Effect.provide(Layer.mergeAll(PgClientLive)))).then(
  () => process.exit(0),
  (error) => {
    console.error('[geoint:registry:diff] failed', error)
    process.exit(1)
  }
)
