/**
 * GEOINT Testbed
 *
 * Interactive testbed for the GEOINT layering system with ALLINT COP search.
 * Uses GeointMap with full Mapbox + deck.gl + R3F integration.
 * Layer controls in inline drawer (toggle with L key or button).
 * Real API integration with OpenSky and Overpass.
 *
 * Route: /testbed/geoint
 *
 * @module
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { AlertTriangle, Eye, EyeOff, Play, Pause, Layers, X, Search, Plane, Building } from 'lucide-react'
import { useAtom } from '@effect-atom/atom-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Effect, Layer as EffectLayer, HashMap, pipe } from 'effect'
import { FetchHttpClient } from '@effect/platform'
import { TestbedHeader, SectionLabel, TestCard } from './shared'
import {
  Track,
  TrackPosition,
  TrackMetadata,
  ThreatVolume,
  classificationColors,
  type TrackId,
  type SearchResultItem,
  type SearchResultFlight,
  type SearchResultPoi,
  type IntelSource,
  type BBox,
} from '@/lib/geoint/schemas'
import {
  GeointMapPositioned,
  createGeointInstanceAtoms,
  positioningOps,
  viewStateToBBox,
  type GeointLayerVisibility,
  type FlyToTarget,
} from '@/lib/geoint/components'
import {
  OpenSkyClientService,
  OverpassClientService,
  openSkyToSearchResult,
  overpassToSearchResult,
  ExternalApiClientsLive,
} from '@/lib/geoint/api/ExternalApiClient'
import { createSearchResultLayers } from '@/lib/geoint/layers'

// =============================================================================
// Mock Data
// =============================================================================

const MOCK_POSITIONS_ALPHA: TrackPosition[] = [
  new TrackPosition({ timestamp: new Date(Date.now() - 60000), lat: 37.77, lon: -122.42, heading: 45, speed: 25, altitude: 0 }),
  new TrackPosition({ timestamp: new Date(Date.now() - 45000), lat: 37.775, lon: -122.415, heading: 50, speed: 28, altitude: 0 }),
  new TrackPosition({ timestamp: new Date(Date.now() - 30000), lat: 37.78, lon: -122.41, heading: 55, speed: 30, altitude: 0 }),
  new TrackPosition({ timestamp: new Date(Date.now() - 15000), lat: 37.785, lon: -122.405, heading: 60, speed: 32, altitude: 0 }),
  new TrackPosition({ timestamp: new Date(), lat: 37.79, lon: -122.40, heading: 65, speed: 30, altitude: 0 }),
]

const MOCK_POSITIONS_BRAVO: TrackPosition[] = [
  new TrackPosition({ timestamp: new Date(Date.now() - 50000), lat: 37.76, lon: -122.44, heading: 90, speed: 15, altitude: 100 }),
  new TrackPosition({ timestamp: new Date(Date.now() - 35000), lat: 37.76, lon: -122.43, heading: 88, speed: 18, altitude: 150 }),
  new TrackPosition({ timestamp: new Date(Date.now() - 20000), lat: 37.755, lon: -122.42, heading: 85, speed: 20, altitude: 200 }),
  new TrackPosition({ timestamp: new Date(), lat: 37.75, lon: -122.41, heading: 80, speed: 22, altitude: 250 }),
]

const MOCK_POSITIONS_CHARLIE: TrackPosition[] = [
  new TrackPosition({ timestamp: new Date(Date.now() - 40000), lat: 37.805, lon: -122.45, heading: 180, speed: 10, altitude: 0 }),
  new TrackPosition({ timestamp: new Date(Date.now() - 20000), lat: 37.795, lon: -122.45, heading: 175, speed: 12, altitude: 0 }),
  new TrackPosition({ timestamp: new Date(), lat: 37.785, lon: -122.445, heading: 170, speed: 14, altitude: 0 }),
]

const MOCK_TRACKS: Track[] = [
  new Track({
    trackId: 'TRACK-ALPHA-001' as TrackId,
    positions: MOCK_POSITIONS_ALPHA,
    metadata: new TrackMetadata({
      objectType: 'vessel',
      classification: 'hostile',
      confidence: 0.92,
      source: 'RADAR',
    }),
  }),
  new Track({
    trackId: 'TRACK-BRAVO-002' as TrackId,
    positions: MOCK_POSITIONS_BRAVO,
    metadata: new TrackMetadata({
      objectType: 'aircraft',
      classification: 'friendly',
      confidence: 0.98,
      source: 'AIS',
    }),
  }),
  new Track({
    trackId: 'TRACK-CHARLIE-003' as TrackId,
    positions: MOCK_POSITIONS_CHARLIE,
    metadata: new TrackMetadata({
      objectType: 'vessel',
      classification: 'neutral',
      confidence: 0.75,
      source: 'ELINT',
    }),
  }),
]

const MOCK_THREATS: ThreatVolume[] = [
  new ThreatVolume({
    center: [-122.42, 37.78] as [number, number],
    radius: 500,
    height: 1000,
    level: 'high',
    confidence: 0.85,
    trackId: 'TRACK-ALPHA-001' as TrackId,
  }),
  new ThreatVolume({
    center: [-122.45, 37.80] as [number, number],
    radius: 300,
    height: 500,
    level: 'medium',
    confidence: 0.6,
  }),
]

// =============================================================================
// ALLINT COP Search Effects
// =============================================================================

/**
 * Combined layer for API clients with HTTP
 */
