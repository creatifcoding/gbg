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
  'planet',     // Planet Labs satellite
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

/** Union of all search result types */
export const SearchResultItem = Schema.Union(
  SearchResultTrack,
  SearchResultPoi,
  SearchResultFlight,
  SearchResultFeature
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
