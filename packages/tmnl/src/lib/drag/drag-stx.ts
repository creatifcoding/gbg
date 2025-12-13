/**
 * Drag Orchestrator STX Instance
 *
 * Centralized drag state management using full stx pattern.
 * Manages velocity tracking, blur strategy, and multi-element drags.
 *
 * Consumers:
 * - Selection system (marquee select + drag)
 * - Floating panel system (panel drag)
 * - Custom draggables (via hooks)
 *
 * @pattern stx singleton (Legend-State + XState + Effect)
 * @module
 */

import { nanoid } from 'nanoid'
import { stx } from '@/lib/stx'
import { dragMachine } from './machines/drag-machine'
import type {
  Vector2D,
  DragVelocity,
  DragOperation,
  DragSource,
  BlurConfig,
  BlurStrategy,
  MotionBlurOutput,
  DragStxData,
} from './types'

// =============================================================================
// Constants
// =============================================================================

const EMA_ALPHA = 0.3 // Exponential moving average smoothing factor
const VELOCITY_DECAY = 0.95 // Decay factor when drag stops

// =============================================================================
// Initial State
// =============================================================================

const initialVelocity: DragVelocity = {
  raw: { x: 0, y: 0 },
  smoothed: { x: 0, y: 0 },
  magnitude: 0,
  angle: 0,
}

const initialBlurConfig: BlurConfig = {
  maxBlur: 6,
  intensity: 0.08,
  threshold: 2,
  enableStretch: true,
  maxStretch: 1.03,
  wrapperThreshold: 5,
}

const initialData: DragStxData = {
  activeDrag: null,
  velocity: initialVelocity,
  lastPosition: null,
  lastTimestamp: 0,
  blurConfig: initialBlurConfig,
  modifiers: {
    shift: false,
    ctrl: false,
    alt: false,
  },
}

// =============================================================================
// STX Instance (Singleton)
// =============================================================================

let _dragStx: ReturnType<typeof stx<typeof dragMachine, DragStxData>> | null = null

export function getDragStx() {
  if (!_dragStx) {
    _dragStx = stx({
      machine: dragMachine,
      data: initialData,
      computed: {
        /**
         * Whether a drag is currently active
         */
        isDragging: (get) => get.data.activeDrag.get() !== null,

        /**
         * Current element count being dragged
         */
        draggedElementCount: (get) => {
          const drag = get.data.activeDrag.get()
          return drag?.elementIds.length ?? 0
        },

        /**
         * Determine blur strategy based on element count
         */
        blurStrategy: (get): BlurStrategy => {
          const drag = get.data.activeDrag.get()
          if (!drag) return 'none'

          const config = get.data.blurConfig.get()
          const count = drag.elementIds.length

          if (count === 0) return 'none'
          if (count >= (config.wrapperThreshold ?? 5)) return 'wrapper'
          return 'individual'
        },

        /**
         * Computed motion blur style for individual elements
         */
        motionBlurStyle: (get): MotionBlurOutput => {
          const drag = get.data.activeDrag.get()
          const velocity = get.data.velocity.get()
          const config = get.data.blurConfig.get()

          // Determine strategy
          const count = drag?.elementIds.length ?? 0
          const strategy: BlurStrategy = !drag
            ? 'none'
            : count >= (config.wrapperThreshold ?? 5)
              ? 'wrapper'
              : 'individual'

          if (!drag || strategy === 'none') {
            return {
              filter: undefined,
              transform: undefined,
              transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
              isActive: false,
              blurAmount: 0,
              strategy: 'none',
            }
          }

          const { magnitude, angle } = velocity
          const { maxBlur, intensity, threshold, enableStretch, maxStretch } = config

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
        },
      },
    })
  }
  return _dragStx
}

export function resetDragStx() {
  _dragStx?.reset()
}

export function disposeDragStx() {
  _dragStx?.dispose()
  _dragStx = null
}

// =============================================================================
// Direct Operations
// =============================================================================

/**
 * Start a drag operation
 */
export function startDrag(
  source: DragSource,
  primaryId: string,
  elementIds: string[],
  position: Vector2D
): string {
  const stx = getDragStx()
  const operationId = nanoid()

  const operation: DragOperation = {
    id: operationId,
    source,
    primaryId,
    elementIds,
    startPosition: position,
    currentPosition: position,
    startTime: Date.now(),
  }

  // Update data
  stx.data.activeDrag.set(operation)
  stx.data.lastPosition.set(position)
  stx.data.lastTimestamp.set(performance.now()) // Use high-precision timer
  stx.data.velocity.set(initialVelocity)

  // Send machine event
  stx.send?.({ type: 'START_DRAG', operation })

  return operationId
}

/**
 * Update drag position and calculate velocity
 *
 * Velocity is normalized to ~60fps frame units (not px/s) to match
 * the original motion-tracker implementation. This ensures intensity
 * and threshold values work correctly.
 */
