/**
 * GEOINT Entities - Barrel Export + Factory
 *
 * Canonical entity types for the GEOINT system.
 * Each entity composes ECS traits with domain-specific fields.
 *
 * @module geoint/entities
 */

import { Match, Schema } from 'effect'
import {
  EntityType,
  type EntityId,
  EntityProvenance,
  SourceContribution,
  RawAuditRef,
  type IntelSource,
} from '@/lib/ecs'
import type { SearchResultItem } from '../schemas/search'
import {
  SpatialTrait,
  TemporalTrait,
  KineticTrait,
  IdentifiableTrait,
  ClassifiedTrait,
} from '../schemas/traits'
import { toEcsIntelSource } from '../registry'

// Entity exports
export {
  FlightEntity,
  Icao24,
  SquawkCode,
  AircraftCategory,
} from './flight'

export {
  PoiEntity,
  PoiCategory,
  OsmElementType,
  OsmTags,
} from './poi'

export {
  TrackEntity,
  TrackStatus,
  TrackSourceType,
} from './track'

export {
  WeatherEntity,
  WmoWeatherCode,
  ForecastType,
  AlertSeverity,
} from './weather'

export {
  ImageryEntity,
  ImageryProvider,
  ProcessingLevel,
  SpectralBand,
} from './imagery'

export { FeatureEntity } from './feature'

// =============================================================================
// Entity Union Type
// =============================================================================

import { FlightEntity } from './flight'
import { PoiEntity } from './poi'
import { TrackEntity } from './track'
import { WeatherEntity } from './weather'
import { ImageryEntity } from './imagery'
import { FeatureEntity } from './feature'

const GeointEntitySchema = Schema.Union(
  FlightEntity,
  PoiEntity,
  TrackEntity,
  WeatherEntity,
  ImageryEntity,
  FeatureEntity,
).pipe(
  Schema.annotations({
    identifier: 'GeointEntity',
    title: 'GEOINT Entity',
    description: 'Union of all GEOINT entity types. Discriminate on _tag or entityType.',
  })
)

export type GeointEntity = typeof GeointEntitySchema.Type

interface GeointEntityFactorySchema extends typeof GeointEntitySchema {
  fromSearchResult: (result: SearchResultItem) => GeointEntity
}

// =============================================================================
// Factory Helpers
// =============================================================================

