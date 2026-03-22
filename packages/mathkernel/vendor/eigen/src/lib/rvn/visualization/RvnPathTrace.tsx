/**
 * RVN Path Trace
 *
 * SVG-based path visualization for movement routes, patrol paths, etc.
 *
 * @example
 * ```tsx
 * <RvnPathTrace
 *   points={[
 *     { x: 100, y: 100 },
 *     { x: 200, y: 150 },
 *     { x: 300, y: 100 },
 *   ]}
 *   animated
 * />
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PathPoint {
  /** X coordinate in pixels */
  x: number
  /** Y coordinate in pixels */
  y: number
}

type PathStyle = 'solid' | 'dashed' | 'dotted' | 'projected'

interface RvnPathTraceProps {
  /** Array of points defining the path */
  points: PathPoint[]
  /** Visual style of the path */
  pathStyle?: PathStyle
  /** Stroke width */
  strokeWidth?: number
  /** Stroke color */
  color?: string
  /** Animate the path drawing */
  animated?: boolean
  /** Animation duration in ms */
  animationDuration?: number
  /** Show direction arrows */
  showArrows?: boolean
  /** Show waypoint dots */
  showWaypoints?: boolean
  /** Additional class name */
  className?: string
  /** Additional styles for container */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function pointsToPathD(points: PathPoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  return points.reduce((d, point, index) => {
    const command = index === 0 ? 'M' : 'L'
    return `${d} ${command} ${point.x} ${point.y}`
  }, '')
}

function getStrokeDashArray(style: PathStyle): string {
  switch (style) {
    case 'dashed':
      return '10 5'
    case 'dotted':
      return '3 3'
    case 'projected':
      return '15 5 5 5'
    default:
      return 'none'
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RVN Path Trace
 *
 * SVG path for tactical movement routes.
 *
 * @example Basic path
 * ```tsx
 * <RvnPathTrace
 *   points={[
 *     { x: 50, y: 50 },
 *     { x: 150, y: 100 },
 *     { x: 250, y: 75 },
 *   ]}
 * />
 * ```
 *
 * @example Animated patrol route
 * ```tsx
 * <RvnPathTrace
 *   points={patrolPoints}
 *   pathStyle="dashed"
 *   animated
 *   showWaypoints
 * />
 * ```
 *
 * @example Projected path
 * ```tsx
 * <RvnPathTrace
 *   points={projectedPath}
 *   pathStyle="projected"
 *   color="#666666"
 *   showArrows
 * />
 * ```
 */
export function RvnPathTrace({
  points,
  pathStyle = 'solid',
  strokeWidth = 2,
  color = '#000000',
  animated = false,
  animationDuration = 2000,
  showArrows = false,
  showWaypoints = false,
  className,
  style,
}: RvnPathTraceProps) {
  const pathRef = React.useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = React.useState(0)

  React.useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength())
    }
  }, [points])

  if (points.length < 2) {
    return null
  }

  const pathD = pointsToPathD(points)
  const dashArray = getStrokeDashArray(pathStyle)
  const arrowId = React.useId()

  const animationStyle: React.CSSProperties = animated
    ? {
        strokeDasharray: pathLength,
        strokeDashoffset: pathLength,
        animation: `rvn-path-draw ${animationDuration}ms ease-out forwards`,
      }
    : {}

  return (
    <svg
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        ...style,
      }}
      data-rvn-path=""
    >
      {/* Animation keyframes */}
      {animated && (
        <style>
          {`
            @keyframes rvn-path-draw {
              to {
                stroke-dashoffset: 0;
              }
            }
          `}
        </style>
      )}

      {/* Arrow marker definition */}
      {showArrows && (
        <defs>
          <marker
            id={arrowId}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill={color} />
          </marker>
        </defs>
      )}

      {/* Main path */}
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray !== 'none' ? dashArray : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={showArrows ? `url(#${arrowId})` : undefined}
        style={animationStyle}
      />

      {/* Waypoint dots */}
      {showWaypoints &&
        points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={strokeWidth * 2}
            fill={index === 0 || index === points.length - 1 ? color : '#ffffff'}
            stroke={color}
            strokeWidth={strokeWidth / 2}
          />
        ))}
    </svg>
  )
}

// -----------------------------------------------------------------------------
// Display Name
// -----------------------------------------------------------------------------

RvnPathTrace.displayName = 'RvnPathTrace'

export type { RvnPathTraceProps, PathPoint, PathStyle }
