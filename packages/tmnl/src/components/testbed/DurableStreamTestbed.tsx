/**
 * DurableStream Testbed - Atom-based Reactive Search Demo
 *
 * Demonstrates:
 * - runtimeAtom.fn for Effect operations
 * - ctx.get/set for atom mutations inside Effect
 * - Reactive UI updates as stream events arrive
 * - Mock mode for testing without DurableStreams server
 *
 * @module testbed/DurableStreamTestbed
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Effect, Layer, Runtime } from 'effect'
import {
  geointRegistry,
  resultsAtom,
  searchStatusAtom,
  streamingStateAtom,
  searchErrorAtom,
  completedSourcesAtom,
  resultsBySourceAtom,
  totalResultCountAtom,
  type SearchStatus,
} from '../../lib/geoint/atoms'
import {
  runtimeAtom,
  mockStreamingSearch,
  streamingSearch,
  cancelSearch,
  streamOffsetAtom,
} from '../../lib/geoint/atoms/operations'
import { DurableStreamClientLive, DurableStreamClientConfigTag } from '../../lib/durable-streams/service'
import type { SearchQuery, IntelSource, SearchResultItem } from '../../lib/geoint/schemas'
import { SearchId, GeoFilterBounds } from '../../lib/geoint/schemas'
import { HashMap } from 'effect'

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'var(--tmnl-font-mono, monospace)',
    fontSize: '14px',
    color: 'var(--tmnl-text-primary, #e0e0e0)',
    backgroundColor: 'var(--tmnl-surface-0, #1a1a1a)',
    minHeight: '100vh',
  },
  header: {
    marginBottom: '24px',
    borderBottom: '1px solid var(--tmnl-border, #333)',
    paddingBottom: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--tmnl-text-secondary, #888)',
  },
  section: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: 'var(--tmnl-surface-1, #222)',
    borderRadius: '8px',
    border: '1px solid var(--tmnl-border, #333)',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '12px',
    color: 'var(--tmnl-text-primary, #e0e0e0)',
  },
  button: {
    padding: '8px 16px',
    marginRight: '8px',
    marginBottom: '8px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  primaryButton: {
    backgroundColor: 'var(--tmnl-accent-blue, #3b82f6)',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'var(--tmnl-surface-2, #333)',
    color: 'var(--tmnl-text-primary, #e0e0e0)',
    border: '1px solid var(--tmnl-border, #444)',
  },
  dangerButton: {
    backgroundColor: 'var(--tmnl-accent-red, #ef4444)',
    color: 'white',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  card: {
    padding: '12px',
    backgroundColor: 'var(--tmnl-surface-2, #2a2a2a)',
    borderRadius: '6px',
    border: '1px solid var(--tmnl-border, #333)',
  },
  resultItem: {
    padding: '8px 12px',
    marginBottom: '4px',
    backgroundColor: 'var(--tmnl-surface-2, #2a2a2a)',
    borderRadius: '4px',
    fontSize: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceTag: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
  },
  progressBar: {
    height: '4px',
    backgroundColor: 'var(--tmnl-surface-2, #333)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--tmnl-accent-green, #22c55e)',
    transition: 'width 0.3s ease',
  },
  log: {
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '12px',
    backgroundColor: 'var(--tmnl-surface-0, #1a1a1a)',
    borderRadius: '4px',
    maxHeight: '200px',
    overflowY: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
  },
} as const

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

const StatusBadge: React.FC<{ status: SearchStatus }> = ({ status }) => {
  const colors: Record<SearchStatus, { bg: string; text: string }> = {
    idle: { bg: '#333', text: '#888' },
    validating: { bg: '#854d0e', text: '#fbbf24' },
    searching: { bg: '#1e40af', text: '#60a5fa' },
    completed: { bg: '#166534', text: '#4ade80' },
    error: { bg: '#991b1b', text: '#f87171' },
  }

  const color = colors[status]

  return (
    <span
      style={{
        ...styles.statusBadge,
        backgroundColor: color.bg,
        color: color.text,
      }}
    >
      {status.toUpperCase()}
    </span>
  )
}

// =============================================================================
// SOURCE TAG COMPONENT
// =============================================================================

const SourceTag: React.FC<{ source: string }> = ({ source }) => {
  const colors: Record<string, string> = {
    track: '#8b5cf6',
    osm: '#22c55e',
    opensky: '#3b82f6',
    feature: '#f59e0b',
    weather: '#06b6d4',
    planet: '#ec4899',
    sentinel: '#a855f7',
  }

  return (
    <span
      style={{
        ...styles.sourceTag,
        backgroundColor: colors[source] ?? '#666',
        color: 'white',
      }}
    >
      {source}
    </span>
  )
}

// =============================================================================
// STREAMING STATE DISPLAY
// =============================================================================

const StreamingStateDisplay: React.FC = () => {
  const streaming = useAtomValue(streamingStateAtom)
  const completedSources = useAtomValue(completedSourcesAtom)

  if (!streaming.isStreaming && streaming.lastUpdate === null) {
    return <div style={{ color: '#666' }}>No search in progress</div>
  }

  const totalSources = streaming.pendingCount + completedSources.length
  const progress = totalSources > 0 ? (completedSources.length / totalSources) * 100 : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span>
          {streaming.isStreaming ? '🔄 Streaming...' : '✅ Complete'}
        </span>
        <span>
          {completedSources.length} / {totalSources} sources
        </span>
      </div>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${progress}%` }} />
      </div>
      {completedSources.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {completedSources.map((source) => (
            <SourceTag key={source} source={source} />
          ))}
        </div>
      )}
      {streaming.lastUpdate && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
          Last update: {new Date(streaming.lastUpdate).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// RESULTS BY SOURCE DISPLAY
// =============================================================================

const ResultsBySourceDisplay: React.FC = () => {
  const resultsBySource = useAtomValue(resultsBySourceAtom)
  const totalCount = useAtomValue(totalResultCountAtom)

  const sources: IntelSource[] = ['track', 'osm', 'opensky', 'feature', 'weather', 'planet', 'sentinel']

  return (
    <div>
      <div style={{ marginBottom: '12px', fontWeight: 600 }}>
        Total: {totalCount} results
      </div>
      <div style={styles.grid}>
        {sources.map((source) => {
          const results = HashMap.get(resultsBySource, source)
          const count = results._tag === 'Some' ? results.value.length : 0

          return (
            <div key={source} style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SourceTag source={source} />
                <span style={{ fontSize: '18px', fontWeight: 600 }}>{count}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// RESULTS LIST DISPLAY
// =============================================================================

const ResultsListDisplay: React.FC<{ limit?: number }> = ({ limit = 20 }) => {
  const results = useAtomValue(resultsAtom)

  const displayResults = results.slice(0, limit)

  if (results.length === 0) {
    return <div style={{ color: '#666' }}>No results yet</div>
  }

  const getResultLabel = (result: SearchResultItem): string => {
    switch (result._tag) {
      case 'SearchResultTrack':
        return result.label ?? result.trackId
      case 'SearchResultPoi':
        return result.name
      case 'SearchResultFlight':
        return result.callsign || result.icao24
      case 'SearchResultFeature':
        return result.label ?? result.featureId
      case 'SearchResultWeather':
        return result.locationName ?? 'Weather'
      case 'SearchResultImagery':
        return `${result.provider}: ${result.itemId}`
      default:
        return 'Unknown'
    }
  }

  return (
    <div>
      {displayResults.map((result, i) => (
        <div key={`${result.id}-${i}`} style={styles.resultItem}>
          <span>{getResultLabel(result)}</span>
          <SourceTag source={result.source} />
        </div>
      ))}
      {results.length > limit && (
        <div style={{ textAlign: 'center', padding: '8px', color: '#666' }}>
          ... and {results.length - limit} more
        </div>
      )}
    </div>
  )
}

// =============================================================================
// MAIN TESTBED COMPONENT
// =============================================================================

export const DurableStreamTestbed: React.FC = () => {
  const [useMock, setUseMock] = useState(true)
  const [logs, setLogs] = useState<string[]>([])

  const status = useAtomValue(searchStatusAtom)
  const error = useAtomValue(searchErrorAtom)
  const offsets = useAtomValue(streamOffsetAtom)

  // Log capture
  useEffect(() => {
    const originalLog = console.log
    const originalError = console.error

    console.log = (...args) => {
      originalLog(...args)
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
      if (msg.includes('[')) {
        setLogs((prev) => [...prev.slice(-50), `${new Date().toLocaleTimeString()} ${msg}`])
      }
    }

    console.error = (...args) => {
      originalError(...args)
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
      setLogs((prev) => [...prev.slice(-50), `${new Date().toLocaleTimeString()} ❌ ${msg}`])
    }

    return () => {
      console.log = originalLog
      console.error = originalError
    }
  }, [])

  // Build a sample query
  const buildQuery = useCallback((): SearchQuery => {
    return {
      id: `search-${Date.now()}` as any,
      sources: ['track', 'osm', 'opensky', 'feature'] as IntelSource[],
      geoFilter: new GeoFilterBounds({
        bounds: [-122.5, 37.7, -122.3, 37.9],
      }),
      limitPerSource: 10,
    } as SearchQuery
  }, [])

  // Start search
  const handleStartSearch = useCallback(() => {
    const query = buildQuery()
    const queryId = query.id as string

    if (useMock) {
      // Run mock search (no DurableStreams needed)
      geointRegistry.get(mockStreamingSearch({ query }))
    } else {
      // Run real streaming search
      geointRegistry.get(streamingSearch({ query, queryId }))
    }
  }, [useMock, buildQuery])

  // Cancel search
  const handleCancel = useCallback(() => {
    geointRegistry.get(cancelSearch())
  }, [])

  // Clear logs
  const handleClearLogs = useCallback(() => {
    setLogs([])
  }, [])

  return (
    <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>DurableStream + Atom Reactive Demo</h1>
          <p style={styles.subtitle}>
            Demonstrates streaming search with atom-based reactive state updates
          </p>
        </header>

        {/* Controls Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Controls</h2>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useMock}
                onChange={(e) => setUseMock(e.target.checked)}
              />
              <span>Use Mock Mode (no DurableStreams server required)</span>
            </label>
          </div>
          <div>
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={handleStartSearch}
              disabled={status === 'searching'}
            >
              {status === 'searching' ? 'Searching...' : 'Start Streaming Search'}
            </button>
            <button
              style={{ ...styles.button, ...styles.dangerButton }}
              onClick={handleCancel}
              disabled={status !== 'searching'}
            >
              Cancel
            </button>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={handleClearLogs}
            >
              Clear Logs
            </button>
          </div>
        </section>

        {/* Status Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Status</h2>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            <div>
              <div style={{ marginBottom: '8px', color: '#888' }}>Search Status</div>
              <StatusBadge status={status} />
            </div>
            {error && (
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '8px', color: '#888' }}>Error</div>
                <div style={{ color: '#f87171' }}>{error}</div>
              </div>
            )}
          </div>
        </section>

        {/* Streaming State Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Streaming State (Live Updates)</h2>
          <StreamingStateDisplay />
        </section>

        {/* Results by Source Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Results by Source</h2>
          <ResultsBySourceDisplay />
        </section>

        {/* Results List Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Results (First 20)</h2>
          <ResultsListDisplay limit={20} />
        </section>

        {/* Stream Offsets Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Stream Offsets (for Reconnection)</h2>
          <pre style={{ fontSize: '11px', color: '#888' }}>
            {JSON.stringify(offsets, null, 2) || '{}'}
          </pre>
        </section>

        {/* Logs Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Event Log</h2>
          <div style={styles.log}>
            {logs.length === 0 ? (
              <span style={{ color: '#666' }}>No events yet. Start a search to see logs.</span>
            ) : (
              logs.map((log, i) => <div key={i}>{log}</div>)
            )}
          </div>
        </section>
    </div>
  )
}

export default DurableStreamTestbed
