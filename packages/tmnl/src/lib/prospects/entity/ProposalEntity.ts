/**
 * ProposalEntity — Effect Cluster Entity for Proposal
 *
 * The output artifact. Agent-draftable, version-tracked.
 * Links to Company (target), DecisionMakers (audience), Signals (justification).
 * RPCs: Create, Get, Draft section, Advance status, SetEstimate.
 *
 * @module prospects/entity/ProposalEntity
 */

import { Schema } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { ContractEstimate, Capability } from '../schemas/value-objects'

// =============================================================================
// Sub-Schemas
// =============================================================================

export const ProposalStatus = Schema.Literal(
  'draft', 'review', 'revised', 'approved',
  'sent', 'accepted', 'rejected', 'expired'
)
export type ProposalStatus = typeof ProposalStatus.Type

export const SectionKey = Schema.Literal(
  'executive_summary', 'problem_statement',
  'proposed_solution', 'capability_match',
  'timeline', 'pricing', 'team',
  'case_studies', 'terms'
)
export type SectionKey = typeof SectionKey.Type

export const ProposalSection = Schema.Struct({
  key: SectionKey,
  title: Schema.String,
  body: Schema.String,
  agentDrafted: Schema.Boolean,
  humanEdited: Schema.Boolean,
})
export type ProposalSection = typeof ProposalSection.Type

export const DeliveryMethod = Schema.Literal(
  'email', 'presentation', 'portal', 'pdf'
)

// =============================================================================
// Response Schemas
// =============================================================================

export const ProposalView = Schema.Struct({
  id: Schema.String,
  companyId: Schema.String,
  title: Schema.String,
  status: ProposalStatus,
  version: Schema.Number,
  sectionCount: Schema.Number,
  deliveryMethod: Schema.NullishOr(DeliveryMethod),
})

// =============================================================================
// RPC Error Schemas
// =============================================================================

export class ProposalNotFoundError extends Schema.TaggedError<ProposalNotFoundError>()(
  'ProposalNotFoundError',
  { proposalId: Schema.String }
) {}

export class InvalidSectionError extends Schema.TaggedError<InvalidSectionError>()(
  'InvalidSectionError',
  { proposalId: Schema.String, sectionKey: Schema.String }
) {}

// =============================================================================
// RPC Definitions
// =============================================================================

const EntityType = 'Proposal' as const

export class CreateProposalRpc extends Rpc.make(`${EntityType}.Create`, {
  payload: Schema.Struct({
    id: Schema.String,
    companyId: Schema.String,
    decisionMakerIds: Schema.Array(Schema.String),
    signalIds: Schema.Array(Schema.String),
    title: Schema.NonEmptyString,
    deliveryMethod: Schema.optional(DeliveryMethod),
  }),
  primaryKey: ({ id }) => id,
  success: ProposalView,
}) {}

export class GetProposalRpc extends Rpc.make(`${EntityType}.Get`, {
  payload: Schema.Struct({ id: Schema.String }),
  primaryKey: ({ id }) => id,
  success: ProposalView,
  error: ProposalNotFoundError,
}) {}

export class DraftSectionRpc extends Rpc.make(`${EntityType}.DraftSection`, {
  payload: Schema.Struct({
    id: Schema.String,
    section: ProposalSection,
  }),
  primaryKey: ({ id }) => id,
  success: ProposalView,
  error: ProposalNotFoundError,
}) {}

export class AdvanceStatusRpc extends Rpc.make(`${EntityType}.AdvanceStatus`, {
  payload: Schema.Struct({
    id: Schema.String,
    status: ProposalStatus,
  }),
  primaryKey: ({ id }) => id,
  success: ProposalView,
  error: ProposalNotFoundError,
}) {}

export class SetEstimateRpc extends Rpc.make(`${EntityType}.SetEstimate`, {
  payload: Schema.Struct({
    id: Schema.String,
    estimate: ContractEstimate,
  }),
  primaryKey: ({ id }) => id,
  success: ProposalView,
  error: ProposalNotFoundError,
}) {}

export class SetCapabilitiesRpc extends Rpc.make(`${EntityType}.SetCapabilities`, {
  payload: Schema.Struct({
    id: Schema.String,
    capabilities: Schema.Array(Schema.Struct({
      capability: Capability,
      fit: Schema.Number,
      rationale: Schema.optional(Schema.String),
    })),
  }),
  primaryKey: ({ id }) => id,
  success: ProposalView,
  error: ProposalNotFoundError,
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

export const ProposalEntity = Entity.make(EntityType, [
  CreateProposalRpc,
  GetProposalRpc,
  DraftSectionRpc,
  AdvanceStatusRpc,
  SetEstimateRpc,
  SetCapabilitiesRpc,
])
