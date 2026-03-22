/**
 * RVN Map Marker
 *
 * Standard circular marker for tactical maps.
 * 20px black circle with white center dot.
 *
 * @example
 * ```tsx
 * <RvnMapMarker position={{ x: '50%', y: '30%' }} label="ALPHA" />
 * ```
 */

import * as React from 'react'
import { RVN_FONTS, RVN_FONT_SIZES } from '../tokens/typography'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MarkerPosition {
  /** X position (CSS value or percentage) */
  x: string | number
  /** Y position (CSS value or percentage) */
  y: string | number
}

interface RvnMapMarkerProps {
  /** Position on the map */
  position: MarkerPosition
  /** Optional label shown next to marker */
  label?: string
  /** Marker size in pixels */
  size?: number
  /** Whether marker is selected/active */
  active?: boolean
  /** Click handler */
  onClick?: () => void
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
  /** Tooltip text */
  title?: string
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RVN Map Marker
 *
 * Standard tactical map marker - black circle with white center.
 *
 * @example Basic marker
 * ```tsx
 * <RvnMapMarker position={{ x: '45%', y: '35%' }} />
 * ```
 *
 * @example With label
 * ```tsx
 * <RvnMapMarker
 *   position={{ x: '45%', y: '35%' }}
 *   label="PRIMARY_ARRAY"
 * />
 * ```
 *
 * @example Active/selected state
 * ```tsx
 * <RvnMapMarker
 *   position={{ x: '45%', y: '35%' }}
 *   active
 *   onClick={() => selectMarker()}
 * />
 * ```
 */
export function RvnMapMarker({
  position,
  label,
  size = 40,
  active = false,
  onClick,
  className,
  style,
  title,
}: RvnMapMarkerProps) {
  const centerDotSize = Math.max(size * 0.25, 8)
  const borderWidth = Math.max(size * 0.075, 3)

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: typeof position.x === 'number' ? `${position.x}px` : position.x,
    top: typeof position.y === 'number' ? `${position.y}px` : position.y,
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  }

  const circleStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    border: `${borderWidth}px solid #000000`,
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.1s, border-width 0.1s',
    ...(active && {
      borderWidth: `${borderWidth + 1}px`,
    }),
  }

  const dotStyle: React.CSSProperties = {
    width: `${centerDotSize}px`,
    height: `${centerDotSize}px`,
    backgroundColor: '#000000',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: 900,
    backgroundColor: '#ffffff',
    padding: '2px 6px',
    border: '1px solid #000000',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
  }

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={onClick}
      title={title}
      data-rvn-marker=""
      data-active={active ? '' : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div style={circleStyle}>
        <div style={dotStyle} />
      </div>
      {label && <span style={labelStyle}>{label}</span>}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Display Name
// -----------------------------------------------------------------------------

RvnMapMarker.displayName = 'RvnMapMarker'

export type { RvnMapMarkerProps, MarkerPosition }
