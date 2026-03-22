/**
 * useMotionBlur Hook
 *
 * React hook for consuming direction-aware motion blur.
 * Integrates with pointer events for velocity tracking.
 *
 * @pattern React hook + motion tracker
 * @module
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import type {
  UseMotionBlurReturn,
  VelocityState,
  MotionBlurConfig,
  MotionBlurStyle,
} from './types'
import {
  createMotionTracker,
  type MotionTracker,
} from './motion-tracker'

// =============================================================================
// Default Style (no blur)
// =============================================================================

const NO_BLUR_STYLE: MotionBlurStyle = {
  filter: undefined,
  transform: undefined,
  transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
  isActive: false,
  blurAmount: 0,
  velocityMagnitude: 0,
  velocityAngle: 0,
}

const INITIAL_VELOCITY_STATE: VelocityState = {
  velocity: { x: 0, y: 0 },
  smoothedVelocity: { x: 0, y: 0 },
  lastPosition: { x: 0, y: 0 },
  lastTimestamp: 0,
  isDragging: false,
}

// =============================================================================
// Hook
// =============================================================================

export interface UseMotionBlurOptions {
  /** Motion blur configuration */
  config?: Partial<MotionBlurConfig>
  /** Whether to track motion (disable for performance) */
  enabled?: boolean
}

/**
 * Hook for direction-aware motion blur
 *
 * @example
 * ```tsx
 * function DraggableCard({ id }) {
 *   const { style, startTracking, updatePosition, stopTracking } = useMotionBlur()
 *
 *   const handleDragStart = (e) => {
 *     startTracking(e.clientX, e.clientY)
 *   }
 *
 *   const handleDrag = (e) => {
 *     updatePosition(e.clientX, e.clientY)
 *   }
 *
 *   const handleDragEnd = () => {
 *     stopTracking()
 *   }
 *
 *   return (
 *     <div
 *       style={{
 *         filter: style.filter,
 *         transform: style.transform,
 *         transition: style.transition,
 *       }}
 *       onPointerDown={handleDragStart}
 *       onPointerMove={handleDrag}
 *       onPointerUp={handleDragEnd}
 *     >
 *       Content
 *     </div>
 *   )
 * }
 * ```
 */
export function useMotionBlur(options: UseMotionBlurOptions = {}): UseMotionBlurReturn {
  const { config, enabled = true } = options

  // Create stable tracker reference
  const trackerRef = useRef<MotionTracker | null>(null)
  if (!trackerRef.current) {
    trackerRef.current = createMotionTracker()
  }

  // State for React re-renders
  const [style, setStyle] = useState<MotionBlurStyle>(NO_BLUR_STYLE)
  const [velocityState, setVelocityState] = useState<VelocityState>(INITIAL_VELOCITY_STATE)
  const [isTracking, setIsTracking] = useState(false)

  // Animation frame ref for smooth updates
  const rafRef = useRef<number | null>(null)

  // Update loop during tracking
  const updateLoop = useCallback(() => {
    const tracker = trackerRef.current
    if (!tracker) return

    const state = tracker.getState()
    const blurStyle = tracker.getBlurStyle(config)

    setVelocityState(state)
    setStyle(blurStyle)

    if (state.isDragging) {
      rafRef.current = requestAnimationFrame(updateLoop)
    }
  }, [config])

  // Start tracking
  const startTracking = useCallback((x: number, y: number) => {
    if (!enabled) return

    const tracker = trackerRef.current
    if (!tracker) return

    tracker.startTracking(x, y)
    setIsTracking(true)

    // Start update loop
    rafRef.current = requestAnimationFrame(updateLoop)
  }, [enabled, updateLoop])

  // Update position
  const updatePosition = useCallback((x: number, y: number) => {
    if (!enabled) return

    const tracker = trackerRef.current
    if (!tracker) return

    tracker.updatePosition(x, y)
  }, [enabled])

  // Stop tracking
  const stopTracking = useCallback(() => {
    const tracker = trackerRef.current
    if (!tracker) return

    tracker.stopTracking()
    setIsTracking(false)

    // Cancel animation frame
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    // Final state update (blur off)
    setVelocityState(tracker.getState())
    setStyle(tracker.getBlurStyle(config))
  }, [config])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return {
    style,
    startTracking,
    updatePosition,
    stopTracking,
    velocityState,
    isTracking,
  }
}

export default useMotionBlur
