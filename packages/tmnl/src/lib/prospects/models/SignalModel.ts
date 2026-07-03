/**
 * SignalModel — Effect SQL Model for Signal entity
 *
 * Evidence of need or opportunity. Linked to companies and optionally
 * to specific decision makers. Carries a weight (1–3) for scoring.
 *
 * @module prospects/models/SignalModel
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { SignalType } from '../schemas/domain'

// =============================================================================
// Model Definition
// =============================================================================

export class SignalModel extends Model.Class<SignalModel>('SignalModel')({
  id: Schema.String,
  companyId: Schema.String,
  decisionMakerId: Model.FieldOption(Schema.String),
  signalType: SignalType,
  title: Schema.NonEmptyString,
  description: Model.FieldOption(Schema.String),
  sourceUrl: Model.FieldOption(Schema.String),
  weight: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(3)),
  detectedAt: Model.DateTimeInsertFromDate,
  expiresAt: Model.FieldOption(Schema.DateFromSelf),
  /** Raw scraped text — preserved for future embedding */
  raw: Model.FieldOption(Schema.String),
  createdAt: Model.DateTimeInsertFromDate,
}) {}
