/**
 * Drag Orchestrator System
 *
 * Centralized drag management with:
 * - Full stx pattern (Legend-State + XState + Effect)
 * - Velocity tracking with EMA smoothing
 * - Direction-aware motion blur
 * - Threshold-based blur strategy (individual vs wrapper)
 * - Multi-element drag support
 *
 * Used by:
 * - Selection system (marquee select + drag)
 * - Floating panel system (panel drag)
 * - Custom draggables
 *
 * @example
 * ```tsx
 * import { useDragOrchestrator, useElementBlurStyle } from '@/lib/drag'
 *
 * // In a draggable component
 * function DraggableCard({ id }) {
 *   const blurStyle = useElementBlurStyle(id)
 *   const { startDrag, updatePosition, endDrag } = useDragOrchestrator()
 *
 *   return (
 *     <div
 *       style={{
 *         filter: blurStyle.filter,
 *         transform: blurStyle.transform,
 *         transition: blurStyle.transition,
 *       }}
 *       onPointerDown={(e) => {
 *         e.currentTarget.setPointerCapture(e.pointerId)
 *         startDrag('selection', id, [id], { x: e.clientX, y: e.clientY })
 *       }}
 *       onPointerMove={(e) => {
 *         if (e.buttons > 0) updatePosition({ x: e.clientX, y: e.clientY })
 *       }}
 *       onPointerUp={endDrag}
 *     />
 *   )
 * }
 * ```
 *
 * @module
 */

// =============================================================================
// STX Instance
// =============================================================================

export {
  getDragStx,
  resetDragStx,
  disposeDragStx,
  // Direct operations
  startDrag,
  updateDragPosition,
  addDragElements,
  removeDragElements,
  endDrag,
  cancelDrag,
  updateModifiers,
  updateBlurConfig,
  // Getters
  getActiveDrag,
  getDragVelocity,
  getMotionBlurStyle,
  getBlurStrategy,
  isElementDragged,
} from './drag-stx'

// =============================================================================
// Hooks
// =============================================================================

export {
  useDragOrchestrator,
  useIsElementDragged,
  useElementBlurStyle,
  type UseDragOrchestratorOptions,
} from './hooks/useDragOrchestrator'

// =============================================================================
// Types
// =============================================================================

export {
  // Schemas
  Vector2D,
  DragVelocity,
  BlurStrategy,
  BlurConfig,
  DragSource,
  DragOperation,
  // Interfaces
  type MotionBlurOutput,
  type DragStxData,
  type DragMachineEvent,
  type DragMachineContext,
  type UseDragOrchestratorReturn,
} from './types'

// =============================================================================
// Machine
// =============================================================================

export { dragMachine, type DragMachine } from './machines/drag-machine'
