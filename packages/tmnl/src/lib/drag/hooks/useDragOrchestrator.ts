/**
 * useDragOrchestrator Hook
 *
 * React hook for consuming the drag orchestrator.
 * Provides reactive access to drag state, velocity, and motion blur.
 *
 * Uses requestAnimationFrame loop for smooth blur updates during drag
 * (ported from useMotionBlur pattern).
 *
 * @example
 * ```tsx
 * function DraggableCard({ id }) {
 *   const { isDragging, blurStyle, startDrag, updatePosition, endDrag } = useDragOrchestrator()
 *
 *   return (
 *     <div
 *       style={{
 *         filter: blurStyle.filter,
 *         transform: blurStyle.transform,
 *       }}
 *       onPointerDown={(e) => startDrag('selection', id, [id], { x: e.clientX, y: e.clientY })}
 *       onPointerMove={(e) => updatePosition({ x: e.clientX, y: e.clientY })}
 *       onPointerUp={endDrag}
 *     />
 *   )
 * }
 * ```
 *
 * @module
 */

import { useCallback, useState, useEffect, useRef } from 'react'
import { useSelector } from '@/lib/stx'
import {
  getDragStx,
  startDrag as _startDrag,
  updateDragPosition,
  addDragElements,
  removeDragElements,
  endDrag as _endDrag,
  cancelDrag as _cancelDrag,
  updateModifiers,
  updateBlurConfig,
  isElementDragged,
  getActiveDrag,
  getDragVelocity,
  getBlurConfig,
} from '../drag-stx'
import type {
  Vector2D,
  DragSource,
  DragOperation,
  DragVelocity,
  BlurConfig,
  BlurStrategy,
  MotionBlurOutput,
  UseDragOrchestratorReturn,
} from '../types'

// =============================================================================
// Constants
// =============================================================================

const NO_BLUR_STYLE: MotionBlurOutput = {
  filter: undefined,
  transform: undefined,
  transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
  isActive: false,
  blurAmount: 0,
  strategy: 'none',
}

// =============================================================================
// Perceptual Math Utilities
// =============================================================================

/**
 * Smooth step (Hermite interpolation) for soft thresholds.
 * Returns 0 below edge0, 1 above edge1, smooth S-curve transition between.
 */
function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t) // Hermite interpolation
}

/**
 * Perceptual blur mapping using sqrt for Weber-Fechner compliance.
 * Human perception of intensity follows logarithmic/power law.
 */
function perceptualBlur(magnitude: number, intensity: number, maxBlur: number): number {
  // Use sqrt for perceptually linear blur increase
  // sqrt(magnitude) grows slower at high speeds, preventing over-blur
  const perceptualMagnitude = Math.sqrt(magnitude)
  return Math.min(perceptualMagnitude * intensity, maxBlur)
}

/**
 * Eased stretch factor using quadratic ease-out.
 * Stretch should feel "springy" - quick onset, gradual settle.
 */
function easedStretch(magnitude: number, threshold: number, maxStretch: number): number {
  // Normalize magnitude above threshold to 0-1 range
  // Use a reasonable "full stretch" velocity (e.g., 30 px/frame)
  const fullStretchVelocity = 30
  const normalized = Math.min((magnitude - threshold) / fullStretchVelocity, 1)

  // Quadratic ease-out: fast onset, gradual settle
  const eased = 1 - (1 - normalized) * (1 - normalized)

  // Map to stretch range [1.0, maxStretch]
  return 1 + eased * (maxStretch - 1)
}

// =============================================================================
// Blur Style Calculator (perceptually-tuned)
// =============================================================================

function calculateBlurStyle(
  operation: DragOperation | null,
  velocity: DragVelocity,
  blurConfig: BlurConfig,
  elementId?: string
): MotionBlurOutput {
  // If elementId provided, only show blur if that element is being dragged
  if (elementId && operation) {
    if (!operation.elementIds.includes(elementId)) {
      return NO_BLUR_STYLE
    }
  }

  // No active drag
  if (!operation) {
    return NO_BLUR_STYLE
  }

  // Determine strategy
  const count = operation.elementIds.length
  const strategy: BlurStrategy =
    count === 0 ? 'none' : count >= (blurConfig.wrapperThreshold ?? 5) ? 'wrapper' : 'individual'

  // If using wrapper strategy and elementId is provided, defer to wrapper
  if (strategy === 'wrapper' && elementId) {
    return {
      ...NO_BLUR_STYLE,
      strategy: 'wrapper', // Signal to use wrapper instead
    }
  }

  const { magnitude, angle } = velocity
  const { maxBlur, intensity, threshold, enableStretch, maxStretch } = blurConfig

  // Perceptual thresholds
  const blurThreshold = threshold ?? 2        // Blur starts at low velocity
  const stretchThreshold = (threshold ?? 2) * 2 // Stretch needs higher velocity

  // Soft threshold using smooth step (no hard cutoff)
  const blurFactor = smoothStep(blurThreshold * 0.5, blurThreshold * 1.5, magnitude)

  // Below soft threshold - return minimal blur
  if (blurFactor < 0.01) {
    return {
      ...NO_BLUR_STYLE,
      strategy,
    }
  }

  // Calculate perceptual blur amount (sqrt mapping + soft threshold)
  const rawBlur = perceptualBlur(magnitude, intensity ?? 0.15, maxBlur ?? 8)
  const blurAmount = rawBlur * blurFactor

  // Calculate directional stretch (higher threshold, eased curve)
  let transform: string | undefined
  if (enableStretch && magnitude > stretchThreshold) {
    const stretchFactor = easedStretch(magnitude, stretchThreshold, maxStretch ?? 1.05)
    const angleDeg = (angle * 180) / Math.PI
    // Rotate to align with motion, stretch, rotate back
    transform = `rotate(${angleDeg}deg) scaleX(${stretchFactor.toFixed(4)}) rotate(${-angleDeg}deg)`
  }

  return {
    filter: blurAmount > 0.3 ? `blur(${blurAmount.toFixed(2)}px)` : undefined,
    transform,
    transition: 'none', // No transition during drag
    isActive: blurAmount > 0.3,
    blurAmount,
    strategy,
  }
}

