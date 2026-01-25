/**
 * GEOINT Viewport Presence Traits
 *
 * Traits for tracking entity presence in UI viewports.
 *
 * @module
 */

import { Schema } from 'effect'
import { defineTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'

// ─────────────────────────────────────────────────────────────────────────────
// Viewport IDs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known viewport identifiers in GEOINT UI.
 */
export const ViewportId = Schema.Literal(
  'map',           // Main map view
  'list',          // Search results list
  'timeline',      // Timeline view
  'detail',        // Detail panel
  'minimap',       // Minimap overview
  'network',       // Network graph view
  'swimlane',      // Swimlane view
)
export type ViewportId = typeof ViewportId.Type

// ─────────────────────────────────────────────────────────────────────────────
// Viewport Presence Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ViewportPresence trait - which viewports show this entity.
 *
 * Enables viewport-specific rendering and visibility.
 */
export const ViewportPresence = defineTrait('ViewportPresence', {
  /** Viewports where entity is currently visible */
  visibleIn: Schema.optionalWith(Schema.Array(ViewportId), { default: () => [] }),
  /** Viewports where entity is hidden (even if in bounds) */
  hiddenIn: Schema.optionalWith(Schema.Array(ViewportId), { default: () => [] }),
  /** Primary viewport for this entity */
  primaryViewport: Schema.optional(ViewportId),
})
export type ViewportPresence = typeof ViewportPresence.Type

/**
 * ViewportBounds trait - viewport-specific bounding state.
 */
export const ViewportBounds = defineTrait('ViewportBounds', {
  /** Whether entity is within current map bounds */
  inMapBounds: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Whether entity is within timeline range */
  inTimelineRange: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Screen position if rendered [x, y] */
  screenPosition: Schema.optional(Schema.Tuple(Schema.Number, Schema.Number)),
})
export type ViewportBounds = typeof ViewportBounds.Type

/**
 * ViewportCluster trait - clustering state for map markers.
 */
export const ViewportCluster = defineTrait('ViewportCluster', {
  /** Whether entity is clustered */
  clustered: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Cluster ID if clustered */
  clusterId: Schema.optional(Schema.String),
  /** Number of entities in cluster (if this is the representative) */
  clusterSize: Schema.optional(Schema.Number),
})
export type ViewportCluster = typeof ViewportCluster.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

registerTrait('ViewportPresence' as TraitId, ViewportPresence)
registerTrait('ViewportBounds' as TraitId, ViewportBounds)
registerTrait('ViewportCluster' as TraitId, ViewportCluster)
