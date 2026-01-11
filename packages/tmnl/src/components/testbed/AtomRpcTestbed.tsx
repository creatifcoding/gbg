/**
 * AtomRpc Testbed - AtomRpc.Tag Pattern Demonstration
 *
 * Demonstrates the AtomRpc pattern used throughout GEOINT:
 * - SearchClient.query() for cached queries with TTL
 * - Reactivity keys for automatic cache invalidation
 * - SearchClient.mutation() for operations that invalidate caches
 * - Mock mode for testing without backend services
 *
 * Key patterns shown:
 * 1. Query atoms with TTL caching
 * 2. Viewport-based query invalidation
 * 3. Mutation → cache invalidation flow
 * 4. Progressive streaming results
 *
 * Route: /testbed/atom-rpc
 *
 * @module testbed/AtomRpcTestbed
 */

import { useEffect, useMemo, useCallback, useState } from 'react'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import { Atom, Registry } from '@effect-atom/atom'
// Note: Effect imports available for future integration with real AtomRpc backend
import {
  Search,
  MapPin,
  RefreshCw,
  Clock,
  Database,
  Trash2,
  Save,
  ChevronRight,
  Activity,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react'
import type { IntelSource, SearchResultItem } from '@/lib/geoint/schemas'
import { SearchResultId, Icao24 } from '@/lib/geoint/schemas'

// =============================================================================
// TESTBED REGISTRY (Isolated from geoint registry)
// =============================================================================

const testbedRegistry = Registry.make()

// =============================================================================
// MOCK ATOMRPC PATTERN ATOMS
// =============================================================================

/** Connection status to backend (mock) */
const connectionStatusAtom = Atom.make<'connected' | 'disconnected' | 'connecting'>('disconnected')

/** Current viewport bounds [minLon, minLat, maxLon, maxLat] */
const viewportBoundsAtom = Atom.make<readonly [number, number, number, number]>([-122.5, 37.7, -122.3, 37.9])

/** Query cache entries with TTL tracking */
interface CacheEntry {
  readonly key: string
  readonly data: readonly SearchResultItem[]
  readonly fetchedAt: Date
  readonly ttlMs: number
  readonly reactivityKeys: readonly string[]
}

const queryCacheAtom = Atom.make<readonly CacheEntry[]>([])

/** Active queries being fetched */
const activeQueriesAtom = Atom.make<readonly string[]>([])

/** Saved searches (demonstrates mutation pattern) */
interface SavedSearch {
  readonly id: string
  readonly name: string
  readonly bounds: readonly [number, number, number, number]
  readonly createdAt: Date
}

const savedSearchesAtom = Atom.make<readonly SavedSearch[]>([])

/** Search history */
interface SearchHistoryEntry {
  readonly id: string
  readonly bounds: readonly [number, number, number, number]
  readonly resultCount: number
  readonly executedAt: Date
}

const searchHistoryAtom = Atom.make<readonly SearchHistoryEntry[]>([])

/** Current viewport search results */
const viewportResultsAtom = Atom.make<readonly SearchResultItem[]>([])

/** Search status */
type SearchStatus = 'idle' | 'loading' | 'success' | 'error'
const searchStatusAtom = Atom.make<SearchStatus>('idle')

/** Cache hit/miss stats */
const cacheStatsAtom = Atom.make<{
  readonly hits: number
  readonly misses: number
  readonly invalidations: number
}>({ hits: 0, misses: 0, invalidations: 0 })

// =============================================================================
// MOCK SEARCH CLIENT OPERATIONS
// =============================================================================

/** Generate mock search results for a viewport */
function generateMockResults(
  bounds: readonly [number, number, number, number],
  count: number
): SearchResultItem[] {
  const [minLon, minLat, maxLon, maxLat] = bounds
  const results: SearchResultItem[] = []
  const sources: IntelSource[] = ['track', 'osm', 'opensky', 'feature']

  for (let i = 0; i < count; i++) {
    const lon = minLon + Math.random() * (maxLon - minLon)
    const lat = minLat + Math.random() * (maxLat - minLat)
    const source = sources[Math.floor(Math.random() * sources.length)] as IntelSource

    if (source === 'opensky') {
      results.push({
        _tag: 'SearchResultFlight',
        id: SearchResultId.make(`flight-${Date.now()}-${i}`),
        source: 'opensky',
        score: Math.random(),
        retrievedAt: new Date(),
        icao24: Icao24.make(`ABC${i.toString().padStart(3, '0')}`),
        callsign: `UAL${Math.floor(Math.random() * 9999)}`,
        position: [lon, lat, 10000 + Math.random() * 30000] as [number, number, number],
        velocity: 200 + Math.random() * 300,
        heading: Math.random() * 360,
        verticalRate: (Math.random() - 0.5) * 20,
        onGround: false,
        category: 'medium' as const,
        originCountry: 'United States',
        lastContact: new Date(),
      } as unknown as SearchResultItem)
    } else if (source === 'osm') {
      results.push({
        _tag: 'SearchResultPoi',
        id: SearchResultId.make(`poi-${Date.now()}-${i}`),
        source: 'osm',
        score: Math.random(),
        retrievedAt: new Date(),
        osmId: `node/${Math.floor(Math.random() * 1000000000)}`,
        poiId: `poi-${Date.now()}-${i}`,
        name: ['Hospital', 'Airport', 'Fire Station', 'Police'][Math.floor(Math.random() * 4)] ?? 'Unknown',
        poiType: ['hospital', 'airport', 'fire_station', 'police'][Math.floor(Math.random() * 4)] ?? 'unknown',
        category: 'amenity',
        position: [lon, lat] as [number, number],
        tags: {},
      } as unknown as SearchResultItem)
    } else {
      results.push({
        _tag: 'SearchResultTrack',
        id: SearchResultId.make(`track-${Date.now()}-${i}`),
        source: 'track',
        score: Math.random(),
        retrievedAt: new Date(),
        trackId: `TRK-${Math.floor(Math.random() * 10000)}`,
        label: `Track ${i + 1}`,
        objectType: 'aircraft',
        classification: ['friendly', 'neutral', 'hostile'][Math.floor(Math.random() * 3)] ?? 'neutral',
        position: [lon, lat, Math.random() * 15000] as [number, number, number],
        heading: Math.random() * 360,
        speed: Math.random() * 500,
        lastUpdate: new Date(),
      } as unknown as SearchResultItem)
    }
  }

  return results
}

/** Create cache key from bounds and options */
function createCacheKey(bounds: readonly [number, number, number, number]): string {
  return `viewport:${bounds.join(',')}`
}

/** Check if cache entry is still valid */
function isCacheValid(entry: CacheEntry): boolean {
  const age = Date.now() - entry.fetchedAt.getTime()
  return age < entry.ttlMs
}

/** Simulate AtomRpc.query with caching */
function executeViewportQuery(
  bounds: readonly [number, number, number, number],
  ttlMs: number = 30000
): void {
  const cacheKey = createCacheKey(bounds)
  const cache = testbedRegistry.get(queryCacheAtom)
  const existingEntry = cache.find((e) => e.key === cacheKey)

  // Check cache
  if (existingEntry && isCacheValid(existingEntry)) {
    console.log(`[AtomRpc] Cache HIT for ${cacheKey}`)
    testbedRegistry.set(viewportResultsAtom, existingEntry.data)
    testbedRegistry.set(searchStatusAtom, 'success')
    const stats = testbedRegistry.get(cacheStatsAtom)
    testbedRegistry.set(cacheStatsAtom, { ...stats, hits: stats.hits + 1 })
    return
  }

  // Cache miss - fetch data
  console.log(`[AtomRpc] Cache MISS for ${cacheKey}`)
  const stats = testbedRegistry.get(cacheStatsAtom)
  testbedRegistry.set(cacheStatsAtom, { ...stats, misses: stats.misses + 1 })

  testbedRegistry.set(searchStatusAtom, 'loading')
  const activeQueries = testbedRegistry.get(activeQueriesAtom)
  testbedRegistry.set(activeQueriesAtom, [...activeQueries, cacheKey])

  // Simulate network delay
  setTimeout(() => {
    const results = generateMockResults(bounds, 15 + Math.floor(Math.random() * 20))

    // Update cache
    const newEntry: CacheEntry = {
      key: cacheKey,
      data: results,
      fetchedAt: new Date(),
      ttlMs,
      reactivityKeys: ['search', 'viewport', bounds.join(',')],
    }

    const updatedCache = cache.filter((e) => e.key !== cacheKey)
    testbedRegistry.set(queryCacheAtom, [...updatedCache, newEntry])

    // Update results
    testbedRegistry.set(viewportResultsAtom, results)
    testbedRegistry.set(searchStatusAtom, 'success')

    // Remove from active queries
    const currentActive = testbedRegistry.get(activeQueriesAtom)
    testbedRegistry.set(activeQueriesAtom, currentActive.filter((q) => q !== cacheKey))

    // Add to history
    const history = testbedRegistry.get(searchHistoryAtom)
    const historyEntry: SearchHistoryEntry = {
      id: `hist-${Date.now()}`,
      bounds,
      resultCount: results.length,
      executedAt: new Date(),
    }
    testbedRegistry.set(searchHistoryAtom, [historyEntry, ...history.slice(0, 9)])

    console.log(`[AtomRpc] Query complete: ${results.length} results`)
  }, 500 + Math.random() * 1000)
}

/** Invalidate cache entries by reactivity key */
function invalidateCacheByKey(key: string): void {
  const cache = testbedRegistry.get(queryCacheAtom)
  const invalidated = cache.filter((e) => e.reactivityKeys.includes(key))

  if (invalidated.length > 0) {
    console.log(`[AtomRpc] Invalidating ${invalidated.length} cache entries for key: ${key}`)
    testbedRegistry.set(
      queryCacheAtom,
      cache.filter((e) => !e.reactivityKeys.includes(key))
    )
    const stats = testbedRegistry.get(cacheStatsAtom)
    testbedRegistry.set(cacheStatsAtom, {
      ...stats,
      invalidations: stats.invalidations + invalidated.length,
    })
  }
}

/** Simulate mutation that invalidates cache */
function saveSearchMutation(name: string, bounds: readonly [number, number, number, number]): void {
  console.log(`[AtomRpc] Mutation: saveSearch`)

  const saved = testbedRegistry.get(savedSearchesAtom)
  const newSearch: SavedSearch = {
    id: `saved-${Date.now()}`,
    name,
    bounds,
    createdAt: new Date(),
  }

  testbedRegistry.set(savedSearchesAtom, [...saved, newSearch])

  // Invalidate related cache (simulates AtomRpc reactivity)
  invalidateCacheByKey('savedSearches')
}

/** Delete saved search mutation */
function deleteSavedSearchMutation(id: string): void {
  console.log(`[AtomRpc] Mutation: deleteSavedSearch`)

  const saved = testbedRegistry.get(savedSearchesAtom)
  testbedRegistry.set(savedSearchesAtom, saved.filter((s) => s.id !== id))

  // Invalidate related cache
  invalidateCacheByKey('savedSearches')
}

/** Clear search history mutation */
function clearHistoryMutation(): void {
  console.log(`[AtomRpc] Mutation: clearSearchHistory`)
  testbedRegistry.set(searchHistoryAtom, [])
  invalidateCacheByKey('searchHistory')
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--tmnl-surface-0, #0a0a0a)',
    color: 'var(--tmnl-text-primary, #e0e0e0)',
    fontFamily: 'var(--tmnl-font-mono, monospace)',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--tmnl-border, #333)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  badge: {
    padding: '2px 8px',
    backgroundColor: 'var(--tmnl-accent-cyan, #06b6d4)',
    color: 'black',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    padding: '24px',
  },
  section: {
    backgroundColor: 'var(--tmnl-surface-1, #111)',
    border: '1px solid var(--tmnl-border, #333)',
    borderRadius: '8px',
    padding: '16px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  button: {
    padding: '8px 14px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease',
  },
  primaryButton: {
    backgroundColor: 'var(--tmnl-accent-cyan, #06b6d4)',
    color: 'black',
  },
  secondaryButton: {
    backgroundColor: 'var(--tmnl-surface-2, #222)',
    color: 'var(--tmnl-text-primary, #e0e0e0)',
    border: '1px solid var(--tmnl-border, #444)',
  },
  dangerButton: {
    backgroundColor: 'var(--tmnl-accent-red, #ef4444)',
    color: 'white',
  },
  stat: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid var(--tmnl-border, #222)',
    fontSize: '13px',
  },
  statLabel: {
    color: 'var(--tmnl-text-secondary, #888)',
  },
  statValue: {
    fontWeight: 600,
    fontFamily: 'var(--tmnl-font-mono, monospace)',
  },
  cacheEntry: {
    padding: '10px',
    backgroundColor: 'var(--tmnl-surface-2, #1a1a1a)',
    borderRadius: '6px',
    marginBottom: '8px',
    fontSize: '12px',
  },
  list: {
    maxHeight: '300px',
    overflowY: 'auto' as const,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'var(--tmnl-surface-2, #1a1a1a)',
    border: '1px solid var(--tmnl-border, #333)',
    borderRadius: '4px',
    color: 'var(--tmnl-text-primary, #e0e0e0)',
    fontSize: '13px',
    marginBottom: '8px',
  },
} as const

