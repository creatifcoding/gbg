/**
 * GeniferTreeModel — Effect SQL Model for generated UI trees
 *
 * One row per generate() or refine() call. Elements stored separately
 * in genifer_elements (leaves-as-graph).
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  GeniferTreeId,
  NumericFromPg,
  CreatedAt,
  UpdatedAt,
  OptionalMetadata,
} from './_common'

export class GeniferTreeModel extends Model.Class<GeniferTreeModel>('GeniferTreeModel')({
  /** UUID primary key (auto-generated) */
  id: Model.Generated(GeniferTreeId),

  /** The natural language prompt that generated this tree */
  prompt: Schema.String,

  /** Root element key — points to an element_key in genifer_elements */
  rootKey: Schema.String,

  /** Which LLM model generated this tree */
  model: Model.FieldOption(Schema.String),

  /** Pipeline quality score (0–1) */
  qualityScore: NumericFromPg,

  /** Total element count in the tree */
  elementCount: Schema.Number,

  /** Number of repairs applied during normalization */
  repairCount: Schema.Number,

  /** Generation duration in milliseconds */
  durationMs: Model.FieldOption(Schema.Number),

  /** Conversation thread ID (links generate → refine chains) */
  threadId: Model.FieldOption(Schema.String),

  /** Parent tree ID (for refinements — points to the tree being refined) */
  parentTreeId: Model.FieldOption(GeniferTreeId),

  /** Human rating 1-5 */
  humanRating: Model.FieldOption(Schema.Number),

  /** Usage count (how many times this tree was referenced/loaded) */
  usageCount: Schema.optionalWith(Schema.Number, { default: () => 0 }),

  /** Tags for categorization */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),

  /** Extensible metadata (JSONB) */
  metadata: OptionalMetadata,

  /** Timestamps */
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