const ApiLayer = pipe(
  ExternalApiClientsLive,
  EffectLayer.provide(FetchHttpClient.layer)
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
    const sourceCounts = HashMap.empty<IntelSource, number>()
    let counts = sourceCounts

    // Query OpenSky if requested
    if (sources.includes('opensky') || sources.length === 0) {
      const flights = yield* searchFlightsEffect(bounds, limit)
      results.push(...flights)
      counts = HashMap.set(counts, 'opensky' as IntelSource, flights.length)
    }

    // Query Overpass if requested
    if (sources.includes('osm') || sources.length === 0) {
      const pois = yield* searchPoisEffect(bounds, [], limit)
      results.push(...pois)
      counts = HashMap.set(counts, 'osm' as IntelSource, pois.length)
    }

    return { results, sourceCounts: counts }
  })

/**
 * Run the search effect with provided layer
 */
const runSearch = (bounds: BBox, sources: IntelSource[], limit: number = 50) =>
  Effect.runPromise(
    searchAllEffect(bounds, sources, limit).pipe(Effect.provide(ApiLayer))
  )

// =============================================================================
// Constants
// =============================================================================

const INSTANCE_ID = 'geoint-testbed'

// =============================================================================
// Layer Toggle Button
// =============================================================================

interface LayerToggleProps {
  label: string
  active: boolean
  onClick: () => void
  color?: 'cyan' | 'orange' | 'purple' | 'green'
}

