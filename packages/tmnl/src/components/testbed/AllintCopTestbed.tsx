/**
 * ALLINT COP Testbed
 *
 * Interactive testbed for the All-Source Intelligence Common Operating Picture
 * search system. Demonstrates:
 * - SearchPanel UI with source filters
 * - Search result visualization layers
 * - Viewport-based auto-search
 * - Real API integration (OpenSky, Overpass)
 *
 * Route: /testbed/allint-cop
 *
 * @see beads:tmnl-j5pyc ALLINT COP Search System
 * @module
 */

import { useState, useCallback, useMemo } from 'react'
import {
  Search,
  MapPin,
  Plane,
  Building,
  Layers,
  RefreshCw,
  Zap,
  Globe,
} from 'lucide-react'
import { Effect, Layer, HashMap, pipe } from 'effect'
import { FetchHttpClient } from '@effect/platform'
import { DeckGL } from '@deck.gl/react'
import { Map as MapboxMap } from 'react-map-gl/mapbox'
import type { MapViewState } from '@deck.gl/core'
import { TestbedHeader, TestCard } from './shared'
import {
  SearchPanel,
  viewStateToBBox,
} from '@/lib/geoint/components'
import {
  createSearchResultLayers,
} from '@/lib/geoint/layers'
import {
  OpenSkyClientService,
  OverpassClientService,
  openSkyToSearchResult,
  overpassToSearchResult,
  ExternalApiClientsLive,
} from '@/lib/geoint/api/ExternalApiClient'
import type {
  SearchResultItem,
  SearchResultPoi,
  SearchResultFlight,
  IntelSource,
  BBox,
} from '@/lib/geoint/schemas'

// =============================================================================
// Configuration
// =============================================================================

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''
const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11'

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -122.42,
  latitude: 37.78,
  zoom: 12,
  pitch: 0,
  bearing: 0,
}

// =============================================================================
// Real API Search Effect
// =============================================================================

/**
 * Combined layer for API clients with HTTP
 */
const ApiLayer = pipe(
  ExternalApiClientsLive,
  Layer.provide(FetchHttpClient.layer)
)

/**
 * Search flights from OpenSky API
 */
const searchFlightsEffect = (bounds: BBox, limit: number) =>
  Effect.gen(function* () {
    const opensky = yield* OpenSkyClientService
    const response = yield* opensky.getStates({ bounds }).pipe(
      Effect.catchAll(() => Effect.succeed({ time: Date.now(), states: null } as const))
    )

    return (response.states ?? [])
      .map(openSkyToSearchResult)
      .filter((r): r is SearchResultFlight => r !== null)
      .slice(0, limit)
  })

/**
 * Search POIs from Overpass API
 */
const searchPoisEffect = (bounds: BBox, amenities: string[], limit: number) =>
  Effect.gen(function* () {
    const overpass = yield* OverpassClientService

    const query = overpass.buildQuery({
      bounds,
      amenities: amenities.length > 0 ? amenities : ['hospital', 'police', 'fire_station', 'school'],
    })

    const response = yield* overpass.query(query).pipe(
      Effect.catchAll(() =>
        Effect.succeed({
          version: 0,
          generator: '',
          osm3s: { timestamp_osm_base: '', copyright: '' },
          elements: [],
        } as const)
      )
    )

    return response.elements
      .map(overpassToSearchResult)
      .filter((r): r is SearchResultPoi => r !== null)
      .slice(0, limit)
  })

/**
 * Combined search effect for all sources
 */
const searchAllEffect = (bounds: BBox, sources: IntelSource[], limit: number) =>
  Effect.gen(function* () {
    const results: SearchResultItem[] = []
    const sourceCounts: Record<string, number> = {}

    // Query OpenSky if requested
    if (sources.includes('opensky') || sources.length === 0) {
      const flights = yield* searchFlightsEffect(bounds, limit)
      results.push(...flights)
      sourceCounts['opensky'] = flights.length
    }

    // Query Overpass if requested
    if (sources.includes('osm') || sources.length === 0) {
      const pois = yield* searchPoisEffect(bounds, [], limit)
      results.push(...pois)
      sourceCounts['osm'] = pois.length
    }

    return { results, sourceCounts }
  })

