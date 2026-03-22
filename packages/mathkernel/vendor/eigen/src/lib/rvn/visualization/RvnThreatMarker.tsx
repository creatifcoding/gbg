/**
 * RVN Threat Marker
 *
 * Square marker for hostile/threat indicators on tactical maps.
 * Black square with white letter designation (T1, T2, etc).
 *
 * @example
 * ```tsx
 * <RvnThreatMarker position={{ x: '50%', y: '20%' }} designation="T1" />
 * ```
 */

import * as React from 'react'
import { RVN_FONTS, RVN_FONT_SIZES } from '../tokens/typography'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ThreatPosition {
  /** X position (CSS value or percentage) */
  x: string | number
  /** Y position (CSS value or percentage) */
  y: string | number
}

type ThreatLevel = 'low' | 'medium' | 'high' | 'critical'

interface RvnThreatMarkerProps {
  /** Position on the map */
  position: ThreatPosition
  /** Threat designation (e.g., "T1", "T2", "H3") */
  designation: string
  /** Marker size in pixels */
  size?: number
  /** Threat level affects visual treatment */
  level?: ThreatLevel
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
 * RVN Threat Marker
 *
 * Square tactical marker for hostile units.
 *
 * @example Basic threat marker
 * ```tsx
 * <RvnThreatMarker
 *   position={{ x: '50%', y: '20%' }}
 *   designation="T1"
 * />
 * ```
 *
 * @example Critical threat
 * ```tsx
 * <RvnThreatMarker
 *   position={{ x: '80%', y: '40%' }}
 *   designation="H1"
 *   level="critical"
 * />
 * ```
 *
 * @example Clickable threat
 * ```tsx
 * <RvnThreatMarker
 *   position={{ x: '60%', y: '30%' }}
 *   designation="T3"
 *   onClick={() => showThreatDetails('T3')}
 * />
 * ```
 */
export function RvnThreatMarker({
  position,
  designation,
  size = 20,
  level = 'medium',
  onClick,
  className,
  style,
  title,
}: RvnThreatMarkerProps) {
  const fontSize = Math.max(size * 0.5, 10)

  const getBackgroundStyle = (): React.CSSProperties => {
    switch (level) {
      case 'critical':
        // Diagonal stripe pattern for critical threats
        return {
          background: 'repeating-linear-gradient(45deg, #000000, #000000 3px, #ffffff 3px, #ffffff 6px)',
          color: '#000000',
        }
      case 'high':
        return {
          backgroundColor: '#000000',
          color: '#ffffff',
        }
      case 'low':
        return {
          backgroundColor: '#ffffff',
          color: '#000000',
          border: '2px solid #000000',
        }
      default: // medium
        return {
          backgroundColor: '#000000',
          color: '#ffffff',
        }
    }
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: typeof position.x === 'number' ? `${position.x}px` : position.x,
    top: typeof position.y === 'number' ? `${position.y}px` : position.y,
    transform: 'translate(-50%, -50%)',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  }

  const markerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: RVN_FONTS.mono,
    fontSize: `${fontSize}px`,
    fontWeight: 900,
    textTransform: 'uppercase',
    ...getBackgroundStyle(),
  }

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={onClick}
      title={title || `Threat: ${designation}`}
      data-rvn-threat=""
      data-level={level}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div style={markerStyle}>{designation}</div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Display Name
// -----------------------------------------------------------------------------

RvnThreatMarker.displayName = 'RvnThreatMarker'

export type { RvnThreatMarkerProps, ThreatPosition, ThreatLevel }
