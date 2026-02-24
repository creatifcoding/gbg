/**
 * GEOINT Flight Traits
 *
 * Trait definitions for aircraft/flight entities from OpenSky, ADSB.lol, etc.
 *
 * @module
 */

import { Schema } from 'effect'
import { defineTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'
import { Icao24, AircraftCategory, IntelSource } from '../../schemas/search'

// ─────────────────────────────────────────────────────────────────────────────
// Flight Data Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FlightData trait - core aircraft data from ADS-B sources.
 *
 * Combined with GeoPosition3D, GeoVelocity for full state.
 */
export const FlightData = defineTrait('FlightData', {
  /** ICAO24 transponder address */
  icao24: Icao24,
  /** Callsign (flight number or registration) */
  callsign: Schema.optionalWith(Schema.String, { default: () => '' }),
  /** Aircraft category */
  category: AircraftCategory,
  /** Country of registration */
  originCountry: Schema.String,
  /** Whether aircraft is on ground */
  onGround: Schema.Boolean,
  /** Last contact timestamp */
  lastContact: Schema.DateFromSelf,
  /** Data source (opensky, adsb-lol) */
  source: IntelSource,
  /** Squawk code if available */
  squawk: Schema.optional(Schema.String),
})
export type FlightData = typeof FlightData.Type

/**
 * FlightRegistration trait - static aircraft info.
 */
export const FlightRegistration = defineTrait('FlightRegistration', {
  /** Aircraft registration (tail number) */
  registration: Schema.optional(Schema.String),
  /** Aircraft type code (e.g., B738) */
  aircraftType: Schema.optional(Schema.String),
  /** Aircraft description */
  description: Schema.optional(Schema.String),
  /** Military flag */
  isMilitary: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type FlightRegistration = typeof FlightRegistration.Type

/**
 * FlightRoute trait - route information.
 */
export const FlightRoute = defineTrait('FlightRoute', {
  /** Origin airport ICAO code */
  origin: Schema.optional(Schema.String),
  /** Destination airport ICAO code */
  destination: Schema.optional(Schema.String),
  /** Route waypoints */
  route: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
})
export type FlightRoute = typeof FlightRoute.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

registerTrait('FlightData' as TraitId, FlightData, {
  uniqueness: {
    unique: true,
    uniqueKey: (data) => (data as { icao24: string }).icao24,
  },
})
registerTrait('FlightRegistration' as TraitId, FlightRegistration)
registerTrait('FlightRoute' as TraitId, FlightRoute)
