/**
 * Result Transformer Tests
 *
 * Critical Path tests for data integrity in GEOINT result transformers.
 * Tests wire format → domain type → SearchResult transformations.
 *
 * @module geoint/__tests__/transformers.test
 */

import { describe, it, expect } from 'vitest'
import {
  openSkyToSearchResult,
  overpassToSearchResult,
  adsbLolToSearchResult,
  planetItemToSearchResult,
  sentinelItemToSearchResult,
  weatherForecastToSearchResult,
  geocodingLocationToSearchResult,
} from '../api/ExternalApiClient'
import {
  OpenSkyStateVector,
  OverpassElement,
  AdsbLolAircraft,
  PlanetItem,
  SentinelItem,
  WeatherForecast,
  CurrentWeather,
  HourlyForecast,
  DailyForecast,
  GeocodingLocation,
} from '../schemas'

// =============================================================================
// Test Fixtures
// =============================================================================

const createOpenSkyState = (overrides: Partial<OpenSkyStateVector> = {}): OpenSkyStateVector =>
  new OpenSkyStateVector({
    icao24: 'abc123' as any,
    callsign: 'UAL123',
    originCountry: 'United States',
    timePosition: 1700000000,
    lastContact: 1700000000,
    longitude: -122.4194,
    latitude: 37.7749,
    baroAltitude: 10000,
    onGround: false,
    velocity: 250,
    trueTrack: 180,
    verticalRate: 5,
    sensors: null,
    geoAltitude: 10100,
    squawk: '1234',
    spi: false,
    positionSource: 0,
    category: 3, // heavy
    ...overrides,
  })

const createOverpassElement = (overrides: Partial<OverpassElement> = {}): OverpassElement =>
  new OverpassElement({
    type: 'node',
    id: 123456789,
    lat: 37.7749,
    lon: -122.4194,
    tags: {
      name: 'Test POI',
      amenity: 'restaurant',
    },
    ...overrides,
  })

const createAdsbLolAircraft = (overrides: Partial<AdsbLolAircraft> = {}): AdsbLolAircraft =>
  new AdsbLolAircraft({
    hex: 'ABC123',
    flight: 'UAL456  ', // Note: trailing spaces to test trim
    lat: 37.7749,
    lon: -122.4194,
    altitudeFt: 35000,
    onGround: false,
    groundSpeedKts: 450,
    trackDeg: 270,
    verticalRateFpm: 1000,
    category: 'C2', // heavy
    seenSec: 5,
    ...overrides,
  })

const createPlanetItem = (overrides: Partial<PlanetItem> = {}): PlanetItem =>
  new PlanetItem({
    id: 'planet-item-001',
    itemType: 'PSScene',
    acquired: new Date('2024-01-15T10:30:00Z'),
    published: new Date('2024-01-15T12:00:00Z'),
    cloudCover: 15,
    gsd: 3.7,
    sunAzimuth: 145,
    sunElevation: 55,
    viewAngle: 5,
    satelliteId: 'PSScene-001',
    provider: 'planetscope',
    qualityCategory: 'standard',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-122.5, 37.5],
        [-122.0, 37.5],
        [-122.0, 38.0],
        [-122.5, 38.0],
        [-122.5, 37.5],
      ]],
    },
    thumbnailUrl: 'https://example.com/thumb.png',
    assetsUrl: 'https://example.com/assets',
    permissions: ['assets.basic'],
    ...overrides,
  })

const createSentinelItem = (overrides: Partial<SentinelItem> = {}): SentinelItem =>
  new SentinelItem({
    id: 'S2A_MSIL1C_20240115',
    collection: 'sentinel-2-l1c',
    datetime: new Date('2024-01-15T10:30:00Z'),
    cloudCover: 10,
    productId: 'S2A_MSIL1C',
    dataCoverage: 95,
    platform: 'Sentinel-2A',
    constellation: 'sentinel-2',
    instruments: ['MSI'],
    epsg: 32610,
    sunAzimuth: 150,
    sunElevation: 52,
    offNadir: 3,
    gsd: 10,
    bbox: [-122.5, 37.5, -122.0, 38.0],
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-122.5, 37.5],
        [-122.0, 37.5],
        [-122.0, 38.0],
        [-122.5, 38.0],
        [-122.5, 37.5],
      ]],
    },
    ...overrides,
  })

