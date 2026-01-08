/**
 * ALLINT COP Search Schemas
 *
 * Effect Schema definitions for the All-Source Intelligence Common Operating Picture
 * search system. Provides TaggedClasses for:
 *
 * - Multi-source search queries (tracks, features, POI, flights)
 * - Geographic filters (bounds, radius, polygon)
 * - Temporal filters (time ranges, relative times)
 * - Third-party API integration schemas (OpenSky, Overpass)
 * - Aggregated search results with source attribution
 *
 * @see beads:tmnl-kv2vg Schema Architecture: SearchQuery TaggedClasses
 * @module
 */

import { Schema } from 'effect'
import {
  BBox,
  TrackId,
  FeatureId,
  Classification,
  ObjectType,
  Position,
  Position3D
} from './core'

// =============================================================================
// Branded IDs
// =============================================================================

/** Unique identifier for a search query */
export const SearchId = Schema.String.pipe(Schema.brand('SearchId'))
export type SearchId = typeof SearchId.Type

/** Unique identifier for a search result item */
export const SearchResultId = Schema.String.pipe(Schema.brand('SearchResultId'))
export type SearchResultId = typeof SearchResultId.Type

/** Unique identifier for a POI (Point of Interest) */
export const PoiId = Schema.String.pipe(Schema.brand('PoiId'))
export type PoiId = typeof PoiId.Type

/** ICAO24 transponder address (hex string) for aircraft */
export const Icao24 = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{6}$/i),
  Schema.brand('Icao24')
)
export type Icao24 = typeof Icao24.Type

// =============================================================================
// Intelligence Source Types
// =============================================================================

/** Intelligence source domain types */
export const IntelSource = Schema.Literal(
  'track',      // Internal track system
  'feature',    // Static features/geometry
  'osm',        // OpenStreetMap (Overpass API)
  'opensky',    // OpenSky Network (ADS-B)
  'adsb_lol',   // adsb.lol community feed
  'planet',     // Planet Labs satellite imagery
  'sentinel',   // Sentinel Hub / Copernicus satellite
  'weather',    // Open-Meteo weather data
  'custom'      // User-defined sources
)
export type IntelSource = typeof IntelSource.Type

/** POI category types from OSM */
export const PoiCategory = Schema.Literal(
  'amenity',
  'building',
  'highway',
  'landuse',
  'leisure',
  'natural',
  'shop',
  'tourism',
  'aeroway',
  'military',
  'emergency',
  'healthcare',
  'office',
  'public_transport'
)
export type PoiCategory = typeof PoiCategory.Type

/** Aircraft category for flight tracking */
export const AircraftCategory = Schema.Literal(
  'light',
  'medium',
  'heavy',
  'super',
  'rotorcraft',
  'glider',
  'balloon',
  'uav',
  'space',
  'unknown'
)
export type AircraftCategory = typeof AircraftCategory.Type

// =============================================================================
// Geographic Filters
// =============================================================================

/** Bounding box filter */
export class GeoFilterBounds extends Schema.TaggedClass<GeoFilterBounds>(
  'GeoFilterBounds'
)('GeoFilterBounds', {
  bounds: BBox
}) {}

/** Radius filter (point + distance) */
export class GeoFilterRadius extends Schema.TaggedClass<GeoFilterRadius>(
  'GeoFilterRadius'
)('GeoFilterRadius', {
  /** Center point [lon, lat] */
  center: Position,
  /** Radius in meters */
  radiusMeters: Schema.Number.pipe(Schema.positive())
}) {}

/** Polygon filter (array of coordinates forming closed ring) */
export class GeoFilterPolygon extends Schema.TaggedClass<GeoFilterPolygon>(
  'GeoFilterPolygon'
)('GeoFilterPolygon', {
  /** Ring coordinates (first = last for closure) */
  ring: Schema.Array(Position).pipe(Schema.minItems(4))
}) {}

/** Union of geographic filters */
export const GeoFilter = Schema.Union(
  GeoFilterBounds,
  GeoFilterRadius,
  GeoFilterPolygon
)
export type GeoFilter = typeof GeoFilter.Type

// =============================================================================
// Temporal Filters
// =============================================================================

/** Absolute time range filter */
export class TemporalFilterRange extends Schema.TaggedClass<TemporalFilterRange>(
  'TemporalFilterRange'
)('TemporalFilterRange', {
  /** Start of time range (inclusive) */
  start: Schema.Date,
  /** End of time range (inclusive) */
  end: Schema.Date
}) {}

/** Relative time filter (e.g., "last 30 minutes") */
export class TemporalFilterRelative extends Schema.TaggedClass<TemporalFilterRelative>(
  'TemporalFilterRelative'
)('TemporalFilterRelative', {
  /** Duration in seconds to look back from now */
  lastSeconds: Schema.Number.pipe(Schema.positive()),
  /** Whether to include future extrapolations */
  includeFuture: Schema.optionalWith(Schema.Boolean, { default: () => false })
}) {}

/** Union of temporal filters */
export const TemporalFilter = Schema.Union(
  TemporalFilterRange,
  TemporalFilterRelative
)
export type TemporalFilter = typeof TemporalFilter.Type

// =============================================================================
// Source-Specific Filters
// =============================================================================

/** Filter for track queries */
export class TrackFilter extends Schema.TaggedClass<TrackFilter>(
  'TrackFilter'
)('TrackFilter', {
  /** Filter by object type */
  objectType: Schema.optional(ObjectType),
  /** Filter by classification */
  classification: Schema.optional(Classification),
  /** Minimum confidence threshold */
  minConfidence: Schema.optionalWith(
    Schema.Number.pipe(Schema.between(0, 1)),
    { default: () => 0 }
  ),
  /** Only active tracks */
  active: Schema.optionalWith(Schema.Boolean, { default: () => true })
}) {}

/** Filter for OSM/Overpass queries */
export class OsmFilter extends Schema.TaggedClass<OsmFilter>(
  'OsmFilter'
)('OsmFilter', {
  /** POI categories to include */
  categories: Schema.optionalWith(Schema.Array(PoiCategory), {
    default: () => []
  }),
  /** OSM tag key-value filters (e.g., { amenity: 'hospital' }) */
  tags: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.String }),
    { default: () => ({}) }
  ),
  /** Free-text name search */
  nameSearch: Schema.optional(Schema.String)
}) {}

/** Filter for OpenSky/ADS-B queries */
export class FlightFilter extends Schema.TaggedClass<FlightFilter>(
  'FlightFilter'
)('FlightFilter', {
  /** Specific ICAO24 addresses */
  icao24: Schema.optionalWith(Schema.Array(Icao24), { default: () => [] }),
  /** Filter by callsign pattern */
  callsignPattern: Schema.optional(Schema.String),
  /** Aircraft category */
  category: Schema.optional(AircraftCategory),
  /** Minimum altitude in meters */
  minAltitude: Schema.optional(Schema.Number),
  /** Maximum altitude in meters */
  maxAltitude: Schema.optional(Schema.Number),
  /** Only include grounded aircraft */
  onGround: Schema.optional(Schema.Boolean)
}) {}

/** Filter for static features */
export class FeatureFilter extends Schema.TaggedClass<FeatureFilter>(
  'FeatureFilter'
)('FeatureFilter', {
  /** Specific feature IDs */
  featureIds: Schema.optionalWith(Schema.Array(FeatureId), {
    default: () => []
  }),
  /** Property key-value filters */
  properties: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) }
  )
}) {}

/** Union of source-specific filters */
export const SourceFilter = Schema.Union(
  TrackFilter,
  OsmFilter,
  FlightFilter,
  FeatureFilter
)
export type SourceFilter = typeof SourceFilter.Type

// =============================================================================
// Search Query
// =============================================================================

