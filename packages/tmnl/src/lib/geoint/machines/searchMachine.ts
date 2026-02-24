/**
 * GEOINT Search Workflow State Machine
 *
 * XState v5 machine for managing complex multi-source search workflows:
 * - Query configuration with sources, bounds, filters
 * - Progressive streaming results from multiple sources
 * - Per-source status tracking and error handling
 * - Debounced automatic searches on viewport changes
 * - Result aggregation and sorting
 *
 * States:
 * - idle: No active search, ready to accept queries
 * - configuring: User is modifying search parameters
 * - searching: Active search with parallel source tracking
 * - results: Search complete, displaying results
 * - error: Search failed globally
 *
 * @module geoint/machines/searchMachine
 */

import { setup, assign, type ActorRefFrom, type SnapshotFrom } from 'xstate'
import type { IntelSource, BBox } from '../schemas'

// =============================================================================
// Types
// =============================================================================

/** Search filter configuration */
export interface SearchFilters {
  /** Minimum confidence score (0-1) */
  minConfidence: number
  /** Maximum age in hours (null = no limit) */
  maxAgeHours: number | null
  /** Classification levels to include */
  classifications: string[]
  /** Entity types to include (empty = all) */
  entityTypes: string[]
}

/** Per-source search status */
export interface SourceStatus {
  /** Source identifier */
  source: IntelSource
  /** Search status */
  status: 'pending' | 'searching' | 'complete' | 'error' | 'cancelled'
  /** Result count from this source */
  resultCount: number
  /** Error message if failed */
  error: string | null
  /** Search start time */
  startTime: number | null
  /** Search end time */
  endTime: number | null
}

/** Search progress tracking */
export interface SearchProgress {
  /** Total sources being searched */
  totalSources: number
  /** Sources that have completed */
  completedSources: number
  /** Total results received so far */
  totalResults: number
  /** Estimated progress percentage (0-100) */
  percentage: number
}

/** Search execution options */
export interface SearchOptions {
  /** Debounce delay in ms for viewport searches */
  debounceMs: number
  /** Timeout per source in ms */
  sourceTimeoutMs: number
  /** Maximum results per source */
  maxResultsPerSource: number
  /** Enable viewport-based automatic search */
  autoSearch: boolean
}

/** Search context */
export interface SearchContext {
  /** Current search query text */
  query: string

  /** Bounding box for spatial search */
  bounds: BBox | null

  /** Enabled sources */
  sources: IntelSource[]

  /** Search filters */
  filters: SearchFilters

  /** Search options */
  options: SearchOptions

  /** Per-source status tracking */
  sourceStatuses: Record<IntelSource, SourceStatus>

  /** Progress tracking */
  progress: SearchProgress

  /** Accumulated results (source of truth is in atoms) */
  resultCount: number

  /** Global error message */
  error: string | null

  /** Search ID for cancellation */
  searchId: string | null

  /** Last search timestamp */
  lastSearchAt: number | null

  /** Viewport change pending (for debounce) */
  pendingViewportSearch: boolean
}

/** Search events */
export type SearchEvent =
  // Query events
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_BOUNDS'; bounds: BBox | null }
  | { type: 'TOGGLE_SOURCE'; source: IntelSource }
  | { type: 'SET_SOURCES'; sources: IntelSource[] }
  | { type: 'SET_FILTERS'; filters: Partial<SearchFilters> }
  | { type: 'SET_OPTIONS'; options: Partial<SearchOptions> }

  // Search control events
  | { type: 'SEARCH' }
  | { type: 'CANCEL' }
  | { type: 'CLEAR' }
  | { type: 'RETRY' }

  // Viewport events (with debounce)
  | { type: 'VIEWPORT_CHANGED'; bounds: BBox }
  | { type: 'VIEWPORT_DEBOUNCE_COMPLETE' }

  // Source progress events
  | { type: 'SOURCE_STARTED'; source: IntelSource }
  | { type: 'SOURCE_PROGRESS'; source: IntelSource; resultCount: number }
  | { type: 'SOURCE_COMPLETE'; source: IntelSource; resultCount: number }
  | { type: 'SOURCE_ERROR'; source: IntelSource; error: string }

  // Global completion events
  | { type: 'SEARCH_COMPLETE'; totalResults: number }
  | { type: 'SEARCH_ERROR'; error: string }

