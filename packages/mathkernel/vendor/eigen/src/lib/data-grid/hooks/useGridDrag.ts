/**
 * useGridDrag Hook
 *
 * Connects AG-Grid row drag events to GridDragService.
 * Provides handlers for AG-Grid and cursor boundary detection.
 *
 * @module
 */

import { useCallback, useEffect, useRef } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import type {
  RowDragEnterEvent,
  RowDragMoveEvent,
  RowDragEndEvent,
  RowDragLeaveEvent,
} from 'ag-grid-community'
import { useDataGridContext } from '../components/DataGridContext'
import {
  GridDragService,
  gridDragStart,
  gridDragMove,
  gridExit,
  canvasMove,
  drop,
  cancel,
} from '../services'
import type { GridRow, DragState, Point } from '../types'
import { DragPhaseEnum, INITIAL_DRAG_STATE } from '../types'
import * as Effect from 'effect/Effect'

// =============================================================================
// TYPES
// =============================================================================

export interface UseGridDragOptions {
  /** Container ref for boundary detection */
  containerRef: React.RefObject<HTMLElement>
  /** Callback when row exits grid bounds */
  onGridExit?: (rowData: GridRow, screenPos: Point) => void
  /** Callback when drop completes */
  onDrop?: (rowData: GridRow, canvasPos: Point) => void
  /** Callback when drag is cancelled */
  onCancel?: (reason: string) => void
  /** Transform screen position to canvas position */
  screenToCanvas?: (screenPos: Point) => Point
}

export interface UseGridDragResult {
  /** Current drag state (reactive) */
  state: DragState
  /** Whether currently dragging */
  isDragging: boolean
  /** Whether cursor is outside grid */
  isOutsideGrid: boolean
  /** AG-Grid onRowDragEnter handler */
  onRowDragEnter: (event: RowDragEnterEvent) => void
  /** AG-Grid onRowDragMove handler */
  onRowDragMove: (event: RowDragMoveEvent) => void
  /** AG-Grid onRowDragEnd handler */
  onRowDragEnd: (event: RowDragEndEvent) => void
  /** AG-Grid onRowDragLeave handler */
  onRowDragLeave: (event: RowDragLeaveEvent) => void
  /** Cancel current drag */
  cancelDrag: () => void
  /** Complete drop at position */
  completeDrop: (canvasPos: Point) => void
}

// =============================================================================
// HOOK
// =============================================================================

