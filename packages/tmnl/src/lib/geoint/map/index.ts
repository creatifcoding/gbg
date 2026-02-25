/**
 * GEOINT Map Module — Unified MapController + Schemas + Geodesic Math
 *
 * @module geoint/map
 */

// Controller
export { MapController } from './MapController'

// Schemas
export {
  GeoCoord,
  GeoBounds,
  ViewportState,
  FlyToTarget,
  CameraEasing,
  LayerKey,
  MapStyle,
  MAP_STYLE_URLS,
  MAP_STYLE_ORDER,
  ScreenCoord,
  DistanceResult,
  BearingResult,
  AreaResult,
  Cardinal,
  ExportFormat,
  ExportResult,
  DrawingMode,
  MarkerOptions,
  MapControllerStatus,
  DEFAULT_VIEWPORT,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
} from './schemas'

// Geodesic math (pure functions + types)
export type { GeoCoordInput } from './geodesic'
export {
  haversineDistance,
  initialBearing,
  geodesicArea,
  metersToKm,
  metersToNauticalMiles,
  sqMetersToSqKm,
  sqMetersToAcres,
  toCardinal,
  metersPerPixel,
  computeDistance,
  computeBearing,
  computeArea,
  calculateGeoBounds,
  boundsToViewport,
} from './geodesic'
