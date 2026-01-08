/**
 * ThreatVolume - 3D threat envelope visualization
 *
 * Renders a semi-transparent cylinder or sphere to indicate
 * threat range/envelope around a position.
 *
 * @module
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Cylinder, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import type { ThreatVolume as ThreatVolumeSchema } from '../schemas'
import { projectToOverlay } from './TrackMarker3D'

// =============================================================================
// Configuration
// =============================================================================

const THREAT_COLORS = {
  low: new THREE.Color(0, 0.5, 0),     // Green
  medium: new THREE.Color(1, 0.8, 0),  // Yellow
  high: new THREE.Color(1, 0.4, 0),    // Orange
  critical: new THREE.Color(1, 0, 0)   // Red
}

const THREAT_OPACITY = {
  low: 0.15,
  medium: 0.25,
  high: 0.35,
  critical: 0.5
}

// =============================================================================
// ThreatVolume Component
// =============================================================================

export interface ThreatVolume3DProps {
  threat: ThreatVolumeSchema
  center: { lon: number; lat: number }
  scale?: number
  animate?: boolean
  shape?: 'cylinder' | 'sphere'
}

/**
 * 3D Threat Volume visualization
 */
export function ThreatVolume3D({
  threat,
  center,
  scale = 100,
  animate = true,
  shape = 'cylinder'
}: ThreatVolume3DProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  const position = useMemo(
    () => projectToOverlay(threat.center[0], threat.center[1], center, scale),
    [threat.center, center, scale]
  )

  const color = useMemo(() => THREAT_COLORS[threat.level], [threat.level])
  const opacity = useMemo(() => THREAT_OPACITY[threat.level], [threat.level])

  // Scale radius and height to overlay coordinates
  const scaledRadius = (threat.radius / 1000) * scale // Convert meters to km then scale
  const scaledHeight = (threat.height / 1000) * scale

  // Animate pulsing for critical threats
  useFrame((state) => {
    if (!animate || !meshRef.current) return
    if (threat.level === 'critical') {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05
      meshRef.current.scale.set(pulse, 1, pulse)
    }
  })

  if (shape === 'sphere') {
    return (
      <Sphere
        ref={meshRef}
        args={[scaledRadius, 32, 32]}
        position={position}
      >
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
        />
      </Sphere>
    )
  }

  return (
    <Cylinder
      ref={meshRef}
      args={[scaledRadius, scaledRadius, scaledHeight, 32]}
      position={[position[0], position[1] + scaledHeight / 2, position[2]]}
    >
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </Cylinder>
  )
}

export default ThreatVolume3D
