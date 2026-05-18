/**
 * Relationship/Reactor eligibility result schemas.
 *
 * Rich guard vocabulary shared by entity state machines and Reactor planning.
 * Boolean guards are still useful for hot local checks, but Reactor-facing
 * decisions need stable reasons for audit, replay, and operator explanation.
 *
 * @module
 */

import { Schema } from 'effect'
import { RelationshipNodeType } from './edge-types'

export const EligibilityOutcome = Schema.Literal(
  'eligible',
  'skipped',
  'idempotent',
  'rejected',
  'failed',
)
export type EligibilityOutcome = typeof EligibilityOutcome.Type

export const EligibilityReason = Schema.Literal(
  'not_found',
  'terminal_state',
  'not_started',
  'already_suspended',
  'duplicate_propagation',
  'invalid_transition',
  'conflict',
  'unknown',
)
export type EligibilityReason = typeof EligibilityReason.Type

export class EligibilityResult extends Schema.TaggedClass<EligibilityResult>()('EligibilityResult', {
  entityType: RelationshipNodeType,
  entityId: Schema.String,
  targetState: Schema.String,
  currentState: Schema.optional(Schema.String),
  outcome: EligibilityOutcome,
  reason: Schema.optional(EligibilityReason),
  remediation: Schema.optional(Schema.String),
}) {
  get eligible(): boolean {
    return this.outcome === 'eligible'
  }
}

export const eligible = (input: {
  readonly entityType: typeof RelationshipNodeType.Type
  readonly entityId: string
  readonly currentState?: string
  readonly targetState: string
}) => new EligibilityResult({
  ...input,
  outcome: 'eligible',
})

export const skipped = (input: {
  readonly entityType: typeof RelationshipNodeType.Type
  readonly entityId: string
  readonly currentState?: string
  readonly targetState: string
  readonly reason: EligibilityReason
  readonly remediation?: string
}) => new EligibilityResult({
  ...input,
  outcome: 'skipped',
})

export const idempotent = (input: {
  readonly entityType: typeof RelationshipNodeType.Type
  readonly entityId: string
  readonly currentState?: string
  readonly targetState: string
  readonly reason?: EligibilityReason
  readonly remediation?: string
}) => new EligibilityResult({
  ...input,
  outcome: 'idempotent',
  reason: input.reason ?? 'duplicate_propagation',
})