// =============================================================================
// Constants
// =============================================================================

const ALL_SOURCES: IntelSource[] = [
  'track',
  'osm',
  'opensky',
  'planet',
  'sentinel',
  'openmeteo',
  'feature',
  'custom',
]

const DEFAULT_FILTERS: SearchFilters = {
  minConfidence: 0,
  maxAgeHours: null,
  classifications: [],
  entityTypes: [],
}

const DEFAULT_OPTIONS: SearchOptions = {
  debounceMs: 300,
  sourceTimeoutMs: 30000,
  maxResultsPerSource: 500,
  autoSearch: true,
}

function createInitialSourceStatuses(): Record<IntelSource, SourceStatus> {
  return Object.fromEntries(
    ALL_SOURCES.map((source) => [
      source,
      {
        source,
        status: 'pending' as const,
        resultCount: 0,
        error: null,
        startTime: null,
        endTime: null,
      },
    ])
  ) as Record<IntelSource, SourceStatus>
}

const initialContext: SearchContext = {
  query: '',
  bounds: null,
  sources: ['track', 'osm', 'opensky', 'feature'],
  filters: DEFAULT_FILTERS,
  options: DEFAULT_OPTIONS,
  sourceStatuses: createInitialSourceStatuses(),
  progress: {
    totalSources: 0,
    completedSources: 0,
    totalResults: 0,
    percentage: 0,
  },
  resultCount: 0,
  error: null,
  searchId: null,
  lastSearchAt: null,
  pendingViewportSearch: false,
}

// =============================================================================
// Helpers
// =============================================================================

