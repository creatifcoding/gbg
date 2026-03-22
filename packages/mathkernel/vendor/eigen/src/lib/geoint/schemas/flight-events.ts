/**
 * Flight Position Event Schema
 *
 * Event published to DurableStreams when flight positions are ingested.
 * Used by FlightEntityMaterializer to reactively update ECS entities.
 *
 * @module geoint/schemas/flight-events
 */

import { Schema } from 'effect'

// =============================================================================
// Flight Source
// =============================================================================

/**
 * Flight data source discriminator.
 */
export const FlightSource = Schema.Literal('opensky', 'adsb-lol').pipe(
  Schema.annotations({
    identifier: 'FlightSource',
    title: 'Flight Source',
    description: 'Source of flight position data.',
  })
)
export type FlightSource = typeof FlightSource.Type

// =============================================================================
// Flight Position Event
// =============================================================================

/**
 * Flight position event - published to DurableStream after ingestion.
 *
 * This is the event schema for the flight-positions stream.
 * Contains all kinetic data needed to materialize ECS entities.
 */
export class FlightPositionEvent extends Schema.TaggedClass<FlightPositionEvent>()(
  'FlightPositionEvent',
  {
    /** ICAO24 hex identifier (6 chars, lowercase). */
    icao24: Schema.String.pipe(
      Schema.pattern(/^[0-9a-f]{6}$/),
      Schema.annotations({
        title: 'ICAO24',
        description: 'Mode-S transponder code (6 hex characters).',
      })
    ),

    /** Data source. */
    source: FlightSource,

    /** Position as [longitude, latitude, altitudeM]. */
    position: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number).pipe(
      Schema.annotations({
        title: 'Position',
        description: 'WGS84 position [lon, lat, alt_m].',
      })
    ),

    /** Heading in degrees (0-360). */
    heading: Schema.optional(Schema.Number.pipe(Schema.between(0, 360))),

    /** Ground speed in m/s. */
    speed: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),

    /** Vertical rate in m/s (positive = climbing). */
    verticalRate: Schema.optional(Schema.Number),

    /** Callsign (flight number). */
    callsign: Schema.optional(Schema.String.pipe(Schema.maxLength(8))),

    /** Squawk code (4 digits). */
    squawk: Schema.optional(Schema.String.pipe(Schema.pattern(/^\d{4}$/))),

    /** Aircraft on ground flag. */
    onGround: Schema.Boolean,

    /** Observation timestamp (ISO 8601). */
    observedAt: Schema.DateFromString,

    /** Aircraft category (for ADSB). */
    category: Schema.optional(Schema.String),

    /** Origin country (for OpenSky). */
    originCountry: Schema.optional(Schema.String),
  },
  {
    identifier: 'FlightPositionEvent',
    title: 'Flight Position Event',
    description: 'Event published to flight-positions DurableStream.',
  }
) {}

/**
 * Encoded flight position event for JSON serialization.
 */
export const FlightPositionEventEncoded = Schema.encodedSchema(FlightPositionEvent)
export type FlightPositionEventEncoded = typeof FlightPositionEventEncoded.Type

// =============================================================================
// Batch Event (for bulk publishing)
// =============================================================================

/**
 * Batch of flight position events.
 */
export const FlightPositionBatch = Schema.Struct({
  _tag: Schema.Literal('FlightPositionBatch'),
  events: Schema.Array(FlightPositionEvent),
  source: FlightSource,
  region: Schema.String,
  ingestedAt: Schema.DateFromString,
}).pipe(
  Schema.annotations({
    identifier: 'FlightPositionBatch',
    title: 'Flight Position Batch',
    description: 'Batch of flight position events from a single ingestion.',
  })
)
export type FlightPositionBatch = typeof FlightPositionBatch.Type