/** Complete search query with all filters */
export class SearchQuery extends Schema.TaggedClass<SearchQuery>(
  'SearchQuery'
)('SearchQuery', {
  /** Query identifier */
  id: SearchId,

  /** Free-text search term */
  text: Schema.optionalWith(Schema.String, { default: () => '' }),

  /** Geographic filter (required for spatial queries) */
  geoFilter: Schema.optional(GeoFilter),

  /** Temporal filter */
  temporalFilter: Schema.optional(TemporalFilter),

  /** Sources to query (empty = all available) */
  sources: Schema.optionalWith(Schema.Array(IntelSource), {
    default: () => []
  }),

  /** Source-specific filters */
  sourceFilters: Schema.optionalWith(Schema.Array(SourceFilter), {
    default: () => []
  }),

  /** Maximum results per source */
  limitPerSource: Schema.optionalWith(
    Schema.Number.pipe(Schema.positive()),
    { default: () => 100 }
  ),

  /** Total result limit across all sources */
  totalLimit: Schema.optionalWith(
    Schema.Number.pipe(Schema.positive()),
    { default: () => 500 }
  ),

  /** Include extended metadata in results */
  includeMetadata: Schema.optionalWith(Schema.Boolean, { default: () => true })
}) {}

// =============================================================================
// Search Result Items (Discriminated Union)
// =============================================================================

/** Base fields shared by all result items */
const SearchResultBase = {
  /** Unique result identifier */
  id: SearchResultId,
  /** Source that provided this result */
  source: IntelSource,
  /** Result relevance score (0-1) */
  score: Schema.Number.pipe(Schema.between(0, 1)),
  /** Timestamp when result was retrieved */
  retrievedAt: Schema.Date
}

/** Track search result */
export class SearchResultTrack extends Schema.TaggedClass<SearchResultTrack>(
  'SearchResultTrack'
)('SearchResultTrack', {
  ...SearchResultBase,
  trackId: TrackId,
  position: Position3D,
  heading: Schema.Number.pipe(Schema.between(0, 360)),
  speed: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  classification: Classification,
  objectType: ObjectType,
  label: Schema.optionalWith(Schema.String, { default: () => '' })
}) {}

/** OSM POI search result */
export class SearchResultPoi extends Schema.TaggedClass<SearchResultPoi>(
  'SearchResultPoi'
)('SearchResultPoi', {
  ...SearchResultBase,
  poiId: PoiId,
  position: Position,
  name: Schema.String,
  category: PoiCategory,
  tags: Schema.Record({ key: Schema.String, value: Schema.String })
}) {}

/** Flight search result (OpenSky/ADS-B) */
export class SearchResultFlight extends Schema.TaggedClass<SearchResultFlight>(
  'SearchResultFlight'
)('SearchResultFlight', {
  ...SearchResultBase,
  icao24: Icao24,
  callsign: Schema.optionalWith(Schema.String, { default: () => '' }),
  position: Position3D,
  velocity: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  heading: Schema.Number.pipe(Schema.between(0, 360)),
  verticalRate: Schema.Number,
  onGround: Schema.Boolean,
  category: AircraftCategory,
  originCountry: Schema.String,
  lastContact: Schema.Date
}) {}

/** Feature search result */
export class SearchResultFeature extends Schema.TaggedClass<SearchResultFeature>(
  'SearchResultFeature'
)('SearchResultFeature', {
  ...SearchResultBase,
  featureId: FeatureId,
  position: Position,
  geometryType: Schema.Literal('Point', 'LineString', 'Polygon'),
  properties: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  label: Schema.optionalWith(Schema.String, { default: () => '' })
}) {}

/** Weather search result (Open-Meteo) */
export class SearchResultWeather extends Schema.TaggedClass<SearchResultWeather>(
  'SearchResultWeather'
)('SearchResultWeather', {
  ...SearchResultBase,
  /** Location name (from geocoding or user query) */
  locationName: Schema.String,
  /** Position [lon, lat] */
  position: Position,
  /** Elevation in meters */
  elevation: Schema.optional(Schema.Number),
  /** Timezone */
  timezone: Schema.optional(Schema.String),
  /** Current temperature in Celsius */
  temperature: Schema.Number,
  /** Feels-like temperature in Celsius */
  feelsLike: Schema.optional(Schema.Number),
  /** Relative humidity (0-100) */
  humidity: Schema.optional(Schema.Number),
  /** WMO weather code */
  weatherCode: Schema.optional(Schema.Number),
  /** Weather description (derived from code) */
  weatherDescription: Schema.optional(Schema.String),
  /** Wind speed in m/s */
  windSpeed: Schema.optional(Schema.Number),
  /** Wind direction in degrees */
  windDirection: Schema.optional(Schema.Number),
  /** Cloud cover percentage (0-100) */
  cloudCover: Schema.optional(Schema.Number),
  /** Precipitation in mm */
  precipitation: Schema.optional(Schema.Number),
  /** Atmospheric pressure in hPa */
  pressure: Schema.optional(Schema.Number),
  /** UV index */
  uvIndex: Schema.optional(Schema.Number),
  /** Is daytime */
  isDay: Schema.optional(Schema.Boolean),
  /** Forecast timestamp */
  forecastTime: Schema.Date,
  /** Has hourly forecast available */
  hasHourlyForecast: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Has daily forecast available */
  hasDailyForecast: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

/** Satellite imagery search result (Planet Labs / Sentinel Hub) */
export class SearchResultImagery extends Schema.TaggedClass<SearchResultImagery>(
  'SearchResultImagery'
)('SearchResultImagery', {
  ...SearchResultBase,
  /** Item ID from provider */
  itemId: Schema.String,
  /** Provider name */
  provider: Schema.Literal('planet', 'sentinel'),
  /** Collection/item type */
  collection: Schema.String,
  /** Position (centroid of imagery footprint) */
  position: Position,
  /** Acquisition datetime */
  acquired: Schema.Date,
  /** Cloud cover percentage (0-100) */
  cloudCover: Schema.optional(Schema.Number),
  /** Ground sample distance in meters */
  gsd: Schema.optional(Schema.Number),
  /** Sun azimuth angle */
  sunAzimuth: Schema.optional(Schema.Number),
  /** Sun elevation angle */
  sunElevation: Schema.optional(Schema.Number),
  /** Off-nadir viewing angle */
  offNadir: Schema.optional(Schema.Number),
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bbox: Schema.optional(Schema.Array(Schema.Number)),
  /** Thumbnail URL if available */
  thumbnailUrl: Schema.optional(Schema.String),
  /** Assets URL for downloading */
  assetsUrl: Schema.optional(Schema.String),
  /** Label for display */
  label: Schema.optionalWith(Schema.String, { default: () => '' }),
}) {}

/** Union of all search result types */
export const SearchResultItem = Schema.Union(
  SearchResultTrack,
  SearchResultPoi,
  SearchResultFlight,
  SearchResultFeature,
  SearchResultWeather,
  SearchResultImagery
)
export type SearchResultItem = typeof SearchResultItem.Type

// =============================================================================
// Search Response
// =============================================================================

/** Aggregated search response */
export class SearchResponse extends Schema.TaggedClass<SearchResponse>(
  'SearchResponse'
)('SearchResponse', {
  /** Original query ID */
  queryId: SearchId,

  /** Total results found (before limiting) */
  totalCount: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),

  /** Results returned (after limiting) */
  results: Schema.Array(SearchResultItem),

  /** Per-source result counts (keyed by IntelSource string) */
  sourceCounts: Schema.Record({
    key: Schema.String,
    value: Schema.Number
  }),

  /** Query execution time in milliseconds */
  executionTimeMs: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),

  /** Whether results were truncated due to limits */
  truncated: Schema.Boolean,

  /** Errors encountered per source (source -> error message) */
  errors: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.String }),
    { default: () => ({}) }
  )
}) {}

// =============================================================================
// Streaming Search Events
// =============================================================================

/** Search started event */
export class SearchStarted extends Schema.TaggedClass<SearchStarted>(
  'SearchStarted'
)('SearchStarted', {
  queryId: SearchId,
  sources: Schema.Array(IntelSource),
  startedAt: Schema.Date
}) {}

/** Partial results from a source */
export class SearchPartialResults extends Schema.TaggedClass<SearchPartialResults>(
  'SearchPartialResults'
)('SearchPartialResults', {
  queryId: SearchId,
  source: IntelSource,
  results: Schema.Array(SearchResultItem),
  isComplete: Schema.Boolean
}) {}

/** Source completed event */
export class SearchSourceComplete extends Schema.TaggedClass<SearchSourceComplete>(
  'SearchSourceComplete'
)('SearchSourceComplete', {
  queryId: SearchId,
  source: IntelSource,
  resultCount: Schema.Number,
  durationMs: Schema.Number
}) {}

