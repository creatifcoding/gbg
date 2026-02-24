import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

interface TaxonomySeed {
  readonly canonicalSource: string
  readonly domain: string
  readonly modality: string
  readonly description: string
}

interface SourceSeed {
  readonly sourceId: string
  readonly canonicalSource: string
  readonly displayName: string
  readonly endpoint: string
  readonly enabled: boolean
  readonly role: 'trigger' | 'context' | 'archive'
  readonly priority: number
  readonly weight: number
  readonly capabilities: Record<string, unknown>
  readonly metadata: Record<string, unknown>
}

interface AliasSeed {
  readonly sourceId: string
  readonly adapter: string
  readonly externalId: string
  readonly canonicalSource: string
}

const TAXONOMY_SEEDS: ReadonlyArray<TaxonomySeed> = [
  { canonicalSource: 'opensky', domain: 'air', modality: 'stream', description: 'OpenSky Network live aircraft telemetry' },
  { canonicalSource: 'adsb-lol', domain: 'air', modality: 'stream', description: 'Community ADS-B feed' },
  { canonicalSource: 'flightradar24', domain: 'air', modality: 'native', description: 'Commercial flight tracking provider' },
  { canonicalSource: 'overpass', domain: 'geospatial', modality: 'native', description: 'Overpass API OSM query source' },
  { canonicalSource: 'osm', domain: 'geospatial', modality: 'native', description: 'OpenStreetMap canonical data source' },
  { canonicalSource: 'nominatim', domain: 'geospatial', modality: 'native', description: 'Nominatim geocoding source' },
  { canonicalSource: 'planet', domain: 'imagery', modality: 'native', description: 'Planet Labs imagery source' },
  { canonicalSource: 'sentinel', domain: 'imagery', modality: 'native', description: 'Sentinel imagery source mapping' },
  { canonicalSource: 'maxar', domain: 'imagery', modality: 'native', description: 'Maxar imagery source' },
  { canonicalSource: 'openmeteo', domain: 'weather', modality: 'native', description: 'Open-Meteo forecast source' },
  { canonicalSource: 'noaa', domain: 'weather', modality: 'native', description: 'NOAA/NWS weather source' },
  { canonicalSource: 'manual', domain: 'internal', modality: 'manual', description: 'Manual operator entry' },
  { canonicalSource: 'derived', domain: 'internal', modality: 'derived', description: 'Derived analytics source' },
  { canonicalSource: 'fused', domain: 'internal', modality: 'derived', description: 'Cross-source fused output' },
  { canonicalSource: 'unknown', domain: 'internal', modality: 'unknown', description: 'Unknown/unmapped source' },
  { canonicalSource: 'track', domain: 'internal', modality: 'derived', description: 'Internal track abstraction' },
  { canonicalSource: 'feature', domain: 'internal', modality: 'derived', description: 'Internal feature abstraction' },
  { canonicalSource: 'aisstream', domain: 'maritime', modality: 'stream', description: 'Maritime AIS stream source' },
  { canonicalSource: 'marine-traffic', domain: 'maritime', modality: 'native', description: 'MarineTraffic provider' },
  { canonicalSource: 'gdacs', domain: 'disaster', modality: 'native', description: 'GDACS disaster alerts source' },
  { canonicalSource: 'firms', domain: 'disaster', modality: 'native', description: 'NASA FIRMS fire source' },
  { canonicalSource: 'usgs', domain: 'disaster', modality: 'native', description: 'USGS hazard source' },
  { canonicalSource: 'copernicus-stac', domain: 'imagery', modality: 'stac', description: 'Copernicus Data Space STAC endpoint' },
  { canonicalSource: 'planetary-computer', domain: 'imagery', modality: 'stac', description: 'Microsoft Planetary Computer STAC endpoint' },
  { canonicalSource: 'worldpop', domain: 'population', modality: 'native', description: 'WorldPop population source' },
  { canonicalSource: 'gdelt', domain: 'osint', modality: 'native', description: 'GDELT event stream source' },
  { canonicalSource: 'acled', domain: 'osint', modality: 'native', description: 'ACLED conflict event source' },
  { canonicalSource: 'custom', domain: 'custom', modality: 'native', description: 'Custom adapter source' },
]

