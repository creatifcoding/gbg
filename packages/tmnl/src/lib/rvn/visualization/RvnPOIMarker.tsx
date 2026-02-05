/**
 * RVN POI Marker
 *
 * Point of Interest marker with brutalist icon styling.
 * Square shape with category-specific icon.
 *
 * @example
 * ```tsx
 * <RvnPOIMarker category="food" position={{ x: 100, y: 200 }} />
 * ```
 */

import * as React from 'react'
import { RVN_FONTS, RVN_FONT_SIZES } from '../tokens/typography'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type POICategory = 'food' | 'gas' | 'hospital' | 'parking' | 'hotel' | 'generic'

interface POIPosition {
  /** X position in screen coordinates (pixels) */
  x: number
  /** Y position in screen coordinates (pixels) */
  y: number
}

interface RvnPOIMarkerProps {
  /** POI category determining the icon */
  category: POICategory
  /** Position on the map (screen coordinates) */
  position: POIPosition
  /** Optional label shown below marker */
  label?: string
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
// Constants
// -----------------------------------------------------------------------------

const POI_ICONS: Record<POICategory, string> = {
  food: '\u25C6',     // Black diamond
  gas: '\u26FD',      // Fuel pump
  hospital: '+',      // Plus sign
  parking: 'P',       // Letter P
  hotel: 'H',         // Letter H
  generic: '\u25CF',  // Black circle
}

const POI_ARIA_LABELS: Record<POICategory, string> = {
  food: 'Food',
  gas: 'Gas station',
  hospital: 'Hospital',
  parking: 'Parking',
  hotel: 'Hotel',
  generic: 'Point of interest',
}

const MARKER_SIZE = 20

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RVN POI Marker
 *
 * Brutalist point of interest marker with category icons.
 * 20x20 black square with white icon, optional label below.
 *
 * @example Basic marker
 * ```tsx
 * <RvnPOIMarker category="gas" position={{ x: 150, y: 75 }} />
 * ```
 *
 * @example With label
 * ```tsx
 * <RvnPOIMarker
 *   category="hospital"
 *   position={{ x: 200, y: 100 }}
 *   label="MEDICAL_CENTER"
 * />
 * ```
 *
 * @example Clickable marker
 * ```tsx
 * <RvnPOIMarker
 *   category="food"
 *   position={{ x: 50, y: 30 }}
 *   onClick={() => showDetails('restaurant')}
 *   title="Click for details"
 * />
 * ```
 */
export function RvnPOIMarker({
  category,
  position,
  label,
  onClick,
  className,
  style,
  title,
}: RvnPOIMarkerProps) {
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    cursor: onClick ? 'pointer' : 'default',
    zIndex: 6,
    ...style,
  }

  const markerStyle: React.CSSProperties = {
    width: `${MARKER_SIZE}px`,
    height: `${MARKER_SIZE}px`,
    backgroundColor: '#000000',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: RVN_FONTS.mono,
    fontSize: category === 'gas' ? '12px' : '14px',
    fontWeight: 700,
    lineHeight: 1,
    transition: 'transform 0.1s',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.caption, // 10px - exception for map labels
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#000000',
    backgroundColor: '#ffffff',
    padding: '1px 4px',
    border: '1px solid #000000',
    whiteSpace: 'nowrap',
  }

  const ariaLabel = `${POI_ARIA_LABELS[category]}${label ? `: ${label}` : ''}`

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={onClick}
      title={title}
      data-rvn-poi-marker=""
      data-poi-category={category}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <div style={markerStyle}>
        {POI_ICONS[category]}
      </div>
      {label && <span style={labelStyle}>{label}</span>}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Display Name
// -----------------------------------------------------------------------------

RvnPOIMarker.displayName = 'RvnPOIMarker'

export type { RvnPOIMarkerProps, POIPosition, POICategory }
