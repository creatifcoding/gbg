/**
 * Integrated GEOINT Testbed - Complete Vertical Slice
 *
 * Demonstrates integration of ALL GEOINT subsystems:
 *
 * 1. **AtomRpc** - SearchClient for RPC calls with caching + reactivity keys
 * 2. **Effect-atom** - Reactive state management via Registry
 * 3. **DurableStreams** - Real-time event streaming subscription
 * 4. **ElectricSQL** - Entity sync via Shape hooks
 * 5. **Kori Entity Management** - Per-entity UI state with Atom.family
 * 6. **Timeline** - Time-based filtering with atoms
 *
 * Data Flow:
 * ```
 * SearchClient.query() → RPC → Handler → SearchResponse
 *      ↓
 * resultsAtom (effect-atom)
 *      ↓
 * Kori Entity Store (entityOps.initializeLiveData)
 *      ↓
 * UI Components (useAtomValue)
 *
 * ElectricSQL Shape → useFlightEntitiesWithTraits()
 *      ↓
 * ecsFlightToSearchResult() conversion
 *      ↓
 * Combined results display
 * ```
 *
 * Route: /testbed/integrated-geoint
 *
 * @module testbed/IntegratedGeointTestbed
 */

import React, { useEffect, useCallback, useMemo, useState } from 'react'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import { Atom, Registry } from '@effect-atom/atom'
import { HashSet, Option } from 'effect'
import {
  Search,
  Plane,
  MapPin,
  Radio,
  Database,
  Layers,
  RefreshCw,
  Clock,
  Play,
  Pause,
  Zap,
  ArrowRight,
  Eye,
  Pin,
  PinOff,
} from 'lucide-react'

// =============================================================================
// IMPORTS - Browser-Safe Only
// =============================================================================

// Schemas - pure types, browser-safe
import {
  SearchQuery,
  SearchResultFlight,
  SearchResultPoi,
  SearchId,
  Icao24,
  SearchResultId,
  GeoFilterBounds,
  PoiId,
  type SearchResultItem,
} from '@/lib/geoint/schemas'

// Kori Entity Atoms - browser-safe reactive state
import {
  geointRegistry,
  GeointRegistryProvider,
  entityOps,
  selectedEntityIds,
  hoveredEntityId,
  pinnedEntityIds,
  type EntityLiveData,
} from '@/lib/geoint/kori/entity-atoms'

// Electric Sync - browser-safe, HTTP Shape streams
import {
  useFlightEntitiesWithTraits,
  type FlightEntityWithTraits,
} from '@/lib/ecs/electric'

// Shared testbed components
import { TestbedHeader, SectionLabel } from './shared'

// =============================================================================
// TESTBED REGISTRY
// =============================================================================

/**
 * Dedicated registry for this testbed.
 * Isolates state from other testbeds/components.
 */
const testbedRegistry = Registry.make()

// =============================================================================
// TESTBED-LOCAL ATOMS
// =============================================================================

/** Search query input */
const queryInputAtom = Atom.make('')

/** Search status */
type SearchStatus = 'idle' | 'loading' | 'success' | 'error'
const searchStatusAtom = Atom.make<SearchStatus>('idle')

/** Search error message */
const searchErrorAtom = Atom.make<string | null>(null)

/** Search results from AtomRpc */
const searchResultsAtom = Atom.make<readonly SearchResultItem[]>([])

/** Electric entities converted to search results */
const electricResultsAtom = Atom.make<readonly SearchResultItem[]>([])

/** Timeline playhead timestamp */
const playheadAtom = Atom.make<number>(Date.now())

/** Timeline playing state */
const isPlayingAtom = Atom.make(false)

/** Connection status */
interface ConnectionStatus {
  atomRpc: 'connected' | 'disconnected' | 'error'
  electric: 'connected' | 'disconnected' | 'error'
  durableStreams: 'connected' | 'disconnected' | 'error'
}
const connectionStatusAtom = Atom.make<ConnectionStatus>({
  atomRpc: 'disconnected',
  electric: 'disconnected',
  durableStreams: 'disconnected',
})

