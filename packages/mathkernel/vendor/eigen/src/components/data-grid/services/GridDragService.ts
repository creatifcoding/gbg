/**
 * GridDragService
 *
 * Effect-based service for managing grid drag operations.
 * Handles the hybrid drag model: AG-Grid internal → pointer events on canvas.
 */

import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as SubscriptionRef from 'effect/SubscriptionRef'
import type {
  DragState,
  GridDragEvent,
  GridRow,
  Point,
  DragPhase,
} from '../types'
import { INITIAL_DRAG_STATE, DragPhase as DragPhaseEnum } from '../types'

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface GridDragServiceApi {
  /** Get current drag state */
  readonly getState: Effect.Effect<DragState>

  /** Dispatch a drag event (updates state based on event) */
  readonly dispatch: (event: GridDragEvent) => Effect.Effect<void>

  /** Subscribe to state changes */
  readonly subscribe: (
    handler: (state: DragState) => void
  ) => Effect.Effect<() => void>

  /** Reset to idle state */
  readonly reset: Effect.Effect<void>

  /** Check if currently dragging */
  readonly isDragging: Effect.Effect<boolean>
}

// =============================================================================
// SERVICE TAG
// =============================================================================

export class GridDragService extends Context.Tag('GridDragService')<
  GridDragService,
  GridDragServiceApi
>() {}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

const makeGridDragService = Effect.gen(function* () {
  // SubscriptionRef allows subscribing to state changes
  const stateRef = yield* SubscriptionRef.make(INITIAL_DRAG_STATE)

  // Event handlers by tag
  const handleEvent = (
    state: DragState,
    event: GridDragEvent
  ): DragState => {
    switch (event._tag) {
      case 'GridDragStart':
        return {
          ...state,
          phase: DragPhaseEnum.GridInternal,
          rowData: event.rowData,
          gridId: event.gridId,
          startPos: event.startPos,
          currentPos: event.startPos,
        }

      case 'GridDragMove':
        return {
          ...state,
          currentPos: event.currentPos,
          // Transition to canvas tracking when exiting grid
          phase: event.isInsideGrid
            ? DragPhaseEnum.GridInternal
            : DragPhaseEnum.Transitioning,
        }

      case 'GridExit':
        return {
          ...state,
          phase: DragPhaseEnum.Transitioning,
          currentPos: event.exitPos,
        }

      case 'CanvasEnter':
        return {
          ...state,
          phase: DragPhaseEnum.CanvasTracking,
          ghostShapeId: event.ghostShapeId,
          currentPos: event.canvasPos,
        }

      case 'CanvasMove':
        return {
          ...state,
          currentPos: event.canvasPos,
        }

      case 'Drop':
        // Reset state after successful drop
        return INITIAL_DRAG_STATE

      case 'Cancel':
        // Reset state on cancel
        return INITIAL_DRAG_STATE

      default:
        return state
    }
  }

  return GridDragService.of({
    getState: SubscriptionRef.get(stateRef),

    dispatch: (event: GridDragEvent) =>
      Effect.gen(function* () {
        const currentState = yield* SubscriptionRef.get(stateRef)
        const nextState = handleEvent(currentState, event)

        // Log state transition for observability
        yield* Effect.logDebug(
          `[GridDrag] ${event._tag}: ${currentState.phase} → ${nextState.phase}`
        )

        yield* SubscriptionRef.set(stateRef, nextState)
      }),

    subscribe: (handler: (state: DragState) => void) =>
      Effect.gen(function* () {
        // Get the subscription stream
        const changes = stateRef.changes

        // Create a fiber that runs the handler on each change
        const fiber = yield* Effect.fork(
          Effect.forEach(changes, (state) =>
            Effect.sync(() => handler(state))
          )
        )

        // Return unsubscribe function
        return () => {
          Effect.runFork(Effect.interruptWith(fiber, fiber.id()))
        }
      }),

    reset: SubscriptionRef.set(stateRef, INITIAL_DRAG_STATE),

    isDragging: Effect.gen(function* () {
      const state = yield* SubscriptionRef.get(stateRef)
      return state.phase !== DragPhaseEnum.Idle
    }),
  })
})

// =============================================================================
// SERVICE LAYER
// =============================================================================

export const GridDragServiceLive = Layer.effect(
  GridDragService,
  makeGridDragService
)

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/** Create a GridDragStart event */
export const gridDragStart = (
  rowData: GridRow,
  gridId: string,
  startPos: Point
): GridDragEvent => ({
  _tag: 'GridDragStart',
  rowData,
  gridId,
  startPos,
})

/** Create a GridDragMove event */
export const gridDragMove = (
  currentPos: Point,
  isInsideGrid: boolean
): GridDragEvent => ({
  _tag: 'GridDragMove',
  currentPos,
  isInsideGrid,
})

/** Create a GridExit event */
export const gridExit = (exitPos: Point, rowData: GridRow): GridDragEvent => ({
  _tag: 'GridExit',
  exitPos,
  rowData,
})

/** Create a CanvasEnter event */
export const canvasEnter = (
  canvasPos: Point,
  ghostShapeId: string
): GridDragEvent => ({
  _tag: 'CanvasEnter',
  canvasPos,
  ghostShapeId,
})

/** Create a CanvasMove event */
export const canvasMove = (
  screenPos: Point,
  canvasPos: Point
): GridDragEvent => ({
  _tag: 'CanvasMove',
  screenPos,
  canvasPos,
})

/** Create a Drop event */
export const drop = (canvasPos: Point, rowData: GridRow): GridDragEvent => ({
  _tag: 'Drop',
  canvasPos,
  rowData,
})

/** Create a Cancel event */
export const cancel = (reason: string): GridDragEvent => ({
  _tag: 'Cancel',
  reason,
})
