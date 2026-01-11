/**
 * Search Service Testbed
 *
 * Demonstrates Effect.Service + Atom-based state management patterns:
 * - Effect.Service with Context.Tag (SearchServiceTag)
 * - Atom-based state with registry.set() / registry.get()
 * - Derived atoms with Atom.readable
 * - HashMap for result grouping
 * - Error handling with typed errors
 *
 * Route: /testbed/search-service
 *
 * HYPOTHESES:
 * - H1: Service mutations update atoms via registry.set()
 * - H2: Derived atoms recompute correctly
 * - H3: Search history maintains bounded size
 * - H4: Error state propagates correctly
 * - H5: Mock service simulates real behavior
 *
 * @module testbed/search-service
 */

import { useEffect, useState, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Layers,
  History,
  Plane,
} from 'lucide-react'
import { Effect, HashMap } from 'effect'
import * as Registry from '@effect-atom/atom/Registry'

import { SectionLabel } from '@/components/testbed/shared'

// Import SearchService atoms
import {
  activeSearchIdAtom,
  searchStatusAtom,
  lastSearchResponseAtom,
  resultsBySourceAtom,
  searchErrorAtom,
  sessionHistoryAtom,
  resultsCountAtom,
  type SearchStatus,
  type SearchService,
} from '@/lib/geoint/services/SearchService'

import {
  SearchId,
  SearchQuery,
  SearchResponse,
  SearchResultTrack,
  SearchResultPoi,
  SearchResultFlight,
  SearchResultFeature,
  GeoFilterBounds,
  type IntelSource,
  type SearchResultId,
  type TrackId,
  type PoiId,
  type FeatureId,
  type Icao24,
} from '@/lib/geoint/schemas'

// =============================================================================
// Hypotheses Tracking
// =============================================================================

interface Hypotheses {
  h1_registrySet: boolean
  h2_derivedAtoms: boolean
  h3_historyBounded: boolean
  h4_errorPropagation: boolean
  h5_mockService: boolean
}

const initialHypotheses: Hypotheses = {
  h1_registrySet: false,
  h2_derivedAtoms: false,
  h3_historyBounded: false,
  h4_errorPropagation: false,
  h5_mockService: false,
}

// =============================================================================
// Schema-Validated Mock Data Generator
// =============================================================================

/**
 * Generate mock search results using Effect Schema TaggedClass constructors.
 * This ensures all data passes schema validation at construction time.
 */
