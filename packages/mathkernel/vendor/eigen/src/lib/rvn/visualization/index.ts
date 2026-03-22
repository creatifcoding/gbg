/**
 * RVN Visualization Components
 *
 * Tactical map and visualization components for the RVN design system.
 *
 * @example Basic tactical map
 * ```tsx
 * import {
 *   RvnTacticalMap,
 *   RvnMapMarker,
 *   RvnThreatMarker,
 *   RvnDeploymentZone,
 * } from '@/lib/rvn/visualization'
 *
 * <RvnTacticalMap.Frame title="Tactical Overlay" subtitle="SECTOR 09-Z">
 *   <RvnTacticalMap.Canvas>
 *     <MapboxMapComponent />
 *   </RvnTacticalMap.Canvas>
 *   <RvnTacticalMap.Overlay>
 *     <RvnTacticalMap.CrosshairCorners />
 *     <RvnDeploymentZone
 *       position={{ x: '10%', y: '70%' }}
 *       size={{ width: '150px', height: '100px' }}
 *       label="DZ_ALPHA"
 *     />
 *     <RvnMapMarker
 *       position={{ x: '45%', y: '35%' }}
 *       label="PRIMARY_ARRAY"
 *     />
 *     <RvnThreatMarker
 *       position={{ x: '50%', y: '20%' }}
 *       designation="T1"
 *     />
 *     <RvnTacticalMap.Legend>
 *       <RvnTacticalMap.LegendItem
 *         indicator={<RvnTacticalMap.SolidIndicator />}
 *         label="HOSTILE_UNIT"
 *       />
 *       <RvnTacticalMap.LegendItem
 *         indicator={<RvnTacticalMap.DashedIndicator />}
 *         label="DEPLOY_ZONE"
 *       />
 *     </RvnTacticalMap.Legend>
 *   </RvnTacticalMap.Overlay>
 * </RvnTacticalMap.Frame>
 * ```
 */

// Compound component
export { RvnTacticalMap } from './RvnTacticalMap'
export type {
  TacticalMapContextValue,
  FrameProps,
  CanvasProps,
  OverlayProps,
  CrosshairCornersProps,
  LegendProps,
  LegendItemProps,
} from './RvnTacticalMap'

// Individual components
export { RvnCrosshairCorners, RvnCrosshairCorner } from './RvnCrosshairCorners'
export type { RvnCrosshairCornerProps, RvnCrosshairCornersProps, CornerPosition } from './RvnCrosshairCorners'

export { RvnMapMarker } from './RvnMapMarker'
export type { RvnMapMarkerProps, MarkerPosition } from './RvnMapMarker'

export { RvnThreatMarker } from './RvnThreatMarker'
export type { RvnThreatMarkerProps, ThreatPosition, ThreatLevel } from './RvnThreatMarker'

export { RvnDeploymentZone } from './RvnDeploymentZone'
export type { RvnDeploymentZoneProps, ZonePosition, ZoneSize, ZoneStatus } from './RvnDeploymentZone'

export { RvnPathTrace } from './RvnPathTrace'
export type { RvnPathTraceProps, PathPoint, PathStyle } from './RvnPathTrace'

export { RvnMapCoordinates } from './RvnMapCoordinates'
export type { RvnMapCoordinatesProps, CoordinateFormat, DisplayPosition } from './RvnMapCoordinates'

export { RvnMapLabel } from './RvnMapLabel'
export type { RvnMapLabelProps, LabelPosition, LabelSize } from './RvnMapLabel'

export { RvnPOIMarker } from './RvnPOIMarker'
export type { RvnPOIMarkerProps, POIPosition, POICategory } from './RvnPOIMarker'

export { RvnRoadLabel } from './RvnRoadLabel'
export type { RvnRoadLabelProps } from './RvnRoadLabel'
// Note: PathPoint is re-exported from RvnPathTrace above

// Mapbox configuration
export {
  RVN_MAP_COLORS,
  RVN_MAPBOX_STYLE,
  RVN_MAP_LAYER_OVERRIDES,
  RVN_MAP_DEFAULTS,
  RVN_STATIC_GRID_CSS,
  generateGridPattern,
} from './rvn-mapbox-config'
export type { RvnMapboxColors, RvnMapboxStyle } from './rvn-mapbox-config'