const createWeatherForecast = (overrides: Partial<WeatherForecast> = {}): WeatherForecast =>
  new WeatherForecast({
    latitude: 37.7749,
    longitude: -122.4194,
    elevation: 10,
    timezone: 'America/Los_Angeles',
    timezoneAbbreviation: 'PST',
    current: new CurrentWeather({
      time: new Date('2024-01-15T12:00:00Z'),
      temperature: 15.5,
      feelsLike: 14.2,
      humidity: 65,
      precipitation: 0,
      weatherCode: 2, // Partly cloudy
      cloudCover: 40,
      pressure: 1013,
      windSpeed: 5.5,
      windDirection: 270,
      windGusts: 8.5,
      isDay: true,
    }),
    ...overrides,
  })

const createGeocodingLocation = (overrides: Partial<GeocodingLocation> = {}): GeocodingLocation =>
  new GeocodingLocation({
    id: 5391959,
    name: 'San Francisco',
    latitude: 37.7749,
    longitude: -122.4194,
    elevation: 16,
    country: 'United States',
    countryCode: 'US',
    admin1: 'California',
    timezone: 'America/Los_Angeles',
    population: 874961,
    ...overrides,
  })

// =============================================================================
// OpenSky Transformer Tests
// =============================================================================

describe('openSkyToSearchResult', () => {
  it('transforms valid state vector to SearchResultFlight', () => {
    const state = createOpenSkyState()
    const result = openSkyToSearchResult(state)

    expect(result).not.toBeNull()
    expect(result!._tag).toBe('SearchResultFlight')
    expect(result!.source).toBe('opensky')
    expect(result!.icao24).toBe('abc123')
    expect(result!.callsign).toBe('UAL123')
    expect(result!.position).toEqual([-122.4194, 37.7749, 10000])
    expect(result!.velocity).toBe(250)
    expect(result!.heading).toBe(180)
    expect(result!.verticalRate).toBe(5)
    expect(result!.onGround).toBe(false)
    expect(result!.category).toBe('heavy')
    expect(result!.originCountry).toBe('United States')
  })

  it('returns null for state without longitude', () => {
    const state = createOpenSkyState({ longitude: null })
    const result = openSkyToSearchResult(state)
    expect(result).toBeNull()
  })

  it('returns null for state without latitude', () => {
    const state = createOpenSkyState({ latitude: null })
    const result = openSkyToSearchResult(state)
    expect(result).toBeNull()
  })

  it('handles null callsign with empty string', () => {
    const state = createOpenSkyState({ callsign: null })
    const result = openSkyToSearchResult(state)
    expect(result).not.toBeNull()
    expect(result!.callsign).toBe('')
  })

  it('uses geoAltitude when baroAltitude is null', () => {
    const state = createOpenSkyState({ baroAltitude: null, geoAltitude: 9500 })
    const result = openSkyToSearchResult(state)
    expect(result).not.toBeNull()
    expect(result!.position[2]).toBe(9500)
  })

  it('defaults altitude to 0 when both are null', () => {
    const state = createOpenSkyState({ baroAltitude: null, geoAltitude: null })
    const result = openSkyToSearchResult(state)
    expect(result).not.toBeNull()
    expect(result!.position[2]).toBe(0)
  })

  it('handles null velocity/heading/verticalRate', () => {
    const state = createOpenSkyState({
      velocity: null,
      trueTrack: null,
      verticalRate: null,
    })
    const result = openSkyToSearchResult(state)
    expect(result).not.toBeNull()
    expect(result!.velocity).toBe(0)
    expect(result!.heading).toBe(0)
    expect(result!.verticalRate).toBe(0)
  })

  describe('aircraft category mapping', () => {
    const testCases: Array<{ category: number; expected: string }> = [
      { category: 1, expected: 'light' },
      { category: 2, expected: 'medium' },
      { category: 3, expected: 'heavy' },
      { category: 4, expected: 'super' },
      { category: 5, expected: 'heavy' },
      { category: 6, expected: 'heavy' },
      { category: 7, expected: 'rotorcraft' },
      { category: 8, expected: 'rotorcraft' },
      { category: 9, expected: 'glider' },
      { category: 10, expected: 'balloon' },
      { category: 11, expected: 'uav' },
      { category: 12, expected: 'uav' },
      { category: 13, expected: 'uav' },
      { category: 14, expected: 'uav' },
      { category: 15, expected: 'space' },
      { category: 16, expected: 'glider' },
      { category: 17, expected: 'unknown' },
      { category: 0, expected: 'unknown' },
      { category: 99, expected: 'unknown' },
    ]

    it.each(testCases)('maps category $category to $expected', ({ category, expected }) => {
      const state = createOpenSkyState({ category })
      const result = openSkyToSearchResult(state)
      expect(result).not.toBeNull()
      expect(result!.category).toBe(expected)
    })
  })

  it('converts lastContact timestamp to Date', () => {
    const state = createOpenSkyState({ lastContact: 1700000000 })
    const result = openSkyToSearchResult(state)
    expect(result).not.toBeNull()
    expect(result!.lastContact).toBeInstanceOf(Date)
    expect(result!.lastContact.getTime()).toBe(1700000000 * 1000)
  })
})

