/**
 * ParticleFlow
 *
 * Animated particles flowing along SVG paths to visualize data throughput.
 * Uses requestAnimationFrame for smooth 60fps animation.
 *
 * @module
 */

import { useRef, useEffect, memo } from 'react'

// =============================================================================
// TYPES
// =============================================================================

export interface Particle {
  /** Unique particle ID */
  id: string
  /** Position along path (0-1) */
  progress: number
  /** Speed multiplier */
  speed: number
  /** Particle size */
  size: number
  /** Color override */
  color?: string
}

export interface ParticleFlowProps {
  /** SVG path data (d attribute) */
  pathData: string
  /** Particles per second to emit */
  emissionRate?: number
  /** Base speed (path units per frame) */
  baseSpeed?: number
  /** Particle color */
  color?: string
  /** Particle size */
  particleSize?: number
  /** Whether flow is active */
  active?: boolean
  /** Flow direction (1 = forward, -1 = reverse) */
  direction?: 1 | -1
  /** Opacity */
  opacity?: number
  /** Container width */
  width?: number
  /** Container height */
  height?: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_EMISSION_RATE = 8 // particles per second
const DEFAULT_BASE_SPEED = 0.008 // progress per frame at 60fps
const DEFAULT_PARTICLE_SIZE = 3
const DEFAULT_COLOR = '#22d3ee' // cyan-400

// =============================================================================
// PARTICLE FLOW
// =============================================================================

/**
 * Animated particle flow along an SVG path.
 *
 * Creates a stream of glowing particles that flow along the given path,
 * visualizing data throughput in topology connections.
 */
export const ParticleFlow = memo(function ParticleFlow({
  pathData,
  emissionRate = DEFAULT_EMISSION_RATE,
  baseSpeed = DEFAULT_BASE_SPEED,
  color = DEFAULT_COLOR,
  particleSize = DEFAULT_PARTICLE_SIZE,
  active = true,
  direction = 1,
  opacity = 1,
  width = 200,
  height = 100,
}: ParticleFlowProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number | null>(null)
  const lastEmitRef = useRef<number>(0)
  const idCounterRef = useRef<number>(0)

  // Animation loop
  useEffect(() => {
    if (!active || !pathRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }

    const path = pathRef.current
    const pathLength = path.getTotalLength()

    const animate = (timestamp: number) => {
      // Emit new particles
      const timeSinceLastEmit = timestamp - lastEmitRef.current
      const emitInterval = 1000 / emissionRate

      if (timeSinceLastEmit >= emitInterval) {
        const newParticle: Particle = {
          id: `p-${idCounterRef.current++}`,
          progress: direction === 1 ? 0 : 1,
          speed: baseSpeed * (0.8 + Math.random() * 0.4), // ±20% variation
          size: particleSize * (0.8 + Math.random() * 0.4),
        }
        particlesRef.current.push(newParticle)
        lastEmitRef.current = timestamp
      }

      // Update particle positions
      particlesRef.current = particlesRef.current.filter((particle) => {
        particle.progress += particle.speed * direction

        // Remove particles that have completed the path
        if (direction === 1 && particle.progress >= 1) return false
        if (direction === -1 && particle.progress <= 0) return false
        return true
      })

      // Render particles
      const svg = svgRef.current
      if (svg) {
        // Clear existing particle elements (except path)
        const existingParticles = svg.querySelectorAll('.particle')
        existingParticles.forEach((el) => el.remove())

        // Draw particles
        particlesRef.current.forEach((particle) => {
          const point = path.getPointAtLength(particle.progress * pathLength)

          // Main particle
          const circle = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'circle'
          )
          circle.setAttribute('class', 'particle')
          circle.setAttribute('cx', String(point.x))
          circle.setAttribute('cy', String(point.y))
          circle.setAttribute('r', String(particle.size))
          circle.setAttribute('fill', particle.color ?? color)
          circle.setAttribute('opacity', String(opacity))

          // Glow effect
          const glow = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'circle'
          )
          glow.setAttribute('class', 'particle')
          glow.setAttribute('cx', String(point.x))
          glow.setAttribute('cy', String(point.y))
          glow.setAttribute('r', String(particle.size * 2))
          glow.setAttribute('fill', particle.color ?? color)
          glow.setAttribute('opacity', String(opacity * 0.3))
          glow.setAttribute('filter', 'blur(2px)')

          svg.appendChild(glow)
          svg.appendChild(circle)
        })
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [active, pathData, emissionRate, baseSpeed, color, particleSize, direction, opacity])

  // Clear particles when deactivated
  useEffect(() => {
    if (!active) {
      particlesRef.current = []
    }
  }, [active])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 1 }}
    >
      {/* Hidden path for measurement */}
      <path
        ref={pathRef}
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth={1}
      />
    </svg>
  )
})

