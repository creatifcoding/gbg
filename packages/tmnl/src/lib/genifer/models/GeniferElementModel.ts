/**
 * GeniferElementModel — Effect SQL Model for UI elements (leaves-as-graph)
 *
 * Every UIElement is a row. Tree structure encoded via parent_key.
 * UNIQUE(tree_id, element_key) — one key per tree.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  GeniferElementId,
  GeniferTreeId,
  NumericFromPg,
  CreatedAt,
} from './_common'

export class GeniferElementModel extends Model.Class<GeniferElementModel>('GeniferElementModel')({
  /** UUID primary key */
  id: Model.Generated(GeniferElementId),

  /** FK to genifer_trees */
  treeId: GeniferTreeId,

  /** Element key within the tree (e.g., "dashboard-root", "search-bar") */
  elementKey: Schema.String,

  /** Component type (e.g., "VStack", "Heading", "Button") */
  elementType: Schema.String,

  /** Component props (JSONB) */
  props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),

  /** Tailwind utility classes for layout styling */
  className: Model.FieldOption(Schema.String),

  /** Parent element key (NULL for root) */
  parentKey: Model.FieldOption(Schema.String),

  /** Ordered child keys */
  children: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),

  /** Depth in tree (0 = root) */
  depth: Schema.Number,

  /** Entrance animation config (JSONB) */
  entrance: Model.FieldOption(Schema.Unknown),

  /** ARIA role */
  role: Model.FieldOption(Schema.String),

  /** Accessible label */
  ariaLabel: Model.FieldOption(Schema.String),

  /** Visibility condition (JSONB) */
  visible: Model.FieldOption(Schema.Unknown),

  /** Per-element quality score */
  qualityScore: Schema.optionalWith(NumericFromPg, { default: () => 0 }),

  /** Timestamp */
  createdAt: CreatedAt,
}) {}
