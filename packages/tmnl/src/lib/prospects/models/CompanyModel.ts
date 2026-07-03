/**
 * CompanyModel — Effect SQL Model for Company entity
 *
 * Rich fields stored as JSON TEXT columns, marshalled via typed transforms.
 * Snake_case ↔ camelCase handled by SqliteClient transformers.
 *
 * @module prospects/models/CompanyModel
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { Industry, CompanySize, HarvestSource, PipelineStage } from '../schemas/domain'
import { NullableJsonb } from './_transforms'
import {
  MoneyRange,
  GeoLocation,
  HeadcountEstimate,
  CapabilityMatch,
} from '../schemas/value-objects'

// =============================================================================
// Model Definition
// =============================================================================

export class CompanyModel extends Model.Class<CompanyModel>('CompanyModel')({
  id: Schema.String,
  name: Schema.NonEmptyString,
  slug: Schema.String,
  industry: Industry,
  subIndustry: Model.FieldOption(Schema.String),

  /** Structured location — JSONB ↔ Option<GeoLocation> */
  locationJson: NullableJsonb(GeoLocation),

  size: CompanySize,

  /** Employee count — JSONB ↔ Option<HeadcountEstimate> */
  headcountJson: NullableJsonb(HeadcountEstimate),

  /** Revenue range — JSONB ↔ Option<MoneyRange> */
  revenueJson: NullableJsonb(MoneyRange),

  website: Model.FieldOption(Schema.String),
  linkedinUrl: Model.FieldOption(Schema.String),
  description: Model.FieldOption(Schema.String),

  /** TMNL capability fit — JSONB ↔ Option<CapabilityMatch[]> */
  capabilitiesJson: NullableJsonb(Schema.Array(CapabilityMatch)),

  harvestSource: HarvestSource,
  harvestDate: Model.DateTimeInsertFromDate,
  harvestBatchId: Model.FieldOption(Schema.String),
  pipelineStage: PipelineStage,

  /** Tags — JSONB ↔ Option<string[]> */
  tagsJson: NullableJsonb(Schema.Array(Schema.String)),

  notes: Model.FieldOption(Schema.String),
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}
