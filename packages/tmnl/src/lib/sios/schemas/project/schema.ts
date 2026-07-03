/**
 * Project Entity Schema
 *
 * Top-level container. An AMH installation project (airport BHS, warehouse sortation, etc.)
 * Owns Zones, which own WorkPackages, which own Tasks.
 *
 * Lifecycle: bidding → awarded → mobilising → active → commissioning → complete
 *            + on_hold (bidirectional from mobilising/active/commissioning)
 *            + cancelled (from bidding only)
 *
 * @module sios/schemas/project
 */

import { Schema, Option } from 'effect'
import { ProjectId } from '../identifiers'
import { GeoLocation, ShiftWindow } from '../value-objects'
import { BaseSiosFields } from '../common'

// =============================================================================
// Enums
// =============================================================================

export const ProjectStatus = Schema.Literal(
  'bidding',
  'awarded',
  'mobilising',
  'active',
  'commissioning',
  'complete',
  'on_hold',
  'cancelled'
)
export type ProjectStatus = typeof ProjectStatus.Type

export const ProjectType = Schema.Literal(
  'airport_bhs',         // Baggage Handling System
  'warehouse_sortation', // Warehouse / DC sortation
  'manufacturing',       // Manufacturing conveyance
  'distribution',        // Distribution center
  'parcel_hub',          // Parcel/courier hub
  'retrofit',            // Brownfield retrofit/upgrade
  'other'
)
export type ProjectType = typeof ProjectType.Type

export const DeliveryMethod = Schema.Literal(
  'design_build',        // JCK designs + builds
  'design_bid_build',    // Separate design, JCK bids
  'cm_at_risk',          // Construction manager at risk
  'integrated_delivery', // IPD
  'turnkey'              // Full turnkey
)
export type DeliveryMethod = typeof DeliveryMethod.Type

export const SiteCondition = Schema.Literal(
  'greenfield',          // New construction
  'brownfield_full',     // Existing facility, full rip-and-replace
  'brownfield_partial',  // Existing facility, partial upgrade
  'brownfield_overlay'   // Existing facility, overlay new system
)
export type SiteCondition = typeof SiteCondition.Type

// =============================================================================
// Project Entity — TaggedClass
// =============================================================================

export class Project extends Schema.TaggedClass<Project>()('Project', {
  id: ProjectId,
  name: Schema.NonEmptyString,
  /** Short code for cost-code prefix (e.g., "DFW-T2", "LAX-BHS") */
  code: Schema.NonEmptyString,
  status: ProjectStatus,

  /** Client / airport authority / end customer */
  client: Schema.NonEmptyString,
  /** General contractor or systems integrator JCK works under */
  integrator: Schema.optionalWith(Schema.String, { as: 'Option' }),

  projectType: ProjectType,
  deliveryMethod: DeliveryMethod,
  siteCondition: SiteCondition,

  /** Project location */
  location: Schema.optionalWith(GeoLocation, { as: 'Option' }),

  /** Night shift window — airports typically 10pm-5am */
  shiftWindow: Schema.optionalWith(ShiftWindow, { as: 'Option' }),

  /** IANA timezone (e.g., "America/Chicago") */
  timezone: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Contract / planned dates */
  startDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  endDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  actualStartDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  actualEndDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Total budgeted cost (BAC for project-level EVM) */
  budgetedCost: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),

  /** Held reason when status = on_hold */
  holdReason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Description / scope narrative */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  ...BaseSiosFields,
}) {
  /** Is the project in an active working state? */
  isActive(): boolean {
    return this.status === 'active' || this.status === 'commissioning'
  }

  /** Does this project have a night shift constraint? */
  isNightShift(): boolean {
    return Option.isSome(this.shiftWindow)
  }

  /** Productive hours per shift — from ShiftWindow or default 8 */
  productiveHoursPerShift(): number {
    return Option.match(this.shiftWindow, {
      onNone: () => 8,
      onSome: (sw) => sw.productiveHours,
    })
  }

  /** Productivity coefficient (night shift penalty) */
  shiftProductivityCoefficient(): number {
    return Option.match(this.shiftWindow, {
      onNone: () => 1.0,
      onSome: (sw) => sw.productivityCoefficient,
    })
  }

  /** Is this a brownfield (retrofit) project? */
  isBrownfield(): boolean {
    return this.siteCondition.startsWith('brownfield')
  }

  /** Is this project in a terminal state? */
  isTerminal(): boolean {
    return this.status === 'complete' || this.status === 'cancelled'
  }

  /** Is the project currently on hold? */
  isOnHold(): boolean {
    return this.status === 'on_hold'
  }
}

// =============================================================================
// Create Params
// =============================================================================

export const CreateProjectParams = Schema.Struct({
  name: Schema.NonEmptyString,
  code: Schema.NonEmptyString,
  client: Schema.NonEmptyString,
  integrator: Schema.optional(Schema.String),
  projectType: ProjectType,
  deliveryMethod: DeliveryMethod,
  siteCondition: SiteCondition,
  location: Schema.optional(GeoLocation),
  shiftWindow: Schema.optional(ShiftWindow),
  timezone: Schema.optional(Schema.String),
  startDate: Schema.optional(Schema.DateTimeUtc),
  endDate: Schema.optional(Schema.DateTimeUtc),
  budgetedCost: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  description: Schema.optional(Schema.String),
})
export type CreateProjectParams = typeof CreateProjectParams.Type

// =============================================================================
// Update Params
// =============================================================================

export const UpdateProjectParams = Schema.Struct({
  name: Schema.optional(Schema.NonEmptyString),
  client: Schema.optional(Schema.NonEmptyString),
  integrator: Schema.optional(Schema.String),
  shiftWindow: Schema.optional(ShiftWindow),
  timezone: Schema.optional(Schema.String),
  startDate: Schema.optional(Schema.DateTimeUtc),
  endDate: Schema.optional(Schema.DateTimeUtc),
  budgetedCost: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  description: Schema.optional(Schema.String),
})
export type UpdateProjectParams = typeof UpdateProjectParams.Type