const WMO_CODES = new Set<number>([
  0, 1, 2, 3, 45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75,
  80, 81, 82, 95, 96, 99,
])

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes)
  const cryptoObj = globalThis.crypto
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(array)
  } else {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

function uuidV4(): string {
  const hex = randomHex(16).split('')
  hex[12] = '4'
  hex[16] = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`
}

function createEntityId(entityType: EntityType): EntityId {
  return `${entityType}-${uuidV4()}` as EntityId
}

function toIntelSource(source: SearchResultItem['source']): IntelSource {
  return toEcsIntelSource(source)
}

function toObservedAt(result: SearchResultItem): Date {
  switch (result._tag) {
    case 'SearchResultFlight':
      return result.lastContact
    case 'SearchResultWeather':
      return result.forecastTime
    case 'SearchResultImagery':
      return result.acquired
    default:
      return result.retrievedAt
  }
}

function buildProvenance(result: SearchResultItem): EntityProvenance {
  const observedAt = toObservedAt(result)
  const source = toIntelSource(result.source)
  const now = result.retrievedAt

  const sourceContribution = new SourceContribution({
    source,
    observedAt,
    ingestedAt: now,
    confidence: result.score as any,
    contributedFields: ['position', 'label'],
    rawRef: new RawAuditRef({
      streamUrl: `/geoint/search/${source}`,
      offset: result.id,
      hash: '0'.repeat(64),
      sizeBytes: 0,
    }),
    notes: `Derived from ${result._tag}`,
  })

  return new EntityProvenance({
    sources: [sourceContribution],
    createdAt: now,
    updatedAt: now,
    revision: 1,
    aggregateConfidence: result.score as any,
    isStale: false,
    ttlSeconds: 300,
    primarySource: source,
  })
}

function spatialFromPosition(position: [number, number] | [number, number, number]): SpatialTrait {
  return new SpatialTrait({
    position:
      position.length === 3
        ? [position[0], position[1], position[2]]
        : [position[0], position[1], 0],
  })
}

function temporalFromDate(observedAt: Date, ttlMs = 300_000): TemporalTrait {
  return new TemporalTrait({
    validFrom: observedAt,
    validTo: new Date(observedAt.getTime() + ttlMs),
    observedAt,
  })
}

function weatherCodeOrUndefined(code?: number): number | undefined {
  return code != null && WMO_CODES.has(code) ? code : undefined
}

const fromSearchResult = (result: SearchResultItem): GeointEntity =>
  Match.value(result).pipe(
    Match.tag('SearchResultFlight', (r) =>
      new FlightEntity({
        id: createEntityId('flight'),
        entityType: 'flight',
        provenance: buildProvenance(r),
        metadata: { searchResultId: r.id, source: r.source },
        spatial: spatialFromPosition(r.position),
        temporal: temporalFromDate(r.lastContact, 30_000),
        kinetic: new KineticTrait({
          heading: r.heading,
          speed: r.velocity,
          verticalRate: r.verticalRate,
        }),
        identifiable: new IdentifiableTrait({
          externalIds: { icao24: r.icao24 },
          callsign: r.callsign || undefined,
          name: r.callsign || r.icao24,
        }),
        icao24: r.icao24,
        originCountry: r.originCountry,
        onGround: r.onGround,
        category: r.category,
      })
    ),
    Match.tag('SearchResultPoi', (r) =>
      new PoiEntity({
        id: createEntityId('poi'),
        entityType: 'poi',
        provenance: buildProvenance(r),
        metadata: { searchResultId: r.id, source: r.source },
        spatial: spatialFromPosition(r.position),
        temporal: temporalFromDate(r.retrievedAt, 3_600_000),
        identifiable: new IdentifiableTrait({
          externalIds: { poiId: r.poiId },
          name: r.name,
        }),
        category: r.category,
        tags: r.tags,
      })
    ),
    Match.tag('SearchResultTrack', (r) =>
      new TrackEntity({
        id: createEntityId('track'),
        entityType: 'track',
        provenance: buildProvenance(r),
        metadata: { searchResultId: r.id, source: r.source },
        spatial: spatialFromPosition(r.position),
        temporal: temporalFromDate(r.retrievedAt, 120_000),
        kinetic: new KineticTrait({
          heading: r.heading,
          speed: r.speed,
          verticalRate: 0,
        }),
        classified: new ClassifiedTrait({
          classification: r.classification,
          objectType: r.objectType,
        }),
        identifiable: new IdentifiableTrait({
          externalIds: { trackId: r.trackId },
          name: r.label || r.trackId,
        }),
        trackId: r.trackId,
        lastSeen: r.retrievedAt,
        sourceType: r.source === 'track' ? 'fusion' : 'manual',
      })
    ),
    Match.tag('SearchResultWeather', (r) =>
      new WeatherEntity({
        id: createEntityId('weather'),
        entityType: 'weather',
        provenance: buildProvenance(r),
        metadata: { searchResultId: r.id, source: r.source },
        spatial: spatialFromPosition(r.position),
        temporal: temporalFromDate(r.forecastTime, 900_000),
        locationName: r.locationName,
        forecastType: 'current',
        temperature: r.temperature,
        feelsLike: r.feelsLike,
        humidity: r.humidity,
        pressure: r.pressure,
        windSpeed: r.windSpeed,
        windDirection: r.windDirection,
        cloudCover: r.cloudCover,
        weatherCode: weatherCodeOrUndefined(r.weatherCode) as any,
        weatherDescription: r.weatherDescription,
        precipitation: r.precipitation,
        uvIndex: r.uvIndex,
        hasHourlyForecast: r.hasHourlyForecast,
        hasDailyForecast: r.hasDailyForecast,
      })
    ),
    Match.tag('SearchResultImagery', (r) =>
      new ImageryEntity({
        id: createEntityId('imagery'),
        entityType: 'imagery',
        provenance: buildProvenance(r),
        metadata: { searchResultId: r.id, source: r.source },
        spatial: spatialFromPosition(r.position),
        temporal: temporalFromDate(r.acquired, 86_400_000),
        provider: r.provider,
        collection: r.collection,
        itemId: r.itemId,
        acquired: r.acquired,
        cloudCover: r.cloudCover,
        gsd: r.gsd,
        sunElevation: r.sunElevation,
        sunAzimuth: r.sunAzimuth,
        offNadir: r.offNadir,
        thumbnailUrl: r.thumbnailUrl,
        assetUrl: r.assetsUrl,
      })
    ),
    Match.tag('SearchResultFeature', (r) =>
      new FeatureEntity({
        id: createEntityId('feature'),
        entityType: 'feature',
        provenance: buildProvenance(r),
        metadata: { searchResultId: r.id, source: r.source },
        spatial: spatialFromPosition(r.position),
        temporal: temporalFromDate(r.retrievedAt, 86_400_000),
        identifiable: new IdentifiableTrait({
          externalIds: { featureId: r.featureId },
          name: r.label || r.featureId,
        }),
        featureId: r.featureId,
        geometryType: r.geometryType,
        properties: r.properties,
        label: r.label || undefined,
      })
    ),
    Match.exhaustive,
  )

export const GeointEntity: GeointEntityFactorySchema = Object.assign(
  GeointEntitySchema,
  { fromSearchResult },
)

export const geointEntityFromSearchResult = fromSearchResult

/**
 * Get entity type from a GEOINT entity.
 */
export const getEntityType = (entity: GeointEntity): EntityType => {
  return entity.entityType
}

/**
 * Get a human-readable display label for any GEOINT entity.
 */
export const getEntityDisplayLabel = (entity: GeointEntity): string => {
  switch (entity._tag) {
    case 'FlightEntity':
    case 'PoiEntity':
    case 'TrackEntity':
    case 'WeatherEntity':
    case 'ImageryEntity':
    case 'FeatureEntity':
      return entity.displayLabel
  }
}

/**
 * Type guard for FlightEntity.
 */
export const isFlightEntity = (entity: GeointEntity): entity is FlightEntity => {
  return entity._tag === 'FlightEntity'
}

/**
 * Type guard for PoiEntity.
 */
export const isPoiEntity = (entity: GeointEntity): entity is PoiEntity => {
  return entity._tag === 'PoiEntity'
}

/**
 * Type guard for TrackEntity.
 */
export const isTrackEntity = (entity: GeointEntity): entity is TrackEntity => {
  return entity._tag === 'TrackEntity'
}

/**
 * Type guard for WeatherEntity.
 */
export const isWeatherEntity = (entity: GeointEntity): entity is WeatherEntity => {
  return entity._tag === 'WeatherEntity'
}

/**
 * Type guard for ImageryEntity.
 */
export const isImageryEntity = (entity: GeointEntity): entity is ImageryEntity => {
  return entity._tag === 'ImageryEntity'
}

/**
 * Type guard for FeatureEntity.
 */
export const isFeatureEntity = (entity: GeointEntity): entity is FeatureEntity => {
  return entity._tag === 'FeatureEntity'
}