// =============================================================================
// Overpass Transformer Tests
// =============================================================================

describe('overpassToSearchResult', () => {
  it('transforms valid node to SearchResultPoi', () => {
    const element = createOverpassElement()
    const result = overpassToSearchResult(element)

    expect(result).not.toBeNull()
    expect(result!._tag).toBe('SearchResultPoi')
    expect(result!.source).toBe('osm')
    expect(result!.id).toBe('osm-node-123456789')
    expect(result!.poiId).toBe('node/123456789')
    expect(result!.position).toEqual([-122.4194, 37.7749])
    expect(result!.name).toBe('Test POI')
    expect(result!.category).toBe('amenity')
    expect(result!.tags).toEqual({ name: 'Test POI', amenity: 'restaurant' })
  })

  it('returns null for element without lat/lon', () => {
    const element = createOverpassElement({ lat: undefined, lon: undefined })
    const result = overpassToSearchResult(element)
    expect(result).toBeNull()
  })

  it('extracts position from center for way elements', () => {
    const element = createOverpassElement({
      type: 'way',
      lat: undefined,
      lon: undefined,
      center: { lat: 37.8, lon: -122.5 },
    })
    const result = overpassToSearchResult(element)
    expect(result).not.toBeNull()
    expect(result!.position).toEqual([-122.5, 37.8])
  })

  it('uses type/id as name when no name tag', () => {
    const element = createOverpassElement({
      tags: { amenity: 'hospital' }, // no name
    })
    const result = overpassToSearchResult(element)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('node/123456789')
  })

  it('uses ref tag as fallback name', () => {
    const element = createOverpassElement({
      tags: { ref: 'A123', highway: 'primary' },
    })
    const result = overpassToSearchResult(element)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('A123')
  })

  describe('category detection from tags', () => {
    const testCases: Array<{ tags: Record<string, string>; expected: string }> = [
      { tags: { amenity: 'hospital' }, expected: 'amenity' },
      { tags: { building: 'yes' }, expected: 'building' },
      { tags: { highway: 'primary' }, expected: 'highway' },
      { tags: { landuse: 'residential' }, expected: 'landuse' },
      { tags: { leisure: 'park' }, expected: 'leisure' },
      { tags: { natural: 'water' }, expected: 'natural' },
      { tags: { shop: 'supermarket' }, expected: 'shop' },
      { tags: { tourism: 'hotel' }, expected: 'tourism' },
      { tags: { aeroway: 'runway' }, expected: 'aeroway' },
      { tags: { military: 'base' }, expected: 'military' },
      { tags: { emergency: 'fire_station' }, expected: 'emergency' },
      { tags: { healthcare: 'hospital' }, expected: 'healthcare' },
      { tags: { office: 'government' }, expected: 'office' },
      { tags: { public_transport: 'station' }, expected: 'public_transport' },
      { tags: { unknown_tag: 'value' }, expected: 'amenity' }, // default
    ]

    it.each(testCases)('detects category from $tags', ({ tags, expected }) => {
      const element = createOverpassElement({ tags })
      const result = overpassToSearchResult(element)
      expect(result).not.toBeNull()
      expect(result!.category).toBe(expected)
    })
  })
})

// =============================================================================
// ADSB.lol Transformer Tests
// =============================================================================