// =============================================================================
// Hook
// =============================================================================

export interface UseDragOrchestratorOptions {
  /**
   * If provided, scopes blur style to this element only.
   * When not provided, returns blur style for all dragged elements.
   */
  elementId?: string
}

/**
 * Hook to consume drag orchestrator state and operations.
 *
 * Uses requestAnimationFrame loop for smooth blur updates during drag
 * (ported from useMotionBlur pattern).
 *
 * @param options - Configuration options
 * @returns Drag state and operations
 */
export function useDragOrchestrator(
  options: UseDragOrchestratorOptions = {}
): UseDragOrchestratorReturn {
  const { elementId } = options
  const stx = getDragStx()

  // ---------------------------------------------------------------------------
  // Reactive State (for Legend-State subscriptions)
  // ---------------------------------------------------------------------------

  // Subscribe to active drag operation
  const operation = useSelector(stx.data.activeDrag, (d) => d)

  // Subscribe to velocity (for non-blur uses)
  const velocity = useSelector(stx.data.velocity, (v) => v)

  // Subscribe to blur config
  const blurConfig = useSelector(stx.data.blurConfig, (c) => c)

  // Computed values
  const isDragging = operation !== null

  // ---------------------------------------------------------------------------
  // RAF-based Blur Style (smooth ~60fps updates during drag)
  // ---------------------------------------------------------------------------

  const [blurStyle, setBlurStyle] = useState<MotionBlurOutput>(NO_BLUR_STYLE)
  const rafRef = useRef<number | null>(null)

  // Update loop - polls state at animation frame rate for smooth blur
  const updateLoop = useCallback(() => {
    const currentOperation = getActiveDrag()
    const currentVelocity = getDragVelocity()
    const currentConfig = getBlurConfig()

    const newStyle = calculateBlurStyle(currentOperation, currentVelocity, currentConfig, elementId)
    setBlurStyle(newStyle)

    // Continue loop if still dragging
    if (currentOperation !== null) {
      rafRef.current = requestAnimationFrame(updateLoop)
    }
  }, [elementId])

  // Start/stop RAF loop when drag state changes
  useEffect(() => {
    if (isDragging) {
      // Start the update loop
      rafRef.current = requestAnimationFrame(updateLoop)
    } else {
      // Stop loop and reset blur
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setBlurStyle(NO_BLUR_STYLE)
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isDragging, updateLoop])

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------

  const startDrag = useCallback(
    (source: DragSource, primaryId: string, elementIds: string[], position: Vector2D) => {
      return _startDrag(source, primaryId, elementIds, position)
    },
    []
  )

  const updatePosition = useCallback((position: Vector2D) => {
    updateDragPosition(position)
  }, [])

  const addElements = useCallback((elementIds: string[]) => {
    addDragElements(elementIds)
  }, [])

  const endDrag = useCallback(() => {
    _endDrag()
  }, [])

  const cancelDrag = useCallback(() => {
    _cancelDrag()
  }, [])

  const setBlurConfig = useCallback((config: Partial<BlurConfig>) => {
    updateBlurConfig(config)
  }, [])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    isDragging,
    operation,
    velocity,
    blurStyle,
    startDrag,
    updatePosition,
    addElements,
    endDrag,
    cancelDrag,
    setBlurConfig,
  }
}

// =============================================================================
// Utility Hook: Element-specific drag state
// =============================================================================

/**
 * Hook to check if a specific element is being dragged.
 * More efficient than useDragOrchestrator when you only need this info.
 */
export function useIsElementDragged(elementId: string): boolean {
  const stx = getDragStx()

  const elementIds = useSelector(stx.data.activeDrag, (d) => d?.elementIds ?? [])

  return elementIds.includes(elementId)
}

/**
 * Hook to get blur style for a specific element.
 * Returns blur style only if the element is being dragged.
 */
export function useElementBlurStyle(elementId: string): MotionBlurOutput {
  const { blurStyle } = useDragOrchestrator({ elementId })
  return blurStyle
}