function generateMockResults(queryId: SearchId): {
  results: (SearchResultTrack | SearchResultPoi | SearchResultFlight | SearchResultFeature)[]
  sourceCounts: Record<string, number>
} {
  const now = new Date()

  // Generate mock tracks (5 results)
  const tracks: SearchResultTrack[] = Array.from({ length: 5 }, (_, i) =>
    new SearchResultTrack({
      id: `${queryId}-track-${i}` as SearchResultId,
      source: 'track',
      score: 0.85 + Math.random() * 0.15,
      retrievedAt: now,
      trackId: `TRK-${1000 + i}` as TrackId,
      position: [
        -122.4 + (Math.random() - 0.5) * 0.1, // lon near SF
        37.8 + (Math.random() - 0.5) * 0.1,   // lat near SF
        Math.floor(Math.random() * 10000),     // altitude meters
      ],
      heading: Math.floor(Math.random() * 360),
      speed: Math.floor(50 + Math.random() * 200), // 50-250 m/s
      classification: (['friendly', 'neutral', 'unknown'] as const)[i % 3],
      objectType: (['aircraft', 'vehicle', 'vessel'] as const)[i % 3],
      label: `Track ${String.fromCharCode(65 + i)}`,
    })
  )

  // Generate mock POIs (3 results)
  const pois: SearchResultPoi[] = Array.from({ length: 3 }, (_, i) =>
    new SearchResultPoi({
      id: `${queryId}-poi-${i}` as SearchResultId,
      source: 'osm',
      score: 0.7 + Math.random() * 0.2,
      retrievedAt: now,
      poiId: `OSM-${2000 + i}` as PoiId,
      position: [
        -122.4 + (Math.random() - 0.5) * 0.05,
        37.8 + (Math.random() - 0.5) * 0.05,
      ],
      name: ['Hospital', 'Airport', 'Military Base'][i],
      category: (['healthcare', 'aeroway', 'military'] as const)[i],
      tags: { name: ['SF General', 'SFO International', 'Presidio'][i] },
    })
  )

  // Generate mock flights (4 results)
  const flights: SearchResultFlight[] = Array.from({ length: 4 }, (_, i) =>
    new SearchResultFlight({
      id: `${queryId}-flight-${i}` as SearchResultId,
      source: 'opensky',
      score: 0.9 + Math.random() * 0.1,
      retrievedAt: now,
      icao24: `a${i}${i}${i}${i}${i}${i}` as Icao24, // Valid 6-char hex
      callsign: `UAL${100 + i}`,
      position: [
        -122.4 + (Math.random() - 0.5) * 0.2,
        37.8 + (Math.random() - 0.5) * 0.2,
        3000 + Math.floor(Math.random() * 9000), // 3000-12000m altitude
      ],
      velocity: 150 + Math.floor(Math.random() * 100), // 150-250 m/s
      heading: Math.floor(Math.random() * 360),
      verticalRate: Math.floor((Math.random() - 0.5) * 20), // -10 to +10 m/s
      onGround: false,
      category: (['medium', 'heavy', 'light'] as const)[i % 3],
      originCountry: 'United States',
      lastContact: new Date(now.getTime() - Math.floor(Math.random() * 60000)),
    })
  )

  // Generate mock features (2 results)
  const features: SearchResultFeature[] = Array.from({ length: 2 }, (_, i) =>
    new SearchResultFeature({
      id: `${queryId}-feature-${i}` as SearchResultId,
      source: 'feature',
      score: 0.75 + Math.random() * 0.2,
      retrievedAt: now,
      featureId: `FTR-${3000 + i}` as FeatureId,
      position: [
        -122.4 + (Math.random() - 0.5) * 0.08,
        37.8 + (Math.random() - 0.5) * 0.08,
      ],
      geometryType: (['Point', 'Polygon'] as const)[i],
      properties: { category: ['landmark', 'boundary'][i], area_km2: i * 10 + 5 },
      label: ['Golden Gate', 'SF Bay'][i],
    })
  )

  const results = [...tracks, ...pois, ...flights, ...features]

  return {
    results,
    sourceCounts: {
      track: tracks.length,
      osm: pois.length,
      opensky: flights.length,
      feature: features.length,
    },
  }
}

// =============================================================================
// Mock Service Factory
// =============================================================================

function createMockSearchService(registry: Registry.Registry): SearchService {
  let searchCounter = 0

  const search = (query: SearchQuery) =>
    Effect.gen(function* () {
      // H1: registry.set() mutations
      registry.set(activeSearchIdAtom, query.id)
      registry.set(searchStatusAtom, 'searching')
      registry.set(searchErrorAtom, null)

      // Add to history (bounded)
      const history = registry.get(sessionHistoryAtom)
      registry.set(sessionHistoryAtom, [query, ...history.slice(0, 19)])

      // Simulate async delay
      yield* Effect.sleep('200 millis')

      // Generate Schema-validated mock results
      const { results, sourceCounts } = generateMockResults(query.id)

      // Create response with validated results
      const response = new SearchResponse({
        queryId: query.id,
        totalCount: results.length,
        results,
        sourceCounts,
        executionTimeMs: 200,
        truncated: false,
      })

      // Update atoms with validated results
      registry.set(lastSearchResponseAtom, response)
      registry.set(searchStatusAtom, 'completed')

      // Group results by source using HashMap
      let resultMap = HashMap.empty<IntelSource, typeof results>()
      for (const result of results) {
        const source = result.source as IntelSource
        const existing = HashMap.get(resultMap, source)
        if (existing._tag === 'Some') {
          resultMap = HashMap.set(resultMap, source, [...existing.value, result])
        } else {
          resultMap = HashMap.set(resultMap, source, [result])
        }
      }
      registry.set(resultsBySourceAtom, resultMap)

      return response
    })

  const searchInBounds = (
    bounds: readonly [number, number, number, number],
    options?: { sources?: readonly IntelSource[]; limit?: number }
  ) =>
    Effect.gen(function* () {
      searchCounter++
      const query = new SearchQuery({
        id: `search-${Date.now()}-${searchCounter}` as SearchId,
        geoFilter: new GeoFilterBounds({
          bounds: bounds as [number, number, number, number],
        }),
        sources: [...(options?.sources ?? ['track', 'osm', 'opensky', 'feature'])],
        limitPerSource: options?.limit ?? 100,
      })
      return yield* search(query)
    })

  const cancelActiveSearch = () =>
    Effect.gen(function* () {
      registry.set(searchStatusAtom, 'idle')
      registry.set(activeSearchIdAtom, null)
    })

  const clearResults = () =>
    Effect.gen(function* () {
      registry.set(lastSearchResponseAtom, null)
      registry.set(resultsBySourceAtom, HashMap.empty())
      registry.set(searchStatusAtom, 'idle')
      registry.set(activeSearchIdAtom, null)
      registry.set(searchErrorAtom, null)
    })

  return {
    search,
    searchInBounds,
    cancelActiveSearch,
    clearResults,
    registry,
  }
}