describe('adsbLolToSearchResult', () => {
  it('transforms valid aircraft to SearchResultFlight', () => {
    const aircraft = createAdsbLolAircraft()
    const result = adsbLolToSearchResult(aircraft)

    expect(result).not.toBeNull()
    expect(result!._tag).toBe('SearchResultFlight')
    expect(result!.source).toBe('adsb-lol')
    expect(result!.id).toBe('adsb-abc123') // ID uses normalized lowercase icao24
    expect(result!.icao24).toBe('abc123') // lowercase
    expect(result!.callsign).toBe('UAL456') // trimmed
    expect(result!.onGround).toBe(false)
    expect(result!.originCountry).toBe('') // not provided by adsb.lol
  })

  it('returns null for aircraft without lat', () => {
    const aircraft = createAdsbLolAircraft({ lat: undefined })
    const result = adsbLolToSearchResult(aircraft)
    expect(result).toBeNull()
  })

  it('returns null for aircraft without lon', () => {
    const aircraft = createAdsbLolAircraft({ lon: undefined })
    const result = adsbLolToSearchResult(aircraft)
    expect(result).toBeNull()
  })

  it('converts altitude from feet to meters', () => {
    const aircraft = createAdsbLolAircraft({ altitudeFt: 30000 })
    const result = adsbLolToSearchResult(aircraft)
    expect(result).not.toBeNull()
    // 30000 ft * 0.3048 = 9144 m
    expect(result!.position[2]).toBeCloseTo(9144, 0)
  })

  it('converts ground speed from knots to m/s', () => {
    const aircraft = createAdsbLolAircraft({ groundSpeedKts: 400 })
    const result = adsbLolToSearchResult(aircraft)
    expect(result).not.toBeNull()
    // 400 kts * 0.514444 = ~205.78 m/s
    expect(result!.velocity).toBeCloseTo(205.78, 1)
  })

  it('converts vertical rate from fpm to m/s', () => {
    const aircraft = createAdsbLolAircraft({ verticalRateFpm: 2000 })
    const result = adsbLolToSearchResult(aircraft)
    expect(result).not.toBeNull()
    // 2000 fpm * 0.00508 = 10.16 m/s
    expect(result!.verticalRate).toBeCloseTo(10.16, 1)
  })

  it('handles undefined values with defaults', () => {
    const aircraft = createAdsbLolAircraft({
      altitudeFt: undefined,
      groundSpeedKts: undefined,
      verticalRateFpm: undefined,
      trackDeg: undefined,
      onGround: undefined,
    })
    const result = adsbLolToSearchResult(aircraft)
    expect(result).not.toBeNull()
    expect(result!.position[2]).toBe(0)
    expect(result!.velocity).toBe(0)
    expect(result!.verticalRate).toBe(0)
    expect(result!.heading).toBe(0)
    expect(result!.onGround).toBe(false)
  })

  it('handles undefined flight (callsign)', () => {
    const aircraft = createAdsbLolAircraft({ flight: undefined })
    const result = adsbLolToSearchResult(aircraft)
    expect(result).not.toBeNull()
    expect(result!.callsign).toBe('')
  })

  it('strips ~ prefix from MLAT-derived ICAO24', () => {
    // ADSB.lol uses ~ prefix for MLAT (multilateration) positions
    const aircraft = createAdsbLolAircraft({ hex: '~A993CB' })
    const result = adsbLolToSearchResult(aircraft)
    expect(result).not.toBeNull()
    expect(result!.icao24).toBe('a993cb') // prefix stripped and lowercased
    expect(result!.id).toBe('adsb-a993cb')
  })

  it('returns null for invalid ICAO24 format', () => {
    // ICAO24 must be exactly 6 hex characters after stripping ~
    const aircraft = createAdsbLolAircraft({ hex: 'XYZ' })
    const result = adsbLolToSearchResult(aircraft)
    expect(result).toBeNull()
  })

  it('returns null for too-short ICAO24', () => {
    const aircraft = createAdsbLolAircraft({ hex: '~A99' })
    const result = adsbLolToSearchResult(aircraft)
    expect(result).toBeNull() // Only 3 chars after stripping ~
  })

  describe('ADSB.lol category mapping', () => {
    const testCases: Array<{ category: string | undefined; expected: string }> = [
      { category: 'A1', expected: 'light' },
      { category: 'A7', expected: 'light' },
      { category: 'B0', expected: 'medium' },
      { category: 'B5', expected: 'medium' },
      { category: 'C2', expected: 'heavy' },
      { category: 'D3', expected: 'super' },
      { category: undefined, expected: 'unknown' },
      { category: 'X9', expected: 'unknown' },
      { category: '', expected: 'unknown' },
    ]

    it.each(testCases)('maps category $category to $expected', ({ category, expected }) => {
      const aircraft = createAdsbLolAircraft({ category })
      const result = adsbLolToSearchResult(aircraft)
      expect(result).not.toBeNull()
      expect(result!.category).toBe(expected)
    })
  })

  it('calculates lastContact from seenSec', () => {
    const now = Date.now()
    const aircraft = createAdsbLolAircraft({ seenSec: 10 })
    const result = adsbLolToSearchResult(aircraft)

    expect(result).not.toBeNull()
    // Should be approximately now - 10 seconds
    const diff = Math.abs(result!.lastContact.getTime() - (now - 10000))
    expect(diff).toBeLessThan(1000) // within 1 second tolerance
  })
})

