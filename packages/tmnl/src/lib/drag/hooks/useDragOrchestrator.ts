/**
 * useDragOrchestrator Hook
 *
 * React hook for consuming the drag orchestrator.
 * Provides reactive access to drag state, velocity, and motion blur.
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

import { useCallback, useMemo } from 'react'
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
 * @param options - Configuration options
 * @returns Drag state and operations
 */
export function useDragOrchestrator(
  options: UseDragOrchestratorOptions = {}
): UseDragOrchestratorReturn {
  const { elementId } = options
  const stx = getDragStx()

  // ---------------------------------------------------------------------------
  // Reactive State
  // ---------------------------------------------------------------------------

  // Subscribe to active drag operation
  const operation = useSelector(stx.data.activeDrag, (d) => d)

  // Subscribe to velocity
  const velocity = useSelector(stx.data.velocity, (v) => v)

  // Subscribe to blur config
  const blurConfig = useSelector(stx.data.blurConfig, (c) => c)

  // Computed values
  const isDragging = operation !== null

  // ---------------------------------------------------------------------------
  // Element-scoped blur style
  // ---------------------------------------------------------------------------

  const blurStyle = useMemo((): MotionBlurOutput => {
    // If elementId provided, only show blur if that element is being dragged
    if (elementId && operation) {
      if (!operation.elementIds.includes(elementId)) {
        return {
          filter: undefined,
          transform: undefined,
          transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
          isActive: false,
          blurAmount: 0,
          strategy: 'none',
        }
      }
    }

    // No active drag
    if (!operation) {
      return {
        filter: undefined,
        transform: undefined,
        transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
        isActive: false,
        blurAmount: 0,
        strategy: 'none',
      }
    }

    // Determine strategy
    const count = operation.elementIds.length
    const strategy: BlurStrategy =
      count === 0 ? 'none' : count >= (blurConfig.wrapperThreshold ?? 5) ? 'wrapper' : 'individual'

    // If using wrapper strategy and elementId is provided, defer to wrapper
    if (strategy === 'wrapper' && elementId) {
      return {
        filter: undefined,
        transform: undefined,
        transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
        isActive: false,
        blurAmount: 0,
        strategy: 'wrapper', // Signal to use wrapper instead
      }
    }

    const { magnitude, angle } = velocity
    const { maxBlur, intensity, threshold, enableStretch, maxStretch } = blurConfig

    // Check threshold
    if (magnitude < (threshold ?? 2)) {
      return {
        filter: undefined,
        transform: undefined,
        transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
        isActive: false,
        blurAmount: 0,
        strategy,
      }
    }

    // Calculate blur amount
    const blurAmount = Math.min(magnitude * (intensity ?? 0.08), maxBlur ?? 6)

    // Calculate directional stretch
    let transform: string | undefined
    if (enableStretch && magnitude > (threshold ?? 2)) {
      const stretchFactor = 1 + Math.min(magnitude * 0.002, (maxStretch ?? 1.03) - 1)
      const angleDeg = (angle * 180) / Math.PI
      transform = `rotate(${angleDeg}deg) scaleX(${stretchFactor}) rotate(${-angleDeg}deg)`
    }

    return {
      filter: blurAmount > 0 ? `blur(${blurAmount.toFixed(2)}px)` : undefined,
      transform,
      transition: 'none', // No transition during drag
      isActive: true,
      blurAmount,
      strategy,
    }
  }, [operation, velocity, blurConfig, elementId])

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
