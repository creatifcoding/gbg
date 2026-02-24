/**
 * Weather Entity - Meteorological Observations
 *
 * Represents weather observations at a location.
 * Composes: Spatial, Temporal traits
 *
 * @module geoint/entities/weather
 */

import { Schema } from 'effect'
import { EntityId, EntityProvenance } from '@/lib/ecs'
import { SpatialTrait, TemporalTrait } from '../schemas/traits'

// =============================================================================
// Weather-Specific Schemas
// =============================================================================

/**
 * WMO Weather Interpretation Codes.
 */
export const WmoWeatherCode = Schema.Literal(
  0,   // Clear sky
  1,   // Mainly clear
  2,   // Partly cloudy
  3,   // Overcast
  45,  // Fog
  48,  // Depositing rime fog
  51,  // Light drizzle
  53,  // Moderate drizzle
  55,  // Dense drizzle
  61,  // Slight rain
  63,  // Moderate rain
  65,  // Heavy rain
  71,  // Slight snow
  73,  // Moderate snow
  75,  // Heavy snow
  80,  // Slight rain showers
  81,  // Moderate rain showers
  82,  // Violent rain showers
  95,  // Thunderstorm
  96,  // Thunderstorm with slight hail
  99   // Thunderstorm with heavy hail
).pipe(
  Schema.annotations({
    identifier: 'WmoWeatherCode',
    title: 'WMO Weather Code',
    description: 'WMO Weather Interpretation Code (0-99).',
  })
)
export type WmoWeatherCode = typeof WmoWeatherCode.Type

/**
 * Forecast type discriminator.
 */
export const ForecastType = Schema.Literal('current', 'hourly', 'daily').pipe(
  Schema.annotations({
    identifier: 'ForecastType',
    title: 'Forecast Type',
    description: 'Weather forecast granularity.',
  })
)
export type ForecastType = typeof ForecastType.Type

/**
 * Weather alert severity.
 */
export const AlertSeverity = Schema.Literal(
  'advisory',
  'watch',
  'warning',
  'extreme'
).pipe(
  Schema.annotations({
    identifier: 'AlertSeverity',
    title: 'Alert Severity',
    description: 'Weather alert severity level.',
  })
)
export type AlertSeverity = typeof AlertSeverity.Type

// =============================================================================
// Weather Entity
// =============================================================================

/**
 * Weather entity - meteorological observation at a location.
 */
export class WeatherEntity extends Schema.TaggedClass<WeatherEntity>()(
  'WeatherEntity',
  {
    // Base entity fields
    id: EntityId,
    entityType: Schema.Literal('weather'),
    provenance: EntityProvenance,
    metadata: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { default: () => ({}) }
    ),

    // Embedded traits
    spatial: SpatialTrait,
    temporal: TemporalTrait,

    // Weather-specific fields
    /** Location name/identifier. */
    locationName: Schema.String,
    /** Forecast type (current, hourly, daily). */
    forecastType: ForecastType,
    /** Temperature in Celsius. */
    temperature: Schema.Number,
    /** Feels-like temperature in Celsius. */
    feelsLike: Schema.optional(Schema.Number),
    /** Relative humidity (0-100%). */
    humidity: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
    /** Atmospheric pressure in hPa. */
    pressure: Schema.optional(Schema.Number),
    /** Wind speed in m/s. */
    windSpeed: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
    /** Wind direction in degrees (0-360). */
    windDirection: Schema.optional(Schema.Number.pipe(Schema.between(0, 360))),
    /** Wind gust speed in m/s. */
    windGust: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
    /** Cloud cover percentage (0-100%). */
    cloudCover: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
    /** Visibility in meters. */
    visibility: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
    /** WMO weather code. */
    weatherCode: Schema.optional(WmoWeatherCode),
    /** Weather description. */
    weatherDescription: Schema.optional(Schema.String),
    /** Precipitation in mm/h. */
    precipitation: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
    /** UV index. */
    uvIndex: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
    /** Has hourly forecast data available? */
    hasHourlyForecast: Schema.optionalWith(Schema.Boolean, { default: () => false }),
    /** Has daily forecast data available? */
    hasDailyForecast: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  },
  {
    identifier: 'WeatherEntity',
    title: 'Weather Entity',
    description: 'Meteorological observation. Weather fields embedded directly.',
  }
) {
  get displayLabel(): string {
    return this.locationName
  }

  hasPrecipitation(): boolean {
    return (this.precipitation ?? 0) > 0
  }

  isSevere(): boolean {
    return this.weatherCode === 95 || this.weatherCode === 96 || this.weatherCode === 99
  }

  toSummary(): string {
    return `${this.locationName} · ${this.temperature.toFixed(1)}°C`
  }
}
