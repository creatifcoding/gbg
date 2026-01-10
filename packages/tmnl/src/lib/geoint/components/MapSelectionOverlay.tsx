/**
 * MapSelectionOverlay - Animated selection ring overlay for map entities
 *
 * Renders a DOM-based selection ring that tracks the selected entity's
 * screen position and animates with anime.js. Works alongside deck.gl
 * WebGL layers by projecting geo coordinates to screen space.
 *
 * @see ANIMATIONS.selectionRing in tokens.ts
 * @module geoint/components/MapSelectionOverlay
 */

import { useRef, useEffect, useCallback, memo } from 'react'
import type { CSSProperties } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { WebMercatorViewport } from '@deck.gl/core'
import { animate, createTimeline } from 'animejs'
import { selectedResultAtom, viewportAtom } from '../atoms'
import { TIMING, EASING, SOURCE_COLORS } from '../tokens'
import type { SearchResultItem, IntelSource } from '../schemas'

// =============================================================================
// Types
// =============================================================================

interface SelectionOverlayProps {
  /** Instance ID for viewport sync */
  instanceId?: string
  /** Container dimensions for projection */
  dimensions: { width: number; height: number } | null
  /** Optional className for container */
  className?: string
}

interface ScreenPosition {
  x: number
  y: number
  visible: boolean
}

// =============================================================================
// Animation Config (extracted from ANIMATIONS.selectionRing)
// =============================================================================

const SELECTION_RING_ANIMATION = {
  scale: [0.8, 1] as [number, number],
  opacity: [0.5, 1] as [number, number],
  duration: 150, // TIMING.fast
  ease: 'out(3)',
}

// =============================================================================
// Coordinate Extraction
// =============================================================================

/**
 * Extract longitude/latitude from various result types.
 * All result types use `position` as Position or Position3D.
 */
function getResultCoordinates(result: SearchResultItem): { lon: number; lat: number } | null {
  switch (result._tag) {
    case 'SearchResultTrack':
      // Position3D: [lon, lat, alt]
      return { lon: result.position[0], lat: result.position[1] }
    case 'SearchResultPoi':
      // Position: [lon, lat]
      return { lon: result.position[0], lat: result.position[1] }
    case 'SearchResultFlight':
      // Position3D: [lon, lat, alt]
      return { lon: result.position[0], lat: result.position[1] }
    case 'SearchResultFeature':
      // Position: [lon, lat]
      return { lon: result.position[0], lat: result.position[1] }
    case 'SearchResultWeather':
      // Position: [lon, lat]
      return { lon: result.position[0], lat: result.position[1] }
    case 'SearchResultImagery':
      // Position: [lon, lat] (centroid of imagery)
      return { lon: result.position[0], lat: result.position[1] }
    default:
      return null
  }
}

/**
 * Map IntelSource to SOURCE_COLORS key.
 * IntelSource: track, feature, osm, opensky, adsb_lol, planet, sentinel, weather, custom
 */
const SOURCE_TO_COLOR_KEY: Record<IntelSource, keyof typeof SOURCE_COLORS> = {
  track: 'track',
  feature: 'custom', // features use custom color
  osm: 'osm',
  opensky: 'opensky',
  adsb_lol: 'adsb_lol',
  planet: 'planet',
  sentinel: 'sentinel',
  weather: 'weather',
  custom: 'custom',
}

/**
 * Get source color for the selection ring.
 */
function getSourceColor(result: SearchResultItem): string {
  const colorKey = SOURCE_TO_COLOR_KEY[result.source] || 'track'
  return SOURCE_COLORS[colorKey].primary
}

// =============================================================================
// Projection Hook
// =============================================================================

/**
 * Project geo coordinates to screen position.
 */
function useProjection(
  lon: number | null,
  lat: number | null,
  dimensions: { width: number; height: number } | null
): ScreenPosition | null {
  const viewport = useAtomValue(viewportAtom)

  if (lon === null || lat === null || !dimensions) return null

  try {
    const mercator = new WebMercatorViewport({
      ...viewport,
      width: dimensions.width,
      height: dimensions.height,
    })

    const [x, y] = mercator.project([lon, lat])

    // Check if in viewport
    const visible = x >= -50 && x <= dimensions.width + 50 && y >= -50 && y <= dimensions.height + 50

    return { x, y, visible }
  } catch {
    return null
  }
}

