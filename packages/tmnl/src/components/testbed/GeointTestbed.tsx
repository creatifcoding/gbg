/**
 * GEOINT Testbed
 *
 * Interactive testbed for the GEOINT layering system.
 * Uses GeointMap with full Mapbox + deck.gl + R3F integration.
 *
 * Route: /testbed/geoint
 *
 * @module
 */

import { useState, useCallback, useMemo } from 'react'
import { AlertTriangle, Eye, EyeOff, Play, Pause } from 'lucide-react'
import { useAtom } from '@effect-atom/atom-react'
import { TestbedHeader, SectionLabel, TestCard, ControlGroup } from './shared'
import {
  Track,
  TrackPosition,
  TrackMetadata,
  ThreatVolume,
  classificationColors,
  type TrackId,
} from '@/lib/geoint/schemas'
import {
  GeointMap,
  createGeointInstanceAtoms,
  type GeointLayerVisibility,
} from '@/lib/geoint/components'

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
// Component
// =============================================================================

export function GeointTestbed() {
  // Get instance atoms
  const atoms = useMemo(() => createGeointInstanceAtoms(INSTANCE_ID), [])

  // Subscribe to visibility atom for layer controls
  const [visibility, setVisibility] = useAtom(atoms.visibilityAtom)
  const [selectedTrack, setSelectedTrack] = useAtom(atoms.selectedTrackAtom)

  // Animation state
  const [animate, setAnimate] = useState(false)

  // Toggle a specific layer
  const toggleLayer = useCallback(
    (layer: keyof GeointLayerVisibility) => {
      setVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }))
    },
    [setVisibility]
  )

  // Track click handler
  const handleTrackClick = useCallback(
    (track: Track) => {
      setSelectedTrack(track)
    },
    [setSelectedTrack]
  )

  // Track hover handler
  const handleTrackHover = useCallback((_track: Track | null) => {
    // Could update cursor or tooltip state here
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <TestbedHeader
        title="GEOINT Testbed"
        subtitle="Geospatial Intelligence Layering System"
        backLink="/"
      />

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Control Panel */}
        <div className="w-80 border-r border-neutral-800 p-4 overflow-y-auto">
          <SectionLabel>Layer Controls</SectionLabel>

          <div className="space-y-3 mt-4">
            <ControlGroup label="Track Paths">
              <LayerToggle
                label={visibility.paths ? 'Visible' : 'Hidden'}
                active={visibility.paths}
                onClick={() => toggleLayer('paths')}
                color="cyan"
              />
            </ControlGroup>

            <ControlGroup label="Track Positions">
              <LayerToggle
                label={visibility.positions ? 'Visible' : 'Hidden'}
                active={visibility.positions}
                onClick={() => toggleLayer('positions')}
                color="cyan"
              />
            </ControlGroup>

            <ControlGroup label="Track Headings">
              <LayerToggle
                label={visibility.headings ? 'Visible' : 'Hidden'}
                active={visibility.headings}
                onClick={() => toggleLayer('headings')}
                color="cyan"
              />
            </ControlGroup>

            <ControlGroup label="Heatmap">
              <LayerToggle
                label={visibility.heatmap ? 'Visible' : 'Hidden'}
                active={visibility.heatmap}
                onClick={() => toggleLayer('heatmap')}
                color="orange"
              />
            </ControlGroup>

            <ControlGroup label="Animated Trips">
              <div className="flex gap-2">
                <LayerToggle
                  label={visibility.trips ? 'Visible' : 'Hidden'}
                  active={visibility.trips}
                  onClick={() => toggleLayer('trips')}
                  color="orange"
                />
                <button
                  onClick={() => setAnimate(!animate)}
                  className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 border transition-colors ${
                    animate
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                  }`}
                >
                  {animate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
              </div>
            </ControlGroup>

            <ControlGroup label="3D Overlay (R3F)">
              <LayerToggle
                label={visibility.r3f ? 'Visible' : 'Hidden'}
                active={visibility.r3f}
                onClick={() => toggleLayer('r3f')}
                color="purple"
              />
            </ControlGroup>

            <ControlGroup label="Labels">
              <LayerToggle
                label={visibility.labels ? 'On' : 'Off'}
                active={visibility.labels}
                onClick={() => toggleLayer('labels')}
                color="green"
              />
            </ControlGroup>
          </div>

          {/* Track List */}
          <SectionLabel className="mt-8">Active Tracks</SectionLabel>
          <div className="space-y-2 mt-4">
            {MOCK_TRACKS.map((track) => {
              const classification = track.metadata.classification ?? 'unknown'
              const color = classificationColors[classification]
              const isSelected = selectedTrack?.trackId === track.trackId

              return (
                <button
                  key={track.trackId}
                  onClick={() => setSelectedTrack(track)}
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
            {MOCK_THREATS.map((threat, idx) => (
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

        {/* Map View */}
        <div className="flex-1 relative">
          <GeointMap
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
            onTrackClick={handleTrackClick}
            onTrackHover={handleTrackHover}
          />

          {/* Selected Track Info */}
          {selectedTrack && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/90 border border-neutral-800 rounded p-4">
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
                  className="text-neutral-500 hover:text-white text-xl"
                >
                  ×
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GeointTestbed