function generateSearchId(): string {
  return `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function calculateProgress(sourceStatuses: Record<IntelSource, SourceStatus>): SearchProgress {
  const statuses = Object.values(sourceStatuses)
  const active = statuses.filter((s) => s.status !== 'pending')
  const completed = statuses.filter((s) => s.status === 'complete' || s.status === 'error')
  const totalResults = statuses.reduce((sum, s) => sum + s.resultCount, 0)

  return {
    totalSources: active.length,
    completedSources: completed.length,
    totalResults,
    percentage: active.length > 0 ? Math.round((completed.length / active.length) * 100) : 0,
  }
}

// =============================================================================
// Machine Definition
// =============================================================================

export const searchMachine = setup({
  types: {
    context: {} as SearchContext,
    events: {} as SearchEvent,
  },

  actions: {
    // Query configuration actions
    setQuery: assign(({ event }) => {
      if (event.type !== 'SET_QUERY') return {}
      return { query: event.query }
    }),

    setBounds: assign(({ event }) => {
      if (event.type !== 'SET_BOUNDS') return {}
      return { bounds: event.bounds }
    }),

    toggleSource: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_SOURCE') return {}
      const { source } = event
      const exists = context.sources.includes(source)
      return {
        sources: exists
          ? context.sources.filter((s) => s !== source)
          : [...context.sources, source],
      }
    }),

    setSources: assign(({ event }) => {
      if (event.type !== 'SET_SOURCES') return {}
      return { sources: event.sources }
    }),

    setFilters: assign(({ context, event }) => {
      if (event.type !== 'SET_FILTERS') return {}
      return {
        filters: { ...context.filters, ...event.filters },
      }
    }),

    setOptions: assign(({ context, event }) => {
      if (event.type !== 'SET_OPTIONS') return {}
      return {
        options: { ...context.options, ...event.options },
      }
    }),

    // Search lifecycle actions
    prepareSearch: assign(({ context }) => {
      const searchId = generateSearchId()
      // Reset source statuses for active sources
      const sourceStatuses = { ...context.sourceStatuses }
      for (const source of context.sources) {
        sourceStatuses[source] = {
          source,
          status: 'pending',
          resultCount: 0,
          error: null,
          startTime: null,
          endTime: null,
        }
      }
      return {
        searchId,
        sourceStatuses,
        progress: {
          totalSources: context.sources.length,
          completedSources: 0,
          totalResults: 0,
          percentage: 0,
        },
        error: null,
        lastSearchAt: Date.now(),
      }
    }),

    markSourceStarted: assign(({ context, event }) => {
      if (event.type !== 'SOURCE_STARTED') return {}
      const source = event.source
      return {
        sourceStatuses: {
          ...context.sourceStatuses,
          [source]: {
            ...context.sourceStatuses[source],
            status: 'searching' as const,
            startTime: Date.now(),
          },
        },
      }
    }),

    updateSourceProgress: assign(({ context, event }) => {
      if (event.type !== 'SOURCE_PROGRESS') return {}
      const { source, resultCount } = event
      const sourceStatuses = {
        ...context.sourceStatuses,
        [source]: {
          ...context.sourceStatuses[source],
          resultCount,
        },
      }
      return {
        sourceStatuses,
        progress: calculateProgress(sourceStatuses),
      }
    }),

    markSourceComplete: assign(({ context, event }) => {
      if (event.type !== 'SOURCE_COMPLETE') return {}
      const { source, resultCount } = event
      const sourceStatuses = {
        ...context.sourceStatuses,
        [source]: {
          ...context.sourceStatuses[source],
          status: 'complete' as const,
          resultCount,
          endTime: Date.now(),
        },
      }
      return {
        sourceStatuses,
        progress: calculateProgress(sourceStatuses),
      }
    }),

    markSourceError: assign(({ context, event }) => {
      if (event.type !== 'SOURCE_ERROR') return {}
      const { source, error } = event
      const sourceStatuses = {
        ...context.sourceStatuses,
        [source]: {
          ...context.sourceStatuses[source],
          status: 'error' as const,
          error,
          endTime: Date.now(),
        },
      }
      return {
        sourceStatuses,
        progress: calculateProgress(sourceStatuses),
      }
    }),

    setSearchComplete: assign(({ context, event }) => {
      if (event.type !== 'SEARCH_COMPLETE') return {}
      return {
        resultCount: event.totalResults,
        progress: {
          ...context.progress,
          percentage: 100,
          totalResults: event.totalResults,
        },
      }
    }),

    setSearchError: assign(({ event }) => {
      if (event.type !== 'SEARCH_ERROR') return {}
      return { error: event.error }
    }),

    cancelSearch: assign(({ context }) => {
      // Mark all searching sources as cancelled
      const sourceStatuses = { ...context.sourceStatuses }
      for (const source of context.sources) {
        if (sourceStatuses[source].status === 'searching') {
          sourceStatuses[source] = {
            ...sourceStatuses[source],
            status: 'cancelled',
            endTime: Date.now(),
          }
        }
      }
      return {
        sourceStatuses,
        searchId: null,
      }
    }),

    clearSearch: assign({
      query: '',
      bounds: null,
      sourceStatuses: createInitialSourceStatuses(),
      progress: {
        totalSources: 0,
        completedSources: 0,
        totalResults: 0,
        percentage: 0,
      },
      resultCount: 0,
      error: null,
      searchId: null,
    }),

    // Viewport debounce actions
    markViewportPending: assign({
      pendingViewportSearch: true,
    }),

    clearViewportPending: assign({
      pendingViewportSearch: false,
    }),

    updateBoundsFromViewport: assign(({ event }) => {
      if (event.type !== 'VIEWPORT_CHANGED') return {}
      return { bounds: event.bounds }
    }),
  },

  guards: {
    hasQuery: ({ context }) => context.query.trim().length > 0,
    hasBounds: ({ context }) => context.bounds !== null,
    hasActiveSources: ({ context }) => context.sources.length > 0,
    canSearch: ({ context }) =>
      (context.query.trim().length > 0 || context.bounds !== null) && context.sources.length > 0,
    autoSearchEnabled: ({ context }) => context.options.autoSearch,
    allSourcesComplete: ({ context }) => {
      return context.sources.every((source) => {
        const status = context.sourceStatuses[source].status
        return status === 'complete' || status === 'error' || status === 'cancelled'
      })
    },
    hasPartialResults: ({ context }) => context.progress.totalResults > 0,
    isPendingViewport: ({ context }) => context.pendingViewportSearch,
  },

  delays: {
    VIEWPORT_DEBOUNCE: ({ context }) => context.options.debounceMs,
    SOURCE_TIMEOUT: ({ context }) => context.options.sourceTimeoutMs,
  },
}).createMachine({
  id: 'geointSearch',
  initial: 'idle',
  context: initialContext,

  // Global event handlers (available in any state)
  on: {
    SET_QUERY: {
      actions: 'setQuery',
    },
    SET_BOUNDS: {
      actions: 'setBounds',
    },
    TOGGLE_SOURCE: {
      actions: 'toggleSource',
    },
    SET_SOURCES: {
      actions: 'setSources',
    },
    SET_FILTERS: {
      actions: 'setFilters',
    },
    SET_OPTIONS: {
      actions: 'setOptions',
    },
  },

  states: {
    // =========================================================================
    // IDLE STATE
    // =========================================================================
    idle: {
      description: 'No active search, ready to accept queries',

      on: {
        SEARCH: {
          target: 'searching',
          guard: 'canSearch',
        },

        VIEWPORT_CHANGED: {
          target: 'debouncing',
          guard: 'autoSearchEnabled',
          actions: ['updateBoundsFromViewport', 'markViewportPending'],
        },
      },
    },

    // =========================================================================
    // DEBOUNCING STATE
    // =========================================================================
    debouncing: {
      description: 'Waiting for viewport changes to settle before auto-searching',

      after: {
        VIEWPORT_DEBOUNCE: {
          target: 'searching',
          guard: 'canSearch',
          actions: 'clearViewportPending',
        },
      },

      on: {
        // Reset debounce on new viewport change
        VIEWPORT_CHANGED: {
          target: 'debouncing',
          reenter: true,
          actions: 'updateBoundsFromViewport',
        },

        // Allow manual search to skip debounce
        SEARCH: {
          target: 'searching',
          guard: 'canSearch',
          actions: 'clearViewportPending',
        },

        CANCEL: {
          target: 'idle',
          actions: 'clearViewportPending',
        },
      },
    },

    // =========================================================================
    // SEARCHING STATE
    // =========================================================================
    searching: {
      description: 'Active search in progress with per-source tracking',

      entry: 'prepareSearch',

      on: {
        // Per-source progress events
        SOURCE_STARTED: {
          actions: 'markSourceStarted',
        },

        SOURCE_PROGRESS: {
          actions: 'updateSourceProgress',
        },

        SOURCE_COMPLETE: {
          actions: 'markSourceComplete',
        },

        SOURCE_ERROR: {
          actions: 'markSourceError',
        },

        // Global completion
        SEARCH_COMPLETE: [
          {
            target: 'results',
            guard: 'hasPartialResults',
            actions: 'setSearchComplete',
          },
          {
            target: 'idle',
            actions: 'setSearchComplete',
          },
        ],

        SEARCH_ERROR: {
          target: 'error',
          actions: 'setSearchError',
        },

        // Allow cancellation during search
        CANCEL: {
          target: 'idle',
          actions: 'cancelSearch',
        },

        // Allow new search to restart
        SEARCH: {
          target: 'searching',
          guard: 'canSearch',
          reenter: true,
        },

        // Viewport changes during search queue for after
        VIEWPORT_CHANGED: {
          actions: ['updateBoundsFromViewport', 'markViewportPending'],
        },
      },
    },

    // =========================================================================
    // RESULTS STATE
    // =========================================================================
    results: {
      description: 'Search complete, displaying results',

      on: {
        // New search
        SEARCH: {
          target: 'searching',
          guard: 'canSearch',
        },

        // Clear results and return to idle
        CLEAR: {
          target: 'idle',
          actions: 'clearSearch',
        },

        // Viewport change triggers new search
        VIEWPORT_CHANGED: {
          target: 'debouncing',
          guard: 'autoSearchEnabled',
          actions: ['updateBoundsFromViewport', 'markViewportPending'],
        },
      },
    },

    // =========================================================================
    // ERROR STATE
    // =========================================================================
    error: {
      description: 'Search failed globally',

      on: {
        // Retry the search
        RETRY: {
          target: 'searching',
          guard: 'canSearch',
        },

        // New search
        SEARCH: {
          target: 'searching',
          guard: 'canSearch',
        },

        // Clear and return to idle
        CLEAR: {
          target: 'idle',
          actions: 'clearSearch',
        },
      },
    },
  },
})

// =============================================================================
// Type Exports
// =============================================================================

export type SearchMachine = typeof searchMachine
export type SearchActor = ActorRefFrom<SearchMachine>
export type SearchSnapshot = SnapshotFrom<SearchMachine>
