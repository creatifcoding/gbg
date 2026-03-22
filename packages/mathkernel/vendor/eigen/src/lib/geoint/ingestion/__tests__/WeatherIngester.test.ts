/**
 * WeatherIngester Unit Tests
 *
 * Tests for weather data ingestion service:
 * - Schema validation for configuration
 * - Transformer: weatherForecastToObservationInput
 * - Service configuration defaults
 * - Location grid generation
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option, Schema } from 'effect'
import {
  WeatherIngestionGrid,
  WeatherIngesterConfig,
  DEFAULT_WEATHER_INGESTION_GRID,
  DEFAULT_WEATHER_INGESTER_CONFIG,
  weatherForecastToObservationInput,
  weatherForecastToHourlyInputs,
  generateLocationId,
  generateGridPoints,
  wmoCodeToDescription,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
} from '../WeatherIngester'
import { WeatherForecast, CurrentWeather, HourlyForecast } from '../../schemas'

describe('WeatherIngester', () => {
  // ===========================================================================
  // Schema Tests
  // ===========================================================================

  describe('WeatherIngestionGrid schema', () => {
    it('decodes valid grid with all fields', () => {
      const input = {
        name: 'sf-bay-area',
        bounds: [-122.6, 37.3, -121.8, 37.9] as const,
        resolution: 0.1, // 0.1 degree grid (~11km)
        ttlMinutes: 30,
      }

      const result = Schema.decodeUnknownSync(WeatherIngestionGrid)(input)
      expect(result.name).toBe('sf-bay-area')
      expect(result.bounds).toEqual([-122.6, 37.3, -121.8, 37.9])
      expect(result.resolution).toBe(0.1)
      expect(result.ttlMinutes).toBe(30)
    })

    it('provides defaults for optional fields', () => {
      const input = {
        name: 'minimal-grid',
        bounds: [-123.0, 36.0, -121.0, 38.0] as const,
      }

      const result = Schema.decodeUnknownSync(WeatherIngestionGrid)(input)
      expect(result.resolution).toBe(0.25) // Default 0.25 degree
      expect(result.ttlMinutes).toBe(60) // Default 1 hour
    })

    it('rejects invalid bounds tuple', () => {
      const input = {
        name: 'bad-bounds',
        bounds: [-122.5, 37.0], // Only 2 values
      }

      expect(() => Schema.decodeUnknownSync(WeatherIngestionGrid)(input)).toThrow()
    })

    it('rejects negative resolution', () => {
      const input = {
        name: 'bad-resolution',
        bounds: [-122.5, 37.0, -122.0, 37.5] as const,
        resolution: -0.1,
      }

      expect(() => Schema.decodeUnknownSync(WeatherIngestionGrid)(input)).toThrow()
    })
  })

  describe('WeatherIngesterConfig schema', () => {
    it('decodes valid config with all fields', () => {
      const input = {
        grids: [{
          name: 'test-grid',
          bounds: [-122.5, 37.0, -122.0, 37.5] as const,
        }],
        intervalMs: 900000, // 15 minutes
        queryTimeoutMs: 30000,
        logIngestion: false,
        includeHourly: true,
        hourlyHours: 24,
      }

      const result = Schema.decodeUnknownSync(WeatherIngesterConfig)(input)
      expect(result.grids.length).toBe(1)
      expect(result.intervalMs).toBe(900000)
      expect(result.queryTimeoutMs).toBe(30000)
      expect(result.logIngestion).toBe(false)
      expect(result.includeHourly).toBe(true)
      expect(result.hourlyHours).toBe(24)
    })

    it('provides defaults for optional fields', () => {
      const input = {
        grids: [],
      }

      const result = Schema.decodeUnknownSync(WeatherIngesterConfig)(input)
      expect(result.intervalMs).toBe(300000) // 5 minutes
      expect(result.queryTimeoutMs).toBe(30000)
      expect(result.logIngestion).toBe(true)
      expect(result.includeHourly).toBe(false)
    })
  })

  // ===========================================================================
  // Default Configuration Tests
  // ===========================================================================

  describe('DEFAULT_WEATHER_INGESTION_GRID', () => {
    it('contains SF Bay Area grid', () => {
      expect(DEFAULT_WEATHER_INGESTION_GRID.length).toBeGreaterThan(0)
      const sfBayArea = DEFAULT_WEATHER_INGESTION_GRID.find(g => g.name === 'sf-bay-area')
      expect(sfBayArea).toBeDefined()
      expect(sfBayArea!.resolution).toBe(0.25)
    })
  })

  describe('DEFAULT_WEATHER_INGESTER_CONFIG', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_WEATHER_INGESTER_CONFIG.intervalMs).toBe(300000) // 5 minutes
      expect(DEFAULT_WEATHER_INGESTER_CONFIG.queryTimeoutMs).toBe(30000)
      expect(DEFAULT_WEATHER_INGESTER_CONFIG.logIngestion).toBe(true)
    })
  })

  // ===========================================================================
  // Location ID Generation
  // ===========================================================================

  describe('generateLocationId', () => {
    it('generates consistent IDs for same coordinates', () => {
      const id1 = generateLocationId(37.7749, -122.4194)
      const id2 = generateLocationId(37.7749, -122.4194)
      expect(id1).toBe(id2)
    })

    it('generates different IDs for different coordinates', () => {
      const id1 = generateLocationId(37.7749, -122.4194)
      const id2 = generateLocationId(37.8, -122.5)
      expect(id1).not.toBe(id2)
    })

    it('rounds coordinates to 4 decimal places for stability', () => {
      // Very close coordinates should produce different IDs
      const id1 = generateLocationId(37.77491234, -122.41941234)
      const id2 = generateLocationId(37.77499999, -122.41949999)
      // These should be different with high precision
      expect(id1).not.toBe(id2)
    })

    it('handles zero and negative coordinates', () => {
      const idZero = generateLocationId(0, 0)
      expect(idZero).toBeDefined()
      expect(typeof idZero).toBe('string')

      const idNegative = generateLocationId(-33.8688, 151.2093)
      expect(idNegative).toBeDefined()
    })
  })

  // ===========================================================================
  // Grid Point Generation
  // ===========================================================================

  describe('generateGridPoints', () => {
    it('generates correct number of points for grid', () => {
      const grid = {
        name: 'test',
        bounds: [-122.0, 37.0, -121.0, 38.0] as const,
        resolution: 0.5,
        ttlMinutes: 60,
      }
      const points = generateGridPoints(grid)

      // 1 degree / 0.5 resolution = 2 steps + 1 = 3 points per axis
      // 3 x 3 = 9 total points
      expect(points.length).toBe(9)
    })

    it('includes corner points', () => {
      const grid = {
        name: 'test',
        bounds: [-122.0, 37.0, -121.0, 38.0] as const,
        resolution: 1.0, // Large to get just corners
        ttlMinutes: 60,
      }
      const points = generateGridPoints(grid)

      // Should have 4 corner points with 1.0 resolution on 1x1 degree box
      expect(points.length).toBe(4)
      expect(points).toContainEqual({ lat: 37.0, lon: -122.0 })
      expect(points).toContainEqual({ lat: 37.0, lon: -121.0 })
      expect(points).toContainEqual({ lat: 38.0, lon: -122.0 })
      expect(points).toContainEqual({ lat: 38.0, lon: -121.0 })
    })

    it('respects resolution parameter', () => {
      const grid = {
        name: 'test',
        bounds: [0, 0, 1, 1] as const,
        resolution: 0.25,
        ttlMinutes: 60,
      }
      const points = generateGridPoints(grid)

      // 1 / 0.25 = 4 steps + 1 = 5 points per axis
      // 5 x 5 = 25 total points
      expect(points.length).toBe(25)
    })
  })

  // ===========================================================================
  // Transformer Tests
  // ===========================================================================

  describe('weatherForecastToObservationInput', () => {
    it('transforms current weather to observation input', () => {
      const forecast = new WeatherForecast({
        latitude: 37.7749,
        longitude: -122.4194,
        elevation: 10,
        timezone: 'America/Los_Angeles',
        timezoneAbbreviation: 'PST',
        current: new CurrentWeather({
          time: new Date('2024-01-15T12:00:00Z'),
          temperature: 15.5,
          feelsLike: 14.0,
          humidity: 65,
          weatherCode: 0,
          windSpeed: 5.5,
          windDirection: 180,
        }),
      })

      const result = weatherForecastToObservationInput(forecast, forecast, 60)

      expect(result).not.toBeNull()
      expect(result!._tag).toBe('WeatherObservationInput')
      expect(result!.latitude).toBe(37.7749)
      expect(result!.longitude).toBe(-122.4194)
      expect(Option.getOrNull(result!.temperature)).toBe(15.5)
      expect(Option.getOrNull(result!.humidity)).toBe(65)
      expect(Option.getOrNull(result!.windSpeed)).toBe(5.5)
    })

    it('returns null when no current weather data', () => {
      const forecast = new WeatherForecast({
        latitude: 37.7749,
        longitude: -122.4194,
        elevation: 10,
        timezone: 'America/Los_Angeles',
        timezoneAbbreviation: 'PST',
        // No current weather
      })

      const result = weatherForecastToObservationInput(forecast, forecast, 60)
      expect(result).toBeNull()
    })

    it('handles missing optional fields gracefully', () => {
      const forecast = new WeatherForecast({
        latitude: 37.7749,
        longitude: -122.4194,
        elevation: 10,
        timezone: 'America/Los_Angeles',
        timezoneAbbreviation: 'PST',
        current: new CurrentWeather({
          time: new Date('2024-01-15T12:00:00Z'),
          temperature: 15.5,
          // All other fields optional/undefined
        }),
      })

      const result = weatherForecastToObservationInput(forecast, forecast, 60)

      expect(result).not.toBeNull()
      expect(Option.getOrNull(result!.temperature)).toBe(15.5)
      expect(Option.isNone(result!.humidity)).toBe(true)
      expect(Option.isNone(result!.windSpeed)).toBe(true)
    })

    it('generates consistent location ID', () => {
      const forecast = new WeatherForecast({
        latitude: 37.7749,
        longitude: -122.4194,
        elevation: 10,
        timezone: 'America/Los_Angeles',
        timezoneAbbreviation: 'PST',
        current: new CurrentWeather({
          time: new Date('2024-01-15T12:00:00Z'),
          temperature: 15.5,
        }),
      })

      const result1 = weatherForecastToObservationInput(forecast, forecast, 60)
      const result2 = weatherForecastToObservationInput(forecast, forecast, 60)

      expect(result1!.locationId).toBe(result2!.locationId)
    })

    it('preserves raw API response', () => {
      const forecast = new WeatherForecast({
        latitude: 37.7749,
        longitude: -122.4194,
        elevation: 10,
        timezone: 'America/Los_Angeles',
        timezoneAbbreviation: 'PST',
        current: new CurrentWeather({
          time: new Date('2024-01-15T12:00:00Z'),
          temperature: 15.5,
        }),
      })

      const rawResponse = { ...forecast, extraField: 'preserved' }
      const result = weatherForecastToObservationInput(forecast, rawResponse, 60)

      expect(result!.raw).toEqual(rawResponse)
    })
  })

  describe('weatherForecastToHourlyInputs', () => {
    it('transforms hourly forecast to multiple observation inputs', () => {
      const hourlyData = Array.from({ length: 24 }, (_, i) => new HourlyForecast({
        time: new Date(`2024-01-15T${String(i).padStart(2, '0')}:00:00Z`),
        temperature: 10 + i,
        humidity: 50 + i,
      }))

      const forecast = new WeatherForecast({
        latitude: 37.7749,
        longitude: -122.4194,
        elevation: 10,
        timezone: 'America/Los_Angeles',
        timezoneAbbreviation: 'PST',
        hourly: hourlyData,
      })

      const results = weatherForecastToHourlyInputs(forecast, forecast, 60)

      expect(results.length).toBe(24)
      // Each observation has correct timestamp
      expect(results[0].time.getUTCHours()).toBe(0)
      expect(results[12].time.getUTCHours()).toBe(12)
    })

    it('returns empty array when no hourly data', () => {
      const forecast = new WeatherForecast({
        latitude: 37.7749,
        longitude: -122.4194,
        elevation: 10,
        timezone: 'America/Los_Angeles',
        timezoneAbbreviation: 'PST',
      })

      const results = weatherForecastToHourlyInputs(forecast, forecast, 60)
      expect(results).toEqual([])
    })
  })

  // ===========================================================================
  // WMO Weather Code Mapping
  // ===========================================================================

  describe('wmoCodeToDescription', () => {
    it('maps common codes correctly', () => {
      expect(wmoCodeToDescription(0)).toBe('Clear sky')
      expect(wmoCodeToDescription(1)).toBe('Mainly clear')
      expect(wmoCodeToDescription(61)).toBe('Slight rain')
      expect(wmoCodeToDescription(95)).toBe('Thunderstorm')
    })

    it('returns undefined for unknown codes', () => {
      expect(wmoCodeToDescription(999)).toBeUndefined()
    })
  })

  // ===========================================================================
  // Temperature Unit Conversion
  // ===========================================================================

  describe('temperature conversion utilities', () => {
    it('converts Celsius to Fahrenheit', () => {
      expect(celsiusToFahrenheit(0)).toBe(32)
      expect(celsiusToFahrenheit(100)).toBe(212)
      expect(celsiusToFahrenheit(-40)).toBe(-40)
    })

    it('converts Fahrenheit to Celsius', () => {
      expect(fahrenheitToCelsius(32)).toBe(0)
      expect(fahrenheitToCelsius(212)).toBe(100)
    })
  })
})

// ===========================================================================
// Integration Test Stubs (Implementation Pending)
// ===========================================================================

describe.skip('WeatherIngester Integration Tests', () => {
  // These tests will be enabled once full integration layer exists

  it('ingests weather for a single grid point', async () => {
    // Mock OpenMeteoClient
    // Mock WeatherRepository
    // Verify transformation and persistence
  })

  it('ingests weather for entire grid', async () => {
    // Verify all grid points are queried
    // Verify batch insert to repository
  })

  it('handles API errors gracefully', async () => {
    // Mock API failure
    // Verify error is logged, ingestion continues
  })

  it('respects rate limits', async () => {
    // Verify concurrent requests are bounded
  })

  it('starts and stops polling fiber', async () => {
    // Test lifecycle management
  })
})
