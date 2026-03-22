/**
 * GEOINT Search Result → Kori Traits Mapper
 *
 * Converts SearchResultItem discriminated union to Kori trait bundles.
 * Each result type maps to specific data traits + marker traits.
 *
 * @module geoint/kori/search-result-mapper
 */

import { Match } from 'effect'
import type { TraitId } from '../../kori/schemas/trait'
import type {
  SearchResultItem,
  SearchResultFlight,
  SearchResultPoi,
  SearchResultWeather,
  SearchResultTrack,
  SearchResultFeature,
  SearchResultImagery,
} from '../schemas/search'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trait bundle for Kori entity creation.
 */
export interface TraitBundle {
  /** Entity ID (derived from source ID or generated) */
  readonly entityId: string
  /** Traits to attach to the entity */
  readonly traits: ReadonlyArray<{ id: TraitId; data: unknown }>
}

/**
 * Entity type discriminator derived from SearchResultItem._tag
 */
export type GeointEntityType =
  | 'flight'
  | 'poi'
  | 'weather'
  | 'track'
  | 'feature'
  | 'imagery'

// ─────────────────────────────────────────────────────────────────────────────
// Mapper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map SearchResultFlight to Kori trait bundle.
 */
function mapFlightToTraits(result: SearchResultFlight): TraitBundle {
  return {
    entityId: `flight:${result.icao24}`,
    traits: [
      // Data traits
      {
        id: 'GeoPosition' as TraitId,
        data: {
          _tag: 'GeoPosition',
          lon: result.position[0],
          lat: result.position[1],
        },
      },
      {
        id: 'GeoPosition3D' as TraitId,
        data: {
          _tag: 'GeoPosition3D',
          lon: result.position[0],
          lat: result.position[1],
          altitudeM: result.position[2],
        },
      },
      {
        id: 'Heading' as TraitId,
        data: {
          _tag: 'Heading',
          headingDeg: result.heading,
          speedMps: result.velocity,
        },
      },
      {
        id: 'GeoVelocity' as TraitId,
        data: {
          _tag: 'GeoVelocity',
          groundSpeedMps: result.velocity,
          headingDeg: result.heading,
          verticalRateMps: result.verticalRate,
        },
      },
      {
        id: 'FlightData' as TraitId,
        data: {
          _tag: 'FlightData',
          icao24: result.icao24,
          callsign: result.callsign,
          category: result.category,
          originCountry: result.originCountry,
          onGround: result.onGround,
          lastContact: result.lastContact,
          source: result.source,
        },
      },
      // Source confidence
      {
        id: 'SourceConfidence' as TraitId,
        data: {
          _tag: 'SourceConfidence',
          primarySource: result.source,
          contributingSources: [],
          confidence: result.score,
          staleness: Date.now() - result.retrievedAt.getTime(),
          corroborated: false,
        },
      },
      {
        id: 'SourceTiming' as TraitId,
        data: {
          _tag: 'SourceTiming',
          retrievedAt: result.retrievedAt,
          sourceTimestamp: result.lastContact,
          ttlMs: 30000, // Flights update frequently
        },
      },
      // UI state (defaults)
      {
        id: 'UIState' as TraitId,
        data: {
          _tag: 'UIState',
          selected: false,
          hovered: false,
          expanded: false,
          highlighted: false,
          pinned: false,
          viewed: false,
        },
      },
      // Marker trait
      {
        id: 'IsFlight' as TraitId,
        data: { _tag: 'IsFlight' },
      },
    ],
  }
}

/**
 * Map SearchResultPoi to Kori trait bundle.
 */
