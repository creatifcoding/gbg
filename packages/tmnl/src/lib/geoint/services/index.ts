// =============================================================================
// GEOINT Services - Barrel Export
// =============================================================================

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
