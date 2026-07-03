/**
 * DecisionMakerModel — Effect SQL Model for DecisionMaker entity
 *
 * The PRIMARY entity in the pipeline. People, not companies.
 * Scored on Capital × Interest × Power (CIP).
 *
 * Rich fields (contacts, tenure, contract estimate) stored as JSON TEXT.
 *
 * @module prospects/models/DecisionMakerModel
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { TitleLevel, PipelineStage } from '../schemas/domain'
import { NullableJsonb } from './_transforms'
import {
  ContactMethod,
  RoleTenure,
  ContractEstimate,
} from '../schemas/value-objects'

// =============================================================================
// Model Definition
// =============================================================================

export class DecisionMakerModel extends Model.Class<DecisionMakerModel>(
  'DecisionMakerModel'
)({
  id: Schema.String,
  name: Schema.NonEmptyString,
  title: Model.FieldOption(Schema.String),
  titleLevel: TitleLevel,
  companyId: Schema.String,

  /** Multi-channel contact info — JSONB ↔ Option<ContactMethod[]> */
  contactsJson: NullableJsonb(Schema.Array(ContactMethod)),

  /** Time in role with origin context — JSONB ↔ Option<RoleTenure> */
  tenureJson: NullableJsonb(RoleTenure),

  /** Our opportunity estimate — JSONB ↔ Option<ContractEstimate> */
  contractEstimateJson: NullableJsonb(ContractEstimate),

  cipCapital: Schema.Number,
  cipInterest: Schema.Number,
  cipPower: Schema.Number,
  cipComposite: Schema.Number,
  pipelineStage: PipelineStage,
  notes: Model.FieldOption(Schema.String),
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}