function mapPoiToTraits(result: SearchResultPoi): TraitBundle {
  return {
    entityId: `poi:${result.poiId}`,
    traits: [
      // Data traits
      {
        id: 'GeoPosition' as TraitId,
        data: {
          _tag: 'GeoPosition',
          lon: result.position[0],
          lat: result.position[1],
        },
      },
      {
        id: 'PoiData' as TraitId,
        data: {
          _tag: 'PoiData',
          poiId: result.poiId,
          name: result.name,
          category: result.category,
          source: result.source,
        },
      },
      {
        id: 'PoiTags' as TraitId,
        data: {
          _tag: 'PoiTags',
          tags: result.tags,
        },
      },
      // Source confidence
      {
        id: 'SourceConfidence' as TraitId,
        data: {
          _tag: 'SourceConfidence',
          primarySource: result.source,
          contributingSources: [],
          confidence: result.score,
          staleness: Date.now() - result.retrievedAt.getTime(),
          corroborated: false,
        },
      },
      {
        id: 'SourceTiming' as TraitId,
        data: {
          _tag: 'SourceTiming',
          retrievedAt: result.retrievedAt,
          ttlMs: 3600000, // POIs are relatively static
        },
      },
      // UI state (defaults)
      {
        id: 'UIState' as TraitId,
        data: {
          _tag: 'UIState',
          selected: false,
          hovered: false,
          expanded: false,
          highlighted: false,
          pinned: false,
          viewed: false,
        },
      },
      // Marker trait
      {
        id: 'IsPoi' as TraitId,
        data: { _tag: 'IsPoi' },
      },
    ],
  }
}

/**
 * Map SearchResultWeather to Kori trait bundle.
 */
function mapWeatherToTraits(result: SearchResultWeather): TraitBundle {
  return {
    entityId: `weather:${result.id}`,
    traits: [
      // Data traits
      {
        id: 'GeoPosition' as TraitId,
        data: {
          _tag: 'GeoPosition',
          lon: result.position[0],
          lat: result.position[1],
        },
      },
      {
        id: 'WeatherData' as TraitId,
        data: {
          _tag: 'WeatherData',
          locationName: result.locationName,
          temperatureC: result.temperature,
          feelsLikeC: result.feelsLike,
          humidity: result.humidity,
          weatherCode: result.weatherCode,
          weatherDescription: result.weatherDescription,
          source: result.source,
          observedAt: result.forecastTime,
        },
      },
      ...(result.windSpeed !== undefined
        ? [
            {
              id: 'WeatherWind' as TraitId,
              data: {
                _tag: 'WeatherWind',
                speedMps: result.windSpeed,
                directionDeg: result.windDirection,
              },
            },
          ]
        : []),
      ...(result.precipitation !== undefined
        ? [
            {
              id: 'WeatherPrecipitation' as TraitId,
              data: {
                _tag: 'WeatherPrecipitation',
                precipitationMm: result.precipitation,
              },
            },
          ]
        : []),
      ...(result.pressure !== undefined || result.cloudCover !== undefined
        ? [
            {
              id: 'WeatherAtmospheric' as TraitId,
              data: {
                _tag: 'WeatherAtmospheric',
                pressureHpa: result.pressure,
                cloudCoverPercent: result.cloudCover,
                uvIndex: result.uvIndex,
              },
            },
          ]
        : []),
      {
        id: 'WeatherForecastMeta' as TraitId,
        data: {
          _tag: 'WeatherForecastMeta',
          forecastTime: result.forecastTime,
          hasHourlyForecast: result.hasHourlyForecast,
          hasDailyForecast: result.hasDailyForecast,
          timezone: result.timezone,
        },
      },
      // Source confidence
      {
        id: 'SourceConfidence' as TraitId,
        data: {
          _tag: 'SourceConfidence',
          primarySource: result.source,
          contributingSources: [],
          confidence: result.score,
          staleness: Date.now() - result.retrievedAt.getTime(),
          corroborated: false,
        },
      },
      {
        id: 'SourceTiming' as TraitId,
        data: {
          _tag: 'SourceTiming',
          retrievedAt: result.retrievedAt,
          sourceTimestamp: result.forecastTime,
          ttlMs: 900000, // 15 minutes for weather
        },
      },
      // UI state (defaults)
      {
        id: 'UIState' as TraitId,
        data: {
          _tag: 'UIState',
          selected: false,
          hovered: false,
          expanded: false,
          highlighted: false,
          pinned: false,
          viewed: false,
        },
      },
      // Marker trait
      {
        id: 'IsWeather' as TraitId,
        data: { _tag: 'IsWeather' },
      },
    ],
  }
}

/**
 * Map SearchResultTrack to Kori trait bundle.
 */
