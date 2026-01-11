/**
 * GEOINT Entities - Barrel Export
 *
 * Canonical entity types for the GEOINT system.
 * Each entity composes ECS traits with domain-specific fields.
 *
 * @module geoint/entities
 */

import { Schema } from 'effect'
import { EntityType } from '@/lib/ecs'

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

// =============================================================================
// Entity Union Type
// =============================================================================

import { FlightEntity } from './flight'
import { PoiEntity } from './poi'
import { TrackEntity } from './track'
import { WeatherEntity } from './weather'
import { ImageryEntity } from './imagery'

/**
 * Union of all GEOINT entity types.
 * Use _tag or entityType for discrimination.
 */
export const GeointEntity = Schema.Union(
  FlightEntity,
  PoiEntity,
  TrackEntity,
  WeatherEntity,
  ImageryEntity
).pipe(
  Schema.annotations({
    identifier: 'GeointEntity',
    title: 'GEOINT Entity',
    description: 'Union of all GEOINT entity types. Discriminate on _tag or entityType.',
  })
)
export type GeointEntity = typeof GeointEntity.Type

/**
 * Get entity type from a GEOINT entity.
 */
export const getEntityType = (entity: GeointEntity): EntityType => {
  return entity.entityType
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
