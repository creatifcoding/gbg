/**
 * Badge Affordance
 *
 * Matte corner badge with optional breathing dot.
 * Refined presence — visible but not demanding.
 *
 * Uses anime.js for subtle dot pulse.
 */

import { useEffect, useRef } from 'react'
import { animate } from 'animejs'
import type { BadgeableData } from '@/lib/capabilities/types'
import { COLORS, GEOMETRY, TYPOGRAPHY, TIMING, EASING } from '@/lib/capabilities/tokens'

export interface BadgeProps extends BadgeableData {
  className?: string
}

const POSITION_STYLES: Record<NonNullable<BadgeableData['position']>, React.CSSProperties> = {
  'top-right': { top: GEOMETRY.badge.offsetY, right: GEOMETRY.badge.offsetX },
  'top-left': { top: GEOMETRY.badge.offsetY, left: GEOMETRY.badge.offsetX },
  'bottom-right': { bottom: GEOMETRY.badge.offsetY, right: GEOMETRY.badge.offsetX },
  'bottom-left': { bottom: GEOMETRY.badge.offsetY, left: GEOMETRY.badge.offsetX },
}

export function Badge({
  text,
  color = 'cyan',
  position = 'top-right',
  dot,
  className = '',
}: BadgeProps) {
  const dotRef = useRef<HTMLDivElement>(null)
  const colorValues = COLORS.accent[color] ?? COLORS.accent.cyan

  useEffect(() => {
    if (!dot || !dotRef.current) return

    // Slow, meditative breathing for dot
    const animation = animate(dotRef.current, {
      scale: TIMING.badge.dotScale,
      opacity: [0.6, 1, 0.6],
      duration: TIMING.badge.dotPeriod,
      easing: EASING.anime.breathing,
      loop: true,
    })

    return () => animation.pause()
  }, [dot])

  if (dot) {
    return (
      <div
        ref={dotRef}
        className={`absolute pointer-events-none ${className}`}
        style={{
          ...POSITION_STYLES[position],
          width: 6,
          height: 6,
          borderRadius: GEOMETRY.radius.full,
          backgroundColor: colorValues.solid,
          // Subtle glow, not harsh
          boxShadow: `0 0 6px 0 ${colorValues.glow}`,
          transformOrigin: 'center',
        }}
      />
    )
  }

  return (
    <div
      className={`absolute pointer-events-none ${className}`}
      style={{
        ...POSITION_STYLES[position],
        minWidth: GEOMETRY.badge.minWidth,
        padding: '2px 6px',
        fontSize: TYPOGRAPHY.fontSize.xxs,
        fontFamily: TYPOGRAPHY.fontFamily.mono,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        // Matte background — barely there
        backgroundColor: colorValues.muted,
        border: `1px solid ${colorValues.border}`,
        color: colorValues.base,
        borderRadius: GEOMETRY.radius.sm,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  )
}

export default Badge