export function updateDragPosition(position: Vector2D): void {
  const stx = getDragStx()
  const drag = stx.data.activeDrag.get()
  if (!drag) return

  const now = performance.now() // Use high-precision timer
  const lastPos = stx.data.lastPosition.get()
  const lastTime = stx.data.lastTimestamp.get()

  // Calculate velocity
  if (lastPos && lastTime > 0) {
    const dt = now - lastTime

    // Skip if too fast (< 1ms) to avoid noise
    if (dt < 1) return

    const dx = position.x - lastPos.x
    const dy = position.y - lastPos.y

    // Normalize to ~60fps frame units (divide by dt/16.67)
    // This matches the original motion-tracker velocity scale
    const frameNormalizer = dt / 16.67
    const rawVx = dx / frameNormalizer
    const rawVy = dy / frameNormalizer

    // EMA smoothing
    const currentVelocity = stx.data.velocity.get()
    const smoothedVx = EMA_ALPHA * rawVx + (1 - EMA_ALPHA) * currentVelocity.smoothed.x
    const smoothedVy = EMA_ALPHA * rawVy + (1 - EMA_ALPHA) * currentVelocity.smoothed.y

    // Magnitude and angle
    const magnitude = Math.sqrt(smoothedVx * smoothedVx + smoothedVy * smoothedVy)
    const angle = Math.atan2(smoothedVy, smoothedVx)

    stx.data.velocity.set({
      raw: { x: rawVx, y: rawVy },
      smoothed: { x: smoothedVx, y: smoothedVy },
      magnitude,
      angle,
    })
  }

  // Update position tracking
  stx.data.activeDrag.currentPosition.set(position)
  stx.data.lastPosition.set(position)
  stx.data.lastTimestamp.set(now) // performance.now() from above

  // Send machine event
  stx.send?.({ type: 'UPDATE_POSITION', position })
}

/**
 * Add elements to current drag (for group expansion)
 */
export function addDragElements(elementIds: string[]): void {
  const stx = getDragStx()
  const drag = stx.data.activeDrag.get()
  if (!drag) return

  const currentIds = new Set(drag.elementIds)
  elementIds.forEach((id) => currentIds.add(id))

  stx.data.activeDrag.elementIds.set(Array.from(currentIds))
  stx.send?.({ type: 'ADD_ELEMENTS', elementIds })
}

/**
 * Remove elements from current drag
 */
export function removeDragElements(elementIds: string[]): void {
  const stx = getDragStx()
  const drag = stx.data.activeDrag.get()
  if (!drag) return

  const currentIds = new Set(drag.elementIds)
  elementIds.forEach((id) => currentIds.delete(id))

  stx.data.activeDrag.elementIds.set(Array.from(currentIds))
  stx.send?.({ type: 'REMOVE_ELEMENTS', elementIds })
}

/**
 * End drag operation
 */
export function endDrag(): void {
  const stx = getDragStx()

  stx.data.activeDrag.set(null)
  stx.data.lastPosition.set(null)
  stx.data.lastTimestamp.set(0)

  // Decay velocity smoothly
  const currentVelocity = stx.data.velocity.get()
  stx.data.velocity.set({
    ...currentVelocity,
    raw: { x: 0, y: 0 },
    smoothed: {
      x: currentVelocity.smoothed.x * VELOCITY_DECAY,
      y: currentVelocity.smoothed.y * VELOCITY_DECAY,
    },
    magnitude: currentVelocity.magnitude * VELOCITY_DECAY,
  })

  stx.send?.({ type: 'END_DRAG' })
}

/**
 * Cancel drag operation (revert to start position)
 */
export function cancelDrag(): void {
  const stx = getDragStx()

  stx.data.activeDrag.set(null)
  stx.data.lastPosition.set(null)
  stx.data.lastTimestamp.set(0)
  stx.data.velocity.set(initialVelocity)

  stx.send?.({ type: 'CANCEL_DRAG' })
}

/**
 * Update modifier keys state
 */
export function updateModifiers(modifiers: { shift?: boolean; ctrl?: boolean; alt?: boolean }): void {
  const stx = getDragStx()
  const current = stx.data.modifiers.get()

  stx.data.modifiers.set({
    shift: modifiers.shift ?? current.shift,
    ctrl: modifiers.ctrl ?? current.ctrl,
    alt: modifiers.alt ?? current.alt,
  })
}

/**
 * Update blur configuration
 */
export function updateBlurConfig(config: Partial<BlurConfig>): void {
  const stx = getDragStx()
  const current = stx.data.blurConfig.get()

  stx.data.blurConfig.set({
    ...current,
    ...config,
  })
}

// =============================================================================
// Getters (for non-reactive access)
// =============================================================================

export function getActiveDrag(): DragOperation | null {
  return getDragStx().data.activeDrag.get()
}

export function getDragVelocity(): DragVelocity {
  return getDragStx().data.velocity.get()
}

export function getBlurConfig(): BlurConfig {
  return getDragStx().data.blurConfig.get()
}

export function getMotionBlurStyle(): MotionBlurOutput {
  const stx = getDragStx()
  // Access the computed value
  const computed = stx.computed.motionBlurStyle
  // Atom.get() to read
  return computed.get?.() ?? {
    filter: undefined,
    transform: undefined,
    transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
    isActive: false,
    blurAmount: 0,
    strategy: 'none' as BlurStrategy,
  }
}

export function getBlurStrategy(): BlurStrategy {
  const stx = getDragStx()
  const computed = stx.computed.blurStrategy
  return computed.get?.() ?? 'none'
}

/**
 * Check if an element is part of the current drag
 */
export function isElementDragged(elementId: string): boolean {
  const drag = getActiveDrag()
  return drag?.elementIds.includes(elementId) ?? false
}