// =============================================================================
// Planet Labs Transformer Tests
// =============================================================================

describe('planetItemToSearchResult', () => {
  it('transforms valid item to SearchResultFeature', () => {
    const item = createPlanetItem()
    const result = planetItemToSearchResult(item)

    expect(result).not.toBeNull()
    expect(result!._tag).toBe('SearchResultFeature')
    expect(result!.source).toBe('planet')
    expect(result!.id).toBe('planet-planet-item-001')
    expect(result!.featureId).toBe('planet-item-001')
    expect(result!.geometryType).toBe('Polygon')
    expect(result!.label).toContain('PSScene')
    expect(result!.label).toContain('2024-01-15')
  })

  it('extracts centroid from polygon geometry', () => {
    const item = createPlanetItem()
    const result = planetItemToSearchResult(item)

    expect(result).not.toBeNull()
    // Centroid of the test polygon
    const expectedLon = (-122.5 + -122.0 + -122.0 + -122.5 + -122.5) / 5
    const expectedLat = (37.5 + 37.5 + 38.0 + 38.0 + 37.5) / 5
    expect(result!.position[0]).toBeCloseTo(expectedLon, 2)
    expect(result!.position[1]).toBeCloseTo(expectedLat, 2)
  })

  it('returns null for item without valid geometry', () => {
    const item = createPlanetItem({ geometry: null })
    const result = planetItemToSearchResult(item)
    expect(result).toBeNull()
  })

  it('returns null for item with invalid geometry type', () => {
    const item = createPlanetItem({ geometry: { type: 'Unknown' } })
    const result = planetItemToSearchResult(item)
    expect(result).toBeNull()
  })

  it('extracts centroid from Point geometry', () => {
    const item = createPlanetItem({
      geometry: { type: 'Point', coordinates: [-122.4, 37.8] },
    })
    const result = planetItemToSearchResult(item)

    expect(result).not.toBeNull()
    expect(result!.position).toEqual([-122.4, 37.8])
    expect(result!.geometryType).toBe('Point')
  })

  it('extracts centroid from MultiPolygon geometry', () => {
    const item = createPlanetItem({
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[
            [-122.5, 37.5],
            [-122.0, 37.5],
            [-122.0, 38.0],
            [-122.5, 38.0],
            [-122.5, 37.5],
          ]],
        ],
      },
    })
    const result = planetItemToSearchResult(item)

    expect(result).not.toBeNull()
    expect(result!.geometryType).toBe('Polygon') // MultiPolygon → Polygon
  })

  it('includes all metadata in properties', () => {
    const item = createPlanetItem()
    const result = planetItemToSearchResult(item)

    expect(result).not.toBeNull()
    expect(result!.properties).toMatchObject({
      itemType: 'PSScene',
      cloudCover: 15,
      gsd: 3.7,
      sunAzimuth: 145,
      sunElevation: 55,
      viewAngle: 5,
      satelliteId: 'PSScene-001',
      provider: 'planetscope',
      qualityCategory: 'standard',
      thumbnailUrl: 'https://example.com/thumb.png',
      assetsUrl: 'https://example.com/assets',
    })
  })
})

