/**
 * Search → Kori Entity Vertical Slice Testbed
 *
 * Demonstrates the complete flow:
 * SearchClient RPC → SearchResultItem → Kori TraitBundle → Entity Atoms → UI
 *
 * This testbed shows how search results are converted to trackable entities
 * with live data updates and reactive UI state.
 *
 * Route: /testbed/search-to-kori
 *
 * @module
 */

import { useState, useEffect, useMemo } from 'react'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import { Atom, Registry } from '@effect-atom/atom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plane,
  MapPin,
  CloudSun,
  Target,
  Pin,
  PinOff,
  Eye,
  Layers,
  X,
  Activity,
  Zap,
  Database,
} from 'lucide-react'
import { TestbedHeader, SectionLabel } from './shared'

// ============================================================================
// Schemas - Import search result types
// ============================================================================

import {
  SearchResultItem,
  SearchResultFlight,
  SearchResultPoi,
  SearchResultWeather,
  SearchResultId,
  Icao24,
  PoiId,
} from '@/lib/geoint/schemas'

// ============================================================================
// Kori Integration - Entity mapping and atoms
// ============================================================================

import {
  mapSearchResultToTraits,
  getEntityType,
  getEntityLabel,
  type GeointEntityType,
} from '@/lib/geoint/kori/search-result-mapper'

import {
  geointRegistry,
  entityUIStateFamily,
  DEFAULT_ENTITY_UI_STATE,
} from '@/lib/geoint/kori/entity-atoms'

// ============================================================================
// Local Registry and Atoms
// ============================================================================

const testbedRegistry = Registry.make()

/** Tracked entities (entityId → SearchResultItem) */
const trackedEntitiesAtom = Atom.make<Map<string, SearchResultItem>>(new Map())

/** Selected entity IDs */
const selectedIdsAtom = Atom.make<Set<string>>(new Set<string>())

/** Pinned entity IDs */
const pinnedIdsAtom = Atom.make<Set<string>>(new Set<string>())

/** Search status */
const searchStatusAtom = Atom.make<'idle' | 'searching' | 'completed' | 'error'>('idle')

/** Last search results (raw) */
const searchResultsAtom = Atom.make<readonly SearchResultItem[]>([])

/** Entity count by type */
const entityCountsAtom = Atom.make<Record<GeointEntityType, number>>({
  flight: 0,
  poi: 0,
  weather: 0,
  track: 0,
  feature: 0,
  imagery: 0,
})

// ============================================================================
// Mock Data Generator (simulates SearchClient responses)
// ============================================================================

const generateMockFlights = (count: number): SearchResultFlight[] => {
  const flights: SearchResultFlight[] = []
  const baseIcao = 0xa00000

  for (let i = 0; i < count; i++) {
    const icao24 = (baseIcao + i).toString(16).padStart(6, '0')
    flights.push(
      SearchResultFlight.make({
        id: SearchResultId.make(`flight-${icao24}`),
        source: Math.random() > 0.5 ? 'opensky' : 'adsb-lol',
        score: 0.8 + Math.random() * 0.2,
        retrievedAt: new Date(),
        icao24: Icao24.make(icao24),
        callsign: `UAL${100 + i}`,
        position: [
          -122.4 + (Math.random() - 0.5) * 0.5,
          37.7 + (Math.random() - 0.5) * 0.5,
          10000 + Math.random() * 30000,
        ],
        velocity: 200 + Math.random() * 100,
        heading: Math.random() * 360,
        verticalRate: (Math.random() - 0.5) * 20,
        onGround: false,
        category: 'medium',
        originCountry: 'United States',
        lastContact: new Date(),
      })
    )
  }
  return flights
}

