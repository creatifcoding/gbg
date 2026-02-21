/**
 * GeniferCompositeModel — Effect SQL Model for agent-created reusable fragments
 *
 * A composite is a named tree fragment (e.g., "LoginCard" = VStack + inputs + button).
 * Created by agents during generation, persisted, rated, and reused.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  GeniferCompositeId,
  NumericFromPg,
  CompositeCreator,
  CreatedAt,
  UpdatedAt,
} from './_common'

export class GeniferCompositeModel extends Model.Class<GeniferCompositeModel>('GeniferCompositeModel')({
  /** UUID primary key */
  id: Model.Generated(GeniferCompositeId),

  /** Unique name (e.g., "LoginCard", "MetricPanel") */
  name: Schema.String,

  /** Human-readable description */
  description: Model.FieldOption(Schema.String),

  /** Tree fragment template (JSONB) — { root, elements: {...} } */
  template: Schema.Unknown,

  /** JSON Schema for composite's own props (JSONB) */
  propsSchema: Model.FieldOption(Schema.Unknown),

  /** Default Tailwind classes applied to the composite root */
  defaultClass: Model.FieldOption(Schema.String),

  /** Whether this composite can have children injected */
  hasChildren: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Pipeline quality score (0–1) */
  qualityScore: Schema.optionalWith(NumericFromPg, { default: () => 0 }),

  /** Human rating 1-5 */
  humanRating: Model.FieldOption(Schema.Number),

  /** How many times this composite has been used in generations */
  usageCount: Schema.optionalWith(Schema.Number, { default: () => 0 }),

  /** Who created this: system, agent, or human */
  createdBy: Schema.optionalWith(CompositeCreator, { default: () => "agent" as const }),

  /** Timestamps */
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
