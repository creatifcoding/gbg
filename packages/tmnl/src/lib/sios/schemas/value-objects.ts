/**
 * SIOS — Value Objects
 *
 * Rich structured fields — no bare Schema.String for things that have structure.
 * Reusable across entities.
 *
 * @module sios/schemas/value-objects
 */

import { Schema } from 'effect'

// =============================================================================
// Geolocation
// =============================================================================

export const GeoLocation = Schema.Struct({
  lat: Schema.Number.pipe(Schema.greaterThanOrEqualTo(-90), Schema.lessThanOrEqualTo(90)),
  lng: Schema.Number.pipe(Schema.greaterThanOrEqualTo(-180), Schema.lessThanOrEqualTo(180)),
  address: Schema.optional(Schema.String),
  city: Schema.optional(Schema.String),
  state: Schema.optional(Schema.String),
  country: Schema.optional(Schema.String),
})
export type GeoLocation = typeof GeoLocation.Type

// =============================================================================
// Shift Window — airport night shift constraint
// =============================================================================

/** A working window within a 24-hour period */
export const ShiftWindow = Schema.Struct({
  /** Start time in HH:MM 24hr format */
  startTime: Schema.String.pipe(Schema.pattern(/^\d{2}:\d{2}$/)),
  /** End time in HH:MM 24hr format */
  endTime: Schema.String.pipe(Schema.pattern(/^\d{2}:\d{2}$/)),
  /** Productive hours after setup/teardown */
  productiveHours: Schema.Number.pipe(Schema.greaterThan(0)),
  /** Productivity coefficient vs day shift (typically 0.85–0.90 for night) */
  productivityCoefficient: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.lessThanOrEqualTo(1.0)
  ),
})
export type ShiftWindow = typeof ShiftWindow.Type

// =============================================================================
// EVM Snapshot — earned value metrics at a point in time
// =============================================================================

export const EVMSnapshot = Schema.Struct({
  /** Budget at Completion */
  bac: Schema.Number,
  /** Planned Value — budgeted cost of work scheduled */
  pv: Schema.Number,
  /** Earned Value — BAC × %Complete (physical, not spend) */
  ev: Schema.Number,
  /** Actual Cost — what we actually spent */
  ac: Schema.Number,
  /** Schedule Performance Index: EV / PV */
  spi: Schema.Number,
  /** Cost Performance Index: EV / AC */
  cpi: Schema.Number,
  /** Estimate at Completion: BAC / CPI */
  eac: Schema.Number,
  /** Variance at Completion: BAC - EAC */
  vac: Schema.Number,
  /** Physical % complete (0–100) */
  percentComplete: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0),
    Schema.lessThanOrEqualTo(100)
  ),
  /** Snapshot timestamp */
  asOf: Schema.DateFromString,
})
export type EVMSnapshot = typeof EVMSnapshot.Type

// =============================================================================
// Evidence — photo, measurement, or sign-off attached to a task/checkpoint
// =============================================================================

export const EvidenceType = Schema.Literal(
  'photo', 'video', 'measurement', 'sign_off', 'document', 'barcode_scan'
)
export type EvidenceType = typeof EvidenceType.Type

export const Evidence = Schema.Struct({
  type: EvidenceType,
  /** URL or path to the evidence file */
  url: Schema.String,
  /** Free-text caption or measurement value */
  caption: Schema.optional(Schema.String),
  /** Who captured it */
  capturedBy: Schema.String,
  /** When */
  capturedAt: Schema.DateFromString,
  /** GPS coordinates if available */
  location: Schema.optional(GeoLocation),
})
export type Evidence = typeof Evidence.Type

// =============================================================================
// Certification — OSHA, welding, electrical, airport badge
// =============================================================================

export const CertificationType = Schema.Literal(
  'osha_30',               // OSHA 30-hour construction
  'osha_10',               // OSHA 10-hour
  'first_aid_cpr',
  'aws_welding',           // AWS D1.1 structural steel
  'electrical_journeyman',
  'electrical_master',
  'rigging_nccco',         // NCCCO crane/rigging
  'forklift',
  'scissor_lift',
  'boom_lift',
  'airport_badge',         // TSA/CAA security clearance
  'confined_space',
  'fall_protection',
  'equipment_trainer',
  'other'
)
export type CertificationType = typeof CertificationType.Type

export const Certification = Schema.Struct({
  type: CertificationType,
  /** Issuing authority */
  issuedBy: Schema.optional(Schema.String),
  /** Issue date */
  issuedAt: Schema.DateFromString,
  /** Expiration date */
  expiresAt: Schema.optional(Schema.DateFromString),
  /** Certification number */
  certNumber: Schema.optional(Schema.String),
  /** Specific position/rating (e.g., 3G, 4G for welding) */
  rating: Schema.optional(Schema.String),
})
export type Certification = typeof Certification.Type

// =============================================================================
// Cost Code — how JCK tracks labour cost
// =============================================================================

export const CostCode = Schema.Struct({
  /** Hierarchical code (e.g., "03.MEK.CV" for mechanical conveyor) */
  code: Schema.NonEmptyString,
  /** Human-readable description */
  description: Schema.String,
  /** Rate per unit ($/hr, $/LF, etc.) */
  rate: Schema.optional(Schema.Number),
  /** Unit of measure */
  unit: Schema.optional(Schema.String),
})
export type CostCode = typeof CostCode.Type