/** Source error event */
export class SearchSourceError extends Schema.TaggedClass<SearchSourceError>(
  'SearchSourceError'
)('SearchSourceError', {
  queryId: SearchId,
  source: IntelSource,
  error: Schema.String,
  retryable: Schema.Boolean
}) {}

/** Search completed event */
export class SearchCompleted extends Schema.TaggedClass<SearchCompleted>(
  'SearchCompleted'
)('SearchCompleted', {
  queryId: SearchId,
  totalResults: Schema.Number,
  completedAt: Schema.Date
}) {}

/** Union of search streaming events */
export const SearchEvent = Schema.Union(
  SearchStarted,
  SearchPartialResults,
  SearchSourceComplete,
  SearchSourceError,
  SearchCompleted
)
export type SearchEvent = typeof SearchEvent.Type

// =============================================================================
// External API Schemas
// =============================================================================

/** OpenSky API state vector (raw response mapping) */
export class OpenSkyStateVector extends Schema.TaggedClass<OpenSkyStateVector>(
  'OpenSkyStateVector'
)('OpenSkyStateVector', {
  icao24: Icao24,
  callsign: Schema.NullOr(Schema.String),
  originCountry: Schema.String,
  timePosition: Schema.NullOr(Schema.Number),
  lastContact: Schema.Number,
  longitude: Schema.NullOr(Schema.Number),
  latitude: Schema.NullOr(Schema.Number),
  baroAltitude: Schema.NullOr(Schema.Number),
  onGround: Schema.Boolean,
  velocity: Schema.NullOr(Schema.Number),
  trueTrack: Schema.NullOr(Schema.Number),
  verticalRate: Schema.NullOr(Schema.Number),
  sensors: Schema.NullOr(Schema.Array(Schema.Number)),
  geoAltitude: Schema.NullOr(Schema.Number),
  squawk: Schema.NullOr(Schema.String),
  spi: Schema.Boolean,
  positionSource: Schema.Number,
  category: Schema.optionalWith(Schema.Number, { default: () => 0 })
}) {}

/** OpenSky API response */
export class OpenSkyResponse extends Schema.TaggedClass<OpenSkyResponse>(
  'OpenSkyResponse'
)('OpenSkyResponse', {
  time: Schema.Number,
  states: Schema.NullOr(Schema.Array(OpenSkyStateVector))
}) {}

/** Overpass API element (OSM node/way/relation) */
export class OverpassElement extends Schema.TaggedClass<OverpassElement>(
  'OverpassElement'
)('OverpassElement', {
  type: Schema.Literal('node', 'way', 'relation'),
  id: Schema.Number,
  lat: Schema.optional(Schema.Number),
  lon: Schema.optional(Schema.Number),
  center: Schema.optional(Schema.Struct({
    lat: Schema.Number,
    lon: Schema.Number
  })),
  tags: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.String }),
    { default: () => ({}) }
  )
}) {}

/** Overpass API response */
export class OverpassResponse extends Schema.TaggedClass<OverpassResponse>(
  'OverpassResponse'
)('OverpassResponse', {
  version: Schema.Number,
  generator: Schema.String,
  osm3s: Schema.Struct({
    timestamp_osm_base: Schema.String,
    copyright: Schema.String
  }),
  elements: Schema.Array(OverpassElement)
}) {}

// =============================================================================
// ADSB.lol API Schemas
// =============================================================================

/**
 * Wire format: Raw ADSB.lol aircraft from API
 * Matches the exact JSON structure with nulls.
 * @see https://api.adsb.lol
 */
export const AdsbLolAircraftFromApi = Schema.Struct({
  hex: Schema.String,
  flight: Schema.NullishOr(Schema.String),
  r: Schema.NullishOr(Schema.String),
  t: Schema.NullishOr(Schema.String),
  desc: Schema.NullishOr(Schema.String),
  dbFlags: Schema.NullishOr(Schema.Number),
  lat: Schema.NullishOr(Schema.Number),
  lon: Schema.NullishOr(Schema.Number),
  alt_baro: Schema.NullishOr(Schema.Union(Schema.Number, Schema.Literal('ground'))),
  alt_geom: Schema.NullishOr(Schema.Number),
  gs: Schema.NullishOr(Schema.Number),
  ias: Schema.NullishOr(Schema.Number),
  tas: Schema.NullishOr(Schema.Number),
  mach: Schema.NullishOr(Schema.Number),
  track: Schema.NullishOr(Schema.Number),
  baro_rate: Schema.NullishOr(Schema.Number),
  geom_rate: Schema.NullishOr(Schema.Number),
  squawk: Schema.NullishOr(Schema.String),
  emergency: Schema.NullishOr(Schema.String),
  category: Schema.NullishOr(Schema.String),
  nav_modes: Schema.NullishOr(Schema.Array(Schema.String)),
  seen: Schema.NullishOr(Schema.Number),
  seen_pos: Schema.NullishOr(Schema.Number),
  rssi: Schema.NullishOr(Schema.Number),
  alert: Schema.NullishOr(Schema.Number),
  spi: Schema.NullishOr(Schema.Number),
  wake: Schema.NullishOr(Schema.String),
  version: Schema.NullishOr(Schema.Number),
  nic: Schema.NullishOr(Schema.Number),
  nac_p: Schema.NullishOr(Schema.Number),
  nac_v: Schema.NullishOr(Schema.Number),
  sil: Schema.NullishOr(Schema.Number),
  sil_type: Schema.NullishOr(Schema.String),
  gva: Schema.NullishOr(Schema.Number),
  sda: Schema.NullishOr(Schema.Number),
  messages: Schema.NullishOr(Schema.Number),
}).annotations({
  identifier: 'AdsbLolAircraftFromApi',
  description: 'Raw ADSB.lol aircraft response from /v2/* endpoints (readsb JSON format)',
})
export type AdsbLolAircraftFromApi = typeof AdsbLolAircraftFromApi.Type

/**
 * Domain type: Clean ADSB.lol aircraft for internal use
 */
export class AdsbLolAircraft extends Schema.TaggedClass<AdsbLolAircraft>(
  'AdsbLolAircraft'
)('AdsbLolAircraft', {
  hex: Schema.String,
  flight: Schema.optional(Schema.String),
  registration: Schema.optional(Schema.String),
  aircraftType: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  isMilitary: Schema.optional(Schema.Boolean),
  lat: Schema.optional(Schema.Number),
  lon: Schema.optional(Schema.Number),
  altitudeFt: Schema.optional(Schema.Number),
  onGround: Schema.optional(Schema.Boolean),
  groundSpeedKts: Schema.optional(Schema.Number),
  trackDeg: Schema.optional(Schema.Number),
  verticalRateFpm: Schema.optional(Schema.Number),
  squawk: Schema.optional(Schema.String),
  emergency: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  seenSec: Schema.optional(Schema.Number),
}) {}

/**
 * Transform: Wire format → Domain type
 */
export const AdsbLolAircraftSchema = Schema.transform(
  AdsbLolAircraftFromApi,
  AdsbLolAircraft,
  {
    strict: true,
    decode: (raw) => new AdsbLolAircraft({
      hex: raw.hex,
      flight: raw.flight ?? undefined,
      registration: raw.r ?? undefined,
      aircraftType: raw.t ?? undefined,
      description: raw.desc ?? undefined,
      isMilitary: raw.dbFlags != null ? (raw.dbFlags & 1) === 1 : undefined,
      lat: raw.lat ?? undefined,
      lon: raw.lon ?? undefined,
      altitudeFt: raw.alt_baro === 'ground' ? 0 : (raw.alt_baro ?? raw.alt_geom ?? undefined),
      onGround: raw.alt_baro === 'ground',
      groundSpeedKts: raw.gs ?? undefined,
      trackDeg: raw.track ?? undefined,
      verticalRateFpm: raw.baro_rate ?? raw.geom_rate ?? undefined,
      squawk: raw.squawk ?? undefined,
      emergency: raw.emergency ?? undefined,
      category: raw.category ?? undefined,
      seenSec: raw.seen ?? undefined,
    }),
    encode: (domain) => ({
      hex: domain.hex,
      flight: domain.flight ?? null,
      r: domain.registration ?? null,
      t: domain.aircraftType ?? null,
      desc: domain.description ?? null,
      dbFlags: domain.isMilitary ? 1 : null,
      lat: domain.lat ?? null,
      lon: domain.lon ?? null,
      alt_baro: domain.onGround ? 'ground' as const : (domain.altitudeFt ?? null),
      alt_geom: null,
      gs: domain.groundSpeedKts ?? null,
      ias: null,
      tas: null,
      mach: null,
      track: domain.trackDeg ?? null,
      baro_rate: domain.verticalRateFpm ?? null,
      geom_rate: null,
      squawk: domain.squawk ?? null,
      emergency: domain.emergency ?? null,
      category: domain.category ?? null,
      nav_modes: null,
      seen: domain.seenSec ?? null,
      seen_pos: null,
      rssi: null,
      alert: null,
      spi: null,
      wake: null,
      version: null,
      nic: null,
      nac_p: null,
      nac_v: null,
      sil: null,
      sil_type: null,
      gva: null,
      sda: null,
      messages: null,
    }),
  }
)

