/**
 * Tooltip Component
 *
 * Renders a tooltip positioned relative to content.
 * Consumer controls visibility via hover state.
 */

import type { TooltippableData } from '../types'
import { COLORS, GEOMETRY, TYPOGRAPHY } from '../tokens'

export interface TooltipProps extends TooltippableData {
  visible: boolean
  className?: string
}

const POSITION_STYLES: Record<NonNullable<TooltippableData['side']>, React.CSSProperties> = {
  top: {
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: GEOMETRY.tooltip.offset,
  },
  bottom: {
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: GEOMETRY.tooltip.offset,
  },
  left: {
    right: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginRight: GEOMETRY.tooltip.offset,
  },
  right: {
    left: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginLeft: GEOMETRY.tooltip.offset,
  },
}

const ARROW_STYLES: Record<NonNullable<TooltippableData['side']>, React.CSSProperties> = {
  top: {
    bottom: -GEOMETRY.tooltip.arrowSize + 1,
    left: '50%',
    transform: 'translateX(-50%) rotate(45deg)',
    borderRight: `1px solid ${COLORS.neutral[700]}`,
    borderBottom: `1px solid ${COLORS.neutral[700]}`,
  },
  bottom: {
    top: -GEOMETRY.tooltip.arrowSize + 1,
    left: '50%',
    transform: 'translateX(-50%) rotate(45deg)',
    borderLeft: `1px solid ${COLORS.neutral[700]}`,
    borderTop: `1px solid ${COLORS.neutral[700]}`,
  },
  left: {
    right: -GEOMETRY.tooltip.arrowSize + 1,
    top: '50%',
    transform: 'translateY(-50%) rotate(45deg)',
    borderRight: `1px solid ${COLORS.neutral[700]}`,
    borderTop: `1px solid ${COLORS.neutral[700]}`,
  },
  right: {
    left: -GEOMETRY.tooltip.arrowSize + 1,
    top: '50%',
    transform: 'translateY(-50%) rotate(45deg)',
    borderLeft: `1px solid ${COLORS.neutral[700]}`,
    borderBottom: `1px solid ${COLORS.neutral[700]}`,
  },
}

export function Tooltip({
  text,
  content,
  side = 'top',
  visible,
  className = '',
}: TooltipProps) {
  if (!visible) return null

  return (
    <div
      className={`absolute z-50 pointer-events-none ${className}`}
      style={{
        ...POSITION_STYLES[side],
        maxWidth: GEOMETRY.tooltip.maxWidth,
      }}
    >
      <div
        style={{
          padding: '4px 8px',
          fontSize: TYPOGRAPHY.fontSize.xs,
          fontFamily: TYPOGRAPHY.fontFamily.mono,
          backgroundColor: COLORS.neutral[900],
          border: `1px solid ${COLORS.neutral[700]}`,
          borderRadius: GEOMETRY.radius.md,
          color: COLORS.neutral[300],
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        }}
      >
        {content ?? text}

        {/* Arrow */}
        <div
          style={{
            position: 'absolute',
            width: GEOMETRY.tooltip.arrowSize,
            height: GEOMETRY.tooltip.arrowSize,
            backgroundColor: COLORS.neutral[900],
            ...ARROW_STYLES[side],
          }}
        />
      </div>
    </div>
  )
}

export default Tooltip