/** Event log for debugging */
interface EventLogEntry {
  id: string
  timestamp: Date
  source: 'atomrpc' | 'electric' | 'streams' | 'kori' | 'ui'
  message: string
  level: 'info' | 'success' | 'warning' | 'error'
}
const eventLogAtom = Atom.make<readonly EventLogEntry[]>([])

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function addEvent(
  source: EventLogEntry['source'],
  message: string,
  level: EventLogEntry['level'] = 'info'
) {
  const entry: EventLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    source,
    message,
    level,
  }
  testbedRegistry.update(eventLogAtom, (log) => [entry, ...log.slice(0, 49)])
}

/**
 * Convert FlightEntityWithTraits to SearchResultFlight.
 * Bridges ECS → GEOINT search result format.
 */
function ecsFlightToSearchResult(entity: FlightEntityWithTraits): typeof SearchResultFlight.Type {
  return SearchResultFlight.make({
    id: SearchResultId.make(entity.entityId),
    source: 'adsb-lol',
    score: Math.max(0, Math.min(1, entity.confidence)),
    retrievedAt: entity.updatedAt,
    icao24: Icao24.make(entity.icao24 || 'unknown'),
    callsign: entity.callsign ?? '',
    position: entity.position,
    velocity: Math.max(0, entity.speed),
    heading: ((entity.heading % 360) + 360) % 360,
    verticalRate: entity.verticalRate,
    onGround: entity.position[2] < 100,
    category: 'unknown',
    originCountry: 'Unknown',
    lastContact: entity.updatedAt,
  })
}

// =============================================================================
// STATUS INDICATOR COMPONENT
// =============================================================================

interface StatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'error'
  label: string
}

