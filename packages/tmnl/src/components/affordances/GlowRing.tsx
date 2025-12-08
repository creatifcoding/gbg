/**
 * GlowRing Affordance
 *
 * Matte border ring with optional breathing animation.
 * Stillness with potential — slow, meditative presence.
 *
 * Uses anime.js for smooth, interruptible animations.
 */

import { useEffect, useRef } from 'react'
import { animate } from 'animejs'
import type { GlowableData } from '@/lib/capabilities/types'
import { COLORS, TIMING, EASING } from '@/lib/capabilities/tokens'

export interface GlowRingProps extends GlowableData {
  className?: string
}

export function GlowRing({ color = 'cyan', intensity = 'md', animated, className = '' }: GlowRingProps) {
  const ringRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<ReturnType<typeof animate> | null>(null)
  const colorValues = COLORS.accent[color] ?? COLORS.accent.cyan

  // Intensity maps to border thickness and subtle glow
  const intensityStyles = {
    sm: { borderWidth: 1, glowSpread: 4 },
    md: { borderWidth: 1, glowSpread: 8 },
    lg: { borderWidth: 2, glowSpread: 12 },
  }

  const { borderWidth, glowSpread } = intensityStyles[intensity]

  useEffect(() => {
    if (!animated || !ringRef.current) return

    // Choose timing based on animation type
    const timing = animated ? TIMING.activePulse : TIMING.breathing

    animationRef.current = animate(ringRef.current, {
      opacity: timing.opacity,
      scale: timing.scale,
      duration: timing.period,
      ease: EASING.anime.breathing,
      loop: true,
    })

    return () => {
      animationRef.current?.pause()
    }
  }, [animated])

  return (
    <div
      ref={ringRef}
      className={`absolute inset-0 rounded pointer-events-none ${className}`}
      style={{
        border: `${borderWidth}px solid ${colorValues.border}`,
        // Subtle glow — not harsh, just a soft presence
        boxShadow: `0 0 ${glowSpread}px 0 ${colorValues.glow}`,
        opacity: animated ? 0.7 : 0.85,
        transformOrigin: 'center',
      }}
    />
  )
}

export default GlowRing
