/**
 * Zone Entity Schema
 *
 * Physical subdivision of a Project. Airports: Terminal 1 Zone A, Customs Hall, etc.
 * Zones enable brownfield phased delivery — hand over Zone A while Zone B still active.
 *
 * Lifecycle: defined → active → commissioning → handed_over
 *            + on_hold (bidirectional from defined/active)
 *
 * @module sios/schemas/zone
 */

import { Schema, Option } from 'effect'
import { ZoneId, ProjectId } from '../identifiers'
import { GeoLocation } from '../value-objects'
import { BaseSiosFields } from '../common'

// =============================================================================
// Enums
// =============================================================================

export const ZoneStatus = Schema.Literal(
  'defined',
  'active',
  'commissioning',
  'handed_over',
  'on_hold'
)
export type ZoneStatus = typeof ZoneStatus.Type

// =============================================================================
// Zone Entity — TaggedClass
// =============================================================================

export class Zone extends Schema.TaggedClass<Zone>()('Zone', {
  id: ZoneId,
  projectId: ProjectId,
  name: Schema.NonEmptyString,
  /** Short code (e.g., "Z1-INTL", "Z2-DOM") */
  code: Schema.NonEmptyString,
  status: ZoneStatus,

  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Brownfield phase number — controls delivery sequencing */
  phaseNumber: Schema.optionalWith(Schema.Number.pipe(Schema.greaterThan(0)), { as: 'Option' }),

  /** Access constraints (e.g., "Sterile area — badge required", "Night access only") */
  accessConstraints: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Zone area in square feet */
  areaSquareFeet: Schema.optionalWith(Schema.Number.pipe(Schema.greaterThan(0)), { as: 'Option' }),

  /** Zone location */
  location: Schema.optionalWith(GeoLocation, { as: 'Option' }),

  /** Hold reason when on_hold */
  holdReason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  ...BaseSiosFields,
}) {
  /** Is this a brownfield phased zone? */
  isBrownfieldPhase(): boolean {
    return Option.isSome(this.phaseNumber)
  }

  /** Is this zone accessible for work? */
  isAccessible(): boolean {
    return this.status === 'active' && Option.isNone(this.accessConstraints)
  }

  /** Is this zone in a terminal state? */
  isTerminal(): boolean {
    return this.status === 'handed_over'
  }

  /** Is this zone currently on hold? */
  isOnHold(): boolean {
    return this.status === 'on_hold'
  }
}

// =============================================================================
// Create Params
// =============================================================================

export const CreateZoneParams = Schema.Struct({
  projectId: ProjectId,
  name: Schema.NonEmptyString,
  code: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  phaseNumber: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
  accessConstraints: Schema.optional(Schema.String),
  areaSquareFeet: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
  location: Schema.optional(GeoLocation),
})
export type CreateZoneParams = typeof CreateZoneParams.Type

// =============================================================================
// Update Params
// =============================================================================

export const UpdateZoneParams = Schema.Struct({
  name: Schema.optional(Schema.NonEmptyString),
  description: Schema.optional(Schema.String),
  phaseNumber: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
  accessConstraints: Schema.optional(Schema.String),
  areaSquareFeet: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
})
export type UpdateZoneParams = typeof UpdateZoneParams.Type