// =============================================================================
// COMPONENTS
// =============================================================================

/** Connection status indicator */
function ConnectionStatus() {
  const status = useAtomValue(connectionStatusAtom)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {status === 'connected' ? (
        <>
          <Wifi style={{ width: 16, height: 16, color: '#22c55e' }} />
          <span style={{ color: '#22c55e', fontSize: '12px' }}>Connected</span>
        </>
      ) : status === 'connecting' ? (
        <>
          <RefreshCw
            style={{ width: 16, height: 16, color: '#f59e0b', animation: 'spin 1s linear infinite' }}
          />
          <span style={{ color: '#f59e0b', fontSize: '12px' }}>Connecting...</span>
        </>
      ) : (
        <>
          <WifiOff style={{ width: 16, height: 16, color: '#666' }} />
          <span style={{ color: '#666', fontSize: '12px' }}>Disconnected (Mock Mode)</span>
        </>
      )}
    </div>
  )
}

/** Cache statistics panel */
function CacheStatsPanel() {
  const stats = useAtomValue(cacheStatsAtom)
  const cache = useAtomValue(queryCacheAtom)
  const activeQueries = useAtomValue(activeQueriesAtom)

  const hitRate = stats.hits + stats.misses > 0
    ? Math.round((stats.hits / (stats.hits + stats.misses)) * 100)
    : 0

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>
        <Zap style={{ width: 16, height: 16, color: '#f59e0b' }} />
        Cache Statistics
      </h3>

      <div style={styles.stat}>
        <span style={styles.statLabel}>Cache Entries</span>
        <span style={{ ...styles.statValue, color: '#06b6d4' }}>{cache.length}</span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>Active Queries</span>
        <span style={{ ...styles.statValue, color: activeQueries.length > 0 ? '#f59e0b' : '#666' }}>
          {activeQueries.length}
        </span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>Cache Hits</span>
        <span style={{ ...styles.statValue, color: '#22c55e' }}>{stats.hits}</span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>Cache Misses</span>
        <span style={{ ...styles.statValue, color: '#ef4444' }}>{stats.misses}</span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>Hit Rate</span>
        <span style={{ ...styles.statValue, color: hitRate > 50 ? '#22c55e' : '#f59e0b' }}>
          {hitRate}%
        </span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>Invalidations</span>
        <span style={{ ...styles.statValue, color: '#a855f7' }}>{stats.invalidations}</span>
      </div>
    </div>
  )
}

