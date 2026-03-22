/**
 * RVN Deployment Zone
 *
 * Dashed border polygon indicating deployment/operational areas on tactical maps.
 *
 * @example
 * ```tsx
 * <RvnDeploymentZone
 *   position={{ x: '10%', y: '70%' }}
 *   size={{ width: '150px', height: '100px' }}
 *   label="DZ_ALPHA"
 * />
 * ```
 */

import * as React from 'react'
import { RVN_FONTS, RVN_FONT_SIZES } from '../tokens/typography'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ZonePosition {
  /** X position (CSS value or percentage) */
  x: string | number
  /** Y position (CSS value or percentage) */
  y: string | number
}

interface ZoneSize {
  /** Width of the zone */
  width: string | number
  /** Height of the zone */
  height: string | number
}

type ZoneStatus = 'available' | 'occupied' | 'contested' | 'restricted'

interface RvnDeploymentZoneProps {
  /** Position on the map */
  position: ZonePosition
  /** Size of the zone */
  size: ZoneSize
  /** Zone designation label */
  label?: string
  /** Zone status affects styling */
  status?: ZoneStatus
  /** Border dash pattern */
  dashPattern?: string
  /** Click handler */
  onClick?: () => void
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
  /** Child elements to render inside zone */
  children?: React.ReactNode
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RVN Deployment Zone
 *
 * Dashed rectangular zone for tactical map areas.
 *
 * @example Basic zone
 * ```tsx
 * <RvnDeploymentZone
 *   position={{ x: '10%', y: '70%' }}
 *   size={{ width: '150px', height: '100px' }}
 *   label="DZ_ALPHA"
 * />
 * ```
 *
 * @example Occupied zone
 * ```tsx
 * <RvnDeploymentZone
 *   position={{ x: '50%', y: '50%' }}
 *   size={{ width: '200px', height: '150px' }}
 *   label="SECTOR_BRAVO"
 *   status="occupied"
 * />
 * ```
 *
 * @example With custom content
 * ```tsx
 * <RvnDeploymentZone
 *   position={{ x: '20%', y: '30%' }}
 *   size={{ width: '180px', height: '120px' }}
 * >
 *   <RvnMapMarker position={{ x: '50%', y: '50%' }} />
 * </RvnDeploymentZone>
 * ```
 */
export function RvnDeploymentZone({
  position,
  size,
  label,
  status = 'available',
  dashPattern = '8 4',
  onClick,
  className,
  style,
  children,
}: RvnDeploymentZoneProps) {
  const getStatusStyles = (): React.CSSProperties => {
    switch (status) {
      case 'occupied':
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderColor: '#000000',
        }
      case 'contested':
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          borderColor: '#000000',
          // Could add animation here via CSS class
        }
      case 'restricted':
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.15)',
          borderColor: '#000000',
          // Diagonal stripes pattern
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.1) 5px, rgba(0,0,0,0.1) 10px)',
        }
      default: // available
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          borderColor: '#000000',
        }
    }
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: typeof position.x === 'number' ? `${position.x}px` : position.x,
    top: typeof position.y === 'number' ? `${position.y}px` : position.y,
    width: typeof size.width === 'number' ? `${size.width}px` : size.width,
    height: typeof size.height === 'number' ? `${size.height}px` : size.height,
    border: '2px dashed #000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: onClick ? 'pointer' : 'default',
    ...getStatusStyles(),
    ...style,
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.caption,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    opacity: 0.8,
    userSelect: 'none',
  }

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={onClick}
      data-rvn-zone=""
      data-status={status}
      role={onClick ? 'button' : 'region'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={label || 'Deployment zone'}
    >
      {children}
      {label && !children && <span style={labelStyle}>{label}</span>}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Display Name
// -----------------------------------------------------------------------------

RvnDeploymentZone.displayName = 'RvnDeploymentZone'

export type { RvnDeploymentZoneProps, ZonePosition, ZoneSize, ZoneStatus }