/**
 * Wire format: Raw ADSB.lol API response
 */
export const AdsbLolResponseFromApi = Schema.Struct({
  now: Schema.Number,
  total: Schema.NullishOr(Schema.Number),
  ctime: Schema.NullishOr(Schema.Number),
  ptime: Schema.NullishOr(Schema.Number),
  ac: Schema.Array(AdsbLolAircraftFromApi),
  msg: Schema.NullishOr(Schema.String),
}).annotations({
  identifier: 'AdsbLolResponseFromApi',
  description: 'Raw ADSB.lol API response envelope',
})
export type AdsbLolResponseFromApi = typeof AdsbLolResponseFromApi.Type

/**
 * Domain type: Clean ADSB.lol response
 */
export class AdsbLolResponse extends Schema.TaggedClass<AdsbLolResponse>(
  'AdsbLolResponse'
)('AdsbLolResponse', {
  timestamp: Schema.DateFromSelf,
  total: Schema.optional(Schema.Number),
  aircraft: Schema.Array(AdsbLolAircraft),
  message: Schema.optional(Schema.String),
}) {}

/**
 * Transform: Wire format → Domain type
 */
export const AdsbLolResponseSchema = Schema.transform(
  AdsbLolResponseFromApi,
  AdsbLolResponse,
  {
    strict: true,
    decode: (raw) => new AdsbLolResponse({
      timestamp: new Date(raw.now * 1000),
      total: raw.total ?? undefined,
      aircraft: raw.ac.map((ac) => Schema.decodeUnknownSync(AdsbLolAircraftSchema)(ac)),
      message: raw.msg ?? undefined,
    }),
    encode: (domain) => ({
      now: Math.floor(domain.timestamp.getTime() / 1000),
      total: domain.total ?? null,
      ctime: null,
      ptime: null,
      ac: domain.aircraft.map((ac) => Schema.encodeSync(AdsbLolAircraftSchema)(ac)),
      msg: domain.message ?? null,
    }),
  }
)

// =============================================================================
// Planet Labs Data API Schemas
// =============================================================================

/**
 * Planet Labs item types
 */
export const PlanetItemType = Schema.Literal(
  'PSScene',           // PlanetScope Scene
  'SkySatScene',       // SkySat Scene
  'SkySatCollect',     // SkySat Collect
  'SkySatVideo',       // SkySat Video
  'REOrthoTile',       // RapidEye OrthoTile
  'REScene',           // RapidEye Scene
  'Landsat8L1G',       // Landsat 8 L1G
  'Sentinel2L1C',      // Sentinel-2 L1C
  'PSOrthoTile'        // PlanetScope OrthoTile
)
export type PlanetItemType = typeof PlanetItemType.Type

/**
 * Planet Labs asset types
 */
export const PlanetAssetType = Schema.Literal(
  'analytic',
  'analytic_udm2',
  'ortho_analytic_4b',
  'ortho_analytic_8b',
  'ortho_visual',
  'basic_analytic_4b',
  'basic_udm2'
)
export type PlanetAssetType = typeof PlanetAssetType.Type

/**
 * Wire format: Planet Data API filter (non-recursive leaf types)
 * Note: Logical filters (And/Or/Not) use Schema.Unknown for nested config
 * since we're only using this for wire format decoding, not re-encoding
 */
const PlanetDateRangeFilter = Schema.Struct({
  type: Schema.Literal('DateRangeFilter'),
  field_name: Schema.String,
  config: Schema.Struct({
    gte: Schema.optional(Schema.String),
    lte: Schema.optional(Schema.String),
    gt: Schema.optional(Schema.String),
    lt: Schema.optional(Schema.String),
  }),
})

const PlanetGeometryFilter = Schema.Struct({
  type: Schema.Literal('GeometryFilter'),
  field_name: Schema.String,
  config: Schema.Unknown, // GeoJSON geometry
})

const PlanetRangeFilter = Schema.Struct({
  type: Schema.Literal('RangeFilter'),
  field_name: Schema.String,
  config: Schema.Struct({
    gte: Schema.optional(Schema.Number),
    lte: Schema.optional(Schema.Number),
    gt: Schema.optional(Schema.Number),
    lt: Schema.optional(Schema.Number),
  }),
})

const PlanetStringInFilter = Schema.Struct({
  type: Schema.Literal('StringInFilter'),
  field_name: Schema.String,
  config: Schema.Array(Schema.String),
})

const PlanetAndFilter = Schema.Struct({
  type: Schema.Literal('AndFilter'),
  config: Schema.Array(Schema.Unknown), // Nested filters - validated at runtime
})

const PlanetOrFilter = Schema.Struct({
  type: Schema.Literal('OrFilter'),
  config: Schema.Array(Schema.Unknown), // Nested filters - validated at runtime
})

const PlanetNotFilter = Schema.Struct({
  type: Schema.Literal('NotFilter'),
  config: Schema.Unknown, // Nested filter - validated at runtime
})

const PlanetPermissionFilter = Schema.Struct({
  type: Schema.Literal('PermissionFilter'),
  config: Schema.Array(Schema.String),
})

export const PlanetFilterFromApi = Schema.Union(
  PlanetDateRangeFilter,
  PlanetGeometryFilter,
  PlanetRangeFilter,
  PlanetStringInFilter,
  PlanetAndFilter,
  PlanetOrFilter,
  PlanetNotFilter,
  PlanetPermissionFilter
).annotations({
  identifier: 'PlanetFilterFromApi',
  description: 'Planet Data API filter types',
})
export type PlanetFilterFromApi = typeof PlanetFilterFromApi.Type

/**
 * Wire format: Planet item properties from API
 */
export const PlanetItemPropertiesFromApi = Schema.Struct({
  acquired: Schema.String,
  published: Schema.String,
  updated: Schema.NullishOr(Schema.String),
  cloud_cover: Schema.NullishOr(Schema.Number),
  cloud_percent: Schema.NullishOr(Schema.Number),
  sun_azimuth: Schema.NullishOr(Schema.Number),
  sun_elevation: Schema.NullishOr(Schema.Number),
  view_angle: Schema.NullishOr(Schema.Number),
  gsd: Schema.NullishOr(Schema.Number),
  satellite_id: Schema.NullishOr(Schema.String),
  strip_id: Schema.NullishOr(Schema.String),
  provider: Schema.NullishOr(Schema.String),
  instrument: Schema.NullishOr(Schema.String),
  item_type: Schema.String,
  pixel_resolution: Schema.NullishOr(Schema.Number),
  quality_category: Schema.NullishOr(Schema.String),
}).annotations({
  identifier: 'PlanetItemPropertiesFromApi',
  description: 'Planet item metadata properties',
})
export type PlanetItemPropertiesFromApi = typeof PlanetItemPropertiesFromApi.Type

/**
 * Wire format: Planet item (feature) from API
 */
export const PlanetItemFromApi = Schema.Struct({
  _links: Schema.Struct({
    _self: Schema.String,
    assets: Schema.String,
    thumbnail: Schema.optional(Schema.String),
  }),
  _permissions: Schema.Array(Schema.String),
  id: Schema.String,
  geometry: Schema.Unknown, // GeoJSON geometry
  properties: PlanetItemPropertiesFromApi,
  type: Schema.Literal('Feature'),
}).annotations({
  identifier: 'PlanetItemFromApi',
  description: 'Planet catalog item (GeoJSON Feature)',
})
export type PlanetItemFromApi = typeof PlanetItemFromApi.Type

/**
 * Wire format: Planet search response from API
 */
