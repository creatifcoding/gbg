/**
 * GeniferSignalModel — Effect SQL Model for quality signals (append-only)
 *
 * Signals accumulate on trees, elements, and composites:
 * - pipeline_score: automatic quality from the normalization pipeline
 * - human_rating: user thumbs-up/down
 * - usage: referenced in a generation
 * - repair: element needed repair during normalization
 * - reuse: composite reused across trees
 * - promote: composite promoted from ephemeral to persistent
 * - deprecate: composite marked for removal
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  GeniferSignalId,
  SignalTargetType,
  SignalType,
  NumericFromPg,
  CreatedAt,
} from './_common'

export class GeniferSignalModel extends Model.Class<GeniferSignalModel>('GeniferSignalModel')({
  /** UUID primary key */
  id: Model.Generated(GeniferSignalId),

  /** What this signal targets: element, tree, or composite */
  targetType: SignalTargetType,

  /** UUID of the target entity */
  targetId: Schema.String,

  /** Signal type */
  signalType: SignalType,

  /** Signal value (score, rating, count) */
  value: NumericFromPg,

  /** Extra context (JSONB) — model name, prompt hash, etc. */
  metadata: Model.FieldOption(Schema.Unknown),

  /** Timestamp */
  createdAt: CreatedAt,
}) {}
