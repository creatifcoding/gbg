/**
 * TrackMarker3D - 3D track marker for R3F overlay
 *
 * Renders a 3D cone/arrow pointing in the track heading direction.
 * Color-coded by classification (hostile=red, friendly=green, etc.)
 *
 * @module
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Cone, Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { Track, Classification } from '../schemas'
import { classificationColors } from '../schemas'

// =============================================================================
// Configuration
// =============================================================================

const MARKER_HEIGHT = 15
const MARKER_RADIUS = 5
const LABEL_OFFSET_Y = 20
const LABEL_FONT_SIZE = 0.5

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert classification to THREE.Color
 */
const getClassificationThreeColor = (classification: Classification | undefined): THREE.Color => {
  const key = classification ?? 'unknown'
  const rgb = classificationColors[key]
  return new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
}

/**
 * Project lat/lon to x/y coordinates for overlay
 * This is a simplified Mercator projection - in production,
 * you'd want to sync with the actual map projection
 */
export const projectToOverlay = (
  lon: number,
  lat: number,
  center: { lon: number; lat: number },
  scale: number = 100
): [number, number, number] => {
  const x = (lon - center.lon) * scale * Math.cos((lat * Math.PI) / 180)
  const y = (lat - center.lat) * scale
  return [x, y, 0]
}

// =============================================================================
// TrackMarker3D Component
// =============================================================================

export interface TrackMarker3DProps {
  track: Track
  center: { lon: number; lat: number }
  scale?: number
  showLabel?: boolean
  animate?: boolean
  onClick?: (track: Track) => void
  onPointerOver?: (track: Track) => void
  onPointerOut?: () => void
}

/**
 * 3D Track Marker with heading indicator
 */
export function TrackMarker3D({
  track,
  center,
  scale = 100,
  showLabel = true,
  animate = true,
  onClick,
  onPointerOver,
  onPointerOut
}: TrackMarker3DProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const latestPosition = track.latestPosition

  if (!latestPosition) return null

  const position = useMemo(
    () => projectToOverlay(latestPosition.lon, latestPosition.lat, center, scale),
    [latestPosition.lon, latestPosition.lat, center, scale]
  )

  const color = useMemo(
    () => getClassificationThreeColor(track.metadata.classification),
    [track.metadata.classification]
  )

  // Convert heading to rotation (THREE.js uses radians, heading is degrees from north)
  const rotation = useMemo(() => {
    const headingRad = (-latestPosition.heading * Math.PI) / 180
    return new THREE.Euler(Math.PI / 2, 0, headingRad)
  }, [latestPosition.heading])

  // Animate pulse for hostile tracks
  useFrame((state) => {
    if (!animate || !meshRef.current) return
    if (track.metadata.classification === 'hostile') {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1
      meshRef.current.scale.set(scale, scale, scale)
    }
  })

  return (
    <group position={position}>
      {/* Heading indicator cone */}
      <Cone
        ref={meshRef}
        args={[MARKER_RADIUS, MARKER_HEIGHT, 8]}
        rotation={rotation}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.(track)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onPointerOver?.(track)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          onPointerOut?.()
          document.body.style.cursor = 'default'
        }}
      >
        <meshStandardMaterial color={color} />
      </Cone>

      {/* Label */}
      {showLabel && (
        <Billboard position={[0, LABEL_OFFSET_Y, 0]}>
          <Text
            fontSize={LABEL_FONT_SIZE}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            {track.trackId}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

export default TrackMarker3D