export function useGridDrag(options: UseGridDragOptions): UseGridDragResult {
  const {
    containerRef,
    onGridExit,
    onDrop,
    onCancel,
    screenToCanvas = (p) => p, // Default: identity
  } = options

  const { gridId, runtime } = useDataGridContext()

  // Track state via ref for event handlers
  const stateRef = useRef<DragState>(INITIAL_DRAG_STATE)

  // Dispatch helper
  const dispatch = useCallback(
    (event: Parameters<typeof runtime.runSync>[0] extends Effect.Effect<infer _A, infer _E, infer _R>
      ? never
      : never) => {
      // This is a placeholder - actual dispatch goes through service
    },
    [runtime]
  )

  // Get service and dispatch events
  const dispatchEvent = useCallback(
    (event: Parameters<typeof gridDragStart>[0] extends GridRow ? any : any) => {
      const effect = Effect.gen(function* () {
        const service = yield* GridDragService
        yield* service.dispatch(event)
        return yield* service.getState
      })

      // Run synchronously and update ref
      const result = runtime.runSync(effect)
      stateRef.current = result
    },
    [runtime]
  )

  // AG-Grid: Row drag started
  const onRowDragEnter = useCallback(
    (event: RowDragEnterEvent) => {
      const rowData = event.node.data as GridRow
      const mouseEvent = event.event as MouseEvent
      const startPos: Point = { x: mouseEvent.clientX, y: mouseEvent.clientY }

      const effect = Effect.gen(function* () {
        const service = yield* GridDragService
        yield* service.dispatch(gridDragStart(rowData, gridId, startPos))
        return yield* service.getState
      })

      stateRef.current = runtime.runSync(effect)
    },
    [gridId, runtime]
  )

  // AG-Grid: Row drag moving
  const onRowDragMove = useCallback(
    (event: RowDragMoveEvent) => {
      const state = stateRef.current
      if (state.phase === DragPhaseEnum.Idle) return

      const mouseEvent = event.event as MouseEvent
      const currentPos: Point = { x: mouseEvent.clientX, y: mouseEvent.clientY }

      // Check if cursor is outside grid bounds
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const isInside =
        currentPos.x >= containerRect.left &&
        currentPos.x <= containerRect.right &&
        currentPos.y >= containerRect.top &&
        currentPos.y <= containerRect.bottom

      const effect = Effect.gen(function* () {
        const service = yield* GridDragService
        yield* service.dispatch(gridDragMove(currentPos, isInside))
        const newState = yield* service.getState

        // Fire callback when exiting grid
        if (!isInside && state.phase === DragPhaseEnum.GridInternal && newState.rowData) {
          onGridExit?.(newState.rowData, currentPos)
        }

        return newState
      })

      stateRef.current = runtime.runSync(effect)
    },
    [containerRef, runtime, onGridExit]
  )

  // AG-Grid: Row drag ended (internal)
  const onRowDragEnd = useCallback(
    (event: RowDragEndEvent) => {
      const state = stateRef.current

      // If we're tracking on canvas, let pointer handlers handle cleanup
      if (state.phase === DragPhaseEnum.CanvasTracking) {
        return
      }

      // Internal drop - reset state
      const effect = Effect.gen(function* () {
        const service = yield* GridDragService
        yield* service.reset
        return yield* service.getState
      })

      stateRef.current = runtime.runSync(effect)
    },
    [runtime]
  )

  // AG-Grid: Row drag leave
  const onRowDragLeave = useCallback(
    (_event: RowDragLeaveEvent) => {
      // Handled by onRowDragMove boundary detection
    },
    []
  )

  // Cancel drag
  const cancelDrag = useCallback(() => {
    const effect = Effect.gen(function* () {
      const service = yield* GridDragService
      yield* service.dispatch(cancel('user-cancelled'))
      onCancel?.('user-cancelled')
      return yield* service.getState
    })

    stateRef.current = runtime.runSync(effect)
  }, [runtime, onCancel])

  // Complete drop
  const completeDrop = useCallback(
    (canvasPos: Point) => {
      const state = stateRef.current

      const effect = Effect.gen(function* () {
        const service = yield* GridDragService

        if (state.rowData) {
          yield* service.dispatch(drop(canvasPos, state.rowData))
          onDrop?.(state.rowData, canvasPos)
        }

        return yield* service.getState
      })

      stateRef.current = runtime.runSync(effect)
    },
    [runtime, onDrop]
  )

  // Keyboard handler for escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stateRef.current.phase !== DragPhaseEnum.Idle) {
        cancelDrag()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelDrag])

  // Pointer handlers for canvas tracking
  useEffect(() => {
    const state = stateRef.current
    if (state.phase !== DragPhaseEnum.CanvasTracking) return

    const handlePointerMove = (e: PointerEvent) => {
      const screenPos: Point = { x: e.clientX, y: e.clientY }
      const canvasPos = screenToCanvas(screenPos)

      const effect = Effect.gen(function* () {
        const service = yield* GridDragService
        yield* service.dispatch(canvasMove(screenPos, canvasPos))
        return yield* service.getState
      })

      stateRef.current = runtime.runSync(effect)
    }

    const handlePointerUp = (e: PointerEvent) => {
      const screenPos: Point = { x: e.clientX, y: e.clientY }
      const canvasPos = screenToCanvas(screenPos)
      completeDrop(canvasPos)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [stateRef.current.phase, runtime, screenToCanvas, completeDrop])

  return {
    state: stateRef.current,
    isDragging: stateRef.current.phase !== DragPhaseEnum.Idle,
    isOutsideGrid:
      stateRef.current.phase === DragPhaseEnum.Transitioning ||
      stateRef.current.phase === DragPhaseEnum.CanvasTracking,
    onRowDragEnter,
    onRowDragMove,
    onRowDragEnd,
    onRowDragLeave,
    cancelDrag,
    completeDrop,
  }
}
