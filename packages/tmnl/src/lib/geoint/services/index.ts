// =============================================================================
// GEOINT Services - Barrel Export
// =============================================================================

// Flight Stream Handle - DurableStream typed access
export {
  FlightStreamHandle,
  FlightStreamHandleLive,
  FlightStreamHandleFullLive,
  FlightStreamConfigTag,
  FlightStreamConfigDefault,
  type FlightStreamConfig,
  type FlightStreamHandleShape,
} from './FlightStreamHandle'

// OSM Stream Handle - DurableStream typed access for POIs
export {
  OsmStreamHandle,
  OsmStreamHandleLive,
  OsmStreamHandleFullLive,
  OsmStreamConfigTag,
  OsmStreamConfigDefault,
  type OsmStreamConfig,
  type OsmStreamHandleShape,
} from './OsmStreamHandle'

// Weather Stream Handle - DurableStream typed access for weather observations
export {
  WeatherStreamHandle,
  WeatherStreamHandleLive,
  WeatherStreamHandleFullLive,
  WeatherStreamConfigTag,
  WeatherStreamConfigDefault,
  type WeatherStreamConfig,
  type WeatherStreamHandleShape,
} from './WeatherStreamHandle'

export {
  GeointService,
  GeointServiceLive,
  GeointSubscriptionError,
  GeointQueryError,
  type GeointServiceError,
  type GeointLayerConfig,
} from './GeointService'

// Search Service - ALLINT COP Search System
export {
  // Service
  SearchServiceTag,
  SearchServiceLive,
  SearchServiceTest,
  SearchServiceError,
  type SearchService,
  // State Atoms
  activeSearchIdAtom,
  searchStatusAtom,
  lastSearchResponseAtom,
  resultsBySourceAtom,
  searchErrorAtom,
  sessionHistoryAtom,
  // Derived Atoms
  allResultsAtom,
  resultsCountAtom,
  isSearchingAtom,
  // Types
  type SearchStatus,
} from './SearchService'
