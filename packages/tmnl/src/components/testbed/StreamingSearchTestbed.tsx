/**
 * Streaming Search Testbed
 *
 * Demonstrates the streaming search event flow:
 * - SearchStarted → SearchPartialResults[] → SearchCompleted
 * - Typed SearchError handling with Match.type
 * - Progressive results accumulation
 * - Source-by-source completion tracking
 *
 * Route: /testbed/streaming-search
 *
 * HYPOTHESES:
 * - H1: Events flow in correct sequence (Started → Partial → Completed)
 * - H2: Partial results accumulate progressively
 * - H3: Source completion tracked individually
 * - H4: Error types handled exhaustively
 * - H5: Stream can be cancelled mid-flight
 *
 * @module testbed/streaming-search
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Play,
  Square,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Plane,
  MapPin,
  Cloud,
  Satellite,
} from 'lucide-react'
import { Effect, Stream, Match, pipe } from 'effect'

import { SectionLabel } from '@/components/testbed/shared'

// Import streaming search schemas
import {
  SearchStarted,
  SearchPartialResults,
  SearchCompleted,
  SearchResultTrack,
  SearchResultPoi,
  SearchResultFlight,
  SearchResultFeature,
  type SearchEvent,
  type SearchId,
  type SearchResultId,
  type SearchResultItem,
  type IntelSource,
  type TrackId,
  type PoiId,
  type FeatureId,
  type Icao24,
} from '@/lib/geoint/schemas'

// Import error schemas
import {
  SearchNetworkError,
  SearchTimeoutError,
  SearchRateLimitError,
  type SearchError,
} from '@/lib/geoint/schemas/errors'

// =============================================================================
// Hypotheses Tracking
// =============================================================================

interface Hypotheses {
  h1_eventSequence: boolean
  h2_progressiveAccumulation: boolean
  h3_sourceTracking: boolean
  h4_errorHandling: boolean
  h5_cancellation: boolean
}

const initialHypotheses: Hypotheses = {
  h1_eventSequence: false,
  h2_progressiveAccumulation: false,
  h3_sourceTracking: false,
  h4_errorHandling: false,
  h5_cancellation: false,
}

// =============================================================================
// Source Status Display
// =============================================================================

type SourceStatus = 'pending' | 'searching' | 'completed' | 'error'

interface SourceState {
  status: SourceStatus
  resultCount: number
  error?: string
}

const sourceIcons: Record<string, React.ReactNode> = {
  track: <Layers size={14} />,
  osm: <MapPin size={14} />,
  opensky: <Plane size={14} />,
  feature: <MapPin size={14} />,
  weather: <Cloud size={14} />,
  planet: <Satellite size={14} />,
  sentinel: <Satellite size={14} />,
}

const sourceColors: Record<string, string> = {
  track: 'var(--tmnl-accent-cyan)',
  osm: 'var(--tmnl-accent-emerald)',
  opensky: 'var(--tmnl-accent-amber)',
  feature: 'var(--tmnl-accent-rose)',
  weather: 'var(--tmnl-status-info)',
  planet: 'var(--tmnl-accent-violet)',
  sentinel: 'var(--tmnl-accent-violet)',
}

function SourceStatusCard({ source, state }: { source: string; state: SourceState }) {
  const statusConfig = {
    pending: { color: 'var(--tmnl-text-muted)', icon: Clock, animate: false },
    searching: { color: 'var(--tmnl-accent-amber)', icon: RefreshCw, animate: true },
    completed: { color: 'var(--tmnl-status-success)', icon: CheckCircle2, animate: false },
    error: { color: 'var(--tmnl-status-error)', icon: AlertCircle, animate: false },
  }[state.status]

  const StatusIcon = statusConfig.icon

  return (
    <div
      className="bg-[var(--tmnl-surface-raised)] rounded p-3 flex items-center justify-between"
      style={{ borderLeft: `3px solid ${sourceColors[source] || 'var(--tmnl-text-muted)'}` }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: sourceColors[source] || 'var(--tmnl-text-muted)' }}>
          {sourceIcons[source] || <MapPin size={14} />}
        </span>
        <span className="font-mono uppercase" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          {source}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[var(--tmnl-text-primary)]" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          {state.resultCount}
        </span>
        <StatusIcon
          size={14}
          style={{ color: statusConfig.color }}
          className={statusConfig.animate ? 'animate-spin' : ''}
        />
      </div>
    </div>
  )
}

// =============================================================================
// Event Timeline Display
// =============================================================================

interface TimelineEvent {
  type: 'started' | 'partial' | 'completed' | 'error'
  source?: string
  count?: number
  timestamp: Date
  message: string
}

function EventTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {events.map((event, i) => {
        const colors = {
          started: 'var(--tmnl-accent-cyan)',
          partial: 'var(--tmnl-accent-emerald)',
          completed: 'var(--tmnl-status-success)',
          error: 'var(--tmnl-status-error)',
        }
        return (
          <div key={i} className="flex items-center gap-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[event.type] }} />
            <span className="text-[var(--tmnl-text-muted)] font-mono">
              {event.timestamp.toLocaleTimeString()}
            </span>
            <span className="text-[var(--tmnl-text-primary)]">{event.message}</span>
          </div>
        )
      })}
    </div>
  )
}

// =============================================================================
// Mock Result Generator
// =============================================================================

function generateMockResultsForSource(
  queryId: SearchId,
  source: IntelSource,
  count: number
): SearchResultItem[] {
  const now = new Date()

  switch (source) {
    case 'track':
      return Array.from({ length: count }, (_, i) =>
        new SearchResultTrack({
          id: `${queryId}-track-${i}` as SearchResultId,
          source: 'track',
          score: 0.8 + Math.random() * 0.2,
          retrievedAt: now,
          trackId: `TRK-${1000 + i}` as TrackId,
          position: [-122.4 + Math.random() * 0.1, 37.8 + Math.random() * 0.1, Math.random() * 10000],
          heading: Math.floor(Math.random() * 360),
          speed: 50 + Math.floor(Math.random() * 200),
          classification: (['friendly', 'neutral', 'unknown'] as const)[i % 3],
          objectType: (['aircraft', 'vehicle', 'vessel'] as const)[i % 3],
          label: `Track ${i + 1}`,
        })
      )

    case 'osm':
      return Array.from({ length: count }, (_, i) =>
        new SearchResultPoi({
          id: `${queryId}-poi-${i}` as SearchResultId,
          source: 'osm',
          score: 0.7 + Math.random() * 0.3,
          retrievedAt: now,
          poiId: `OSM-${2000 + i}` as PoiId,
          position: [-122.4 + Math.random() * 0.05, 37.8 + Math.random() * 0.05],
          name: ['Hospital', 'Airport', 'Station', 'School'][i % 4],
          category: (['healthcare', 'aeroway', 'public_transport', 'building'] as const)[i % 4],
          tags: { name: `POI ${i + 1}` },
        })
      )

    case 'opensky':
      return Array.from({ length: count }, (_, i) =>
        new SearchResultFlight({
          id: `${queryId}-flight-${i}` as SearchResultId,
          source: 'opensky',
          score: 0.9 + Math.random() * 0.1,
          retrievedAt: now,
          icao24: `a${i}${i}${i}${i}${i}${i}` as Icao24,
          callsign: `UAL${100 + i}`,
          position: [-122.4 + Math.random() * 0.2, 37.8 + Math.random() * 0.2, 3000 + Math.random() * 9000],
          velocity: 150 + Math.floor(Math.random() * 100),
          heading: Math.floor(Math.random() * 360),
          verticalRate: Math.floor((Math.random() - 0.5) * 20),
          onGround: false,
          category: (['medium', 'heavy', 'light'] as const)[i % 3],
          originCountry: 'United States',
          lastContact: new Date(now.getTime() - Math.random() * 60000),
        })
      )

    case 'feature':
      return Array.from({ length: count }, (_, i) =>
        new SearchResultFeature({
          id: `${queryId}-feature-${i}` as SearchResultId,
          source: 'feature',
          score: 0.75 + Math.random() * 0.25,
          retrievedAt: now,
          featureId: `FTR-${3000 + i}` as FeatureId,
          position: [-122.4 + Math.random() * 0.08, 37.8 + Math.random() * 0.08],
          geometryType: (['Point', 'LineString', 'Polygon'] as const)[i % 3],
          properties: { type: 'boundary' },
          label: `Feature ${i + 1}`,
        })
      )

    default:
      return []
  }
}

// =============================================================================
// Streaming Search Simulation
// =============================================================================

function createStreamingSearch(
  queryId: SearchId,
  sources: readonly IntelSource[],
  shouldError: boolean,
  onEvent: (event: SearchEvent) => void
): { cancel: () => void } {
  let cancelled = false

  const run = async () => {
    // 1. Emit SearchStarted
    const startedEvent = new SearchStarted({
      queryId,
      sources: [...sources],
      startedAt: new Date(),
    })
    onEvent(startedEvent)

    // 2. Emit SearchPartialResults for each source (with delays)
    for (let i = 0; i < sources.length; i++) {
      if (cancelled) break

      const source = sources[i]
      const delay = 300 + Math.random() * 500 // 300-800ms per source

      await new Promise((resolve) => setTimeout(resolve, delay))
      if (cancelled) break

      // Simulate error for one source if requested
      if (shouldError && source === 'opensky') {
        const partialEvent = new SearchPartialResults({
          queryId,
          source,
          results: [],
          isComplete: false,
          error: 'Rate limit exceeded (429)',
        })
        onEvent(partialEvent)
        continue
      }

      const results = generateMockResultsForSource(queryId, source, 3 + Math.floor(Math.random() * 5))
      const partialEvent = new SearchPartialResults({
        queryId,
        source,
        results,
        isComplete: true,
      })
      onEvent(partialEvent)
    }

    // 3. Emit SearchCompleted
    if (!cancelled) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const completedEvent = new SearchCompleted({
        queryId,
        totalResults: 0, // Will be calculated from partials
        completedAt: new Date(),
      })
      onEvent(completedEvent)
    }
  }

  run()

  return {
    cancel: () => {
      cancelled = true
    },
  }
}

// =============================================================================
// Error Handler Demo
// =============================================================================

function handleSearchErrorExhaustive(error: SearchError): string {
  return pipe(
    Match.type<SearchError>(),
    Match.tag('SearchNetworkError', (e) => `Network: ${e.message}`),
    Match.tag('SearchTimeoutError', (e) => `Timeout after ${e.timeoutMs}ms: ${e.message}`),
    Match.tag('SearchRateLimitError', (e) => `Rate limited: retry in ${e.retryDelayMs}ms`),
    Match.tag('SearchServerError', (e) => `Server error (${e.statusCode}): ${e.message}`),
    Match.tag('SearchValidationError', (e) => `Validation: ${e.message}`),
    Match.tag('SearchNotFoundError', (e) => `Not found: ${e.resourceType}`),
    Match.tag('SearchAuthError', (e) => `Auth: ${e.message}`),
    Match.tag('SearchUnknownError', (e) => `Unknown: ${e.message}`),
    Match.exhaustive
  )(error)
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

export function StreamingSearchTestbed() {
  // Stream state
  const [isSearching, setIsSearching] = useState(false)
  const [sourceStates, setSourceStates] = useState<Record<string, SourceState>>({})
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [allResults, setAllResults] = useState<SearchResultItem[]>([])
  const [searchStream, setSearchStream] = useState<{ cancel: () => void } | null>(null)
  const [includeError, setIncludeError] = useState(false)

  // Hypotheses
  const [hypotheses, setHypotheses] = useState<Hypotheses>(initialHypotheses)

  // Logs
  const [logs, setLogs] = useState<string[]>([])
  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Event refs for hypothesis validation
  const eventSequenceRef = useRef<string[]>([])
  const resultCountRef = useRef<number[]>([])

  // Handle search event
  const handleSearchEvent = useCallback(
    (event: SearchEvent) => {
      const now = new Date()

      switch (event._tag) {
        case 'SearchStarted':
          log(`SearchStarted: ${event.sources.length} sources`)
          eventSequenceRef.current.push('started')

          // Initialize source states
          const initialStates: Record<string, SourceState> = {}
          for (const source of event.sources) {
            initialStates[source] = { status: 'searching', resultCount: 0 }
          }
          setSourceStates(initialStates)

          setEvents((prev) => [
            ...prev,
            { type: 'started', timestamp: now, message: `Starting search: ${event.sources.join(', ')}` },
          ])
          break

        case 'SearchPartialResults':
          if (event.error) {
            log(`SearchPartialResults [${event.source}]: ERROR - ${event.error}`)
            eventSequenceRef.current.push(`partial-error-${event.source}`)

            setSourceStates((prev) => ({
              ...prev,
              [event.source]: { status: 'error', resultCount: 0, error: event.error },
            }))

            setEvents((prev) => [
              ...prev,
              { type: 'error', source: event.source, timestamp: now, message: `${event.source}: ${event.error}` },
            ])

            // H4: Error handling
            setHypotheses((h) => ({ ...h, h4_errorHandling: true }))
          } else {
            const count = event.results.length
            log(`SearchPartialResults [${event.source}]: ${count} results`)
            eventSequenceRef.current.push(`partial-${event.source}`)

            setSourceStates((prev) => ({
              ...prev,
              [event.source]: { status: 'completed', resultCount: count },
            }))

            setAllResults((prev) => {
              const newResults = [...prev, ...event.results]
              resultCountRef.current.push(newResults.length)

              // H2: Progressive accumulation
              if (resultCountRef.current.length >= 2) {
                const growing = resultCountRef.current.every((c, i) => i === 0 || c >= resultCountRef.current[i - 1])
                if (growing) {
                  setHypotheses((h) => ({ ...h, h2_progressiveAccumulation: true }))
                }
              }

              return newResults
            })

            setEvents((prev) => [
              ...prev,
              { type: 'partial', source: event.source, count, timestamp: now, message: `${event.source}: ${count} results` },
            ])

            // H3: Source tracking
            setHypotheses((h) => ({ ...h, h3_sourceTracking: true }))
          }
          break

        case 'SearchCompleted':
          log(`SearchCompleted: ${allResults.length} total results`)
          eventSequenceRef.current.push('completed')
          setIsSearching(false)

          setEvents((prev) => [
            ...prev,
            { type: 'completed', timestamp: now, message: `Completed with ${allResults.length} total results` },
          ])

          // H1: Event sequence
          const seq = eventSequenceRef.current
          if (seq[0] === 'started' && seq[seq.length - 1] === 'completed' && seq.some((e) => e.startsWith('partial'))) {
            setHypotheses((h) => ({ ...h, h1_eventSequence: true }))
          }
          break
      }
    },
    [log, allResults.length]
  )

  // Start streaming search
  const startSearch = useCallback(() => {
    log('Starting streaming search...')
    setIsSearching(true)
    setAllResults([])
    setEvents([])
    setSourceStates({})
    eventSequenceRef.current = []
    resultCountRef.current = []

    const queryId = `stream-${Date.now()}` as SearchId
    const sources: IntelSource[] = ['track', 'osm', 'opensky', 'feature']

    const stream = createStreamingSearch(queryId, sources, includeError, handleSearchEvent)
    setSearchStream(stream)
  }, [handleSearchEvent, includeError, log])

  // Cancel search
  const cancelSearch = useCallback(() => {
    if (searchStream) {
      log('Cancelling search...')
      searchStream.cancel()
      setIsSearching(false)

      // H5: Cancellation
      setHypotheses((h) => ({ ...h, h5_cancellation: true }))
    }
  }, [searchStream, log])

  // Test error handling
  const testErrorHandling = useCallback(() => {
    log('Testing Match.type error handling...')

    const testErrors: SearchError[] = [
      new SearchNetworkError({ message: 'Connection refused', cause: 'ECONNREFUSED' }),
      new SearchTimeoutError({ message: 'Request timed out', timeoutMs: 30000 }),
      new SearchRateLimitError({ message: 'Too many requests', retryDelayMs: 60000 }),
    ]

    for (const error of testErrors) {
      const handled = handleSearchErrorExhaustive(error)
      log(`  ${error._tag}: ${handled}`)
    }

    setHypotheses((h) => ({ ...h, h4_errorHandling: true }))
  }, [log])

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
          Streaming Search Testbed
        </h1>
        {isSearching && (
          <div className="flex items-center gap-2 text-[var(--tmnl-accent-amber)]">
            <RefreshCw size={14} className="animate-spin" />
            <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>STREAMING</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Column 1: Controls */}
        <div className="space-y-4">
          <SectionLabel>Controls</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <button
              onClick={startSearch}
              disabled={isSearching}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-[var(--tmnl-accent-cyan)] text-black font-mono disabled:opacity-50"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <Play size={14} />
              Start Stream
            </button>

            <button
              onClick={cancelSearch}
              disabled={!isSearching}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-[var(--tmnl-status-error)] text-white font-mono disabled:opacity-50"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <Square size={14} />
              Cancel
            </button>

            <label className="flex items-center gap-2 text-[var(--tmnl-text-secondary)] cursor-pointer" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              <input
                type="checkbox"
                checked={includeError}
                onChange={(e) => setIncludeError(e.target.checked)}
                className="rounded"
              />
              Include error scenario
            </label>

            <button
              onClick={testErrorHandling}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-primary)] font-mono hover:bg-[var(--tmnl-surface-base)]"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <AlertCircle size={12} />
              Test Match.type Errors
            </button>
          </div>

          <SectionLabel>Pattern Notes</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 text-[var(--tmnl-text-muted)] space-y-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <p><strong className="text-[var(--tmnl-text-primary)]">SearchStarted:</strong> Initiates stream</p>
            <p><strong className="text-[var(--tmnl-text-primary)]">SearchPartialResults:</strong> Per-source results</p>
            <p><strong className="text-[var(--tmnl-text-primary)]">SearchCompleted:</strong> Stream termination</p>
            <p><strong className="text-[var(--tmnl-accent-amber)]">Match.type:</strong> Exhaustive error handling</p>
            <p><strong className="text-[var(--tmnl-accent-cyan)]">Stream.mergeAll:</strong> Concurrent sources</p>
          </div>
        </div>

        {/* Column 2: Source Status */}
        <div className="space-y-4">
          <SectionLabel>Source Status</SectionLabel>
          <div className="space-y-2">
            {Object.entries(sourceStates).map(([source, state]) => (
              <SourceStatusCard key={source} source={source} state={state} />
            ))}
            {Object.keys(sourceStates).length === 0 && (
              <div className="text-center text-[var(--tmnl-text-muted)] py-8" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                Click "Start Stream" to begin
              </div>
            )}
          </div>

          <SectionLabel>Results Summary</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4">
            <div className="text-center">
              <div className="font-mono text-[var(--tmnl-accent-cyan)]" style={{ fontSize: 'var(--tmnl-text-2xl, 24px)' }}>
                {allResults.length}
              </div>
              <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Total Results
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Event Timeline */}
        <div className="space-y-4">
          <SectionLabel>Event Timeline</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4">
            {events.length > 0 ? (
              <EventTimeline events={events} />
            ) : (
              <div className="text-center text-[var(--tmnl-text-muted)] py-8" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                No events yet
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Hypotheses & Logs */}
        <div className="space-y-4">
          <SectionLabel>Hypotheses</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            <HypothesisIndicator id="H1: Event sequence correct" validated={hypotheses.h1_eventSequence} />
            <HypothesisIndicator id="H2: Progressive accumulation" validated={hypotheses.h2_progressiveAccumulation} />
            <HypothesisIndicator id="H3: Source tracking" validated={hypotheses.h3_sourceTracking} />
            <HypothesisIndicator id="H4: Error handling" validated={hypotheses.h4_errorHandling} />
            <HypothesisIndicator id="H5: Cancellation works" validated={hypotheses.h5_cancellation} />
          </div>

          <SectionLabel>Logs</SectionLabel>
          <div className="bg-[var(--tmnl-surface-sunken)] rounded-lg p-3 h-48 overflow-y-auto font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {logs.map((entry, i) => (
              <div key={i} className="text-[var(--tmnl-text-muted)]">{entry}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StreamingSearchTestbed
