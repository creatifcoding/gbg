/**
 * DragReticleOverlay
 *
 * tldraw overlay component that renders drag interaction enhancements:
 * - Corner emanation effects on drag start
 * - Momentum ghost trails during drag
 * - Snap feedback indicators
 *
 * Placed in front of the canvas via tldraw's InFrontOfTheCanvas component slot.
 */

import { useEditor, useValue } from 'tldraw'
import { useCallback, useEffect, useRef } from 'react'
import {
  createBoundsEmanation,
  createCornerEmanation,
  COLORS,
  TIMING,
} from '@/lib/animation'

// =============================================================================
// TYPES
// =============================================================================

interface DragState {
  isDragging: boolean
  shapeIds: string[]
  startBounds: { x: number; y: number; width: number; height: number } | null
  currentBounds: { x: number; y: number; width: number; height: number } | null
  velocity: { x: number; y: number }
  lastPosition: { x: number; y: number } | null
  lastTimestamp: number | null
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DragReticleOverlay() {
  const editor = useEditor()
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    shapeIds: [],
    startBounds: null,
    currentBounds: null,
    velocity: { x: 0, y: 0 },
    lastPosition: null,
    lastTimestamp: null,
  })

  // Track selected shapes and their bounds
  const selectedShapeIds = useValue(
    'selected shapes',
    () => editor.getSelectedShapeIds(),
    [editor]
  )

  const selectionRotatedPageBounds = useValue(
    'selection bounds',
    () => editor.getSelectionRotatedPageBounds(),
    [editor]
  )

  // Track pointer state
  const isPointerDown = useValue(
    'pointer down',
    () => editor.inputs.isPointing,
    [editor]
  )

  const isDragging = useValue(
    'dragging',
    () => editor.inputs.isDragging,
    [editor]
  )

  // Convert page bounds to screen coordinates
  const getScreenBounds = useCallback(() => {
    if (!selectionRotatedPageBounds) return null

    const screenBounds = editor.getViewportScreenBounds()
    const zoom = editor.getZoomLevel()
    const camera = editor.getCamera()

    const x = (selectionRotatedPageBounds.x + camera.x) * zoom
    const y = (selectionRotatedPageBounds.y + camera.y) * zoom
    const width = selectionRotatedPageBounds.width * zoom
    const height = selectionRotatedPageBounds.height * zoom

    return {
      x: x + screenBounds.x,
      y: y + screenBounds.y,
      width,
      height,
    }
  }, [editor, selectionRotatedPageBounds])

  // Handle drag start - trigger corner emanation
  const handleDragStart = useCallback(() => {
    const container = overlayRef.current
    if (!container) return

    const bounds = getScreenBounds()
    if (!bounds) return

    dragStateRef.current = {
      isDragging: true,
      shapeIds: [...selectedShapeIds],
      startBounds: bounds,
      currentBounds: bounds,
      velocity: { x: 0, y: 0 },
      lastPosition: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      lastTimestamp: performance.now(),
    }

    // Trigger corner emanation effect
    const emanation = createBoundsEmanation(container, bounds, {
      staggerDelay: 8, // Slightly staggered for wave effect
    })
    emanation.play()
  }, [getScreenBounds, selectedShapeIds])

  // Handle drag move - update velocity for trail effects
  const handleDragMove = useCallback(() => {
    const bounds = getScreenBounds()
    if (!bounds) return

    const state = dragStateRef.current
    const now = performance.now()
    const dt = state.lastTimestamp ? now - state.lastTimestamp : 16

    if (state.lastPosition && dt > 0) {
      const currentCenter = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      }

      // Calculate velocity (pixels per second)
      state.velocity = {
        x: ((currentCenter.x - state.lastPosition.x) / dt) * 1000,
        y: ((currentCenter.y - state.lastPosition.y) / dt) * 1000,
      }

      state.lastPosition = currentCenter
    }

    state.currentBounds = bounds
    state.lastTimestamp = now
  }, [getScreenBounds])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    dragStateRef.current = {
      isDragging: false,
      shapeIds: [],
      startBounds: null,
      currentBounds: null,
      velocity: { x: 0, y: 0 },
      lastPosition: null,
      lastTimestamp: null,
    }
  }, [])

  // Effect to handle drag state changes
  useEffect(() => {
    const wasTrackingDrag = dragStateRef.current.isDragging

    if (isDragging && selectedShapeIds.length > 0 && !wasTrackingDrag) {
      handleDragStart()
    } else if (isDragging && wasTrackingDrag) {
      handleDragMove()
    } else if (!isDragging && wasTrackingDrag) {
      handleDragEnd()
    }
  }, [isDragging, selectedShapeIds, handleDragStart, handleDragMove, handleDragEnd])

  return (
    <div
      ref={overlayRef}
      className="drag-reticle-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1000,
      }}
    />
  )
}

// =============================================================================
// SINGLE SHAPE EMANATION (for resize handle activation)
// =============================================================================

interface ShapeEmanationProps {
  bounds: { x: number; y: number; width: number; height: number }
  corner?: 'tl' | 'tr' | 'br' | 'bl' | 'all'
}

export function ShapeEmanation({ bounds, corner = 'all' }: ShapeEmanationProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const corners: { x: number; y: number }[] = []

    if (corner === 'all' || corner === 'tl') {
      corners.push({ x: bounds.x, y: bounds.y })
    }
    if (corner === 'all' || corner === 'tr') {
      corners.push({ x: bounds.x + bounds.width, y: bounds.y })
    }
    if (corner === 'all' || corner === 'br') {
      corners.push({ x: bounds.x + bounds.width, y: bounds.y + bounds.height })
    }
    if (corner === 'all' || corner === 'bl') {
      corners.push({ x: bounds.x, y: bounds.y + bounds.height })
    }

    const emanations = corners.map((c) => createCornerEmanation(container, c))

    // Stagger the corner animations
    emanations.forEach((e, i) => {
      setTimeout(() => e.play(), i * 10)
    })

    return () => {
      emanations.forEach((e) => e.destroy())
    }
  }, [bounds, corner])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    />
  )
}

export default DragReticleOverlay
