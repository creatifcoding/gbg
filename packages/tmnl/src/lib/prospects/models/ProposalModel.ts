/**
 * ProposalModel — Effect SQL Model for Proposal entity
 *
 * The output artifact. Version-tracked, section-structured,
 * agent-draftable. Links to Company, DecisionMakers, Signals.
 *
 * @module prospects/models/ProposalModel
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  Jsonb,
  NullableJsonb,
} from './_transforms'
import {
  ContractEstimate,
  CapabilityMatch,
} from '../schemas/value-objects'
import { ProposalStatus, ProposalSection } from '../entity/ProposalEntity'

// =============================================================================
// Model Definition
// =============================================================================

export class ProposalModel extends Model.Class<ProposalModel>(
  'ProposalModel'
)({
  id: Schema.String,
  companyId: Schema.String,
  title: Schema.NonEmptyString,
  status: ProposalStatus,
  version: Schema.Number.pipe(Schema.int()),

  /** Target DM ids (JSONB → string[]) */
  decisionMakerIdsJson: Jsonb(Schema.Array(Schema.String)),

  /** Justifying signal ids (JSONB → string[]) */
  signalIdsJson: Jsonb(Schema.Array(Schema.String)),

  /** Structured sections (JSONB → ProposalSection[]) */
  sectionsJson: Jsonb(Schema.Array(ProposalSection)),

  /** Pricing (JSONB → Option<ContractEstimate>) */
  contractEstimateJson: NullableJsonb(ContractEstimate),

  /** Capability fit (JSONB → Option<CapabilityMatch[]>) */
  capabilitiesJson: NullableJsonb(Schema.Array(CapabilityMatch)),

  deliveryMethod: Model.FieldOption(Schema.String),
  sentAt: Model.FieldOption(Schema.DateFromSelf),
  expiresAt: Model.FieldOption(Schema.DateFromSelf),
  notes: Model.FieldOption(Schema.String),
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}
