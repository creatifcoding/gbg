/**
 * RVN Map Coordinates
 *
 * Monospace coordinates display for tactical maps.
 * Shows current position, grid reference, or cursor coordinates.
 *
 * @example
 * ```tsx
 * <RvnMapCoordinates lat={44.2} lng={12.9} />
 * ```
 */

import * as React from 'react'
import { RVN_FONTS, RVN_FONT_SIZES } from '../tokens/typography'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type CoordinateFormat = 'decimal' | 'dms' | 'grid' | 'custom'
type DisplayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface RvnMapCoordinatesProps {
  /** Latitude value */
  lat?: number
  /** Longitude value */
  lng?: number
  /** Grid X reference */
  gridX?: string | number
  /** Grid Y reference */
  gridY?: string | number
  /** Custom coordinate string */
  custom?: string
  /** Display format */
  format?: CoordinateFormat
  /** Label prefix */
  label?: string
  /** Position within container */
  position?: DisplayPosition
  /** Background style */
  variant?: 'solid' | 'transparent' | 'bordered'
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatDecimal(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

function formatDMS(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'

  const formatComponent = (value: number): string => {
    const abs = Math.abs(value)
    const deg = Math.floor(abs)
    const minFloat = (abs - deg) * 60
    const min = Math.floor(minFloat)
    const sec = ((minFloat - min) * 60).toFixed(1)
    return `${deg}°${min}'${sec}"`
  }

  return `${formatComponent(lat)}${latDir} ${formatComponent(lng)}${lngDir}`
}

function formatGrid(x: string | number, y: string | number): string {
  return `GRID: ${x} // ${y}`
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RVN Map Coordinates
 *
 * Tactical coordinates display with multiple format options.
 *
 * @example Decimal coordinates
 * ```tsx
 * <RvnMapCoordinates lat={44.2357} lng={12.9123} />
 * ```
 *
 * @example Grid reference
 * ```tsx
 * <RvnMapCoordinates gridX="44.2" gridY="12.9" format="grid" />
 * ```
 *
 * @example With label and position
 * ```tsx
 * <RvnMapCoordinates
 *   lat={44.2357}
 *   lng={12.9123}
 *   label="CURSOR"
 *   position="bottom-right"
 * />
 * ```
 *
 * @example Custom format
 * ```tsx
 * <RvnMapCoordinates custom="SECTOR_09-ALPHA // 1842.445" format="custom" />
 * ```
 */
export function RvnMapCoordinates({
  lat,
  lng,
  gridX,
  gridY,
  custom,
  format = 'decimal',
  label,
  position = 'bottom-left',
  variant = 'bordered',
  className,
  style,
}: RvnMapCoordinatesProps) {
  const getFormattedCoords = (): string => {
    switch (format) {
      case 'dms':
        if (lat !== undefined && lng !== undefined) {
          return formatDMS(lat, lng)
        }
        break
      case 'grid':
        if (gridX !== undefined && gridY !== undefined) {
          return formatGrid(gridX, gridY)
        }
        break
      case 'custom':
        return custom || ''
      default: // decimal
        if (lat !== undefined && lng !== undefined) {
          return formatDecimal(lat, lng)
        }
    }
    return '-- , --'
  }

  const getPositionStyles = (): React.CSSProperties => {
    const offset = '10px'
    switch (position) {
      case 'top-left':
        return { top: offset, left: offset }
      case 'top-right':
        return { top: offset, right: offset }
      case 'bottom-right':
        return { bottom: offset, right: offset }
      default: // bottom-left
        return { bottom: offset, left: offset }
    }
  }

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'solid':
        return {
          backgroundColor: '#000000',
          color: '#ffffff',
          border: 'none',
        }
      case 'transparent':
        return {
          backgroundColor: 'transparent',
          color: '#000000',
          border: 'none',
        }
      default: // bordered
        return {
          backgroundColor: '#ffffff',
          color: '#000000',
          border: '2px solid #000000',
        }
    }
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: 600,
    padding: '6px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    zIndex: 10,
    ...getPositionStyles(),
    ...getVariantStyles(),
    ...style,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: RVN_FONT_SIZES.caption,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  }

  const coordsStyle: React.CSSProperties = {
    fontWeight: 700,
    letterSpacing: '0.02em',
  }

  return (
    <div className={className} style={containerStyle} data-rvn-coordinates="" aria-label="Map coordinates">
      {label && <span style={labelStyle}>{label}</span>}
      <span style={coordsStyle}>{getFormattedCoords()}</span>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Display Name
// -----------------------------------------------------------------------------

RvnMapCoordinates.displayName = 'RvnMapCoordinates'

export type { RvnMapCoordinatesProps, CoordinateFormat, DisplayPosition }
