/**
 * Schema Transform Testbed
 *
 * Demonstrates Effect Schema.transform patterns for external API integration:
 * - Wire format → Domain type transformations
 * - Branded types and validation
 * - TaggedClass construction
 * - Weather and Imagery search results
 *
 * Route: /testbed/schema-transform
 *
 * HYPOTHESES:
 * - H1: Schema.transform decodes wire format to domain type
 * - H2: Branded types enforce runtime validation
 * - H3: TaggedClass provides discriminated unions
 * - H4: Weather search results validate correctly
 * - H5: Transform errors provide useful messages
 *
 * @module testbed/schema-transform
 */

import { useEffect, useState, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Cloud,
  Plane,
  Sun,
  ThermometerSun,
} from 'lucide-react'
import { Schema, Effect, Either } from 'effect'

import { SectionLabel } from '@/components/testbed/shared'

// Import wire format and domain schemas
import {
  // ADSB.lol
  AdsbLolAircraftFromApi,
  AdsbLolAircraft,
  AdsbLolAircraftSchema,
  // Weather
  CurrentWeatherFromApi,
  CurrentWeather,
  CurrentWeatherSchema,
  OpenMeteoForecastFromApi,
  WeatherForecast,
  WeatherForecastSchema,
  // Search results
  SearchResultWeather,
  SearchResultImagery,
  type SearchResultId,
} from '@/lib/geoint/schemas'

// =============================================================================
// Hypotheses Tracking
// =============================================================================

interface Hypotheses {
  h1_transformDecode: boolean
  h2_brandedTypes: boolean
  h3_taggedClass: boolean
  h4_weatherResults: boolean
  h5_transformErrors: boolean
}

const initialHypotheses: Hypotheses = {
  h1_transformDecode: false,
  h2_brandedTypes: false,
  h3_taggedClass: false,
  h4_weatherResults: false,
  h5_transformErrors: false,
}

// =============================================================================
// Mock Wire Format Data
// =============================================================================

/**
 * Mock ADSB.lol API response (wire format)
 */
const mockAdsbLolWire: typeof AdsbLolAircraftFromApi.Type = {
  hex: 'a12345',
  flight: 'UAL123  ',
  r: 'N12345',
  t: 'B738',
  desc: 'BOEING 737-800',
  dbFlags: 1, // Military flag
  lat: 37.7749,
  lon: -122.4194,
  alt_baro: 35000,
  alt_geom: 35100,
  gs: 450.5,
  ias: null,
  tas: null,
  mach: null,
  track: 180.5,
  baro_rate: -500,
  geom_rate: null,
  squawk: '7700',
  emergency: 'none',
  category: 'A3',
  nav_modes: null,
  seen: 1.5,
  seen_pos: null,
  rssi: null,
  alert: null,
  spi: null,
  wake: null,
  version: null,
  nic: null,
  nac_p: null,
  nac_v: null,
  sil: null,
  sil_type: null,
  gva: null,
  sda: null,
  messages: null,
}

/**
 * Mock current weather API response (wire format)
 */
const mockCurrentWeatherWire: typeof CurrentWeatherFromApi.Type = {
  time: '2025-01-10T12:00',
  interval: 900,
  temperature_2m: 18.5,
  relative_humidity_2m: 65,
  apparent_temperature: 17.2,
  is_day: 1,
  precipitation: 0.0,
  rain: 0.0,
  showers: 0.0,
  snowfall: 0.0,
  weather_code: 2, // Partly cloudy
  cloud_cover: 40,
  pressure_msl: 1015.5,
  surface_pressure: 1013.0,
  wind_speed_10m: 5.5,
  wind_direction_10m: 270,
  wind_gusts_10m: 12.0,
}

/**
 * Mock forecast API response (wire format) - minimal for testing
 */