// =============================================================================
// Sentinel Hub Transformer Tests
// =============================================================================

describe('sentinelItemToSearchResult', () => {
  it('transforms valid item to SearchResultFeature', () => {
    const item = createSentinelItem()
    const result = sentinelItemToSearchResult(item)

    expect(result).not.toBeNull()
    expect(result!._tag).toBe('SearchResultFeature')
    expect(result!.source).toBe('feature') // generic satellite imagery source
    expect(result!.id).toBe('sentinel-S2A_MSIL1C_20240115')
    expect(result!.featureId).toBe('S2A_MSIL1C_20240115')
    expect(result!.geometryType).toBe('Polygon')
    expect(result!.label).toContain('sentinel-2-l1c')
    expect(result!.label).toContain('2024-01-15')
  })

  it('returns null for item without valid geometry', () => {
    const item = createSentinelItem({ geometry: null })
    const result = sentinelItemToSearchResult(item)
    expect(result).toBeNull()
  })

  it('uses "Sentinel" as default collection name in label', () => {
    const item = createSentinelItem({ collection: undefined })
    const result = sentinelItemToSearchResult(item)

    expect(result).not.toBeNull()
    expect(result!.label).toContain('Sentinel')
    expect(result!.properties['name']).toContain('Sentinel')
  })

  it('includes all metadata in properties', () => {
    const item = createSentinelItem()
    const result = sentinelItemToSearchResult(item)

    expect(result).not.toBeNull()
    expect(result!.properties).toMatchObject({
      collection: 'sentinel-2-l1c',
      cloudCover: 10,
      productId: 'S2A_MSIL1C',
      dataCoverage: 95,
      platform: 'Sentinel-2A',
      constellation: 'sentinel-2',
      instruments: ['MSI'],
      epsg: 32610,
      sunAzimuth: 150,
      sunElevation: 52,
      offNadir: 3,
      gsd: 10,
      bbox: [-122.5, 37.5, -122.0, 38.0],
    })
  })
})

// =============================================================================
// Weather Transformer Tests
// =============================================================================

