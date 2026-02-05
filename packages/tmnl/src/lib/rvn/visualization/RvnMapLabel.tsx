/**
 * RVN Map Label
 *
 * Brutalist map label for place names.
 * Positioned absolutely over Mapbox canvas with monospace uppercase styling.
 *
 * @example
 * ```tsx
 * <RvnMapLabel text="SECTOR_ALPHA" position={{ x: 100, y: 200 }} />
 * ```
 */

import * as React from 'react'
import { RVN_FONTS, RVN_FONT_SIZES } from '../tokens/typography'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type LabelSize = 'sm' | 'md' | 'lg'

interface LabelPosition {
  /** X position in screen coordinates (pixels) */
  x: number
  /** Y position in screen coordinates (pixels) */
  y: number
}

interface RvnMapLabelProps {
  /** Label text content */
  text: string
  /** Position on the map (screen coordinates) */
  position: LabelPosition
  /** Text size variant */
  size?: LabelSize
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LABEL_SIZES: Record<LabelSize, string> = {
  sm: RVN_FONT_SIZES.caption, // 10px - exception for map labels
  md: RVN_FONT_SIZES.label,   // 12px - THE FLOOR for normal text
  lg: RVN_FONT_SIZES.dataSm,  // 14px
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RVN Map Label
 *
 * Brutalist place name label for tactical maps.
 * Monospace, uppercase, black text on white background with border.
 *
 * @example Basic label
 * ```tsx
 * <RvnMapLabel text="WAYPOINT" position={{ x: 150, y: 75 }} />
 * ```
 *
 * @example Large label
 * ```tsx
 * <RvnMapLabel text="BASE_ALPHA" position={{ x: 200, y: 100 }} size="lg" />
 * ```
 *
 * @example Small label (for dense areas)
 * ```tsx
 * <RvnMapLabel text="PT_01" position={{ x: 50, y: 30 }} size="sm" />
 * ```
 */
export function RvnMapLabel({
  text,
  position,
  size = 'md',
  className,
  style,
}: RvnMapLabelProps) {
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: 'translate(-50%, -50%)',
    fontFamily: RVN_FONTS.mono,
    fontSize: LABEL_SIZES[size],
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#000000',
    backgroundColor: '#ffffff',
    padding: '2px 6px',
    border: '1px solid #000000',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: 5,
    ...style,
  }

  return (
    <span
      className={className}
      style={containerStyle}
      data-rvn-map-label=""
      aria-label={`Map label: ${text}`}
    >
      {text}
    </span>
  )
}

// -----------------------------------------------------------------------------
// Display Name
// -----------------------------------------------------------------------------

RvnMapLabel.displayName = 'RvnMapLabel'

export type { RvnMapLabelProps, LabelPosition, LabelSize }
