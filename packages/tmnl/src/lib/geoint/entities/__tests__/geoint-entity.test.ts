import { describe, expect, it } from 'vitest'
import {
  SearchResultFlight,
  SearchResultPoi,
  SearchResultTrack,
  SearchResultWeather,
  SearchResultFeature,
  SearchResultImagery,
} from '../../schemas/search'
import {
  GeointEntity,
  getEntityDisplayLabel,
  isFeatureEntity,
  isFlightEntity,
  isImageryEntity,
  isPoiEntity,
  isTrackEntity,
  isWeatherEntity,
} from '../index'

describe('GeointEntity.fromSearchResult', () => {
  it('builds FlightEntity with class methods', () => {
    const result = new SearchResultFlight({
      id: 'sr-flight-1' as any,
      source: 'opensky',
      score: 0.91,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      icao24: 'a1b2c3' as any,
      callsign: 'TMNL123',
      position: [10, 20, 1200],
      velocity: 205,
      heading: 90,
      verticalRate: 1.5,
      onGround: false,
      category: 'medium',
      originCountry: 'US',
      lastContact: new Date('2026-01-01T09:59:50Z'),
    })

    const entity = GeointEntity.fromSearchResult(result)

    expect(isFlightEntity(entity)).toBe(true)
    if (!isFlightEntity(entity)) throw new Error('expected FlightEntity')

    expect(entity.id.startsWith('flight-')).toBe(true)
    expect(entity.displayLabel).toBe('TMNL123')
    expect(entity.isAirborne()).toBe(true)
    expect(entity.toSummary()).toContain('airborne')
    expect(getEntityDisplayLabel(entity)).toBe('TMNL123')
  })

  it('builds PoiEntity / TrackEntity / WeatherEntity / ImageryEntity / FeatureEntity', () => {
    const poi = GeointEntity.fromSearchResult(new SearchResultPoi({
      id: 'sr-poi-1' as any,
      source: 'osm',
      score: 0.8,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      poiId: 'poi-1' as any,
      position: [30, 40],
      name: 'Harbor Cafe',
      category: 'amenity',
      tags: { amenity: 'cafe' },
    }))

    const track = GeointEntity.fromSearchResult(new SearchResultTrack({
      id: 'sr-track-1' as any,
      source: 'track',
      score: 0.77,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      trackId: 'trk-11' as any,
      position: [50, 60, 100],
      heading: 30,
      speed: 20,
      classification: 'unknown',
      objectType: 'vehicle',
      label: 'Blue Sedan',
    }))

    const weather = GeointEntity.fromSearchResult(new SearchResultWeather({
      id: 'sr-weather-1' as any,
      source: 'weather',
      score: 0.66,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      locationName: 'Boston',
      position: [-71.06, 42.36],
      temperature: 7,
      weatherCode: 95,
      forecastTime: new Date('2026-01-01T10:05:00Z'),
    }))

    const imagery = GeointEntity.fromSearchResult(new SearchResultImagery({
      id: 'sr-img-1' as any,
      source: 'planet',
      score: 0.88,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      itemId: 'item-99',
      provider: 'planet',
      collection: 'PSScene',
      position: [12, 13],
      acquired: new Date('2025-12-31T18:00:00Z'),
      cloudCover: 12,
    }))

    const feature = GeointEntity.fromSearchResult(new SearchResultFeature({
      id: 'sr-feature-1' as any,
      source: 'feature',
      score: 0.7,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      featureId: 'feat-7' as any,
      position: [1, 2],
      geometryType: 'Polygon',
      properties: { zone: 'A' },
      label: 'Restricted Zone',
    }))

    expect(isPoiEntity(poi)).toBe(true)
    expect(isTrackEntity(track)).toBe(true)
    expect(isWeatherEntity(weather)).toBe(true)
    expect(isImageryEntity(imagery)).toBe(true)
    expect(isFeatureEntity(feature)).toBe(true)

    if (isPoiEntity(poi)) expect(poi.toSummary()).toContain('amenity')
    if (isTrackEntity(track)) expect(track.isLive(new Date('2026-01-01T10:01:00Z'))).toBe(true)
    if (isWeatherEntity(weather)) expect(weather.isSevere()).toBe(true)
    if (isImageryEntity(imagery)) expect(imagery.isClearScene()).toBe(true)
    if (isFeatureEntity(feature)) expect(feature.isAreaFeature()).toBe(true)
  })
})