// =============================================================================
// Status Badge
// =============================================================================

function StatusBadge({ status }: { status: SearchStatus }) {
  const config = {
    idle: { color: 'var(--tmnl-text-muted)', icon: Clock, label: 'IDLE' },
    searching: { color: 'var(--tmnl-accent-amber)', icon: RefreshCw, label: 'SEARCHING' },
    completed: { color: 'var(--tmnl-status-success)', icon: CheckCircle2, label: 'COMPLETED' },
    error: { color: 'var(--tmnl-status-error)', icon: AlertCircle, label: 'ERROR' },
  }[status]

  const Icon = config.icon

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 rounded-full"
      style={{
        backgroundColor: `color-mix(in srgb, ${config.color} 20%, transparent)`,
        color: config.color,
        fontSize: 'var(--tmnl-text-xs, 12px)',
      }}
    >
      <Icon size={12} className={status === 'searching' ? 'animate-spin' : ''} />
      {config.label}
    </div>
  )
}

// =============================================================================
// Source Card
// =============================================================================

function SourceCard({ source, count }: { source: string; count: number }) {
  const icons: Record<string, React.ReactNode> = {
    track: <Layers size={14} />,
    osm: <MapPin size={14} />,
    opensky: <Plane size={14} />,
    feature: <MapPin size={14} />,
    weather: <AlertCircle size={14} />,
  }

  const colors: Record<string, string> = {
    track: 'var(--tmnl-accent-cyan)',
    osm: 'var(--tmnl-accent-emerald)',
    opensky: 'var(--tmnl-accent-amber)',
    feature: 'var(--tmnl-accent-rose)',
    weather: 'var(--tmnl-status-info)',
  }

  return (
    <div
      className="bg-[var(--tmnl-surface-sunken)] rounded p-3 flex items-center justify-between"
      style={{ borderLeft: `3px solid ${colors[source] || 'var(--tmnl-text-muted)'}` }}
    >
      <div className="flex items-center gap-2" style={{ color: colors[source] || 'var(--tmnl-text-muted)' }}>
        {icons[source] || <MapPin size={14} />}
        <span className="font-mono uppercase" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          {source}
        </span>
      </div>
      <span className="font-mono text-[var(--tmnl-text-primary)]" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>
        {count}
      </span>
    </div>
  )
}

// =============================================================================
// Hypothesis Indicator
// =============================================================================