function mapTrackToTraits(result: SearchResultTrack): TraitBundle {
  return {
    entityId: `track:${result.trackId}`,
    traits: [
      // Data traits
      {
        id: 'GeoPosition' as TraitId,
        data: {
          _tag: 'GeoPosition',
          lon: result.position[0],
          lat: result.position[1],
        },
      },
      {
        id: 'GeoPosition3D' as TraitId,
        data: {
          _tag: 'GeoPosition3D',
          lon: result.position[0],
          lat: result.position[1],
          altitudeM: result.position[2],
        },
      },
      {
        id: 'Heading' as TraitId,
        data: {
          _tag: 'Heading',
          headingDeg: result.heading,
          speedMps: result.speed,
        },
      },
      {
        id: 'TrackData' as TraitId,
        data: {
          _tag: 'TrackData',
          trackId: result.trackId,
          classification: result.classification,
          objectType: result.objectType,
          label: result.label,
          source: result.source,
        },
      },
      // Source confidence
      {
        id: 'SourceConfidence' as TraitId,
        data: {
          _tag: 'SourceConfidence',
          primarySource: result.source,
          contributingSources: [],
          confidence: result.score,
          staleness: Date.now() - result.retrievedAt.getTime(),
          corroborated: false,
        },
      },
      {
        id: 'SourceTiming' as TraitId,
        data: {
          _tag: 'SourceTiming',
          retrievedAt: result.retrievedAt,
          ttlMs: 60000, // Tracks update periodically
        },
      },
      // UI state (defaults)
      {
        id: 'UIState' as TraitId,
        data: {
          _tag: 'UIState',
          selected: false,
          hovered: false,
          expanded: false,
          highlighted: false,
          pinned: false,
          viewed: false,
        },
      },
      // Marker trait
      {
        id: 'IsTrack' as TraitId,
        data: { _tag: 'IsTrack' },
      },
    ],
  }
}

/**
 * Map SearchResultFeature to Kori trait bundle.
 */
function mapFeatureToTraits(result: SearchResultFeature): TraitBundle {
  return {
    entityId: `feature:${result.featureId}`,
    traits: [
      // Data traits
      {
        id: 'GeoPosition' as TraitId,
        data: {
          _tag: 'GeoPosition',
          lon: result.position[0],
          lat: result.position[1],
        },
      },
      // Source confidence
      {
        id: 'SourceConfidence' as TraitId,
        data: {
          _tag: 'SourceConfidence',
          primarySource: result.source,
          contributingSources: [],
          confidence: result.score,
          staleness: Date.now() - result.retrievedAt.getTime(),
          corroborated: false,
        },
      },
      {
        id: 'SourceTiming' as TraitId,
        data: {
          _tag: 'SourceTiming',
          retrievedAt: result.retrievedAt,
          ttlMs: 86400000, // Features are static, 24h TTL
        },
      },
      // UI state (defaults)
      {
        id: 'UIState' as TraitId,
        data: {
          _tag: 'UIState',
          selected: false,
          hovered: false,
          expanded: false,
          highlighted: false,
          pinned: false,
          viewed: false,
        },
      },
      // Marker trait
      {
        id: 'IsFeature' as TraitId,
        data: { _tag: 'IsFeature' },
      },
    ],
  }
}

/**
 * Map SearchResultImagery to Kori trait bundle.
 */
