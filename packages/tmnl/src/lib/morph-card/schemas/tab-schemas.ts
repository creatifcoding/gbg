/**
 * Tab System Schemas for DynamicIslandCard
 *
 * Effect Schema definitions for tabbed views, state persistence,
 * and server communication within MorphCard containers.
 *
 * @module morph-card/schemas/tab-schemas
 */

import { Schema } from 'effect';
import { TransitionGrammar } from './transition-grammar';
import { ReticleVariant } from './animation-config';

// =============================================================================
// Tab System Schemas
// =============================================================================

/**
 * Single tab view definition
 */
export const TabView = Schema.TaggedStruct('TabView', {
  /** Unique tab identifier */
  id: Schema.String,
  /** Display label */
  label: Schema.String,
  /** Optional icon name */
  icon: Schema.optional(Schema.String),
  /** Disabled state */
  disabled: Schema.optional(Schema.Boolean),
  /** Optional sizeKey override */
  sizeKey: Schema.optional(Schema.String),
  /** Optional transition override */
  transition: Schema.optional(Schema.Union(Schema.String, TransitionGrammar)),
  /** Optional reticle override */
  reticle: Schema.optional(ReticleVariant),
  /** Whether this view should be treated as a complex transition */
  complex: Schema.optional(Schema.Boolean),
});
export type TabView = Schema.Schema.Type<typeof TabView>;

/**
 * Tab bar configuration
 */
export const TabBarConfig = Schema.Struct({
  /** Accent color (default: cyan) */
  accentColor: Schema.optional(Schema.String),
  /** Position: top or bottom */
  position: Schema.optional(Schema.Literal('top', 'bottom')),
  /** Hide when single tab */
  autoHide: Schema.optional(Schema.Boolean),
});
export type TabBarConfig = Schema.Schema.Type<typeof TabBarConfig>;

// =============================================================================
// View Registry Schemas
// =============================================================================

/**
 * Layout intent for view-driven sizing
 */
export const ViewLayout = Schema.Struct({
  /** Prefer content-driven sizing */
  fitContent: Schema.optional(Schema.Boolean),
  /** Minimum width when dynamic sizing */
  minWidth: Schema.optional(Schema.Number),
  /** Maximum width when dynamic sizing */
  maxWidth: Schema.optional(Schema.Number),
  /** Minimum height when dynamic sizing */
  minHeight: Schema.optional(Schema.Number),
  /** Maximum height when dynamic sizing */
  maxHeight: Schema.optional(Schema.Number),
});
export type ViewLayout = Schema.Schema.Type<typeof ViewLayout>;

/**
 * Serializable view data (render omitted)
 */
export const ViewSpecData = Schema.Struct({
  /** Unique view identifier */
  id: Schema.String,
  /** Tab label */
  label: Schema.String,
  /** Optional icon name */
  icon: Schema.optional(Schema.String),
  /** Disabled state */
  disabled: Schema.optional(Schema.Boolean),
  /** Optional ordering */
  order: Schema.optional(Schema.Number),
  /** Optional sizeKey override for this view */
  sizeKey: Schema.optional(Schema.String),
  /** Optional transition override for this view */
  transition: Schema.optional(Schema.Union(Schema.String, TransitionGrammar)),
  /** Optional reticle override for this view */
  reticle: Schema.optional(ReticleVariant),
  /** Whether this view should be treated as a complex transition */
  complex: Schema.optional(Schema.Boolean),
  /** Keep this view mounted when inactive */
  keepMounted: Schema.optional(Schema.Boolean),
  /** Optional content tree for generated views */
  content: Schema.optional(Schema.Unknown),
  /** Optional layout intent for view-driven sizing */
  layout: Schema.optional(ViewLayout),
  /** Optional dynamic sizing for this view */
  dynamicSize: Schema.optional(Schema.Boolean),
  /** Optional minimum width when dynamic sizing */
  minWidth: Schema.optional(Schema.Number),
  /** Optional maximum width when dynamic sizing */
  maxWidth: Schema.optional(Schema.Number),
  /** Optional minimum height when dynamic sizing */
  minHeight: Schema.optional(Schema.Number),
  /** Optional maximum height when dynamic sizing */
  maxHeight: Schema.optional(Schema.Number),
});
export type ViewSpecData = Schema.Schema.Type<typeof ViewSpecData>;

/**
 * Registry schema for validating serialized view data
 */
export const ViewRegistrySchema = Schema.Record({
  key: Schema.String,
  value: ViewSpecData,
});
export type ViewRegistrySchema = Schema.Schema.Type<typeof ViewRegistrySchema>;

// =============================================================================
// Card State Persistence Schemas
// =============================================================================

/**
 * Per-view state storage for scroll position, form data, etc.
 */
export const ViewState = Schema.Struct({
  /** Scroll position */
  scrollTop: Schema.optional(Schema.Number),
  /** Form values */
  formData: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    })
  ),
  /** Custom state */
  custom: Schema.optional(Schema.Unknown),
});
export type ViewState = Schema.Schema.Type<typeof ViewState>;

/**
 * Complete card state for persistence
 */
export const DynamicIslandCardState = Schema.Struct({
  /** Active tab ID */
  activeTab: Schema.String,
  /** Per-view states */
  viewStates: Schema.Record({
    key: Schema.String,
    value: ViewState,
  }),
  /** Last update timestamp */
  lastUpdated: Schema.Number,
  /** Card mode (from MorphCard) */
  mode: Schema.optional(
    Schema.Literal('idle', 'compact', 'default', 'expanded', 'detail')
  ),
});
export type DynamicIslandCardState = Schema.Schema.Type<
  typeof DynamicIslandCardState
>;

/**
 * Default dynamic island card state
 */
export const DEFAULT_DYNAMIC_ISLAND_STATE: DynamicIslandCardState = {
  activeTab: '',
  viewStates: {},
  lastUpdated: Date.now(),
};

// =============================================================================
// Server Communication Schemas
// =============================================================================

/**
 * Server query request
 */
export const ServerQueryRequest = Schema.Struct({
  cardId: Schema.String,
  endpoint: Schema.String,
  method: Schema.optional(Schema.Literal('GET', 'POST')),
  params: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    })
  ),
  body: Schema.optional(Schema.Unknown),
});
export type ServerQueryRequest = Schema.Schema.Type<typeof ServerQueryRequest>;

/**
 * Server response wrapper
 */
export const ServerResponse = Schema.Struct({
  data: Schema.Unknown,
  timestamp: Schema.Number,
  cached: Schema.optional(Schema.Boolean),
});
export type ServerResponse = Schema.Schema.Type<typeof ServerResponse>;

/**
 * Server stream event
 */
export const ServerStreamEvent = Schema.Struct({
  type: Schema.String,
  data: Schema.Unknown,
  timestamp: Schema.Number,
});
export type ServerStreamEvent = Schema.Schema.Type<typeof ServerStreamEvent>;
