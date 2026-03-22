/**
 * BaseMap Types
 *
 * Shared type definitions for the registry-backed map primitive.
 * These types are used across MapToolView (Terminal), MapBlockView (Editor),
 * and future AI-streamable map configurations.
 *
 * @module primitives/map/types
 */

import type { ReactNode } from 'react'
import type { MapViewState, PickingInfo } from '@deck.gl/core'

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * Geographic position as [longitude, latitude] or [longitude, latitude, altitude]
 */
export type Position = [number, number] | [number, number, number]

/**
 * Map marker data
 */
export interface MapMarker {
  /** Unique identifier */
  id?: string
  /** Position as [longitude, latitude] */
  position: Position
  /** Display label */
  label?: string
  /** Description text */
  description?: string
  /** Color as RGB tuple */
  color?: [number, number, number]
  /** Marker icon name */
  icon?: string
  /** Marker size in pixels */
  size?: number
  /** Popup/tooltip content */
  popup?: string
}

/**
 * Map layer types supported by DeckGL
 */
export type MapLayerType =
  | 'scatterplot'
  | 'path'
  | 'polygon'
  | 'geojson'
  | 'icon'
  | 'text'
  | 'heatmap'

/**
 * Map layer definition
 */
export interface MapLayer {
  /** Unique identifier */
  id: string
  /** Layer type */
  type: MapLayerType
  /** Layer data (GeoJSON FeatureCollection or array) */
  data: unknown
  /** Layer visibility */
  visible?: boolean
  /** Layer opacity (0-1) */
  opacity?: number
  /** Fill/stroke color */
  color?: [number, number, number] | string
  /** Radius for scatterplot layers */
  radius?: number
  /** Line width for path/polygon layers */
  lineWidth?: number
  /** Fill for polygon layers */
  filled?: boolean
  /** Stroke for polygon layers */
  stroked?: boolean
}

/**
 * Geographic bounds
 */
export interface MapBounds {
  /** Northern latitude (-90 to 90) */
  north: number
  /** Southern latitude (-90 to 90) */
  south: number
  /** Eastern longitude (-180 to 180) */
  east: number
  /** Western longitude (-180 to 180) */
  west: number
}

// =============================================================================
// BaseMap Props
// =============================================================================

/**
 * BaseMap component props (Atoms-Only)
 *
 * All state managed via registry atoms keyed by instanceId:
 * - viewState, markers: getViewStateAtom(id), getMarkersAtom(id)
 * - dimensions, mapLoaded, error: per-instance atoms
 *
 * Embedding contexts:
 * 1. Create instance atoms via createMapInstanceAtoms(instanceId)
 * 2. Set initial state via mapRegistry.set(atom, value)
 * 3. Register interactions via registerInteraction(event, handler)
 * 4. Render <BaseMap instanceId={id} />
 */
export interface BaseMapProps {
  // === Instance ID (required) ===

  /**
   * Unique instance ID for atom-based state management.
   * All state (viewState, markers, dimensions, etc.) is stored in
   * per-instance atoms accessed via this ID.
   */
  instanceId: string

  // === Styling ===

  /** Mapbox style URL (overrides activeStyleAtom) */
  mapStyle?: string

  /** Container height (number for px, string for CSS value) */
  height?: number | string

  /** Additional CSS class */
  className?: string

  /** Marker default color */
  markerColor?: [number, number, number]

  /** Marker default radius */
  markerRadius?: number

  // === Feature Flags ===

  /** Enable pan/zoom/rotate interactions (default: true) */
  interactive?: boolean

  /** Show marker layer (default: true) */
  showMarkers?: boolean

  /**
   * Enable debug mode with traced atom operations.
   * When true, all atom reads/writes emit structured events to
   * testbed logger and DevTools for debugging state flow.
   */
  debug?: boolean

  // === Render Props (customization points) ===

  /** Custom loading state renderer */
  renderLoading?: () => ReactNode

  /** Custom error state renderer */
  renderError?: (error: string) => ReactNode

  /** Custom overlay renderer (title, badges, controls) */
  renderOverlay?: () => ReactNode
}

// =============================================================================
// Registry Types
// =============================================================================

/**
 * Map style configuration
 */
export interface MapStyleConfig {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Mapbox style URL */
  url: string
}

/**
 * Interaction event types
 */
export type InteractionEvent = 'click' | 'hover' | 'select' | 'contextmenu'

/**
 * Interaction handler function
 */
export type InteractionHandler = (info: PickingInfo, marker?: MapMarker) => void

/**
 * Widget position in the map container
 */
export type WidgetPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'bottom-center'

/**
 * Widget definition for the widget registry
 */
export interface WidgetDefinition {
  /** Unique identifier */
  id: string
  /** Position in container */
  position: WidgetPosition
  /** Widget component */
  component: ReactNode
  /** Z-index for stacking */
  zIndex?: number
}

// =============================================================================
// Re-exports
// =============================================================================

export type { MapViewState, PickingInfo }