const SOURCE_SEEDS: ReadonlyArray<SourceSeed> = [
  {
    sourceId: 'opensky',
    canonicalSource: 'opensky',
    displayName: 'OpenSky Network',
    endpoint: 'https://openskynetwork.github.io/opensky-api/rest.html',
    enabled: true,
    role: 'trigger',
    priority: 95,
    weight: 1,
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
  },
  {
    sourceId: 'adsb-exchange',
    canonicalSource: 'adsb-lol',
    displayName: 'ADS-B Exchange',
    endpoint: 'https://www.adsbexchange.com/data/',
    enabled: true,
    role: 'trigger',
    priority: 90,
    weight: 0.95,
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
  },
  {
    sourceId: 'openmeteo-api',
    canonicalSource: 'openmeteo',
    displayName: 'Open-Meteo API',
    endpoint: 'https://open-meteo.com/en/docs',
    enabled: true,
    role: 'trigger',
    priority: 89,
    weight: 0.92,
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
  },
  {
    sourceId: 'nws-api',
    canonicalSource: 'noaa',
    displayName: 'NWS API',
    endpoint: 'https://www.weather.gov/documentation/services-web-api',
    enabled: true,
    role: 'trigger',
    priority: 88,
    weight: 0.9,
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
  },
  {
    sourceId: 'copernicus-stac',
    canonicalSource: 'copernicus-stac',
    displayName: 'Copernicus Data Space STAC',
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
  {
    sourceId: 'planetary-computer',
    canonicalSource: 'planetary-computer',
    displayName: 'Microsoft Planetary Computer STAC',
    endpoint: 'https://planetarycomputer.microsoft.com/catalog',
    enabled: true,
    role: 'archive',
    priority: 70,
    weight: 0.8,
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
  },
  {
    sourceId: 'gdacs',
    canonicalSource: 'gdacs',
    displayName: 'GDACS',
    endpoint: 'https://www.gdacs.org/feed_reference.aspx',
    enabled: true,
    role: 'trigger',
    priority: 82,
    weight: 0.86,
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
  },
]

const ALIAS_SEEDS: ReadonlyArray<AliasSeed> = [
  { sourceId: 'opensky', adapter: 'geoint-search', externalId: 'opensky', canonicalSource: 'opensky' },
  { sourceId: 'adsb-exchange', adapter: 'geoint-search', externalId: 'adsb-lol', canonicalSource: 'adsb-lol' },
  { sourceId: 'adsb-exchange', adapter: 'legacy', externalId: 'adsb-lol', canonicalSource: 'adsb-lol' },
  { sourceId: 'openmeteo-api', adapter: 'geoint-search', externalId: 'openmeteo', canonicalSource: 'openmeteo' },
  { sourceId: 'nws-api', adapter: 'geoint-search', externalId: 'noaa', canonicalSource: 'noaa' },
  { sourceId: 'copernicus-stac', adapter: 'geoint-search', externalId: 'sentinel', canonicalSource: 'sentinel' },
  { sourceId: 'copernicus-stac', adapter: 'registry', externalId: 'copernicus', canonicalSource: 'copernicus-stac' },
  { sourceId: 'planetary-computer', adapter: 'geoint-search', externalId: 'planet', canonicalSource: 'planet' },
  { sourceId: 'planetary-computer', adapter: 'registry', externalId: 'planetary-computer', canonicalSource: 'planetary-computer' },
  { sourceId: 'gdacs', adapter: 'geoint-search', externalId: 'custom', canonicalSource: 'custom' },
  { sourceId: 'gdacs', adapter: 'registry', externalId: 'gdacs', canonicalSource: 'gdacs' },
]

export const createRegistryInfrastructure = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS geoint_registry;

    CREATE TABLE IF NOT EXISTS geoint_registry.source_taxonomy (
      canonical_source TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      modality TEXT NOT NULL,
      description TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT source_taxonomy_lowercase CHECK (canonical_source = lower(canonical_source))
    );

    CREATE TABLE IF NOT EXISTS geoint_registry.sources (
      source_id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      canonical_source TEXT NOT NULL REFERENCES geoint_registry.source_taxonomy(canonical_source),
      display_name TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      role TEXT NOT NULL,
      priority INTEGER NOT NULL,
      weight NUMERIC(4,3) NOT NULL,
      capabilities JSONB NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT source_role_valid CHECK (role IN ('trigger', 'context', 'archive')),
      CONSTRAINT source_priority_range CHECK (priority BETWEEN 0 AND 100),
      CONSTRAINT source_weight_range CHECK (weight >= 0 AND weight <= 1),
      CONSTRAINT source_lowercase CHECK (source_id = lower(source_id)),
      CONSTRAINT source_version_check CHECK (version = 'geoint.registry.v1')
    );

    CREATE TABLE IF NOT EXISTS geoint_registry.source_aliases (
      adapter TEXT NOT NULL,
      external_id TEXT NOT NULL,
      source_id TEXT NOT NULL REFERENCES geoint_registry.sources(source_id) ON DELETE CASCADE,
      canonical_source TEXT NOT NULL REFERENCES geoint_registry.source_taxonomy(canonical_source),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (adapter, external_id),
      CONSTRAINT source_aliases_lowercase CHECK (external_id = lower(external_id))
    );

    CREATE INDEX IF NOT EXISTS source_taxonomy_domain_idx
      ON geoint_registry.source_taxonomy (domain);

    CREATE INDEX IF NOT EXISTS sources_canonical_source_idx
      ON geoint_registry.sources (canonical_source);

    CREATE INDEX IF NOT EXISTS sources_role_enabled_idx
      ON geoint_registry.sources (role, enabled);

    CREATE INDEX IF NOT EXISTS sources_provider_idx
      ON geoint_registry.sources ((capabilities->>'provider'));

    CREATE INDEX IF NOT EXISTS sources_stac_enabled_idx
      ON geoint_registry.sources ((capabilities ? 'stac'));

    CREATE INDEX IF NOT EXISTS source_aliases_source_idx
      ON geoint_registry.source_aliases (source_id);

    CREATE OR REPLACE FUNCTION geoint_registry.touch_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS touch_source_taxonomy_updated_at ON geoint_registry.source_taxonomy;
    CREATE TRIGGER touch_source_taxonomy_updated_at
      BEFORE UPDATE ON geoint_registry.source_taxonomy
      FOR EACH ROW EXECUTE FUNCTION geoint_registry.touch_updated_at();

    DROP TRIGGER IF EXISTS touch_sources_updated_at ON geoint_registry.sources;
    CREATE TRIGGER touch_sources_updated_at
      BEFORE UPDATE ON geoint_registry.sources
      FOR EACH ROW EXECUTE FUNCTION geoint_registry.touch_updated_at();

    DROP TRIGGER IF EXISTS touch_source_aliases_updated_at ON geoint_registry.source_aliases;
    CREATE TRIGGER touch_source_aliases_updated_at
      BEFORE UPDATE ON geoint_registry.source_aliases
      FOR EACH ROW EXECUTE FUNCTION geoint_registry.touch_updated_at();
  `)
})

export const seedSourceTaxonomy = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Effect.forEach(
    TAXONOMY_SEEDS,
    (seed) =>
      sql`
        INSERT INTO geoint_registry.source_taxonomy (
          canonical_source,
          domain,
          modality,
          description,
          active
        )
        VALUES (
          ${seed.canonicalSource},
          ${seed.domain},
          ${seed.modality},
          ${seed.description},
          true
        )
        ON CONFLICT (canonical_source)
        DO UPDATE SET
          domain = EXCLUDED.domain,
          modality = EXCLUDED.modality,
          description = EXCLUDED.description,
          active = EXCLUDED.active
      `.pipe(Effect.asVoid),
    { concurrency: 1, discard: true }
  )
})

export const seedSourceRegistry = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Effect.forEach(
    SOURCE_SEEDS,
    (seed) =>
      sql`
        INSERT INTO geoint_registry.sources (
          source_id,
          version,
          canonical_source,
          display_name,
          endpoint,
          enabled,
          role,
          priority,
          weight,
          capabilities,
          metadata
        )
        VALUES (
          ${seed.sourceId},
          'geoint.registry.v1',
          ${seed.canonicalSource},
          ${seed.displayName},
          ${seed.endpoint},
          ${seed.enabled},
          ${seed.role},
          ${seed.priority},
          ${seed.weight},
          ${JSON.stringify(seed.capabilities)}::jsonb,
          ${JSON.stringify(seed.metadata)}::jsonb
        )
        ON CONFLICT (source_id)
        DO UPDATE SET
          version = EXCLUDED.version,
          canonical_source = EXCLUDED.canonical_source,
          display_name = EXCLUDED.display_name,
          endpoint = EXCLUDED.endpoint,
          enabled = EXCLUDED.enabled,
          role = EXCLUDED.role,
          priority = EXCLUDED.priority,
          weight = EXCLUDED.weight,
          capabilities = EXCLUDED.capabilities,
          metadata = EXCLUDED.metadata
      `.pipe(Effect.asVoid),
    { concurrency: 1, discard: true }
  )
})

export const seedSourceAliases = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Effect.forEach(
    ALIAS_SEEDS,
    (seed) =>
      sql`
        INSERT INTO geoint_registry.source_aliases (
          adapter,
          external_id,
          source_id,
          canonical_source
        )
        VALUES (
          ${seed.adapter},
          ${seed.externalId.toLowerCase()},
          ${seed.sourceId},
          ${seed.canonicalSource}
        )
        ON CONFLICT (adapter, external_id)
        DO UPDATE SET
          source_id = EXCLUDED.source_id,
          canonical_source = EXCLUDED.canonical_source
      `.pipe(Effect.asVoid),
    { concurrency: 1, discard: true }
  )
})

export const grantRegistryPermissions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    DO $$
    DECLARE
      current_role text := CURRENT_USER;
    BEGIN
      EXECUTE format('GRANT USAGE ON SCHEMA geoint_registry TO %I', current_role);
      EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA geoint_registry TO %I', current_role);
      EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA geoint_registry TO %I', current_role);
      EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA geoint_registry TO %I', current_role);
    END $$;
  `)
})
