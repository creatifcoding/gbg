/**
 * Flight Entity - Aircraft Tracked via ADS-B
 *
 * Represents aircraft tracked via ADS-B, OpenSky, FlightRadar24, etc.
 * Composes: Spatial, Temporal, Kinetic, Identifiable traits
 *
 * @module geoint/entities/flight
 */

import { Schema } from 'effect'
import { EntityId, EntityProvenance } from '@/lib/ecs'
import {
  SpatialTrait,
  TemporalTrait,
  KineticTrait,
  IdentifiableTrait,
} from '../schemas/traits'

// =============================================================================
// Flight-Specific Schemas
// =============================================================================

/**
 * ICAO 24-bit hex address.
 */
export const Icao24 = Schema.String.pipe(
  Schema.pattern(/^[a-f0-9]{6}$/i),
  Schema.brand('Icao24'),
  Schema.annotations({
    identifier: 'Icao24',
    title: 'ICAO 24-bit Address',
    description: 'Aircraft ICAO 24-bit hex address (6 hex chars).',
  })
)
export type Icao24 = typeof Icao24.Type

/**
 * Transponder squawk code (octal).
 */
export const SquawkCode = Schema.String.pipe(
  Schema.pattern(/^[0-7]{4}$/),
  Schema.brand('SquawkCode'),
  Schema.annotations({
    identifier: 'SquawkCode',
    title: 'Squawk Code',
    description: 'Transponder squawk code (4 octal digits). Special: 7500=hijack, 7600=comm failure, 7700=emergency.',
  })
)
export type SquawkCode = typeof SquawkCode.Type

/**
 * Aircraft wake turbulence category.
 */
export const AircraftCategory = Schema.Literal(
  'A0', // No ADS-B category info
  'A1', // Light (< 15,500 lbs)
  'A2', // Small (15,500 - 75,000 lbs)
  'A3', // Large (75,000 - 300,000 lbs)
  'A4', // High vortex large
  'A5', // Heavy (> 300,000 lbs)
  'A6', // High performance
  'A7', // Rotorcraft
  'B0', // No ADS-B category info
  'B1', // Glider / sailplane
  'B2', // Lighter than air
  'B3', // Parachutist / skydiver
  'B4', // Ultralight / hang glider
  'B5', // Reserved
  'B6', // UAV
  'B7', // Space / trans-atmospheric
  'C0', // No ADS-B category info
  'C1', // Emergency vehicle
  'C2', // Service vehicle
  'C3'  // Point obstacle
).pipe(
  Schema.annotations({
    identifier: 'AircraftCategory',
    title: 'Aircraft Category',
    description: 'ADS-B emitter category code.',
  })
)
export type AircraftCategory = typeof AircraftCategory.Type

// =============================================================================
// Flight Entity
// =============================================================================

/**
 * Flight entity - aircraft tracked via ADS-B, OpenSky, etc.
 */
export class FlightEntity extends Schema.TaggedClass<FlightEntity>()(
  'FlightEntity',
  {
    // Base entity fields
    id: EntityId,
    entityType: Schema.Literal('flight'),
    provenance: EntityProvenance,
    metadata: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { default: () => ({}) }
    ),

    // Embedded traits
    spatial: SpatialTrait,
    temporal: TemporalTrait,
    kinetic: KineticTrait,
    identifiable: IdentifiableTrait,

    // Flight-specific fields
    /** ICAO 24-bit address (hex string). */
    icao24: Schema.String,
    /** Origin country of the aircraft. */
    originCountry: Schema.String,
    /** Is the aircraft on the ground? */
    onGround: Schema.Boolean,
    /** Transponder squawk code (octal string). */
    squawk: Schema.optional(Schema.String),
    /** Aircraft category (size/type). */
    category: Schema.optional(Schema.String),
    /** Special position indicator (SPI). */
    spi: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  },
  {
    identifier: 'FlightEntity',
    title: 'Flight Entity',
    description: 'Aircraft tracked via ADS-B. Includes spatial, temporal, kinetic, and identifiable traits.',
  }
) {
  get displayLabel(): string {
    const callsign = this.identifiable.callsign?.trim()
    return callsign && callsign.length > 0 ? callsign : this.icao24
  }

  isAirborne(): boolean {
    return !this.onGround
  }

  hasEmergencySquawk(): boolean {
    return this.squawk === '7500' || this.squawk === '7600' || this.squawk === '7700'
  }

  toSummary(): string {
    return `${this.displayLabel} · ${this.originCountry} · ${this.isAirborne() ? 'airborne' : 'grounded'}`
  }
}
