/**
 * GlowRing Component
 *
 * Renders a glowing ring around content.
 * Consumer imports this and decides when to render.
 */

import type { GlowableData } from '../types'
import { COLORS, GEOMETRY } from '../tokens'

export interface GlowRingProps extends GlowableData {
  className?: string
}

export function GlowRing({ color, intensity = 'md', animated, className = '' }: GlowRingProps) {
  const colorValues = COLORS.accent[color]
  const geo = GEOMETRY.glow[intensity]

  const animationClass = animated ? 'animate-pulse' : ''

  return (
    <div
      className={`absolute inset-0 rounded pointer-events-none ${animationClass} ${className}`}
      style={{
        border: `1px solid ${colorValues.border}`,
        boxShadow: `0 0 ${geo.blur}px ${geo.spread}px ${colorValues.glow}, inset 0 0 ${geo.blur / 2}px ${geo.spread / 2}px ${colorValues.glow}`,
      }}
    />
  )
}

export default GlowRing