// =============================================================================
// PARTICLE FLOW EDGE
// =============================================================================

export interface ParticleFlowEdgeProps {
  /** Start X coordinate */
  x1: number
  /** Start Y coordinate */
  y1: number
  /** End X coordinate */
  x2: number
  /** End Y coordinate */
  y2: number
  /** Throughput (0-1) affects emission rate */
  throughput?: number
  /** Whether edge is active */
  active?: boolean
  /** Edge color */
  color?: string
}

/**
 * Convenience wrapper for straight-line particle flow between two points.
 */
export const ParticleFlowEdge = memo(function ParticleFlowEdge({
  x1,
  y1,
  x2,
  y2,
  throughput = 0.5,
  active = true,
  color = DEFAULT_COLOR,
}: ParticleFlowEdgeProps) {
  // Create path data for a straight line
  const pathData = `M ${x1} ${y1} L ${x2} ${y2}`

  // Scale emission rate by throughput
  const emissionRate = Math.max(2, Math.round(throughput * 20))

  // Calculate bounding box
  const minX = Math.min(x1, x2)
  const minY = Math.min(y1, y2)
  const width = Math.abs(x2 - x1) + 20
  const height = Math.abs(y2 - y1) + 20

  return (
    <div
      style={{
        position: 'absolute',
        left: minX - 10,
        top: minY - 10,
        width,
        height,
        pointerEvents: 'none',
      }}
    >
      <ParticleFlow
        pathData={`M ${x1 - minX + 10} ${y1 - minY + 10} L ${x2 - minX + 10} ${y2 - minY + 10}`}
        width={width}
        height={height}
        emissionRate={emissionRate}
        active={active}
        color={color}
        opacity={0.5 + throughput * 0.5}
      />
    </div>
  )
})

// =============================================================================
// PARTICLE FLOW BEZIER
// =============================================================================

export interface ParticleFlowBezierProps {
  /** Start X coordinate */
  x1: number
  /** Start Y coordinate */
  y1: number
  /** Control point 1 X */
  cx1: number
  /** Control point 1 Y */
  cy1: number
  /** Control point 2 X */
  cx2: number
  /** Control point 2 Y */
  cy2: number
  /** End X coordinate */
  x2: number
  /** End Y coordinate */
  y2: number
  /** Throughput (0-1) affects emission rate */
  throughput?: number
  /** Whether edge is active */
  active?: boolean
  /** Edge color */
  color?: string
}

/**
 * Particle flow along a cubic bezier curve.
 */
export const ParticleFlowBezier = memo(function ParticleFlowBezier({
  x1,
  y1,
  cx1,
  cy1,
  cx2,
  cy2,
  x2,
  y2,
  throughput = 0.5,
  active = true,
  color = DEFAULT_COLOR,
}: ParticleFlowBezierProps) {
  // Create cubic bezier path
  const pathData = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`

  // Calculate bounding box (approximate)
  const minX = Math.min(x1, cx1, cx2, x2)
  const minY = Math.min(y1, cy1, cy2, y2)
  const maxX = Math.max(x1, cx1, cx2, x2)
  const maxY = Math.max(y1, cy1, cy2, y2)
  const width = maxX - minX + 40
  const height = maxY - minY + 40

  // Scale emission rate by throughput
  const emissionRate = Math.max(2, Math.round(throughput * 20))

  return (
    <div
      style={{
        position: 'absolute',
        left: minX - 20,
        top: minY - 20,
        width,
        height,
        pointerEvents: 'none',
      }}
    >
      <ParticleFlow
        pathData={`M ${x1 - minX + 20} ${y1 - minY + 20} C ${cx1 - minX + 20} ${cy1 - minY + 20}, ${cx2 - minX + 20} ${cy2 - minY + 20}, ${x2 - minX + 20} ${y2 - minY + 20}`}
        width={width}
        height={height}
        emissionRate={emissionRate}
        active={active}
        color={color}
        opacity={0.5 + throughput * 0.5}
      />
    </div>
  )
})

export default ParticleFlow
