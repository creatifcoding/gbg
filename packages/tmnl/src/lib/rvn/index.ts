/**
 * RVN Component Library
 *
 * Brutalist design system for tactical/industrial interfaces.
 *
 * @example
 * ```tsx
 * import { RvnProvider, RvnTacticalMap, RvnMapMarker } from '@/lib/rvn'
 *
 * <RvnProvider>
 *   <RvnTacticalMap.Frame title="Operations">
 *     <RvnTacticalMap.Canvas>
 *       <MapContent />
 *     </RvnTacticalMap.Canvas>
 *   </RvnTacticalMap.Frame>
 * </RvnProvider>
 * ```
 */

// -----------------------------------------------------------------------------
// Context & Provider
// -----------------------------------------------------------------------------

export { RvnProvider, useRvn, useRvnSafe } from './context'

// -----------------------------------------------------------------------------
// Design Tokens
// -----------------------------------------------------------------------------

export * from './tokens'

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

export * from './hooks'

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

export * from './primitives'

// -----------------------------------------------------------------------------
// Forms
// -----------------------------------------------------------------------------

export * from './forms'

// -----------------------------------------------------------------------------
// Display
// -----------------------------------------------------------------------------

export * from './display'

// -----------------------------------------------------------------------------
// Layout
// -----------------------------------------------------------------------------

export * from './layout'

// -----------------------------------------------------------------------------
// Navigation
// -----------------------------------------------------------------------------

export * from './navigation'

// -----------------------------------------------------------------------------
// Data
// -----------------------------------------------------------------------------

export * from './data'

// -----------------------------------------------------------------------------
// Cards
// -----------------------------------------------------------------------------

export * from './cards'

// -----------------------------------------------------------------------------
// Templates
// -----------------------------------------------------------------------------

export * from './templates'

// -----------------------------------------------------------------------------
// Entity Rendering
// -----------------------------------------------------------------------------

export { EntityRegistry, RvnRenderer } from './entity'
export type {
  TaggedEntity,
  EntityRenderer,
  EntityRegistrationOptions,
  RvnRendererAutoProps,
  RvnRendererDebugProps,
} from './entity'

// -----------------------------------------------------------------------------
// Visualization Components
// -----------------------------------------------------------------------------

export {
  // Compound component
  RvnTacticalMap,
  // Individual components
  RvnCrosshairCorners,
  RvnCrosshairCorner,
  RvnMapMarker,
  RvnThreatMarker,
  RvnDeploymentZone,
  RvnPathTrace,
  RvnMapCoordinates,
  // Mapbox config
  RVN_MAP_COLORS,
  RVN_MAPBOX_STYLE,
  RVN_MAP_LAYER_OVERRIDES,
  RVN_MAP_DEFAULTS,
  RVN_STATIC_GRID_CSS,
  generateGridPattern,
} from './visualization'

export type {
  // TacticalMap types
  TacticalMapContextValue,
  FrameProps,
  CanvasProps,
  OverlayProps,
  CrosshairCornersProps,
  LegendProps,
  LegendItemProps,
  // Component types
  RvnCrosshairCornerProps,
  RvnCrosshairCornersProps,
  CornerPosition,
  RvnMapMarkerProps,
  MarkerPosition,
  RvnThreatMarkerProps,
  ThreatPosition,
  ThreatLevel,
  RvnDeploymentZoneProps,
  ZonePosition,
  ZoneSize,
  ZoneStatus,
  RvnPathTraceProps,
  PathPoint,
  PathStyle,
  RvnMapCoordinatesProps,
  CoordinateFormat,
  DisplayPosition,
  // Mapbox types
  RvnMapboxColors,
  RvnMapboxStyle,
} from './visualization'
