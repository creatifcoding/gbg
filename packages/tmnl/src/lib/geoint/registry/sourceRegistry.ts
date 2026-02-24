import { Schema } from 'effect'
import {
  type CanonicalIntelSource,
  SourceRegistryEntry as SourceRegistryEntrySchema,
  type SourceRegistryEntry,
} from './schemas'

const decodeSourceRegistryEntry = Schema.decodeUnknownSync(SourceRegistryEntrySchema)

const SEEDED_SOURCE_REGISTRY: ReadonlyArray<SourceRegistryEntry> = [
  decodeSourceRegistryEntry({
    _tag: 'SourceRegistryEntry',
    version: 'geoint.registry.v1',
    sourceId: 'opensky',
    canonicalSource: 'opensky',
    displayName: 'OpenSky Network',
    endpoint: 'https://openskynetwork.github.io/opensky-api/rest.html',
    enabled: true,
    role: 'trigger',
    priority: 95,
    weight: 1,
    aliases: [
      { adapter: 'geoint-search', externalId: 'opensky', canonical: 'opensky' },
    ],
    capabilities: {
      provider: 'native',
      supportsCollections: false,
      supportsIds: true,
      supportsBBox: true,
      supportsIntersects: false,
      supportsDatetime: false,
      supportsFilter: false,
      supportedFilterLangs: ['none'],
      supportsFilterCrs: false,
      pagingModes: ['offset'],
      supportsPostNextHints: false,
      defaultTtlSeconds: 30,
    },
    metadata: { domain: 'air' },
  }),
  decodeSourceRegistryEntry({
    _tag: 'SourceRegistryEntry',
    version: 'geoint.registry.v1',
    sourceId: 'adsb-exchange',
    canonicalSource: 'adsb-lol',
    displayName: 'ADS-B Exchange',
    endpoint: 'https://www.adsbexchange.com/data/',
    enabled: true,
    role: 'trigger',
    priority: 90,
    weight: 0.95,
    aliases: [
      { adapter: 'geoint-search', externalId: 'adsb-lol', canonical: 'adsb-lol' },
      { adapter: 'legacy', externalId: 'adsb-lol', canonical: 'adsb-lol' },
    ],
    capabilities: {
      provider: 'stream',
      supportsCollections: false,
      supportsIds: true,
      supportsBBox: true,
      supportsIntersects: false,
      supportsDatetime: false,
      supportsFilter: false,
      supportedFilterLangs: ['none'],
      supportsFilterCrs: false,
      pagingModes: ['offset'],
      supportsPostNextHints: false,
      defaultTtlSeconds: 20,
    },
    metadata: { domain: 'air' },
  }),
  decodeSourceRegistryEntry({
    _tag: 'SourceRegistryEntry',
    version: 'geoint.registry.v1',
    sourceId: 'openmeteo-api',
    canonicalSource: 'openmeteo',
    displayName: 'Open-Meteo API',
    endpoint: 'https://open-meteo.com/en/docs',
    enabled: true,
    role: 'trigger',
    priority: 89,
    weight: 0.92,
    aliases: [
      { adapter: 'geoint-search', externalId: 'openmeteo', canonical: 'openmeteo' },
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
  }),
  decodeSourceRegistryEntry({
    _tag: 'SourceRegistryEntry',
    version: 'geoint.registry.v1',
    sourceId: 'nws-api',
    canonicalSource: 'noaa',
    displayName: 'NWS API',
    endpoint: 'https://www.weather.gov/documentation/services-web-api',
    enabled: true,
    role: 'trigger',
    priority: 88,
    weight: 0.9,
    aliases: [
      { adapter: 'geoint-search', externalId: 'noaa', canonical: 'noaa' },
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
      defaultTtlSeconds: 120,
    },
    metadata: { domain: 'weather' },
  }),
  decodeSourceRegistryEntry({
    _tag: 'SourceRegistryEntry',
    version: 'geoint.registry.v1',
    sourceId: 'copernicus-stac',
    canonicalSource: 'copernicus-stac',
    displayName: 'Copernicus Data Space STAC',
    endpoint: 'https://stac.dataspace.copernicus.eu/v1',
    enabled: true,
    role: 'context',
    priority: 80,
    weight: 0.85,
    aliases: [
      { adapter: 'geoint-search', externalId: 'sentinel', canonical: 'sentinel' },
      { adapter: 'registry', externalId: 'copernicus', canonical: 'copernicus-stac' },
    ],
    capabilities: {
      provider: 'stac',
      supportsCollections: true,
      supportsIds: true,
      supportsBBox: true,
      supportsIntersects: true,
      supportsDatetime: true,
      supportsFilter: true,
      supportedFilterLangs: ['none', 'cql2-json', 'cql2-text'],
      supportsFilterCrs: true,
      pagingModes: ['link', 'token'],
      supportsPostNextHints: true,
      defaultTtlSeconds: 300,
      stac: {
        stacVersion: '1.0.0',
        objectTypes: ['Item', 'Catalog', 'Collection'],
        catalogMode: 'dynamic',
        supportsSearchEndpoint: true,
        supportsAssets: true,
        supportsRelationshipLinks: true,
        extensions: [
          { id: 'https://stac-extensions.github.io/filter/v1.0.0/schema.json', maturity: 'stable' },
        ],
      },
    },
    metadata: { domain: 'eo' },
  }),
  decodeSourceRegistryEntry({
    _tag: 'SourceRegistryEntry',
    version: 'geoint.registry.v1',
    sourceId: 'planetary-computer',
    canonicalSource: 'planetary-computer',
    displayName: 'Microsoft Planetary Computer STAC',
    endpoint: 'https://planetarycomputer.microsoft.com/catalog',
    enabled: true,
    role: 'archive',
    priority: 70,
    weight: 0.8,
    aliases: [
      { adapter: 'geoint-search', externalId: 'planet', canonical: 'planet' },
      { adapter: 'registry', externalId: 'planetary-computer', canonical: 'planetary-computer' },
    ],
    capabilities: {
      provider: 'stac',
      supportsCollections: true,
      supportsIds: true,
      supportsBBox: true,
      supportsIntersects: true,
      supportsDatetime: true,
      supportsFilter: true,
      supportedFilterLangs: ['none', 'cql2-json', 'cql2-text'],
      supportsFilterCrs: true,
      pagingModes: ['link', 'token'],
      supportsPostNextHints: true,
      defaultTtlSeconds: 900,
      stac: {
        stacVersion: '1.0.0',
        objectTypes: ['Item', 'Catalog', 'Collection'],
        catalogMode: 'dynamic',
        supportsSearchEndpoint: true,
        supportsAssets: true,
        supportsRelationshipLinks: true,
        extensions: [
          { id: 'https://stac-extensions.github.io/filter/v1.0.0/schema.json', maturity: 'stable' },
        ],
      },
    },
    metadata: { domain: 'eo' },
  }),
  decodeSourceRegistryEntry({
    _tag: 'SourceRegistryEntry',
    version: 'geoint.registry.v1',
    sourceId: 'gdacs',
    canonicalSource: 'gdacs',
    displayName: 'GDACS',
    endpoint: 'https://www.gdacs.org/feed_reference.aspx',
    enabled: true,
    role: 'trigger',
    priority: 82,
    weight: 0.86,
    aliases: [
      { adapter: 'geoint-search', externalId: 'custom', canonical: 'custom' },
      { adapter: 'registry', externalId: 'gdacs', canonical: 'gdacs' },
    ],
    capabilities: {
      provider: 'native',
      supportsCollections: false,
      supportsIds: true,
      supportsBBox: true,
      supportsIntersects: false,
      supportsDatetime: true,
      supportsFilter: false,
      supportedFilterLangs: ['none'],
      supportsFilterCrs: false,
      pagingModes: ['offset'],
      supportsPostNextHints: false,
      defaultTtlSeconds: 360,
    },
    metadata: { domain: 'disaster' },
  }),
]

const buildIndexes = (entries: ReadonlyArray<SourceRegistryEntry>) => ({
  sourceIndex: new Map(
    entries.map((entry) => [String(entry.sourceId).toLowerCase(), entry])
  ),
  aliasIndex: new Map(
    entries.flatMap((entry) =>
      entry.aliases.map((alias) => [alias.externalId.toLowerCase(), alias.canonical] as const)
    )
  ),
  canonicalToSource: new Map(
    entries.map((entry) => [entry.canonicalSource, entry])
  ),
})

let runtimeSourceRegistry: ReadonlyArray<SourceRegistryEntry> = SEEDED_SOURCE_REGISTRY
let { sourceIndex, aliasIndex, canonicalToSource } = buildIndexes(runtimeSourceRegistry)

const reindex = () => {
  const indexes = buildIndexes(runtimeSourceRegistry)
  sourceIndex = indexes.sourceIndex
  aliasIndex = indexes.aliasIndex
  canonicalToSource = indexes.canonicalToSource
}

export const listSeededSourceRegistry = (): ReadonlyArray<SourceRegistryEntry> =>
  SEEDED_SOURCE_REGISTRY

export const listSourceRegistry = (): ReadonlyArray<SourceRegistryEntry> => runtimeSourceRegistry

export const setSourceRegistry = (entries: ReadonlyArray<SourceRegistryEntry>) => {
  runtimeSourceRegistry = [...entries]
  reindex()
}

export const resetSourceRegistry = () => {
  runtimeSourceRegistry = SEEDED_SOURCE_REGISTRY
  reindex()
}

export const getSourceById = (sourceId: string): SourceRegistryEntry | undefined =>
  sourceIndex.get(sourceId.toLowerCase())

export const resolveCanonicalSource = (sourceOrAlias: string): CanonicalIntelSource | undefined => {
  const normalized = sourceOrAlias.toLowerCase()

  const direct = sourceIndex.get(normalized)
  if (direct) return direct.canonicalSource

  return aliasIndex.get(normalized)
}

export const resolveSourceEntry = (sourceOrAlias: string): SourceRegistryEntry | undefined => {
  const canonical = resolveCanonicalSource(sourceOrAlias)
  if (!canonical) return undefined
  return canonicalToSource.get(canonical)
}

export const toCanonicalSourceSet = (
  sources: ReadonlyArray<string>
): ReadonlySet<CanonicalIntelSource> => {
  const resolved = sources
    .map(resolveCanonicalSource)
    .filter((v): v is CanonicalIntelSource => v !== undefined)

  return new Set(resolved)
}

export const isSourceEnabledForRole = (sourceId: string, role: 'trigger' | 'context' | 'archive') => {
  const entry = resolveSourceEntry(sourceId)
  if (!entry) return false

  if (!entry.enabled) return false
  if (entry.role === role) return true

  // archive can always consume trigger/context feeds
  if (role === 'archive') return true

  return false
}
