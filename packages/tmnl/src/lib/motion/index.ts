/**
 * Motion Blur System
 *
 * Direction-aware motion blur for draggable elements.
 * Tracks velocity and applies blur in the direction of motion.
 *
 * ## Quick Start
 *
 * ```tsx
 * import { useMotionBlur } from '@/lib/motion'
 *
 * function DraggableCard() {
 *   const { style, startTracking, updatePosition, stopTracking } = useMotionBlur()
 *
 *   return (
 *     <div
 *       style={{
 *         filter: style.filter,
 *         transform: style.transform,
 *         transition: style.transition,
 *       }}
 *       onPointerDown={(e) => startTracking(e.clientX, e.clientY)}
 *       onPointerMove={(e) => updatePosition(e.clientX, e.clientY)}
 *       onPointerUp={() => stopTracking()}
 *     >
 *       Content
 *     </div>
 *   )
 * }
 * ```
 *
 * ## Integration with @dnd-kit
 *
 * ```tsx
 * import { useDraggable } from '@dnd-kit/core'
 * import { useMotionBlur, getMotionTracker } from '@/lib/motion'
 *
 * // In DndContext onDragStart/onDragMove/onDragEnd
 * const tracker = getMotionTracker(activeId)
 * tracker.startTracking(event.clientX, event.clientY)
 * tracker.updatePosition(event.clientX, event.clientY)
 * tracker.stopTracking()
 *
 * // Get blur style
 * const blurStyle = tracker.getBlurStyle()
 * ```
 *
 * ## Features
 *
 * - **Direction-aware**: Blur and stretch in the direction of motion
 * - **Velocity-based**: Faster movement = more blur
 * - **Smooth**: Exponential moving average for stable velocity
 * - **Configurable**: Intensity, max blur, threshold, stretch
 * - **Registry**: Track multiple elements by ID
 *
 * @module
 */

// Types
export * from './types'

// Core tracker
export {
  createMotionTracker,
  getMotionTracker,
  removeMotionTracker,
  clearMotionTrackers,
  vectorMagnitude,
  vectorAngle,
  normalizeVector,
  computeMotionBlurStyle,
} from './motion-tracker'

// React hook
export { useMotionBlur } from './useMotionBlur'
export type { UseMotionBlurOptions } from './useMotionBlur'