export const PlanetSearchResponseFromApi = Schema.Struct({
  _links: Schema.Struct({
    _first: Schema.optional(Schema.String),
    _next: Schema.NullishOr(Schema.String),
    _self: Schema.String,
  }),
  features: Schema.Array(PlanetItemFromApi),
}).annotations({
  identifier: 'PlanetSearchResponseFromApi',
  description: 'Planet Data API search response',
})
export type PlanetSearchResponseFromApi = typeof PlanetSearchResponseFromApi.Type

/**
 * Domain type: Planet imagery item
 */
export class PlanetItem extends Schema.TaggedClass<PlanetItem>(
  'PlanetItem'
)('PlanetItem', {
  id: Schema.String,
  itemType: Schema.String,
  acquired: Schema.DateFromSelf,
  published: Schema.DateFromSelf,
  cloudCover: Schema.optional(Schema.Number),
  gsd: Schema.optional(Schema.Number),
  sunAzimuth: Schema.optional(Schema.Number),
  sunElevation: Schema.optional(Schema.Number),
  viewAngle: Schema.optional(Schema.Number),
  satelliteId: Schema.optional(Schema.String),
  provider: Schema.optional(Schema.String),
  qualityCategory: Schema.optional(Schema.String),
  geometry: Schema.Unknown, // GeoJSON geometry
  thumbnailUrl: Schema.optional(Schema.String),
  assetsUrl: Schema.String,
  permissions: Schema.Array(Schema.String),
}) {}

/**
 * Transform: Wire format → Domain type
 */
export const PlanetItemSchema = Schema.transform(
  PlanetItemFromApi,
  PlanetItem,
  {
    strict: true,
    decode: (raw) => new PlanetItem({
      id: raw.id,
      itemType: raw.properties.item_type,
      acquired: new Date(raw.properties.acquired),
      published: new Date(raw.properties.published),
      cloudCover: raw.properties.cloud_cover ?? raw.properties.cloud_percent ?? undefined,
      gsd: raw.properties.gsd ?? raw.properties.pixel_resolution ?? undefined,
      sunAzimuth: raw.properties.sun_azimuth ?? undefined,
      sunElevation: raw.properties.sun_elevation ?? undefined,
      viewAngle: raw.properties.view_angle ?? undefined,
      satelliteId: raw.properties.satellite_id ?? undefined,
      provider: raw.properties.provider ?? undefined,
      qualityCategory: raw.properties.quality_category ?? undefined,
      geometry: raw.geometry,
      thumbnailUrl: raw._links.thumbnail ?? undefined,
      assetsUrl: raw._links.assets,
      permissions: [...raw._permissions],
    }),
    encode: (domain) => ({
      _links: {
        _self: '',
        assets: domain.assetsUrl,
        thumbnail: domain.thumbnailUrl,
      },
      _permissions: [...domain.permissions],
      id: domain.id,
      geometry: domain.geometry,
      properties: {
        acquired: domain.acquired.toISOString(),
        published: domain.published.toISOString(),
        updated: null,
        cloud_cover: domain.cloudCover ?? null,
        cloud_percent: null,
        sun_azimuth: domain.sunAzimuth ?? null,
        sun_elevation: domain.sunElevation ?? null,
        view_angle: domain.viewAngle ?? null,
        gsd: domain.gsd ?? null,
        satellite_id: domain.satelliteId ?? null,
        strip_id: null,
        provider: domain.provider ?? null,
        instrument: null,
        item_type: domain.itemType,
        pixel_resolution: null,
        quality_category: domain.qualityCategory ?? null,
      },
      type: 'Feature' as const,
    }),
  }
)

/**
 * Domain type: Planet search response
 */
export class PlanetSearchResponse extends Schema.TaggedClass<PlanetSearchResponse>(
  'PlanetSearchResponse'
)('PlanetSearchResponse', {
  items: Schema.Array(PlanetItem),
  nextUrl: Schema.optional(Schema.String),
  selfUrl: Schema.String,
}) {}

/**
 * Transform: Wire format → Domain type
 */
export const PlanetSearchResponseSchema = Schema.transform(
  PlanetSearchResponseFromApi,
  PlanetSearchResponse,
  {
    strict: true,
    decode: (raw) => new PlanetSearchResponse({
      items: raw.features.map((f) => Schema.decodeUnknownSync(PlanetItemSchema)(f)),
      nextUrl: raw._links._next ?? undefined,
      selfUrl: raw._links._self,
    }),
    encode: (domain) => ({
      _links: {
        _first: undefined,
        _next: domain.nextUrl ?? null,
        _self: domain.selfUrl,
      },
      features: domain.items.map((item) => Schema.encodeSync(PlanetItemSchema)(item)),
    }),
  }
)

// =============================================================================
// Sentinel Hub API Schemas
// =============================================================================

/**
 * Sentinel Hub collection types
 */
export const SentinelCollection = Schema.Literal(
  'sentinel-1-grd',
  'sentinel-2-l1c',
  'sentinel-2-l2a',
  'landsat-ot-l1',
  'landsat-ot-l2',
  'dem',
  'modis',
  'byoc'
)
export type SentinelCollection = typeof SentinelCollection.Type

/**
 * Wire format: Sentinel Hub catalog item properties from API
 */
export const SentinelItemPropertiesFromApi = Schema.Struct({
  datetime: Schema.String,
  'eo:cloud_cover': Schema.NullishOr(Schema.Number),
  'sentinel:product_id': Schema.NullishOr(Schema.String),
  'sentinel:data_coverage': Schema.NullishOr(Schema.Number),
  'sentinel:valid_data': Schema.NullishOr(Schema.Number),
  platform: Schema.NullishOr(Schema.String),
  constellation: Schema.NullishOr(Schema.String),
  instruments: Schema.NullishOr(Schema.Array(Schema.String)),
  'proj:epsg': Schema.NullishOr(Schema.Number),
  'view:sun_azimuth': Schema.NullishOr(Schema.Number),
  'view:sun_elevation': Schema.NullishOr(Schema.Number),
  'view:off_nadir': Schema.NullishOr(Schema.Number),
  gsd: Schema.NullishOr(Schema.Number),
}).annotations({
  identifier: 'SentinelItemPropertiesFromApi',
  description: 'Sentinel Hub STAC item properties',
})
export type SentinelItemPropertiesFromApi = typeof SentinelItemPropertiesFromApi.Type

/**
 * Wire format: Sentinel Hub catalog item (STAC Feature) from API
 */
export const SentinelItemFromApi = Schema.Struct({
  type: Schema.Literal('Feature'),
  stac_version: Schema.String,
  id: Schema.String,
  geometry: Schema.Unknown, // GeoJSON geometry
  bbox: Schema.NullishOr(Schema.Array(Schema.Number)),
  properties: SentinelItemPropertiesFromApi,
  links: Schema.Array(Schema.Struct({
    rel: Schema.String,
    href: Schema.String,
    type: Schema.optional(Schema.String),
  })),
  assets: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  collection: Schema.optional(Schema.String),
}).annotations({
  identifier: 'SentinelItemFromApi',
  description: 'Sentinel Hub STAC catalog item',
})
export type SentinelItemFromApi = typeof SentinelItemFromApi.Type

/**
 * Wire format: Sentinel Hub search response from API (STAC FeatureCollection)
 */
export const SentinelSearchResponseFromApi = Schema.Struct({
  type: Schema.Literal('FeatureCollection'),
  features: Schema.Array(SentinelItemFromApi),
  links: Schema.optional(Schema.Array(Schema.Struct({
    rel: Schema.String,
    href: Schema.String,
    type: Schema.optional(Schema.String),
  }))),
  context: Schema.optional(Schema.Struct({
    limit: Schema.optional(Schema.Number),
    matched: Schema.optional(Schema.Number),
    returned: Schema.optional(Schema.Number),
  })),
}).annotations({
  identifier: 'SentinelSearchResponseFromApi',
  description: 'Sentinel Hub STAC search response',
})
export type SentinelSearchResponseFromApi = typeof SentinelSearchResponseFromApi.Type

/**
 * Domain type: Sentinel imagery item
 */
