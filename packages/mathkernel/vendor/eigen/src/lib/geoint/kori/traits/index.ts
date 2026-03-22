/**
 * GEOINT Kori Traits
 *
 * Barrel exports for all GEOINT trait definitions.
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────────────────────
// Data Traits
// ─────────────────────────────────────────────────────────────────────────────

// Position traits
export {
  GeoPosition,
  GeoPosition3D,
  Heading,
  GeoVelocity,
  type GeoPosition as GeoPositionType,
  type GeoPosition3D as GeoPosition3DType,
  type Heading as HeadingType,
  type GeoVelocity as GeoVelocityType,
} from './position'

// Flight traits
export {
  FlightData,
  FlightRegistration,
  FlightRoute,
  type FlightData as FlightDataType,
  type FlightRegistration as FlightRegistrationType,
  type FlightRoute as FlightRouteType,
} from './flight'

// POI traits
export {
  PoiData,
  PoiTags,
  PoiContact,
  PoiAddress,
  type PoiData as PoiDataType,
  type PoiTags as PoiTagsType,
  type PoiContact as PoiContactType,
  type PoiAddress as PoiAddressType,
} from './poi'

// Weather traits
export {
  WeatherData,
  WeatherWind,
  WeatherPrecipitation,
  WeatherAtmospheric,
  WeatherForecastMeta,
  type WeatherData as WeatherDataType,
  type WeatherWind as WeatherWindType,
  type WeatherPrecipitation as WeatherPrecipitationType,
  type WeatherAtmospheric as WeatherAtmosphericType,
  type WeatherForecastMeta as WeatherForecastMetaType,
} from './weather'

// Track traits
export {
  TrackData,
  TrackHistory,
  TrackSource,
  type TrackData as TrackDataType,
  type TrackHistory as TrackHistoryType,
  type TrackSource as TrackSourceType,
} from './track'

// Imagery traits
export {
  ImageryData,
  ImageryQuality,
  ImageryGeometry,
  ImageryAssets,
  ImagerySatellite,
  type ImageryData as ImageryDataType,
  type ImageryQuality as ImageryQualityType,
  type ImageryGeometry as ImageryGeometryType,
  type ImageryAssets as ImageryAssetsType,
  type ImagerySatellite as ImagerySatelliteType,
} from './imagery'

// ─────────────────────────────────────────────────────────────────────────────
// UI Traits
// ─────────────────────────────────────────────────────────────────────────────

// UI state traits
export {
  UIState,
  UIFocus,
  UIEditState,
  DEFAULT_UI_STATE,
  type UIState as UIStateType,
  type UIFocus as UIFocusType,
  type UIEditState as UIEditStateType,
} from './ui-state'

// Source confidence traits
export {
  SourceConfidence,
  SourceTiming,
  SourceQuality,
  type SourceConfidence as SourceConfidenceType,
  type SourceTiming as SourceTimingType,
  type SourceQuality as SourceQualityType,
} from './source-confidence'

// Viewport presence traits
export {
  ViewportId,
  ViewportPresence,
  ViewportBounds,
  ViewportCluster,
  type ViewportId as ViewportIdType,
  type ViewportPresence as ViewportPresenceType,
  type ViewportBounds as ViewportBoundsType,
  type ViewportCluster as ViewportClusterType,
} from './viewport-presence'

// Animation state traits
export {
  AnimationPhase,
  AnimationState,
  AnimationTarget,
  AnimationEasing,
  DEFAULT_ANIMATION_STATE,
  type AnimationPhase as AnimationPhaseType,
  type AnimationState as AnimationStateType,
  type AnimationTarget as AnimationTargetType,
  type AnimationEasing as AnimationEasingType,
} from './animation-state'

// ─────────────────────────────────────────────────────────────────────────────
// Marker Traits
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Entity type markers
  IsFlight,
  IsPoi,
  IsWeather,
  IsTrack,
  IsImagery,
  IsFeature,
  // UI state markers
  IsSelected,
  IsHovered,
  IsPinned,
  IsHighlighted,
  IsStale,
  // Visibility markers
  IsInMapBounds,
  IsFiltered,
  IsClustered,
  // Animation markers
  IsAnimating,
  IsEntering,
  IsExiting,
  // Types
  type IsFlight as IsFlightType,
  type IsPoi as IsPoiType,
  type IsWeather as IsWeatherType,
  type IsTrack as IsTrackType,
  type IsImagery as IsImageryType,
  type IsFeature as IsFeatureType,
  type IsSelected as IsSelectedType,
  type IsHovered as IsHoveredType,
  type IsPinned as IsPinnedType,
  type IsHighlighted as IsHighlightedType,
  type IsStale as IsStaleType,
  type IsInMapBounds as IsInMapBoundsType,
  type IsFiltered as IsFilteredType,
  type IsClustered as IsClusteredType,
  type IsAnimating as IsAnimatingType,
  type IsEntering as IsEnteringType,
  type IsExiting as IsExitingType,
} from './markers'