function mapImageryToTraits(result: SearchResultImagery): TraitBundle {
  return {
    entityId: `imagery:${result.provider}:${result.itemId}`,
    traits: [
      // Data traits
      {
        id: 'GeoPosition' as TraitId,
        data: {
          _tag: 'GeoPosition',
          lon: result.position[0],
          lat: result.position[1],
        },
      },
      {
        id: 'ImageryData' as TraitId,
        data: {
          _tag: 'ImageryData',
          itemId: result.itemId,
          provider: result.provider,
          collection: result.collection,
          acquired: result.acquired,
          source: result.source,
        },
      },
      ...(result.cloudCover !== undefined || result.gsd !== undefined
        ? [
            {
              id: 'ImageryQuality' as TraitId,
              data: {
                _tag: 'ImageryQuality',
                cloudCoverPercent: result.cloudCover,
                gsdM: result.gsd,
              },
            },
          ]
        : []),
      ...(result.bbox !== undefined
        ? [
            {
              id: 'ImageryGeometry' as TraitId,
              data: {
                _tag: 'ImageryGeometry',
                bbox: result.bbox as [number, number, number, number],
              },
            },
          ]
        : []),
      ...(result.thumbnailUrl !== undefined || result.assetsUrl !== undefined
        ? [
            {
              id: 'ImageryAssets' as TraitId,
              data: {
                _tag: 'ImageryAssets',
                thumbnailUrl: result.thumbnailUrl,
                assetsUrl: result.assetsUrl,
              },
            },
          ]
        : []),
      ...(result.sunAzimuth !== undefined ||
      result.sunElevation !== undefined ||
      result.offNadir !== undefined
        ? [
            {
              id: 'ImagerySatellite' as TraitId,
              data: {
                _tag: 'ImagerySatellite',
                sunAzimuth: result.sunAzimuth,
                sunElevation: result.sunElevation,
                offNadir: result.offNadir,
              },
            },
          ]
        : []),
      // Source confidence
      {
        id: 'SourceConfidence' as TraitId,
        data: {
          _tag: 'SourceConfidence',
          primarySource: result.source,
          contributingSources: [],
          confidence: result.score,
          staleness: Date.now() - result.retrievedAt.getTime(),
          corroborated: false,
        },
      },
      {
        id: 'SourceTiming' as TraitId,
        data: {
          _tag: 'SourceTiming',
          retrievedAt: result.retrievedAt,
          sourceTimestamp: result.acquired,
          ttlMs: 604800000, // Imagery is static, 7d TTL
        },
      },
      // UI state (defaults)
      {
        id: 'UIState' as TraitId,
        data: {
          _tag: 'UIState',
          selected: false,
          hovered: false,
          expanded: false,
          highlighted: false,
          pinned: false,
          viewed: false,
        },
      },
      // Marker trait
      {
        id: 'IsImagery' as TraitId,
        data: { _tag: 'IsImagery' },
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Mapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a SearchResultItem to a Kori trait bundle.
 * Uses Effect.Match for exhaustive pattern matching on the _tag discriminator.
 */
export function mapSearchResultToTraits(result: SearchResultItem): TraitBundle {
  return Match.value(result).pipe(
    Match.tag('SearchResultFlight', mapFlightToTraits),
    Match.tag('SearchResultPoi', mapPoiToTraits),
    Match.tag('SearchResultWeather', mapWeatherToTraits),
    Match.tag('SearchResultTrack', mapTrackToTraits),
    Match.tag('SearchResultFeature', mapFeatureToTraits),
    Match.tag('SearchResultImagery', mapImageryToTraits),
    Match.exhaustive
  )
}

/**
 * Get the entity type from a SearchResultItem.
 */
export function getEntityType(result: SearchResultItem): GeointEntityType {
  return Match.value(result).pipe(
    Match.tag('SearchResultFlight', () => 'flight' as const),
    Match.tag('SearchResultPoi', () => 'poi' as const),
    Match.tag('SearchResultWeather', () => 'weather' as const),
    Match.tag('SearchResultTrack', () => 'track' as const),
    Match.tag('SearchResultFeature', () => 'feature' as const),
    Match.tag('SearchResultImagery', () => 'imagery' as const),
    Match.exhaustive
  )
}

/**
 * Get the display label for a SearchResultItem.
 */
export function getEntityLabel(result: SearchResultItem): string {
  return Match.value(result).pipe(
    Match.tag('SearchResultFlight', (r) => r.callsign || r.icao24),
    Match.tag('SearchResultPoi', (r) => r.name),
    Match.tag('SearchResultWeather', (r) => r.locationName),
    Match.tag('SearchResultTrack', (r) => r.label || r.trackId),
    Match.tag('SearchResultFeature', (r) => r.label || r.featureId),
    Match.tag('SearchResultImagery', (r) => r.label || `${r.provider}:${r.itemId}`),
    Match.exhaustive
  )
}

/**
 * Get the marker trait ID for a SearchResultItem type.
 */
export function getMarkerTraitId(result: SearchResultItem): TraitId {
  return Match.value(result).pipe(
    Match.tag('SearchResultFlight', () => 'IsFlight' as TraitId),
    Match.tag('SearchResultPoi', () => 'IsPoi' as TraitId),
    Match.tag('SearchResultWeather', () => 'IsWeather' as TraitId),
    Match.tag('SearchResultTrack', () => 'IsTrack' as TraitId),
    Match.tag('SearchResultFeature', () => 'IsFeature' as TraitId),
    Match.tag('SearchResultImagery', () => 'IsImagery' as TraitId),
    Match.exhaustive
  )
}

/**
 * Batch map multiple SearchResultItems to trait bundles.
 */
export function mapSearchResultsToTraits(
  results: ReadonlyArray<SearchResultItem>
): ReadonlyArray<TraitBundle> {
  return results.map(mapSearchResultToTraits)
}
