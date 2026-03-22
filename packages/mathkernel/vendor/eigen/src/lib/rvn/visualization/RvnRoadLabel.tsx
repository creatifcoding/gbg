/**
 * RVN Road Label
 *
 * Road name label following path direction.
 * Renders along SVG path or as simple positioned/rotated text.
 *
 * @example
 * ```tsx
 * <RvnRoadLabel name="MAIN_ST" position={{ x: 100, y: 200 }} angle={15} />
 * ```
 */

import * as React from 'react'
import { RVN_FONTS, RVN_FONT_SIZES } from '../tokens/typography'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PathPoint {
  /** X coordinate */
  x: number
  /** Y coordinate */
  y: number
}

interface RvnRoadLabelProps {
  /** Road name to display */
  name: string
  /** Points defining the path for curved rendering */
  path?: PathPoint[]
  /** Position for simple label (screen coordinates) */
  position?: PathPoint
  /** Rotation angle in degrees for simple label */
  angle?: number
  /** Whether to show white outline for contrast */
  outline?: boolean
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Generate SVG path string from points
 */
function pointsToPath(points: PathPoint[]): string {
  if (points.length < 2) return ''

  const [first, ...rest] = points
  let d = `M ${first.x} ${first.y}`

  for (const point of rest) {
    d += ` L ${point.x} ${point.y}`
  }

  return d
}

/**
 * Calculate path length for textPath offset
 */
function calculatePathLength(points: PathPoint[]): number {
  let length = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    length += Math.sqrt(dx * dx + dy * dy)
  }
  return length
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RVN Road Label
 *
 * Brutalist road name label with two rendering modes:
 * - Path mode: text follows an SVG path for curved roads
 * - Simple mode: positioned and rotated text for straight roads
 *
 * @example Simple positioned label
 * ```tsx
 * <RvnRoadLabel name="HIGHWAY_1" position={{ x: 150, y: 75 }} />
 * ```
 *
 * @example Rotated label
 * ```tsx
 * <RvnRoadLabel
 *   name="DIAGONAL_AVE"
 *   position={{ x: 200, y: 100 }}
 *   angle={45}
 * />
 * ```
 *
 * @example Path-following label
 * ```tsx
 * <RvnRoadLabel
 *   name="CURVED_RD"
 *   path={[
 *     { x: 50, y: 100 },
 *     { x: 100, y: 80 },
 *     { x: 150, y: 90 },
 *     { x: 200, y: 75 },
 *   ]}
 * />
 * ```
 *
 * @example With outline for dark backgrounds
 * ```tsx
 * <RvnRoadLabel
 *   name="DARK_AREA_RD"
 *   position={{ x: 100, y: 50 }}
 *   outline
 * />
 * ```
 */
export function RvnRoadLabel({
  name,
  path,
  position,
  angle = 0,
  outline = false,
  className,
  style,
}: RvnRoadLabelProps) {
  // Generate unique ID for SVG path reference
  const pathId = React.useId()

  const textStyle: React.CSSProperties = {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.caption, // 10px - exception for road labels
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fill: '#000000',
    pointerEvents: 'none',
    userSelect: 'none',
  }

  const outlineStyle: React.CSSProperties = {
    ...textStyle,
    stroke: '#ffffff',
    strokeWidth: 3,
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
  }

  // Path mode: render text along SVG path
  if (path && path.length >= 2) {
    const pathD = pointsToPath(path)
    const pathLength = calculatePathLength(path)

    // Calculate bounding box for SVG viewport
    const minX = Math.min(...path.map((p) => p.x)) - 20
    const minY = Math.min(...path.map((p) => p.y)) - 20
    const maxX = Math.max(...path.map((p) => p.x)) + 20
    const maxY = Math.max(...path.map((p) => p.y)) + 20
    const width = maxX - minX
    const height = maxY - minY

    return (
      <svg
        className={className}
        style={{
          position: 'absolute',
          left: `${minX}px`,
          top: `${minY}px`,
          width: `${width}px`,
          height: `${height}px`,
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 4,
          ...style,
        }}
        data-rvn-road-label=""
        aria-label={`Road: ${name}`}
      >
        <defs>
          <path
            id={pathId}
            d={pathD}
            fill="none"
            transform={`translate(${-minX}, ${-minY})`}
          />
        </defs>

        {/* Outline for contrast */}
        {outline && (
          <text style={outlineStyle}>
            <textPath
              href={`#${pathId}`}
              startOffset="50%"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {name}
            </textPath>
          </text>
        )}

        {/* Main text */}
        <text style={textStyle}>
          <textPath
            href={`#${pathId}`}
            startOffset="50%"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {name}
          </textPath>
        </text>
      </svg>
    )
  }

  // Simple mode: positioned and rotated text
  if (position) {
    const containerStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${position.x}px`,
      top: `${position.y}px`,
      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
      fontFamily: RVN_FONTS.mono,
      fontSize: RVN_FONT_SIZES.caption, // 10px
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: '#000000',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 4,
      ...(outline && {
        textShadow: `-1px -1px 0 #ffffff,
                      1px -1px 0 #ffffff,
                     -1px  1px 0 #ffffff,
                      1px  1px 0 #ffffff`,
      }),
      ...style,
    }

    return (
      <span
        className={className}
        style={containerStyle}
        data-rvn-road-label=""
        aria-label={`Road: ${name}`}
      >
        {name}
      </span>
    )
  }

  // Neither path nor position provided
  return null
}

// -----------------------------------------------------------------------------
// Display Name
// -----------------------------------------------------------------------------

RvnRoadLabel.displayName = 'RvnRoadLabel'

export type { RvnRoadLabelProps, PathPoint }
