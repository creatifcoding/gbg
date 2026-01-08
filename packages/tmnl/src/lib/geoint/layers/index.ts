// =============================================================================
// GEOINT Layers - Barrel Export
// =============================================================================

// Track layers
export {
  getClassificationColor,
  createTrackPathData,
  createTrackPathLayer,
  createTrackPositionData,
  createTrackPositionLayer,
  createTrackHeadingLayer,
  createTrackLayers,
  createAnimatedTripsLayer,
  type TrackPathLayerData,
  type TrackPositionData,
  type TrackLayerOptions
} from './tracks'

// Feature layers
export {
  layerTypeColors,
  createGeoJsonLayer,
  extractPointFeatures,
  createPointFeatureLayer,
  extractLinearFeatures,
  createLinearFeatureLayer,
  extractPolygonFeatures,
  createPolygonFeatureLayer,
  createFeatureLayers,
  type GeoJsonLayerOptions,
  type PointFeatureData,
  type LinearFeatureData,
  type PolygonFeatureData
} from './features'

// Heatmap layers
export {
  defaultColorRange,
  threatColorRange,
  trackPositionsToHeatmapPoints,
  createTrackHeatmapLayer,
  createPointHeatmapLayer,
  type HeatmapPoint
} from './heatmap'

// Search result layers - ALLINT COP
export {
  createTrackResultsLayer,
  createPoiResultsLayer,
  createPoiLabelsLayer,
  createFlightResultsLayer,
  createFlightLabelsLayer,
  createFeatureResultsLayer,
  createSearchResultLayers,
  type SearchResultLayerOptions,
} from './searchResults'