// =============================================================================
// Selection Ring Component
// =============================================================================

interface SelectionRingProps {
  position: ScreenPosition
  color: string
  isNew: boolean
  onAnimationStart: () => void
}

const SelectionRing = memo(function SelectionRing({
  position,
  color,
  isNew,
  onAnimationStart,
}: SelectionRingProps) {
  const ringRef = useRef<HTMLDivElement>(null)
  const pulseRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  // Animate on mount or when isNew changes
  useEffect(() => {
    if (!ringRef.current || !pulseRef.current || !isNew) return

    onAnimationStart()

    // Main ring animation
    animate(ringRef.current, {
      scale: SELECTION_RING_ANIMATION.scale,
      opacity: SELECTION_RING_ANIMATION.opacity,
      duration: SELECTION_RING_ANIMATION.duration,
      ease: SELECTION_RING_ANIMATION.ease,
    })

    // Pulse ring animation (expanding outward)
    const pulseTimeline = createTimeline({
      loop: true,
      defaults: { duration: 1500, ease: 'out(3)' },
    })

    pulseTimeline.add(pulseRef.current, {
      scale: [1, 2],
      opacity: [0.6, 0],
    })

    // Inner dot animation
    if (innerRef.current) {
      animate(innerRef.current, {
        scale: [0, 1],
        duration: TIMING.fast,
        easing: EASING.anime.bounce,
        delay: TIMING.fast / 2,
      })
    }

    return () => {
      pulseTimeline.pause()
    }
  }, [isNew, onAnimationStart])

  const baseStyle: CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 100,
  }

  const ringStyle: CSSProperties = {
    ...baseStyle,
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: `3px solid ${color}`,
    boxShadow: `0 0 12px ${color}40, 0 0 24px ${color}20`,
    opacity: 0,
    transform: 'translate(-50%, -50%) scale(0.8)',
  }

  const pulseStyle: CSSProperties = {
    ...baseStyle,
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: `2px solid ${color}`,
    opacity: 0.6,
  }

  const innerStyle: CSSProperties = {
    ...baseStyle,
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    boxShadow: `0 0 8px ${color}`,
    transform: 'translate(-50%, -50%) scale(0)',
  }

  return (
    <>
      {/* Pulse ring (animated outward) */}
      <div ref={pulseRef} style={pulseStyle} />

      {/* Main selection ring */}
      <div ref={ringRef} style={ringStyle} />

      {/* Center dot */}
      <div ref={innerRef} style={innerStyle} />
    </>
  )
})

// =============================================================================
// Main Component
// =============================================================================

function MapSelectionOverlayComponent({ dimensions, className }: SelectionOverlayProps) {
  const selectedResult = useAtomValue(selectedResultAtom)
  const lastResultIdRef = useRef<string | null>(null)

  // Extract coordinates
  const coords = selectedResult ? getResultCoordinates(selectedResult) : null

  // Project to screen
  const position = useProjection(coords?.lon ?? null, coords?.lat ?? null, dimensions)

  // Determine if this is a new selection (for animation trigger)
  const resultId = selectedResult?.id ?? null
  const isNewSelection = resultId !== lastResultIdRef.current

  const handleAnimationStart = useCallback(() => {
    lastResultIdRef.current = resultId
  }, [resultId])

  // Container style
  const containerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  }

  // Don't render if no selection or not visible
  if (!selectedResult || !position || !position.visible) {
    return null
  }

  return (
    <div className={className} style={containerStyle}>
      <SelectionRing
        position={position}
        color={getSourceColor(selectedResult)}
        isNew={isNewSelection}
        onAnimationStart={handleAnimationStart}
      />
    </div>
  )
}

export const MapSelectionOverlay = memo(MapSelectionOverlayComponent)
export default MapSelectionOverlay