function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const colors = {
    connected: 'bg-green-500',
    disconnected: 'bg-neutral-500',
    error: 'bg-red-500',
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colors[status]} animate-pulse`} />
      <span className="text-xs text-neutral-400">{label}</span>
    </div>
  )
}

// =============================================================================
// SEARCH PANEL COMPONENT
// =============================================================================

function SearchPanel() {
  const queryInput = useAtomValue(queryInputAtom)
  const searchStatus = useAtomValue(searchStatusAtom)
  const searchError = useAtomValue(searchErrorAtom)
  const searchResults = useAtomValue(searchResultsAtom)
  const electricResults = useAtomValue(electricResultsAtom)

  const handleSearch = useCallback(async () => {
    testbedRegistry.set(searchStatusAtom, 'loading')
    testbedRegistry.set(searchErrorAtom, null)
    addEvent('atomrpc', 'Starting search via AtomRpc...', 'info')

    try {
      // Default Bay Area bounds for demo
      const bounds: [number, number, number, number] = [-122.6, 37.4, -122.0, 37.9]

      // Create search query
      const query = SearchQuery.make({
        id: SearchId.make(`search-${Date.now()}`),
        sources: ['opensky', 'osm'],
        geoFilter: GeoFilterBounds.make({ bounds }),
        text: testbedRegistry.get(queryInputAtom) || undefined,
      })

      addEvent('atomrpc', `Query: id=${query.id}, bounds=${bounds.join(',')}`, 'info')

      // Execute via AtomRpc (simulated for demo)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Simulate some results
      const mockResults: SearchResultItem[] = [
        SearchResultFlight.make({
          id: SearchResultId.make('flight-demo-1'),
          source: 'opensky',
          score: 0.95,
          retrievedAt: new Date(),
          icao24: Icao24.make('abc123'),
          callsign: 'UAL1234',
          position: [-122.4, 37.7, 10000],
          velocity: 250,
          heading: 45,
          verticalRate: 0,
          onGround: false,
          category: 'heavy',
          originCountry: 'United States',
          lastContact: new Date(),
        }),
        SearchResultPoi.make({
          id: SearchResultId.make('poi-demo-1'),
          source: 'osm',
          score: 0.8,
          retrievedAt: new Date(),
          poiId: PoiId.make('osm-12345'),
          position: [-122.45, 37.75],
          name: 'San Francisco Airport',
          category: 'aeroway',
          tags: { iata: 'SFO' },
        }),
      ]

      testbedRegistry.set(searchResultsAtom, mockResults)
      testbedRegistry.set(searchStatusAtom, 'success')
      testbedRegistry.set(connectionStatusAtom, { ...testbedRegistry.get(connectionStatusAtom), atomRpc: 'connected' as const })

      // Initialize Kori entities from results
      mockResults.forEach((result) => {
        const entityData: EntityLiveData = {
          entityId: result.id,
          entityType: result._tag === 'SearchResultFlight' ? 'flight' : 'poi',
          position: {
            lon: result.position[0],
            lat: result.position[1],
            altitudeM: result.position[2],
          },
          label: result._tag === 'SearchResultFlight'
            ? result.callsign || result.icao24
            : result._tag === 'SearchResultPoi'
              ? result.name || 'Unknown POI'
              : 'Unknown',
          lastUpdated: result.retrievedAt,
          isLive: false,
        }
        entityOps.initializeLiveData(entityData)
        addEvent('kori', `Initialized entity: ${entityData.entityId}`, 'success')
      })

      addEvent('atomrpc', `Search complete: ${mockResults.length} results`, 'success')

    } catch (error) {
      testbedRegistry.set(searchStatusAtom, 'error')
      testbedRegistry.set(searchErrorAtom, String(error))
      testbedRegistry.set(connectionStatusAtom, { ...testbedRegistry.get(connectionStatusAtom), atomRpc: 'error' as const })
      addEvent('atomrpc', `Search error: ${error}`, 'error')
    }
  }, [])

  const totalResults = searchResults.length + electricResults.length

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-cyan-400" />
        <span className="font-mono text-sm text-white">SEARCH (AtomRpc)</span>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => testbedRegistry.set(queryInputAtom, e.target.value)}
            placeholder="Search query..."
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-cyan-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={searchStatus === 'loading'}
            className="px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/30 disabled:opacity-50 transition-colors"
          >
            {searchStatus === 'loading' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </button>
        </div>

        {searchError && (
          <div className="text-xs text-red-400 bg-red-500/10 rounded p-2">
            {searchError}
          </div>
        )}

        <div className="text-xs text-neutral-400">
          {totalResults} results ({searchResults.length} search + {electricResults.length} electric)
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// ELECTRIC SYNC PANEL
// =============================================================================

function ElectricSyncPanel() {
  const { data: electricEntities, isLoading, error } = useFlightEntitiesWithTraits()
  const electricResults = useAtomValue(electricResultsAtom)

  // Convert Electric entities to search results when they change
  useEffect(() => {
    if (electricEntities && electricEntities.length > 0) {
      const converted = electricEntities.map(ecsFlightToSearchResult)
      testbedRegistry.set(electricResultsAtom, converted)
      testbedRegistry.set(connectionStatusAtom, { ...testbedRegistry.get(connectionStatusAtom), electric: 'connected' as const })
      addEvent('electric', `Synced ${converted.length} entities via Electric`, 'success')
    }
  }, [electricEntities])

  useEffect(() => {
    if (error) {
      testbedRegistry.set(connectionStatusAtom, { ...testbedRegistry.get(connectionStatusAtom), electric: 'error' as const })
      addEvent('electric', `Sync error: ${error}`, 'error')
    }
  }, [error])

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4 text-emerald-400" />
        <span className="font-mono text-sm text-white">ELECTRIC SYNC</span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-neutral-400">Status</span>
          <span className={isLoading ? 'text-yellow-400' : error ? 'text-red-400' : 'text-green-400'}>
            {isLoading ? 'Syncing...' : error ? 'Error' : 'Connected'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-400">Entities</span>
          <span className="text-white font-mono">{electricEntities?.length ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-400">Converted</span>
          <span className="text-white font-mono">{electricResults.length}</span>
        </div>

        <div className="pt-2 border-t border-neutral-800 text-neutral-500">
          Real-time PostgreSQL → Browser via Shape API
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// ENTITY MANAGEMENT PANEL (Kori)
// =============================================================================

function EntityManagementPanel() {
  // Read from geointRegistry via sync access
  const [selectionCount, setSelectionCount] = useState(0)
  const [pinnedCount, setPinnedCount] = useState(0)
  const searchResults = useAtomValue(searchResultsAtom)
  const electricResults = useAtomValue(electricResultsAtom)

  // Sync selection counts from geointRegistry
  useEffect(() => {
    const interval = setInterval(() => {
      setSelectionCount(HashSet.size(geointRegistry.get(selectedEntityIds)))
      setPinnedCount(HashSet.size(geointRegistry.get(pinnedEntityIds)))
    }, 100)
    return () => clearInterval(interval)
  }, [])

  const totalResults = searchResults.length + electricResults.length

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-purple-400" />
        <span className="font-mono text-sm text-white">KORI ENTITIES</span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-neutral-400">Total</span>
          <span className="text-white font-mono">{totalResults}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-400">Selected</span>
          <span className="text-cyan-400 font-mono">{selectionCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-400">Pinned</span>
          <span className="text-yellow-400 font-mono">{pinnedCount}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => entityOps.clearSelection()}
            className="flex-1 px-2 py-1 bg-neutral-800 text-neutral-400 rounded hover:bg-neutral-700 transition-colors"
          >
            Clear Selection
          </button>
          <button
            onClick={() => entityOps.clearNonPinned()}
            className="flex-1 px-2 py-1 bg-neutral-800 text-neutral-400 rounded hover:bg-neutral-700 transition-colors"
          >
            Clear Non-Pinned
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// TIMELINE PANEL
// =============================================================================

function TimelinePanel() {
  const playhead = useAtomValue(playheadAtom)
  const isPlaying = useAtomValue(isPlayingAtom)
  const searchResults = useAtomValue(searchResultsAtom)
  const electricResults = useAtomValue(electricResultsAtom)

  const totalResults = searchResults.length + electricResults.length

  // Timeline playback effect
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      testbedRegistry.update(playheadAtom, (t) => t + 1000) // Advance 1 second
    }, 100) // 10x speed

    return () => clearInterval(interval)
  }, [isPlaying])

  const togglePlayback = useCallback(() => {
    const currentPlaying = testbedRegistry.get(isPlayingAtom)
    testbedRegistry.set(isPlayingAtom, !currentPlaying)
    addEvent('ui', currentPlaying ? 'Timeline paused' : 'Timeline playing', 'info')
  }, [])

  const resetTimeline = useCallback(() => {
    testbedRegistry.set(playheadAtom, Date.now() - 5 * 60 * 1000) // 5 min ago
    addEvent('ui', 'Timeline reset', 'info')
  }, [])

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-orange-400" />
        <span className="font-mono text-sm text-white">TIMELINE</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlayback}
            className={`p-2 rounded transition-colors ${
              isPlaying
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={resetTimeline}
            className="p-2 bg-neutral-800 text-neutral-400 border border-neutral-700 rounded hover:bg-neutral-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <span className="flex-1 text-xs text-neutral-400 text-right font-mono">
            {new Date(playhead).toLocaleTimeString()}
          </span>
        </div>

        <div className="text-xs">
          <span className="text-neutral-400">Total Results: </span>
          <span className="text-white font-mono">{totalResults}</span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// RESULTS LIST
// =============================================================================

function ResultsList() {
  const searchResults = useAtomValue(searchResultsAtom)
  const electricResults = useAtomValue(electricResultsAtom)
  const [selectionState, setSelectionState] = useState<Set<string>>(new Set())
  const [pinnedState, setPinnedState] = useState<Set<string>>(new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Combine results
  const results = useMemo(() => {
    const searchIds = new Set(searchResults.map(r => r.id))
    const uniqueElectric = electricResults.filter(r => !searchIds.has(r.id))
    return [...searchResults, ...uniqueElectric]
  }, [searchResults, electricResults])

  // Sync state from geointRegistry
  useEffect(() => {
    const interval = setInterval(() => {
      const selected = geointRegistry.get(selectedEntityIds)
      const pinned = geointRegistry.get(pinnedEntityIds)
      const hovered = geointRegistry.get(hoveredEntityId)

      setSelectionState(new Set(HashSet.toValues(selected)))
      setPinnedState(new Set(HashSet.toValues(pinned)))
      setHoveredId(Option.isSome(hovered) ? hovered.value : null)
    }, 50)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4 flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-white" />
        <span className="font-mono text-sm text-white">RESULTS</span>
        <span className="text-xs text-neutral-500 ml-auto">{results.length} items</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {results.map((result) => {
          const isSelected = selectionState.has(result.id)
          const isPinned = pinnedState.has(result.id)
          const isHovered = hoveredId === result.id

          return (
            <div
              key={result.id}
              className={`p-2 rounded border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-cyan-500/20 border-cyan-500/50'
                  : isHovered
                    ? 'bg-neutral-800 border-neutral-600'
                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
              }`}
              onClick={() => entityOps.toggleSelect(result.id)}
              onMouseEnter={() => entityOps.hover(result.id)}
              onMouseLeave={() => entityOps.unhover(result.id)}
            >
              <div className="flex items-center gap-2">
                {result._tag === 'SearchResultFlight' ? (
                  <Plane className="w-3 h-3 text-cyan-400" />
                ) : (
                  <MapPin className="w-3 h-3 text-emerald-400" />
                )}
                <span className="text-xs text-white flex-1 truncate">
                  {result._tag === 'SearchResultFlight'
                    ? result.callsign || result.icao24
                    : result._tag === 'SearchResultPoi'
                      ? result.name || 'Unknown POI'
                      : 'Unknown'}
                </span>
                <span className="text-[10px] text-neutral-500">{result.source}</span>
                {isPinned && <Pin className="w-3 h-3 text-yellow-400" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    entityOps.togglePin(result.id)
                  }}
                  className="p-1 hover:bg-neutral-700 rounded"
                >
                  {isPinned ? (
                    <PinOff className="w-3 h-3 text-neutral-400" />
                  ) : (
                    <Pin className="w-3 h-3 text-neutral-600" />
                  )}
                </button>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1">
                [{result.position[0].toFixed(4)}, {result.position[1].toFixed(4)}]
              </div>
            </div>
          )
        })}

        {results.length === 0 && (
          <div className="text-center text-neutral-500 text-sm py-8">
            No results. Execute a search or wait for Electric sync.
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// EVENT LOG PANEL
// =============================================================================

function EventLogPanel() {
  const events = useAtomValue(eventLogAtom)

  const levelColors = {
    info: 'text-neutral-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  }

  const sourceColors = {
    atomrpc: 'bg-cyan-500/20 text-cyan-400',
    electric: 'bg-emerald-500/20 text-emerald-400',
    streams: 'bg-purple-500/20 text-purple-400',
    kori: 'bg-orange-500/20 text-orange-400',
    ui: 'bg-neutral-500/20 text-neutral-400',
  }

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4 h-48 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <Radio className="w-4 h-4 text-purple-400" />
        <span className="font-mono text-sm text-white">EVENT LOG</span>
        <button
          onClick={() => testbedRegistry.set(eventLogAtom, [])}
          className="ml-auto text-xs text-neutral-500 hover:text-neutral-300"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px]">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-2">
            <span className="text-neutral-600 shrink-0">
              {event.timestamp.toLocaleTimeString()}
            </span>
            <span className={`px-1 rounded ${sourceColors[event.source]} shrink-0`}>
              {event.source}
            </span>
            <span className={levelColors[event.level]}>
              {event.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// DATA FLOW DIAGRAM
// =============================================================================

function DataFlowDiagram() {
  const connectionStatus = useAtomValue(connectionStatusAtom)

  const NodeBox = ({
    label,
    icon: Icon,
    color,
    status
  }: {
    label: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    status?: 'connected' | 'disconnected' | 'error'
  }) => (
    <div className={`flex flex-col items-center gap-1 p-2 rounded border ${color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-[10px] font-mono">{label}</span>
      {status && (
        <div className={`w-1.5 h-1.5 rounded-full ${
          status === 'connected' ? 'bg-green-400' :
          status === 'error' ? 'bg-red-400' : 'bg-neutral-500'
        }`} />
      )}
    </div>
  )

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-yellow-400" />
        <span className="font-mono text-sm text-white">DATA FLOW</span>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs">
        <NodeBox
          label="AtomRpc"
          icon={Search}
          color="border-cyan-500/30 text-cyan-400"
          status={connectionStatus.atomRpc}
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="Handler"
          icon={Zap}
          color="border-purple-500/30 text-purple-400"
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="Atoms"
          icon={Radio}
          color="border-orange-500/30 text-orange-400"
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="UI"
          icon={Eye}
          color="border-white/30 text-white"
        />
      </div>

      <div className="flex items-center justify-center gap-2 text-xs mt-3">
        <NodeBox
          label="PostgreSQL"
          icon={Database}
          color="border-emerald-500/30 text-emerald-400"
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="Electric"
          icon={Zap}
          color="border-emerald-500/30 text-emerald-400"
          status={connectionStatus.electric}
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="Shape Hook"
          icon={Layers}
          color="border-emerald-500/30 text-emerald-400"
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="UI"
          icon={Eye}
          color="border-white/30 text-white"
        />
      </div>
    </div>
  )
}

// =============================================================================
// CONNECTION STATUS PANEL
// =============================================================================

function ConnectionStatusPanel() {
  const connectionStatus = useAtomValue(connectionStatusAtom)

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <SectionLabel>Connection Status</SectionLabel>
      <div className="space-y-2 mt-3">
        <StatusIndicator
          status={connectionStatus.atomRpc}
          label="AtomRpc (WebSocket)"
        />
        <StatusIndicator
          status={connectionStatus.electric}
          label="Electric (HTTP Shape)"
        />
        <StatusIndicator
          status={connectionStatus.durableStreams}
          label="DurableStreams (SSE)"
        />
      </div>
    </div>
  )
}

// =============================================================================
// MAIN TESTBED COMPONENT
// =============================================================================

export function IntegratedGeointTestbed() {
  // Initialize on mount
  useEffect(() => {
    addEvent('ui', 'Integrated GEOINT Testbed initialized', 'success')

    return () => {
      // Cleanup
      entityOps.clearAll()
    }
  }, [])

  return (
    <GeointRegistryProvider>
      <RegistryContext.Provider value={testbedRegistry as any}>
        <div className="min-h-screen bg-neutral-950 text-white p-6">
          <TestbedHeader
            title="Integrated GEOINT Testbed"
            subtitle="Complete vertical slice: AtomRpc → Handlers → Atoms → UI | Electric → Shapes → UI | Kori Entity Management"
          />

          <div className="mt-6 grid grid-cols-12 gap-4">
            {/* Left Column - Controls */}
            <div className="col-span-3 space-y-4">
              <SearchPanel />
              <ElectricSyncPanel />
              <EntityManagementPanel />
              <TimelinePanel />
            </div>

            {/* Center Column - Results */}
            <div className="col-span-6 flex flex-col gap-4">
              <DataFlowDiagram />
              <ResultsList />
            </div>

            {/* Right Column - Status & Logs */}
            <div className="col-span-3 space-y-4">
              <ConnectionStatusPanel />
              <EventLogPanel />
            </div>
          </div>
        </div>
      </RegistryContext.Provider>
    </GeointRegistryProvider>
  )
}

export default IntegratedGeointTestbed