export class SentinelItem extends Schema.TaggedClass<SentinelItem>(
  'SentinelItem'
)('SentinelItem', {
  id: Schema.String,
  collection: Schema.optional(Schema.String),
  datetime: Schema.DateFromSelf,
  cloudCover: Schema.optional(Schema.Number),
  productId: Schema.optional(Schema.String),
  dataCoverage: Schema.optional(Schema.Number),
  platform: Schema.optional(Schema.String),
  constellation: Schema.optional(Schema.String),
  instruments: Schema.optional(Schema.Array(Schema.String)),
  epsg: Schema.optional(Schema.Number),
  sunAzimuth: Schema.optional(Schema.Number),
  sunElevation: Schema.optional(Schema.Number),
  offNadir: Schema.optional(Schema.Number),
  gsd: Schema.optional(Schema.Number),
  bbox: Schema.optional(Schema.Array(Schema.Number)),
  geometry: Schema.Unknown,
  assets: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

/**
 * Transform: Wire format → Domain type
 */
export const SentinelItemSchema = Schema.transform(
  SentinelItemFromApi,
  SentinelItem,
  {
    strict: true,
    decode: (raw) => new SentinelItem({
      id: raw.id,
      collection: raw.collection ?? undefined,
      datetime: new Date(raw.properties.datetime),
      cloudCover: raw.properties['eo:cloud_cover'] ?? undefined,
      productId: raw.properties['sentinel:product_id'] ?? undefined,
      dataCoverage: raw.properties['sentinel:data_coverage'] ?? undefined,
      platform: raw.properties.platform ?? undefined,
      constellation: raw.properties.constellation ?? undefined,
      instruments: raw.properties.instruments ?? undefined,
      epsg: raw.properties['proj:epsg'] ?? undefined,
      sunAzimuth: raw.properties['view:sun_azimuth'] ?? undefined,
      sunElevation: raw.properties['view:sun_elevation'] ?? undefined,
      offNadir: raw.properties['view:off_nadir'] ?? undefined,
      gsd: raw.properties.gsd ?? undefined,
      bbox: raw.bbox ?? undefined,
      geometry: raw.geometry,
      assets: raw.assets ?? undefined,
    }),
    encode: (domain) => ({
      type: 'Feature' as const,
      stac_version: '1.0.0',
      id: domain.id,
      geometry: domain.geometry,
      bbox: domain.bbox ?? null,
      properties: {
        datetime: domain.datetime.toISOString(),
        'eo:cloud_cover': domain.cloudCover ?? null,
        'sentinel:product_id': domain.productId ?? null,
        'sentinel:data_coverage': domain.dataCoverage ?? null,
        'sentinel:valid_data': null,
        platform: domain.platform ?? null,
        constellation: domain.constellation ?? null,
        instruments: domain.instruments ?? null,
        'proj:epsg': domain.epsg ?? null,
        'view:sun_azimuth': domain.sunAzimuth ?? null,
        'view:sun_elevation': domain.sunElevation ?? null,
        'view:off_nadir': domain.offNadir ?? null,
        gsd: domain.gsd ?? null,
      },
      links: [],
      assets: domain.assets ?? undefined,
      collection: domain.collection ?? undefined,
    }),
  }
)

/**
 * Domain type: Sentinel Hub search response
 */
export class SentinelSearchResponse extends Schema.TaggedClass<SentinelSearchResponse>(
  'SentinelSearchResponse'
)('SentinelSearchResponse', {
  items: Schema.Array(SentinelItem),
  totalMatched: Schema.optional(Schema.Number),
  totalReturned: Schema.optional(Schema.Number),
  nextUrl: Schema.optional(Schema.String),
}) {}

/**
 * Transform: Wire format → Domain type
 */
export const SentinelSearchResponseSchema = Schema.transform(
  SentinelSearchResponseFromApi,
  SentinelSearchResponse,
  {
    strict: true,
    decode: (raw) => {
      // Find next link
      const nextLink = raw.links?.find((l) => l.rel === 'next')
      return new SentinelSearchResponse({
        items: raw.features.map((f) => Schema.decodeUnknownSync(SentinelItemSchema)(f)),
        totalMatched: raw.context?.matched ?? undefined,
        totalReturned: raw.context?.returned ?? undefined,
        nextUrl: nextLink?.href ?? undefined,
      })
    },
    encode: (domain) => ({
      type: 'FeatureCollection' as const,
      features: domain.items.map((item) => Schema.encodeSync(SentinelItemSchema)(item)),
      links: domain.nextUrl ? [{ rel: 'next', href: domain.nextUrl }] : undefined,
      context: {
        matched: domain.totalMatched ?? undefined,
        returned: domain.totalReturned ?? undefined,
      },
    }),
  }
)

// =============================================================================
// Open-Meteo Weather API - Wire Format Schemas
// =============================================================================

/**
 * WMO Weather interpretation codes
 * @see https://open-meteo.com/en/docs#weathervariables
 */
export const WmoWeatherCode = Schema.Literal(
  0, 1, 2, 3,           // Clear, mainly clear, partly cloudy, overcast
  45, 48,               // Fog
  51, 53, 55,           // Drizzle
  56, 57,               // Freezing drizzle
  61, 63, 65,           // Rain
  66, 67,               // Freezing rain
  71, 73, 75,           // Snow fall
  77,                   // Snow grains
  80, 81, 82,           // Rain showers
  85, 86,               // Snow showers
  95,                   // Thunderstorm
  96, 99                // Thunderstorm with hail
)
export type WmoWeatherCode = typeof WmoWeatherCode.Type

/**
 * Current weather from Open-Meteo API (wire format)
 */
export const CurrentWeatherFromApi = Schema.Struct({
  time: Schema.String,
  interval: Schema.Number,
  temperature_2m: Schema.NullishOr(Schema.Number),
  relative_humidity_2m: Schema.NullishOr(Schema.Number),
  apparent_temperature: Schema.NullishOr(Schema.Number),
  is_day: Schema.NullishOr(Schema.Number),
  precipitation: Schema.NullishOr(Schema.Number),
  rain: Schema.NullishOr(Schema.Number),
  showers: Schema.NullishOr(Schema.Number),
  snowfall: Schema.NullishOr(Schema.Number),
  weather_code: Schema.NullishOr(Schema.Number),
  cloud_cover: Schema.NullishOr(Schema.Number),
  pressure_msl: Schema.NullishOr(Schema.Number),
  surface_pressure: Schema.NullishOr(Schema.Number),
  wind_speed_10m: Schema.NullishOr(Schema.Number),
  wind_direction_10m: Schema.NullishOr(Schema.Number),
  wind_gusts_10m: Schema.NullishOr(Schema.Number),
}).annotations({ identifier: 'CurrentWeatherFromApi' })

/**
 * Hourly weather data from Open-Meteo API (wire format)
 */
export const HourlyWeatherFromApi = Schema.Struct({
  time: Schema.Array(Schema.String),
  temperature_2m: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  relative_humidity_2m: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  apparent_temperature: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  precipitation_probability: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  precipitation: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  weather_code: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  cloud_cover: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  visibility: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  wind_speed_10m: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  wind_direction_10m: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  wind_gusts_10m: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  uv_index: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
}).annotations({ identifier: 'HourlyWeatherFromApi' })

/**
 * Daily weather data from Open-Meteo API (wire format)
 */
export const DailyWeatherFromApi = Schema.Struct({
  time: Schema.Array(Schema.String),
  weather_code: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  temperature_2m_max: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  temperature_2m_min: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  apparent_temperature_max: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  apparent_temperature_min: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  sunrise: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.String))),
  sunset: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.String))),
  precipitation_sum: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  precipitation_probability_max: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  wind_speed_10m_max: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  wind_gusts_10m_max: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  wind_direction_10m_dominant: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
  uv_index_max: Schema.NullishOr(Schema.Array(Schema.NullishOr(Schema.Number))),
}).annotations({ identifier: 'DailyWeatherFromApi' })

/**
 * Full forecast response from Open-Meteo API (wire format)
 */
export const OpenMeteoForecastFromApi = Schema.Struct({
  latitude: Schema.Number,
  longitude: Schema.Number,
  generationtime_ms: Schema.Number,
  utc_offset_seconds: Schema.Number,
  timezone: Schema.String,
  timezone_abbreviation: Schema.String,
  elevation: Schema.Number,
  current: Schema.NullishOr(CurrentWeatherFromApi),
  hourly: Schema.NullishOr(HourlyWeatherFromApi),
  daily: Schema.NullishOr(DailyWeatherFromApi),
}).annotations({ identifier: 'OpenMeteoForecastFromApi' })
export type OpenMeteoForecastFromApi = typeof OpenMeteoForecastFromApi.Type

