/**
 * GEOINT Fermion Module
 *
 * Schema-driven Atom.family instances per trait type.
 * Each GEOINT trait (GeoPosition, FlightData, TrackData, etc.) gets its own
 * Fermion keyed by entityId — independently fetchable, cacheable, invalidatable.
 *
 * @module geoint/fermion
 */

// ─────────────────────────────────────────────────────────────────────────────
// Trait Fermions — one per trait type
// ─────────────────────────────────────────────────────────────────────────────

// Position
export {
  geoPositionFermion,
  geoPosition3DFermion,
  headingFermion,
  geoVelocityFermion,
} from './trait-fermions'

// Flight
export {
  flightDataFermion,
  flightRegistrationFermion,
  flightRouteFermion,
} from './trait-fermions'

// Track
export {
  trackDataFermion,
  trackHistoryFermion,
  trackSourceFermion,
} from './trait-fermions'

// UI
export {
  uiStateFermion,
  uiFocusFermion,
  uiEditStateFermion,
} from './trait-fermions'

// Animation
export {
  animationStateFermion,
  animationTargetFermion,
  animationEasingFermion,
} from './trait-fermions'

// Source Confidence
export {
  sourceConfidenceFermion,
  sourceTimingFermion,
  sourceQualityFermion,
} from './trait-fermions'

// POI
export {
  poiDataFermion,
  poiTagsFermion,
  poiContactFermion,
  poiAddressFermion,
} from './trait-fermions'

// Weather
export {
  weatherDataFermion,
  weatherWindFermion,
  weatherPrecipitationFermion,
  weatherAtmosphericFermion,
  weatherForecastMetaFermion,
} from './trait-fermions'

// Imagery
export {
  imageryDataFermion,
  imageryQualityFermion,
  imageryGeometryFermion,
  imageryAssetsFermion,
  imagerySatelliteFermion,
} from './trait-fermions'

// ─────────────────────────────────────────────────────────────────────────────
// Registry & Bulk Operations
// ─────────────────────────────────────────────────────────────────────────────

export {
  traitRegistry,
  despawnEntityTraits,
  clearAllTraitStores,
  getEntityTraitNames,
  TraitNotFoundError,
} from './trait-fermions'