const generateMockPois = (count: number): SearchResultPoi[] => {
  const pois: SearchResultPoi[] = []
  const categories = ['amenity', 'shop', 'tourism', 'leisure', 'healthcare'] as const

  for (let i = 0; i < count; i++) {
    pois.push(
      SearchResultPoi.make({
        id: SearchResultId.make(`poi-${i}`),
        source: 'osm',
        score: 0.7 + Math.random() * 0.3,
        retrievedAt: new Date(),
        poiId: PoiId.make(`osm-${1000000 + i}`),
        name: `Location ${i}`,
        position: [
          -122.4 + (Math.random() - 0.5) * 0.5,
          37.7 + (Math.random() - 0.5) * 0.5,
        ],
        category: categories[Math.floor(Math.random() * categories.length)],
        tags: { amenity: 'yes' },
      })
    )
  }
  return pois
}

const generateMockWeather = (count: number): SearchResultWeather[] => {
  const results: SearchResultWeather[] = []

  for (let i = 0; i < count; i++) {
    results.push(
      SearchResultWeather.make({
        id: SearchResultId.make(`weather-${i}`),
        source: 'openmeteo',
        score: 0.9,
        retrievedAt: new Date(),
        position: [
          -122.4 + (Math.random() - 0.5) * 0.5,
          37.7 + (Math.random() - 0.5) * 0.5,
        ],
        locationName: `Weather Station ${i}`,
        temperature: 15 + Math.random() * 20,
        feelsLike: 14 + Math.random() * 20,
        humidity: 40 + Math.random() * 40,
        weatherCode: 0,
        weatherDescription: 'Clear sky',
        forecastTime: new Date(),
      })
    )
  }
  return results
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Execute a mock search and hydrate entities
 */
const executeSearch = (flightCount = 5, poiCount = 3, weatherCount = 2) => {
  testbedRegistry.set(searchStatusAtom, 'searching')

  // Simulate network delay
  setTimeout(() => {
    const flights = generateMockFlights(flightCount)
    const pois = generateMockPois(poiCount)
    const weather = generateMockWeather(weatherCount)

    const results: SearchResultItem[] = [...flights, ...pois, ...weather]
    testbedRegistry.set(searchResultsAtom, results)

    // Hydrate entities
    const trackedMap = new Map<string, SearchResultItem>()
    const counts: Record<GeointEntityType, number> = {
      flight: 0,
      poi: 0,
      weather: 0,
      track: 0,
      feature: 0,
      imagery: 0,
    }

    for (const result of results) {
      const traits = mapSearchResultToTraits(result)
      const entityType = getEntityType(result)
      trackedMap.set(traits.entityId, result)
      counts[entityType]++

      // Initialize entity atoms in geoint registry
      const uiAtom = entityUIStateFamily(traits.entityId)
      geointRegistry.set(uiAtom, DEFAULT_ENTITY_UI_STATE)

      console.log(
        `[SearchToKori] Hydrated ${entityType} entity: ${traits.entityId} with ${traits.traits.length} traits`
      )
    }

    testbedRegistry.set(trackedEntitiesAtom, trackedMap)
    testbedRegistry.set(entityCountsAtom, counts)
    testbedRegistry.set(searchStatusAtom, 'completed')

    console.log(`[SearchToKori] Hydrated ${results.length} entities`)
  }, 500)
}

/**
 * Toggle entity selection
 */
const toggleSelection = (entityId: string) => {
  const selected = testbedRegistry.get(selectedIdsAtom)
  const newSelected = new Set(selected)
  if (newSelected.has(entityId)) {
    newSelected.delete(entityId)
  } else {
    newSelected.add(entityId)
  }
  testbedRegistry.set(selectedIdsAtom, newSelected)

  // Update entity UI state
  const uiAtom = entityUIStateFamily(entityId)
  const current = geointRegistry.get(uiAtom)
  geointRegistry.set(uiAtom, {
    ...current,
    selected: newSelected.has(entityId),
  })
}

/**
 * Toggle entity pin
 */
const togglePin = (entityId: string) => {
  const pinned = testbedRegistry.get(pinnedIdsAtom)
  const newPinned = new Set(pinned)
  if (newPinned.has(entityId)) {
    newPinned.delete(entityId)
  } else {
    newPinned.add(entityId)
  }
  testbedRegistry.set(pinnedIdsAtom, newPinned)

  // Update entity UI state
  const uiAtom = entityUIStateFamily(entityId)
  const current = geointRegistry.get(uiAtom)
  geointRegistry.set(uiAtom, {
    ...current,
    pinned: newPinned.has(entityId),
  })
}

/**
 * Clear non-pinned entities
 */
const clearNonPinned = () => {
  const tracked = testbedRegistry.get(trackedEntitiesAtom)
  const pinned = testbedRegistry.get(pinnedIdsAtom)

  const newTracked = new Map<string, SearchResultItem>()
  for (const [id, result] of tracked) {
    if (pinned.has(id)) {
      newTracked.set(id, result)
    }
  }

  testbedRegistry.set(trackedEntitiesAtom, newTracked)
  testbedRegistry.set(selectedIdsAtom, new Set())

  // Recount
  const counts: Record<GeointEntityType, number> = {
    flight: 0,
    poi: 0,
    weather: 0,
    track: 0,
    feature: 0,
    imagery: 0,
  }
  for (const result of newTracked.values()) {
    counts[getEntityType(result)]++
  }
  testbedRegistry.set(entityCountsAtom, counts)
}

// ============================================================================
// Entity Card Component
// ============================================================================

interface EntityCardProps {
  entityId: string
  result: SearchResultItem
  isSelected: boolean
  isPinned: boolean
  onSelect: () => void
  onPin: () => void
}

function EntityCard({
  entityId,
  result,
  isSelected,
  isPinned,
  onSelect,
  onPin,
}: EntityCardProps) {
  const entityType = getEntityType(result)
  const label = getEntityLabel(result)
  const traits = mapSearchResultToTraits(result)

  const TypeIcon = useMemo(() => {
    switch (entityType) {
      case 'flight':
        return Plane
      case 'poi':
        return MapPin
      case 'weather':
        return CloudSun
      default:
        return Target
    }
  }, [entityType])

  const typeColor = useMemo(() => {
    switch (entityType) {
      case 'flight':
        return 'text-cyan-400'
      case 'poi':
        return 'text-green-400'
      case 'weather':
        return 'text-yellow-400'
      default:
        return 'text-neutral-400'
    }
  }, [entityType])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        bg-black/90 border rounded-lg p-3 cursor-pointer transition-all
        ${isSelected ? 'border-cyan-500 bg-cyan-500/10' : 'border-neutral-800 hover:border-neutral-700'}
      `}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TypeIcon className={`w-4 h-4 ${typeColor}`} />
          <span className="font-mono text-sm text-white truncate max-w-32">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPin()
            }}
            className={`p-1 rounded transition-colors ${
              isPinned ? 'text-orange-400 bg-orange-400/20' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {isPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Entity ID */}
      <div className="text-xs text-neutral-500 font-mono mb-2 truncate">{entityId}</div>

      {/* Traits Summary */}
      <div className="text-xs text-neutral-400">
        <span className="text-neutral-500">Traits:</span>{' '}
        <span className="text-cyan-400">{traits.traits.length}</span>
      </div>

      {/* Source */}
      <div className="text-xs text-neutral-400 mt-1">
        <span className="text-neutral-500">Source:</span>{' '}
        <span className="text-purple-400">{result.source}</span>
      </div>

      {/* Type-specific data */}
      {entityType === 'flight' && 'callsign' in result && (
        <div className="text-xs text-neutral-400 mt-1">
          <span className="text-neutral-500">Callsign:</span>{' '}
          <span className="text-green-400">{result.callsign || 'N/A'}</span>
        </div>
      )}
      {entityType === 'poi' && 'category' in result && (
        <div className="text-xs text-neutral-400 mt-1">
          <span className="text-neutral-500">Category:</span>{' '}
          <span className="text-green-400">{result.category}</span>
        </div>
      )}
      {entityType === 'weather' && 'temperature' in result && (
        <div className="text-xs text-neutral-400 mt-1">
          <span className="text-neutral-500">Temp:</span>{' '}
          <span className="text-orange-400">{(result.temperature as number).toFixed(1)}°C</span>
        </div>
      )}
    </motion.div>
  )
}

// ============================================================================
// Stats Panel Component
// ============================================================================

function StatsPanel({
  counts,
  totalEntities,
  selectedCount,
  pinnedCount,
}: {
  counts: Record<GeointEntityType, number>
  totalEntities: number
  selectedCount: number
  pinnedCount: number
}) {
  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <SectionLabel>Entity Statistics</SectionLabel>

      <div className="mt-3 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-neutral-400">Total Entities</span>
          <span className="text-cyan-400 font-mono">{totalEntities}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-neutral-400">Selected</span>
          <span className="text-yellow-400 font-mono">{selectedCount}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-neutral-400">Pinned</span>
          <span className="text-orange-400 font-mono">{pinnedCount}</span>
        </div>

        <div className="border-t border-neutral-800 my-2" />

        {/* By Type */}
        <div className="flex justify-between text-xs">
          <span className="flex items-center gap-1 text-cyan-400">
            <Plane className="w-3 h-3" /> Flights
          </span>
          <span className="font-mono">{counts.flight}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="flex items-center gap-1 text-green-400">
            <MapPin className="w-3 h-3" /> POIs
          </span>
          <span className="font-mono">{counts.poi}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="flex items-center gap-1 text-yellow-400">
            <CloudSun className="w-3 h-3" /> Weather
          </span>
          <span className="font-mono">{counts.weather}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component (inner)
// ============================================================================

function SearchToKoriTestbedInner() {
  // Local state for UI
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Atom subscriptions (registry provided via context)
  const trackedEntities = useAtomValue(trackedEntitiesAtom)
  const selectedIds = useAtomValue(selectedIdsAtom)
  const pinnedIds = useAtomValue(pinnedIdsAtom)
  const searchStatus = useAtomValue(searchStatusAtom)
  const entityCounts = useAtomValue(entityCountsAtom)

  // Derived values
  const entities = useMemo(() => Array.from(trackedEntities.entries()), [trackedEntities])
  const totalEntities = entities.length

  // Execute initial search on mount
  useEffect(() => {
    executeSearch(5, 3, 2)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <TestbedHeader
        title="Search → Kori Entity"
        subtitle="SearchResult → TraitBundle → Entity Atoms"
        backLink="/"
      />

      {/* Main Content */}
      <div className="relative h-[calc(100vh-80px)] flex">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="w-80 bg-black/95 border-r border-neutral-800 z-20 flex flex-col overflow-hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="font-mono text-sm text-white">ENTITIES</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              </div>

              {/* Controls */}
              <div className="p-4 border-b border-neutral-800 space-y-2">
                <button
                  onClick={() => executeSearch(5, 3, 2)}
                  disabled={searchStatus === 'searching'}
                  className={`
                    w-full px-3 py-2 rounded text-xs flex items-center justify-center gap-2 border transition-colors
                    ${
                      searchStatus === 'searching'
                        ? 'opacity-50 cursor-wait border-neutral-700'
                        : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30'
                    }
                  `}
                >
                  <Search className="w-3 h-3" />
                  {searchStatus === 'searching' ? 'Searching...' : 'Execute Search'}
                </button>

                <button
                  onClick={clearNonPinned}
                  className="w-full px-3 py-2 rounded text-xs flex items-center justify-center gap-2 border transition-colors bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                >
                  <X className="w-3 h-3" />
                  Clear Non-Pinned
                </button>
              </div>

              {/* Stats */}
              <div className="p-4 border-b border-neutral-800">
                <StatsPanel
                  counts={entityCounts}
                  totalEntities={totalEntities}
                  selectedCount={selectedIds.size}
                  pinnedCount={pinnedIds.size}
                />
              </div>

              {/* Entity List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <AnimatePresence mode="popLayout">
                  {entities.map(([entityId, result]) => (
                    <EntityCard
                      key={entityId}
                      entityId={entityId}
                      result={result}
                      isSelected={selectedIds.has(entityId)}
                      isPinned={pinnedIds.has(entityId)}
                      onSelect={() => toggleSelection(entityId)}
                      onPin={() => togglePin(entityId)}
                    />
                  ))}
                </AnimatePresence>

                {entities.length === 0 && (
                  <div className="text-center text-neutral-500 text-sm py-8">
                    No entities tracked. Execute a search to hydrate entities.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Area - Architecture Diagram */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <div className="bg-black/80 border border-neutral-800 rounded-lg p-6">
              <h2 className="text-lg font-mono text-cyan-400 mb-6">Data Flow Architecture</h2>

              {/* Flow Diagram */}
              <div className="space-y-4 font-mono text-sm">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-cyan-400" />
                  <span className="text-white">SearchClient.search(query)</span>
                </div>
                <div className="ml-2 text-neutral-600">│</div>
                <div className="flex items-center gap-3 ml-4">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span className="text-neutral-300">SearchResultItem[]</span>
                </div>
                <div className="ml-2 text-neutral-600">│</div>
                <div className="flex items-center gap-3 ml-4">
                  <Activity className="w-4 h-4 text-green-400" />
                  <span className="text-neutral-300">mapSearchResultToTraits()</span>
                </div>
                <div className="ml-2 text-neutral-600">│</div>
                <div className="flex items-center gap-3 ml-4">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-neutral-300">TraitBundle (entityId + traits)</span>
                </div>
                <div className="ml-2 text-neutral-600">│</div>
                <div className="flex items-center gap-3 ml-4">
                  <Layers className="w-4 h-4 text-orange-400" />
                  <span className="text-neutral-300">entityUIStateFamily(entityId)</span>
                </div>
                <div className="ml-2 text-neutral-600">│</div>
                <div className="flex items-center gap-3 ml-4">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span className="text-neutral-300">useAtomValue() → React UI</span>
                </div>
              </div>

              {/* Key Files */}
              <div className="mt-8 border-t border-neutral-800 pt-6">
                <h3 className="text-sm font-mono text-neutral-400 mb-3">Key Files</h3>
                <div className="space-y-1 text-xs font-mono text-neutral-500">
                  <div>• lib/geoint/kori/search-result-mapper.ts</div>
                  <div>• lib/geoint/kori/entity-atoms.ts</div>
                  <div>• lib/geoint/kori/GeointKoriBridge.ts</div>
                  <div>• lib/geoint/clients/SearchClient.ts</div>
                </div>
              </div>

              {/* Trait Types */}
              <div className="mt-6 border-t border-neutral-800 pt-6">
                <h3 className="text-sm font-mono text-neutral-400 mb-3">Trait Types</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-neutral-900 rounded p-2">
                    <span className="text-cyan-400">GeoPosition</span>
                    <span className="text-neutral-500"> - lon/lat</span>
                  </div>
                  <div className="bg-neutral-900 rounded p-2">
                    <span className="text-green-400">UIState</span>
                    <span className="text-neutral-500"> - selected/hovered</span>
                  </div>
                  <div className="bg-neutral-900 rounded p-2">
                    <span className="text-yellow-400">SourceConfidence</span>
                    <span className="text-neutral-500"> - score/staleness</span>
                  </div>
                  <div className="bg-neutral-900 rounded p-2">
                    <span className="text-purple-400">FlightData</span>
                    <span className="text-neutral-500"> - icao24/callsign</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toggle Button (when sidebar closed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 top-4 p-2 bg-black/90 border border-neutral-800 rounded-lg hover:bg-neutral-900 transition-colors"
          >
            <Layers className="w-4 h-4 text-cyan-400" />
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Exported Component (wrapped with RegistryContext.Provider)
// ============================================================================

export function SearchToKoriTestbed() {
  return (
    <RegistryContext.Provider value={testbedRegistry}>
      <SearchToKoriTestbedInner />
    </RegistryContext.Provider>
  )
}

export default SearchToKoriTestbed
