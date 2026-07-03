/**
 * Worker Entity Schema
 *
 * Individual field worker with certifications, badge tracking, and rate info.
 * Tracks OSHA, welding, electrical, airport badge certs with expiry dates.
 *
 * Lifecycle: active → on_leave → active
 *            active → badge_pending → active
 *            active → badge_expired (auto)
 *            active → cert_expired (auto)
 *            any → offboarded (terminal)
 *
 * @module sios/schemas/worker
 */

import { Schema, Option } from 'effect'
import { WorkerId, CrewId } from '../identifiers'
import { Certification, type CertificationType } from '../value-objects'
import { BaseSiosFields } from '../common'

// =============================================================================
// Enums
// =============================================================================

export const WorkerStatus = Schema.Literal(
  'active',
  'on_leave',
  'badge_pending',
  'badge_expired',
  'cert_expired',
  'offboarded'
)
export type WorkerStatus = typeof WorkerStatus.Type

export const TradeRole = Schema.Literal(
  'electrician',
  'mechanic',
  'ironworker',
  'welder',
  'controls_tech',
  'plc_programmer',
  'network_tech',
  'foreman',
  'superintendent',
  'safety_officer',
  'qc_inspector',
  'commissioning_tech',
  'general_labor',
  'apprentice'
)
export type TradeRole = typeof TradeRole.Type

// =============================================================================
// Worker Entity — TaggedClass
// =============================================================================

export class Worker extends Schema.TaggedClass<Worker>()('Worker', {
  id: WorkerId,
  crewId: Schema.optionalWith(CrewId, { as: 'Option' }),
  name: Schema.NonEmptyString,
  status: WorkerStatus,
  tradeRole: TradeRole,

  /** Hourly labour rate */
  hourlyRate: Schema.Number.pipe(Schema.greaterThan(0)),

  /** Worker certifications with expiry dates */
  certifications: Schema.Array(Certification),

  /** Airport/facility badge number */
  badgeNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Badge expiry date */
  badgeExpiry: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Contact info */
  email: Schema.optionalWith(Schema.String, { as: 'Option' }),
  phone: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Emergency contact */
  emergencyContact: Schema.optionalWith(Schema.String, { as: 'Option' }),

  ...BaseSiosFields,
}) {
  /** Does this worker have a valid (non-expired) badge? */
  hasValidBadge(): boolean {
    if (Option.isNone(this.badgeExpiry)) return Option.isSome(this.badgeNumber)
    const now = new Date()
    return new Date(this.badgeExpiry.value.toString()) > now
  }

  /** Does the badge expire within N days? */
  badgeExpiresWithin(days: number): boolean {
    if (Option.isNone(this.badgeExpiry)) return false
    const now = new Date()
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    return new Date(this.badgeExpiry.value.toString()) <= threshold
  }

  /** Does this worker have a specific active (non-expired) cert? */
  hasActiveCert(type: CertificationType): boolean {
    const now = new Date()
    return this.certifications.some((c) => {
      if (c.type !== type) return false
      if (c.expiresAt === undefined) return true
      return new Date(c.expiresAt) > now
    })
  }

  /** Get the soonest-expiring certification */
  nearestCertExpiry(): Date | null {
    const withExpiry = this.certifications
      .filter((c) => c.expiresAt !== undefined)
      .map((c) => new Date(c.expiresAt!))
      .sort((a, b) => a.getTime() - b.getTime())
    return withExpiry[0] ?? null
  }

  /** Is this worker deployable to a job site? */
  isDeployable(): boolean {
    return this.status === 'active' && this.hasValidBadge()
  }

  /** Effective hourly rate (placeholder for overtime/premium logic) */
  effectiveHourlyRate(): number {
    return this.hourlyRate
  }

  /** Is the worker in a terminal state? */
  isTerminal(): boolean {
    return this.status === 'offboarded'
  }
}

// =============================================================================
// Create Params
// =============================================================================

export const CreateWorkerParams = Schema.Struct({
  name: Schema.NonEmptyString,
  tradeRole: TradeRole,
  crewId: Schema.optional(CrewId),
  hourlyRate: Schema.Number.pipe(Schema.greaterThan(0)),
  certifications: Schema.optional(Schema.Array(Certification)),
  badgeNumber: Schema.optional(Schema.String),
  badgeExpiry: Schema.optional(Schema.DateTimeUtc),
  email: Schema.optional(Schema.String),
  phone: Schema.optional(Schema.String),
  emergencyContact: Schema.optional(Schema.String),
})
export type CreateWorkerParams = typeof CreateWorkerParams.Type

// =============================================================================
// Update Params
// =============================================================================

export const UpdateWorkerParams = Schema.Struct({
  name: Schema.optional(Schema.NonEmptyString),
  tradeRole: Schema.optional(TradeRole),
  crewId: Schema.optional(CrewId),
  hourlyRate: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
  badgeNumber: Schema.optional(Schema.String),
  badgeExpiry: Schema.optional(Schema.DateTimeUtc),
  email: Schema.optional(Schema.String),
  phone: Schema.optional(Schema.String),
})
export type UpdateWorkerParams = typeof UpdateWorkerParams.Type
