/**
 * GEOINT Marker Traits
 *
 * Tag-only (marker) traits for entity type identification.
 * These have no data, just the presence of the trait indicates the entity type.
 *
 * @module
 */

import { defineTagTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'

// ─────────────────────────────────────────────────────────────────────────────
// Entity Type Markers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IsFlight marker - entity is an aircraft/flight.
 */
export const IsFlight = defineTagTrait('IsFlight')
export type IsFlight = typeof IsFlight.Type

/**
 * IsPoi marker - entity is a POI (point of interest).
 */
export const IsPoi = defineTagTrait('IsPoi')
export type IsPoi = typeof IsPoi.Type

/**
 * IsWeather marker - entity is a weather observation.
 */
export const IsWeather = defineTagTrait('IsWeather')
export type IsWeather = typeof IsWeather.Type

/**
 * IsTrack marker - entity is an internal track.
 */
export const IsTrack = defineTagTrait('IsTrack')
export type IsTrack = typeof IsTrack.Type

/**
 * IsImagery marker - entity is satellite imagery.
 */
export const IsImagery = defineTagTrait('IsImagery')
export type IsImagery = typeof IsImagery.Type

/**
 * IsFeature marker - entity is a static feature.
 */
export const IsFeature = defineTagTrait('IsFeature')
export type IsFeature = typeof IsFeature.Type

// ─────────────────────────────────────────────────────────────────────────────
// UI State Markers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IsSelected marker - entity is currently selected.
 * Alternative to UIState.selected for query efficiency.
 */
export const IsSelected = defineTagTrait('IsSelected')
export type IsSelected = typeof IsSelected.Type

/**
 * IsHovered marker - entity is currently hovered.
 * Alternative to UIState.hovered for query efficiency.
 */
export const IsHovered = defineTagTrait('IsHovered')
export type IsHovered = typeof IsHovered.Type

/**
 * IsPinned marker - entity is pinned (persists across searches).
 */
export const IsPinned = defineTagTrait('IsPinned')
export type IsPinned = typeof IsPinned.Type

/**
 * IsHighlighted marker - entity is highlighted.
 */
export const IsHighlighted = defineTagTrait('IsHighlighted')
export type IsHighlighted = typeof IsHighlighted.Type

/**
 * IsStale marker - entity data is stale.
 */
export const IsStale = defineTagTrait('IsStale')
export type IsStale = typeof IsStale.Type

// ─────────────────────────────────────────────────────────────────────────────
// Visibility Markers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IsInMapBounds marker - entity is within map viewport.
 */
export const IsInMapBounds = defineTagTrait('IsInMapBounds')
export type IsInMapBounds = typeof IsInMapBounds.Type

/**
 * IsFiltered marker - entity is filtered out (hidden).
 */
export const IsFiltered = defineTagTrait('IsFiltered')
export type IsFiltered = typeof IsFiltered.Type

/**
 * IsClustered marker - entity is part of a cluster.
 */
export const IsClustered = defineTagTrait('IsClustered')
export type IsClustered = typeof IsClustered.Type

// ─────────────────────────────────────────────────────────────────────────────
// Animation Markers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IsAnimating marker - entity is currently animating.
 */
export const IsAnimating = defineTagTrait('IsAnimating')
export type IsAnimating = typeof IsAnimating.Type

/**
 * IsEntering marker - entity is entering/appearing.
 */
export const IsEntering = defineTagTrait('IsEntering')
export type IsEntering = typeof IsEntering.Type

/**
 * IsExiting marker - entity is exiting/disappearing.
 */
export const IsExiting = defineTagTrait('IsExiting')
export type IsExiting = typeof IsExiting.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

// Entity type markers
registerTrait('IsFlight' as TraitId, IsFlight, true)
registerTrait('IsPoi' as TraitId, IsPoi, true)
registerTrait('IsWeather' as TraitId, IsWeather, true)
registerTrait('IsTrack' as TraitId, IsTrack, true)
registerTrait('IsImagery' as TraitId, IsImagery, true)
registerTrait('IsFeature' as TraitId, IsFeature, true)

// UI state markers
registerTrait('IsSelected' as TraitId, IsSelected, true)
registerTrait('IsHovered' as TraitId, IsHovered, true)
registerTrait('IsPinned' as TraitId, IsPinned, true)
registerTrait('IsHighlighted' as TraitId, IsHighlighted, true)
registerTrait('IsStale' as TraitId, IsStale, true)

// Visibility markers
registerTrait('IsInMapBounds' as TraitId, IsInMapBounds, true)
registerTrait('IsFiltered' as TraitId, IsFiltered, true)
registerTrait('IsClustered' as TraitId, IsClustered, true)

// Animation markers
registerTrait('IsAnimating' as TraitId, IsAnimating, true)
registerTrait('IsEntering' as TraitId, IsEntering, true)
registerTrait('IsExiting' as TraitId, IsExiting, true)