function LayerToggle({ label, active, onClick, color = 'cyan' }: LayerToggleProps) {
  const colorClasses = {
    cyan: active
      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
      : 'bg-neutral-800 text-neutral-500 border-neutral-700',
    orange: active
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      : 'bg-neutral-800 text-neutral-500 border-neutral-700',
    purple: active
      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      : 'bg-neutral-800 text-neutral-500 border-neutral-700',
    green: active
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-neutral-800 text-neutral-500 border-neutral-700',
  }

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 border transition-colors ${colorClasses[color]}`}
    >
      {active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      {label}
    </button>
  )
}

// =============================================================================
// Inline Layer Drawer
// =============================================================================

interface LayerDrawerProps {
  open: boolean
  onClose: () => void
  visibility: GeointLayerVisibility
  onToggleLayer: (layer: keyof GeointLayerVisibility) => void
  animate: boolean
  onToggleAnimate: () => void
  tracks: Track[]
  threats: ThreatVolume[]
  selectedTrack: Track | null
  onSelectTrack: (track: Track | null) => void
  // ALLINT COP Search
  searchStatus: 'idle' | 'searching' | 'completed' | 'error'
  searchResults: SearchResultItem[]
  searchCounts: HashMap.HashMap<IntelSource, number>
  onSearch: () => void
}

function LayerDrawer({
  open,
  onClose,
  visibility,
  onToggleLayer,
  animate,
  onToggleAnimate,
  tracks,
  threats,
  selectedTrack,
  onSelectTrack,
  searchStatus,
  searchResults,
  searchCounts,
  onSearch,
}: LayerDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute top-0 left-0 bottom-0 w-80 bg-black/95 border-r border-neutral-800 z-20 flex flex-col"
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-sm text-white">LAYER CONTROLS</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-neutral-800 rounded transition-colors"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4">
            <SectionLabel>Visibility</SectionLabel>

            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Track Paths</span>
                <LayerToggle
                  label={visibility.paths ? 'On' : 'Off'}
                  active={visibility.paths}
                  onClick={() => onToggleLayer('paths')}
                  color="cyan"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Positions</span>
                <LayerToggle
                  label={visibility.positions ? 'On' : 'Off'}
                  active={visibility.positions}
                  onClick={() => onToggleLayer('positions')}
                  color="cyan"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Headings</span>
                <LayerToggle
                  label={visibility.headings ? 'On' : 'Off'}
                  active={visibility.headings}
                  onClick={() => onToggleLayer('headings')}
                  color="cyan"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Heatmap</span>
                <LayerToggle
                  label={visibility.heatmap ? 'On' : 'Off'}
                  active={visibility.heatmap}
                  onClick={() => onToggleLayer('heatmap')}
                  color="orange"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Animated</span>
                <div className="flex gap-2">
                  <LayerToggle
                    label={visibility.trips ? 'On' : 'Off'}
                    active={visibility.trips}
                    onClick={() => onToggleLayer('trips')}
                    color="orange"
                  />
                  <button
                    onClick={onToggleAnimate}
                    className={`px-2 py-1.5 rounded text-sm flex items-center border transition-colors ${
                      animate
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                    }`}
                  >
                    {animate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Positioned Entities</span>
                <LayerToggle
                  label={visibility.positionedEntities ? 'On' : 'Off'}
                  active={visibility.positionedEntities}
                  onClick={() => onToggleLayer('positionedEntities')}
                  color="purple"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Labels</span>
                <LayerToggle
                  label={visibility.labels ? 'On' : 'Off'}
                  active={visibility.labels}
                  onClick={() => onToggleLayer('labels')}
                  color="green"
                />
              </div>
            </div>

            {/* ALLINT COP Search */}
            <SectionLabel className="mt-8">ALLINT COP Search</SectionLabel>
            <div className="space-y-3 mt-4">
              <button
                onClick={onSearch}
                disabled={searchStatus === 'searching'}
                className={`w-full px-3 py-2 rounded text-sm flex items-center justify-center gap-2 border transition-colors ${
                  searchStatus === 'searching'
                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30'
                }`}
              >
                <Search className="w-4 h-4" />
                {searchStatus === 'searching' ? 'Searching...' : 'Search Viewport'}
              </button>

              {searchStatus === 'completed' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Total Results</span>
                    <span className="text-white font-mono">{searchResults.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400 flex items-center gap-1">
                      <Plane className="w-3 h-3 text-yellow-400" /> Flights
                    </span>
                    <span className="text-white font-mono">
                      {pipe(
                        HashMap.get(searchCounts, 'opensky' as IntelSource),
                        (opt) => opt._tag === 'Some' ? opt.value : 0
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400 flex items-center gap-1">
                      <Building className="w-3 h-3 text-blue-400" /> POIs
                    </span>
                    <span className="text-white font-mono">
                      {pipe(
                        HashMap.get(searchCounts, 'osm' as IntelSource),
                        (opt) => opt._tag === 'Some' ? opt.value : 0
                      )}
                    </span>
                  </div>
                </div>
              )}

              {searchStatus === 'error' && (
                <div className="text-xs text-red-400">Search failed. Check console.</div>
              )}
            </div>

            {/* Track List */}
            <SectionLabel className="mt-8">Active Tracks</SectionLabel>
            <div className="space-y-2 mt-4">
              {tracks.map((track) => {
                const classification = track.metadata.classification ?? 'unknown'
                const color = classificationColors[classification]
                const isSelected = selectedTrack?.trackId === track.trackId

                return (
                  <button
                    key={track.trackId}
                    onClick={() => onSelectTrack(isSelected ? null : track)}
                    className={`w-full text-left p-3 rounded border transition-all ${
                      isSelected
                        ? 'bg-white/10 border-white/30'
                        : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: `rgb(${color.join(',')})` }}
                      />
                      <span className="font-mono text-sm">{track.trackId}</span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {classification.toUpperCase()} • {track.metadata.source}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Threat Volumes */}
            <SectionLabel className="mt-8">Threat Volumes</SectionLabel>
            <div className="space-y-2 mt-4">
              {threats.map((threat, idx) => (
                <TestCard key={idx} className="p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={`w-4 h-4 ${
                        threat.level === 'critical'
                          ? 'text-red-500'
                          : threat.level === 'high'
                            ? 'text-orange-500'
                            : threat.level === 'medium'
                              ? 'text-yellow-500'
                              : 'text-green-500'
                      }`}
                    />
                    <span className="font-mono text-sm uppercase">{threat.level}</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Radius: {threat.radius}m • Height: {threat.height}m
                  </div>
                </TestCard>
              ))}
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="px-4 py-3 border-t border-neutral-800 text-xs text-neutral-500">
            Press <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded mx-1">L</kbd> to toggle
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// =============================================================================
// Component
// =============================================================================

export function GeointTestbed() {
  // Get instance atoms
  const atoms = useMemo(() => createGeointInstanceAtoms(INSTANCE_ID), [])

  // Subscribe to visibility atom for layer controls
  const [visibility, setVisibility] = useAtom(atoms.visibilityAtom)
  const [selectedTrack, setSelectedTrack] = useAtom(atoms.selectedTrackAtom)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Animation state
  const [animate, setAnimate] = useState(false)

  // Camera fly-to state
  const [flyToTarget, setFlyToTarget] = useState<FlyToTarget | null>(null)

  // Track positioned entity count for debug
  const [spawnedCount, setSpawnedCount] = useState(0)

  // ALLINT COP Search state
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'completed' | 'error'>('idle')
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const [searchCounts, setSearchCounts] = useState<HashMap.HashMap<IntelSource, number>>(HashMap.empty())
  const [viewportBounds, setViewportBounds] = useState<BBox | null>(null)

  // Spawn positioned entities from tracks on mount
  const hasSpawnedRef = useRef(false)
  useEffect(() => {
    if (hasSpawnedRef.current) return
    hasSpawnedRef.current = true

    // Convert tracks to positioned entity spawn options
    const spawnOptions = MOCK_TRACKS.map((track) => {
      const latestPosition = track.positions[track.positions.length - 1]
      return {
        position: {
          longitude: latestPosition.lon,
          latitude: latestPosition.lat,
          altitude: latestPosition.altitude ?? 0,
        },
        heading: latestPosition.heading
          ? { heading: latestPosition.heading }
          : undefined,
        entityId: `positioned-${track.trackId}`, // Deterministic ID
      }
    })

    // Spawn positioned entities
    positioningOps.spawnBatch(spawnOptions).then((entities) => {
      console.log('[GeointTestbed] Spawned positioned entities:', entities.length)
      setSpawnedCount(entities.length)
    }).catch((err) => {
      console.error('[GeointTestbed] Failed to spawn positioned entities:', err)
    })
  }, [])

  // Toggle a specific layer
  const toggleLayer = useCallback(
    (layer: keyof GeointLayerVisibility) => {
      setVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }))
    },
    [setVisibility]
  )

  // Keyboard shortcut for drawer toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' || e.key === 'L') {
        // Don't trigger if typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        setDrawerOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen])

  // Fly to a track's latest position
  const flyToTrack = useCallback((track: Track) => {
    const latestPosition = track.positions[track.positions.length - 1]
    if (latestPosition) {
      setFlyToTarget({
        longitude: latestPosition.lon,
        latitude: latestPosition.lat,
        zoom: 14,
        pitch: 45,
        bearing: latestPosition.heading ?? 0,
        key: `${track.trackId}-${Date.now()}`, // Unique key to allow re-flying
      })
    }
  }, [])

  // Track click handler
  const handleTrackClick = useCallback(
    (track: Track) => {
      setSelectedTrack(track)
      flyToTrack(track)
    },
    [setSelectedTrack, flyToTrack]
  )

  // Track selection from drawer (also flies to track)
  const handleSelectTrack = useCallback(
    (track: Track | null) => {
      setSelectedTrack(track)
      if (track) {
        flyToTrack(track)
      }
    },
    [setSelectedTrack, flyToTrack]
  )

  // Track hover handler
  const handleTrackHover = useCallback((_track: Track | null) => {
    // Could update cursor or tooltip state here
  }, [])

  // ALLINT COP Search handler - calls real OpenSky/Overpass APIs
  const handleSearch = useCallback(() => {
    if (!viewportBounds) {
      // Use default bounds around SF
      const defaultBounds: BBox = [-122.5, 37.7, -122.3, 37.9]
      setViewportBounds(defaultBounds)
      performSearch(defaultBounds)
    } else {
      performSearch(viewportBounds)
    }

    function performSearch(bounds: BBox) {
      setSearchStatus('searching')
      runSearch(bounds, ['opensky', 'osm'], 50)
        .then(({ results, sourceCounts }) => {
          setSearchResults(results)
          setSearchCounts(sourceCounts)
          setSearchStatus('completed')
          console.log('[GeointTestbed] Real API results:', { total: results.length })
        })
        .catch((error) => {
          console.error('[GeointTestbed] Search failed:', error)
          setSearchStatus('error')
        })
    }
  }, [viewportBounds])

  // Track viewport changes for search
  const handleViewStateChange = useCallback((viewState: { longitude: number; latitude: number; zoom: number }) => {
    const bounds = viewStateToBBox(viewState as any)
    setViewportBounds(bounds)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <TestbedHeader
        title="GEOINT Testbed"
        subtitle="Geospatial Intelligence Layering System"
        backLink="/"
      />

      {/* Main Content - Full Width Map */}
      <div className="relative h-[calc(100vh-80px)]">
        {/* Map View - Full Width (with PositioningProvider) */}
        <GeointMapPositioned
          instanceId={INSTANCE_ID}
          tracks={MOCK_TRACKS}
          threats={MOCK_THREATS}
          initialViewState={{
            longitude: -122.42,
            latitude: 37.78,
            zoom: 12,
          }}
          height="100%"
          interactive={true}
          animate={animate}
          debug={true}
          flyToTarget={flyToTarget}
          onTrackClick={handleTrackClick}
          onTrackHover={handleTrackHover}
        />

        {/* Layer Drawer Toggle Button */}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className={`absolute top-4 left-4 z-30 p-2.5 rounded-lg border transition-all ${
            drawerOpen
              ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
              : 'bg-black/80 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600'
          }`}
          title="Toggle Layer Controls (L)"
        >
          <Layers className="w-5 h-5" />
        </button>

        {/* Inline Layer Drawer */}
        <LayerDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          visibility={visibility}
          onToggleLayer={toggleLayer}
          animate={animate}
          onToggleAnimate={() => setAnimate(!animate)}
          tracks={MOCK_TRACKS}
          threats={MOCK_THREATS}
          selectedTrack={selectedTrack}
          onSelectTrack={handleSelectTrack}
          searchStatus={searchStatus}
          searchResults={searchResults}
          searchCounts={searchCounts}
          onSearch={handleSearch}
        />

        {/* Selected Track Info Panel */}
        {selectedTrack && (
          <motion.div
            className="absolute bottom-4 left-4 right-4 bg-black/90 border border-neutral-800 rounded-lg p-4 z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: `rgb(${classificationColors[selectedTrack.metadata.classification ?? 'unknown'].join(',')})`,
                  }}
                />
                <span className="font-mono text-lg">{selectedTrack.trackId}</span>
              </div>
              <button
                onClick={() => setSelectedTrack(null)}
                className="p-1 hover:bg-neutral-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
              <div>
                <div className="text-neutral-500 text-xs">Classification</div>
                <div className="uppercase">{selectedTrack.metadata.classification}</div>
              </div>
              <div>
                <div className="text-neutral-500 text-xs">Confidence</div>
                <div>{((selectedTrack.metadata.confidence ?? 0) * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-neutral-500 text-xs">Source</div>
                <div>{selectedTrack.metadata.source}</div>
              </div>
              <div>
                <div className="text-neutral-500 text-xs">Object Type</div>
                <div className="uppercase">{selectedTrack.metadata.objectType}</div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default GeointTestbed
