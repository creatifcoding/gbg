/**
 * Weather Position Event Schema
 *
 * Event type for weather observations published to DurableStream.
 * Used by WeatherIngester for transactional outbox pattern.
 *
 * @module geoint/schemas/weather-events
 */

import { Schema } from 'effect'

// =============================================================================
// Source Enum
// =============================================================================

/**
 * Weather data source for provenance tracking.
 */
export const WeatherSource = Schema.Literal('openmeteo', 'noaa', 'custom')
export type WeatherSource = typeof WeatherSource.Type

// =============================================================================
// Weather Observation Event
// =============================================================================

/**
 * Weather observation event for DurableStream publishing.
 *
 * Published by WeatherIngester after successful database upsert.
 * Consumed by WeatherEntityMaterializer to create ECS entities.
 */
export class WeatherObservationEvent extends Schema.TaggedClass<WeatherObservationEvent>()(
  'WeatherObservationEvent',
  {
    /** Stable location identifier (lon_lat format with 4 decimal places) */
    locationId: Schema.String,
    /** Data source for provenance */
    source: WeatherSource,
    /** Observation coordinates [longitude, latitude] */
    position: Schema.Tuple(Schema.Number, Schema.Number),
    /** Observation timestamp */
    observedAt: Schema.DateFromSelf,
    /** Temperature in Celsius */
    temperature: Schema.optional(Schema.Number),
    /** Feels like temperature in Celsius */
    feelsLike: Schema.optional(Schema.Number),
    /** Relative humidity percentage (0-100) */
    humidity: Schema.optional(Schema.Number),
    /** Atmospheric pressure in hPa */
    pressure: Schema.optional(Schema.Number),
    /** WMO weather code */
    weatherCode: Schema.optional(Schema.Number),
    /** Human-readable weather description */
    weatherDesc: Schema.optional(Schema.String),
    /** Wind speed in m/s */
    windSpeed: Schema.optional(Schema.Number),
    /** Wind direction in degrees (0-360) */
    windDir: Schema.optional(Schema.Number),
    /** Wind gusts in m/s */
    windGusts: Schema.optional(Schema.Number),
    /** Precipitation in mm */
    precipitation: Schema.optional(Schema.Number),
    /** Cloud cover percentage (0-100) */
    cloudCover: Schema.optional(Schema.Number),
    /** Visibility in meters */
    visibility: Schema.optional(Schema.Number),
    /** Ingestion timestamp */
    ingestedAt: Schema.DateFromSelf,
  }
) {}

/**
 * Encoded version (for JSON serialization over DurableStream).
 */
export interface WeatherObservationEventEncoded
  extends Schema.Schema.Encoded<typeof WeatherObservationEvent> {}
