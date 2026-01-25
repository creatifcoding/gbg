/**
 * GEOINT Weather Traits
 *
 * Trait definitions for weather observation entities from Open-Meteo.
 *
 * @module
 */

import { Schema } from 'effect'
import { defineTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'

// ─────────────────────────────────────────────────────────────────────────────
// Weather Data Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WeatherData trait - current weather conditions.
 *
 * Combined with GeoPosition for full state.
 */
export const WeatherData = defineTrait('WeatherData', {
  /** Location name */
  locationName: Schema.String,
  /** Timezone */
  timezone: Schema.optional(Schema.String),
  /** Elevation in meters */
  elevation: Schema.optional(Schema.Number),
  /** Temperature in Celsius */
  temperature: Schema.Number,
  /** Feels-like temperature in Celsius */
  feelsLike: Schema.optional(Schema.Number),
  /** Relative humidity (0-100) */
  humidity: Schema.optional(Schema.Number),
  /** WMO weather code */
  weatherCode: Schema.optional(Schema.Number),
  /** Weather description */
  weatherDescription: Schema.optional(Schema.String),
  /** Cloud cover percentage */
  cloudCover: Schema.optional(Schema.Number),
  /** Is daytime */
  isDay: Schema.optional(Schema.Boolean),
  /** Observation/forecast timestamp */
  forecastTime: Schema.DateFromSelf,
})
export type WeatherData = typeof WeatherData.Type

/**
 * WeatherWind trait - wind conditions.
 */
export const WeatherWind = defineTrait('WeatherWind', {
  /** Wind speed in m/s */
  windSpeed: Schema.optional(Schema.Number),
  /** Wind direction in degrees */
  windDirection: Schema.optional(Schema.Number),
  /** Wind gusts in m/s */
  windGusts: Schema.optional(Schema.Number),
})
export type WeatherWind = typeof WeatherWind.Type

/**
 * WeatherPrecipitation trait - precipitation data.
 */
export const WeatherPrecipitation = defineTrait('WeatherPrecipitation', {
  /** Precipitation in mm */
  precipitation: Schema.optional(Schema.Number),
  /** Precipitation probability (0-100) */
  precipitationProbability: Schema.optional(Schema.Number),
  /** Rain in mm */
  rain: Schema.optional(Schema.Number),
  /** Snow in cm */
  snow: Schema.optional(Schema.Number),
})
export type WeatherPrecipitation = typeof WeatherPrecipitation.Type

/**
 * WeatherAtmospheric trait - atmospheric conditions.
 */
export const WeatherAtmospheric = defineTrait('WeatherAtmospheric', {
  /** Atmospheric pressure in hPa */
  pressure: Schema.optional(Schema.Number),
  /** Visibility in meters */
  visibility: Schema.optional(Schema.Number),
  /** UV index */
  uvIndex: Schema.optional(Schema.Number),
})
export type WeatherAtmospheric = typeof WeatherAtmospheric.Type

/**
 * WeatherForecastMeta trait - forecast availability.
 */
export const WeatherForecastMeta = defineTrait('WeatherForecastMeta', {
  /** Has hourly forecast data */
  hasHourlyForecast: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Has daily forecast data */
  hasDailyForecast: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type WeatherForecastMeta = typeof WeatherForecastMeta.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

registerTrait('WeatherData' as TraitId, WeatherData)
registerTrait('WeatherWind' as TraitId, WeatherWind)
registerTrait('WeatherPrecipitation' as TraitId, WeatherPrecipitation)
registerTrait('WeatherAtmospheric' as TraitId, WeatherAtmospheric)
registerTrait('WeatherForecastMeta' as TraitId, WeatherForecastMeta)