/** Cache entries viewer */
function CacheEntriesPanel() {
  const cache = useAtomValue(queryCacheAtom)

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>
        <Database style={{ width: 16, height: 16, color: '#06b6d4' }} />
        Cache Entries ({cache.length})
      </h3>

      <div style={styles.list}>
        {cache.length === 0 ? (
          <div style={{ color: '#666', fontSize: '12px', padding: '8px' }}>No cache entries</div>
        ) : (
          cache.map((entry) => {
            const age = Math.round((Date.now() - entry.fetchedAt.getTime()) / 1000)
            const ttlRemaining = Math.max(0, Math.round((entry.ttlMs - age * 1000) / 1000))
            const isExpiring = ttlRemaining < 10

            return (
              <div key={entry.key} style={styles.cacheEntry}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#06b6d4' }}>{entry.key}</span>
                  <span style={{ color: isExpiring ? '#ef4444' : '#22c55e' }}>
                    TTL: {ttlRemaining}s
                  </span>
                </div>
                <div style={{ color: '#888' }}>
                  {entry.data.length} results • Age: {age}s
                </div>
                <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>
                  Keys: {entry.reactivityKeys.join(', ')}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

/** Viewport query control panel */
function ViewportQueryPanel() {
  const bounds = useAtomValue(viewportBoundsAtom)
  const status = useAtomValue(searchStatusAtom)
  const results = useAtomValue(viewportResultsAtom)

  const handleSearch = useCallback(() => {
    executeViewportQuery(bounds)
  }, [bounds])

  const handlePanViewport = useCallback(() => {
    // Simulate viewport pan (shifts bounds slightly)
    const currentBounds = testbedRegistry.get(viewportBoundsAtom)
    const shift = 0.05
    const newBounds: readonly [number, number, number, number] = [
      currentBounds[0] + shift,
      currentBounds[1] + shift * 0.5,
      currentBounds[2] + shift,
      currentBounds[3] + shift * 0.5,
    ]
    testbedRegistry.set(viewportBoundsAtom, newBounds)
    console.log(`[Viewport] Panned to: ${newBounds.join(', ')}`)
  }, [])

  const handleInvalidateViewport = useCallback(() => {
    invalidateCacheByKey('viewport')
  }, [])

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>
        <MapPin style={{ width: 16, height: 16, color: '#22c55e' }} />
        Viewport Query (AtomRpc.query)
      </h3>

      <div style={{ marginBottom: '12px', fontSize: '12px', color: '#888' }}>
        Bounds: [{bounds.map((b) => b.toFixed(4)).join(', ')}]
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button
          style={{ ...styles.button, ...styles.primaryButton }}
          onClick={handleSearch}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? (
            <>
              <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
              Searching...
            </>
          ) : (
            <>
              <Search style={{ width: 14, height: 14 }} />
              Search Viewport
            </>
          )}
        </button>

        <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={handlePanViewport}>
          <ChevronRight style={{ width: 14, height: 14 }} />
          Pan Viewport
        </button>

        <button style={{ ...styles.button, ...styles.dangerButton }} onClick={handleInvalidateViewport}>
          <Trash2 style={{ width: 14, height: 14 }} />
          Invalidate
        </button>
      </div>

      <div style={styles.stat}>
        <span style={styles.statLabel}>Status</span>
        <span
          style={{
            ...styles.statValue,
            color:
              status === 'success'
                ? '#22c55e'
                : status === 'loading'
                ? '#f59e0b'
                : status === 'error'
                ? '#ef4444'
                : '#666',
          }}
        >
          {status.toUpperCase()}
        </span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>Results</span>
        <span style={{ ...styles.statValue, color: '#06b6d4' }}>{results.length}</span>
      </div>
    </div>
  )
}

/** Saved searches panel (demonstrates mutations) */
function SavedSearchesPanel() {
  const saved = useAtomValue(savedSearchesAtom)
  const bounds = useAtomValue(viewportBoundsAtom)
  const [searchName, setSearchName] = useState('')

  const handleSave = useCallback(() => {
    if (searchName.trim()) {
      saveSearchMutation(searchName.trim(), bounds)
      setSearchName('')
    }
  }, [searchName, bounds])

  const handleDelete = useCallback((id: string) => {
    deleteSavedSearchMutation(id)
  }, [])

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>
        <Save style={{ width: 16, height: 16, color: '#a855f7' }} />
        Saved Searches (AtomRpc.mutation)
      </h3>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          type="text"
          style={{ ...styles.input, flex: 1, marginBottom: 0 }}
          placeholder="Search name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button
          style={{ ...styles.button, ...styles.primaryButton }}
          onClick={handleSave}
          disabled={!searchName.trim()}
        >
          <Save style={{ width: 14, height: 14 }} />
          Save
        </button>
      </div>

      <div style={styles.list}>
        {saved.length === 0 ? (
          <div style={{ color: '#666', fontSize: '12px', padding: '8px' }}>No saved searches</div>
        ) : (
          saved.map((s) => (
            <div key={s.id} style={styles.cacheEntry}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#a855f7' }}>{s.name}</span>
                <button
                  style={{
                    ...styles.button,
                    ...styles.dangerButton,
                    padding: '4px 8px',
                    fontSize: '11px',
                  }}
                  onClick={() => handleDelete(s.id)}
                >
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </div>
              <div style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>
                {s.createdAt.toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/** Search history panel */
function SearchHistoryPanel() {
  const history = useAtomValue(searchHistoryAtom)

  const handleClear = useCallback(() => {
    clearHistoryMutation()
  }, [])

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>
        <Clock style={{ width: 16, height: 16, color: '#f59e0b' }} />
        Search History
        {history.length > 0 && (
          <button
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              padding: '4px 8px',
              fontSize: '11px',
              marginLeft: 'auto',
            }}
            onClick={handleClear}
          >
            Clear
          </button>
        )}
      </h3>

      <div style={styles.list}>
        {history.length === 0 ? (
          <div style={{ color: '#666', fontSize: '12px', padding: '8px' }}>No search history</div>
        ) : (
          history.map((h) => (
            <div key={h.id} style={styles.cacheEntry}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#f59e0b' }}>{h.resultCount} results</span>
                <span style={{ color: '#666', fontSize: '11px' }}>{h.executedAt.toLocaleTimeString()}</span>
              </div>
              <div style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>
                [{h.bounds.map((b) => b.toFixed(2)).join(', ')}]
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/** Results preview panel */
function ResultsPreviewPanel() {
  const results = useAtomValue(viewportResultsAtom)

  const resultsBySource = useMemo(() => {
    const grouped: Record<string, number> = {}
    for (const r of results) {
      grouped[r.source] = (grouped[r.source] ?? 0) + 1
    }
    return grouped
  }, [results])

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>
        <Activity style={{ width: 16, height: 16, color: '#22c55e' }} />
        Results Preview ({results.length})
      </h3>

      {Object.keys(resultsBySource).length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {Object.entries(resultsBySource).map(([source, count]) => (
            <span
              key={source}
              style={{
                padding: '4px 8px',
                backgroundColor: 'var(--tmnl-surface-2, #222)',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              <span style={{ color: '#888' }}>{source}:</span>{' '}
              <span style={{ color: '#06b6d4', fontWeight: 600 }}>{count}</span>
            </span>
          ))}
        </div>
      )}

      <div style={{ ...styles.list, maxHeight: '200px' }}>
        {results.slice(0, 10).map((r, i) => (
          <div key={`${r.id}-${i}`} style={{ ...styles.cacheEntry, padding: '6px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#e0e0e0', fontSize: '12px' }}>
                {r._tag === 'SearchResultFlight'
                  ? r.callsign || r.icao24
                  : r._tag === 'SearchResultPoi'
                  ? r.name
                  : r._tag === 'SearchResultTrack'
                  ? r.label ?? r.trackId
                  : 'Unknown'}
              </span>
              <span
                style={{
                  padding: '2px 6px',
                  backgroundColor:
                    r.source === 'opensky'
                      ? '#3b82f620'
                      : r.source === 'osm'
                      ? '#22c55e20'
                      : '#a855f720',
                  color:
                    r.source === 'opensky'
                      ? '#3b82f6'
                      : r.source === 'osm'
                      ? '#22c55e'
                      : '#a855f7',
                  borderRadius: '4px',
                  fontSize: '10px',
                }}
              >
                {r.source}
              </span>
            </div>
          </div>
        ))}
        {results.length > 10 && (
          <div style={{ color: '#666', fontSize: '11px', textAlign: 'center', padding: '8px' }}>
            ... and {results.length - 10} more
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AtomRpcTestbed() {
  // Auto-run initial search on mount
  useEffect(() => {
    const bounds = testbedRegistry.get(viewportBoundsAtom)
    executeViewportQuery(bounds)
  }, [])

  return (
    <RegistryContext.Provider value={testbedRegistry}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.title}>
            <Zap style={{ width: 20, height: 20, color: '#f59e0b' }} />
            AtomRpc.Tag Pattern Testbed
            <span style={styles.badge}>NEW</span>
          </div>
          <ConnectionStatus />
        </header>

        <div style={styles.content}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ViewportQueryPanel />
            <SavedSearchesPanel />
            <SearchHistoryPanel />
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <CacheStatsPanel />
            <CacheEntriesPanel />
            <ResultsPreviewPanel />
          </div>
        </div>

        {/* Architecture explanation */}
        <div
          style={{
            margin: '0 24px 24px',
            padding: '16px',
            backgroundColor: 'var(--tmnl-surface-1, #111)',
            border: '1px solid var(--tmnl-border, #333)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#888',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '8px', color: '#e0e0e0' }}>
            AtomRpc.Tag Pattern Architecture
          </div>
          <div style={{ lineHeight: 1.6 }}>
            <strong style={{ color: '#06b6d4' }}>SearchClient.query()</strong> - Creates cached query
            atoms with TTL and reactivity keys
            <br />
            <strong style={{ color: '#a855f7' }}>SearchClient.mutation()</strong> - Executes mutations
            that automatically invalidate related caches
            <br />
            <strong style={{ color: '#f59e0b' }}>ReactivityKeys</strong> - Enable fine-grained cache
            invalidation (e.g., viewport changes invalidate viewport queries)
            <br />
            <strong style={{ color: '#22c55e' }}>TTL Caching</strong> - Results cached for specified
            duration, reducing backend load
          </div>
        </div>
      </div>
    </RegistryContext.Provider>
  )
}

export default AtomRpcTestbed
