/**
 * Minimap - Navigation Overview Component
 *
 * Provides a birds-eye view of the map with:
 * - Viewport bounds indicator
 * - Click-to-navigate functionality
 * - Layer activity indicators
 * - Zoom level display
 *
 * Uses Canvas API for efficient rendering and anime.js for animations.
 *
 * @module geoint/components/Minimap
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  memo,
  type FC,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { animate } from 'animejs'
import {
  Maximize2,
  Minimize2,
  Compass,
  ZoomIn,
  ZoomOut,
  Move,
  Navigation,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING, SOURCE_COLORS } from '../tokens'
import type { IntelSource } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export interface MinimapViewport {
  /** Center longitude */
  longitude: number
  /** Center latitude */
  latitude: number
  /** Zoom level */
  zoom: number
  /** Map bearing in degrees */
  bearing?: number
  /** Map pitch in degrees */
  pitch?: number
}

export interface MinimapBounds {
  /** North latitude */
  north: number
  /** South latitude */
  south: number
  /** East longitude */
  east: number
  /** West longitude */
  west: number
}

export interface MinimapEntity {
  /** Unique identifier */
  id: string
  /** Longitude */
  longitude: number
  /** Latitude */
  latitude: number
  /** Intel source for color coding */
  source: IntelSource
  /** Optional size multiplier */
  size?: number
}

export interface MinimapProps {
  /** Current viewport state */
  viewport: MinimapViewport
  /** Viewport change callback */
  onViewportChange: (viewport: MinimapViewport) => void
  /** Full map bounds */
  bounds?: MinimapBounds
  /** Entities to display as dots */
  entities?: readonly MinimapEntity[]
  /** Width in pixels */
  width?: number
  /** Height in pixels */
  height?: number
  /** Show compass */
  showCompass?: boolean
  /** Show zoom controls */
  showZoomControls?: boolean
  /** Show zoom level */
  showZoomLevel?: boolean
  /** Collapsible mode */
  collapsible?: boolean
  /** Default collapsed state */
  defaultCollapsed?: boolean
  /** Additional class */
  className?: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_BOUNDS: MinimapBounds = {
  north: 85,
  south: -85,
  east: 180,
  west: -180,
}

const VIEWPORT_COLOR = 'rgba(34, 197, 94, 0.5)' // green-500
const VIEWPORT_BORDER = 'rgba(34, 197, 94, 0.8)'
const GRID_COLOR = 'rgba(255, 255, 255, 0.1)'
const BG_COLOR = 'rgba(17, 24, 39, 0.95)' // gray-900

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert geographic coordinates to canvas pixels
 */
const geoToCanvas = (
  lon: number,
  lat: number,
  bounds: MinimapBounds,
  width: number,
  height: number
): { x: number; y: number } => {
  const x = ((lon - bounds.west) / (bounds.east - bounds.west)) * width
  const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * height
  return { x, y }
}

/**
 * Convert canvas pixels to geographic coordinates
 */
const canvasToGeo = (
  x: number,
  y: number,
  bounds: MinimapBounds,
  width: number,
  height: number
): { longitude: number; latitude: number } => {
  const longitude = bounds.west + (x / width) * (bounds.east - bounds.west)
  const latitude = bounds.north - (y / height) * (bounds.north - bounds.south)
  return { longitude, latitude }
}

/**
 * Calculate viewport bounds from center and zoom
 */
const getViewportBounds = (
  viewport: MinimapViewport
): MinimapBounds => {
  // Rough approximation of viewport extent based on zoom
  // At zoom 0, viewport covers ~360 degrees
  // Each zoom level halves the extent
  const extent = 360 / Math.pow(2, viewport.zoom)
  const halfExtent = extent / 2

  return {
    north: Math.min(85, viewport.latitude + halfExtent),
    south: Math.max(-85, viewport.latitude - halfExtent),
    east: Math.min(180, viewport.longitude + halfExtent),
    west: Math.max(-180, viewport.longitude - halfExtent),
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const Minimap: FC<MinimapProps> = memo(function Minimap({
  viewport,
  onViewportChange,
  bounds = DEFAULT_BOUNDS,
  entities = [],
  width = 160,
  height = 100,
  showCompass = true,
  showZoomControls = true,
  showZoomLevel = true,
  collapsible = true,
  defaultCollapsed = false,
  className,
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Draw minimap
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear and fill background
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, width, height)

    // Draw grid lines
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 0.5
    const gridSpacing = 30 // degrees

    for (let lon = -180; lon <= 180; lon += gridSpacing) {
      const { x } = geoToCanvas(lon, 0, bounds, width, height)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let lat = -60; lat <= 60; lat += gridSpacing) {
      const { y } = geoToCanvas(0, lat, bounds, width, height)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Draw entity dots
    entities.forEach((entity) => {
      const { x, y } = geoToCanvas(
        entity.longitude,
        entity.latitude,
        bounds,
        width,
        height
      )

      // Skip if outside canvas
      if (x < 0 || x > width || y < 0 || y > height) return

      const sourceColor = SOURCE_COLORS[entity.source]?.primary ?? '#6b7280'
      const size = (entity.size ?? 1) * 2

      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fillStyle = sourceColor
      ctx.fill()
    })

    // Draw current viewport
    const viewportBounds = getViewportBounds(viewport)
    const topLeft = geoToCanvas(
      viewportBounds.west,
      viewportBounds.north,
      bounds,
      width,
      height
    )
    const bottomRight = geoToCanvas(
      viewportBounds.east,
      viewportBounds.south,
      bounds,
      width,
      height
    )

    const rectWidth = bottomRight.x - topLeft.x
    const rectHeight = bottomRight.y - topLeft.y

    // Viewport fill
    ctx.fillStyle = VIEWPORT_COLOR
    ctx.fillRect(topLeft.x, topLeft.y, rectWidth, rectHeight)

    // Viewport border
    ctx.strokeStyle = VIEWPORT_BORDER
    ctx.lineWidth = 1.5
    ctx.strokeRect(topLeft.x, topLeft.y, rectWidth, rectHeight)

    // Center crosshair
    const center = geoToCanvas(
      viewport.longitude,
      viewport.latitude,
      bounds,
      width,
      height
    )

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(center.x - 5, center.y)
    ctx.lineTo(center.x + 5, center.y)
    ctx.moveTo(center.x, center.y - 5)
    ctx.lineTo(center.x, center.y + 5)
    ctx.stroke()
  }, [viewport, bounds, entities, width, height])

  // Redraw on changes
  useEffect(() => {
    draw()
  }, [draw])

  // Handle click-to-navigate
  const handleClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (isDragging) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const { longitude, latitude } = canvasToGeo(x, y, bounds, width, height)
      onViewportChange({
        ...viewport,
        longitude,
        latitude,
      })
    },
    [bounds, width, height, viewport, onViewportChange, isDragging]
  )

  // Handle drag-to-pan
  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (!isDragging) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const { longitude, latitude } = canvasToGeo(x, y, bounds, width, height)
      onViewportChange({
        ...viewport,
        longitude,
        latitude,
      })
    },
    [isDragging, bounds, width, height, viewport, onViewportChange]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Enter animation
  useEffect(() => {
    if (containerRef.current && !isCollapsed) {
      animate(containerRef.current, {
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: TIMING.normal,
        ease: EASING.anime.out,
      })
    }
  }, [isCollapsed])