describe('weatherForecastToSearchResult', () => {
  it('transforms valid forecast to SearchResultWeather', () => {
    const forecast = createWeatherForecast()
    const result = weatherForecastToSearchResult(forecast, 'San Francisco')

    expect(result).not.toBeNull()
    expect(result!._tag).toBe('SearchResultWeather')
    expect(result!.source).toBe('openmeteo')
    expect(result!.locationName).toBe('San Francisco')
    expect(result!.position).toEqual([-122.4194, 37.7749])
    expect(result!.elevation).toBe(10)
    expect(result!.timezone).toBe('America/Los_Angeles')
    expect(result!.temperature).toBe(15.5)
    expect(result!.feelsLike).toBe(14.2)
    expect(result!.humidity).toBe(65)
    expect(result!.weatherCode).toBe(2)
    expect(result!.cloudCover).toBe(40)
    expect(result!.pressure).toBe(1013)
    expect(result!.windSpeed).toBe(5.5)
    expect(result!.windDirection).toBe(270)
    expect(result!.isDay).toBe(true)
  })

  it('returns null for forecast without current weather', () => {
    const forecast = createWeatherForecast({ current: undefined })
    const result = weatherForecastToSearchResult(forecast, 'Test')
    expect(result).toBeNull()
  })

  describe('WMO weather code descriptions', () => {
    const testCases: Array<{ code: number; expected: string }> = [
      { code: 0, expected: 'Clear sky' },
      { code: 1, expected: 'Mainly clear' },
      { code: 2, expected: 'Partly cloudy' },
      { code: 3, expected: 'Overcast' },
      { code: 45, expected: 'Fog' },
      { code: 48, expected: 'Depositing rime fog' },
      { code: 51, expected: 'Light drizzle' },
      { code: 53, expected: 'Moderate drizzle' },
      { code: 55, expected: 'Dense drizzle' },
      { code: 61, expected: 'Slight rain' },
      { code: 63, expected: 'Moderate rain' },
      { code: 65, expected: 'Heavy rain' },
      { code: 71, expected: 'Slight snow' },
      { code: 73, expected: 'Moderate snow' },
      { code: 75, expected: 'Heavy snow' },
      { code: 77, expected: 'Snow grains' },
      { code: 80, expected: 'Slight rain showers' },
      { code: 81, expected: 'Moderate rain showers' },
      { code: 82, expected: 'Violent rain showers' },
      { code: 85, expected: 'Slight snow showers' },
      { code: 86, expected: 'Heavy snow showers' },
      { code: 95, expected: 'Thunderstorm' },
      { code: 96, expected: 'Thunderstorm with slight hail' },
      { code: 99, expected: 'Thunderstorm with heavy hail' },
      { code: 999, expected: 'Weather code 999' }, // unknown code fallback
    ]

    it.each(testCases)('maps WMO code $code to "$expected"', ({ code, expected }) => {
      const forecast = createWeatherForecast({
        current: new CurrentWeather({
          time: new Date(),
          temperature: 20,
          weatherCode: code,
        }),
      })
      const result = weatherForecastToSearchResult(forecast, 'Test')

      expect(result).not.toBeNull()
      expect(result!.weatherDescription).toBe(expected)
    })
  })

  it('handles forecast with hourly data', () => {
    const forecast = createWeatherForecast({
      hourly: [
        new HourlyForecast({ time: new Date(), temperature: 15 }),
        new HourlyForecast({ time: new Date(), temperature: 16 }),
      ],
    })
    const result = weatherForecastToSearchResult(forecast, 'Test')

    expect(result).not.toBeNull()
    expect(result!.hasHourlyForecast).toBe(true)
  })

  it('handles forecast with daily data', () => {
    const forecast = createWeatherForecast({
      daily: [
        new DailyForecast({ date: new Date(), temperatureMax: 20 }),
        new DailyForecast({ date: new Date(), temperatureMax: 22 }),
      ],
    })
    const result = weatherForecastToSearchResult(forecast, 'Test')

    expect(result).not.toBeNull()
    expect(result!.hasDailyForecast).toBe(true)
  })

  it('generates unique ID from coordinates', () => {
    const forecast1 = createWeatherForecast()
    const forecast2 = createWeatherForecast({ latitude: 40.7128, longitude: -74.006 })

    const result1 = weatherForecastToSearchResult(forecast1, 'San Francisco')
    const result2 = weatherForecastToSearchResult(forecast2, 'New York')

    expect(result1!.id).not.toBe(result2!.id)
    expect(result1!.id).toContain('37.7749')
    expect(result1!.id).toContain('-122.4194')
  })
})

// =============================================================================
// Geocoding Location Transformer Tests
// =============================================================================

describe('geocodingLocationToSearchResult', () => {
  it('transforms valid location to SearchResultWeather placeholder', () => {
    const location = createGeocodingLocation()
    const result = geocodingLocationToSearchResult(location)

    expect(result).not.toBeNull()
    expect(result._tag).toBe('SearchResultWeather')
    expect(result.source).toBe('openmeteo')
    expect(result.locationName).toBe('San Francisco, United States')
    expect(result.position).toEqual([-122.4194, 37.7749])
    expect(result.elevation).toBe(16)
    expect(result.timezone).toBe('America/Los_Angeles')
  })

  it('has placeholder temperature of 0', () => {
    const location = createGeocodingLocation()
    const result = geocodingLocationToSearchResult(location)

    expect(result.temperature).toBe(0)
  })

  it('has hasHourlyForecast and hasDailyForecast as false', () => {
    const location = createGeocodingLocation()
    const result = geocodingLocationToSearchResult(location)

    expect(result.hasHourlyForecast).toBe(false)
    expect(result.hasDailyForecast).toBe(false)
  })

  it('handles location without country', () => {
    const location = createGeocodingLocation({ country: undefined })
    const result = geocodingLocationToSearchResult(location)

    expect(result.locationName).toBe('San Francisco')
  })

  it('generates unique ID from geocoding ID', () => {
    const location1 = createGeocodingLocation({ id: 12345 })
    const location2 = createGeocodingLocation({ id: 67890 })

    const result1 = geocodingLocationToSearchResult(location1)
    const result2 = geocodingLocationToSearchResult(location2)

    expect(result1.id).toBe('geocode-12345')
    expect(result2.id).toBe('geocode-67890')
    expect(result1.id).not.toBe(result2.id)
  })
})
