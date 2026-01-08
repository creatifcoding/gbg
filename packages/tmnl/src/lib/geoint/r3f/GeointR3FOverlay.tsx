/**
 * GeointR3FOverlay - Main R3F canvas overlay for GEOINT
 *
 * Renders a transparent R3F canvas that can be positioned
 * over a deck.gl/mapbox map for 3D elements.
 *
 * @module
 */

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useAtomValue } from '@effect-atom/atom-react'
import { Result } from '@effect-atom/atom'
import type { CSSProperties } from 'react'
import type { Track, ThreatVolume as ThreatVolumeSchema } from '../schemas'
import { TrackMarker3D } from './TrackMarker3D'
import { ThreatVolume3D } from './ThreatVolume'
import { activeTracksAtom } from '../clients'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 0, 500]
const DEFAULT_FOV = 50

// =============================================================================
// Types
// =============================================================================

export interface GeointR3FOverlayProps {
  /** Map center for coordinate projection */
  center: { lon: number; lat: number }
  /** Scale factor for projection */
  scale?: number
  /** Optional tracks to render (uses activeTracksAtom if not provided) */
  tracks?: readonly Track[]
  /** Threat volumes to render */
  threats?: readonly ThreatVolumeSchema[]
  /** Show track labels */
  showLabels?: boolean
  /** Animate markers */
  animate?: boolean
  /** Enable orbit controls for debugging */
  enableControls?: boolean
  /** Custom styles for the canvas container */
  style?: CSSProperties
  /** Track click handler */
  onTrackClick?: (track: Track) => void
  /** Track hover handler */
  onTrackHover?: (track: Track | null) => void
}

// =============================================================================
// Inner Component (uses atoms)
// =============================================================================

function GeointR3FContent({
  center,
  scale = 100,
  tracks: propTracks,
  threats = [],
  showLabels = true,
  animate = true,
  onTrackClick,
  onTrackHover
}: Omit<GeointR3FOverlayProps, 'style' | 'enableControls'>) {
  // Use atom if tracks not provided
  const atomTracks = useAtomValue(activeTracksAtom)

  // Resolve tracks: props override atom
  const tracks: readonly Track[] = propTracks ??
    (Result.isSuccess(atomTracks) ? atomTracks.value : [])

  return (
    <>
      {/* Ambient + directional lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />

      {/* Track markers */}
      {tracks.map((track) => (
        <TrackMarker3D
          key={track.trackId}
          track={track}
          center={center}
          scale={scale}
          showLabel={showLabels}
          animate={animate}
          onClick={onTrackClick}
          onPointerOver={(t) => onTrackHover?.(t)}
          onPointerOut={() => onTrackHover?.(null)}
        />
      ))}

      {/* Threat volumes */}
      {threats.map((threat, idx) => (
        <ThreatVolume3D
          key={threat.trackId ?? `threat-${idx}`}
          threat={threat}
          center={center}
          scale={scale}
          animate={animate}
        />
      ))}
    </>
  )
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * GEOINT R3F Overlay Canvas
 *
 * Position this absolutely over a deck.gl/mapbox map:
 *
 * @example
 * ```tsx
 * <div style={{ position: 'relative', width: '100%', height: '100%' }}>
 *   <BaseMap {...mapProps} />
 *   <GeointR3FOverlay
 *     center={{ lon: -122.4, lat: 37.8 }}
 *     style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
 *     onTrackClick={(track) => console.log('Clicked:', track.trackId)}
 *   />
 * </div>
 * ```
 */
export function GeointR3FOverlay({
  center,
  scale = 100,
  tracks,
  threats = [],
  showLabels = true,
  animate = true,
  enableControls = false,
  style,
  onTrackClick,
  onTrackHover
}: GeointR3FOverlayProps) {
  return (
    <Canvas
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style
      }}
      gl={{ alpha: true, antialias: true }}
    >
      <PerspectiveCamera
        makeDefault
        position={DEFAULT_CAMERA_POSITION}
        fov={DEFAULT_FOV}
      />

      {enableControls && <OrbitControls />}

      <Suspense fallback={null}>
        <GeointR3FContent
          center={center}
          scale={scale}
          tracks={tracks}
          threats={threats}
          showLabels={showLabels}
          animate={animate}
          onTrackClick={onTrackClick}
          onTrackHover={onTrackHover}
        />
      </Suspense>
    </Canvas>
  )
}

export default GeointR3FOverlay