  // Toggle collapse animation
  const handleToggleCollapse = () => {
    if (containerRef.current) {
      if (isCollapsed) {
        setIsCollapsed(false)
      } else {
        animate(containerRef.current, {
          opacity: [1, 0],
          scale: [1, 0.95],
          duration: TIMING.fast,
          ease: EASING.anime.in,
          complete: () => setIsCollapsed(true),
        })
      }
    }
  }

  // Zoom controls
  const handleZoomIn = () => {
    onViewportChange({
      ...viewport,
      zoom: Math.min(20, viewport.zoom + 1),
    })
  }

  const handleZoomOut = () => {
    onViewportChange({
      ...viewport,
      zoom: Math.max(0, viewport.zoom - 1),
    })
  }

  if (isCollapsed) {
    return (
      <button
        className={cn(
          'flex items-center justify-center w-8 h-8',
          'bg-surface-1/90 backdrop-blur-sm rounded-md border border-border-subtle',
          'text-text-tertiary hover:text-text-primary hover:bg-surface-2',
          'transition-colors',
          className
        )}
        onClick={handleToggleCollapse}
        title="Show minimap"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col bg-surface-1/90 backdrop-blur-sm',
        'rounded-md border border-border-subtle overflow-hidden',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setIsDragging(false)
      }}
    >
      {/* Header with controls */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border-subtle">
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3 h-3 text-accent-primary" />
          <span className="text-xs font-mono text-text-tertiary uppercase">
            Overview
          </span>
        </div>
        <div className="flex items-center gap-1">
          {showZoomLevel && (
            <span className="text-xs font-mono text-text-tertiary tabular-nums">
              z{viewport.zoom.toFixed(1)}
            </span>
          )}
          {collapsible && (
            <button
              className="p-0.5 hover:bg-surface-2 rounded transition-colors"
              onClick={handleToggleCollapse}
              title="Hide minimap"
            >
              <Minimize2 className="w-3 h-3 text-text-tertiary" />
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className={cn(
            'cursor-crosshair',
            isDragging && 'cursor-grabbing'
          )}
          style={{ width, height }}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Compass indicator */}
        {showCompass && viewport.bearing !== undefined && viewport.bearing !== 0 && (
          <div
            className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center"
            style={{
              transform: `rotate(${-viewport.bearing}deg)`,
            }}
          >
            <Compass className="w-4 h-4 text-text-tertiary" />
          </div>
        )}

        {/* Hover instructions */}
        {isHovered && !isDragging && (
          <div className="absolute bottom-1 left-1 flex items-center gap-1 text-xs text-text-tertiary">
            <Move className="w-2.5 h-2.5" />
            <span>drag to pan</span>
          </div>
        )}
      </div>

      {/* Zoom controls */}
      {showZoomControls && (
        <div className="flex items-center justify-center gap-1 py-1 border-t border-border-subtle">
          <button
            className="p-1 hover:bg-surface-2 rounded transition-colors disabled:opacity-50"
            onClick={handleZoomOut}
            disabled={viewport.zoom <= 0}
            title="Zoom out"
          >
            <ZoomOut className="w-3 h-3 text-text-tertiary" />
          </button>
          <div className="w-12 h-1 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary rounded-full transition-all"
              style={{ width: `${(viewport.zoom / 20) * 100}%` }}
            />
          </div>
          <button
            className="p-1 hover:bg-surface-2 rounded transition-colors disabled:opacity-50"
            onClick={handleZoomIn}
            disabled={viewport.zoom >= 20}
            title="Zoom in"
          >
            <ZoomIn className="w-3 h-3 text-text-tertiary" />
          </button>
        </div>
      )}
    </div>
  )
})

export default Minimap
