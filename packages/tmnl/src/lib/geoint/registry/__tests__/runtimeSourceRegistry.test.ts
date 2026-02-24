import { Effect, Layer, Schema } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  RegistrySourceRepositoryTag,
  type RegistryAliasRow,
  type RegistrySourceRepository,
  type RegistrySourceRow,
  type RegistryTaxonomyRow,
} from '../../persistence/postgis/RegistrySourceRepository'
import { SourceRegistryEntry } from '../schemas'
import {
  hydrateSourceRegistryFromDb,
} from '../runtimeSourceRegistry'
import {
  listSourceRegistry,
  resetSourceRegistry,
  resolveCanonicalSource,
} from '../sourceRegistry'

const decodeSourceEntry = Schema.decodeUnknownSync(SourceRegistryEntry)

const emptyTaxonomy: ReadonlyArray<RegistryTaxonomyRow> = []
const emptySources: ReadonlyArray<RegistrySourceRow> = []
const emptyAliases: ReadonlyArray<RegistryAliasRow> = []

describe('runtimeSourceRegistry hydration', () => {
  beforeEach(() => {
    resetSourceRegistry()
  })

  it('hydrates runtime registry from database repository', async () => {
    const dbEntry = decodeSourceEntry({
      _tag: 'SourceRegistryEntry',
      version: 'geoint.registry.v1',
      sourceId: 'db-openmeteo',
      canonicalSource: 'openmeteo',
      displayName: 'DB OpenMeteo',
      endpoint: 'https://open-meteo.com/en/docs',
      enabled: true,
      role: 'trigger',
      priority: 99,
      weight: 1,
      aliases: [
        { adapter: 'geoint-search', externalId: 'db-open', canonical: 'openmeteo' },
      ],
      capabilities: {
        provider: 'native',
        supportsCollections: false,
        supportsIds: false,
        supportsBBox: true,
        supportsIntersects: false,
        supportsDatetime: true,
        supportsFilter: false,
        supportedFilterLangs: ['none'],
        supportsFilterCrs: false,
        pagingModes: ['offset'],
        supportsPostNextHints: false,
        defaultTtlSeconds: 60,
      },
      metadata: { domain: 'weather' },
    })

    const repository: RegistrySourceRepository = {
      listTaxonomy: () => Effect.succeed(emptyTaxonomy),
      listSources: () => Effect.succeed(emptySources),
      listAliases: () => Effect.succeed(emptyAliases),
      listSourceEntries: () => Effect.succeed([dbEntry]),
    }

    const result = await Effect.runPromise(
      hydrateSourceRegistryFromDb.pipe(
        Effect.provide(Layer.succeed(RegistrySourceRepositoryTag, repository))
      )
    )

    expect(result.source).toBe('database')
    expect(result.sourceCount).toBe(1)
    expect(listSourceRegistry()).toHaveLength(1)
    expect(resolveCanonicalSource('db-open')).toBe('openmeteo')
  })

  it('falls back to seeded registry on repository failure', async () => {
    const repository: RegistrySourceRepository = {
      listTaxonomy: () => Effect.succeed(emptyTaxonomy),
      listSources: () => Effect.succeed(emptySources),
      listAliases: () => Effect.succeed(emptyAliases),
      listSourceEntries: () => Effect.fail(new Error('db unavailable')),
    }

    const result = await Effect.runPromise(
      hydrateSourceRegistryFromDb.pipe(
        Effect.provide(Layer.succeed(RegistrySourceRepositoryTag, repository))
      )
    )

    expect(result.source).toBe('seed')
    expect(result.sourceCount).toBeGreaterThan(0)
    expect(result.fallbackReason).toContain('database registry load failed')
    expect(resolveCanonicalSource('opensky')).toBe('opensky')
  })
})
