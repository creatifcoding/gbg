/**
 * ALLINT COP Testbed
 *
 * Interactive testbed for the All-Source Intelligence Common Operating Picture
 * search system. Demonstrates:
 * - SearchPanel UI with source filters
 * - Search result visualization layers
 * - Viewport-based auto-search
 * - Mock data generation for all source types
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
import { HashMap } from 'effect'
import { DeckGL } from '@deck.gl/react'
import { Map as MapboxMap } from 'react-map-gl/mapbox'
import type { MapViewState } from '@deck.gl/core'
import { TestbedHeader, TestCard } from './shared'
import {
  SearchPanel,
  viewStateToBBox,
} from '@/lib/geoint/components'
// Note: Mock data used for testbed - SearchService atoms available for production use
// import { searchStatusAtom, allResultsAtom } from '@/lib/geoint/services/SearchService'
import {
  createSearchResultLayers,
} from '@/lib/geoint/layers'
import type {
  SearchResultItem,
  SearchResultTrack,
  SearchResultPoi,
  SearchResultFlight,
  SearchResultFeature,
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
// Mock Data Generation
// =============================================================================

function generateMockTrack(index: number, bounds: BBox): SearchResultTrack {
  const [minLon, minLat, maxLon, maxLat] = bounds
  const lon = minLon + Math.random() * (maxLon - minLon)
  const lat = minLat + Math.random() * (maxLat - minLat)
  const classifications = ['friendly', 'hostile', 'neutral', 'unknown'] as const
  const objectTypes = ['aircraft', 'vehicle', 'vessel', 'person'] as const

  return {
    _tag: 'SearchResultTrack',
    id: `track-${index}` as any,
    source: 'track',
    score: 0.7 + Math.random() * 0.3,
    retrievedAt: new Date(),
    trackId: `TRACK-${String(index).padStart(3, '0')}` as any,
    position: [lon, lat, Math.random() * 1000] as [number, number, number],
    heading: Math.random() * 360,
    speed: 10 + Math.random() * 50,
    classification: classifications[Math.floor(Math.random() * classifications.length)],
    objectType: objectTypes[Math.floor(Math.random() * objectTypes.length)],
    label: `Track ${index}`,
  }
}

function generateMockPoi(index: number, bounds: BBox): SearchResultPoi {
  const [minLon, minLat, maxLon, maxLat] = bounds
  const lon = minLon + Math.random() * (maxLon - minLon)
  const lat = minLat + Math.random() * (maxLat - minLat)
  const categories = ['amenity', 'building', 'shop', 'tourism', 'healthcare'] as const
  const names = ['Hospital', 'School', 'Restaurant', 'Gas Station', 'Police Station', 'Fire Station']

  return {
    _tag: 'SearchResultPoi',
    id: `poi-${index}` as any,
    source: 'osm',
    score: 0.6 + Math.random() * 0.4,
    retrievedAt: new Date(),
    poiId: `OSM-${String(index).padStart(6, '0')}` as any,
    position: [lon, lat] as [number, number],
    name: names[Math.floor(Math.random() * names.length)] + ` #${index}`,
    category: categories[Math.floor(Math.random() * categories.length)],
    tags: { type: 'mock', index: String(index) },
  }
}

function generateMockFlight(index: number, bounds: BBox): SearchResultFlight {
  const [minLon, minLat, maxLon, maxLat] = bounds
  const lon = minLon + Math.random() * (maxLon - minLon)
  const lat = minLat + Math.random() * (maxLat - minLat)
  const altitude = 1000 + Math.random() * 10000
  const categories = ['light', 'medium', 'heavy', 'rotorcraft'] as const
  const countries = ['United States', 'Canada', 'Mexico', 'Germany', 'France', 'Japan']
  const callsigns = ['UAL', 'AAL', 'DAL', 'SWA', 'JBU', 'ASA']

  return {
    _tag: 'SearchResultFlight',
    id: `flight-${index}` as any,
    source: 'opensky',
    score: 0.8 + Math.random() * 0.2,
    retrievedAt: new Date(),
    icao24: `${Math.random().toString(16).slice(2, 8)}` as any,
    callsign: `${callsigns[Math.floor(Math.random() * callsigns.length)]}${100 + index}`,
    position: [lon, lat, altitude] as [number, number, number],
    velocity: 150 + Math.random() * 200,
    heading: Math.random() * 360,
    verticalRate: -5 + Math.random() * 10,
    onGround: Math.random() > 0.9,
    category: categories[Math.floor(Math.random() * categories.length)],
    originCountry: countries[Math.floor(Math.random() * countries.length)],
    lastContact: new Date(),
  }
}

function generateMockFeature(index: number, bounds: BBox): SearchResultFeature {
  const [minLon, minLat, maxLon, maxLat] = bounds
  const lon = minLon + Math.random() * (maxLon - minLon)
  const lat = minLat + Math.random() * (maxLat - minLat)

  return {
    _tag: 'SearchResultFeature',
    id: `feature-${index}` as any,
    source: 'feature',
    score: 0.5 + Math.random() * 0.5,
    retrievedAt: new Date(),
    featureId: `FEAT-${String(index).padStart(4, '0')}` as any,
    position: [lon, lat] as [number, number],
    geometryType: 'Point',
    properties: { category: 'landmark', importance: Math.random() },
    label: `Feature ${index}`,
  }
}

function generateMockResults(bounds: BBox, sources: IntelSource[]): SearchResultItem[] {
  const results: SearchResultItem[] = []

  if (sources.includes('track')) {
    for (let i = 0; i < 5; i++) {
      results.push(generateMockTrack(i, bounds))
    }
  }

  if (sources.includes('osm')) {
    for (let i = 0; i < 8; i++) {
      results.push(generateMockPoi(i, bounds))
    }
  }

  if (sources.includes('opensky')) {
    for (let i = 0; i < 6; i++) {
      results.push(generateMockFlight(i, bounds))
    }
  }

  if (sources.includes('feature')) {
    for (let i = 0; i < 4; i++) {
      results.push(generateMockFeature(i, bounds))
    }
  }

  return results
}

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

  // Handle search execution
  const handleSearch = useCallback((bounds: BBox, sources: IntelSource[]) => {
    setSearchStatus('searching')

    // Simulate network delay
    setTimeout(() => {
      const results = generateMockResults(bounds, sources)
      setMockResults(results)

      // Group by source
      const grouped = new Map<IntelSource, SearchResultItem[]>()
      for (const result of results) {
        const existing = grouped.get(result.source) ?? []
        existing.push(result)
        grouped.set(result.source, existing)
      }
      let finalMap = HashMap.empty<IntelSource, readonly SearchResultItem[]>()
      for (const [source, items] of grouped) {
        finalMap = HashMap.set(finalMap, source, items)
      }
      setMockResultsBySource(finalMap)
      setSearchStatus('completed')
    }, 500)
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