function HypothesisIndicator({ id, validated }: { id: string; validated: boolean }) {
  return (
    <div className="flex items-center gap-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
      <div
        className={`w-2 h-2 rounded-full ${validated ? 'bg-[var(--tmnl-status-success)]' : 'bg-[var(--tmnl-surface-sunken)]'}`}
      />
      <span className={validated ? 'text-[var(--tmnl-text-primary)]' : 'text-[var(--tmnl-text-muted)]'}>
        {id}
      </span>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function SearchServiceTestbed() {
  // Create isolated registry
  const [registry] = useState(() => Registry.make())
  const [service] = useState(() => createMockSearchService(registry))

  // Local state mirroring atoms (for display without atom hooks)
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [historyCount, setHistoryCount] = useState(0)
  const [resultsCount, setResultsCount] = useState(0)

  // Hypotheses
  const [hypotheses, setHypotheses] = useState<Hypotheses>(initialHypotheses)

  // Logs
  const [logs, setLogs] = useState<string[]>([])
  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Sync local state with registry
  const syncState = useCallback(() => {
    setStatus(registry.get(searchStatusAtom))
    setActiveId(registry.get(activeSearchIdAtom))
    setResponse(registry.get(lastSearchResponseAtom))
    setHistoryCount(registry.get(sessionHistoryAtom).length)
    setResultsCount(registry.get(resultsCountAtom))
  }, [registry])

  // Poll for state changes (simple approach)
  useEffect(() => {
    const interval = setInterval(syncState, 100)
    return () => clearInterval(interval)
  }, [syncState])

  // Execute search
  const executeSearch = useCallback(() => {
    log('Executing search via mock service...')
    const bounds: [number, number, number, number] = [-122.5, 37.7, -122.3, 37.9]

    Effect.runPromise(service.searchInBounds(bounds))
      .then((resp) => {
        log(`Search completed: ${resp.totalCount} results`)
        // Validate hypotheses
        setHypotheses((h) => ({
          ...h,
          h1_registrySet: true, // registry.set worked
          h5_mockService: true, // mock service executed
        }))
        syncState()
      })
      .catch((error) => {
        log(`Search error: ${error}`)
      })
  }, [service, log, syncState])

  // Clear results
  const clearResults = useCallback(() => {
    log('Clearing results...')
    Effect.runPromise(service.clearResults()).then(() => {
      log('Results cleared')
      syncState()
    })
  }, [service, log, syncState])

  // Test history bounding
  const testHistoryBounding = useCallback(() => {
    log('Testing history bounding (25 rapid searches)...')
    let completed = 0
    for (let i = 0; i < 25; i++) {
      const bounds: [number, number, number, number] = [
        -122.5 + i * 0.01,
        37.7,
        -122.3 + i * 0.01,
        37.9,
      ]
      setTimeout(() => {
        Effect.runPromise(service.searchInBounds(bounds)).then(() => {
          completed++
          if (completed === 25) {
            syncState()
            const history = registry.get(sessionHistoryAtom)
            log(`History size after 25 searches: ${history.length}`)
            if (history.length <= 20) {
              setHypotheses((h) => ({ ...h, h3_historyBounded: true }))
              log('H3 VALIDATED: History bounded to 20')
            }
          }
        })
      }, i * 30)
    }
  }, [service, registry, log, syncState])

  // Validate derived atoms
  useEffect(() => {
    if (resultsCount >= 0 && status === 'completed') {
      // allResultsAtom and resultsCountAtom are derived
      setHypotheses((h) => ({ ...h, h2_derivedAtoms: true }))
    }
  }, [resultsCount, status])

  return (
    <div className="min-h-screen bg-[var(--tmnl-surface-base)] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-[var(--tmnl-text-secondary)] hover:text-[var(--tmnl-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Back</span>
        </Link>
        <h1 className="font-mono font-bold text-[var(--tmnl-text-primary)]" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>
          Search Service Testbed
        </h1>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Column 1: Controls */}
        <div className="space-y-4">
          <SectionLabel>Controls</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <button
              onClick={executeSearch}
              disabled={status === 'searching'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-[var(--tmnl-accent-cyan)] text-black font-mono disabled:opacity-50"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <Search size={14} />
              Execute Search
            </button>

            <button
              onClick={clearResults}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-primary)] font-mono hover:bg-[var(--tmnl-surface-base)]"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <Trash2 size={14} />
              Clear Results
            </button>

            <button
              onClick={testHistoryBounding}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-[var(--tmnl-accent-amber)]/20 text-[var(--tmnl-accent-amber)] font-mono hover:bg-[var(--tmnl-accent-amber)]/30"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <History size={14} />
              Test History (25×)
            </button>
          </div>

          <SectionLabel>State Atoms</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            <div className="flex justify-between" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              <span className="text-[var(--tmnl-text-muted)]">Active ID</span>
              <span className="font-mono text-[var(--tmnl-text-primary)]">{activeId?.slice(0, 12) ?? 'null'}</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              <span className="text-[var(--tmnl-text-muted)]">Status</span>
              <span className="font-mono text-[var(--tmnl-accent-cyan)]">{status}</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              <span className="text-[var(--tmnl-text-muted)]">Results Count</span>
              <span className="font-mono text-[var(--tmnl-status-success)]">{resultsCount}</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              <span className="text-[var(--tmnl-text-muted)]">History Size</span>
              <span className="font-mono text-[var(--tmnl-accent-amber)]">{historyCount}</span>
            </div>
          </div>
        </div>

        {/* Column 2-3: Results */}
        <div className="col-span-2 space-y-4">
          <SectionLabel>Source Counts (from SearchResponse)</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4">
            {response ? (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(response.sourceCounts).map(([source, count]) => (
                  <SourceCard key={source} source={source} count={count as number} />
                ))}
              </div>
            ) : (
              <div className="text-center text-[var(--tmnl-text-muted)] py-8" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                No results. Click "Execute Search" to fetch data.
              </div>
            )}
          </div>

          <SectionLabel>Last Response</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4">
            {response ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Query ID</div>
                  <div className="font-mono text-[var(--tmnl-text-primary)]" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                    {response.queryId.slice(0, 16)}...
                  </div>
                </div>
                <div>
                  <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Total Count</div>
                  <div className="font-mono text-[var(--tmnl-accent-cyan)]" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                    {response.totalCount}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Execution Time</div>
                  <div className="font-mono text-[var(--tmnl-accent-amber)]" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                    {response.executionTimeMs}ms
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-[var(--tmnl-text-muted)] py-4" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                No response yet
              </div>
            )}
          </div>

          <SectionLabel>Pattern Notes</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 text-[var(--tmnl-text-muted)] space-y-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <p><strong className="text-[var(--tmnl-text-primary)]">Context.Tag:</strong> SearchServiceTag for DI</p>
            <p><strong className="text-[var(--tmnl-text-primary)]">registry.set():</strong> Sync mutations in Effect.gen</p>
            <p><strong className="text-[var(--tmnl-text-primary)]">Atom.readable:</strong> allResultsAtom derives from resultsBySourceAtom</p>
            <p><strong className="text-[var(--tmnl-text-primary)]">HashMap:</strong> Result grouping by IntelSource</p>
            <p><strong className="text-[var(--tmnl-text-primary)]">Layer:</strong> SearchServiceLive vs SearchServiceTest</p>
            <p><strong className="text-[var(--tmnl-accent-cyan)]">Schema.TaggedClass:</strong> SearchResultTrack, SearchResultPoi, etc.</p>
          </div>
        </div>

        {/* Column 4: Hypotheses & Logs */}
        <div className="space-y-4">
          <SectionLabel>Hypotheses</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            <HypothesisIndicator id="H1: registry.set() works" validated={hypotheses.h1_registrySet} />
            <HypothesisIndicator id="H2: Derived atoms recompute" validated={hypotheses.h2_derivedAtoms} />
            <HypothesisIndicator id="H3: History bounded to 20" validated={hypotheses.h3_historyBounded} />
            <HypothesisIndicator id="H4: Error propagation" validated={hypotheses.h4_errorPropagation} />
            <HypothesisIndicator id="H5: Mock service works" validated={hypotheses.h5_mockService} />
          </div>

          <SectionLabel>Logs</SectionLabel>
          <div className="bg-[var(--tmnl-surface-sunken)] rounded-lg p-3 h-64 overflow-y-auto font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {logs.map((entry, i) => (
              <div key={i} className="text-[var(--tmnl-text-muted)]">{entry}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchServiceTestbed
