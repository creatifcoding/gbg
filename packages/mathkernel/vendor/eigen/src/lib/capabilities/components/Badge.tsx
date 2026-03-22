/**
 * Badge Component
 *
 * Renders a corner badge indicator.
 */

import type { BadgeableData } from '../types'
import { COLORS, GEOMETRY, TYPOGRAPHY } from '../tokens'

export interface BadgeProps extends BadgeableData {
  className?: string
}

const POSITION_STYLES: Record<NonNullable<BadgeableData['position']>, React.CSSProperties> = {
  'top-right': {
    top: GEOMETRY.badge.offsetY,
    right: GEOMETRY.badge.offsetX,
  },
  'top-left': {
    top: GEOMETRY.badge.offsetY,
    left: GEOMETRY.badge.offsetX,
  },
  'bottom-right': {
    bottom: GEOMETRY.badge.offsetY,
    right: GEOMETRY.badge.offsetX,
  },
  'bottom-left': {
    bottom: GEOMETRY.badge.offsetY,
    left: GEOMETRY.badge.offsetX,
  },
}

export function Badge({
  text,
  color = 'cyan',
  position = 'top-right',
  dot,
  className = '',
}: BadgeProps) {
  const colorValues = COLORS.accent[color]

  if (dot) {
    return (
      <div
        className={`absolute pointer-events-none ${className}`}
        style={{
          ...POSITION_STYLES[position],
          width: 8,
          height: 8,
          borderRadius: GEOMETRY.radius.full,
          backgroundColor: colorValues.base,
          boxShadow: `0 0 4px 1px ${colorValues.glow}`,
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
        padding: '1px 4px',
        fontSize: TYPOGRAPHY.fontSize.xxs,
        fontFamily: TYPOGRAPHY.fontFamily.mono,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        textTransform: 'uppercase',
        backgroundColor: colorValues.muted,
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
