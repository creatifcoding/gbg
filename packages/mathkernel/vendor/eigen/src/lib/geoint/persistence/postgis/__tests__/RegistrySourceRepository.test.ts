import { describe, expect, it } from 'vitest'
import {
  buildSourceRegistryEntries,
  type RegistryAliasRow,
  type RegistrySourceRow,
} from '../RegistrySourceRepository'

describe('RegistrySourceRepository', () => {
  it('builds source registry entries with aliases and preserves STAC capability payload', () => {
    const sources: ReadonlyArray<RegistrySourceRow> = [
      {
        source_id: 'copernicus-stac',
        version: 'geoint.registry.v1',
        canonical_source: 'copernicus-stac',
        display_name: 'Copernicus Data Space STAC',
        endpoint: 'https://stac.dataspace.copernicus.eu/v1',
        enabled: true,
        role: 'context',
        priority: 80,
        weight: 0.85,
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
      },
    ]

    const aliases: ReadonlyArray<RegistryAliasRow> = [
      {
        source_id: 'copernicus-stac',
        adapter: 'geoint-search',
        external_id: 'sentinel',
        canonical_source: 'sentinel',
      },
      {
        source_id: 'copernicus-stac',
        adapter: 'registry',
        external_id: 'copernicus',
        canonical_source: 'copernicus-stac',
      },
    ]

    const entries = buildSourceRegistryEntries(sources, aliases)

    expect(entries).toHaveLength(1)
    expect(String(entries[0]?.sourceId)).toBe('copernicus-stac')
    expect(entries[0]?.aliases).toHaveLength(2)
    expect(entries[0]?.capabilities.provider).toBe('stac')
    expect(entries[0]?.capabilities.stac?.stacVersion).toBe('1.0.0')
  })

  it('sorts by descending priority', () => {
    const sources: ReadonlyArray<RegistrySourceRow> = [
      {
        source_id: 'low',
        version: 'geoint.registry.v1',
        canonical_source: 'unknown',
        display_name: 'Low',
        endpoint: 'https://example.com/low',
        enabled: true,
        role: 'context',
        priority: 10,
        weight: 0.1,
        capabilities: {
          provider: 'native',
          supportsCollections: false,
          supportsIds: false,
          supportsBBox: true,
          supportsIntersects: false,
          supportsDatetime: false,
          supportsFilter: false,
          supportedFilterLangs: ['none'],
          supportsFilterCrs: false,
          pagingModes: ['offset'],
          supportsPostNextHints: false,
          defaultTtlSeconds: 60,
        },
        metadata: {},
      },
      {
        source_id: 'high',
        version: 'geoint.registry.v1',
        canonical_source: 'derived',
        display_name: 'High',
        endpoint: 'https://example.com/high',
        enabled: true,
        role: 'trigger',
        priority: 90,
        weight: 0.9,
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
          defaultTtlSeconds: 60,
        },
        metadata: {},
      },
    ]

    const entries = buildSourceRegistryEntries(sources, [])
    expect(String(entries[0]?.sourceId)).toBe('high')
    expect(String(entries[1]?.sourceId)).toBe('low')
  })
})
