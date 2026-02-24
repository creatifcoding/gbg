#!/usr/bin/env bun

import { Console, Effect, Layer, Redacted } from 'effect'
import { SqlClient } from '@effect/sql'
import { PgClient } from '@effect/sql-pg'
import { listSeededSourceRegistry } from '../src/lib/geoint/registry/sourceRegistry'
import { listSeededSourceTaxonomy } from '../src/lib/geoint/migrations/_registry.ddl'

type DbTaxonomyRow = {
  canonical_source: string
  domain: string
  modality: string
  description: string
  active: boolean
}

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

  const seedTaxonomy = listSeededSourceTaxonomy().map((seed) => ({
    canonical_source: seed.canonicalSource,
    domain: seed.domain,
    modality: seed.modality,
    description: seed.description,
    active: true,
  }))

  const seed = listSeededSourceRegistry()
  const seedSourceMap = new Map(seed.map((entry) => [String(entry.sourceId), entry]))

  const dbTaxonomy = yield* sql<DbTaxonomyRow>`
    SELECT canonical_source, domain, modality, description, active
    FROM geoint_registry.source_taxonomy
    ORDER BY canonical_source
  `

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

  const seedTaxonomyMap = new Map(seedTaxonomy.map((row) => [row.canonical_source, row]))
  const dbTaxonomyMap = new Map(dbTaxonomy.map((row) => [row.canonical_source, row]))

  const seedTaxonomyIds = new Set([...seedTaxonomyMap.keys()])
  const dbTaxonomyIds = new Set([...dbTaxonomyMap.keys()])

  const missingTaxonomyInDb = [...seedTaxonomyIds].filter((id) => !dbTaxonomyIds.has(id)).sort()
  const extraTaxonomyInDb = [...dbTaxonomyIds].filter((id) => !seedTaxonomyIds.has(id)).sort()

  const taxonomyMismatches = [...seedTaxonomyIds]
    .filter((id) => dbTaxonomyIds.has(id))
    .flatMap((id) => {
      const seedRow = seedTaxonomyMap.get(id)
      const dbRow = dbTaxonomyMap.get(id)
      if (!seedRow || !dbRow) return []

      const drift: string[] = []
      if (seedRow.domain !== dbRow.domain) drift.push(`domain(seed=${seedRow.domain},db=${dbRow.domain})`)
      if (seedRow.modality !== dbRow.modality) drift.push(`modality(seed=${seedRow.modality},db=${dbRow.modality})`)
      if (seedRow.description !== dbRow.description) drift.push('description mismatch')
      if (seedRow.active !== dbRow.active) drift.push(`active(seed=${seedRow.active},db=${dbRow.active})`)

      return drift.length > 0
        ? [{ canonicalSource: id, differences: drift }]
        : []
    })

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

  const seedStac = seed
    .filter((entry) => entry.capabilities.provider === 'stac')
    .map((entry) => String(entry.sourceId))
    .sort()

  const dbStac = dbSources
    .filter((row) => (row.capabilities as { provider?: string })?.provider === 'stac')
    .map((row) => row.source_id)
    .sort()

  const summary = {
    strict,
    seedTaxonomyCount: seedTaxonomy.length,
    dbTaxonomyCount: dbTaxonomy.length,
    seedSourceCount: seed.length,
    dbSourceCount: dbSources.length,
    seedAliasCount: seedAliasSet.size,
    dbAliasCount: dbAliasSet.size,
    missingTaxonomyInDb,
    extraTaxonomyInDb,
    taxonomyMismatches,
    missingInDb,
    extraInDb,
    canonicalMismatches,
    missingAliasesInDb,
    extraAliasesInDb,
    seedStac,
    dbStac,
  }

  const hasDrift =
    missingTaxonomyInDb.length > 0 ||
    extraTaxonomyInDb.length > 0 ||
    taxonomyMismatches.length > 0 ||
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