/**
 * Run the search effect with provided layer
 */
const runSearch = (bounds: BBox, sources: IntelSource[], limit: number = 50) =>
  Effect.runPromise(
    searchAllEffect(bounds, sources, limit).pipe(Effect.provide(ApiLayer))
  )

// =============================================================================
// Stats Panel Component
// =============================================================================

interface StatsPanelProps {
  results: SearchResultItem[]
  resultsBySource: HashMap.HashMap<IntelSource, readonly SearchResultItem[]>
  status: string
}

function StatsPanel({ results, resultsBySource, status }: StatsPanelProps) {
  const sourceStats = useMemo(() => {
    const stats: Record<IntelSource, number> = {
      track: 0,
      osm: 0,
      opensky: 0,
      feature: 0,
      adsb_lol: 0,
      planet: 0,
      custom: 0,
    }
    for (const [source, items] of resultsBySource) {
      stats[source] = items.length
    }
    return stats
  }, [resultsBySource])

  return (
    <div className="bg-surface-1 border border-border-subtle rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-accent-primary" />
        <span className="text-sm font-medium text-text-primary">Search Stats</span>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-text-tertiary">Status</span>
          <span className={`font-mono ${
            status === 'completed' ? 'text-status-success' :
            status === 'searching' ? 'text-status-warning' :
            status === 'error' ? 'text-status-error' : 'text-text-secondary'
          }`}>{status}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">Total Results</span>
          <span className="font-mono text-text-primary">{results.length}</span>
        </div>
        <div className="border-t border-border-subtle my-2" />
        <div className="flex justify-between">
          <span className="text-text-tertiary flex items-center gap-1">
            <MapPin className="w-3 h-3 text-green-400" /> Tracks
          </span>
          <span className="font-mono text-text-primary">{sourceStats.track}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary flex items-center gap-1">
            <Building className="w-3 h-3 text-blue-400" /> POIs
          </span>
          <span className="font-mono text-text-primary">{sourceStats.osm}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary flex items-center gap-1">
            <Plane className="w-3 h-3 text-yellow-400" /> Flights
          </span>
          <span className="font-mono text-text-primary">{sourceStats.opensky}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-400" /> Features
          </span>
          <span className="font-mono text-text-primary">{sourceStats.feature}</span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Main Testbed Component
// =============================================================================

export function AllintCopTestbed() {
  // State
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE)
  const [mockResults, setMockResults] = useState<SearchResultItem[]>([])
  const [mockResultsBySource, setMockResultsBySource] = useState<HashMap.HashMap<IntelSource, readonly SearchResultItem[]>>(HashMap.empty())
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'completed' | 'error'>('idle')
  const [autoSearch, setAutoSearch] = useState(false)

  // Compute current viewport bounds
  const viewportBounds = useMemo(() => viewStateToBBox(viewState), [viewState])

  // Handle search execution - calls real OpenSky/Overpass APIs
  const handleSearch = useCallback((bounds: BBox, sources: IntelSource[]) => {
    setSearchStatus('searching')

    // Call real APIs via Effect
    runSearch(bounds, sources, 50)
      .then(({ results, sourceCounts }) => {
        setMockResults(results)

        // Group by source using Effect HashMap
        let grouped = HashMap.empty<IntelSource, SearchResultItem[]>()
        for (const result of results) {
          const existing = pipe(
            HashMap.get(grouped, result.source),
            (opt) => opt._tag === 'Some' ? opt.value : []
          )
          grouped = HashMap.set(grouped, result.source, [...existing, result])
        }
        setMockResultsBySource(grouped as HashMap.HashMap<IntelSource, readonly SearchResultItem[]>)
        setSearchStatus('completed')
        console.log('[ALLINT COP] Real API results:', { total: results.length, sourceCounts })
      })
      .catch((error) => {
        console.error('[ALLINT COP] Search failed:', error)
        setSearchStatus('error')
      })
  }, [])

  // Handle result selection
  const handleResultSelect = useCallback((result: SearchResultItem) => {
    // Fly to result position
    let lon: number
    let lat: number
    switch (result._tag) {
      case 'SearchResultTrack':
      case 'SearchResultFlight':
        lon = result.position[0]
        lat = result.position[1]
        break
      case 'SearchResultPoi':
      case 'SearchResultFeature':
        lon = result.position[0]
        lat = result.position[1]
        break
      default:
        return
    }

    setViewState((prev) => ({
      ...prev,
      longitude: lon,
      latitude: lat,
      zoom: 15,
      transitionDuration: 1000,
    }))
  }, [])

  // Handle view state change
  const handleViewStateChange = useCallback(
    (params: { viewState: MapViewState }) => {
      const newViewState = params.viewState as MapViewState
      setViewState(newViewState)

      // Auto-search on viewport change if enabled
      if (autoSearch) {
        const bounds = viewStateToBBox(newViewState)
        handleSearch(bounds, ['track', 'osm', 'opensky', 'feature'])
      }
    },
    [autoSearch, handleSearch]
  )

  // Create deck.gl layers from results
  const deckLayers = useMemo(() => {
    if (mockResults.length === 0) return []
    return createSearchResultLayers(mockResults, {
      idPrefix: 'allint-cop',
      pickable: true,
      opacity: 0.9,
    })
  }, [mockResults])

  return (
    <div className="w-full h-full flex flex-col bg-surface-0">
      <TestbedHeader
        title="ALLINT COP Testbed"
        subtitle="All-Source Intelligence Common Operating Picture search system"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Search Controls */}
        <div className="w-80 flex-shrink-0 p-4 space-y-4 overflow-y-auto border-r border-border-subtle">
          <TestCard title="Search Panel" actions={<Search className="w-4 h-4 text-text-tertiary" />}>
            <SearchPanel
              viewportBounds={viewportBounds}
              onSearch={handleSearch}
              onResultSelect={handleResultSelect}
              autoSearch={autoSearch}
              className="max-h-[500px]"
            />
          </TestCard>

          <TestCard title="Controls" actions={<RefreshCw className="w-4 h-4 text-text-tertiary" />}>
            <div className="space-y-3">
              <button
                onClick={() => handleSearch(viewportBounds, ['track', 'osm', 'opensky', 'feature'])}
                className="w-full px-3 py-2 bg-accent-primary text-text-inverse rounded-md text-sm font-medium hover:bg-accent-primary/90 transition-colors"
              >
                Search Current Viewport
              </button>

              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Auto-Search</span>
                <button
                  onClick={() => setAutoSearch(!autoSearch)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    autoSearch
                      ? 'bg-accent-primary/20 text-accent-primary'
                      : 'bg-surface-2 text-text-tertiary hover:bg-surface-3'
                  }`}
                >
                  {autoSearch ? 'ON' : 'OFF'}
                </button>
              </div>

              <button
                onClick={() => {
                  setMockResults([])
                  setMockResultsBySource(HashMap.empty())
                  setSearchStatus('idle')
                }}
                className="w-full px-3 py-2 bg-surface-2 text-text-secondary rounded-md text-sm hover:bg-surface-3 transition-colors"
              >
                Clear Results
              </button>
            </div>
          </TestCard>

          <StatsPanel
            results={mockResults}
            resultsBySource={mockResultsBySource}
            status={searchStatus}
          />
        </div>

        {/* Map View */}
        <div className="flex-1 relative">
          <DeckGL
            viewState={viewState}
            onViewStateChange={handleViewStateChange as any}
            controller={true}
            layers={deckLayers}
          >
            <MapboxMap
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle={DEFAULT_MAP_STYLE}
              attributionControl={false}
            />
          </DeckGL>

          {/* Viewport Info Overlay */}
          <div className="absolute bottom-4 left-4 bg-surface-1/90 backdrop-blur-sm border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono text-text-tertiary">
            <div className="flex items-center gap-2">
              <Globe className="w-3 h-3" />
              <span>
                {viewState.latitude.toFixed(4)}, {viewState.longitude.toFixed(4)} · Z{viewState.zoom.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AllintCopTestbed