const mockForecastWire: typeof OpenMeteoForecastFromApi.Type = {
  latitude: 37.7749,
  longitude: -122.4194,
  generationtime_ms: 0.5,
  utc_offset_seconds: -28800,
  timezone: 'America/Los_Angeles',
  timezone_abbreviation: 'PST',
  elevation: 10,
  current: mockCurrentWeatherWire,
  hourly: null,
  daily: null,
}

/**
 * Mock invalid wire data (for error testing)
 */
const mockInvalidWire = {
  hex: 'invalid-too-long', // Invalid: should be 6 hex chars
  flight: 'TEST',
  lat: 37.7749,
  lon: -122.4194,
}

// =============================================================================
// Transform Result Display
// =============================================================================

interface TransformResult<T> {
  success: boolean
  data?: T
  error?: string
  wireFormat: unknown
  domainType: string
}

function TransformCard<T>({ result, onExpand }: { result: TransformResult<T>; onExpand?: () => void }) {
  return (
    <div
      className={`bg-[var(--tmnl-surface-raised)] rounded-lg p-4 border-l-4 ${
        result.success
          ? 'border-[var(--tmnl-status-success)]'
          : 'border-[var(--tmnl-status-error)]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {result.success ? (
            <CheckCircle2 size={16} className="text-[var(--tmnl-status-success)]" />
          ) : (
            <AlertCircle size={16} className="text-[var(--tmnl-status-error)]" />
          )}
          <span
            className="font-mono text-[var(--tmnl-text-primary)]"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {result.domainType}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-xs font-mono ${
            result.success
              ? 'bg-[var(--tmnl-status-success)]/20 text-[var(--tmnl-status-success)]'
              : 'bg-[var(--tmnl-status-error)]/20 text-[var(--tmnl-status-error)]'
          }`}
        >
          {result.success ? 'DECODED' : 'ERROR'}
        </span>
      </div>

      {result.success && result.data ? (
        <div className="space-y-2">
          <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Domain Fields:
          </div>
          <pre
            className="bg-[var(--tmnl-surface-sunken)] rounded p-2 overflow-x-auto text-[var(--tmnl-accent-cyan)]"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="text-[var(--tmnl-status-error)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {result.error}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Hypothesis Indicator
// =============================================================================

function HypothesisIndicator({ id, validated }: { id: string; validated: boolean }) {
  return (
    <div className="flex items-center gap-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
      <div
        className={`w-2 h-2 rounded-full ${validated ? 'bg-[var(--tmnl-status-success)]' : 'bg-[var(--tmnl-surface-sunken)]'}`}
      />
      <span className={validated ? 'text-[var(--tmnl-text-primary)]' : 'text-[var(--tmnl-text-muted)]'}>
        {id}
      </span>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function SchemaTransformTestbed() {
  // Transform results
  const [adsbResult, setAdsbResult] = useState<TransformResult<AdsbLolAircraft> | null>(null)
  const [weatherResult, setWeatherResult] = useState<TransformResult<CurrentWeather> | null>(null)
  const [forecastResult, setForecastResult] = useState<TransformResult<WeatherForecast> | null>(null)
  const [errorResult, setErrorResult] = useState<TransformResult<unknown> | null>(null)
  const [searchWeatherResult, setSearchWeatherResult] = useState<TransformResult<SearchResultWeather> | null>(null)
  const [searchImageryResult, setSearchImageryResult] = useState<TransformResult<SearchResultImagery> | null>(null)

  // Hypotheses
  const [hypotheses, setHypotheses] = useState<Hypotheses>(initialHypotheses)

  // Logs
  const [logs, setLogs] = useState<string[]>([])
  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Run ADSB.lol transform
  const runAdsbTransform = useCallback(() => {
    log('Transforming ADSB.lol wire format...')

    const decoded = Schema.decodeUnknownEither(AdsbLolAircraftSchema)(mockAdsbLolWire)

    if (Either.isRight(decoded)) {
      const aircraft = decoded.right
      log(`✓ Decoded: ${aircraft.hex} (${aircraft.flight?.trim() || 'N/A'})`)
      setAdsbResult({
        success: true,
        data: aircraft,
        wireFormat: mockAdsbLolWire,
        domainType: 'AdsbLolAircraft',
      })
      setHypotheses((h) => ({ ...h, h1_transformDecode: true, h3_taggedClass: true }))
    } else {
      const error = String(decoded.left)
      log(`✗ Decode failed: ${error}`)
      setAdsbResult({
        success: false,
        error,
        wireFormat: mockAdsbLolWire,
        domainType: 'AdsbLolAircraft',
      })
    }
  }, [log])

  // Run Weather transform
  const runWeatherTransform = useCallback(() => {
    log('Transforming CurrentWeather wire format...')

    const decoded = Schema.decodeUnknownEither(CurrentWeatherSchema)(mockCurrentWeatherWire)

    if (Either.isRight(decoded)) {
      const weather = decoded.right
      log(`✓ Decoded: ${weather.temperature}°C, ${weather.cloudCover ?? 0}% clouds`)
      setWeatherResult({
        success: true,
        data: weather,
        wireFormat: mockCurrentWeatherWire,
        domainType: 'CurrentWeather',
      })
      setHypotheses((h) => ({ ...h, h1_transformDecode: true }))
    } else {
      const error = String(decoded.left)
      log(`✗ Decode failed: ${error}`)
      setWeatherResult({
        success: false,
        error,
        wireFormat: mockCurrentWeatherWire,
        domainType: 'CurrentWeather',
      })
    }
  }, [log])

  // Run Forecast transform (nested)
  const runForecastTransform = useCallback(() => {
    log('Transforming WeatherForecast wire format...')

    const decoded = Schema.decodeUnknownEither(WeatherForecastSchema)(mockForecastWire)

    if (Either.isRight(decoded)) {
      const forecast = decoded.right
      log(`✓ Decoded: ${forecast.timezone}, current=${forecast.current ? 'yes' : 'no'}`)
      setForecastResult({
        success: true,
        data: forecast,
        wireFormat: mockForecastWire,
        domainType: 'WeatherForecast',
      })
      setHypotheses((h) => ({ ...h, h1_transformDecode: true }))
    } else {
      const error = String(decoded.left)
      log(`✗ Decode failed: ${error}`)
      setForecastResult({
        success: false,
        error,
        wireFormat: mockForecastWire,
        domainType: 'WeatherForecast',
      })
    }
  }, [log])

  // Test error handling
  const runErrorTest = useCallback(() => {
    log('Testing transform error handling...')

    // This should fail because hex is not 6 chars
    const decoded = Schema.decodeUnknownEither(AdsbLolAircraftFromApi)(mockInvalidWire)

    if (Either.isLeft(decoded)) {
      const error = String(decoded.left)
      log(`✓ Error caught correctly: ${error.slice(0, 50)}...`)
      setErrorResult({
        success: false,
        error: error.slice(0, 200),
        wireFormat: mockInvalidWire,
        domainType: 'AdsbLolAircraftFromApi',
      })
      setHypotheses((h) => ({ ...h, h5_transformErrors: true }))
    } else {
      log(`✗ Unexpected success - validation should have failed`)
      setErrorResult({
        success: true,
        data: decoded.right,
        wireFormat: mockInvalidWire,
        domainType: 'AdsbLolAircraftFromApi',
      })
    }
  }, [log])

  // Generate SearchResultWeather
  const runSearchWeatherTest = useCallback(() => {
    log('Creating SearchResultWeather with Schema validation...')

    try {
      const now = new Date()
      const result = new SearchResultWeather({
        id: `weather-result-${Date.now()}` as SearchResultId,
        source: 'openmeteo',
        score: 0.95,
        retrievedAt: now,
        locationName: 'San Francisco, CA',
        position: [-122.4194, 37.7749],
        elevation: 10,
        timezone: 'America/Los_Angeles',
        temperature: 18.5,
        feelsLike: 17.2,
        humidity: 65,
        weatherCode: 2,
        weatherDescription: 'Partly Cloudy',
        windSpeed: 5.5,
        windDirection: 270,
        cloudCover: 40,
        precipitation: 0,
        pressure: 1015.5,
        uvIndex: 3,
        isDay: true,
        forecastTime: now,
        hasHourlyForecast: true,
        hasDailyForecast: true,
      })

      log(`✓ Created SearchResultWeather: ${result.locationName}`)
      setSearchWeatherResult({
        success: true,
        data: result,
        wireFormat: 'N/A - constructed directly',
        domainType: 'SearchResultWeather',
      })
      setHypotheses((h) => ({ ...h, h4_weatherResults: true, h3_taggedClass: true }))
    } catch (e) {
      const error = String(e)
      log(`✗ Construction failed: ${error}`)
      setSearchWeatherResult({
        success: false,
        error,
        wireFormat: 'N/A',
        domainType: 'SearchResultWeather',
      })
    }
  }, [log])

  // Generate SearchResultImagery
  const runSearchImageryTest = useCallback(() => {
    log('Creating SearchResultImagery with Schema validation...')

    try {
      const now = new Date()
      const result = new SearchResultImagery({
        id: `imagery-result-${Date.now()}` as SearchResultId,
        source: 'planet',
        score: 0.88,
        retrievedAt: now,
        itemId: 'PSScene_20250110_123456_001',
        provider: 'planet',
        collection: 'PSScene',
        position: [-122.4194, 37.7749],
        acquired: new Date(now.getTime() - 86400000), // Yesterday
        cloudCover: 5,
        gsd: 3.7,
        sunAzimuth: 145.5,
        sunElevation: 42.3,
        offNadir: 2.1,
        bbox: [-122.5, 37.7, -122.3, 37.85],
        thumbnailUrl: 'https://example.com/thumb.png',
        assetsUrl: 'https://api.planet.com/assets/123',
        label: 'SF Bay Area PSScene',
      })

      log(`✓ Created SearchResultImagery: ${result.collection}`)
      setSearchImageryResult({
        success: true,
        data: result,
        wireFormat: 'N/A - constructed directly',
        domainType: 'SearchResultImagery',
      })
      setHypotheses((h) => ({ ...h, h3_taggedClass: true }))
    } catch (e) {
      const error = String(e)
      log(`✗ Construction failed: ${error}`)
      setSearchImageryResult({
        success: false,
        error,
        wireFormat: 'N/A',
        domainType: 'SearchResultImagery',
      })
    }
  }, [log])

  // Run all transforms
  const runAllTransforms = useCallback(() => {
    log('Running all transforms...')
    runAdsbTransform()
    runWeatherTransform()
    runForecastTransform()
    runErrorTest()
    runSearchWeatherTest()
    runSearchImageryTest()
  }, [runAdsbTransform, runWeatherTransform, runForecastTransform, runErrorTest, runSearchWeatherTest, runSearchImageryTest, log])

  // Validate branded types on mount
  useEffect(() => {
    // Test Icao24 branded type validation
    const validIcao = Schema.decodeUnknownEither(Schema.String.pipe(Schema.pattern(/^[0-9a-f]{6}$/i)))('a12345')
    if (Either.isRight(validIcao)) {
      setHypotheses((h) => ({ ...h, h2_brandedTypes: true }))
    }
  }, [])

  return (
    <div className="min-h-screen bg-[var(--tmnl-surface-base)] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-[var(--tmnl-text-secondary)] hover:text-[var(--tmnl-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Back</span>
        </Link>
        <h1 className="font-mono font-bold text-[var(--tmnl-text-primary)]" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>
          Schema Transform Testbed
        </h1>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Column 1: Controls */}
        <div className="space-y-4">
          <SectionLabel>Controls</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <button
              onClick={runAllTransforms}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-[var(--tmnl-accent-cyan)] text-black font-mono"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <Play size={14} />
              Run All Transforms
            </button>

            <div className="border-t border-[var(--tmnl-surface-base)] pt-3 space-y-2">
              <button
                onClick={runAdsbTransform}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-primary)] font-mono hover:bg-[var(--tmnl-surface-base)]"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <Plane size={12} />
                ADSB.lol Transform
              </button>

              <button
                onClick={runWeatherTransform}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-primary)] font-mono hover:bg-[var(--tmnl-surface-base)]"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <ThermometerSun size={12} />
                Weather Transform
              </button>

              <button
                onClick={runForecastTransform}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-primary)] font-mono hover:bg-[var(--tmnl-surface-base)]"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <Cloud size={12} />
                Forecast Transform
              </button>

              <button
                onClick={runSearchWeatherTest}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-primary)] font-mono hover:bg-[var(--tmnl-surface-base)]"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <Sun size={12} />
                SearchResultWeather
              </button>

              <button
                onClick={runErrorTest}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[var(--tmnl-status-error)]/20 text-[var(--tmnl-status-error)] font-mono hover:bg-[var(--tmnl-status-error)]/30"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <AlertCircle size={12} />
                Test Error Handling
              </button>
            </div>
          </div>

          <SectionLabel>Pattern Notes</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 text-[var(--tmnl-text-muted)] space-y-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <p><strong className="text-[var(--tmnl-text-primary)]">Schema.transform:</strong> Wire → Domain mapping</p>
            <p><strong className="text-[var(--tmnl-text-primary)]">Schema.brand:</strong> Icao24, SearchResultId</p>
            <p><strong className="text-[var(--tmnl-text-primary)]">TaggedClass:</strong> _tag discriminator</p>
            <p><strong className="text-[var(--tmnl-text-primary)]">decodeUnknown:</strong> Runtime validation</p>
            <p><strong className="text-[var(--tmnl-accent-amber)]">NullishOr:</strong> Wire null handling</p>
          </div>
        </div>

        {/* Column 2-3: Transform Results */}
        <div className="col-span-2 space-y-4">
          <SectionLabel>Transform Results</SectionLabel>
          <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
            {adsbResult && <TransformCard result={adsbResult} />}
            {weatherResult && <TransformCard result={weatherResult} />}
            {forecastResult && <TransformCard result={forecastResult} />}
            {searchWeatherResult && <TransformCard result={searchWeatherResult} />}
            {searchImageryResult && <TransformCard result={searchImageryResult} />}
            {errorResult && <TransformCard result={errorResult} />}

            {!adsbResult && !weatherResult && !forecastResult && !errorResult && !searchWeatherResult && !searchImageryResult && (
              <div className="text-center text-[var(--tmnl-text-muted)] py-12" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                Click "Run All Transforms" to test Schema.transform patterns
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Hypotheses & Logs */}
        <div className="space-y-4">
          <SectionLabel>Hypotheses</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            <HypothesisIndicator id="H1: transform decodes wire" validated={hypotheses.h1_transformDecode} />
            <HypothesisIndicator id="H2: branded types validate" validated={hypotheses.h2_brandedTypes} />
            <HypothesisIndicator id="H3: TaggedClass works" validated={hypotheses.h3_taggedClass} />
            <HypothesisIndicator id="H4: Weather results valid" validated={hypotheses.h4_weatherResults} />
            <HypothesisIndicator id="H5: Errors informative" validated={hypotheses.h5_transformErrors} />
          </div>

          <SectionLabel>Logs</SectionLabel>
          <div className="bg-[var(--tmnl-surface-sunken)] rounded-lg p-3 h-64 overflow-y-auto font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {logs.map((entry, i) => (
              <div key={i} className="text-[var(--tmnl-text-muted)]">{entry}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SchemaTransformTestbed
