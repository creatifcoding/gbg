/**
 * Chip Primitive
 *
 * Small badge/tag for flags and labels.
 *
 * @module file-browser/primitives
 */

import { memo } from 'react'

import { DARK_SIDE } from '../tokens'

// =============================================================================
// Types
// =============================================================================

export type ChipColor = 'gray' | 'green' | 'red' | 'blue' | 'amber'

export interface ChipProps {
  /** Label text */
  label: string
  /** Color variant */
  color?: ChipColor
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Color Mappings
// =============================================================================

const COLOR_STYLES: Record<ChipColor, { border: string; text: string; bg: string }> = {
  gray: {
    border: DARK_SIDE.colors.border.default,
    text: DARK_SIDE.colors.text.tertiary,
    bg: 'transparent',
  },
  green: {
    border: DARK_SIDE.colors.accent.greenMuted,
    text: DARK_SIDE.colors.accent.green,
    bg: 'rgba(0, 255, 65, 0.1)',
  },
  red: {
    border: DARK_SIDE.colors.accent.redMuted,
    text: DARK_SIDE.colors.accent.red,
    bg: 'rgba(255, 68, 68, 0.1)',
  },
  blue: {
    border: DARK_SIDE.colors.accent.cyanMuted,
    text: DARK_SIDE.colors.accent.cyan,
    bg: 'rgba(0, 255, 255, 0.1)',
  },
  amber: {
    border: DARK_SIDE.colors.accent.amberMuted,
    text: DARK_SIDE.colors.accent.amber,
    bg: 'rgba(255, 170, 0, 0.1)',
  },
}

// =============================================================================
// Component
// =============================================================================

export const Chip = memo(function Chip({
  label,
  color = 'gray',
  className = '',
}: ChipProps) {
  const styles = COLOR_STYLES[color]

  return (
    <span
      className={`chip ${className}`}
      style={{
        display: 'inline-block',
        fontSize: '9px', // Exception to 12px floor for ultra-compact badges
        padding: `${DARK_SIDE.spacing['0.5']} ${DARK_SIDE.spacing['1.5']}`,
        border: `1px solid ${styles.border}`,
        backgroundColor: styles.bg,
        color: styles.text,
        textTransform: 'uppercase',
        letterSpacing: DARK_SIDE.typography.letterSpacing.wider,
        marginRight: DARK_SIDE.spacing['1'],
        marginBottom: DARK_SIDE.spacing['1'],
        fontFamily: DARK_SIDE.typography.family.mono,
      }}
    >
      {label}
    </span>
  )
})