/**
 * Geocoding result from Open-Meteo API (wire format)
 */
export const GeocodingResultFromApi = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  latitude: Schema.Number,
  longitude: Schema.Number,
  elevation: Schema.NullishOr(Schema.Number),
  feature_code: Schema.NullishOr(Schema.String),
  country_code: Schema.NullishOr(Schema.String),
  country: Schema.NullishOr(Schema.String),
  admin1: Schema.NullishOr(Schema.String),
  admin2: Schema.NullishOr(Schema.String),
  admin3: Schema.NullishOr(Schema.String),
  admin4: Schema.NullishOr(Schema.String),
  timezone: Schema.NullishOr(Schema.String),
  population: Schema.NullishOr(Schema.Number),
  postcodes: Schema.NullishOr(Schema.Array(Schema.String)),
  country_id: Schema.NullishOr(Schema.Number),
  admin1_id: Schema.NullishOr(Schema.Number),
  admin2_id: Schema.NullishOr(Schema.Number),
  admin3_id: Schema.NullishOr(Schema.Number),
  admin4_id: Schema.NullishOr(Schema.Number),
}).annotations({ identifier: 'GeocodingResultFromApi' })

/**
 * Geocoding response from Open-Meteo API (wire format)
 */
export const OpenMeteoGeocodingFromApi = Schema.Struct({
  results: Schema.NullishOr(Schema.Array(GeocodingResultFromApi)),
  generationtime_ms: Schema.Number,
}).annotations({ identifier: 'OpenMeteoGeocodingFromApi' })
export type OpenMeteoGeocodingFromApi = typeof OpenMeteoGeocodingFromApi.Type

// =============================================================================
// Open-Meteo Weather API - Domain Types
// =============================================================================

/**
 * Current weather conditions (domain type)
 */
export class CurrentWeather extends Schema.TaggedClass<CurrentWeather>(
  'CurrentWeather'
)('CurrentWeather', {
  time: Schema.DateFromSelf,
  temperature: Schema.Number,
  feelsLike: Schema.optional(Schema.Number),
  humidity: Schema.optional(Schema.Number),
  precipitation: Schema.optional(Schema.Number),
  weatherCode: Schema.optional(Schema.Number),
  cloudCover: Schema.optional(Schema.Number),
  pressure: Schema.optional(Schema.Number),
  windSpeed: Schema.optional(Schema.Number),
  windDirection: Schema.optional(Schema.Number),
  windGusts: Schema.optional(Schema.Number),
  isDay: Schema.optional(Schema.Boolean),
}) {}

/**
 * Hourly forecast entry (domain type)
 */
export class HourlyForecast extends Schema.TaggedClass<HourlyForecast>(
  'HourlyForecast'
)('HourlyForecast', {
  time: Schema.DateFromSelf,
  temperature: Schema.optional(Schema.Number),
  feelsLike: Schema.optional(Schema.Number),
  humidity: Schema.optional(Schema.Number),
  precipitationProbability: Schema.optional(Schema.Number),
  precipitation: Schema.optional(Schema.Number),
  weatherCode: Schema.optional(Schema.Number),
  cloudCover: Schema.optional(Schema.Number),
  visibility: Schema.optional(Schema.Number),
  windSpeed: Schema.optional(Schema.Number),
  windDirection: Schema.optional(Schema.Number),
  windGusts: Schema.optional(Schema.Number),
  uvIndex: Schema.optional(Schema.Number),
}) {}

/**
 * Daily forecast entry (domain type)
 */
export class DailyForecast extends Schema.TaggedClass<DailyForecast>(
  'DailyForecast'
)('DailyForecast', {
  date: Schema.DateFromSelf,
  weatherCode: Schema.optional(Schema.Number),
  temperatureMax: Schema.optional(Schema.Number),
  temperatureMin: Schema.optional(Schema.Number),
  feelsLikeMax: Schema.optional(Schema.Number),
  feelsLikeMin: Schema.optional(Schema.Number),
  sunrise: Schema.optional(Schema.DateFromSelf),
  sunset: Schema.optional(Schema.DateFromSelf),
  precipitationSum: Schema.optional(Schema.Number),
  precipitationProbabilityMax: Schema.optional(Schema.Number),
  windSpeedMax: Schema.optional(Schema.Number),
  windGustsMax: Schema.optional(Schema.Number),
  windDirectionDominant: Schema.optional(Schema.Number),
  uvIndexMax: Schema.optional(Schema.Number),
}) {}

/**
 * Complete weather forecast (domain type)
 */
export class WeatherForecast extends Schema.TaggedClass<WeatherForecast>(
  'WeatherForecast'
)('WeatherForecast', {
  latitude: Schema.Number,
  longitude: Schema.Number,
  elevation: Schema.Number,
  timezone: Schema.String,
  timezoneAbbreviation: Schema.String,
  current: Schema.optional(CurrentWeather),
  hourly: Schema.optional(Schema.Array(HourlyForecast)),
  daily: Schema.optional(Schema.Array(DailyForecast)),
}) {}

/**
 * Geocoding location result (domain type)
 */
export class GeocodingLocation extends Schema.TaggedClass<GeocodingLocation>(
  'GeocodingLocation'
)('GeocodingLocation', {
  id: Schema.Number,
  name: Schema.String,
  latitude: Schema.Number,
  longitude: Schema.Number,
  elevation: Schema.optional(Schema.Number),
  country: Schema.optional(Schema.String),
  countryCode: Schema.optional(Schema.String),
  admin1: Schema.optional(Schema.String),
  admin2: Schema.optional(Schema.String),
  timezone: Schema.optional(Schema.String),
  population: Schema.optional(Schema.Number),
}) {}

/**
 * Geocoding response (domain type)
 */
export class GeocodingResponse extends Schema.TaggedClass<GeocodingResponse>(
  'GeocodingResponse'
)('GeocodingResponse', {
  results: Schema.Array(GeocodingLocation),
}) {}

// =============================================================================
// Open-Meteo Weather API - Transform Schemas
// =============================================================================

/**
 * Transform: Current weather wire → domain
 */
export const CurrentWeatherSchema = Schema.transform(
  CurrentWeatherFromApi,
  CurrentWeather,
  {
    strict: true,
    decode: (raw) =>
      new CurrentWeather({
        time: new Date(raw.time),
        temperature: raw.temperature_2m ?? 0,
        feelsLike: raw.apparent_temperature ?? undefined,
        humidity: raw.relative_humidity_2m ?? undefined,
        precipitation: raw.precipitation ?? undefined,
        weatherCode: raw.weather_code ?? undefined,
        cloudCover: raw.cloud_cover ?? undefined,
        pressure: raw.pressure_msl ?? undefined,
        windSpeed: raw.wind_speed_10m ?? undefined,
        windDirection: raw.wind_direction_10m ?? undefined,
        windGusts: raw.wind_gusts_10m ?? undefined,
        isDay: raw.is_day != null ? raw.is_day === 1 : undefined,
      }),
    encode: (domain) => ({
      time: domain.time.toISOString(),
      interval: 900, // 15 minutes default
      temperature_2m: domain.temperature,
      relative_humidity_2m: domain.humidity ?? null,
      apparent_temperature: domain.feelsLike ?? null,
      is_day: domain.isDay != null ? (domain.isDay ? 1 : 0) : null,
      precipitation: domain.precipitation ?? null,
      rain: null,
      showers: null,
      snowfall: null,
      weather_code: domain.weatherCode ?? null,
      cloud_cover: domain.cloudCover ?? null,
      pressure_msl: domain.pressure ?? null,
      surface_pressure: null,
      wind_speed_10m: domain.windSpeed ?? null,
      wind_direction_10m: domain.windDirection ?? null,
      wind_gusts_10m: domain.windGusts ?? null,
    }),
  }
)

/**
 * Transform: Forecast wire → domain
 */
