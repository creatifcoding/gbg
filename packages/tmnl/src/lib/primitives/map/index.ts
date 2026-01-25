/**
 * Map Primitive
 *
 * Registry-backed map component with dependency inversion.
 *
 * @module primitives/map
 */

export { BaseMap } from './BaseMap'

// Registry exports for embedding contexts
export {
  // Module-level registry
  mapRegistry,

  // Instance atom factories
  createMapInstanceAtoms,
  createTracedMapAtoms,
  disposeInstanceAtoms,
  getViewStateAtom,
  getMarkersAtom,
  getLoadingAtom,
  getErrorAtom,
  getDimensionsAtom,
  getMapLoadedAtom,

  // Global atoms
  mapStylesAtom,
  activeStyleIdAtom,
  activeStyleAtom,

  // Interaction registry
  interactionHandlersAtom,
  registerInteraction,
  unregisterInteraction,
  invokeInteraction,

  // Widget registry
  widgetsAtom,
  widgetsByPositionAtom,
  registerWidget,
  unregisterWidget,
} from './registries'

export type { MapInstanceAtoms, MapInteractionHandler, TracedAtomGroup } from './registries'

// Effect Schemas for AI-streamable configs
export {
  PositionSchema,
  RGBColorSchema,
  MapMarkerSchema,
  MapLayerTypeSchema,
  MapLayerSchema,
  MapBoundsSchema,
  ViewStateSchema,
  MapStyleConfigSchema,
  MapConfigSchema,
  PartialMarkerUpdateSchema,
  PartialViewStateUpdateSchema,
  MapUpdateCommandSchema,
} from './schemas'

export type {
  Position as PositionConfig,
  RGBColor,
  MapMarkerConfig,
  MapLayerConfig,
  MapBoundsConfig,
  ViewState,
  MapConfig,
  MapUpdateCommand,
} from './schemas'

export type {
  // Core data types
  Position,
  MapMarker,
  MapLayer,
  MapLayerType,
  MapBounds,

  // Component props
  BaseMapProps,

  // Registry types
  MapStyleConfig,
  InteractionEvent,
  InteractionHandler,
  WidgetPosition,
  WidgetDefinition,

  // Re-exports from deck.gl
  MapViewState,
  PickingInfo,
} from './types'
