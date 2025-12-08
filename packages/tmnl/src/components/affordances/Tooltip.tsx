/**
 * Tooltip Affordance
 *
 * Matte tooltip with subtle fade + translate entrance.
 * Clean typography, minimal borders, calm presence.
 *
 * Uses anime.js for smooth entrance/exit.
 */

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import type { TooltippableData } from '@/lib/capabilities/types'
import { COLORS, GEOMETRY, TYPOGRAPHY, TIMING, EASING } from '@/lib/capabilities/tokens'

export interface TooltipProps extends TooltippableData {
  visible: boolean
  className?: string
}

// Position and offset based on side
const getPositionStyles = (side: NonNullable<TooltippableData['side']>): React.CSSProperties => {
  const offset = GEOMETRY.tooltip.offset
  const base: Record<typeof side, React.CSSProperties> = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: offset },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: offset },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: offset },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: offset },
  }
  return base[side]
}

// Entrance translate direction based on side
const getEntranceOffset = (side: NonNullable<TooltippableData['side']>) => {
  const offset = TIMING.tooltip.offset
  const map: Record<typeof side, { y?: number; x?: number }> = {
    top: { y: offset },      // Slides down into place
    bottom: { y: -offset },  // Slides up into place
    left: { x: offset },     // Slides right into place
    right: { x: -offset },   // Slides left into place
  }
  return map[side]
}

export function Tooltip({
  text,
  content,
  side = 'top',
  visible,
  className = '',
}: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [shouldRender, setShouldRender] = useState(visible)

  useEffect(() => {
    if (!tooltipRef.current) return

    if (visible) {
      setShouldRender(true)
      const entrance = getEntranceOffset(side)

      // Entrance animation
      animate(tooltipRef.current, {
        opacity: [0, 1],
        translateY: entrance.y ? [entrance.y, 0] : undefined,
        translateX: entrance.x ? [entrance.x, 0] : undefined,
        duration: TIMING.tooltip.duration,
        ease: EASING.anime.out,
      })
    } else if (shouldRender) {
      // Exit animation
      const entrance = getEntranceOffset(side)
      animate(tooltipRef.current, {
        opacity: [1, 0],
        translateY: entrance.y ? [0, entrance.y / 2] : undefined,
        translateX: entrance.x ? [0, entrance.x / 2] : undefined,
        duration: TIMING.tooltip.duration * 0.8,
        ease: EASING.anime.in,
        onComplete: () => setShouldRender(false),
      })
    }
  }, [visible, side, shouldRender])

  if (!shouldRender) return null

  return (
    <div
      ref={tooltipRef}
      className={`absolute z-50 pointer-events-none ${className}`}
      style={{
        ...getPositionStyles(side),
        maxWidth: GEOMETRY.tooltip.maxWidth,
        opacity: 0, // Initial state, anime.js handles the rest
      }}
    >
      <div
        style={{
          padding: '5px 10px',
          fontSize: TYPOGRAPHY.fontSize.xs,
          fontFamily: TYPOGRAPHY.fontFamily.mono,
          letterSpacing: '0.02em',
          backgroundColor: COLORS.neutral[900],
          border: `1px solid ${COLORS.neutral[800]}`,
          borderRadius: GEOMETRY.radius.sm,
          color: COLORS.neutral[400],
          whiteSpace: 'nowrap',
          // Matte shadow — subtle depth, not dramatic
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }}
      >
        {content ?? text}
      </div>
    </div>
  )
}

export default Tooltip
