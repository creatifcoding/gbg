/**
 * RVN Crosshair Corners
 *
 * Tactical frame corner decorations - the signature brutalist map frame element.
 * Creates L-shaped corners at each corner of a container.
 *
 * @example
 * ```tsx
 * <div style={{ position: 'relative' }}>
 *   <RvnCrosshairCorners />
 *   <MapContent />
 * </div>
 * ```
 */

import * as React from 'react'
import { RVN_CROSSHAIR } from '../tokens/borders'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

interface RvnCrosshairCornerProps {
  /** Which corner to render */
  position: CornerPosition
  /** Size of the crosshair arm */
  size?: string
  /** Thickness of the lines */
  thickness?: string
  /** Color of the lines */
  color?: string
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
}

interface RvnCrosshairCornersProps {
  /** Which corners to render (default: all) */
  corners?: CornerPosition[]
  /** Size of crosshair arms */
  size?: string
  /** Thickness of lines */
  thickness?: string
  /** Color of lines */
  color?: string
  /** Inset from container edges */
  inset?: string
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Single Corner Component
// -----------------------------------------------------------------------------

function RvnCrosshairCorner({
  position,
  size = RVN_CROSSHAIR.size,
  thickness = RVN_CROSSHAIR.thickness,
  color = RVN_CROSSHAIR.color,
  className,
  style,
}: RvnCrosshairCornerProps) {
  const getBorderStyles = (): React.CSSProperties => {
    const border = `${thickness} solid ${color}`

    switch (position) {
      case 'topLeft':
        return {
          borderTop: border,
          borderLeft: border,
        }
      case 'topRight':
        return {
          borderTop: border,
          borderRight: border,
        }
      case 'bottomLeft':
        return {
          borderBottom: border,
          borderLeft: border,
        }
      case 'bottomRight':
        return {
          borderBottom: border,
          borderRight: border,
        }
    }
  }

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case 'topLeft':
        return { top: 0, left: 0 }
      case 'topRight':
        return { top: 0, right: 0 }
      case 'bottomLeft':
        return { bottom: 0, left: 0 }
      case 'bottomRight':
        return { bottom: 0, right: 0 }
    }
  }

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        pointerEvents: 'none',
        ...getPositionStyles(),
        ...getBorderStyles(),
        ...style,
      }}
      data-rvn-crosshair={position}
      aria-hidden="true"
    />
  )
}

// -----------------------------------------------------------------------------
// All Corners Component
// -----------------------------------------------------------------------------

const ALL_CORNERS: CornerPosition[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']

/**
 * RVN Crosshair Corners
 *
 * Renders L-shaped corner decorations for tactical map frames.
 * Place inside a positioned container.
 *
 * @example All corners (default)
 * ```tsx
 * <RvnCrosshairCorners />
 * ```
 *
 * @example Specific corners only
 * ```tsx
 * <RvnCrosshairCorners corners={['topLeft', 'bottomRight']} />
 * ```
 *
 * @example Custom styling
 * ```tsx
 * <RvnCrosshairCorners
 *   size="30px"
 *   thickness="3px"
 *   color="#ff0000"
 * />
 * ```
 */
export function RvnCrosshairCorners({
  corners = ALL_CORNERS,
  size = RVN_CROSSHAIR.size,
  thickness = RVN_CROSSHAIR.thickness,
  color = RVN_CROSSHAIR.color,
  inset = '0px',
  className,
  style,
}: RvnCrosshairCornersProps) {
  return (
    <>
      {corners.map((position) => (
        <RvnCrosshairCorner
          key={position}
          position={position}
          size={size}
          thickness={thickness}
          color={color}
          className={className}
          style={{
            ...style,
            ...(inset !== '0px' && position === 'topLeft' && { top: inset, left: inset }),
            ...(inset !== '0px' && position === 'topRight' && { top: inset, right: inset }),
            ...(inset !== '0px' && position === 'bottomLeft' && { bottom: inset, left: inset }),
            ...(inset !== '0px' && position === 'bottomRight' && { bottom: inset, right: inset }),
          }}
        />
      ))}
    </>
  )
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

RvnCrosshairCorner.displayName = 'RvnCrosshairCorner'
RvnCrosshairCorners.displayName = 'RvnCrosshairCorners'
RvnCrosshairCorners.Corner = RvnCrosshairCorner

export { RvnCrosshairCorner }
export type { RvnCrosshairCornerProps, RvnCrosshairCornersProps, CornerPosition }
