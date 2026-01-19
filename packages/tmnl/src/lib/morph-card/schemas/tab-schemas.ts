/**
 * Tab System Schemas for DynamicIslandCard
 *
 * Effect Schema definitions for tabbed views, state persistence,
 * and server communication within MorphCard containers.
 *
 * @module morph-card/schemas/tab-schemas
 */

import { Schema } from 'effect';

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