export const WeatherForecastSchema = Schema.transform(
  OpenMeteoForecastFromApi,
  WeatherForecast,
  {
    strict: true,
    decode: (raw) => {
      // Parse hourly data into array of HourlyForecast
      const hourly: HourlyForecast[] = []
      if (raw.hourly?.time) {
        for (let i = 0; i < raw.hourly.time.length; i++) {
          hourly.push(
            new HourlyForecast({
              time: new Date(raw.hourly.time[i]),
              temperature: raw.hourly.temperature_2m?.[i] ?? undefined,
              feelsLike: raw.hourly.apparent_temperature?.[i] ?? undefined,
              humidity: raw.hourly.relative_humidity_2m?.[i] ?? undefined,
              precipitationProbability: raw.hourly.precipitation_probability?.[i] ?? undefined,
              precipitation: raw.hourly.precipitation?.[i] ?? undefined,
              weatherCode: raw.hourly.weather_code?.[i] ?? undefined,
              cloudCover: raw.hourly.cloud_cover?.[i] ?? undefined,
              visibility: raw.hourly.visibility?.[i] ?? undefined,
              windSpeed: raw.hourly.wind_speed_10m?.[i] ?? undefined,
              windDirection: raw.hourly.wind_direction_10m?.[i] ?? undefined,
              windGusts: raw.hourly.wind_gusts_10m?.[i] ?? undefined,
              uvIndex: raw.hourly.uv_index?.[i] ?? undefined,
            })
          )
        }
      }

      // Parse daily data into array of DailyForecast
      const daily: DailyForecast[] = []
      if (raw.daily?.time) {
        for (let i = 0; i < raw.daily.time.length; i++) {
          daily.push(
            new DailyForecast({
              date: new Date(raw.daily.time[i]),
              weatherCode: raw.daily.weather_code?.[i] ?? undefined,
              temperatureMax: raw.daily.temperature_2m_max?.[i] ?? undefined,
              temperatureMin: raw.daily.temperature_2m_min?.[i] ?? undefined,
              feelsLikeMax: raw.daily.apparent_temperature_max?.[i] ?? undefined,
              feelsLikeMin: raw.daily.apparent_temperature_min?.[i] ?? undefined,
              sunrise: raw.daily.sunrise?.[i] ? new Date(raw.daily.sunrise[i]!) : undefined,
              sunset: raw.daily.sunset?.[i] ? new Date(raw.daily.sunset[i]!) : undefined,
              precipitationSum: raw.daily.precipitation_sum?.[i] ?? undefined,
              precipitationProbabilityMax: raw.daily.precipitation_probability_max?.[i] ?? undefined,
              windSpeedMax: raw.daily.wind_speed_10m_max?.[i] ?? undefined,
              windGustsMax: raw.daily.wind_gusts_10m_max?.[i] ?? undefined,
              windDirectionDominant: raw.daily.wind_direction_10m_dominant?.[i] ?? undefined,
              uvIndexMax: raw.daily.uv_index_max?.[i] ?? undefined,
            })
          )
        }
      }

      // Parse current weather if present
      const current = raw.current
        ? Schema.decodeUnknownSync(CurrentWeatherSchema)(raw.current)
        : undefined

      return new WeatherForecast({
        latitude: raw.latitude,
        longitude: raw.longitude,
        elevation: raw.elevation,
        timezone: raw.timezone,
        timezoneAbbreviation: raw.timezone_abbreviation,
        current,
        hourly: hourly.length > 0 ? hourly : undefined,
        daily: daily.length > 0 ? daily : undefined,
      })
    },
    encode: (domain) => ({
      latitude: domain.latitude,
      longitude: domain.longitude,
      generationtime_ms: 0,
      utc_offset_seconds: 0,
      timezone: domain.timezone,
      timezone_abbreviation: domain.timezoneAbbreviation,
      elevation: domain.elevation,
      current: domain.current
        ? Schema.encodeSync(CurrentWeatherSchema)(domain.current)
        : null,
      hourly: domain.hourly
        ? {
            time: domain.hourly.map((h) => h.time.toISOString()),
            temperature_2m: domain.hourly.map((h) => h.temperature ?? null),
            relative_humidity_2m: domain.hourly.map((h) => h.humidity ?? null),
            apparent_temperature: domain.hourly.map((h) => h.feelsLike ?? null),
            precipitation_probability: domain.hourly.map((h) => h.precipitationProbability ?? null),
            precipitation: domain.hourly.map((h) => h.precipitation ?? null),
            weather_code: domain.hourly.map((h) => h.weatherCode ?? null),
            cloud_cover: domain.hourly.map((h) => h.cloudCover ?? null),
            visibility: domain.hourly.map((h) => h.visibility ?? null),
            wind_speed_10m: domain.hourly.map((h) => h.windSpeed ?? null),
            wind_direction_10m: domain.hourly.map((h) => h.windDirection ?? null),
            wind_gusts_10m: domain.hourly.map((h) => h.windGusts ?? null),
            uv_index: domain.hourly.map((h) => h.uvIndex ?? null),
          }
        : null,
      daily: domain.daily
        ? {
            time: domain.daily.map((d) => d.date.toISOString().slice(0, 10)),
            weather_code: domain.daily.map((d) => d.weatherCode ?? null),
            temperature_2m_max: domain.daily.map((d) => d.temperatureMax ?? null),
            temperature_2m_min: domain.daily.map((d) => d.temperatureMin ?? null),
            apparent_temperature_max: domain.daily.map((d) => d.feelsLikeMax ?? null),
            apparent_temperature_min: domain.daily.map((d) => d.feelsLikeMin ?? null),
            sunrise: domain.daily.map((d) => d.sunrise?.toISOString() ?? null),
            sunset: domain.daily.map((d) => d.sunset?.toISOString() ?? null),
            precipitation_sum: domain.daily.map((d) => d.precipitationSum ?? null),
            precipitation_probability_max: domain.daily.map((d) => d.precipitationProbabilityMax ?? null),
            wind_speed_10m_max: domain.daily.map((d) => d.windSpeedMax ?? null),
            wind_gusts_10m_max: domain.daily.map((d) => d.windGustsMax ?? null),
            wind_direction_10m_dominant: domain.daily.map((d) => d.windDirectionDominant ?? null),
            uv_index_max: domain.daily.map((d) => d.uvIndexMax ?? null),
          }
        : null,
    }),
  }
)

/**
 * Transform: Geocoding wire → domain
 */
export const GeocodingResponseSchema = Schema.transform(
  OpenMeteoGeocodingFromApi,
  GeocodingResponse,
  {
    strict: true,
    decode: (raw) =>
      new GeocodingResponse({
        results: (raw.results ?? []).map(
          (r) =>
            new GeocodingLocation({
              id: r.id,
              name: r.name,
              latitude: r.latitude,
              longitude: r.longitude,
              elevation: r.elevation ?? undefined,
              country: r.country ?? undefined,
              countryCode: r.country_code ?? undefined,
              admin1: r.admin1 ?? undefined,
              admin2: r.admin2 ?? undefined,
              timezone: r.timezone ?? undefined,
              population: r.population ?? undefined,
            })
        ),
      }),
    encode: (domain) => ({
      results: domain.results.map((r) => ({
        id: r.id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        elevation: r.elevation ?? null,
        feature_code: null,
        country_code: r.countryCode ?? null,
        country: r.country ?? null,
        admin1: r.admin1 ?? null,
        admin2: r.admin2 ?? null,
        admin3: null,
        admin4: null,
        timezone: r.timezone ?? null,
        population: r.population ?? null,
        postcodes: null,
        country_id: null,
        admin1_id: null,
        admin2_id: null,
        admin3_id: null,
        admin4_id: null,
      })),
      generationtime_ms: 0,
    }),
  }
)

// =============================================================================
// Saved Searches & History
// =============================================================================

/** A saved search query */
export class SavedSearch extends Schema.TaggedClass<SavedSearch>(
  'SavedSearch'
)('SavedSearch', {
  id: SearchId,
  name: Schema.String,
  query: SearchQuery,
  createdAt: Schema.Date,
  lastUsedAt: Schema.optionalWith(Schema.Date, { default: () => new Date() }),
  useCount: Schema.optionalWith(Schema.Number, { default: () => 0 })
}) {}

/** Search history entry */
export class SearchHistoryEntry extends Schema.TaggedClass<SearchHistoryEntry>(
  'SearchHistoryEntry'
)('SearchHistoryEntry', {
  queryId: SearchId,
  query: SearchQuery,
  resultCount: Schema.Number,
  executionTimeMs: Schema.Number,
  executedAt: Schema.Date
}) {}
